-- ═══════════════════════════════════════════════════════════════════
-- FA-16 (D57) · El socio sube su foto desde la app, solo si el gimnasio lo permite (por defecto, apagado).
-- La recepción la ve marcada "foto nueva, subida por el socio" hasta que la confirma o la reemplaza.
--   configuracion_gimnasio.foto_socio_permitida   (apagado por defecto)
--   socios.foto_sin_confirmar_desde               (null = nadie la subió, o ya la confirmó/reemplazó el equipo)
-- La foto es para reconocerlo en la puerta: nunca datos de salud. Va al mismo bucket privado "fotos_socios".
--   foto_propia_permitida(socio) · preparar_foto_propia(socio) · confirmar_foto_propia(socio, ruta) · foto_propia(socio)
--   confirmar_foto_subida(socio) [equipo] · foto_estado_socio(socio) [equipo] · guardar_foto_socio_permitida(gimnasio, si) [dueño]
-- ═══════════════════════════════════════════════════════════════════

do $$
begin
  if to_regprocedure('public.preparar_foto_socio(uuid)') is null then raise exception 'Guarda: falta SOC-7 (foto del socio)'; end if;
  if to_regprocedure('privado.mis_socios()') is null then raise exception 'Guarda: falta privado.mis_socios'; end if;
  if to_regprocedure('privado.exigir_equipo(uuid, text[])') is null then raise exception 'Guarda: falta privado.exigir_equipo'; end if;
end $$;

alter table public.configuracion_gimnasio add column if not exists foto_socio_permitida boolean not null default false;
alter table public.socios add column if not exists foto_sin_confirmar_desde timestamptz;

-- Si la foto la cambia otro (la recepción), deja de estar "sin confirmar".
create or replace function privado.foto_socio_tg() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.foto_path is distinct from old.foto_path and new.foto_sin_confirmar_desde is not distinct from old.foto_sin_confirmar_desde then
    new.foto_sin_confirmar_desde := null;
  end if;
  return new;
end $$;
revoke all on function privado.foto_socio_tg() from public, anon, authenticated;
drop trigger if exists foto_socio_confirmada on public.socios;
create trigger foto_socio_confirmada before update of foto_path on public.socios for each row execute function privado.foto_socio_tg();

-- ── Del socio ───────────────────────────────────────────────────────
create or replace function public.foto_propia_permitida(p_socio_id uuid) returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare ok boolean;
begin
  if not exists (select 1 from public.socios s where s.id = p_socio_id and s.id in (select privado.mis_socios())) then
    raise exception 'Sin permiso o socio inexistente' using errcode = '42501';
  end if;
  select c.foto_socio_permitida into ok from public.socios s join public.configuracion_gimnasio c on c.gimnasio_id = s.gimnasio_id where s.id = p_socio_id;
  return coalesce(ok, false);
end $$;

create or replace function public.preparar_foto_propia(p_socio_id uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare g uuid;
begin
  if not public.foto_propia_permitida(p_socio_id) then raise exception 'Tu gimnasio no permite subir la foto desde la app. Pedísela a la recepción.' using errcode = '42501'; end if;
  select s.gimnasio_id into g from public.socios s where s.id = p_socio_id;
  return g::text || '/' || p_socio_id::text || '/foto-' || replace(gen_random_uuid()::text, '-', '') || '.jpg';
end $$;

create or replace function public.confirmar_foto_propia(p_socio_id uuid, p_ruta text) returns text
language plpgsql security definer set search_path = '' as $$
declare g uuid; anterior text; n int;
begin
  if not public.foto_propia_permitida(p_socio_id) then raise exception 'Tu gimnasio no permite subir la foto desde la app. Pedísela a la recepción.' using errcode = '42501'; end if;
  select s.gimnasio_id, s.foto_path into g, anterior from public.socios s where s.id = p_socio_id for update;
  if p_ruta is null or p_ruta !~ ('^' || g::text || '/' || p_socio_id::text || '/foto-[0-9a-f]{32}\.jpg$') then raise exception 'Ruta de foto inválida'; end if;
  update public.socios set foto_path = p_ruta, foto_sin_confirmar_desde = now() where id = p_socio_id;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'No se pudo guardar la foto'; end if;
  return anterior;
end $$;

-- Para mostrársela a él mismo (la ruta, nunca la foto de otro).
create or replace function public.foto_propia(p_socio_id uuid) returns text
language plpgsql stable security definer set search_path = '' as $$
declare ruta text;
begin
  select s.foto_path into ruta from public.socios s where s.id = p_socio_id and s.id in (select privado.mis_socios());
  if not found then raise exception 'Sin permiso o socio inexistente' using errcode = '42501'; end if;
  return ruta;
end $$;

-- ── Del equipo ──────────────────────────────────────────────────────
create or replace function public.foto_estado_socio(p_socio_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare g uuid; desde timestamptz; ruta text;
begin
  select s.gimnasio_id, s.foto_sin_confirmar_desde, s.foto_path into g, desde, ruta from public.socios s where s.id = p_socio_id;
  if g is null then raise exception 'Sin permiso o socio inexistente' using errcode = '42501'; end if;
  perform privado.exigir_equipo(g, array['dueno', 'encargado', 'recepcion', 'profe']);
  return jsonb_build_object('tiene_foto', ruta is not null, 'subida_por_el_socio', desde is not null, 'desde', desde);
end $$;

create or replace function public.confirmar_foto_subida(p_socio_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare g uuid; n int;
begin
  select s.gimnasio_id into g from public.socios s where s.id = p_socio_id;
  if g is null then raise exception 'Sin permiso o socio inexistente' using errcode = '42501'; end if;
  perform privado.exigir_equipo(g, array['dueno', 'encargado', 'recepcion']);
  update public.socios set foto_sin_confirmar_desde = null where id = p_socio_id and foto_sin_confirmar_desde is not null;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'Esa foto ya estaba confirmada' using errcode = '22023'; end if;
end $$;

create or replace function public.guardar_foto_socio_permitida(p_gimnasio_id uuid, p_si boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno']);
  update public.configuracion_gimnasio set foto_socio_permitida = coalesce(p_si, false) where gimnasio_id = p_gimnasio_id;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'No se pudo guardar la configuración'; end if;
end $$;

revoke all on function public.foto_propia_permitida(uuid), public.preparar_foto_propia(uuid), public.confirmar_foto_propia(uuid, text), public.foto_propia(uuid),
  public.foto_estado_socio(uuid), public.confirmar_foto_subida(uuid), public.guardar_foto_socio_permitida(uuid, boolean) from public, anon, authenticated;
grant execute on function public.foto_propia_permitida(uuid), public.preparar_foto_propia(uuid), public.confirmar_foto_propia(uuid, text), public.foto_propia(uuid),
  public.foto_estado_socio(uuid), public.confirmar_foto_subida(uuid), public.guardar_foto_socio_permitida(uuid, boolean) to authenticated, service_role;

do $$
declare f text;
begin
  if (select column_default from information_schema.columns where table_schema = 'public' and table_name = 'configuracion_gimnasio' and column_name = 'foto_socio_permitida') <> 'false' then
    raise exception 'Verificación: la foto del socio no quedó apagada por defecto';
  end if;
  foreach f in array array['public.foto_propia_permitida(uuid)', 'public.preparar_foto_propia(uuid)', 'public.confirmar_foto_propia(uuid, text)', 'public.foto_propia(uuid)',
                           'public.foto_estado_socio(uuid)', 'public.confirmar_foto_subida(uuid)', 'public.guardar_foto_socio_permitida(uuid, boolean)', 'privado.foto_socio_tg()'] loop
    if not exists (select 1 from pg_proc where oid = f::regprocedure and 'search_path=""' = any (proconfig)) then raise exception 'Verificación: % sin search_path vacío', f; end if;
    if f not like 'privado.%' and has_function_privilege('anon', f, 'execute') then raise exception 'Verificación: anon puede ejecutar %', f; end if;
  end loop;
end $$;
