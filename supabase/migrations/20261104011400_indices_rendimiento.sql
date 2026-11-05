-- 0114 · Índices para 3.000 socios (SEG-4).
-- Medido con 3.000 socios (scripts/medir-rendimiento.mjs): el cálculo de
-- acceso y la retención buscan por socio o por venta sin el gimnasio adelante,
-- y esos índices empezaban por gimnasio_id (o no existían). Solo índices: no
-- cambia ningún resultado.

-- ── Guarda de entrada ───────────────────────────────────────────────
do $$
begin
  if to_regprocedure('public.exportar_gimnasio(uuid, text)') is null then raise exception 'Guarda: falta la migración 0113'; end if;
end $$;

create index if not exists ingresos_por_socio on public.ingresos (socio_id, momento desc);
create index if not exists pagos_por_venta on public.pagos (venta_id);
create index if not exists venta_items_por_venta on public.venta_items (venta_id);
create index if not exists ventas_por_socio on public.ventas (socio_id, creado_en desc);
create index if not exists coberturas_por_socio on public.coberturas (socio_id, hasta desc) where anulada_en is null;
create index if not exists suscripciones_por_socio on public.suscripciones (socio_id) where baja_en is null;
create index if not exists packs_por_socio on public.packs (socio_id, desde desc);
create index if not exists pases_por_socio on public.pases_diarios (socio_id, desde desc);
create index if not exists asistencias_por_socio on public.asistencias (socio_id, clase_id) where anulada_en is null;
create index if not exists reservas_por_socio on public.reservas (socio_id, clase_id) where estado <> 'cancelada';
create index if not exists consumos_por_socio on public.consumos_pack (socio_id, momento) where anulado_en is null;
create index if not exists contactos_por_socio on public.contactos_retencion (socio_id, creado_en desc);
create index if not exists congelamientos_por_socio on public.congelamientos (socio_id, desde);

-- ── Verificación ────────────────────────────────────────────────────
do $$
begin
  if (select count(*) from pg_indexes where schemaname = 'public' and indexname in ('ingresos_por_socio', 'pagos_por_venta', 'venta_items_por_venta',
      'ventas_por_socio', 'coberturas_por_socio', 'suscripciones_por_socio', 'packs_por_socio', 'pases_por_socio', 'asistencias_por_socio',
      'reservas_por_socio', 'consumos_por_socio', 'contactos_por_socio', 'congelamientos_por_socio')) <> 13 then
    raise exception 'Verificación: faltan índices';
  end if;
end $$;
