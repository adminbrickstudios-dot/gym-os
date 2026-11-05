-- 0106 · Inicio: los socios que pidieron la baja desde la app (AUD-14).
-- Estaban en la campana y en la ficha, pero no en Inicio, donde están las
-- pausas para aprobar y las ventas para anular.
--   pedidos_baja_pendientes(gimnasio)   dueño, encargado, recepción

-- ── Guarda de entrada ───────────────────────────────────────────────
do $$
begin
  if to_regprocedure('public.progreso_socio(uuid)') is null then raise exception 'Guarda: falta la migración 0105'; end if;
end $$;

create or replace function public.pedidos_baja_pendientes(p_gimnasio_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado', 'recepcion']);
  return coalesce((select jsonb_agg(jsonb_build_object('pedido_id', p.id, 'socio_id', s.id, 'nombre', trim(s.nombre || ' ' || s.apellido),
            'motivo', p.motivo, 'nota', p.nota, 'pedido_en', p.pedido_en) order by p.pedido_en)
    from public.pedidos_baja p join public.socios s on s.id = p.socio_id
   where p.gimnasio_id = p_gimnasio_id and p.estado = 'pendiente'), '[]'::jsonb);
end $$;

revoke all on function public.pedidos_baja_pendientes(uuid) from public, anon, authenticated;
grant execute on function public.pedidos_baja_pendientes(uuid) to authenticated, service_role;

-- ── Verificación ────────────────────────────────────────────────────
do $$
begin
  if not exists (select 1 from pg_proc where oid = 'public.pedidos_baja_pendientes(uuid)'::regprocedure and 'search_path=""' = any (proconfig)) then
    raise exception 'Verificación: pedidos_baja_pendientes sin search_path vacío';
  end if;
  if has_function_privilege('anon', 'public.pedidos_baja_pendientes(uuid)', 'execute') then raise exception 'Verificación: anon puede ver los pedidos de baja'; end if;
end $$;
