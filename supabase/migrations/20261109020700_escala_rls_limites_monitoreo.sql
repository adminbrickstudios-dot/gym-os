-- Carril B · F9.4 y F9.6 (ESC-03, 05, 06, 08):
--   * RLS con (select auth.uid()): las políticas que llamaban auth.uid() pelado (se evalúa por fila) pasan a (select auth.uid()) (se evalúa una vez).
--     Parte de las políticas VIGENTES (pg_policies), no de una copia: solo toca las que todavía lo tienen pelado.
--   * Índices en las claves foráneas calientes que no tenían ninguno.
--   * Límites por plan en datos (socios y sedes) y "se acerca al límite".
--   * Tablas que crecen: tamaño y crecimiento a la vista; el registro de BRIK, siempre paginado (por cursor).
--   * Alertas de la plataforma (errores, avisos de pago fallidos, límites, tablas grandes) para el tablero y el chequeo programado.

do $$
begin
  if to_regprocedure('privado.exigir_brik(text[])') is null then raise exception 'Guarda: falta privado.exigir_brik'; end if;
  if to_regclass('public.registro_brik') is null then raise exception 'Guarda: falta registro_brik'; end if;
  if to_regprocedure('privado.estado_abono(uuid)') is null then raise exception 'Guarda: falta privado.estado_abono'; end if;
end $$;

-- ── ESC-03 · (select auth.uid()) en las políticas ───────────────────
do $$
declare p record; q text; w text; n int := 0;
begin
  for p in select schemaname, tablename, policyname, qual, with_check from pg_policies
            where schemaname = 'public'
              and (coalesce(qual, '') || coalesce(with_check, '')) ~ 'auth\.uid\(\)'
              and (coalesce(qual, '') || coalesce(with_check, '')) !~ '(?i)select auth\.uid\(\)' loop
    q := replace(p.qual, 'auth.uid()', '(select auth.uid())');
    w := replace(p.with_check, 'auth.uid()', '(select auth.uid())');
    execute format('alter policy %I on %I.%I%s%s', p.policyname, p.schemaname, p.tablename,
                   case when q is not null then format(' using (%s)', q) else '' end,
                   case when w is not null then format(' with check (%s)', w) else '' end);
    n := n + 1;
  end loop;
  raise notice 'Políticas con (select auth.uid()): %', n;
end $$;

-- ── Índices en claves foráneas calientes (los que no tenían ninguno que arrancara por esa columna) ──
create index if not exists movimientos_caja_por_turno on public.movimientos_caja (turno_caja_id);
create index if not exists pagos_por_turno on public.pagos (turno_caja_id) where turno_caja_id is not null;
create index if not exists ventas_por_turno on public.ventas (turno_caja_id) where turno_caja_id is not null;
create index if not exists coberturas_por_item on public.coberturas (venta_item_id) where venta_item_id is not null;
create index if not exists clases_por_profe on public.clases (profe_id) where profe_id is not null;
create index if not exists horarios_clase_por_profe on public.horarios_clase (profe_id) where profe_id is not null;

-- ── ESC-08 · Límites por plan de BRIK, en datos ─────────────────────
alter table public.plataforma_planes add column if not exists max_socios int;
alter table public.plataforma_planes add column if not exists max_sedes int;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'plataforma_planes_limites_validos') then
    alter table public.plataforma_planes add constraint plataforma_planes_limites_validos
      check ((max_socios is null or max_socios > 0) and (max_sedes is null or max_sedes > 0));
  end if;
end $$;

-- Sin límite = vacío. No se hace cumplir (no bloquea altas): se muestra "se acerca" y "pasó" en el super admin (ver PREGUNTAS.md).
create or replace function public.admin_guardar_limites_plan(p_plan_id uuid, p_max_socios int, p_max_sedes int) returns void
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  perform privado.exigir_brik(array['principal', 'ventas']);
  if (p_max_socios is not null and p_max_socios <= 0) or (p_max_sedes is not null and p_max_sedes <= 0) then
    raise exception 'Los límites tienen que ser mayores a cero (o vacíos: sin límite)' using errcode = '22023';
  end if;
  update public.plataforma_planes set max_socios = p_max_socios, max_sedes = p_max_sedes where id = p_plan_id;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'Ese plan no existe' using errcode = 'P0002'; end if;
  perform privado.registrar_brik('guardar_limites_plan', null, jsonb_build_object('plan_id', p_plan_id, 'max_socios', p_max_socios, 'max_sedes', p_max_sedes));
end $$;

-- Cada gimnasio con plan: lo que usa contra lo que incluye. estado: ok · cerca (desde el 90 %) · pasado · sin_limite.
create or replace function public.admin_limites_gimnasios() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform privado.exigir_brik(array['principal', 'soporte', 'ventas', 'lectura']);
  return coalesce((select jsonb_agg(f order by (f ->> 'orden')::int, f ->> 'nombre') from (
    select jsonb_build_object('gimnasio_id', x.id, 'nombre', x.nombre, 'plan', x.plan, 'socios', x.socios, 'max_socios', x.max_socios, 'sedes', x.sedes, 'max_sedes', x.max_sedes,
             'estado', case when x.max_socios is null and x.max_sedes is null then 'sin_limite'
                            when (x.max_socios is not null and x.socios > x.max_socios) or (x.max_sedes is not null and x.sedes > x.max_sedes) then 'pasado'
                            when (x.max_socios is not null and x.socios >= x.max_socios * 0.9) or (x.max_sedes is not null and x.sedes >= x.max_sedes * 0.9) then 'cerca'
                            else 'ok' end,
             'orden', case when (x.max_socios is not null and x.socios > x.max_socios) or (x.max_sedes is not null and x.sedes > x.max_sedes) then 0
                           when (x.max_socios is not null and x.socios >= x.max_socios * 0.9) or (x.max_sedes is not null and x.sedes >= x.max_sedes * 0.9) then 1 else 2 end) as f
      from (select g.id, g.nombre, pl.nombre plan, pl.max_socios, pl.max_sedes,
                   (select count(*)::int from public.socios s where s.gimnasio_id = g.id and s.dado_de_baja_en is null) socios,
                   (select count(*)::int from public.sedes d where d.gimnasio_id = g.id) sedes
              from public.gimnasios g join public.plataforma_planes pl on pl.id = g.plataforma_plan_id
             where not g.es_demo and g.baja_en is null) x) t), '[]'::jsonb);
end $$;

-- Los planes con sus límites (para editarlos).
create or replace function public.admin_planes_con_limites() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform privado.exigir_brik(array['principal', 'soporte', 'ventas', 'lectura']);
  return coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'nombre', p.nombre, 'activo', p.activo, 'max_socios', p.max_socios, 'max_sedes', p.max_sedes,
            'gimnasios', (select count(*)::int from public.gimnasios g where g.plataforma_plan_id = p.id)) order by p.activo desc, p.precio_mensual)
    from public.plataforma_planes p), '[]'::jsonb);
end $$;

-- ── ESC-05 · Tablas que crecen ──────────────────────────────────────
-- Filas y tamaño de las tablas que crecen sin fin. "partir" = ya conviene partirla por mes (ver docs/base/ESCALA.md).
create or replace function public.admin_tamano_tablas() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform privado.exigir_brik(array['principal', 'soporte', 'ventas', 'lectura']);
  return coalesce((select jsonb_agg(jsonb_build_object('tabla', t.relname, 'filas', t.n_live_tup, 'megas', round(pg_total_relation_size(t.relid) / 1048576.0, 1),
            'partir', t.n_live_tup > 5000000 or pg_total_relation_size(t.relid) > 2147483648) order by pg_total_relation_size(t.relid) desc)
    from pg_stat_user_tables t
   where t.schemaname = 'public' and t.relname in ('ingresos', 'registro_brik', 'errores_app', 'eventos_webhook', 'pagos', 'ventas', 'venta_items', 'asistencias', 'reservas', 'coberturas', 'historial_configuracion', 'avisos_enviados')), '[]'::jsonb);
end $$;

-- El registro de BRIK, siempre paginado por cursor: p_antes = el "cuando" de la última fila que ya se vio.
drop function if exists public.admin_registro_brik(int);
create or replace function public.admin_registro_brik(p_limite int default 100, p_antes timestamptz default null) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform privado.exigir_brik(array['principal', 'lectura']);
  return coalesce((select jsonb_agg(jsonb_build_object('accion', r.accion, 'quien', coalesce(u.email, 'sin mail'), 'gimnasio', g.nombre, 'gimnasio_id', r.gimnasio_id, 'detalle', r.detalle, 'cuando', r.creado_en) order by r.creado_en desc)
    from (select * from public.registro_brik x where p_antes is null or x.creado_en < p_antes order by x.creado_en desc limit least(greatest(coalesce(p_limite, 100), 1), 200)) r
    left join auth.users u on u.id = r.usuario_id left join public.gimnasios g on g.id = r.gimnasio_id), '[]'::jsonb);
end $$;
revoke execute on function public.admin_registro_brik(int, timestamptz) from public, anon;
grant execute on function public.admin_registro_brik(int, timestamptz) to authenticated;

-- ── ESC-06 · Alertas ────────────────────────────────────────────────
-- Lo que mira el chequeo programado y el tablero. nivel: rojo (hay que actuar) · amarillo (mirar). Se calcula al pedirlo, sin cron.
create or replace function public.admin_alertas() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare a jsonb := '[]'::jsonb; n int;
begin
  perform privado.exigir_brik(array['principal', 'soporte', 'ventas', 'lectura']);
  select count(*)::int into n from public.errores_app where creado_en > now() - interval '1 hour';
  if n >= 20 then a := a || jsonb_build_array(jsonb_build_object('clave', 'errores_hora', 'nivel', 'rojo', 'texto', n || ' errores en la última hora'));
  elsif n >= 5 then a := a || jsonb_build_array(jsonb_build_object('clave', 'errores_hora', 'nivel', 'amarillo', 'texto', n || ' errores en la última hora')); end if;
  select count(*)::int into n from public.eventos_webhook where error is not null and procesado_en is null and recibido_en > now() - interval '24 hours';
  if n > 0 then a := a || jsonb_build_array(jsonb_build_object('clave', 'webhooks_fallidos', 'nivel', 'rojo', 'texto', n || ' avisos de MercadoPago fallidos en 24 h')); end if;
  select count(*)::int into n from public.gimnasios g where not g.es_demo and g.baja_en is null and privado.estado_abono(g.id) ->> 'estado' = 'vencido';
  if n > 0 then a := a || jsonb_build_array(jsonb_build_object('clave', 'abonos_vencidos', 'nivel', 'amarillo', 'texto', n || ' abonos a BRIK vencidos')); end if;
  select count(*)::int into n from jsonb_array_elements(public.admin_limites_gimnasios()) x where x ->> 'estado' in ('cerca', 'pasado');
  if n > 0 then a := a || jsonb_build_array(jsonb_build_object('clave', 'limites', 'nivel', 'amarillo', 'texto', n || ' gimnasios cerca o por encima del límite de su plan')); end if;
  select count(*)::int into n from jsonb_array_elements(public.admin_tamano_tablas()) x where (x ->> 'partir')::boolean;
  if n > 0 then a := a || jsonb_build_array(jsonb_build_object('clave', 'tablas_grandes', 'nivel', 'amarillo', 'texto', n || ' tablas ya conviene partirlas por mes')); end if;
  return jsonb_build_object('alertas', a, 'hay_rojas', exists (select 1 from jsonb_array_elements(a) x where x ->> 'nivel' = 'rojo'), 'hora', now());
end $$;

revoke execute on function public.admin_guardar_limites_plan(uuid, int, int), public.admin_limites_gimnasios(), public.admin_planes_con_limites(),
  public.admin_tamano_tablas(), public.admin_alertas() from public, anon;
grant execute on function public.admin_guardar_limites_plan(uuid, int, int), public.admin_limites_gimnasios(), public.admin_planes_con_limites(),
  public.admin_tamano_tablas(), public.admin_alertas() to authenticated;

do $$
declare f text; pelados int;
begin
  foreach f in array array['admin_guardar_limites_plan(uuid,integer,integer)', 'admin_limites_gimnasios()', 'admin_planes_con_limites()', 'admin_tamano_tablas()', 'admin_alertas()', 'admin_registro_brik(integer,timestamp with time zone)'] loop
    if to_regprocedure('public.' || f) is null then raise exception 'Falta public.%', f; end if;
  end loop;
  if to_regprocedure('public.admin_registro_brik(integer)') is not null then raise exception 'Quedó la firma vieja de admin_registro_brik'; end if;
  select count(*) into pelados from pg_policies where schemaname = 'public' and (coalesce(qual, '') || coalesce(with_check, '')) ~ 'auth\.uid\(\)'
     and (coalesce(qual, '') || coalesce(with_check, '')) !~ '(?i)select auth\.uid\(\)';
  if pelados > 0 then raise exception 'Quedaron % políticas con auth.uid() pelado', pelados; end if;
end $$;
