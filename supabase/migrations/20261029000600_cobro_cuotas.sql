-- ═══════════════════════════════════════════════════════════════════
-- 0006 · Cobrar cuotas: cómo un pago se convierte en cobertura.
--
-- La cobertura nace cuando la venta se CONFIRMA (la plata llegó), no
-- cuando se arma: en el mostrador es el mismo instante; con
-- transferencia, cuando alguien del equipo aprueba el comprobante; con
-- MercadoPago, cuando llega el webhook. Siempre por privado.confirmar_venta.
--
-- Precios: las filas de precios_plan con el mismo vigente_desde forman
-- una LISTA. Rige la última lista vigente; dentro de ella, la fila más
-- específica (sede, medio de pago, día del mes). Un aumento es una lista
-- nueva completa, así un descuento viejo no queda pegado al precio viejo.
-- ═══════════════════════════════════════════════════════════════════

do $$
begin
  if to_regprocedure('privado.calcular_acceso(uuid,timestamptz,uuid)') is null then
    raise exception 'Guarda: falta la migración 0005';
  end if;
end $$;

-- Ítem de cuota → a qué suscripción paga y cuántos períodos.
alter table public.venta_items add column if not exists suscripcion_id uuid;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'venta_items_suscripcion_fk') then
    alter table public.venta_items add constraint venta_items_suscripcion_fk
      foreign key (gimnasio_id, suscripcion_id) references public.suscripciones (gimnasio_id, id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'venta_items_cuota_con_suscripcion') then
    alter table public.venta_items add constraint venta_items_cuota_con_suscripcion
      check (tipo <> 'cuota' or suscripcion_id is not null) not valid;
    alter table public.venta_items validate constraint venta_items_cuota_con_suscripcion;
  end if;
end $$;

-- ── Precio ─────────────────────────────────────────────────────────
create or replace function privado.precio_para(
  p_plan_id uuid, p_momento timestamptz, p_medio text, p_sede_id uuid, p_aplicar_dia boolean
) returns numeric
language sql stable set search_path = '' as $$
  with lista as (
    select max(p.vigente_desde) as v from public.precios_plan p
     where p.plan_id = p_plan_id and p.vigente_desde <= p_momento
       and (p.sede_id is null or p.sede_id = p_sede_id)
  ), dia as (
    select extract(day from p_momento at time zone g.zona_horaria)::int as d
      from public.planes pl join public.gimnasios g on g.id = pl.gimnasio_id where pl.id = p_plan_id
  )
  select p.monto from public.precios_plan p, lista, dia
   where p.plan_id = p_plan_id and p.vigente_desde = lista.v
     and (p.sede_id is null or p.sede_id = p_sede_id)
     and (p.medio_pago is null or p.medio_pago = p_medio)
     and (p.pago_hasta_dia is null or (p_aplicar_dia and p.pago_hasta_dia >= dia.d))
   order by (p.sede_id is not null) desc, (p.medio_pago is not null) desc,
            (p.pago_hasta_dia is null), p.pago_hasta_dia
   limit 1
$$;
revoke all on function privado.precio_para(uuid, timestamptz, text, uuid, boolean) from public;

-- La deuda se calcula con el precio de lista (sin descuentos por medio ni por día).
create or replace function privado.precio_base(p_plan_id uuid, p_momento timestamptz) returns numeric
language sql stable set search_path = '' as $$
  select privado.precio_para(p_plan_id, p_momento, null, null, false)
$$;
revoke all on function privado.precio_base(uuid, timestamptz) from public;

-- Precio que ve la recepción antes de cobrar (con rol).
create or replace function public.precio_cuota(p_socio_id uuid, p_medio text, p_sede_id uuid default null)
returns numeric
language plpgsql stable security definer set search_path = '' as $$
declare s public.suscripciones; g uuid;
begin
  select gimnasio_id into g from public.socios where id = p_socio_id;
  if g is null or not (privado.es_servicio() or g in (select privado.mis_gimnasios(array['dueno','encargado','recepcion']))
                       or p_socio_id in (select privado.mis_socios())) then
    raise exception 'Sin permiso o socio inexistente' using errcode = '42501';
  end if;
  select * into s from public.suscripciones where socio_id = p_socio_id and baja_en is null;
  if not found then raise exception 'El socio no tiene una membresía activa'; end if;
  return privado.precio_para(s.plan_id, now(), p_medio, p_sede_id, true);
end $$;

-- ── Qué período cubre la próxima cuota ─────────────────────────────
-- Si hoy está cubierto: arranca donde termina la cadena (paga por adelantado).
-- Si no:
--   continua    → desde que venció (los días sin cubrir se cobran)
--   desde_pago  → desde hoy (los días sin cubrir se pierden)
--   dia_fijo    → desde el último "día X" que ya pasó
--   reinicio_tras_dias: si estuvo afuera más que eso, arranca hoy (como desde_pago)
-- Primera cuota: desde hoy (o desde el inicio de la suscripción si es futuro).
create or replace function privado.proximo_periodo(p_suscripcion_id uuid, p_momento timestamptz,
                                                   out p_desde timestamptz, out p_hasta timestamptz)
language plpgsql stable set search_path = '' as $$
declare
  s public.suscripciones; pl public.planes; zona text;
  fin timestamptz; ultimo timestamptz; hoy date; inicio date; d date;
begin
  select * into s from public.suscripciones where id = p_suscripcion_id;
  select * into pl from public.planes where id = s.plan_id;
  select g.zona_horaria into zona from public.gimnasios g where g.id = s.gimnasio_id;
  hoy := privado.dia_local(p_momento, zona);

  fin := privado.fin_cadena(s.id, p_momento);
  if fin is null then
    -- ¿hay coberturas futuras que arrancan después de hoy? se encadena al final
    select max(c.hasta) into fin from public.coberturas c
     where c.suscripcion_id = s.id and c.anulada_en is null and c.desde > p_momento;
  end if;

  if fin is not null then
    inicio := privado.dia_local(fin, zona);
  else
    select max(c.hasta) into ultimo from public.coberturas c
     where c.suscripcion_id = s.id and c.anulada_en is null and c.hasta <= p_momento;
    if ultimo is null then
      inicio := greatest(hoy, privado.dia_local(s.inicio, zona));
    elsif pl.reinicio_tras_dias is not null and hoy - privado.dia_local(ultimo, zona) >= pl.reinicio_tras_dias then
      inicio := hoy;
    elsif pl.renovacion = 'desde_pago' then
      inicio := hoy;
    elsif pl.renovacion = 'dia_fijo' then
      d := make_date(extract(year from hoy)::int, extract(month from hoy)::int, pl.dia_fijo);
      if d > hoy then d := (d - interval '1 month')::date; end if;
      inicio := greatest(d, privado.dia_local(ultimo, zona));
    else
      inicio := privado.dia_local(ultimo, zona);
    end if;
  end if;

  p_desde := privado.medianoche(inicio, zona);
  p_hasta := privado.medianoche((inicio + make_interval(months => pl.duracion_meses))::date, zona);
end $$;
revoke all on function privado.proximo_periodo(uuid, timestamptz) from public;

-- ── Confirmar una venta: genera lo que habilita ────────────────────
create or replace function privado.confirmar_venta(p_venta_id uuid, p_momento timestamptz) returns int
language plpgsql set search_path = '' as $$
declare
  v public.ventas; it public.venta_items; zona text; per record; pl public.planes;
  pagado numeric; total numeric; k int; generados int := 0; sus public.suscripciones;
begin
  select * into v from public.ventas where id = p_venta_id for update;
  if not found then raise exception 'Venta inexistente' using errcode = 'P0002'; end if;
  if v.estado <> 'pendiente' then raise exception 'La venta ya está %', v.estado; end if;

  select coalesce(sum(i.cantidad * i.precio_unitario - i.descuento), 0) into total from public.venta_items i where i.venta_id = v.id;
  select coalesce(sum(p.monto), 0) into pagado from public.pagos p where p.venta_id = v.id and p.estado = 'aprobado';
  if pagado < total then
    raise exception 'Falta cobrar: total %, aprobado %', privado.formato_pesos(total), privado.formato_pesos(pagado);
  end if;

  select g.zona_horaria into zona from public.gimnasios g where g.id = v.gimnasio_id;

  for it in select * from public.venta_items where venta_id = v.id order by id loop
    select * into pl from public.planes where id = it.plan_id;
    if it.tipo = 'cuota' then
      select * into sus from public.suscripciones where id = it.suscripcion_id for update;
      if sus.baja_en is not null then raise exception 'La suscripción está dada de baja'; end if;
      for k in 1 .. it.cantidad loop
        select * into per from privado.proximo_periodo(it.suscripcion_id, p_momento);
        insert into public.coberturas (gimnasio_id, suscripcion_id, socio_id, desde, hasta, origen, venta_item_id)
        values (v.gimnasio_id, sus.id, sus.socio_id, per.p_desde, per.p_hasta, 'pago', it.id);
        generados := generados + 1;
      end loop;
    elsif it.tipo = 'pase' then
      for k in 1 .. it.cantidad loop
        insert into public.pases_diarios (gimnasio_id, socio_id, plan_id, sede_id, desde, hasta, venta_item_id)
        values (v.gimnasio_id, v.socio_id, it.plan_id, v.sede_id,
                privado.medianoche(privado.dia_local(p_momento, zona), zona),
                privado.medianoche(privado.dia_local(p_momento, zona) + 1, zona), it.id);
        generados := generados + 1;
      end loop;
    elsif it.tipo = 'pack' then
      for k in 1 .. it.cantidad loop
        insert into public.packs (gimnasio_id, socio_id, plan_id, cantidad, desde, vence_en, venta_item_id)
        values (v.gimnasio_id, v.socio_id, it.plan_id, pl.cantidad_clases, p_momento,
                case when pl.validez_dias is not null
                     then privado.medianoche(privado.dia_local(p_momento, zona) + pl.validez_dias, zona) end, it.id);
        generados := generados + 1;
      end loop;
    end if;
  end loop;

  update public.ventas set estado = 'confirmada', confirmada_en = p_momento where id = v.id and estado = 'pendiente';
  get diagnostics k = row_count;
  if k <> 1 then raise exception 'No se pudo confirmar la venta'; end if;
  return generados;
end $$;
revoke all on function privado.confirmar_venta(uuid, timestamptz) from public;

-- ── Cobrar en el mostrador ─────────────────────────────────────────
-- Cuota(s) de la membresía activa, pagadas en el acto. MercadoPago no
-- pasa por acá: lo confirma el webhook.
create or replace function privado.cobrar_cuota(
  p_socio_id uuid, p_sede_id uuid, p_medio text, p_cuotas int, p_turno_caja_id uuid,
  p_cobrado_por uuid, p_momento timestamptz
) returns jsonb
language plpgsql set search_path = '' as $$
declare
  s public.suscripciones; pl public.planes; precio numeric; vid uuid; iid uuid; n int; tc public.turnos_caja;
begin
  if p_medio not in ('efectivo', 'transferencia', 'debito', 'credito') then
    raise exception 'Con % no se cobra en el mostrador: lo confirma el webhook', p_medio;
  end if;
  if p_cuotas is null or p_cuotas < 1 or p_cuotas > 12 then raise exception 'Cantidad de cuotas inválida'; end if;

  select * into s from public.suscripciones where socio_id = p_socio_id and baja_en is null for update;
  if not found then raise exception 'El socio no tiene una membresía activa'; end if;
  select * into pl from public.planes where id = s.plan_id;

  if p_medio = 'efectivo' then
    select t.* into tc from public.turnos_caja t join public.cajas c on c.id = t.caja_id
     where t.id = p_turno_caja_id and t.cerrado_en is null and c.sede_id = p_sede_id;
    if not found then raise exception 'Para cobrar en efectivo tiene que haber una caja abierta en esta sede'; end if;
  end if;

  precio := privado.precio_para(pl.id, p_momento, p_medio, p_sede_id, true);
  if precio is null then raise exception 'El plan % no tiene precio cargado', pl.nombre; end if;

  insert into public.ventas (gimnasio_id, sede_id, socio_id, estado, origen, turno_caja_id, creado_por, creado_en)
  values (s.gimnasio_id, p_sede_id, p_socio_id, 'pendiente', 'recepcion', p_turno_caja_id, p_cobrado_por, p_momento)
  returning id into vid;
  insert into public.venta_items (gimnasio_id, venta_id, tipo, plan_id, suscripcion_id, descripcion, cantidad, precio_unitario)
  values (s.gimnasio_id, vid, 'cuota', pl.id, s.id,
          case when p_cuotas = 1 then 'Cuota ' || pl.nombre else p_cuotas || ' cuotas ' || pl.nombre end,
          p_cuotas, precio)
  returning id into iid;
  insert into public.pagos (gimnasio_id, venta_id, medio, monto, estado, turno_caja_id, aprobado_en, aprobado_por, creado_por, creado_en)
  values (s.gimnasio_id, vid, p_medio, precio * p_cuotas, 'aprobado',
          case when p_medio = 'efectivo' then p_turno_caja_id end, p_momento, p_cobrado_por, p_cobrado_por, p_momento);

  n := privado.confirmar_venta(vid, p_momento);
  return jsonb_build_object('venta_id', vid, 'total', precio * p_cuotas, 'coberturas', n,
                            'veredicto', to_jsonb(privado.calcular_acceso(p_socio_id, p_momento, p_sede_id)));
end $$;
revoke all on function privado.cobrar_cuota(uuid, uuid, text, int, uuid, uuid, timestamptz) from public;

-- ── Anular una venta: revierte todo lo que habilitó ────────────────
create or replace function privado.anular_venta(p_venta_id uuid, p_motivo text, p_anulado_por uuid) returns void
language plpgsql set search_path = '' as $$
declare v public.ventas; n int;
begin
  if length(trim(coalesce(p_motivo, ''))) = 0 then raise exception 'El motivo es obligatorio'; end if;
  select * into v from public.ventas where id = p_venta_id for update;
  if not found then raise exception 'Venta inexistente' using errcode = 'P0002'; end if;
  if v.estado = 'anulada' then raise exception 'La venta ya estaba anulada'; end if;
  update public.ventas set estado = 'anulada', anulada_en = now(), anulada_por = p_anulado_por, anulada_motivo = trim(p_motivo)
   where id = v.id;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'No se anuló la venta'; end if;
  update public.pagos set estado = 'anulado' where venta_id = v.id and estado <> 'anulado';
  update public.coberturas set anulada_en = now(), anulada_motivo = 'Venta anulada: ' || trim(p_motivo)
   where venta_item_id in (select id from public.venta_items where venta_id = v.id) and anulada_en is null;
  update public.pases_diarios set anulado_en = now()
   where venta_item_id in (select id from public.venta_items where venta_id = v.id) and anulado_en is null;
  update public.packs set anulado_en = now()
   where venta_item_id in (select id from public.venta_items where venta_id = v.id) and anulado_en is null;
end $$;
revoke all on function privado.anular_venta(uuid, text, uuid) from public;

-- ── API pública ────────────────────────────────────────────────────
create or replace function public.cobrar_cuota(
  p_socio_id uuid, p_sede_id uuid, p_medio text, p_cuotas int default 1, p_turno_caja_id uuid default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare g uuid; eid uuid;
begin
  select gimnasio_id into g from public.socios where id = p_socio_id;
  if g is null then raise exception 'Sin permiso o socio inexistente' using errcode = '42501'; end if;
  eid := privado.exigir_rol(g, array['dueno', 'encargado', 'recepcion']);
  return privado.cobrar_cuota(p_socio_id, p_sede_id, p_medio, p_cuotas, p_turno_caja_id, eid, now());
end $$;

-- Anular toca plata: solo dueño o encargado.
create or replace function public.anular_venta(p_venta_id uuid, p_motivo text) returns void
language plpgsql security definer set search_path = '' as $$
declare g uuid; eid uuid;
begin
  select gimnasio_id into g from public.ventas where id = p_venta_id;
  if g is null then raise exception 'Sin permiso o venta inexistente' using errcode = '42501'; end if;
  eid := privado.exigir_rol(g, array['dueno', 'encargado']);
  perform privado.anular_venta(p_venta_id, p_motivo, eid);
end $$;

revoke all on function public.precio_cuota(uuid, text, uuid), public.cobrar_cuota(uuid, uuid, text, int, uuid),
  public.anular_venta(uuid, text) from public, anon, authenticated;
grant execute on function public.precio_cuota(uuid, text, uuid), public.cobrar_cuota(uuid, uuid, text, int, uuid),
  public.anular_venta(uuid, text) to authenticated, service_role;

do $$
begin
  if has_function_privilege('anon', 'public.cobrar_cuota(uuid, uuid, text, int, uuid)', 'execute') then
    raise exception 'Verificación: anon puede cobrar';
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public'
                  and table_name = 'venta_items' and column_name = 'suscripcion_id') then
    raise exception 'Verificación: falta venta_items.suscripcion_id';
  end if;
end $$;
