-- BASE-7 (carril D) · Los 9 pasos del asistente, TODOS medidos como hechos (nunca se guarda "paso hecho").
-- Los pasos 6 (cómo entra la gente) y 7 (clases y profes) no se medían: iban como "para revisar". Ahora salen de los hechos:
--   6 · entró en juego algo de la entrada: el dueño cambió una regla de entrada (queda en el historial de configuración)
--       o hay una tablet autorizada (no revocada).
--   7 · si el gimnasio no da clases (modo_clases = 'ninguno') el paso no aplica y cuenta como hecho; si da clases, hay al menos un
--       horario de clase vigente y un profe activo en el equipo.
-- No toca privado.primeros_pasos (lo usa el widget de Inicio, que no cambia): es una función aparte para el asistente.
-- Aditiva e idempotente.

do $g$ begin
  if to_regprocedure('privado.primeros_pasos(uuid)') is null then raise exception 'BASE-7: falta privado.primeros_pasos'; end if;
  if to_regclass('public.historial_configuracion') is null then raise exception 'BASE-7: falta historial_configuracion'; end if;
  if to_regclass('public.dispositivos') is null or to_regclass('public.horarios_clase') is null then raise exception 'BASE-7: faltan dispositivos u horarios_clase'; end if;
end $g$;

create or replace function public.pasos_asistente(p_gimnasio_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  base jsonb; c public.configuracion_gimnasio; entrada_hecha boolean; con_clases boolean; clases_hechas boolean;
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno']);
  base := privado.primeros_pasos(p_gimnasio_id);
  select * into c from public.configuracion_gimnasio where gimnasio_id = p_gimnasio_id;
  entrada_hecha := exists (select 1 from public.historial_configuracion h
                            where h.gimnasio_id = p_gimnasio_id
                              and h.campo in ('accesos_activos', 'tolerancia_dias', 'dias_aviso', 'tope_dejar_pasar', 'reingreso_mismo_dia_consume', 'falta_politica'))
                or exists (select 1 from public.dispositivos d where d.gimnasio_id = p_gimnasio_id and d.revocado_en is null);
  con_clases := c.modo_clases <> 'ninguno';
  clases_hechas := not con_clases or (
    exists (select 1 from public.horarios_clase hc where hc.gimnasio_id = p_gimnasio_id and (hc.vigente_hasta is null or hc.vigente_hasta >= current_date))
    and exists (select 1 from public.equipo e where e.gimnasio_id = p_gimnasio_id and e.activo and e.rol = 'profe'));
  return jsonb_build_array(
    jsonb_build_object('n', 1, 'clave', 'gimnasio', 'hecho', (select (x ->> 'hecho')::boolean from jsonb_array_elements(base) x where x ->> 'clave' = 'gimnasio'), 'no_aplica', false),
    jsonb_build_object('n', 2, 'clave', 'marca',    'hecho', (select (x ->> 'hecho')::boolean from jsonb_array_elements(base) x where x ->> 'clave' = 'marca'), 'no_aplica', false),
    jsonb_build_object('n', 3, 'clave', 'horarios', 'hecho', (select (x ->> 'hecho')::boolean from jsonb_array_elements(base) x where x ->> 'clave' = 'horarios'), 'no_aplica', false),
    jsonb_build_object('n', 4, 'clave', 'planes',   'hecho', (select (x ->> 'hecho')::boolean from jsonb_array_elements(base) x where x ->> 'clave' = 'planes'), 'no_aplica', false),
    jsonb_build_object('n', 5, 'clave', 'cobros',   'hecho', (select (x ->> 'hecho')::boolean from jsonb_array_elements(base) x where x ->> 'clave' = 'cobros'), 'no_aplica', false),
    jsonb_build_object('n', 6, 'clave', 'entrada_modos', 'hecho', entrada_hecha, 'no_aplica', false),
    jsonb_build_object('n', 7, 'clave', 'clases_profes', 'hecho', clases_hechas, 'no_aplica', not con_clases),
    jsonb_build_object('n', 8, 'clave', 'equipo',   'hecho', (select (x ->> 'hecho')::boolean from jsonb_array_elements(base) x where x ->> 'clave' = 'equipo'), 'no_aplica', false),
    jsonb_build_object('n', 9, 'clave', 'socios',   'hecho', (select (x ->> 'hecho')::boolean from jsonb_array_elements(base) x where x ->> 'clave' = 'socios'), 'no_aplica', false));
end $$;

revoke all on function public.pasos_asistente(uuid) from public, anon, authenticated;
grant execute on function public.pasos_asistente(uuid) to authenticated, service_role;

do $v$ begin
  if has_function_privilege('anon', 'public.pasos_asistente(uuid)', 'execute') then raise exception 'BASE-7: pasos_asistente no es para anónimos'; end if;
end $v$;
