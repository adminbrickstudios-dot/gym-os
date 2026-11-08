-- BASE-8 · Tope de intentos fallidos de ingreso con contraseña: 8 por mail y 20 por conexión cada 15 minutos.
-- Pasado el tope, el servidor ni siquiera prueba la contraseña (así adivinar es inútil). Solo lo llama el servidor (service_role).
-- Aditiva e idempotente. RLS activa, sin políticas: nadie la lee ni la escribe desde el navegador.

do $g$ begin
  if to_regprocedure('privado.es_servicio()') is null then raise exception 'BASE-8: falta privado.es_servicio'; end if;
  if to_regnamespace('extensions') is null then raise exception 'BASE-8: falta el esquema extensions (digest)'; end if;
end $g$;

create table if not exists public.intentos_ingreso_fallidos (
  id            uuid primary key default gen_random_uuid(),
  destino_hash  text not null check (length(destino_hash) = 64),
  ip            text check (ip is null or length(ip) <= 64),
  creado_en     timestamptz not null default now()
);
create index if not exists intentos_ingreso_destino on public.intentos_ingreso_fallidos (destino_hash, creado_en);
create index if not exists intentos_ingreso_ip on public.intentos_ingreso_fallidos (ip, creado_en);
alter table public.intentos_ingreso_fallidos enable row level security;
revoke all on table public.intentos_ingreso_fallidos from anon, authenticated;

create or replace function public.ingreso_permitido(p_destino text, p_ip text) returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare h text; v_ip text := nullif(left(trim(coalesce(p_ip, '')), 64), '');
begin
  if not privado.es_servicio() then raise exception 'Solo el servidor' using errcode = '42501'; end if;
  h := encode(extensions.digest(lower(trim(coalesce(p_destino, ''))), 'sha256'), 'hex');
  if (select count(*) from public.intentos_ingreso_fallidos where destino_hash = h and creado_en > now() - interval '15 minutes') >= 8 then return false; end if;
  if v_ip is not null and (select count(*) from public.intentos_ingreso_fallidos where ip = v_ip and creado_en > now() - interval '15 minutes') >= 20 then return false; end if;
  return true;
end $$;

create or replace function public.registrar_ingreso_fallido(p_destino text, p_ip text) returns void
language plpgsql security definer set search_path = '' as $$
declare h text; v_ip text := nullif(left(trim(coalesce(p_ip, '')), 64), '');
begin
  if not privado.es_servicio() then raise exception 'Solo el servidor' using errcode = '42501'; end if;
  h := encode(extensions.digest(lower(trim(coalesce(p_destino, ''))), 'sha256'), 'hex');
  delete from public.intentos_ingreso_fallidos where creado_en < now() - interval '24 hours';
  insert into public.intentos_ingreso_fallidos (destino_hash, ip) values (h, v_ip);
end $$;

revoke all on function public.ingreso_permitido(text, text), public.registrar_ingreso_fallido(text, text) from public, anon, authenticated;
grant execute on function public.ingreso_permitido(text, text), public.registrar_ingreso_fallido(text, text) to service_role;

do $v$ begin
  if has_function_privilege('anon', 'public.ingreso_permitido(text, text)', 'execute') or has_function_privilege('authenticated', 'public.registrar_ingreso_fallido(text, text)', 'execute') then
    raise exception 'BASE-8: el límite de ingresos quedó ejecutable desde el navegador';
  end if;
  if not (select relrowsecurity from pg_class where oid = 'public.intentos_ingreso_fallidos'::regclass) then raise exception 'BASE-8: falta RLS'; end if;
end $v$;
