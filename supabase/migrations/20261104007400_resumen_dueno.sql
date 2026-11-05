-- 0074 · Resumen del dueño, del día y de la semana (AVI-6).
-- Lo de 06-CAJA-Y-CONTROL punto 11: cobrado por medio y por persona,
-- diferencias de caja, retiros, descuentos, anulaciones, dejados pasar,
-- entradas, altas y bajas. Se calcula al abrirlo (nada se guarda) y, para
-- comparar, el mismo período anterior.
--   resumen_dueno(gimnasio, desde, dias)   dueño y encargado
-- La campana (copia de 0073) suma "📊 Resumen de hoy/ayer" (desde las 22 h) y
-- el de la semana pasada los lunes.

-- ── Guarda de entrada ───────────────────────────────────────────────
do $$
begin
  if to_regprocedure('public.campana(uuid)') is null then raise exception 'Guarda: falta la migración 0073'; end if;
end $$;

-- Un período [desde, hasta): sin permisos (lo llaman funciones que ya los piden).
create or replace function privado.resumen_periodo(p_gimnasio_id uuid, p_desde timestamptz, p_hasta timestamptz) returns jsonb
language sql stable set search_path = '' as $$
  with pg as (
    select p.*, coalesce(p.creado_por, p.aprobado_por) as quien from public.pagos p
     where p.gimnasio_id = p_gimnasio_id and p.estado = 'aprobado' and p.aprobado_en >= p_desde and p.aprobado_en < p_hasta
  ), it as (
    select i.* from public.venta_items i join public.ventas v on v.id = i.venta_id
     where v.gimnasio_id = p_gimnasio_id and v.creado_en >= p_desde and v.creado_en < p_hasta and v.estado <> 'anulada' and i.descuento > 0
  ), ing as (
    select i.* from public.ingresos i
     where i.gimnasio_id = p_gimnasio_id and i.momento >= p_desde and i.momento < p_hasta and i.anulado_en is null
  )
  select jsonb_build_object(
    -- Lo fiado no es plata que entró (VEN-5): va aparte.
    'cobrado', (select coalesce(sum(monto), 0) from pg where medio <> 'cuenta_corriente'),
    'fiado', (select coalesce(sum(monto), 0) from pg where medio = 'cuenta_corriente'),
    'por_medio', (select coalesce(jsonb_agg(jsonb_build_object('medio', medio, 'total', t) order by t desc), '[]'::jsonb)
                    from (select medio, sum(monto) t from pg where medio <> 'cuenta_corriente' group by medio) x),
    'por_persona', (select coalesce(jsonb_agg(jsonb_build_object('nombre', coalesce(q.nombre, 'Online'), 'total', x.t, 'cobros', x.n) order by x.t desc), '[]'::jsonb)
                      from (select quien, sum(monto) t, count(*) n from pg where medio <> 'cuenta_corriente' group by quien) x
                      left join public.equipo q on q.id = x.quien),
    'cajas_cerradas', (select count(*) from public.turnos_caja t where t.gimnasio_id = p_gimnasio_id and t.cerrado_en >= p_desde and t.cerrado_en < p_hasta),
    'diferencias', (select coalesce(jsonb_agg(jsonb_build_object('caja', c.nombre, 'monto', t.monto_contado - t.monto_esperado, 'por', q.nombre, 'en', t.cerrado_en) order by t.cerrado_en), '[]'::jsonb)
                      from public.turnos_caja t join public.cajas c on c.id = t.caja_id left join public.equipo q on q.id = t.cerrado_por
                     where t.gimnasio_id = p_gimnasio_id and t.cerrado_en >= p_desde and t.cerrado_en < p_hasta and t.monto_contado <> t.monto_esperado),
    'retiros', (select jsonb_build_object('cantidad', count(*), 'total', coalesce(sum(m.monto), 0),
                        'lista', coalesce(jsonb_agg(jsonb_build_object('monto', m.monto, 'motivo', m.motivo, 'por', q.nombre, 'en', m.creado_en) order by m.creado_en) filter (where m.id is not null), '[]'::jsonb))
                  from public.movimientos_caja m left join public.equipo q on q.id = m.creado_por
                 where m.gimnasio_id = p_gimnasio_id and m.tipo = 'retiro' and m.creado_en >= p_desde and m.creado_en < p_hasta),
    'descuentos', (select jsonb_build_object('cantidad', count(*), 'total', coalesce(sum(descuento), 0),
                           'convenios', coalesce(sum(descuento) filter (where descuento_motivo like 'Convenio %'), 0)) from it),
    'anulaciones', (select jsonb_build_object('cantidad', count(*),
                            'total', coalesce(sum((select sum(i.cantidad * i.precio_unitario - i.descuento) from public.venta_items i where i.venta_id = v.id)), 0))
                      from public.ventas v where v.gimnasio_id = p_gimnasio_id and v.anulada_en >= p_desde and v.anulada_en < p_hasta),
    'dejados_pasar', (select count(*) from ing where resultado = 'forzado'),
    'entradas', (select count(*) from ing where resultado <> 'rechazado'),
    'socios_que_vinieron', (select count(distinct socio_id) from ing where resultado <> 'rechazado'),
    'rechazados', (select count(*) from ing where resultado = 'rechazado'),
    'altas', (select count(*) from public.socios s where s.gimnasio_id = p_gimnasio_id and s.creado_en >= p_desde and s.creado_en < p_hasta),
    'bajas', (select count(*) from public.socios s where s.gimnasio_id = p_gimnasio_id and s.dado_de_baja_en >= p_desde and s.dado_de_baja_en < p_hasta)
  )
$$;
revoke all on function privado.resumen_periodo(uuid, timestamptz, timestamptz) from public;

-- Desde un día local, N días (1 = el día; 7 = la semana). Compara con los N días anteriores.
create or replace function public.resumen_dueno(p_gimnasio_id uuid, p_desde date default null, p_dias int default 1) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare zona text; d date; n int;
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado']);
  select zona_horaria into zona from public.gimnasios where id = p_gimnasio_id;
  n := coalesce(p_dias, 1);
  if n < 1 or n > 31 then raise exception 'El resumen es de 1 a 31 días' using errcode = '22023'; end if;
  d := coalesce(p_desde, privado.dia_local(now(), zona));
  if d > privado.dia_local(now(), zona) then raise exception 'Ese día todavía no pasó' using errcode = '22023'; end if;
  return jsonb_build_object('desde', d, 'hasta', d + n - 1, 'dias', n,
    'actual', privado.resumen_periodo(p_gimnasio_id, privado.medianoche(d, zona), privado.medianoche(d + n, zona)),
    'anterior', privado.resumen_periodo(p_gimnasio_id, privado.medianoche(d - n, zona), privado.medianoche(d, zona)));
end $$;

revoke all on function public.resumen_dueno(uuid, date, int) from public, anon, authenticated;
grant execute on function public.resumen_dueno(uuid, date, int) to authenticated, service_role;

-- ── Campana: copia de 0073, con el resumen para el dueño y el encargado ──
create or replace function public.campana(p_gimnasio_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
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

  return privado.con_leidos(p_gimnasio_id, items);
end $$;

-- ── Verificación ────────────────────────────────────────────────────
do $$
declare f text;
begin
  foreach f in array array['public.resumen_dueno(uuid, date, int)', 'privado.resumen_periodo(uuid, timestamptz, timestamptz)', 'public.campana(uuid)'] loop
    if not exists (select 1 from pg_proc where oid = f::regprocedure and 'search_path=""' = any (proconfig)) then
      raise exception 'Verificación: % sin search_path vacío', f;
    end if;
    if has_function_privilege('anon', f, 'execute') then raise exception 'Verificación: anon puede ejecutar %', f; end if;
  end loop;
  if position('resumen_semana:' in pg_get_functiondef('public.campana(uuid)'::regprocedure)) = 0 then
    raise exception 'Verificación: la campana no tiene el resumen';
  end if;
end $$;
