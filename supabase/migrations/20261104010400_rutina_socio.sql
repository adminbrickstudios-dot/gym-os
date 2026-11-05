-- 0104 · Asignar una rutina al socio; él la ve y anota sus pesos (RUT-2).
-- Una rutina activa por socio (asignar otra reemplaza la anterior). El socio
-- la ve por día en la app y anota peso (kg) y repeticiones de cada
-- ejercicio: es un hecho (no se edita; se puede anular). Peso levantado sí,
-- nada de salud.
--   asignar_rutina(socio, rutina) · quitar_rutina_socio(socio)   dueño, encargado, profe
--   rutina_de_socio(socio)    la rutina con lo último que anotó en cada ejercicio (equipo o el socio)
--   anotar_ejercicio(socio, ejercicio, peso, repeticiones) · anular_registro(registro)

-- ── Guarda de entrada ───────────────────────────────────────────────
do $$
begin
  if to_regprocedure('public.guardar_rutina(uuid, uuid, text, text, jsonb)') is null then raise exception 'Guarda: falta la migración 0103'; end if;
end $$;

create table if not exists public.rutinas_socio (
  id            uuid primary key default gen_random_uuid(),
  gimnasio_id   uuid not null references public.gimnasios(id),
  socio_id      uuid not null,
  rutina_id     uuid not null,
  asignada_por  uuid,
  asignada_en   timestamptz not null default now(),
  quitada_en    timestamptz,
  unique (gimnasio_id, id),
  foreign key (gimnasio_id, socio_id) references public.socios (gimnasio_id, id),
  foreign key (gimnasio_id, rutina_id) references public.rutinas (gimnasio_id, id),
  foreign key (gimnasio_id, asignada_por) references public.equipo (gimnasio_id, id)
);
create unique index if not exists rutinas_socio_una on public.rutinas_socio (gimnasio_id, socio_id) where quitada_en is null;
select privado.politicas_estandar('public.rutinas_socio', array['dueno', 'encargado', 'profe'], null, true);
revoke all on table public.rutinas_socio from anon;
revoke truncate, references, trigger on public.rutinas_socio from authenticated;

create table if not exists public.registros_ejercicio (
  id            uuid primary key default gen_random_uuid(),
  gimnasio_id   uuid not null references public.gimnasios(id),
  socio_id      uuid not null,
  ejercicio_id  uuid not null,
  momento       timestamptz not null default now(),
  peso          numeric(6,2) check (peso is null or (peso >= 0 and peso <= 1000)),
  repeticiones  int check (repeticiones is null or repeticiones between 1 and 300),
  anotado_por   uuid not null references auth.users(id),
  anulado_en    timestamptz,
  unique (gimnasio_id, id),
  foreign key (gimnasio_id, socio_id) references public.socios (gimnasio_id, id),
  foreign key (gimnasio_id, ejercicio_id) references public.ejercicios (gimnasio_id, id),
  check (peso is not null or repeticiones is not null)
);
create index if not exists registros_socio_ejercicio on public.registros_ejercicio (socio_id, ejercicio_id, momento desc) where anulado_en is null;
select privado.politicas_estandar('public.registros_ejercicio', array['dueno', 'encargado', 'profe'], null, true);
revoke all on table public.registros_ejercicio from anon;
revoke truncate, references, trigger on public.registros_ejercicio from authenticated;
drop trigger if exists registros_inmutable on public.registros_ejercicio;
create trigger registros_inmutable before update or delete on public.registros_ejercicio
  for each row execute function privado.hecho_inmutable('anulado_en');

-- El socio mismo, o alguien del equipo que trabaja con rutinas.
create or replace function privado.exigir_socio_o_rutinas(p_socio_id uuid) returns uuid
language plpgsql stable set search_path = '' as $$
declare g uuid;
begin
  select gimnasio_id into g from public.socios where id = p_socio_id;
  if g is null then raise exception 'Sin permiso o socio inexistente' using errcode = '42501'; end if;
  if p_socio_id not in (select privado.mis_socios()) then perform privado.exigir_equipo(g, array['dueno', 'encargado', 'profe']); end if;
  return g;
end $$;
revoke all on function privado.exigir_socio_o_rutinas(uuid) from public;

create or replace function public.asignar_rutina(p_socio_id uuid, p_rutina_id uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare g uuid; eid uuid; rid uuid;
begin
  select gimnasio_id into g from public.socios where id = p_socio_id and dado_de_baja_en is null;
  if g is null then raise exception 'Sin permiso o socio inexistente' using errcode = '42501'; end if;
  eid := (privado.exigir_equipo(g, array['dueno', 'encargado', 'profe'])).id;
  if not exists (select 1 from public.rutinas r where r.id = p_rutina_id and r.gimnasio_id = g and r.activa) then
    raise exception 'Esa rutina no existe o está archivada' using errcode = '22023';
  end if;
  update public.rutinas_socio set quitada_en = now() where socio_id = p_socio_id and quitada_en is null;
  insert into public.rutinas_socio (gimnasio_id, socio_id, rutina_id, asignada_por) values (g, p_socio_id, p_rutina_id, eid) returning id into rid;
  return rid;
end $$;

create or replace function public.quitar_rutina_socio(p_socio_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare g uuid; n int;
begin
  select gimnasio_id into g from public.socios where id = p_socio_id;
  if g is null then raise exception 'Sin permiso o socio inexistente' using errcode = '42501'; end if;
  perform privado.exigir_equipo(g, array['dueno', 'encargado', 'profe']);
  update public.rutinas_socio set quitada_en = now() where socio_id = p_socio_id and quitada_en is null;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'No tenía rutina' using errcode = '22023'; end if;
end $$;

create or replace function public.rutina_de_socio(p_socio_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare rs public.rutinas_socio; r public.rutinas;
begin
  perform privado.exigir_socio_o_rutinas(p_socio_id);
  select * into rs from public.rutinas_socio where socio_id = p_socio_id and quitada_en is null;
  if not found then return null; end if;
  select * into r from public.rutinas where id = rs.rutina_id;
  return jsonb_build_object('rutina_id', r.id, 'nombre', r.nombre, 'descripcion', r.descripcion, 'asignada_en', rs.asignada_en,
    'items', coalesce((select jsonb_agg(jsonb_build_object('dia', x.dia, 'orden', x.orden, 'ejercicio_id', x.ejercicio_id, 'ejercicio', e.nombre,
              'video_url', e.video_url, 'series', x.series, 'repeticiones', x.repeticiones, 'nota', x.nota,
              'ultimo', (select jsonb_build_object('peso', g.peso, 'repeticiones', g.repeticiones, 'momento', g.momento)
                           from public.registros_ejercicio g where g.socio_id = p_socio_id and g.ejercicio_id = x.ejercicio_id and g.anulado_en is null
                          order by g.momento desc limit 1)) order by x.dia, x.orden)
       from public.rutina_ejercicios x join public.ejercicios e on e.id = x.ejercicio_id where x.rutina_id = r.id), '[]'::jsonb));
end $$;

create or replace function public.anotar_ejercicio(p_socio_id uuid, p_ejercicio_id uuid, p_peso numeric, p_repeticiones int) returns uuid
language plpgsql security definer set search_path = '' as $$
declare g uuid; rid uuid;
begin
  g := privado.exigir_socio_o_rutinas(p_socio_id);
  if not exists (select 1 from public.ejercicios e where e.id = p_ejercicio_id and e.gimnasio_id = g) then raise exception 'Ese ejercicio no es de este gimnasio' using errcode = '22023'; end if;
  if p_peso is null and p_repeticiones is null then raise exception 'Anotá el peso o las repeticiones' using errcode = '22023'; end if;
  if p_peso is not null and (p_peso < 0 or p_peso > 1000) then raise exception 'El peso va de 0 a 1000 kg' using errcode = '22023'; end if;
  if p_repeticiones is not null and p_repeticiones not between 1 and 300 then raise exception 'Las repeticiones van de 1 a 300' using errcode = '22023'; end if;
  insert into public.registros_ejercicio (gimnasio_id, socio_id, ejercicio_id, peso, repeticiones, anotado_por)
  values (g, p_socio_id, p_ejercicio_id, round(p_peso, 2), p_repeticiones, auth.uid()) returning id into rid;
  return rid;
end $$;

create or replace function public.anular_registro(p_registro_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare s uuid; n int;
begin
  select socio_id into s from public.registros_ejercicio where id = p_registro_id;
  if s is null then raise exception 'Sin permiso o registro inexistente' using errcode = '42501'; end if;
  perform privado.exigir_socio_o_rutinas(s);
  update public.registros_ejercicio set anulado_en = now() where id = p_registro_id and anulado_en is null;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'Ese registro ya estaba anulado' using errcode = '22023'; end if;
end $$;

revoke all on function public.asignar_rutina(uuid, uuid), public.quitar_rutina_socio(uuid), public.rutina_de_socio(uuid),
  public.anotar_ejercicio(uuid, uuid, numeric, int), public.anular_registro(uuid) from public, anon, authenticated;
grant execute on function public.asignar_rutina(uuid, uuid), public.quitar_rutina_socio(uuid), public.rutina_de_socio(uuid),
  public.anotar_ejercicio(uuid, uuid, numeric, int), public.anular_registro(uuid) to authenticated, service_role;

-- ── Verificación ────────────────────────────────────────────────────
do $$
declare f text; tb text;
begin
  foreach tb in array array['public.rutinas_socio', 'public.registros_ejercicio'] loop
    if not (select relrowsecurity from pg_class where oid = tb::regclass) then raise exception 'Verificación: % sin RLS', tb; end if;
  end loop;
  foreach f in array array['public.asignar_rutina(uuid, uuid)', 'public.quitar_rutina_socio(uuid)', 'public.rutina_de_socio(uuid)',
                           'public.anotar_ejercicio(uuid, uuid, numeric, integer)', 'public.anular_registro(uuid)'] loop
    if not exists (select 1 from pg_proc where oid = f::regprocedure and 'search_path=""' = any (proconfig)) then raise exception 'Verificación: % sin search_path vacío', f; end if;
    if has_function_privilege('anon', f, 'execute') then raise exception 'Verificación: anon puede ejecutar %', f; end if;
  end loop;
end $$;
