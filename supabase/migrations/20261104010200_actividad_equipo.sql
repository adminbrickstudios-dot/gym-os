-- 0102 · Qué hizo cada uno (EQU-3).
-- Por persona y por día: ventas (cuántas y cuánto), descuentos, anulaciones,
-- dejados pasar, entradas que anotó y cierres de caja con su diferencia.
-- Se calcula de los hechos (nada se guarda). Además, la lista de lo que
-- conviene mirar: descuentos, anulaciones, dejados pasar y cajas que no
-- cerraron justas, con la hora. Lo ve el dueño (y el encargado si ve el
-- Resultado: es plata, EQU-1).
--   actividad_equipo(gimnasio, dia)

-- ── Guarda de entrada ───────────────────────────────────────────────
do $$
begin
  if to_regprocedure('public.buscar_socios_profe(uuid, text)') is null then raise exception 'Guarda: falta la migración 0101'; end if;
  if to_regprocedure('privado.exigir_resultado(uuid)') is null then raise exception 'Guarda: falta privado.exigir_resultado (0100)'; end if;
end $$;

create or replace function public.actividad_equipo(p_gimnasio_id uuid, p_dia date default null) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare zona text; dia date; desde timestamptz; hasta timestamptz;
begin
  perform privado.exigir_resultado(p_gimnasio_id);
  select zona_horaria into zona from public.gimnasios where id = p_gimnasio_id;
  dia := coalesce(p_dia, privado.dia_local(now(), zona));
  if dia > privado.dia_local(now(), zona) then raise exception 'Ese día todavía no pasó' using errcode = '22023'; end if;
  desde := privado.medianoche(dia, zona); hasta := privado.medianoche(dia + 1, zona);
  return jsonb_build_object('dia', dia,
    'personas', coalesce((
      select jsonb_agg(x order by x ->> 'nombre') from (
        select jsonb_build_object('equipo_id', e.id, 'nombre', e.nombre, 'rol', e.rol,
          'ventas', (select count(*) from public.ventas v where v.creado_por = e.id and v.estado = 'confirmada' and v.anulada_en is null and v.confirmada_en >= desde and v.confirmada_en < hasta),
          'vendido', (select coalesce(sum(vi.cantidad * vi.precio_unitario - vi.descuento), 0) from public.ventas v join public.venta_items vi on vi.venta_id = v.id
                       where v.creado_por = e.id and v.estado = 'confirmada' and v.anulada_en is null and v.confirmada_en >= desde and v.confirmada_en < hasta),
          'descuentos', (select coalesce(sum(vi.descuento), 0) from public.ventas v join public.venta_items vi on vi.venta_id = v.id
                          where v.creado_por = e.id and v.estado = 'confirmada' and v.anulada_en is null and v.confirmada_en >= desde and v.confirmada_en < hasta),
          'anulaciones', (select count(*) from public.ventas v where v.anulada_por = e.id and v.anulada_en >= desde and v.anulada_en < hasta),
          'dejados_pasar', (select count(*) from public.ingresos i where i.registrado_por = e.id and i.resultado = 'forzado' and i.anulado_en is null and i.momento >= desde and i.momento < hasta),
          'entradas', (select count(*) from public.ingresos i where i.registrado_por = e.id and i.resultado <> 'rechazado' and i.anulado_en is null and i.momento >= desde and i.momento < hasta),
          'cierres', (select count(*) from public.turnos_caja tc where tc.cerrado_por = e.id and tc.cerrado_en >= desde and tc.cerrado_en < hasta),
          'diferencia_caja', (select coalesce(sum(tc.monto_contado - tc.monto_esperado), 0) from public.turnos_caja tc
                               where tc.cerrado_por = e.id and tc.cerrado_en >= desde and tc.cerrado_en < hasta and tc.monto_esperado is not null)) x
          from public.equipo e where e.gimnasio_id = p_gimnasio_id
      ) p(x)
      where (x ->> 'ventas')::int + (x ->> 'anulaciones')::int + (x ->> 'dejados_pasar')::int + (x ->> 'entradas')::int + (x ->> 'cierres')::int > 0), '[]'::jsonb),
    'para_mirar', coalesce((
      select jsonb_agg(m order by m ->> 'momento') from (
        select jsonb_build_object('tipo', 'descuento', 'momento', v.confirmada_en, 'quien', e.nombre, 'monto', vi.descuento,
                                  'detalle', vi.descripcion || ': ' || coalesce(vi.descuento_motivo, 'sin motivo')) m
          from public.ventas v join public.venta_items vi on vi.venta_id = v.id join public.equipo e on e.id = v.creado_por
         where v.gimnasio_id = p_gimnasio_id and v.estado = 'confirmada' and v.anulada_en is null and vi.descuento > 0
           and v.confirmada_en >= desde and v.confirmada_en < hasta
        union all
        select jsonb_build_object('tipo', 'anulacion', 'momento', v.anulada_en, 'quien', e.nombre,
                                  'monto', (select coalesce(sum(vi.cantidad * vi.precio_unitario - vi.descuento), 0) from public.venta_items vi where vi.venta_id = v.id),
                                  'detalle', coalesce(v.anulada_motivo, 'sin motivo'))
          from public.ventas v join public.equipo e on e.id = v.anulada_por
         where v.gimnasio_id = p_gimnasio_id and v.anulada_en >= desde and v.anulada_en < hasta
        union all
        select jsonb_build_object('tipo', 'dejo_pasar', 'momento', i.momento, 'quien', e.nombre, 'monto', null,
                                  'detalle', trim(s.nombre || ' ' || s.apellido) || ': ' || coalesce(i.forzado_motivo, 'sin motivo'))
          from public.ingresos i join public.equipo e on e.id = i.registrado_por join public.socios s on s.id = i.socio_id
         where i.gimnasio_id = p_gimnasio_id and i.resultado = 'forzado' and i.anulado_en is null and i.momento >= desde and i.momento < hasta
        union all
        select jsonb_build_object('tipo', 'caja', 'momento', tc.cerrado_en, 'quien', e.nombre, 'monto', tc.monto_contado - tc.monto_esperado,
                                  'detalle', c.nombre || coalesce(': ' || tc.nota, ''))
          from public.turnos_caja tc join public.equipo e on e.id = tc.cerrado_por join public.cajas c on c.id = tc.caja_id
         where tc.gimnasio_id = p_gimnasio_id and tc.cerrado_en >= desde and tc.cerrado_en < hasta
           and tc.monto_esperado is not null and tc.monto_contado <> tc.monto_esperado
      ) q(m)), '[]'::jsonb));
end $$;

revoke all on function public.actividad_equipo(uuid, date) from public, anon, authenticated;
grant execute on function public.actividad_equipo(uuid, date) to authenticated, service_role;

-- ── Verificación ────────────────────────────────────────────────────
do $$
begin
  if not exists (select 1 from pg_proc where oid = 'public.actividad_equipo(uuid, date)'::regprocedure and 'search_path=""' = any (proconfig)) then
    raise exception 'Verificación: actividad_equipo sin search_path vacío';
  end if;
  if has_function_privilege('anon', 'public.actividad_equipo(uuid, date)', 'execute') then raise exception 'Verificación: anon puede ver la actividad del equipo'; end if;
end $$;
