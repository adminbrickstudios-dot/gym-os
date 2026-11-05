-- 0039 · Foto del socio (SOC-7). Se saca con la cámara (compu o celular) en
-- la ficha; queda en el bucket privado "fotos_socios" y se ve en la ficha y
-- en la Entrada. Nadie la ve sin sesión: el panel la sirve después de que la
-- base dice que quien la pide es del equipo (foto_socio). Sube el servidor con
-- la clave de servicio, como el logo: la base arma la ruta y la confirma.
-- La foto es para reconocerlo en la puerta: nunca datos de salud.

-- ── Guarda de entrada ───────────────────────────────────────────────
do $$
begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'socios' and column_name = 'foto_path') then
    raise exception 'Guarda: falta socios.foto_path';
  end if;
end $$;

-- La ruta de la foto nueva (no se adivina): <gimnasio>/<socio>/foto-<32 hex>.jpg
create or replace function public.preparar_foto_socio(p_socio_id uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare g uuid;
begin
  select s.gimnasio_id into g from public.socios s where s.id = p_socio_id;
  if g is null then raise exception 'Sin permiso o socio inexistente' using errcode = '42501'; end if;
  perform privado.exigir_equipo(g, array['dueno', 'encargado', 'recepcion']);
  return g::text || '/' || p_socio_id::text || '/foto-' || replace(gen_random_uuid()::text, '-', '') || '.jpg';
end $$;

-- Confirma la foto subida; devuelve la anterior (para que el servidor la borre).
create or replace function public.confirmar_foto_socio(p_socio_id uuid, p_ruta text) returns text
language plpgsql security definer set search_path = '' as $$
declare g uuid; anterior text; n int;
begin
  select s.gimnasio_id, s.foto_path into g, anterior from public.socios s where s.id = p_socio_id for update;
  if g is null then raise exception 'Sin permiso o socio inexistente' using errcode = '42501'; end if;
  perform privado.exigir_equipo(g, array['dueno', 'encargado', 'recepcion']);
  if p_ruta is not null and p_ruta !~ ('^' || g::text || '/' || p_socio_id::text || '/foto-[0-9a-f]{32}\.jpg$') then
    raise exception 'Ruta de foto inválida';
  end if;
  update public.socios set foto_path = p_ruta where id = p_socio_id;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'No se pudo guardar la foto'; end if;
  return anterior;
end $$;

-- Para mostrarla: la ruta, solo al equipo del gimnasio (incluido el profe: la ve en sus clases).
create or replace function public.foto_socio(p_socio_id uuid) returns text
language plpgsql stable security definer set search_path = '' as $$
declare g uuid; ruta text;
begin
  select s.gimnasio_id, s.foto_path into g, ruta from public.socios s where s.id = p_socio_id;
  if g is null then raise exception 'Sin permiso o socio inexistente' using errcode = '42501'; end if;
  perform privado.exigir_equipo(g, array['dueno', 'encargado', 'recepcion', 'profe']);
  return ruta;
end $$;

revoke all on function public.preparar_foto_socio(uuid), public.confirmar_foto_socio(uuid, text), public.foto_socio(uuid) from public, anon, authenticated;
grant execute on function public.preparar_foto_socio(uuid), public.confirmar_foto_socio(uuid, text), public.foto_socio(uuid) to authenticated, service_role;

-- Bucket privado (en Supabase; la base local no tiene storage).
do $$
begin
  if to_regclass('storage.buckets') is null then
    raise notice 'Sin esquema storage (base local): se saltea el bucket fotos_socios';
    return;
  end if;
  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('fotos_socios', 'fotos_socios', false, 524288, array['image/jpeg'])
  on conflict (id) do nothing;
end $$;

do $$
declare r record; publico boolean;
begin
  for r in select p.oid, p.proname, p.proconfig from pg_proc p where p.pronamespace = 'public'::regnamespace
            and p.proname in ('preparar_foto_socio', 'confirmar_foto_socio', 'foto_socio') loop
    if r.proconfig is null or not ('search_path=""' = any (r.proconfig)) then raise exception 'Verificación: % sin search_path vacío', r.proname; end if;
    if has_function_privilege('anon', r.oid, 'execute') then raise exception 'Verificación: anon puede ejecutar %', r.proname; end if;
  end loop;
  if to_regclass('storage.buckets') is not null then
    execute 'select exists (select 1 from storage.buckets where id = ''fotos_socios'' and public)' into publico;
    if publico then raise exception 'Verificación: el bucket de fotos de socios quedó público'; end if;
  end if;
end $$;
