-- FA-23 (carril D) · Leer el plazo para aceptar un lugar de la lista de espera (el interruptor de Configuración → Clases).
-- guardar_espera_plazo ya existe (20261109030700); faltaba leer el valor actual. null = sin plazo (el lugar sube solo, como siempre).
-- Dueño y encargado. Aditiva e idempotente.

do $g$ begin
  if to_regprocedure('public.guardar_espera_plazo(uuid, integer)') is null then raise exception 'FA-23: falta guardar_espera_plazo'; end if;
end $g$;

create or replace function public.espera_plazo_gimnasio(p_gimnasio_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado']);
  return jsonb_build_object('minutos', (select c.espera_plazo_min from public.configuracion_gimnasio c where c.gimnasio_id = p_gimnasio_id));
end $$;
revoke all on function public.espera_plazo_gimnasio(uuid) from public, anon, authenticated;
grant execute on function public.espera_plazo_gimnasio(uuid) to authenticated, service_role;

do $v$ begin
  if has_function_privilege('anon', 'public.espera_plazo_gimnasio(uuid)', 'execute') then raise exception 'FA-23: la lectura no es para anónimos'; end if;
end $v$;
