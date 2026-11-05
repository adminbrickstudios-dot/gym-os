-- 0133 · Grados y cinturones (COM-13).
-- Para artes marciales: cada actividad puede tener grados en orden (blanco,
-- amarillo, naranja…), cada uno con lo que pide para rendirlo: clases desde
-- el grado anterior y meses desde el grado anterior. El grado de cada socio
-- es un hecho (quién lo otorgó y cuándo; se anula con motivo, no se borra).
-- "Listos para rendir" se calcula, no se guarda: asistencias y tiempo desde
-- el grado actual (o desde su primera clase de esa actividad).
--   grados_panel(gimnasio)                         el equipo: grados por actividad y listos para rendir
--   guardar_grado(actividad, grado, nombre, …)    dueño y encargado
--   archivar_grado(grado)                          dueño y encargado
--   otorgar_grado(socio, grado, fecha)             dueño, encargado y profe
--   anular_grado_socio(id, motivo)                 dueño y encargado
--   grados_socio(socio)                            el equipo o el socio

-- ── Guarda de entrada ───────────────────────────────────────────────
do $$
begin
  if to_regclass('public.asistencias') is null then raise exception 'Guarda: falta asistencias'; end if;
  if to_regprocedure('privado.mis_socios()') is null then raise exception 'Guarda: falta privado.mis_socios'; end if;
end $$;

create table if not exists public.grados (
  id              uuid primary key default gen_random_uuid(),
  gimnasio_id     uuid not null references public.gimnasios(id),
  actividad_id    uuid not null,
  orden           int not null check (orden between 1 and 50),
  nombre          text not null check (length(trim(nombre)) between 2 and 40),
  color           text check (color is null or color ~ '^#[0-9a-fA-F]{6}$'),
  clases_minimas  int not null default 0 check (clases_minimas between 0 and 1000),
  meses_minimos   int not null default 0 check (meses_minimos between 0 and 120),
  activo          boolean not null default true,
  creado_en       timestamptz not null default now(),
  unique (gimnasio_id, id),
  foreign key (gimnasio_id, actividad_id) references public.actividades (gimnasio_id, id)
);
create unique index if not exists grados_orden_activo on public.grados (gimnasio_id, actividad_id, orden) where activo;
select privado.politicas_estandar('public.grados', array['dueno', 'encargado', 'recepcion', 'profe'], null, false);
revoke all on table public.grados from anon;
revoke truncate, references, trigger on public.grados from authenticated;

create table if not exists public.grados_socio (
  id              uuid primary key default gen_random_uuid(),
  gimnasio_id     uuid not null references public.gimnasios(id),
  socio_id        uuid not null,
  grado_id        uuid not null,
  otorgado_en     timestamptz not null default now(),
  otorgado_por    uuid not null,
  anulado_en      timestamptz,
  anulado_motivo  text,
  anulado_por     uuid,
  creado_en       timestamptz not null default now(),
  unique (gimnasio_id, id),
  check ((anulado_en is null) = (anulado_motivo is null)),
  foreign key (gimnasio_id, socio_id) references public.socios (gimnasio_id, id),
  foreign key (gimnasio_id, grado_id) references public.grados (gimnasio_id, id),
  foreign key (gimnasio_id, otorgado_por) references public.equipo (gimnasio_id, id),
  foreign key (gimnasio_id, anulado_por) references public.equipo (gimnasio_id, id)
);
create index if not exists grados_socio_por_socio on public.grados_socio (socio_id) where anulado_en is null;
select privado.politicas_estandar('public.grados_socio', array['dueno', 'encargado', 'recepcion', 'profe'], null, true);
revoke all on table public.grados_socio from anon;
revoke truncate, references, trigger on public.grados_socio from authenticated;

-- Dónde está un socio en una actividad: su grado (el más alto vigente), el que sigue,
-- y cuánto lleva desde el grado actual (o desde su primera clase de esa actividad).
create or replace function privado.progreso_grado(p_socio_id uuid, p_actividad_id uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  with actual as (
    select gs.id, gs.otorgado_en, g.id as grado_id, g.nombre, g.color, g.orden
      from public.grados_socio gs join public.grados g on g.id = gs.grado_id
     where gs.socio_id = p_socio_id and g.actividad_id = p_actividad_id and gs.anulado_en is null
     order by g.orden desc, gs.otorgado_en desc limit 1
  ), proximo as (
    select g.* from public.grados g
     where g.actividad_id = p_actividad_id and g.activo and g.orden > coalesce((select a.orden from actual a), 0)
     order by g.orden limit 1
  ), desde as (
    select coalesce((select a.otorgado_en from actual a),
                    (select min(c.inicio) from public.asistencias x join public.clases c on c.id = x.clase_id
                      where x.socio_id = p_socio_id and x.anulada_en is null and c.actividad_id = p_actividad_id)) as t
  ), cuenta as (
    select (select count(*) from public.asistencias x join public.clases c on c.id = x.clase_id
             where x.socio_id = p_socio_id and x.anulada_en is null and c.actividad_id = p_actividad_id
               and c.inicio >= (select t from desde))::int as clases,
           (select (extract(year from age(now(), t)) * 12 + extract(month from age(now(), t)))::int from desde) as meses
  )
  select jsonb_build_object(
    'actual', (select jsonb_build_object('grado_id', a.grado_id, 'nombre', a.nombre, 'color', a.color, 'otorgado_en', a.otorgado_en) from actual a),
    'proximo', (select jsonb_build_object('grado_id', p.id, 'nombre', p.nombre, 'color', p.color, 'clases_minimas', p.clases_minimas, 'meses_minimos', p.meses_minimos) from proximo p),
    'desde', (select t from desde),
    'clases', coalesce((select clases from cuenta), 0),
    'meses', coalesce((select meses from cuenta), 0),
    'listo', coalesce((select (select t from desde) is not null and c.clases >= p.clases_minimas and coalesce(c.meses, 0) >= p.meses_minimos
                         from cuenta c, proximo p), false))
$$;
revoke all on function privado.progreso_grado(uuid, uuid) from public, anon, authenticated;

create or replace function public.grados_panel(p_gimnasio_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado', 'recepcion', 'profe']);
  return jsonb_build_object(
    'actividades', coalesce((select jsonb_agg(jsonb_build_object('actividad_id', a.id, 'nombre', a.nombre, 'emoji', a.emoji,
        'grados', coalesce((select jsonb_agg(jsonb_build_object('grado_id', g.id, 'orden', g.orden, 'nombre', g.nombre, 'color', g.color,
                                                                'clases_minimas', g.clases_minimas, 'meses_minimos', g.meses_minimos,
                                                                'socios', (select count(distinct gs.socio_id) from public.grados_socio gs join public.socios s on s.id = gs.socio_id
                                                                            where gs.grado_id = g.id and gs.anulado_en is null and s.dado_de_baja_en is null))
                                            order by g.orden) from public.grados g where g.actividad_id = a.id and g.activo), '[]'))
        order by a.nombre)
      from public.actividades a where a.gimnasio_id = p_gimnasio_id and a.activa), '[]'),
    'listos', coalesce((select jsonb_agg(jsonb_build_object('socio_id', s.id, 'nombre', trim(s.nombre || ' ' || coalesce(s.apellido, '')),
                                                           'actividad', a.nombre, 'actividad_id', a.id) || pr.p order by a.nombre, s.nombre)
      from public.actividades a
      join lateral (select distinct x.socio_id from public.asistencias x join public.clases c on c.id = x.clase_id
                     where c.actividad_id = a.id and x.anulada_en is null) q on true
      join public.socios s on s.id = q.socio_id and s.dado_de_baja_en is null
      cross join lateral (select privado.progreso_grado(s.id, a.id) as p) pr
     where a.gimnasio_id = p_gimnasio_id and a.activa
       and exists (select 1 from public.grados g where g.actividad_id = a.id and g.activo)
       and (pr.p ->> 'listo')::boolean), '[]'));
end $$;

create or replace function public.guardar_grado(p_actividad_id uuid, p_grado_id uuid, p_nombre text, p_orden int,
                                                p_clases_minimas int default 0, p_meses_minimos int default 0, p_color text default null) returns uuid
language plpgsql security definer set search_path = '' as $$
declare a public.actividades; v_nombre text := trim(coalesce(p_nombre, '')); v_id uuid; n int;
begin
  select * into a from public.actividades where id = p_actividad_id;
  if not found then raise exception 'Sin permiso o actividad inexistente' using errcode = '42501'; end if;
  perform privado.exigir_equipo(a.gimnasio_id, array['dueno', 'encargado']);
  if length(v_nombre) < 2 or length(v_nombre) > 40 then raise exception 'El nombre del grado tiene que tener entre 2 y 40 letras (ej: Cinturón azul).' using errcode = '22023'; end if;
  if p_orden is null or p_orden < 1 or p_orden > 50 then raise exception 'El orden va del 1 al 50.' using errcode = '22023'; end if;
  if coalesce(p_clases_minimas, 0) < 0 or coalesce(p_clases_minimas, 0) > 1000 then raise exception 'Las clases van de 0 a 1.000.' using errcode = '22023'; end if;
  if coalesce(p_meses_minimos, 0) < 0 or coalesce(p_meses_minimos, 0) > 120 then raise exception 'Los meses van de 0 a 120.' using errcode = '22023'; end if;
  if p_color is not null and p_color !~ '^#[0-9a-fA-F]{6}$' then raise exception 'El color no es válido' using errcode = '22023'; end if;
  begin
    if p_grado_id is null then
      insert into public.grados (gimnasio_id, actividad_id, orden, nombre, color, clases_minimas, meses_minimos)
      values (a.gimnasio_id, a.id, p_orden, v_nombre, p_color, coalesce(p_clases_minimas, 0), coalesce(p_meses_minimos, 0))
      returning id into v_id;
    else
      update public.grados set orden = p_orden, nombre = v_nombre, color = p_color, clases_minimas = coalesce(p_clases_minimas, 0), meses_minimos = coalesce(p_meses_minimos, 0)
       where id = p_grado_id and actividad_id = a.id and activo
      returning id into v_id;
      get diagnostics n = row_count;
      if n <> 1 then raise exception 'Ese grado no existe o está archivado' using errcode = '22023'; end if;
    end if;
  exception when unique_violation then
    raise exception 'Ya hay un grado con el número % en %: elegí otro orden.', p_orden, a.nombre using errcode = '23505';
  end;
  return v_id;
end $$;

create or replace function public.archivar_grado(p_grado_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare g public.grados; n int;
begin
  select * into g from public.grados where id = p_grado_id;
  if not found then raise exception 'Sin permiso o grado inexistente' using errcode = '42501'; end if;
  perform privado.exigir_equipo(g.gimnasio_id, array['dueno', 'encargado']);
  update public.grados set activo = false where id = g.id and activo;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'Ese grado ya estaba archivado' using errcode = '22023'; end if;
end $$;

create or replace function public.otorgar_grado(p_socio_id uuid, p_grado_id uuid, p_fecha date default null) returns uuid
language plpgsql security definer set search_path = '' as $$
declare s public.socios; g public.grados; e public.equipo; zona text; v_en timestamptz; v_id uuid;
begin
  select * into s from public.socios where id = p_socio_id;
  select * into g from public.grados where id = p_grado_id;
  if s.id is null or g.id is null or s.gimnasio_id <> g.gimnasio_id then raise exception 'Sin permiso o grado inexistente' using errcode = '42501'; end if;
  e := privado.exigir_equipo(s.gimnasio_id, array['dueno', 'encargado', 'profe']);
  if not g.activo then raise exception 'Ese grado está archivado' using errcode = '22023'; end if;
  if s.dado_de_baja_en is not null then raise exception 'El socio está dado de baja' using errcode = '22023'; end if;
  if exists (select 1 from public.grados_socio x where x.socio_id = s.id and x.grado_id = g.id and x.anulado_en is null) then
    raise exception 'Ya tiene %', g.nombre using errcode = '22023';
  end if;
  select gi.zona_horaria into zona from public.gimnasios gi where gi.id = s.gimnasio_id;
  if p_fecha is null then v_en := now();
  else
    if p_fecha > (now() at time zone zona)::date then raise exception 'La fecha no puede ser futura' using errcode = '22023'; end if;
    v_en := privado.medianoche(p_fecha, zona) + interval '12 hours';
  end if;
  insert into public.grados_socio (gimnasio_id, socio_id, grado_id, otorgado_en, otorgado_por)
  values (s.gimnasio_id, s.id, g.id, v_en, e.id) returning id into v_id;
  return v_id;
end $$;

create or replace function public.anular_grado_socio(p_id uuid, p_motivo text) returns void
language plpgsql security definer set search_path = '' as $$
declare x public.grados_socio; e public.equipo; n int;
begin
  select * into x from public.grados_socio where id = p_id;
  if not found then raise exception 'Sin permiso o registro inexistente' using errcode = '42501'; end if;
  e := privado.exigir_equipo(x.gimnasio_id, array['dueno', 'encargado']);
  if length(trim(coalesce(p_motivo, ''))) < 3 then raise exception 'Escribí por qué se anula' using errcode = '22023'; end if;
  update public.grados_socio set anulado_en = now(), anulado_motivo = trim(p_motivo), anulado_por = e.id where id = x.id and anulado_en is null;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'Ya estaba anulado' using errcode = '22023'; end if;
end $$;

create or replace function public.grados_socio(p_socio_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare s public.socios;
begin
  select * into s from public.socios where id = p_socio_id;
  if not found then raise exception 'Sin permiso o socio inexistente' using errcode = '42501'; end if;
  if not (p_socio_id in (select privado.mis_socios())) then
    perform privado.exigir_equipo(s.gimnasio_id, array['dueno', 'encargado', 'recepcion', 'profe']);
  end if;
  return coalesce((select jsonb_agg(jsonb_build_object('actividad_id', a.id, 'actividad', a.nombre, 'emoji', a.emoji,
      'grados', (select jsonb_agg(jsonb_build_object('grado_id', g.id, 'nombre', g.nombre, 'orden', g.orden) order by g.orden)
                   from public.grados g where g.actividad_id = a.id and g.activo),
      'historial', coalesce((select jsonb_agg(jsonb_build_object('id', gs.id, 'nombre', g.nombre, 'color', g.color, 'otorgado_en', gs.otorgado_en,
                                                                'por', (select q.nombre from public.equipo q where q.id = gs.otorgado_por)) order by gs.otorgado_en desc)
                               from public.grados_socio gs join public.grados g on g.id = gs.grado_id
                              where gs.socio_id = s.id and g.actividad_id = a.id and gs.anulado_en is null), '[]'))
      || privado.progreso_grado(s.id, a.id) order by a.nombre)
    from public.actividades a
   where a.gimnasio_id = s.gimnasio_id and a.activa and exists (select 1 from public.grados g where g.actividad_id = a.id and g.activo)
     and (exists (select 1 from public.grados_socio gs join public.grados g on g.id = gs.grado_id where gs.socio_id = s.id and g.actividad_id = a.id and gs.anulado_en is null)
          or exists (select 1 from public.asistencias x join public.clases c on c.id = x.clase_id where x.socio_id = s.id and x.anulada_en is null and c.actividad_id = a.id))), '[]');
end $$;

revoke all on function public.grados_panel(uuid), public.guardar_grado(uuid, uuid, text, int, int, int, text), public.archivar_grado(uuid),
  public.otorgar_grado(uuid, uuid, date), public.anular_grado_socio(uuid, text), public.grados_socio(uuid) from public, anon, authenticated;
grant execute on function public.grados_panel(uuid), public.guardar_grado(uuid, uuid, text, int, int, int, text), public.archivar_grado(uuid),
  public.otorgar_grado(uuid, uuid, date), public.anular_grado_socio(uuid, text), public.grados_socio(uuid) to authenticated, service_role;

-- ── Verificación ────────────────────────────────────────────────────
do $$
begin
  if not (select relrowsecurity from pg_class where oid = 'public.grados'::regclass)
     or not (select relrowsecurity from pg_class where oid = 'public.grados_socio'::regclass) then raise exception 'Verificación: grados sin RLS'; end if;
  if has_function_privilege('anon', 'public.otorgar_grado(uuid, uuid, date)', 'execute') then raise exception 'Verificación: otorgar_grado quedó para anon'; end if;
end $$;
