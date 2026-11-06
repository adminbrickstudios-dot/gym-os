-- VD-20 · Rutinas: biblioteca, plantillas, asignar a varios, la de hoy y quién la hizo (docs/v2/03-DUENO.md §10).
-- Sobre RUT-1/2/3:
--   · ejercicios con equipo (además del grupo muscular) para filtrar la biblioteca;
--   · plantillas: una rutina marcada como plantilla se copia (copiar_rutina) y la copia se edita sola;
--   · asignar_rutina_varios: una rutina a muchos socios de una vez, con fecha de cambio (la que sirve para el aviso "toca renovar");
--   · lo hecho: el socio marca "hice el Día N" (un hecho por día calendario del gimnasio); "la de hoy" sale CALCULADA
--     (el día que sigue al último que hizo; nada guardado, nada de cron);
--   · rutinas_progreso_equipo: el profe ve quién la hizo, cuántas veces en 30 días y a quién ya le toca cambiarla.
-- Pesos levantados sí; condiciones médicas, lesiones o diagnósticos NO (regla del proyecto): ningún campo nuevo las admite.
--   marcar_plantilla(rutina, si) · copiar_rutina(rutina, nombre) · asignar_rutina_varios(rutina, socios[], cambiar_en)
--   marcar_dia_rutina(socio, dia) · desmarcar_dia_rutina(socio, dia) · rutinas_progreso_equipo(gimnasio)
--   rutina_de_socio (con "hoy" y lo hecho) · rutinas_gimnasio / ejercicios_gimnasio / guardar_ejercicio (con equipo)

-- ── Guarda de entrada ───────────────────────────────────────────────
do $$
begin
  if to_regprocedure('public.guardar_rutina(uuid, uuid, text, text, jsonb)') is null then raise exception 'Guarda: falta RUT-1 (0103)'; end if;
  if to_regprocedure('public.rutina_de_socio(uuid)') is null then raise exception 'Guarda: falta RUT-2 (0104)'; end if;
  if to_regprocedure('privado.exigir_socio_o_rutinas(uuid)') is null then raise exception 'Guarda: falta privado.exigir_socio_o_rutinas'; end if;
end $$;

-- ── Columnas nuevas (aditivas) ──────────────────────────────────────
alter table public.ejercicios add column if not exists equipo text not null default 'otro'
  check (equipo in ('barra', 'mancuernas', 'maquina', 'polea', 'peso_corporal', 'kettlebell', 'banda', 'otro'));
alter table public.rutinas add column if not exists plantilla boolean not null default false;
alter table public.rutinas_socio add column if not exists cambiar_en date;

-- ── Lo que el socio hizo (un hecho por día calendario) ──────────────
create table if not exists public.rutina_dias_hechos (
  id           uuid primary key default gen_random_uuid(),
  gimnasio_id  uuid not null references public.gimnasios(id),
  socio_id     uuid not null,
  rutina_id    uuid not null,
  dia          int not null check (dia between 1 and 7),
  fecha        date not null,
  creado_en    timestamptz not null default now(),
  unique (gimnasio_id, id),
  unique (gimnasio_id, socio_id, rutina_id, dia, fecha),
  foreign key (gimnasio_id, socio_id) references public.socios (gimnasio_id, id),
  foreign key (gimnasio_id, rutina_id) references public.rutinas (gimnasio_id, id)
);
create index if not exists rutina_dias_hechos_socio on public.rutina_dias_hechos (gimnasio_id, socio_id, fecha desc);
select privado.politicas_estandar('public.rutina_dias_hechos', array['dueno', 'encargado', 'profe'], null, true);
revoke all on table public.rutina_dias_hechos from anon;
revoke truncate, references, trigger on public.rutina_dias_hechos from authenticated;

-- ── Biblioteca con equipo (la firma crece: la vieja se borra) ───────
drop function if exists public.guardar_ejercicio(uuid, uuid, text, text, text, boolean);

create or replace function public.guardar_ejercicio(p_gimnasio_id uuid, p_id uuid, p_nombre text, p_grupo text, p_video text default null,
                                                    p_activo boolean default true, p_equipo text default 'otro')
returns uuid language plpgsql security definer set search_path = '' as $$
declare nom text := trim(coalesce(p_nombre, '')); vid text := nullif(trim(coalesce(p_video, '')), ''); eid uuid; n int; eq text := coalesce(p_equipo, 'otro');
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado', 'profe']);
  if length(nom) < 2 then raise exception 'Escribí el nombre del ejercicio' using errcode = '22023'; end if;
  if coalesce(p_grupo, '') not in ('piernas', 'gluteos', 'espalda', 'pecho', 'hombros', 'brazos', 'core', 'cardio', 'completo', 'otro') then
    raise exception 'Elegí el grupo muscular' using errcode = '22023';
  end if;
  if eq not in ('barra', 'mancuernas', 'maquina', 'polea', 'peso_corporal', 'kettlebell', 'banda', 'otro') then raise exception 'Elegí el equipo' using errcode = '22023'; end if;
  if vid is not null and (vid !~ '^https://\S+$' or length(vid) > 300) then raise exception 'El video: un link que empiece con https://' using errcode = '22023'; end if;
  if coalesce(p_activo, true) and exists (select 1 from public.ejercicios e where e.gimnasio_id = p_gimnasio_id and e.activo and lower(e.nombre) = lower(nom) and e.id is distinct from p_id) then
    raise exception 'Ya hay un ejercicio que se llama %', nom using errcode = '23505';
  end if;
  if p_id is null then
    insert into public.ejercicios (gimnasio_id, nombre, grupo, video_url, activo, equipo) values (p_gimnasio_id, nom, p_grupo, vid, coalesce(p_activo, true), eq) returning id into eid;
    return eid;
  end if;
  update public.ejercicios set nombre = nom, grupo = p_grupo, video_url = vid, activo = coalesce(p_activo, true), equipo = eq where id = p_id and gimnasio_id = p_gimnasio_id;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'Ese ejercicio no es de este gimnasio' using errcode = '42501'; end if;
  return p_id;
end $$;

create or replace function public.ejercicios_gimnasio(p_gimnasio_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado', 'profe']);
  return coalesce((select jsonb_agg(jsonb_build_object('id', e.id, 'nombre', e.nombre, 'grupo', e.grupo, 'equipo', e.equipo, 'video_url', e.video_url, 'activo', e.activo)
                     order by e.activo desc, e.grupo, e.nombre)
                     from public.ejercicios e where e.gimnasio_id = p_gimnasio_id), '[]'::jsonb);
end $$;

create or replace function public.rutinas_gimnasio(p_gimnasio_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado', 'profe']);
  return coalesce((select jsonb_agg(jsonb_build_object('id', r.id, 'nombre', r.nombre, 'descripcion', r.descripcion, 'plantilla', r.plantilla,
            'dias', (select count(distinct x.dia) from public.rutina_ejercicios x where x.rutina_id = r.id),
            'ejercicios', (select count(*) from public.rutina_ejercicios x where x.rutina_id = r.id),
            'asignados', (select count(*) from public.rutinas_socio rs where rs.rutina_id = r.id and rs.quitada_en is null)) order by r.plantilla desc, r.nombre)
    from public.rutinas r where r.gimnasio_id = p_gimnasio_id and r.activa), '[]'::jsonb);
end $$;

create or replace function public.marcar_plantilla(p_rutina_id uuid, p_plantilla boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare g uuid; n int;
begin
  select gimnasio_id into g from public.rutinas where id = p_rutina_id;
  if g is null then raise exception 'Sin permiso o rutina inexistente' using errcode = '42501'; end if;
  perform privado.exigir_equipo(g, array['dueno', 'encargado', 'profe']);
  update public.rutinas set plantilla = coalesce(p_plantilla, false), actualizado_en = now() where id = p_rutina_id and activa and plantilla is distinct from coalesce(p_plantilla, false);
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'Esa rutina no está activa o ya estaba así' using errcode = '22023'; end if;
end $$;

-- Una copia propia (no plantilla) con todos los días y ejercicios: se edita sin tocar la original.
create or replace function public.copiar_rutina(p_rutina_id uuid, p_nombre text default null) returns uuid
language plpgsql security definer set search_path = '' as $$
declare r public.rutinas; eid uuid; nuevo uuid; nom text;
begin
  select * into r from public.rutinas where id = p_rutina_id and activa;
  if not found then raise exception 'Sin permiso o rutina inexistente' using errcode = '42501'; end if;
  eid := (privado.exigir_equipo(r.gimnasio_id, array['dueno', 'encargado', 'profe'])).id;
  nom := left(coalesce(nullif(trim(coalesce(p_nombre, '')), ''), r.nombre || ' (copia)'), 80);
  if length(nom) < 2 then raise exception 'Escribí el nombre de la rutina' using errcode = '22023'; end if;
  insert into public.rutinas (gimnasio_id, nombre, descripcion, creado_por, plantilla) values (r.gimnasio_id, nom, r.descripcion, eid, false) returning id into nuevo;
  insert into public.rutina_ejercicios (gimnasio_id, rutina_id, dia, orden, ejercicio_id, series, repeticiones, nota)
  select x.gimnasio_id, nuevo, x.dia, x.orden, x.ejercicio_id, x.series, x.repeticiones, x.nota from public.rutina_ejercicios x where x.rutina_id = r.id;
  return nuevo;
end $$;

-- ── Asignar a varios ────────────────────────────────────────────────
-- Cada socio queda con UNA rutina activa (la anterior se cierra, igual que asignar_rutina). Los dados de baja y los que no son
-- de este gimnasio se saltean y se cuentan aparte: nunca se asigna por error a alguien de otro lado.
create or replace function public.asignar_rutina_varios(p_rutina_id uuid, p_socios uuid[], p_cambiar_en date default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare r public.rutinas; eid uuid; s uuid; v_ok int := 0; v_omitidos int := 0; v_lista uuid[];
begin
  select * into r from public.rutinas where id = p_rutina_id and activa;
  if not found then raise exception 'Esa rutina no existe o está archivada' using errcode = '22023'; end if;
  eid := (privado.exigir_equipo(r.gimnasio_id, array['dueno', 'encargado', 'profe'])).id;
  select coalesce(array_agg(distinct x), '{}') into v_lista from unnest(coalesce(p_socios, '{}')) x where x is not null;
  if cardinality(v_lista) = 0 then raise exception 'Elegí al menos un socio' using errcode = '22023'; end if;
  if cardinality(v_lista) > 200 then raise exception 'Hasta 200 socios por vez' using errcode = '22023'; end if;
  if p_cambiar_en is not null and p_cambiar_en < (now() at time zone (select g.zona_horaria from public.gimnasios g where g.id = r.gimnasio_id))::date then
    raise exception 'La fecha de cambio no puede ser anterior a hoy' using errcode = '22023'; end if;
  foreach s in array v_lista loop
    if exists (select 1 from public.socios so where so.id = s and so.gimnasio_id = r.gimnasio_id and so.dado_de_baja_en is null) then
      update public.rutinas_socio set quitada_en = now() where socio_id = s and quitada_en is null;
      insert into public.rutinas_socio (gimnasio_id, socio_id, rutina_id, asignada_por, cambiar_en) values (r.gimnasio_id, s, r.id, eid, p_cambiar_en);
      v_ok := v_ok + 1;
    else
      v_omitidos := v_omitidos + 1;
    end if;
  end loop;
  if v_ok = 0 then raise exception 'Ninguno de esos socios se puede asignar (¿están dados de baja?)' using errcode = '22023'; end if;
  return jsonb_build_object('asignados', v_ok, 'omitidos', v_omitidos);
end $$;

-- ── La rutina del socio, con "la de hoy" y lo hecho ─────────────────
create or replace function public.rutina_de_socio(p_socio_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare rs public.rutinas_socio; r public.rutinas; zona text; hoy date; v_dias int[]; v_ultimo int; v_hoy int; v_hecho_hoy boolean;
begin
  perform privado.exigir_socio_o_rutinas(p_socio_id);
  select * into rs from public.rutinas_socio where socio_id = p_socio_id and quitada_en is null;
  if not found then return null; end if;
  select * into r from public.rutinas where id = rs.rutina_id;
  select g.zona_horaria into zona from public.gimnasios g where g.id = r.gimnasio_id;
  hoy := (now() at time zone zona)::date;
  select coalesce(array_agg(distinct x.dia order by x.dia), '{}') into v_dias from public.rutina_ejercicios x where x.rutina_id = r.id;
  -- Si ya marcó un día hoy, "hoy" es ese; si no, el que sigue al último que hizo (y vuelve al primero al terminar la vuelta).
  select h.dia into v_hoy from public.rutina_dias_hechos h where h.socio_id = p_socio_id and h.rutina_id = r.id and h.fecha = hoy order by h.creado_en desc limit 1;
  v_hecho_hoy := v_hoy is not null;
  if v_hoy is null then
    select h.dia into v_ultimo from public.rutina_dias_hechos h where h.socio_id = p_socio_id and h.rutina_id = r.id order by h.fecha desc, h.creado_en desc limit 1;
    v_hoy := coalesce((select d from unnest(v_dias) d where v_ultimo is not null and d > v_ultimo order by d limit 1), v_dias[1]);
  end if;
  return jsonb_build_object('rutina_id', r.id, 'nombre', r.nombre, 'descripcion', r.descripcion, 'asignada_en', rs.asignada_en, 'cambiar_en', rs.cambiar_en,
    'hoy', jsonb_build_object('dia', v_hoy, 'hecho', v_hecho_hoy),
    'hechos', coalesce((select jsonb_agg(jsonb_build_object('dia', h.dia, 'fecha', h.fecha) order by h.fecha desc, h.creado_en desc)
                          from public.rutina_dias_hechos h where h.socio_id = p_socio_id and h.rutina_id = r.id and h.fecha > hoy - 30), '[]'::jsonb),
    'items', coalesce((select jsonb_agg(jsonb_build_object('dia', x.dia, 'orden', x.orden, 'ejercicio_id', x.ejercicio_id, 'ejercicio', e.nombre,
              'grupo', e.grupo, 'equipo', e.equipo, 'video_url', e.video_url, 'series', x.series, 'repeticiones', x.repeticiones, 'nota', x.nota,
              'ultimo', (select jsonb_build_object('peso', g.peso, 'repeticiones', g.repeticiones, 'momento', g.momento)
                           from public.registros_ejercicio g where g.socio_id = p_socio_id and g.ejercicio_id = x.ejercicio_id and g.anulado_en is null
                          order by g.momento desc limit 1)) order by x.dia, x.orden)
       from public.rutina_ejercicios x join public.ejercicios e on e.id = x.ejercicio_id where x.rutina_id = r.id), '[]'::jsonb));
end $$;

-- ── Marcar lo hecho ─────────────────────────────────────────────────
-- El socio mismo (o el profe por él) marca "hice el Día N". Una vez por día calendario del gimnasio; repetirlo no duplica.
create or replace function public.marcar_dia_rutina(p_socio_id uuid, p_dia int) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare g uuid; rs public.rutinas_socio; zona text; hoy date; n int;
begin
  g := privado.exigir_socio_o_rutinas(p_socio_id);
  select * into rs from public.rutinas_socio where socio_id = p_socio_id and quitada_en is null;
  if not found then raise exception 'No tenés una rutina asignada.' using errcode = '22023'; end if;
  if not exists (select 1 from public.rutina_ejercicios x where x.rutina_id = rs.rutina_id and x.dia = p_dia) then
    raise exception 'Ese día no existe en tu rutina.' using errcode = '22023'; end if;
  select gi.zona_horaria into zona from public.gimnasios gi where gi.id = g;
  hoy := (now() at time zone zona)::date;
  insert into public.rutina_dias_hechos (gimnasio_id, socio_id, rutina_id, dia, fecha) values (g, p_socio_id, rs.rutina_id, p_dia, hoy)
  on conflict (gimnasio_id, socio_id, rutina_id, dia, fecha) do nothing;
  get diagnostics n = row_count;
  return jsonb_build_object('ya_estaba', n = 0, 'fecha', hoy);
end $$;

-- Se tocó por error: se deshace solo el de hoy.
create or replace function public.desmarcar_dia_rutina(p_socio_id uuid, p_dia int) returns void
language plpgsql security definer set search_path = '' as $$
declare g uuid; zona text; n int;
begin
  g := privado.exigir_socio_o_rutinas(p_socio_id);
  select gi.zona_horaria into zona from public.gimnasios gi where gi.id = g;
  delete from public.rutina_dias_hechos h where h.socio_id = p_socio_id and h.dia = p_dia and h.fecha = (now() at time zone zona)::date
     and h.rutina_id in (select rs.rutina_id from public.rutinas_socio rs where rs.socio_id = p_socio_id and rs.quitada_en is null);
  get diagnostics n = row_count;
  if n = 0 then raise exception 'No tenías ese día marcado hoy.' using errcode = '22023'; end if;
end $$;

-- ── Lo que ve el profe: quién la hizo ───────────────────────────────
create or replace function public.rutinas_progreso_equipo(p_gimnasio_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare zona text; hoy date;
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado', 'profe']);
  select g.zona_horaria into zona from public.gimnasios g where g.id = p_gimnasio_id;
  hoy := (now() at time zone zona)::date;
  return coalesce((
    select jsonb_agg(jsonb_build_object('socio_id', s.id, 'nombre', trim(s.nombre || ' ' || s.apellido), 'rutina_id', r.id, 'rutina', r.nombre,
             'asignada_en', rs.asignada_en, 'cambiar_en', rs.cambiar_en, 'toca_cambiar', rs.cambiar_en is not null and rs.cambiar_en <= hoy,
             'veces_30', (select count(*) from public.rutina_dias_hechos h where h.socio_id = s.id and h.rutina_id = r.id and h.fecha > hoy - 30),
             'ultima', (select max(h.fecha) from public.rutina_dias_hechos h where h.socio_id = s.id and h.rutina_id = r.id),
             'hoy', exists (select 1 from public.rutina_dias_hechos h where h.socio_id = s.id and h.rutina_id = r.id and h.fecha = hoy))
           order by (rs.cambiar_en is not null and rs.cambiar_en <= hoy) desc,
                    (select max(h.fecha) from public.rutina_dias_hechos h where h.socio_id = s.id and h.rutina_id = r.id) nulls first, s.apellido, s.nombre)
      from public.rutinas_socio rs
      join public.rutinas r on r.id = rs.rutina_id
      join public.socios s on s.id = rs.socio_id
     where rs.gimnasio_id = p_gimnasio_id and rs.quitada_en is null and s.dado_de_baja_en is null), '[]'::jsonb);
end $$;

-- ── Permisos ────────────────────────────────────────────────────────
revoke all on function public.guardar_ejercicio(uuid, uuid, text, text, text, boolean, text), public.ejercicios_gimnasio(uuid), public.rutinas_gimnasio(uuid),
  public.marcar_plantilla(uuid, boolean), public.copiar_rutina(uuid, text), public.asignar_rutina_varios(uuid, uuid[], date), public.rutina_de_socio(uuid),
  public.marcar_dia_rutina(uuid, int), public.desmarcar_dia_rutina(uuid, int), public.rutinas_progreso_equipo(uuid) from public, anon, authenticated;
grant execute on function public.guardar_ejercicio(uuid, uuid, text, text, text, boolean, text), public.ejercicios_gimnasio(uuid), public.rutinas_gimnasio(uuid),
  public.marcar_plantilla(uuid, boolean), public.copiar_rutina(uuid, text), public.asignar_rutina_varios(uuid, uuid[], date), public.rutina_de_socio(uuid),
  public.marcar_dia_rutina(uuid, int), public.desmarcar_dia_rutina(uuid, int), public.rutinas_progreso_equipo(uuid) to authenticated, service_role;

-- ── Verificación ────────────────────────────────────────────────────
do $$
declare f text;
begin
  if not (select relrowsecurity from pg_class where oid = 'public.rutina_dias_hechos'::regclass) then raise exception 'Verificación: rutina_dias_hechos sin RLS'; end if;
  if to_regprocedure('public.guardar_ejercicio(uuid, uuid, text, text, text, boolean)') is not null then raise exception 'Verificación: quedó la guardar_ejercicio vieja'; end if;
  foreach f in array array['public.marcar_plantilla(uuid, boolean)', 'public.copiar_rutina(uuid, text)', 'public.asignar_rutina_varios(uuid, uuid[], date)',
                           'public.marcar_dia_rutina(uuid, integer)', 'public.desmarcar_dia_rutina(uuid, integer)', 'public.rutinas_progreso_equipo(uuid)'] loop
    if not exists (select 1 from pg_proc where oid = f::regprocedure and 'search_path=""' = any (proconfig)) then raise exception 'Verificación: % sin search_path vacío', f; end if;
    if has_function_privilege('anon', f, 'execute') then raise exception 'Verificación: anon puede ejecutar %', f; end if;
  end loop;
end $$;
