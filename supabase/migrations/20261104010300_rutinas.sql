-- 0103 · Ejercicios y rutinas del gimnasio (RUT-1).
-- La biblioteca de ejercicios (nombre, grupo muscular, video por link) y las
-- rutinas plantilla: días (Día 1, Día 2… no días de la semana), y en cada día
-- los ejercicios con series y repeticiones ("12", "8-10", "30 s"). Las arman
-- el dueño, el encargado y los profes. Nada de salud: ni lesiones ni
-- condiciones (lo dice CLAUDE.md).
--   ejercicios_gimnasio(g) · guardar_ejercicio(g, id, nombre, grupo, video, activo)
--   rutinas_gimnasio(g) · rutina_detalle(rutina) · guardar_rutina(g, id, nombre, descripcion, items) · archivar_rutina(rutina)

-- ── Guarda de entrada ───────────────────────────────────────────────
do $$
begin
  if to_regprocedure('public.actividad_equipo(uuid, date)') is null then raise exception 'Guarda: falta la migración 0102'; end if;
  if not ('rutinas' = any (privado.secciones_validas())) then raise exception 'Guarda: rutinas no es una sección válida'; end if;
end $$;

create table if not exists public.ejercicios (
  id           uuid primary key default gen_random_uuid(),
  gimnasio_id  uuid not null references public.gimnasios(id),
  nombre       text not null check (length(trim(nombre)) between 2 and 80),
  grupo        text not null default 'otro' check (grupo in ('piernas', 'gluteos', 'espalda', 'pecho', 'hombros', 'brazos', 'core', 'cardio', 'completo', 'otro')),
  video_url    text check (video_url is null or (video_url ~ '^https://\S+$' and length(video_url) <= 300)),
  activo       boolean not null default true,
  creado_en    timestamptz not null default now(),
  unique (gimnasio_id, id)
);
create unique index if not exists ejercicios_nombre on public.ejercicios (gimnasio_id, lower(nombre)) where activo;
select privado.politicas_estandar('public.ejercicios', array['dueno', 'encargado', 'profe'], null, false);
revoke all on table public.ejercicios from anon;
revoke truncate, references, trigger on public.ejercicios from authenticated;

create table if not exists public.rutinas (
  id           uuid primary key default gen_random_uuid(),
  gimnasio_id  uuid not null references public.gimnasios(id),
  nombre       text not null check (length(trim(nombre)) between 2 and 80),
  descripcion  text check (descripcion is null or length(descripcion) <= 300),
  activa       boolean not null default true,
  creado_por   uuid,
  creado_en    timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  unique (gimnasio_id, id),
  foreign key (gimnasio_id, creado_por) references public.equipo (gimnasio_id, id)
);
select privado.politicas_estandar('public.rutinas', array['dueno', 'encargado', 'profe'], null, false);
revoke all on table public.rutinas from anon;
revoke truncate, references, trigger on public.rutinas from authenticated;

create table if not exists public.rutina_ejercicios (
  id            uuid primary key default gen_random_uuid(),
  gimnasio_id   uuid not null references public.gimnasios(id),
  rutina_id     uuid not null,
  dia           int not null check (dia between 1 and 7),
  orden         int not null check (orden between 1 and 40),
  ejercicio_id  uuid not null,
  series        int not null check (series between 1 and 20),
  repeticiones  text not null check (length(trim(repeticiones)) between 1 and 20),
  nota          text check (nota is null or length(nota) <= 120),
  unique (gimnasio_id, id),
  unique (gimnasio_id, rutina_id, dia, orden),
  foreign key (gimnasio_id, rutina_id) references public.rutinas (gimnasio_id, id) on delete cascade,
  foreign key (gimnasio_id, ejercicio_id) references public.ejercicios (gimnasio_id, id)
);
select privado.politicas_estandar('public.rutina_ejercicios', array['dueno', 'encargado', 'profe'], null, false);
revoke all on table public.rutina_ejercicios from anon;
revoke truncate, references, trigger on public.rutina_ejercicios from authenticated;

create or replace function public.ejercicios_gimnasio(p_gimnasio_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado', 'profe']);
  return coalesce((select jsonb_agg(jsonb_build_object('id', e.id, 'nombre', e.nombre, 'grupo', e.grupo, 'video_url', e.video_url, 'activo', e.activo)
                     order by e.activo desc, e.grupo, e.nombre)
                     from public.ejercicios e where e.gimnasio_id = p_gimnasio_id), '[]'::jsonb);
end $$;

create or replace function public.guardar_ejercicio(p_gimnasio_id uuid, p_id uuid, p_nombre text, p_grupo text, p_video text default null, p_activo boolean default true)
returns uuid language plpgsql security definer set search_path = '' as $$
declare nom text := trim(coalesce(p_nombre, '')); vid text := nullif(trim(coalesce(p_video, '')), ''); eid uuid; n int;
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado', 'profe']);
  if length(nom) < 2 then raise exception 'Escribí el nombre del ejercicio' using errcode = '22023'; end if;
  if coalesce(p_grupo, '') not in ('piernas', 'gluteos', 'espalda', 'pecho', 'hombros', 'brazos', 'core', 'cardio', 'completo', 'otro') then
    raise exception 'Elegí el grupo muscular' using errcode = '22023';
  end if;
  if vid is not null and (vid !~ '^https://\S+$' or length(vid) > 300) then raise exception 'El video: un link que empiece con https://' using errcode = '22023'; end if;
  if coalesce(p_activo, true) and exists (select 1 from public.ejercicios e where e.gimnasio_id = p_gimnasio_id and e.activo and lower(e.nombre) = lower(nom) and e.id is distinct from p_id) then
    raise exception 'Ya hay un ejercicio que se llama %', nom using errcode = '23505';
  end if;
  if p_id is null then
    insert into public.ejercicios (gimnasio_id, nombre, grupo, video_url, activo) values (p_gimnasio_id, nom, p_grupo, vid, coalesce(p_activo, true)) returning id into eid;
    return eid;
  end if;
  update public.ejercicios set nombre = nom, grupo = p_grupo, video_url = vid, activo = coalesce(p_activo, true) where id = p_id and gimnasio_id = p_gimnasio_id;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'Ese ejercicio no es de este gimnasio' using errcode = '42501'; end if;
  return p_id;
end $$;

create or replace function public.rutinas_gimnasio(p_gimnasio_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado', 'profe']);
  return coalesce((select jsonb_agg(jsonb_build_object('id', r.id, 'nombre', r.nombre, 'descripcion', r.descripcion,
            'dias', (select count(distinct x.dia) from public.rutina_ejercicios x where x.rutina_id = r.id),
            'ejercicios', (select count(*) from public.rutina_ejercicios x where x.rutina_id = r.id)) order by r.nombre)
    from public.rutinas r where r.gimnasio_id = p_gimnasio_id and r.activa), '[]'::jsonb);
end $$;

create or replace function public.rutina_detalle(p_rutina_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare r public.rutinas;
begin
  select * into r from public.rutinas where id = p_rutina_id;
  if not found then raise exception 'Sin permiso o rutina inexistente' using errcode = '42501'; end if;
  perform privado.exigir_equipo(r.gimnasio_id, array['dueno', 'encargado', 'profe']);
  return jsonb_build_object('id', r.id, 'nombre', r.nombre, 'descripcion', r.descripcion, 'activa', r.activa,
    'items', coalesce((select jsonb_agg(jsonb_build_object('dia', x.dia, 'orden', x.orden, 'ejercicio_id', x.ejercicio_id, 'ejercicio', e.nombre,
              'grupo', e.grupo, 'video_url', e.video_url, 'series', x.series, 'repeticiones', x.repeticiones, 'nota', x.nota) order by x.dia, x.orden)
       from public.rutina_ejercicios x join public.ejercicios e on e.id = x.ejercicio_id where x.rutina_id = r.id), '[]'::jsonb));
end $$;

-- items: [{ dia, ejercicio_id, series, repeticiones, nota }] en orden; reemplaza los de la rutina.
create or replace function public.guardar_rutina(p_gimnasio_id uuid, p_id uuid, p_nombre text, p_descripcion text, p_items jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare eid uuid; rid uuid := p_id; nom text := trim(coalesce(p_nombre, '')); v_desc text := nullif(trim(coalesce(p_descripcion, '')), '');
        it jsonb; ord int; dia_ant int := 0; n int;
begin
  eid := (privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado', 'profe'])).id;
  if length(nom) < 2 then raise exception 'Escribí el nombre de la rutina' using errcode = '22023'; end if;
  if length(v_desc) > 300 then raise exception 'La descripción: hasta 300 letras' using errcode = '22023'; end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'Sumá al menos un ejercicio' using errcode = '22023'; end if;
  if jsonb_array_length(p_items) > 80 then raise exception 'Hasta 80 ejercicios por rutina' using errcode = '22023'; end if;
  if rid is null then
    insert into public.rutinas (gimnasio_id, nombre, descripcion, creado_por) values (p_gimnasio_id, nom, v_desc, eid) returning id into rid;
  else
    update public.rutinas set nombre = nom, descripcion = v_desc, actualizado_en = now() where id = rid and gimnasio_id = p_gimnasio_id and activa;
    get diagnostics n = row_count;
    if n <> 1 then raise exception 'Esa rutina no es de este gimnasio' using errcode = '42501'; end if;
    delete from public.rutina_ejercicios where rutina_id = rid;
  end if;
  for it in select x from jsonb_array_elements(p_items) x loop
    if coalesce((it ->> 'dia')::int, 0) not between 1 and 7 then raise exception 'Los días van del 1 al 7' using errcode = '22023'; end if;
    if (it ->> 'dia')::int <> dia_ant then ord := 0; dia_ant := (it ->> 'dia')::int; end if;
    ord := ord + 1;
    if ord > 40 then raise exception 'Hasta 40 ejercicios por día' using errcode = '22023'; end if;
    if not exists (select 1 from public.ejercicios e where e.id = (it ->> 'ejercicio_id')::uuid and e.gimnasio_id = p_gimnasio_id) then
      raise exception 'Ese ejercicio no es de este gimnasio' using errcode = '22023';
    end if;
    if coalesce((it ->> 'series')::int, 0) not between 1 and 20 then raise exception 'Las series van de 1 a 20' using errcode = '22023'; end if;
    if length(trim(coalesce(it ->> 'repeticiones', ''))) not between 1 and 20 then raise exception 'Repeticiones: por ejemplo 12, 8-10 o 30 s' using errcode = '22023'; end if;
    if length(it ->> 'nota') > 120 then raise exception 'La nota: hasta 120 letras' using errcode = '22023'; end if;
    insert into public.rutina_ejercicios (gimnasio_id, rutina_id, dia, orden, ejercicio_id, series, repeticiones, nota)
    values (p_gimnasio_id, rid, (it ->> 'dia')::int, ord, (it ->> 'ejercicio_id')::uuid, (it ->> 'series')::int, trim(it ->> 'repeticiones'), nullif(trim(coalesce(it ->> 'nota', '')), ''));
  end loop;
  return rid;
end $$;

create or replace function public.archivar_rutina(p_rutina_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare g uuid; n int;
begin
  select gimnasio_id into g from public.rutinas where id = p_rutina_id;
  if g is null then raise exception 'Sin permiso o rutina inexistente' using errcode = '42501'; end if;
  perform privado.exigir_equipo(g, array['dueno', 'encargado', 'profe']);
  update public.rutinas set activa = false, actualizado_en = now() where id = p_rutina_id and activa;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'Esa rutina ya estaba archivada' using errcode = '22023'; end if;
end $$;

revoke all on function public.ejercicios_gimnasio(uuid), public.guardar_ejercicio(uuid, uuid, text, text, text, boolean), public.rutinas_gimnasio(uuid),
  public.rutina_detalle(uuid), public.guardar_rutina(uuid, uuid, text, text, jsonb), public.archivar_rutina(uuid) from public, anon, authenticated;
grant execute on function public.ejercicios_gimnasio(uuid), public.guardar_ejercicio(uuid, uuid, text, text, text, boolean), public.rutinas_gimnasio(uuid),
  public.rutina_detalle(uuid), public.guardar_rutina(uuid, uuid, text, text, jsonb), public.archivar_rutina(uuid) to authenticated, service_role;

-- ── Verificación ────────────────────────────────────────────────────
do $$
declare f text; tb text;
begin
  foreach tb in array array['public.ejercicios', 'public.rutinas', 'public.rutina_ejercicios'] loop
    if not (select relrowsecurity from pg_class where oid = tb::regclass) then raise exception 'Verificación: % sin RLS', tb; end if;
  end loop;
  foreach f in array array['public.ejercicios_gimnasio(uuid)', 'public.guardar_ejercicio(uuid, uuid, text, text, text, boolean)', 'public.rutinas_gimnasio(uuid)',
                           'public.rutina_detalle(uuid)', 'public.guardar_rutina(uuid, uuid, text, text, jsonb)', 'public.archivar_rutina(uuid)'] loop
    if not exists (select 1 from pg_proc where oid = f::regprocedure and 'search_path=""' = any (proconfig)) then raise exception 'Verificación: % sin search_path vacío', f; end if;
    if has_function_privilege('anon', f, 'execute') then raise exception 'Verificación: anon puede ejecutar %', f; end if;
  end loop;
end $$;
