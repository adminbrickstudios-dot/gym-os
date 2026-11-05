-- 0116 · Funciones viejas sin pantalla (SEG-7).
-- cobrar_cuota, precio_cuota y caja_abierta son de la primera versión del
-- cobro: Vender (vender, precios_venta, cajas_sede) hace todo lo que hacían y
-- ninguna pantalla las usa. Se les saca el acceso del equipo (menos acceso,
-- nunca más); siguen para el servidor. asignar_plan queda: lo usa el alta de
-- un socio y la ficha.

-- ── Guarda de entrada ───────────────────────────────────────────────
do $$
begin
  if to_regprocedure('public.anonimizar_socio(uuid, text)') is null then raise exception 'Guarda: falta la migración 0115'; end if;
  if to_regprocedure('public.vender(uuid, jsonb, jsonb, uuid, uuid)') is null then raise exception 'Guarda: falta vender'; end if;
end $$;

revoke execute on function public.cobrar_cuota(uuid, uuid, text, integer, uuid), public.precio_cuota(uuid, text, uuid), public.caja_abierta(uuid)
  from public, anon, authenticated;
grant execute on function public.cobrar_cuota(uuid, uuid, text, integer, uuid), public.precio_cuota(uuid, text, uuid), public.caja_abierta(uuid)
  to service_role;

-- ── Verificación ────────────────────────────────────────────────────
do $$
begin
  if has_function_privilege('authenticated', 'public.cobrar_cuota(uuid, uuid, text, integer, uuid)', 'execute')
     or has_function_privilege('authenticated', 'public.precio_cuota(uuid, text, uuid)', 'execute')
     or has_function_privilege('authenticated', 'public.caja_abierta(uuid)', 'execute') then
    raise exception 'Verificación: el equipo sigue pudiendo usar las funciones viejas';
  end if;
  if not has_function_privilege('authenticated', 'public.asignar_plan(uuid, uuid)', 'execute') then raise exception 'Verificación: asignar_plan se usa desde el alta'; end if;
end $$;
