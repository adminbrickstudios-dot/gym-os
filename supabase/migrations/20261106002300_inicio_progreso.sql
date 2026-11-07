-- 2300 · VD-23 · Inicio del socio: progreso (semana, racha, meta del mes, hitos),
-- "Entraste" y la bienvenida de la primera vez.
-- Todo sale de los ingresos que pasaron: no se guarda ningún contador.
--   configuracion_gimnasio.meta_visitas_mes   la meta del mes que pone el gimnasio (default 12)
--   socios.bienvenida_vista_en                cuándo vio (o salteó) la bienvenida; null = primera vez
--   progreso_inicio(socio)                    lo del inicio, en un pedido
--   marcar_bienvenida(socio)                  el socio la vio o la salteó

-- ── Guarda de entrada ───────────────────────────────────────────────
do $$
begin
  if to_regprocedure('public.racha_socio(uuid)') is null then raise exception 'Guarda: falta racha_socio (0091)'; end if;
  if to_regprocedure('privado.mis_socios()') is null then raise exception 'Guarda: falta privado.mis_socios'; end if;
end $$;

-- ── Columnas (aditivo: nullable → backfill → restricciones) ─────────
alter table public.configuracion_gimnasio add column if not exists meta_visitas_mes int not null default 12;
alter table public.configuracion_gimnasio drop constraint if exists configuracion_meta_visitas_valida;
alter table public.configuracion_gimnasio add constraint configuracion_meta_visitas_valida check (meta_visitas_mes between 1 and 31);

alter table public.socios add column if not exists bienvenida_vista_en timestamptz;
-- Los socios que ya existen no ven una bienvenida de "primera vez": la ven los que se anoten desde ahora.
update public.socios set bienvenida_vista_en = coalesce(bienvenida_vista_en, now()) where bienvenida_vista_en is null;

-- ── El progreso del inicio ──────────────────────────────────────────
create or replace function public.progreso_inicio(p_socio_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare g uuid; zona text; hoy date; lunes date; racha jsonb; meta int; total bigint; ultima timestamptz; semana jsonb; vista timestamptz;
begin
  select gimnasio_id, bienvenida_vista_en into g, vista from public.socios where id = p_socio_id;
  if g is null then raise exception 'Sin permiso o socio inexistente' using errcode = '42501'; end if;
  if p_socio_id not in (select privado.mis_socios()) then perform privado.exigir_equipo(g, array['dueno', 'encargado', 'recepcion', 'profe']); end if;
  select zona_horaria into zona from public.gimnasios where id = g;
  select meta_visitas_mes into meta from public.configuracion_gimnasio where gimnasio_id = g;
  hoy := privado.dia_local(now(), zona);
  lunes := date_trunc('week', hoy)::date;
  racha := public.racha_socio(p_socio_id);
  select count(*) into total from public.ingresos i
    where i.socio_id = p_socio_id and i.anulado_en is null and i.resultado <> 'rechazado';
  select max(i.momento) into ultima from public.ingresos i
    where i.socio_id = p_socio_id and i.anulado_en is null and i.resultado <> 'rechazado'
      and i.momento >= privado.medianoche(hoy, zona);
  -- Los 7 días de esta semana (lunes a domingo): si vino, y cuál es hoy.
  select jsonb_agg(jsonb_build_object(
           'dia', d, 'hoy', d = hoy,
           'vino', exists (select 1 from public.ingresos i where i.socio_id = p_socio_id and i.anulado_en is null and i.resultado <> 'rechazado'
                             and i.momento >= privado.medianoche(d, zona) and i.momento < privado.medianoche(d + 1, zona))) order by d)
    into semana from generate_series(0, 6) as x(n), lateral (select lunes + x.n as d) q;
  return jsonb_build_object(
    'semana', semana,
    'semanas_seguidas', racha -> 'semanas_seguidas',
    'entradas_mes', racha -> 'entradas_mes',
    'entradas_mes_anterior', racha -> 'entradas_mes_anterior',
    'vino_esta_semana', racha -> 'vino_esta_semana',
    'meta_mes', meta,
    'total_entradas', total,
    -- el hito se celebra el día en que se llega a él
    'hito', case when ultima is not null and total in (10, 50, 100, 250, 500, 1000) then total end,
    'entro_hoy', ultima,
    'bienvenida_pendiente', vista is null);
end $$;

-- ── La bienvenida vista o salteada ──────────────────────────────────
create or replace function public.marcar_bienvenida(p_socio_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  if p_socio_id not in (select privado.mis_socios()) then raise exception 'Sin permiso' using errcode = '42501'; end if;
  update public.socios set bienvenida_vista_en = coalesce(bienvenida_vista_en, now()) where id = p_socio_id;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'No se pudo marcar la bienvenida' using errcode = 'P0002'; end if;
end $$;

revoke all on function public.progreso_inicio(uuid), public.marcar_bienvenida(uuid) from public, anon, authenticated;
grant execute on function public.progreso_inicio(uuid), public.marcar_bienvenida(uuid) to authenticated, service_role;

-- ── Verificación ────────────────────────────────────────────────────
do $$
declare f text;
begin
  foreach f in array array['public.progreso_inicio(uuid)', 'public.marcar_bienvenida(uuid)'] loop
    if not exists (select 1 from pg_proc where oid = f::regprocedure and 'search_path=""' = any (proconfig)) then
      raise exception 'Verificación: % sin search_path vacío', f;
    end if;
    if has_function_privilege('anon', f, 'execute') then raise exception 'Verificación: anon puede ejecutar %', f; end if;
  end loop;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'socios' and column_name = 'bienvenida_vista_en') then
    raise exception 'Verificación: falta socios.bienvenida_vista_en';
  end if;
end $$;
