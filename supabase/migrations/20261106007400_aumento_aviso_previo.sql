-- VD-46D · Aumento de precios con aviso previo y constancia por socio (caso 13, docs/v2/14).
--
-- Un aumento sin aviso termina en multa. Desde ahora aplicar_aumento exige que el
-- precio nuevo empiece con al menos N días de aviso (30 por defecto, el dueño lo
-- configura entre 7 y 90). Con menos días solo puede el DUEÑO, y tiene que escribir
-- el motivo: queda en el registro del aumento. Cada socio con membresía activa en
-- un plan que sube recibe su aviso dentro de la app (avisos_socio) y queda la
-- constancia: cuándo se le avisó y cuándo lo vio.
--
-- Lo ya cobrado no cambia nunca (el monto vive en el pago) y la cobertura pagada
-- se respeta hasta que vence: el precio nuevo rige para el próximo pago.
--
--   config_aumentos      el aviso mínimo del gimnasio (días)
--   aumentos_precio      cada aumento aplicado: quién, cuándo, desde cuándo, qué planes, por qué sin aviso
--   avisos_socio         bandeja de avisos del socio (hoy: aumentos); leido_en = "lo vio"
--
-- Equipo: config_aumento · guardar_config_aumento · aviso_previo_aumento · aplicar_aumento (7 args) · aumentos_hechos
-- Socio:  mis_avisos · marcar_aviso_leido
-- No se tocan vista_aumento, aumento_planes ni programar_lista_precios.

-- ── Guarda de entrada ───────────────────────────────────────────────
do $$
begin
  if to_regprocedure('public.aplicar_aumento(uuid, uuid[], text, numeric, int, date)') is null
     and to_regprocedure('public.aplicar_aumento(uuid, uuid[], text, numeric, int, date, text)') is null then
    raise exception 'Guarda: falta aplicar_aumento (PLA-4)';
  end if;
  if to_regprocedure('privado.aumento_planes(uuid, uuid[], text, numeric, int, date)') is null then raise exception 'Guarda: falta privado.aumento_planes'; end if;
  if to_regprocedure('privado.exigir_equipo(uuid, text[])') is null then raise exception 'Guarda: falta privado.exigir_equipo'; end if;
  if to_regprocedure('privado.mis_socios()') is null then raise exception 'Guarda: falta privado.mis_socios'; end if;
  if to_regprocedure('privado.dia_local(timestamptz, text)') is null then raise exception 'Guarda: falta privado.dia_local'; end if;
end $$;

-- ── Tablas ──────────────────────────────────────────────────────────
create table if not exists public.config_aumentos (
  gimnasio_id    uuid primary key references public.gimnasios(id),
  aviso_dias     int not null default 30 check (aviso_dias between 7 and 90),
  actualizado_en timestamptz not null default now(),
  actualizado_por uuid,
  foreign key (gimnasio_id, actualizado_por) references public.equipo (gimnasio_id, id)
);
alter table public.config_aumentos enable row level security;
drop policy if exists equipo_lee on public.config_aumentos;
create policy equipo_lee on public.config_aumentos for select to authenticated
  using (gimnasio_id in (select privado.mis_gimnasios(array['dueno', 'encargado'])) or privado.soy_admin_plataforma());
revoke all on table public.config_aumentos from anon;

create table if not exists public.aumentos_precio (
  id                uuid primary key default gen_random_uuid(),
  gimnasio_id       uuid not null references public.gimnasios(id),
  creado_en         timestamptz not null default now(),
  creado_por        uuid not null,
  creado_por_rol    text not null,
  vigente_desde     timestamptz not null,
  aviso_dias_exigido int not null check (aviso_dias_exigido between 7 and 90),
  aviso_dias_reales int not null,
  tipo              text not null check (tipo in ('porcentaje', 'monto')),
  valor             numeric(12,2) not null check (valor > 0),
  redondeo          int not null default 1,
  planes            jsonb not null,
  socios_avisados   int not null default 0,
  excepcion_motivo  text,
  unique (gimnasio_id, id),
  foreign key (gimnasio_id, creado_por) references public.equipo (gimnasio_id, id),
  check ((excepcion_motivo is null) = (aviso_dias_reales >= aviso_dias_exigido)),
  check (excepcion_motivo is null or length(trim(excepcion_motivo)) >= 10)
);
create index if not exists aumentos_precio_gimnasio on public.aumentos_precio (gimnasio_id, creado_en desc);
select privado.politicas_estandar('public.aumentos_precio', array['dueno', 'encargado'], '{}');

create table if not exists public.avisos_socio (
  id          uuid primary key default gen_random_uuid(),
  gimnasio_id uuid not null references public.gimnasios(id),
  socio_id    uuid not null,
  tipo        text not null check (tipo in ('aumento')),
  aumento_id  uuid,
  titulo      text not null check (length(titulo) between 1 and 120),
  texto       text not null check (length(texto) between 1 and 1000),
  creado_en   timestamptz not null default now(),
  leido_en    timestamptz,
  unique (gimnasio_id, id),
  unique (gimnasio_id, aumento_id, socio_id),
  foreign key (gimnasio_id, socio_id) references public.socios (gimnasio_id, id),
  foreign key (gimnasio_id, aumento_id) references public.aumentos_precio (gimnasio_id, id)
);
create index if not exists avisos_socio_socio on public.avisos_socio (gimnasio_id, socio_id, creado_en desc);
select privado.politicas_estandar('public.avisos_socio', array['dueno', 'encargado', 'recepcion'], '{}', true);

-- ── Configuración ───────────────────────────────────────────────────
create or replace function public.config_aumento(p_gimnasio_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare dias int;
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado']);
  select c.aviso_dias into dias from public.config_aumentos c where c.gimnasio_id = p_gimnasio_id;
  return jsonb_build_object('aviso_dias', coalesce(dias, 30));
end $$;

create or replace function public.guardar_config_aumento(p_gimnasio_id uuid, p_dias int) returns int
language plpgsql security definer set search_path = '' as $$
declare e public.equipo; n int;
begin
  e := privado.exigir_equipo(p_gimnasio_id, array['dueno']);
  if p_dias is null or p_dias < 7 or p_dias > 90 then raise exception 'El aviso previo va de 7 a 90 días' using errcode = '22023'; end if;
  insert into public.config_aumentos (gimnasio_id, aviso_dias, actualizado_por) values (p_gimnasio_id, p_dias, e.id)
  on conflict (gimnasio_id) do update set aviso_dias = excluded.aviso_dias, actualizado_en = now(), actualizado_por = e.id;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'No se pudo guardar'; end if;
  return p_dias;
end $$;

-- ── Qué falta para avisar bien ──────────────────────────────────────
create or replace function privado.aviso_previo_aumento(p_gimnasio_id uuid, p_planes uuid[], p_desde date)
returns jsonb
language plpgsql stable set search_path = '' as $$
declare zona text; hoy date; dias_min int; dias int; socios int;
begin
  select g.zona_horaria into zona from public.gimnasios g where g.id = p_gimnasio_id;
  hoy := privado.dia_local(now(), zona);
  select coalesce((select c.aviso_dias from public.config_aumentos c where c.gimnasio_id = p_gimnasio_id), 30) into dias_min;
  dias := greatest(coalesce(p_desde, hoy) - hoy, 0);
  select count(distinct su.socio_id)::int into socios
    from public.suscripciones su join public.socios so on so.gimnasio_id = su.gimnasio_id and so.id = su.socio_id
   where su.gimnasio_id = p_gimnasio_id and su.plan_id = any (coalesce(p_planes, '{}')) and su.baja_en is null and so.dado_de_baja_en is null;
  return jsonb_build_object('aviso_dias', dias_min, 'dias_de_aviso', dias, 'cumple', dias >= dias_min,
                            'fecha_minima', hoy + dias_min, 'socios_a_avisar', socios);
end $$;
revoke all on function privado.aviso_previo_aumento(uuid, uuid[], date) from public;

create or replace function public.aviso_previo_aumento(p_gimnasio_id uuid, p_planes uuid[], p_desde date) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare e public.equipo;
begin
  e := privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado']);
  return privado.aviso_previo_aumento(p_gimnasio_id, p_planes, p_desde) || jsonb_build_object('puede_excepcion', e.rol = 'dueno');
end $$;

-- ── Aplicar (reemplaza a la de 6 argumentos) ────────────────────────
drop function if exists public.aplicar_aumento(uuid, uuid[], text, numeric, int, date);

create or replace function public.aplicar_aumento(p_gimnasio_id uuid, p_planes uuid[], p_tipo text, p_valor numeric, p_redondeo int, p_desde date,
                                                  p_motivo_sin_aviso text default null)
returns int
language plpgsql security definer set search_path = '' as $$
declare e public.equipo; a jsonb; x jsonb; n int := 0; av jsonb; zona text; aumento uuid; motivo text := nullif(trim(coalesce(p_motivo_sin_aviso, '')), '');
        meses text[] := array['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
        dia date; fecha_txt text; avisados int := 0; k int;
begin
  e := privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado']);
  a := privado.aumento_planes(p_gimnasio_id, p_planes, p_tipo, p_valor, p_redondeo, p_desde);
  for x in select * from jsonb_array_elements(a -> 'planes') loop
    if x ->> 'problema' is not null then raise exception '%: %', x ->> 'nombre', x ->> 'problema' using errcode = '22023'; end if;
  end loop;

  -- Aviso previo: sin los días mínimos solo el dueño, y con motivo escrito.
  av := privado.aviso_previo_aumento(p_gimnasio_id, p_planes, p_desde);
  if not (av ->> 'cumple')::boolean then
    if e.rol <> 'dueno' then
      raise exception 'Hace falta avisar con % días de anticipación: elegí un "Desde" a partir del %. Si es urgente, lo tiene que aprobar el dueño.',
        av ->> 'aviso_dias', to_char((av ->> 'fecha_minima')::date, 'DD/MM/YYYY') using errcode = '22023';
    end if;
    if motivo is null or length(motivo) < 10 then
      raise exception 'Con menos de % días de aviso hace falta que escribas el motivo (mínimo 10 letras): queda registrado.', av ->> 'aviso_dias' using errcode = '22023';
    end if;
  else
    motivo := null;
  end if;

  select g.zona_horaria into zona from public.gimnasios g where g.id = p_gimnasio_id;
  dia := privado.dia_local((a ->> 'desde')::timestamptz, zona);
  fecha_txt := extract(day from dia)::int || ' de ' || meses[extract(month from dia)::int];

  insert into public.aumentos_precio (gimnasio_id, creado_por, creado_por_rol, vigente_desde, aviso_dias_exigido, aviso_dias_reales, tipo, valor, redondeo, planes, excepcion_motivo)
  values (p_gimnasio_id, e.id, e.rol, (a ->> 'desde')::timestamptz, (av ->> 'aviso_dias')::int, (av ->> 'dias_de_aviso')::int,
          p_tipo, p_valor, coalesce(p_redondeo, 1), a -> 'planes', motivo)
  returning id into aumento;

  for x in select * from jsonb_array_elements(a -> 'planes') loop
    perform public.programar_lista_precios((x ->> 'plan_id')::uuid, (x ->> 'nuevo')::numeric,
      (select coalesce(jsonb_agg(jsonb_build_object('medio', v -> 'medio', 'hasta_dia', v -> 'hasta_dia', 'monto', v -> 'monto')), '[]')
         from jsonb_array_elements(x -> 'variantes') v),
      p_desde);
    n := n + 1;
    -- La constancia: un aviso por socio con membresía activa en ese plan (uno solo por aumento).
    insert into public.avisos_socio (gimnasio_id, socio_id, tipo, aumento_id, titulo, texto)
    select p_gimnasio_id, su.socio_id, 'aumento', aumento,
           'Cambia el precio de tu plan',
           'Desde el ' || fecha_txt || ', ' || (x ->> 'nombre') || ' pasa de $' || translate(to_char((x ->> 'antes')::numeric, 'FM999,999,999,990.00'), ',.', '.,')
             || ' a $' || translate(to_char((x ->> 'nuevo')::numeric, 'FM999,999,999,990.00'), ',.', '.,')
             || '. Lo que ya pagaste no cambia: seguís con tu precio actual hasta que se termine tu cobertura.'
      from public.suscripciones su join public.socios so on so.gimnasio_id = su.gimnasio_id and so.id = su.socio_id
     where su.gimnasio_id = p_gimnasio_id and su.plan_id = (x ->> 'plan_id')::uuid and su.baja_en is null and so.dado_de_baja_en is null
    on conflict (gimnasio_id, aumento_id, socio_id) do nothing;
    get diagnostics k = row_count;
    avisados := avisados + k;
  end loop;

  update public.aumentos_precio set socios_avisados = avisados where id = aumento;
  get diagnostics k = row_count;
  if k <> 1 then raise exception 'No se pudo registrar el aumento'; end if;
  return n;
end $$;

-- ── Lo hecho, con la constancia ─────────────────────────────────────
create or replace function public.aumentos_hechos(p_gimnasio_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado']);
  return coalesce((select jsonb_agg(jsonb_build_object(
      'id', u.id, 'creado_en', u.creado_en, 'vigente_desde', u.vigente_desde, 'tipo', u.tipo, 'valor', u.valor,
      'aviso_dias_reales', u.aviso_dias_reales, 'aviso_dias_exigido', u.aviso_dias_exigido, 'excepcion_motivo', u.excepcion_motivo,
      'por', coalesce((select q.nombre from public.equipo q where q.id = u.creado_por), ''), 'por_rol', u.creado_por_rol,
      'planes', (select coalesce(jsonb_agg(p ->> 'nombre'), '[]') from jsonb_array_elements(u.planes) p),
      'avisados', u.socios_avisados,
      'vistos', (select count(*)::int from public.avisos_socio s where s.aumento_id = u.id and s.leido_en is not null)
    ) order by u.creado_en desc) from (select * from public.aumentos_precio w where w.gimnasio_id = p_gimnasio_id order by w.creado_en desc limit 20) u), '[]'::jsonb);
end $$;

-- ── El socio ve su aviso ────────────────────────────────────────────
create or replace function public.mis_avisos(p_socio_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if p_socio_id is null or p_socio_id not in (select privado.mis_socios()) then raise exception 'Sin permiso' using errcode = '42501'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'tipo', s.tipo, 'titulo', s.titulo, 'texto', s.texto, 'creado_en', s.creado_en)
                                     order by s.creado_en desc)
                     from (select * from public.avisos_socio w where w.socio_id = p_socio_id and w.leido_en is null order by w.creado_en desc limit 5) s), '[]'::jsonb);
end $$;

create or replace function public.marcar_aviso_leido(p_aviso_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare s public.avisos_socio; n int;
begin
  select * into s from public.avisos_socio where id = p_aviso_id;
  if not found or s.socio_id not in (select privado.mis_socios()) then raise exception 'Sin permiso o aviso inexistente' using errcode = '42501'; end if;
  update public.avisos_socio set leido_en = now() where id = s.id and leido_en is null;
  get diagnostics n = row_count;
  -- Si ya estaba leído no hay nada que hacer (idempotente); si no, tiene que haber escrito una fila.
  if n = 0 and not exists (select 1 from public.avisos_socio where id = s.id and leido_en is not null) then raise exception 'No se pudo marcar el aviso'; end if;
end $$;

revoke all on function public.config_aumento(uuid), public.guardar_config_aumento(uuid, int), public.aviso_previo_aumento(uuid, uuid[], date),
  public.aplicar_aumento(uuid, uuid[], text, numeric, int, date, text), public.aumentos_hechos(uuid),
  public.mis_avisos(uuid), public.marcar_aviso_leido(uuid) from public, anon, authenticated;
grant execute on function public.config_aumento(uuid), public.guardar_config_aumento(uuid, int), public.aviso_previo_aumento(uuid, uuid[], date),
  public.aplicar_aumento(uuid, uuid[], text, numeric, int, date, text), public.aumentos_hechos(uuid),
  public.mis_avisos(uuid), public.marcar_aviso_leido(uuid) to authenticated, service_role;

-- ── Verificación ────────────────────────────────────────────────────
do $$
declare f text;
begin
  foreach f in array array['public.config_aumento(uuid)', 'public.guardar_config_aumento(uuid, int)', 'public.aviso_previo_aumento(uuid, uuid[], date)',
                           'public.aplicar_aumento(uuid, uuid[], text, numeric, int, date, text)', 'public.aumentos_hechos(uuid)',
                           'public.mis_avisos(uuid)', 'public.marcar_aviso_leido(uuid)', 'privado.aviso_previo_aumento(uuid, uuid[], date)'] loop
    if not exists (select 1 from pg_proc where oid = f::regprocedure and 'search_path=""' = any (proconfig)) then
      raise exception 'Verificación: % sin search_path vacío', f;
    end if;
    if has_function_privilege('anon', f, 'execute') then raise exception 'Verificación: anon puede ejecutar %', f; end if;
  end loop;
  if to_regprocedure('public.aplicar_aumento(uuid, uuid[], text, numeric, int, date)') is not null then
    raise exception 'Verificación: quedó la firma vieja de aplicar_aumento';
  end if;
  if exists (select 1 from pg_class c where c.oid in ('public.config_aumentos'::regclass, 'public.aumentos_precio'::regclass, 'public.avisos_socio'::regclass) and not c.relrowsecurity) then
    raise exception 'Verificación: tabla sin RLS';
  end if;
end $$;
