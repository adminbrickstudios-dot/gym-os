-- 0077 · Exportar el mes para el contador (RES-2).
-- Ventas, pagos y caja de un mes, fila por fila, para bajar en CSV. Solo
-- dueño y encargado. Las fechas salen en la hora del gimnasio.
--   exportar_mes(gimnasio, mes, que)   que = 'ventas' | 'pagos' | 'caja'

-- ── Guarda de entrada ───────────────────────────────────────────────
do $$
begin
  if to_regprocedure('public.resultado_mes(uuid, date)') is null then raise exception 'Guarda: falta la migración 0076'; end if;
end $$;

create or replace function public.exportar_mes(p_gimnasio_id uuid, p_mes date, p_que text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare zona text; mes date; d0 timestamptz; d1 timestamptz;
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado']);
  if p_que is null or p_que not in ('ventas', 'pagos', 'caja') then raise exception 'Qué exportar: ventas, pagos o caja' using errcode = '22023'; end if;
  select zona_horaria into zona from public.gimnasios where id = p_gimnasio_id;
  mes := date_trunc('month', coalesce(p_mes, privado.dia_local(now(), zona)))::date;
  d0 := privado.medianoche(mes, zona);
  d1 := privado.medianoche((mes + interval '1 month')::date, zona);

  if p_que = 'ventas' then
    return coalesce((select jsonb_agg(jsonb_build_object(
        'fecha', to_char(v.creado_en at time zone zona, 'DD/MM/YYYY HH24:MI'), 'venta', left(v.id::text, 8),
        'socio', (select trim(s.nombre || ' ' || s.apellido) from public.socios s where s.id = v.socio_id),
        'detalle', (select string_agg(i.descripcion || case when i.cantidad > 1 then ' x' || i.cantidad else '' end, ' + ' order by i.id) from public.venta_items i where i.venta_id = v.id),
        'bruto', (select coalesce(sum(i.cantidad * i.precio_unitario), 0) from public.venta_items i where i.venta_id = v.id),
        'descuento', (select coalesce(sum(i.descuento), 0) from public.venta_items i where i.venta_id = v.id),
        'total', (select coalesce(sum(i.cantidad * i.precio_unitario - i.descuento), 0) from public.venta_items i where i.venta_id = v.id),
        'estado', v.estado, 'cobro', (select e.nombre from public.equipo e where e.id = v.creado_por),
        'sede', (select x.nombre from public.sedes x where x.id = v.sede_id),
        'anulada', case when v.anulada_en is not null then to_char(v.anulada_en at time zone zona, 'DD/MM/YYYY') || ': ' || v.anulada_motivo end)
        order by v.creado_en)
      from public.ventas v where v.gimnasio_id = p_gimnasio_id and v.creado_en >= d0 and v.creado_en < d1), '[]'::jsonb);
  elsif p_que = 'pagos' then
    return coalesce((select jsonb_agg(jsonb_build_object(
        'fecha', to_char(coalesce(p.aprobado_en, p.creado_en) at time zone zona, 'DD/MM/YYYY HH24:MI'), 'venta', left(p.venta_id::text, 8),
        'socio', (select trim(s.nombre || ' ' || s.apellido) from public.ventas v join public.socios s on s.id = v.socio_id where v.id = p.venta_id),
        'medio', p.medio, 'monto', p.monto, 'estado', p.estado,
        'quien', (select e.nombre from public.equipo e where e.id = coalesce(p.creado_por, p.aprobado_por)))
        order by coalesce(p.aprobado_en, p.creado_en))
      from public.pagos p where p.gimnasio_id = p_gimnasio_id and coalesce(p.aprobado_en, p.creado_en) >= d0 and coalesce(p.aprobado_en, p.creado_en) < d1), '[]'::jsonb);
  else
    return coalesce((select jsonb_agg(x order by x ->> 'orden') from (
      select jsonb_build_object('orden', t.abierto_en, 'fecha', to_char(t.abierto_en at time zone zona, 'DD/MM/YYYY HH24:MI'), 'caja', c.nombre, 'tipo', 'Apertura',
               'monto', t.monto_inicial, 'motivo', null, 'quien', (select e.nombre from public.equipo e where e.id = t.abierto_por)) x
        from public.turnos_caja t join public.cajas c on c.id = t.caja_id
       where t.gimnasio_id = p_gimnasio_id and t.abierto_en >= d0 and t.abierto_en < d1
      union all
      select jsonb_build_object('orden', m.creado_en, 'fecha', to_char(m.creado_en at time zone zona, 'DD/MM/YYYY HH24:MI'), 'caja', c.nombre,
               'tipo', case m.tipo when 'retiro' then 'Retiro' when 'ingreso' then 'Ingreso' else initcap(m.tipo) end,
               'monto', m.monto, 'motivo', m.motivo, 'quien', (select e.nombre from public.equipo e where e.id = m.creado_por))
        from public.movimientos_caja m join public.turnos_caja t on t.id = m.turno_caja_id join public.cajas c on c.id = t.caja_id
       where m.gimnasio_id = p_gimnasio_id and m.creado_en >= d0 and m.creado_en < d1
      union all
      select jsonb_build_object('orden', t.cerrado_en, 'fecha', to_char(t.cerrado_en at time zone zona, 'DD/MM/YYYY HH24:MI'), 'caja', c.nombre, 'tipo', 'Cierre',
               'monto', t.monto_contado, 'motivo', 'Esperado ' || privado.formato_pesos(t.monto_esperado) || ', diferencia ' || privado.formato_pesos(t.monto_contado - t.monto_esperado)
                        || coalesce(' · ' || t.nota, ''),
               'quien', (select e.nombre from public.equipo e where e.id = t.cerrado_por))
        from public.turnos_caja t join public.cajas c on c.id = t.caja_id
       where t.gimnasio_id = p_gimnasio_id and t.cerrado_en >= d0 and t.cerrado_en < d1
    ) y), '[]'::jsonb);
  end if;
end $$;

revoke all on function public.exportar_mes(uuid, date, text) from public, anon, authenticated;
grant execute on function public.exportar_mes(uuid, date, text) to authenticated, service_role;

-- ── Verificación ────────────────────────────────────────────────────
do $$
begin
  if not exists (select 1 from pg_proc where oid = 'public.exportar_mes(uuid, date, text)'::regprocedure and 'search_path=""' = any (proconfig)) then
    raise exception 'Verificación: exportar_mes sin search_path vacío';
  end if;
  if has_function_privilege('anon', 'public.exportar_mes(uuid, date, text)', 'execute') then raise exception 'Verificación: anon puede exportar'; end if;
end $$;
