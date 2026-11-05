-- 0058 · Qué actividades incluye un plan, desde Planes (PLA-2).
-- plan_actividades ya existe (0011) y privado.plan_incluye ya decide la
-- reserva: sin filas, el plan incluye todas; con filas, solo esas. Faltaba
-- dónde elegirlas. Es configuración (no un hecho): se reemplaza el conjunto.

-- ── Guarda de entrada ───────────────────────────────────────────────
do $$
begin
  if to_regclass('public.plan_actividades') is null then raise exception 'Guarda: falta plan_actividades (0011)'; end if;
  if to_regprocedure('public.vista_aumento(uuid, uuid[], text, numeric, int, date)') is null then raise exception 'Guarda: falta la migración 0057'; end if;
end $$;

-- { plan_id: [actividad_id, …] } de los planes que restringen (los demás incluyen todas).
create or replace function public.actividades_por_plan(p_gimnasio_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado']);
  return coalesce((select jsonb_object_agg(x.plan_id, x.ids) from (
    select pa.plan_id, jsonb_agg(pa.actividad_id order by pa.actividad_id) as ids
      from public.plan_actividades pa where pa.gimnasio_id = p_gimnasio_id group by pa.plan_id) x), '{}'::jsonb);
end $$;

-- Vacío = todas. Devuelve cuántas quedaron.
create or replace function public.guardar_actividades_plan(p_plan_id uuid, p_actividades uuid[]) returns int
language plpgsql security definer set search_path = '' as $$
declare p public.planes; n int;
begin
  select * into p from public.planes where id = p_plan_id;
  if not found then raise exception 'Sin permiso o plan inexistente' using errcode = '42501'; end if;
  perform privado.exigir_equipo(p.gimnasio_id, array['dueno', 'encargado']);
  if exists (select 1 from unnest(coalesce(p_actividades, '{}')) a(id)
              where not exists (select 1 from public.actividades x where x.id = a.id and x.gimnasio_id = p.gimnasio_id)) then
    raise exception 'Esa actividad no es de este gimnasio' using errcode = '22023';
  end if;
  delete from public.plan_actividades where plan_id = p.id and gimnasio_id = p.gimnasio_id;
  insert into public.plan_actividades (gimnasio_id, plan_id, actividad_id)
  select distinct p.gimnasio_id, p.id, a.id from unnest(coalesce(p_actividades, '{}')) a(id);
  get diagnostics n = row_count;
  return n;
end $$;

revoke all on function public.actividades_por_plan(uuid), public.guardar_actividades_plan(uuid, uuid[]) from public, anon, authenticated;
grant execute on function public.actividades_por_plan(uuid), public.guardar_actividades_plan(uuid, uuid[]) to authenticated, service_role;

-- ── Verificación ────────────────────────────────────────────────────
do $$
declare f text;
begin
  foreach f in array array['public.actividades_por_plan(uuid)', 'public.guardar_actividades_plan(uuid, uuid[])'] loop
    if not exists (select 1 from pg_proc where oid = f::regprocedure and 'search_path=""' = any (proconfig)) then
      raise exception 'Verificación: % sin search_path vacío', f;
    end if;
    if has_function_privilege('anon', f, 'execute') then raise exception 'Verificación: anon puede ejecutar %', f; end if;
  end loop;
end $$;
