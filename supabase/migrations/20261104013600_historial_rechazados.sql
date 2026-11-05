-- 0136 · El historial del socio muestra la transferencia rechazada y el motivo.
-- Rechazar un comprobante anula la venta que lo esperaba (caja_venta), y
-- mi_historial (0092) salteaba las ventas anuladas: el socio nunca veía
-- "❌ rechazado: el monto no coincide". Ahora el pago rechazado aparece aunque
-- su venta esté anulada; los anulados de verdad (venta anulada sin rechazo,
-- pago anulado) siguen afuera. Mismos permisos que antes: el socio lo suyo,
-- o el equipo del gimnasio.

-- ── Guarda de entrada ───────────────────────────────────────────────
do $$
begin
  if to_regprocedure('public.mi_historial(uuid)') is null then raise exception 'Guarda: falta mi_historial'; end if;
end $$;

create or replace function public.mi_historial(p_socio_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare g uuid;
begin
  select gimnasio_id into g from public.socios where id = p_socio_id;
  if g is null then raise exception 'Sin permiso o socio inexistente' using errcode = '42501'; end if;
  if p_socio_id not in (select privado.mis_socios()) then perform privado.exigir_equipo(g, array['dueno', 'encargado', 'recepcion']); end if;
  return jsonb_build_object(
    'pagos', coalesce((select jsonb_agg(x order by (x ->> 'fecha')::timestamptz desc) from (
        select jsonb_build_object('fecha', coalesce(p.aprobado_en, p.rechazado_en, p.creado_en), 'monto', p.monto, 'medio', p.medio, 'estado', p.estado,
                 'detalle', (select string_agg(i.descripcion, ' + ' order by i.id) from public.venta_items i where i.venta_id = v.id),
                 'motivo', p.rechazado_motivo) x
          from public.pagos p join public.ventas v on v.id = p.venta_id
         where v.socio_id = p_socio_id
           and (p.estado = 'rechazado' or (v.estado <> 'anulada' and p.estado <> 'anulado'))
         order by coalesce(p.aprobado_en, p.rechazado_en, p.creado_en) desc limit 12) y), '[]'::jsonb),
    'entradas', coalesce((select jsonb_agg(jsonb_build_object('momento', u.m, 'tipo', u.tipo, 'actividad', u.actividad) order by u.m desc) from (
        select i.momento m, 'entrada' tipo, null::text actividad from public.ingresos i
         where i.socio_id = p_socio_id and i.anulado_en is null and i.resultado <> 'rechazado'
        union all
        select c.inicio, 'clase', a.nombre
          from public.asistencias s join public.clases c on c.id = s.clase_id join public.actividades a on a.id = c.actividad_id
         where s.socio_id = p_socio_id and s.anulada_en is null
        order by 1 desc limit 15) u), '[]'::jsonb));
end $$;

revoke all on function public.mi_historial(uuid) from public, anon, authenticated;
grant execute on function public.mi_historial(uuid) to authenticated, service_role;

-- ── Verificación ────────────────────────────────────────────────────
do $$
begin
  if not exists (select 1 from pg_proc where oid = 'public.mi_historial(uuid)'::regprocedure and 'search_path=""' = any (proconfig)) then
    raise exception 'Verificación: mi_historial sin search_path vacío';
  end if;
  if has_function_privilege('anon', 'public.mi_historial(uuid)', 'execute') then raise exception 'Verificación: anon puede leer historiales'; end if;
  if position('rechazado' in pg_get_functiondef('public.mi_historial(uuid)'::regprocedure)) = 0 then
    raise exception 'Verificación: mi_historial no muestra los rechazados';
  end if;
end $$;
