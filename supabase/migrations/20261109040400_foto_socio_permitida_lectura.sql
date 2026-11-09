-- FA-16 (carril D) · Leer si el gimnasio deja que el socio suba su foto (el interruptor de Configuración).
-- guardar_foto_socio_permitida ya existe (20261109030400); faltaba cómo leer el valor actual. Solo dueño y encargado.
-- Aditiva e idempotente.

do $g$ begin
  if to_regprocedure('public.guardar_foto_socio_permitida(uuid, boolean)') is null then raise exception 'FA-16: falta guardar_foto_socio_permitida'; end if;
end $g$;

create or replace function public.foto_socio_permitida_gimnasio(p_gimnasio_id uuid) returns boolean
language plpgsql stable security definer set search_path = '' as $$
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado']);
  return coalesce((select c.foto_socio_permitida from public.configuracion_gimnasio c where c.gimnasio_id = p_gimnasio_id), false);
end $$;
revoke all on function public.foto_socio_permitida_gimnasio(uuid) from public, anon, authenticated;
grant execute on function public.foto_socio_permitida_gimnasio(uuid) to authenticated, service_role;

do $v$ begin
  if has_function_privilege('anon', 'public.foto_socio_permitida_gimnasio(uuid)', 'execute') then raise exception 'FA-16: la lectura no es para anónimos'; end if;
end $v$;
