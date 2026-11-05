-- 0060 · Cambio de plan con días a favor (PLA-6, decisión D6).
-- D6: sin plata automática. El plan nuevo arranca hoy y lo que quedaba pago
-- del viejo pasa al nuevo como días a favor (cobertura 'traspaso', ya lo hacía
-- privado.cambiar_plan). Si el dueño quiere cobrar la diferencia, lo hace en
-- Vender. Lo nuevo:
--   vista_cambio_plan(socio, plan)  qué va a pasar antes de confirmar: días a
--                                   favor, hasta cuándo, precio viejo y nuevo
--   cambiar_plan / asignar_plan     copias (0007) que dicen en castellano por
--                                   qué no se puede: plan de otro gimnasio,
--                                   que no se vende o que no es una membresía

-- ── Guarda de entrada ───────────────────────────────────────────────
do $$
begin
  if to_regprocedure('privado.cambiar_plan(uuid, uuid, timestamptz, uuid)') is null then raise exception 'Guarda: falta privado.cambiar_plan (0007)'; end if;
  if to_regprocedure('public.guardar_matricula_plan(uuid, numeric, boolean)') is null then raise exception 'Guarda: falta la migración 0059'; end if;
end $$;

-- El plan al que se pasa: de este gimnasio, a la venta y membresía.
create or replace function privado.validar_plan_nuevo(p_gimnasio_id uuid, p_plan_id uuid) returns public.planes
language plpgsql stable set search_path = '' as $$
declare pn public.planes;
begin
  select * into pn from public.planes where id = p_plan_id and gimnasio_id = p_gimnasio_id;
  if not found then raise exception 'Ese plan no es de este gimnasio' using errcode = '22023'; end if;
  if not pn.activo then raise exception '% no se vende más: volvé a ponerlo a la venta en Planes o elegí otro', pn.nombre using errcode = '22023'; end if;
  if pn.tipo <> 'membresia' then raise exception '% es un % : se vende en Vender, no se asigna como plan', pn.nombre,
    case pn.tipo when 'pack' then 'pack de clases' else 'pase' end using errcode = '22023'; end if;
  return pn;
end $$;
revoke all on function privado.validar_plan_nuevo(uuid, uuid) from public;

create or replace function public.vista_cambio_plan(p_socio_id uuid, p_plan_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare g uuid; zona text; vieja public.suscripciones; pv public.planes; pn public.planes; fin timestamptz; hoy date;
begin
  select gimnasio_id into g from public.socios where id = p_socio_id;
  if g is null then raise exception 'Sin permiso o socio inexistente' using errcode = '42501'; end if;
  perform privado.exigir_rol(g, array['dueno', 'encargado', 'recepcion']);
  pn := privado.validar_plan_nuevo(g, p_plan_id);
  select zona_horaria into zona from public.gimnasios where id = g;
  hoy := privado.dia_local(now(), zona);
  select * into vieja from public.suscripciones where socio_id = p_socio_id and baja_en is null;
  if found then
    select * into pv from public.planes where id = vieja.plan_id;
    select max(c.hasta) into fin from public.coberturas c where c.suscripcion_id = vieja.id and c.anulada_en is null and c.hasta > now();
  end if;
  return jsonb_build_object(
    'plan_viejo', pv.nombre, 'plan_nuevo', pn.nombre,
    'precio_viejo', case when pv.id is not null then round(privado.precio_base(pv.id, now()) / pv.duracion_meses, 2) end,
    'precio_nuevo', round(privado.precio_base(pn.id, now()) / pn.duracion_meses, 2),
    -- Último día pago (inclusive) y cuántos días quedan desde hoy.
    'hasta', case when fin is not null then privado.dia_local(fin, zona) - 1 end,
    'dias_a_favor', case when fin is not null then greatest(privado.dia_local(fin, zona) - hoy, 0) else 0 end,
    'congelado', vieja.id is not null and exists (select 1 from public.congelamientos c where c.suscripcion_id = vieja.id and c.anulado_en is null
                                                   and coalesce(c.hasta_real, c.hasta_prevista) > now()));
end $$;

create or replace function public.cambiar_plan(p_socio_id uuid, p_plan_id uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare g uuid;
begin
  select gimnasio_id into g from public.socios where id = p_socio_id;
  if g is null then raise exception 'Sin permiso o socio inexistente' using errcode = '42501'; end if;
  perform privado.exigir_rol(g, array['dueno', 'encargado', 'recepcion']);
  perform privado.validar_plan_nuevo(g, p_plan_id);
  return privado.cambiar_plan(p_socio_id, p_plan_id, now(), auth.uid());
end $$;

create or replace function public.asignar_plan(p_socio_id uuid, p_plan_id uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare g uuid;
begin
  select gimnasio_id into g from public.socios where id = p_socio_id;
  if g is null then raise exception 'Sin permiso o socio inexistente' using errcode = '42501'; end if;
  perform privado.exigir_rol(g, array['dueno', 'encargado', 'recepcion']);
  perform privado.validar_plan_nuevo(g, p_plan_id);
  return privado.asignar_plan(p_socio_id, p_plan_id, now(), auth.uid());
end $$;

revoke all on function public.vista_cambio_plan(uuid, uuid), public.cambiar_plan(uuid, uuid), public.asignar_plan(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.vista_cambio_plan(uuid, uuid), public.cambiar_plan(uuid, uuid), public.asignar_plan(uuid, uuid)
  to authenticated, service_role;

-- ── Verificación ────────────────────────────────────────────────────
do $$
declare f text;
begin
  foreach f in array array['public.vista_cambio_plan(uuid, uuid)', 'public.cambiar_plan(uuid, uuid)', 'public.asignar_plan(uuid, uuid)',
                           'privado.validar_plan_nuevo(uuid, uuid)'] loop
    if not exists (select 1 from pg_proc where oid = f::regprocedure and 'search_path=""' = any (proconfig)) then
      raise exception 'Verificación: % sin search_path vacío', f;
    end if;
    if has_function_privilege('anon', f, 'execute') then raise exception 'Verificación: anon puede ejecutar %', f; end if;
  end loop;
end $$;
