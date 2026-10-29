-- ═══════════════════════════════════════════════════════════════════
-- 0007 · Cobrar cuotas y administrar la membresía.
--
-- La cobertura nace cuando la venta se CONFIRMA (la plata llegó): en el
-- mostrador es el mismo instante; con transferencia, cuando alguien del
-- equipo aprueba el comprobante; con MercadoPago, cuando llega el
-- webhook. Siempre por privado.confirmar_venta.
-- Los períodos salen de privado.proximo_periodo (0005): la deuda que ve
-- la recepción es exactamente lo que se cobra.
-- ═══════════════════════════════════════════════════════════════════

do $$
begin
  if to_regprocedure('privado.calcular_acceso(uuid,timestamptz,uuid)') is null then
    raise exception 'Guarda: falta la migración 0006';
  end if;
end $$;

-- Ítem de cuota → a qué suscripción paga.
alter table public.venta_items add column if not exists suscripcion_id uuid;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'venta_items_suscripcion_fk') then
    alter table public.venta_items add constraint venta_items_suscripcion_fk
      foreign key (gimnasio_id, suscripcion_id) references public.suscripciones (gimnasio_id, id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'venta_items_cuota_con_suscripcion') then
    alter table public.venta_items add constraint venta_items_cuota_con_suscripcion
      check (tipo <> 'cuota' or suscripcion_id is not null);
  end if;
end $$;

-- Precio que ve la recepción antes de cobrar.
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

-- ── Confirmar una venta: genera lo que habilita ────────────────────
create or replace function privado.confirmar_venta(p_venta_id uuid, p_momento timestamptz) returns int
language plpgsql set search_path = '' as $$
declare
  v public.ventas; it public.venta_items; zona text; per record; pl public.planes; sus public.suscripciones;
  pagado numeric; total numeric; k int; n int; generados int := 0;
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
    if it.tipo in ('cuota', 'pase', 'pack') and v.socio_id is null then
      raise exception 'Una venta de cuota, pase o pack necesita un socio';
    end if;
    if it.tipo = 'cuota' then
      select * into sus from public.suscripciones where id = it.suscripcion_id for update;
      if sus.socio_id <> v.socio_id then raise exception 'La cuota es de una membresía de otro socio'; end if;
      if sus.plan_id <> it.plan_id then raise exception 'La cuota es de un plan distinto al de la membresía'; end if;
      if sus.baja_en is not null then raise exception 'La membresía está dada de baja'; end if;
      for k in 1 .. it.cantidad loop
        select * into per from privado.proximo_periodo(sus.id, p_momento);
        insert into public.coberturas (gimnasio_id, suscripcion_id, socio_id, desde, hasta, origen, ancla_dia, venta_item_id)
        values (v.gimnasio_id, sus.id, sus.socio_id, per.p_desde, per.p_hasta, 'pago', per.p_ancla, it.id);
        generados := generados + 1;
      end loop;
    elsif it.tipo = 'pase' then
      if pl.tipo <> 'pase_diario' then raise exception 'El ítem de pase apunta a un plan que no es pase diario'; end if;
      for k in 1 .. it.cantidad loop
        insert into public.pases_diarios (gimnasio_id, socio_id, plan_id, sede_id, desde, hasta, venta_item_id)
        values (v.gimnasio_id, v.socio_id, it.plan_id, v.sede_id,
                privado.medianoche(privado.dia_local(p_momento, zona) + (k - 1), zona),
                privado.medianoche(privado.dia_local(p_momento, zona) + k, zona), it.id);
        generados := generados + 1;
      end loop;
    elsif it.tipo = 'pack' then
      if pl.tipo <> 'pack' then raise exception 'El ítem de pack apunta a un plan que no es pack'; end if;
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
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'No se pudo confirmar la venta'; end if;
  return generados;
end $$;
revoke all on function privado.confirmar_venta(uuid, timestamptz) from public;

-- ── Cobrar en el mostrador ─────────────────────────────────────────
create or replace function privado.cobrar_cuota(
  p_socio_id uuid, p_sede_id uuid, p_medio text, p_cuotas int, p_turno_caja_id uuid,
  p_cobrado_por uuid, p_momento timestamptz
) returns jsonb
language plpgsql set search_path = '' as $$
declare
  s public.suscripciones; pl public.planes; precio numeric; vid uuid; n int; tc public.turnos_caja;
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
          p_cuotas, precio);
  insert into public.pagos (gimnasio_id, venta_id, medio, monto, estado, turno_caja_id, aprobado_en, aprobado_por, creado_por, creado_en)
  values (s.gimnasio_id, vid, p_medio, precio * p_cuotas, 'aprobado',
          case when p_medio = 'efectivo' then p_turno_caja_id end, p_momento, p_cobrado_por, p_cobrado_por, p_momento);

  n := privado.confirmar_venta(vid, p_momento);
  return jsonb_build_object('venta_id', vid, 'total', precio * p_cuotas, 'coberturas', n,
                            'veredicto', to_jsonb(privado.calcular_acceso(p_socio_id, p_momento, p_sede_id)));
end $$;
revoke all on function privado.cobrar_cuota(uuid, uuid, text, int, uuid, uuid, timestamptz) from public;

-- ── Anular una venta: revierte todo lo que habilitó ────────────────
-- Las compensaciones se recalculan solas (trigger) al anular las coberturas.
create or replace function privado.anular_venta(p_venta_id uuid, p_motivo text, p_equipo_id uuid, p_usuario uuid) returns void
language plpgsql set search_path = '' as $$
declare v public.ventas; n int; esperados int;
begin
  if length(trim(coalesce(p_motivo, ''))) = 0 then raise exception 'El motivo es obligatorio'; end if;
  select * into v from public.ventas where id = p_venta_id for update;
  if not found then raise exception 'Venta inexistente' using errcode = 'P0002'; end if;
  if v.estado = 'anulada' then raise exception 'La venta ya estaba anulada'; end if;

  update public.ventas set estado = 'anulada', anulada_en = now(), anulada_por = p_equipo_id, anulada_motivo = trim(p_motivo)
   where id = v.id and estado <> 'anulada';
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'No se anuló la venta'; end if;

  select count(*) into esperados from public.pagos where venta_id = v.id and estado <> 'anulado';
  update public.pagos set estado = 'anulado' where venta_id = v.id and estado <> 'anulado';
  get diagnostics n = row_count;
  if n <> esperados then raise exception 'No se anularon todos los pagos'; end if;

  select count(*) into esperados from public.coberturas
   where venta_item_id in (select id from public.venta_items where venta_id = v.id) and anulada_en is null;
  update public.coberturas set anulada_en = now(), anulada_por = p_usuario, anulada_motivo = 'Venta anulada: ' || trim(p_motivo)
   where venta_item_id in (select id from public.venta_items where venta_id = v.id) and anulada_en is null;
  get diagnostics n = row_count;
  if n <> esperados then raise exception 'No se anularon todas las coberturas'; end if;

  update public.pases_diarios set anulado_en = now()
   where venta_item_id in (select id from public.venta_items where venta_id = v.id) and anulado_en is null;
  update public.packs set anulado_en = now()
   where venta_item_id in (select id from public.venta_items where venta_id = v.id) and anulado_en is null;
end $$;
revoke all on function privado.anular_venta(uuid, text, uuid, uuid) from public;

-- ── Membresía: alta, cambio de plan, baja ──────────────────────────
create or replace function privado.asignar_plan(p_socio_id uuid, p_plan_id uuid, p_momento timestamptz, p_usuario uuid) returns uuid
language plpgsql set search_path = '' as $$
declare so public.socios; sid uuid;
begin
  select * into so from public.socios where id = p_socio_id for update;
  if not found then raise exception 'Socio inexistente' using errcode = 'P0002'; end if;
  if exists (select 1 from public.suscripciones where socio_id = so.id and baja_en is null) then
    raise exception 'El socio ya tiene una membresía activa: usá cambiar de plan';
  end if;
  insert into public.suscripciones (gimnasio_id, socio_id, plan_id, inicio, creado_por)
  values (so.gimnasio_id, so.id, p_plan_id, p_momento, p_usuario) returning id into sid;
  return sid;
end $$;

-- Lo que ya pagó del plan viejo pasa al nuevo (cobertura 'traspaso').
-- La diferencia de precio todavía no se cobra ni se devuelve (prorrateo: v1.5).
create or replace function privado.cambiar_plan(p_socio_id uuid, p_plan_id uuid, p_momento timestamptz, p_usuario uuid) returns uuid
language plpgsql set search_path = '' as $$
declare vieja public.suscripciones; pv public.planes; pn public.planes; zona text; fin timestamptz; sid uuid; ancla int;
begin
  select * into vieja from public.suscripciones where socio_id = p_socio_id and baja_en is null for update;
  if not found then raise exception 'El socio no tiene una membresía activa'; end if;
  if vieja.plan_id = p_plan_id then raise exception 'Ya está en ese plan'; end if;
  if exists (select 1 from public.congelamientos c where c.suscripcion_id = vieja.id and c.anulado_en is null
              and coalesce(c.hasta_real, c.hasta_prevista) > p_momento) then
    raise exception 'Tiene un congelamiento en curso o programado: resolvelo antes de cambiar de plan';
  end if;
  select * into pv from public.planes where id = vieja.plan_id;
  select * into pn from public.planes where id = p_plan_id;
  select zona_horaria into zona from public.gimnasios where id = vieja.gimnasio_id;

  select max(c.hasta) into fin from public.coberturas c
   where c.suscripcion_id = vieja.id and c.anulada_en is null and c.hasta > p_momento;
  select c.ancla_dia into ancla from public.coberturas c
   where c.suscripcion_id = vieja.id and c.anulada_en is null and c.origen <> 'compensacion'
   order by c.hasta desc limit 1;

  update public.suscripciones set baja_en = p_momento, motivo_baja = 'Cambio a ' || pn.nombre where id = vieja.id;
  insert into public.suscripciones (gimnasio_id, socio_id, plan_id, inicio, creado_por)
  values (vieja.gimnasio_id, p_socio_id, p_plan_id, p_momento, p_usuario) returning id into sid;

  if fin is not null then
    insert into public.coberturas (gimnasio_id, suscripcion_id, socio_id, desde, hasta, origen, ancla_dia, motivo, creado_por)
    values (vieja.gimnasio_id, sid, p_socio_id, privado.medianoche(privado.dia_local(p_momento, zona), zona), fin,
            'traspaso', ancla, 'Traspaso desde ' || pv.nombre, p_usuario);
  end if;
  return sid;
end $$;

create or replace function privado.dar_de_baja(p_socio_id uuid, p_motivo text, p_momento timestamptz) returns void
language plpgsql set search_path = '' as $$
declare n int;
begin
  update public.socios set dado_de_baja_en = p_momento, motivo_baja = p_motivo
   where id = p_socio_id and dado_de_baja_en is null;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'El socio no existe o ya estaba dado de baja'; end if;
  update public.suscripciones set baja_en = p_momento, motivo_baja = 'Baja del socio: ' || p_motivo
   where socio_id = p_socio_id and baja_en is null;
end $$;
revoke all on function privado.asignar_plan(uuid, uuid, timestamptz, uuid), privado.cambiar_plan(uuid, uuid, timestamptz, uuid),
  privado.dar_de_baja(uuid, text, timestamptz) from public;

-- ── API pública ────────────────────────────────────────────────────
create or replace function public.cobrar_cuota(
  p_socio_id uuid, p_sede_id uuid, p_medio text, p_cuotas int default 1, p_turno_caja_id uuid default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare g uuid; eid uuid;
begin
  select gimnasio_id into g from public.socios where id = p_socio_id;
  if g is null then raise exception 'Sin permiso o socio inexistente' using errcode = '42501'; end if;
  eid := privado.exigir_rol(g, array['dueno', 'encargado', 'recepcion'], p_sede_id);
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
  perform privado.anular_venta(p_venta_id, p_motivo, eid, auth.uid());
end $$;

create or replace function public.asignar_plan(p_socio_id uuid, p_plan_id uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare g uuid;
begin
  select gimnasio_id into g from public.socios where id = p_socio_id;
  if g is null then raise exception 'Sin permiso o socio inexistente' using errcode = '42501'; end if;
  perform privado.exigir_rol(g, array['dueno', 'encargado', 'recepcion']);
  return privado.asignar_plan(p_socio_id, p_plan_id, now(), auth.uid());
end $$;

create or replace function public.cambiar_plan(p_socio_id uuid, p_plan_id uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare g uuid;
begin
  select gimnasio_id into g from public.socios where id = p_socio_id;
  if g is null then raise exception 'Sin permiso o socio inexistente' using errcode = '42501'; end if;
  perform privado.exigir_rol(g, array['dueno', 'encargado', 'recepcion']);
  return privado.cambiar_plan(p_socio_id, p_plan_id, now(), auth.uid());
end $$;

create or replace function public.dar_de_baja(p_socio_id uuid, p_motivo text) returns void
language plpgsql security definer set search_path = '' as $$
declare g uuid;
begin
  select gimnasio_id into g from public.socios where id = p_socio_id;
  if g is null then raise exception 'Sin permiso o socio inexistente' using errcode = '42501'; end if;
  perform privado.exigir_rol(g, array['dueno', 'encargado', 'recepcion']);
  perform privado.dar_de_baja(p_socio_id, p_motivo, now());
end $$;

revoke all on function public.precio_cuota(uuid, text, uuid), public.cobrar_cuota(uuid, uuid, text, int, uuid),
  public.anular_venta(uuid, text), public.asignar_plan(uuid, uuid), public.cambiar_plan(uuid, uuid),
  public.dar_de_baja(uuid, text) from public, anon, authenticated;
grant execute on function public.precio_cuota(uuid, text, uuid), public.cobrar_cuota(uuid, uuid, text, int, uuid),
  public.anular_venta(uuid, text), public.asignar_plan(uuid, uuid), public.cambiar_plan(uuid, uuid),
  public.dar_de_baja(uuid, text) to authenticated, service_role;

-- TRUNCATE saltea RLS y los triggers por fila: nadie del lado del cliente lo tiene.
revoke truncate, references, trigger on all tables in schema public from anon, authenticated;

do $$
begin
  if has_function_privilege('anon', 'public.cobrar_cuota(uuid, uuid, text, int, uuid)', 'execute') then
    raise exception 'Verificación: anon puede cobrar';
  end if;
  if exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
              where n.nspname = 'public' and c.relkind = 'r'
                and (has_table_privilege('anon', c.oid, 'TRUNCATE') or has_table_privilege('authenticated', c.oid, 'TRUNCATE'))) then
    raise exception 'Verificación: anon o authenticated conservan TRUNCATE';
  end if;
end $$;
