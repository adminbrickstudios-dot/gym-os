-- 0082 · Deshacer un presente marcado por error (CLA-7).
-- anular_asistencia (0011) ya existía con sus reglas (el profe y la recepción
-- dentro del día, solo el profe en sus clases; dueño y encargado siempre) y
-- devuelve la clase del pack si la había gastado. Faltaba cómo llamarla desde
-- la lista, que conoce la clase y el socio (no el id del presente).
--   anular_presente(clase, socio, motivo)

-- ── Guarda de entrada ───────────────────────────────────────────────
do $$
begin
  if to_regprocedure('public.anular_asistencia(uuid, text)') is null then raise exception 'Guarda: falta public.anular_asistencia (0011)'; end if;
  if to_regprocedure('public.abonar_turno(uuid, uuid)') is null then raise exception 'Guarda: falta la migración 0081'; end if;
end $$;

create or replace function public.anular_presente(p_clase_id uuid, p_socio_id uuid, p_motivo text) returns void
language plpgsql security definer set search_path = '' as $$
declare aid uuid; g uuid;
begin
  select c.gimnasio_id into g from public.clases c where c.id = p_clase_id;
  if g is null then raise exception 'Sin permiso o clase inexistente' using errcode = '42501'; end if;
  -- Sin rol del gimnasio, el mismo error que si no existiera (no se dice si tiene presente).
  perform privado.exigir_equipo(g, array['dueno', 'encargado', 'recepcion', 'profe']);
  select a.id into aid from public.asistencias a where a.clase_id = p_clase_id and a.socio_id = p_socio_id and a.anulada_en is null;
  if aid is null then raise exception 'No tiene presente en esta clase' using errcode = '22023'; end if;
  perform public.anular_asistencia(aid, p_motivo);   -- con sus reglas de quién y hasta cuándo
end $$;

revoke all on function public.anular_presente(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.anular_presente(uuid, uuid, text) to authenticated, service_role;

-- ── Verificación ────────────────────────────────────────────────────
do $$
begin
  if not exists (select 1 from pg_proc where oid = 'public.anular_presente(uuid, uuid, text)'::regprocedure and 'search_path=""' = any (proconfig)) then
    raise exception 'Verificación: anular_presente sin search_path vacío';
  end if;
  if has_function_privilege('anon', 'public.anular_presente(uuid, uuid, text)', 'execute') then raise exception 'Verificación: anon puede anular presentes'; end if;
end $$;
