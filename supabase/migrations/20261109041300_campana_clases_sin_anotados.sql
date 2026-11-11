-- FA-12 (carril D, parte del equipo) · La campana avisa al profe, al encargado y al dueño de las clases de las próximas 2 horas que no tienen
-- ningún anotado o que se llenaron. Es la definición VIGENTE de public.campana(uuid) con un bloque más (antes del return); mismas columnas,
-- mismos permisos (create or replace conserva los grants). Solo avisa; la parte del socio (aviso en la app) es del carril C.

do $g$ begin
  if to_regprocedure('public.campana(uuid)') is null then raise exception 'FA-12: falta public.campana'; end if;
  if to_regclass('public.reservas') is null then raise exception 'FA-12: falta reservas'; end if;
end $g$;

CREATE OR REPLACE FUNCTION public.campana(p_gimnasio_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare e public.equipo; items jsonb := '[]'::jsonb; zona text; hoy date; dia date; lunes date;
begin
  e := privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado', 'recepcion', 'profe']);
  select zona_horaria into zona from public.gimnasios where id = p_gimnasio_id;

  if e.rol in ('dueno', 'encargado', 'recepcion') then
    -- Comprobantes para revisar (los de su sede, si tiene una).
    items := items || coalesce((select jsonb_agg(jsonb_build_object('clave', 'pago:' || p.pago_id, 'emoji', '🏦',
               'titulo', coalesce(p.socio, 'Un socio') || ' mandó un comprobante', 'detalle', privado.formato_pesos(p.monto) || ' · ' || coalesce(p.descripcion, ''),
               'href', '/transferencias', 'en', p.informado_en))
             from public.pagos_por_aprobar(p_gimnasio_id) p), '[]'::jsonb);
    -- Cajas que quedaron abiertas (a la recepción, las suyas).
    items := items || coalesce((select jsonb_agg(jsonb_build_object('clave', 'caja_abierta:' || (c ->> 'turno_id'), 'emoji', '🔓',
               'titulo', 'Quedó abierta la ' || (c ->> 'caja'), 'detalle', 'La abrió ' || (c ->> 'abierto_por'),
               'href', '/caja', 'en', c ->> 'abierto_en'))
             from jsonb_array_elements(public.cajas_olvidadas(p_gimnasio_id)) c), '[]'::jsonb);
  end if;

  if e.rol in ('dueno', 'encargado') then
    -- Lo que pasó con la plata (de otros), últimos 7 días.
    items := items || coalesce((select jsonb_agg(jsonb_build_object(
               'clave', 'caja:' || (a ->> 'tipo') || ':' || coalesce(a ->> 'movimiento_id', a ->> 'en'),
               'emoji', case a ->> 'tipo' when 'diferencia' then '⚖️' when 'retiro' then '💸' when 'anulacion' then '↩️' else '🏷️' end,
               'titulo', case a ->> 'tipo'
                 when 'diferencia' then 'La ' || coalesce(a ->> 'caja', 'caja') || ' cerró con ' || privado.formato_pesos(abs((a ->> 'monto')::numeric)) || case when (a ->> 'monto')::numeric > 0 then ' de más' else ' de menos' end
                 when 'retiro' then 'Salieron ' || privado.formato_pesos((a ->> 'monto')::numeric) || ' de la caja'
                 when 'anulacion' then 'Se anuló una venta de ' || privado.formato_pesos((a ->> 'monto')::numeric)
                 else 'Descuento de ' || privado.formato_pesos((a ->> 'monto')::numeric) end,
               'detalle', concat_ws(' · ', a ->> 'por', a ->> 'texto'),
               'href', case when a ->> 'tipo' in ('diferencia', 'retiro') then '/caja/historial' when a ->> 'socio_id' is not null then '/socios/' || (a ->> 'socio_id') else '/caja/historial' end,
               'en', a ->> 'en'))
             from jsonb_array_elements(public.alertas_caja(p_gimnasio_id, 7)) a), '[]'::jsonb);
    -- AVI-6: el resumen del día (desde las 22 h el de hoy; antes, el de ayer) y, desde el lunes, el de la semana pasada.
    hoy := privado.dia_local(now(), zona);
    dia := case when extract(hour from now() at time zone zona) >= 22 then hoy else hoy - 1 end;
    lunes := hoy - (extract(isodow from hoy)::int - 1);
    items := items || jsonb_build_array(
      jsonb_build_object('clave', 'resumen:' || dia, 'emoji', '📊', 'titulo', 'Resumen ' || case when dia = hoy then 'de hoy' else 'de ayer' end,
        'detalle', 'Plata, caja, entradas, altas y bajas', 'href', '/resumen?dia=' || dia,
        'en', case when dia = hoy then privado.medianoche(hoy, zona) + interval '22 hours' else privado.medianoche(hoy, zona) end),
      jsonb_build_object('clave', 'resumen_semana:' || (lunes - 7), 'emoji', '📅', 'titulo', 'Resumen de la semana pasada',
        'detalle', 'Del ' || to_char(lunes - 7, 'DD/MM') || ' al ' || to_char(lunes - 1, 'DD/MM') || ', comparada con la anterior',
        'href', '/resumen?semana=' || (lunes - 7), 'en', privado.medianoche(lunes, zona)));
    -- La recepción pide anular una venta.
    items := items || coalesce((select jsonb_agg(jsonb_build_object('clave', 'pedido_anulacion:' || pa.id, 'emoji', '🧾',
               'titulo', q.nombre || ' pide anular una venta', 'detalle', pa.motivo, 'href', '/', 'en', pa.pedido_en))
             from public.pedidos_anulacion pa join public.equipo q on q.id = pa.pedido_por
            where pa.gimnasio_id = p_gimnasio_id and pa.estado = 'pendiente'), '[]'::jsonb);
    -- APP-8: socios que pidieron la baja desde la app.
    items := items || coalesce((select jsonb_agg(jsonb_build_object('clave', 'pedido_baja:' || x.id, 'emoji', '👋',
               'titulo', trim(s.nombre || ' ' || s.apellido) || ' pidió la baja', 'detalle', coalesce(x.nota, 'Desde la app'),
               'href', '/socios/' || s.id, 'en', x.pedido_en))
             from public.pedidos_baja x join public.socios s on s.id = x.socio_id
            where x.gimnasio_id = p_gimnasio_id and x.estado = 'pendiente'), '[]'::jsonb);
    -- Pausas que esperan.
    items := items || coalesce((select jsonb_agg(jsonb_build_object('clave', 'pedido_pausa:' || x.id, 'emoji', '⏸️',
               'titulo', 'Pausa para aprobar: ' || trim(s.nombre || ' ' || s.apellido),
               'detalle', 'Del ' || to_char(x.desde at time zone zona, 'DD/MM') || ' al ' || to_char(x.hasta at time zone zona, 'DD/MM'),
               'href', '/', 'en', x.pedido_en))
             from public.pedidos_pausa x join public.socios s on s.id = x.socio_id
            where x.gimnasio_id = p_gimnasio_id and x.estado = 'pendiente'), '[]'::jsonb);
    -- Los que entraron sin poder, hoy.
    items := items || coalesce((select jsonb_agg(jsonb_build_object('clave', 'dejado:' || (d ->> 'ingreso_id'), 'emoji', '🚪',
               'titulo', coalesce(d ->> 'por', 'Alguien') || ' dejó pasar a ' || (d ->> 'socio'), 'detalle', d ->> 'motivo',
               'href', '/entrada/control', 'en', d ->> 'momento'))
             from jsonb_array_elements(public.dejados_pasar(p_gimnasio_id, null)) d), '[]'::jsonb);
    -- Productos para reponer (la clave cambia con el stock: si baja más, vuelve a avisar).
    items := items || coalesce((select jsonb_agg(jsonb_build_object('clave', 'stock:' || p.id || ':' || st.n, 'emoji', '📦',
               'titulo', case when st.n <= 0 then 'Se terminó: ' || p.nombre else 'Quedan ' || st.n || ' de ' || p.nombre end,
               'detalle', 'Para reponer', 'href', '/planes', 'en', null))
             from public.productos p cross join lateral (select privado.stock_producto(p.id) as n) st
            where p.gimnasio_id = p_gimnasio_id and p.activo and p.controla_stock and st.n <= coalesce(p.stock_minimo, 0)), '[]'::jsonb);
  end if;

  if e.rol = 'recepcion' then
    -- Lo que pidió anular, ya resuelto.
    items := items || coalesce((select jsonb_agg(jsonb_build_object('clave', 'anulacion_resuelta:' || pa.id,
               'emoji', case pa.estado when 'aprobado' then '✅' else '❌' end,
               'titulo', case pa.estado when 'aprobado' then 'Anularon la venta que pediste' else 'No anularon la venta que pediste' end,
               'detalle', concat_ws(' · ', q.nombre, pa.respuesta), 'href', '/vender', 'en', pa.resuelto_en))
             from public.pedidos_anulacion pa left join public.equipo q on q.id = pa.resuelto_por
            where pa.gimnasio_id = p_gimnasio_id and pa.pedido_por = e.id and pa.estado <> 'pendiente' and pa.resuelto_en > now() - interval '3 days'), '[]'::jsonb);
  end if;

  if e.rol = 'profe' then
    -- Sus clases que se cancelaron (próximos días).
    items := items || coalesce((select jsonb_agg(jsonb_build_object('clave', 'clase_cancelada:' || c.id, 'emoji', '❌',
               'titulo', 'Se canceló ' || a.nombre || ' del ' || to_char(c.inicio at time zone zona, 'DD/MM HH24:MI'),
               'detalle', c.cancelada_motivo, 'href', '/clases', 'en', c.cancelada_en))
             from public.clases c join public.actividades a on a.id = c.actividad_id
            where c.gimnasio_id = p_gimnasio_id and c.profe_id = e.id and c.cancelada_en is not null and c.inicio > now()), '[]'::jsonb);
  end if;

  -- FA-12 (equipo): "clase sin anotados" y "clase llena" para el profe (las suyas) y el encargado y el dueño (todas), con 2 horas de anticipación.
  -- Solo avisan: no deciden nada. Se calculan al consultar, de las reservas confirmadas (sin cron).
  if e.rol in ('profe', 'encargado', 'dueno') then
    items := items || coalesce((select jsonb_agg(x.item order by x.inicio) from (
      select c.inicio, jsonb_build_object(
               'clave', case when n.confirmadas = 0 then 'clase_sin_anotados:' else 'clase_llena:' end || c.id,
               'emoji', case when n.confirmadas = 0 then 'alerta' else 'usuarios' end,
               'titulo', case when n.confirmadas = 0 then 'Sin anotados: ' else 'Clase llena: ' end || a.nombre || ' ' || to_char(c.inicio at time zone zona, 'HH24:MI'),
               'detalle', case when n.confirmadas = 0 then 'Empieza en ' || greatest(1, round(extract(epoch from (c.inicio - now())) / 60)::int) || ' minutos y nadie se anotó.'
                               else 'Ya están los ' || n.confirmadas || ' lugares: los que se anoten van a la espera.' end,
               'href', '/clases', 'en', now()) as item
        from public.clases c
        join public.actividades a on a.id = c.actividad_id
        cross join lateral (select count(*)::int as confirmadas from public.reservas r where r.clase_id = c.id and r.estado = 'confirmada') n
       where c.gimnasio_id = p_gimnasio_id and c.cancelada_en is null and c.inicio > now() and c.inicio <= now() + interval '2 hours'
         and (e.rol <> 'profe' or c.profe_id = e.id)
         and (n.confirmadas = 0 or (c.cupo is not null and n.confirmadas >= c.cupo))) x), '[]'::jsonb);
  end if;

  return privado.con_leidos(p_gimnasio_id, items);
end $function$;

do $v$ begin
  if has_function_privilege('anon', 'public.campana(uuid)', 'execute') then raise exception 'FA-12: la campana no es para anónimos'; end if;
  if not has_function_privilege('authenticated', 'public.campana(uuid)', 'execute') then raise exception 'FA-12: la campana perdió el permiso'; end if;
end $v$;
