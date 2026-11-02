-- ═══════════════════════════════════════════════════════════════════
-- 0016 · Dar acceso al equipo.
--
-- El dueño agrega a alguien con su mail. El servidor (service_role):
--   · si el mail no tiene cuenta, la crea con una contraseña provisoria
--     (el dueño se la da en persona; la persona la cambia al entrar);
--   · si ya tiene cuenta (un profe que trabaja en dos gimnasios), la
--     vincula a este equipo.
-- usuario_por_mail es solo del servidor: un usuario no puede averiguar
-- si un mail tiene cuenta.
-- ═══════════════════════════════════════════════════════════════════

do $$
begin
  if to_regprocedure('public.vincular_usuario_equipo(uuid,uuid)') is null then raise exception 'Guarda: falta la migración 0013'; end if;
end $$;

create or replace function public.usuario_por_mail(p_email text) returns uuid
language plpgsql stable security definer set search_path = '' as $$
declare u uuid;
begin
  if not privado.es_servicio() then raise exception 'Solo el servidor busca usuarios por mail' using errcode = '42501'; end if;
  select id into u from auth.users where lower(email) = lower(trim(p_email));
  return u;
end $$;

-- Una persona no puede tener dos lugares activos en el mismo gimnasio.
create unique index if not exists equipo_usuario_unico on public.equipo (gimnasio_id, usuario_id) where usuario_id is not null;

revoke all on function public.usuario_por_mail(text) from public, anon, authenticated;
grant execute on function public.usuario_por_mail(text) to service_role;

do $$
begin
  if has_function_privilege('authenticated', 'public.usuario_por_mail(text)', 'execute') then
    raise exception 'Verificación: un usuario puede averiguar si un mail tiene cuenta';
  end if;
end $$;
