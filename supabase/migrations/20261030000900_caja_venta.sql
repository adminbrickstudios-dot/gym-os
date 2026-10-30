-- ═══════════════════════════════════════════════════════════════════
-- 0009 · Caja, carrito del mostrador y comprobante de transferencia.
--
-- Caja por turno: se abre con un monto, se cierra contando la plata.
-- Lo esperado (inicial + efectivo cobrado + ingresos − retiros) se
-- calcula; al cerrar queda la foto de lo esperado y la diferencia.
--
-- Vender: un carrito con cuotas, pases, packs, productos y otros, y uno
-- o más pagos (efectivo + transferencia, por ejemplo). Los precios de
-- los planes y productos los pone la base, nunca el navegador.
--
-- Transferencia del socio: sube el comprobante desde la app, la venta
-- queda pendiente, y alguien del equipo la aprueba o la rechaza.
-- ═══════════════════════════════════════════════════════════════════

do $$
begin
  if to_regprocedure('privado.confirmar_venta(uuid,timestamptz)') is null then
    raise exception 'Guarda: falta la migración 0007';
  end if;
end $$;

-- ── Columnas nuevas ────────────────────────────────────────────────
alter table public.turnos_caja add column if not exists monto_esperado numeric(12,2);
alter table public.pagos add column if not exists rechazado_en timestamptz;
alter table public.pagos add column if not exists rechazado_por uuid;
alter table public.pagos add column if not exists rechazado_motivo text;
alter table public.configuracion_gimnasio add column if not exists descuento_max_recepcion numeric(5,2) not null default 10
  check (descuento_max_recepcion between 0 and 100);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'turnos_caja_esperado_al_cerrar') then
    alter table public.turnos_caja add constraint turnos_caja_esperado_al_cerrar
      check ((cerrado_en is null) = (monto_esperado is null));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'pagos_rechazado_por_fk') then
    alter table public.pagos add constraint pagos_rechazado_por_fk
      foreign key (gimnasio_id, rechazado_por) references public.equipo (gimnasio_id, id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'pagos_rechazo_completo') then
    alter table public.pagos add constraint pagos_rechazo_completo
      check ((estado = 'rechazado') = (rechazado_en is not null)
             and (rechazado_en is null or length(trim(coalesce(rechazado_motivo, ''))) > 0));
  end if;
end $$;

-- Un solo comprobante pendiente por venta.
create unique index if not exists pagos_un_pendiente_por_venta on public.pagos (gimnasio_id, venta_id) where estado = 'pendiente';

-- ── Productos (agua, shakes, remeras) ──────────────────────────────
-- El stock es v1.5: hoy solo nombre y precio.
create table if not exists public.productos (
  id           uuid primary key default gen_random_uuid(),
  gimnasio_id  uuid not null references public.gimnasios(id),
  nombre       text not null check (length(trim(nombre)) > 0),
  precio       numeric(12,2) not null check (precio >= 0),
  activo       boolean not null default true,
  orden        int not null default 0,
  creado_en    timestamptz not null default now(),
  unique (gimnasio_id, id),
  unique (gimnasio_id, nombre)
);
select privado.politicas_estandar('public.productos', null, array['dueno', 'encargado']);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'venta_items_producto_fk') then
    alter table public.venta_items add constraint venta_items_producto_fk
      foreign key (gimnasio_id, producto_id) references public.productos (gimnasio_id, id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'venta_items_producto_con_id') then
    alter table public.venta_items add constraint venta_items_producto_con_id
      check (tipo <> 'producto' or producto_id is not null);
  end if;
end $$;

-- ═══ Caja ══════════════════════════════════════════════════════════

-- Lo que debería haber en el cajón ahora: se calcula, nunca se guarda
-- mientras el turno está abierto.
create or replace function privado.resumen_turno(p_turno_id uuid) returns jsonb
language sql stable set search_path = '' as $$
  with t as (select * from public.turnos_caja where id = p_turno_id),
  pagos as (
    select p.medio, sum(p.monto) as total, count(*) as cantidad
      from public.pagos p
     where p.turno_caja_id = p_turno_id and p.estado = 'aprobado'
     group by p.medio
  ), pagos_mostrador as (
    -- lo cobrado en este turno con otros medios (no entra al cajón, pero se informa)
    select p.medio, sum(p.monto) as total, count(*) as cantidad
      from public.pagos p join public.ventas v on v.id = p.venta_id
     where v.turno_caja_id = p_turno_id and p.turno_caja_id is null and p.estado = 'aprobado'
     group by p.medio
  ), mov as (
    select coalesce(sum(m.monto) filter (where m.tipo = 'ingreso'), 0) as ingresos,
           coalesce(sum(m.monto) filter (where m.tipo = 'retiro'), 0) as retiros
      from public.movimientos_caja m where m.turno_caja_id = p_turno_id
  )
  select jsonb_build_object(
    'turno_id', t.id,
    'abierto_en', t.abierto_en,
    'cerrado_en', t.cerrado_en,
    'monto_inicial', t.monto_inicial,
    'efectivo', coalesce((select total from pagos where medio = 'efectivo'), 0),
    'ingresos', mov.ingresos,
    'retiros', mov.retiros,
    'esperado', t.monto_inicial + coalesce((select total from pagos where medio = 'efectivo'), 0) + mov.ingresos - mov.retiros,
    'contado', t.monto_contado,
    'diferencia', case when t.monto_contado is not null then t.monto_contado - t.monto_esperado end,
    'otros_medios', coalesce((select jsonb_object_agg(medio, total) from pagos_mostrador), '{}'::jsonb)
  )
  from t, mov
$$;
revoke all on function privado.resumen_turno(uuid) from public;

create or replace function public.abrir_caja(p_caja_id uuid, p_monto_inicial numeric) returns uuid
language plpgsql security definer set search_path = '' as $$
declare c public.cajas; eid uuid; tid uuid;
begin
  select * into c from public.cajas where id = p_caja_id;
  if not found then raise exception 'Sin permiso o caja inexistente' using errcode = '42501'; end if;
  eid := privado.exigir_rol(c.gimnasio_id, array['dueno', 'encargado', 'recepcion'], c.sede_id);
  if not c.activa then raise exception 'La caja % está desactivada', c.nombre; end if;
  if p_monto_inicial is null or p_monto_inicial < 0 then raise exception 'El monto inicial no puede ser negativo'; end if;
  perform pg_advisory_xact_lock(hashtextextended('gymos:caja:' || c.id::text, 0));
  if exists (select 1 from public.turnos_caja where caja_id = c.id and cerrado_en is null) then
    raise exception 'La caja % ya está abierta', c.nombre;
  end if;
  insert into public.turnos_caja (gimnasio_id, caja_id, abierto_por, monto_inicial)
  values (c.gimnasio_id, c.id, eid, round(p_monto_inicial, 2)) returning id into tid;
  return tid;
end $$;

-- Arqueo ciego: quien cierra informa lo que contó y recién ahí ve lo
-- esperado y la diferencia. (La recepción igual puede leer los pagos del
-- día en su historial: el "ciego" es de la pantalla de cierre.)
create or replace function public.cerrar_caja(p_turno_id uuid, p_monto_contado numeric, p_nota text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare t public.turnos_caja; c public.cajas; eid uuid; r jsonb; n int;
begin
  select * into t from public.turnos_caja where id = p_turno_id for update;
  if not found then raise exception 'Sin permiso o turno inexistente' using errcode = '42501'; end if;
  select * into c from public.cajas where id = t.caja_id;
  eid := privado.exigir_rol(t.gimnasio_id, array['dueno', 'encargado', 'recepcion'], c.sede_id);
  if t.cerrado_en is not null then raise exception 'El turno ya estaba cerrado'; end if;
  if p_monto_contado is null or p_monto_contado < 0 then raise exception 'El monto contado no puede ser negativo'; end if;
  r := privado.resumen_turno(t.id);
  update public.turnos_caja
     set cerrado_en = now(), cerrado_por = eid, monto_contado = round(p_monto_contado, 2),
         monto_esperado = (r ->> 'esperado')::numeric, nota = nullif(trim(coalesce(p_nota, '')), '')
   where id = t.id and cerrado_en is null;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'No se pudo cerrar el turno'; end if;
  return privado.resumen_turno(t.id);
end $$;

-- Ver lo esperado con el turno abierto: solo dueño o encargado.
create or replace function public.resumen_caja(p_turno_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare t public.turnos_caja; c public.cajas;
begin
  select * into t from public.turnos_caja where id = p_turno_id;
  if not found then raise exception 'Sin permiso o turno inexistente' using errcode = '42501'; end if;
  select * into c from public.cajas where id = t.caja_id;
  if t.cerrado_en is null then
    perform privado.exigir_rol(t.gimnasio_id, array['dueno', 'encargado'], c.sede_id);
  else
    perform privado.exigir_rol(t.gimnasio_id, array['dueno', 'encargado', 'recepcion'], c.sede_id);
  end if;
  return privado.resumen_turno(t.id);
end $$;

create or replace function public.movimiento_caja(p_turno_id uuid, p_tipo text, p_monto numeric, p_motivo text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare t public.turnos_caja; c public.cajas; eid uuid; mid uuid;
begin
  select * into t from public.turnos_caja where id = p_turno_id for update;
  if not found then raise exception 'Sin permiso o turno inexistente' using errcode = '42501'; end if;
  select * into c from public.cajas where id = t.caja_id;
  eid := privado.exigir_rol(t.gimnasio_id, array['dueno', 'encargado', 'recepcion'], c.sede_id);
  if t.cerrado_en is not null then raise exception 'El turno está cerrado'; end if;
  if p_monto is null or p_monto <= 0 then raise exception 'El monto tiene que ser mayor a cero'; end if;
  if length(trim(coalesce(p_motivo, ''))) = 0 then raise exception 'El motivo es obligatorio'; end if;
  insert into public.movimientos_caja (gimnasio_id, turno_caja_id, tipo, monto, motivo, creado_por)
  values (t.gimnasio_id, t.id, p_tipo, round(p_monto, 2), trim(p_motivo), eid) returning id into mid;
  return mid;
end $$;

-- ═══ Vender (carrito) ══════════════════════════════════════════════
-- p_items: [{"tipo": "cuota"|"pase"|"pack"|"producto"|"otro",
--            "plan_id"?, "producto_id"?, "cantidad"?, "descuento"?,
--            "descuento_motivo"?, "descripcion"?, "precio_unitario"? (solo "otro")}]
-- p_pagos: [{"medio": "efectivo"|"transferencia"|"debito"|"credito", "monto"}]
-- La suma de los pagos tiene que ser exactamente el total (el vuelto
-- lo maneja la pantalla, no la base).
create or replace function privado.vender(
  p_gimnasio_id uuid, p_sede_id uuid, p_socio_id uuid, p_items jsonb, p_pagos jsonb,
  p_turno_id uuid, p_equipo_id uuid, p_tope_descuento numeric, p_momento timestamptz
) returns jsonb
language plpgsql set search_path = '' as $$
declare
  it jsonb; pg jsonb; vid uuid; total numeric := 0; pagado numeric := 0; generados int;
  medio_unico text; tipo text; cant int; precio numeric; desc_ numeric; pl public.planes; pr public.productos;
  sus public.suscripciones; descripcion text; subtotal numeric; medios text[];
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'El carrito está vacío';
  end if;
  if p_pagos is null or jsonb_typeof(p_pagos) <> 'array' or jsonb_array_length(p_pagos) = 0 then
    raise exception 'Falta el pago';
  end if;
  if p_socio_id is not null and not exists (select 1 from public.socios where id = p_socio_id and gimnasio_id = p_gimnasio_id) then
    raise exception 'El socio no es de este gimnasio';
  end if;
  if not exists (select 1 from public.sedes where id = p_sede_id and gimnasio_id = p_gimnasio_id) then
    raise exception 'La sede no es de este gimnasio';
  end if;

  select array_agg(distinct x ->> 'medio') into medios from jsonb_array_elements(p_pagos) x;
  if exists (select 1 from unnest(medios) m where m is null or m not in ('efectivo', 'transferencia', 'debito', 'credito')) then
    raise exception 'Medio de pago no válido en el mostrador (MercadoPago lo confirma el webhook)';
  end if;
  medio_unico := case when cardinality(medios) = 1 then medios[1] end;  -- con pago mixto rige el precio de lista

  if 'efectivo' = any (medios) and not exists (
       select 1 from public.turnos_caja t join public.cajas c on c.id = t.caja_id
        where t.id = p_turno_id and t.cerrado_en is null and c.sede_id = p_sede_id) then
    raise exception 'Para cobrar en efectivo tiene que haber una caja abierta en esta sede';
  end if;

  insert into public.ventas (gimnasio_id, sede_id, socio_id, estado, origen, turno_caja_id, creado_por, creado_en)
  values (p_gimnasio_id, p_sede_id, p_socio_id, 'pendiente', 'recepcion', p_turno_id, p_equipo_id, p_momento)
  returning id into vid;

  for it in select * from jsonb_array_elements(p_items) loop
    tipo := it ->> 'tipo';
    cant := coalesce((it ->> 'cantidad')::int, 1);
    if cant < 1 or cant > 50 then raise exception 'Cantidad inválida en el carrito'; end if;
    desc_ := round(coalesce((it ->> 'descuento')::numeric, 0), 2);
    if desc_ < 0 then raise exception 'El descuento no puede ser negativo'; end if;
    pl := null; pr := null; sus := null;

    if tipo = 'cuota' then
      if p_socio_id is null then raise exception 'Una cuota necesita un socio'; end if;
      select * into sus from public.suscripciones where socio_id = p_socio_id and baja_en is null;
      if not found then raise exception 'El socio no tiene una membresía activa'; end if;
      select * into pl from public.planes where id = sus.plan_id;
      descripcion := case when cant = 1 then 'Cuota ' || pl.nombre else cant || ' cuotas ' || pl.nombre end;
    elsif tipo in ('pase', 'pack') then
      if p_socio_id is null then raise exception 'Un pase o un pack necesita un socio (cargalo con el alta rápida)'; end if;
      select * into pl from public.planes where id = (it ->> 'plan_id')::uuid and gimnasio_id = p_gimnasio_id and activo;
      if not found then raise exception 'Plan inexistente o inactivo'; end if;
      if (tipo = 'pase' and pl.tipo <> 'pase_diario') or (tipo = 'pack' and pl.tipo <> 'pack') then
        raise exception 'El plan % no es un %', pl.nombre, tipo;
      end if;
      descripcion := case when cant = 1 then pl.nombre else cant || ' × ' || pl.nombre end;
    elsif tipo = 'producto' then
      select * into pr from public.productos where id = (it ->> 'producto_id')::uuid and gimnasio_id = p_gimnasio_id and activo;
      if not found then raise exception 'Producto inexistente o inactivo'; end if;
      descripcion := case when cant = 1 then pr.nombre else cant || ' × ' || pr.nombre end;
    elsif tipo = 'otro' then
      descripcion := nullif(trim(coalesce(it ->> 'descripcion', '')), '');
      if descripcion is null then raise exception 'Un ítem "otro" necesita descripción'; end if;
    else
      raise exception 'Tipo de ítem no válido: %', coalesce(tipo, '(vacío)');
    end if;

    precio := case
      when pl.id is not null then privado.precio_para(pl.id, p_momento, medio_unico, p_sede_id, true)
      when pr.id is not null then pr.precio
      else round((it ->> 'precio_unitario')::numeric, 2) end;
    if precio is null or precio < 0 then
      raise exception 'Sin precio para %', descripcion;
    end if;

    subtotal := precio * cant;
    if desc_ > subtotal then raise exception 'El descuento de % supera su precio', descripcion; end if;
    if desc_ > 0 and length(trim(coalesce(it ->> 'descuento_motivo', ''))) = 0 then
      raise exception 'El descuento de % necesita un motivo', descripcion;
    end if;
    if p_tope_descuento is not null and desc_ > round(subtotal * p_tope_descuento / 100, 2) then
      raise exception 'Tu descuento máximo es % %%: lo autoriza el dueño o el encargado', p_tope_descuento;
    end if;

    insert into public.venta_items (gimnasio_id, venta_id, tipo, plan_id, producto_id, suscripcion_id, descripcion,
                                    cantidad, precio_unitario, descuento, descuento_motivo)
    values (p_gimnasio_id, vid, tipo, pl.id, pr.id, sus.id, descripcion, cant, precio, desc_,
            nullif(trim(coalesce(it ->> 'descuento_motivo', '')), ''));
    total := total + subtotal - desc_;
  end loop;

  for pg in select * from jsonb_array_elements(p_pagos) loop
    if (pg ->> 'monto') is null or (pg ->> 'monto')::numeric <= 0 then raise exception 'Cada pago tiene que tener un monto mayor a cero'; end if;
    insert into public.pagos (gimnasio_id, venta_id, medio, monto, estado, turno_caja_id, aprobado_en, aprobado_por, creado_por, creado_en)
    values (p_gimnasio_id, vid, pg ->> 'medio', round((pg ->> 'monto')::numeric, 2), 'aprobado',
            case when pg ->> 'medio' = 'efectivo' then p_turno_id end, p_momento, p_equipo_id, p_equipo_id, p_momento);
    pagado := pagado + round((pg ->> 'monto')::numeric, 2);
  end loop;

  if pagado <> total then
    raise exception 'Los pagos suman % y el total es %', privado.formato_pesos(pagado), privado.formato_pesos(total);
  end if;

  generados := privado.confirmar_venta(vid, p_momento);
  return jsonb_build_object('venta_id', vid, 'total', total, 'generados', generados,
    'veredicto', case when p_socio_id is not null then to_jsonb(privado.calcular_acceso(p_socio_id, p_momento, p_sede_id)) end);
end $$;
revoke all on function privado.vender(uuid, uuid, uuid, jsonb, jsonb, uuid, uuid, numeric, timestamptz) from public;

create or replace function public.vender(
  p_sede_id uuid, p_items jsonb, p_pagos jsonb, p_socio_id uuid default null, p_turno_id uuid default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare g uuid; eid uuid; rol text; tope numeric;
begin
  select gimnasio_id into g from public.sedes where id = p_sede_id;
  if g is null then raise exception 'Sin permiso o sede inexistente' using errcode = '42501'; end if;
  eid := privado.exigir_rol(g, array['dueno', 'encargado', 'recepcion'], p_sede_id);
  select e.rol into rol from public.equipo e where e.id = eid;
  if rol = 'recepcion' then
    select descuento_max_recepcion into tope from public.configuracion_gimnasio where gimnasio_id = g;
  end if;
  return privado.vender(g, p_sede_id, p_socio_id, p_items, p_pagos, p_turno_id, eid, tope, now());
end $$;

-- ═══ Transferencia informada por el socio ══════════════════════════
create or replace function privado.informar_transferencia(
  p_socio_id uuid, p_cuotas int, p_comprobante_path text, p_momento timestamptz
) returns jsonb
language plpgsql set search_path = '' as $$
declare so public.socios; sus public.suscripciones; pl public.planes; sede uuid; precio numeric; vid uuid; pid uuid;
begin
  if p_cuotas is null or p_cuotas < 1 or p_cuotas > 12 then raise exception 'Cantidad de cuotas inválida'; end if;
  if length(trim(coalesce(p_comprobante_path, ''))) = 0 then raise exception 'Falta el comprobante'; end if;
  select * into so from public.socios where id = p_socio_id for update;
  if not found then raise exception 'Socio inexistente' using errcode = 'P0002'; end if;
  if split_part(p_comprobante_path, '/', 1) <> so.gimnasio_id::text or split_part(p_comprobante_path, '/', 2) <> so.id::text then
    raise exception 'El comprobante tiene que estar en la carpeta del socio';
  end if;
  if exists (select 1 from public.pagos p join public.ventas v on v.id = p.venta_id
              where v.socio_id = so.id and p.estado = 'pendiente' and p.medio = 'transferencia') then
    raise exception 'Ya hay un comprobante esperando aprobación';
  end if;
  select * into sus from public.suscripciones where socio_id = so.id and baja_en is null;
  if not found then raise exception 'No tenés una membresía activa'; end if;
  select * into pl from public.planes where id = sus.plan_id;
  select id into sede from public.sedes where gimnasio_id = so.gimnasio_id and es_principal;
  precio := privado.precio_para(pl.id, p_momento, 'transferencia', null, true);
  if precio is null then raise exception 'El plan % no tiene precio cargado', pl.nombre; end if;

  insert into public.ventas (gimnasio_id, sede_id, socio_id, estado, origen, creado_en)
  values (so.gimnasio_id, sede, so.id, 'pendiente', 'app', p_momento) returning id into vid;
  insert into public.venta_items (gimnasio_id, venta_id, tipo, plan_id, suscripcion_id, descripcion, cantidad, precio_unitario)
  values (so.gimnasio_id, vid, 'cuota', pl.id, sus.id,
          case when p_cuotas = 1 then 'Cuota ' || pl.nombre else p_cuotas || ' cuotas ' || pl.nombre end, p_cuotas, precio);
  insert into public.pagos (gimnasio_id, venta_id, medio, monto, estado, comprobante_path, creado_en)
  values (so.gimnasio_id, vid, 'transferencia', precio * p_cuotas, 'pendiente', p_comprobante_path, p_momento)
  returning id into pid;
  return jsonb_build_object('venta_id', vid, 'pago_id', pid, 'monto', precio * p_cuotas);
end $$;
revoke all on function privado.informar_transferencia(uuid, int, text, timestamptz) from public;

create or replace function public.informar_transferencia(p_socio_id uuid, p_comprobante_path text, p_cuotas int default 1)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare g uuid;
begin
  select gimnasio_id into g from public.socios where id = p_socio_id;
  if g is null or not (p_socio_id in (select privado.mis_socios())
                       or g in (select privado.mis_gimnasios(array['dueno', 'encargado', 'recepcion']))) then
    raise exception 'Sin permiso o socio inexistente' using errcode = '42501';
  end if;
  return privado.informar_transferencia(p_socio_id, p_cuotas, p_comprobante_path, now());
end $$;

-- Aprobar: la cobertura nace ahora, con el período que corresponde hoy.
create or replace function public.aprobar_pago(p_pago_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare p public.pagos; v public.ventas; eid uuid; n int;
begin
  select * into p from public.pagos where id = p_pago_id for update;
  if not found then raise exception 'Sin permiso o pago inexistente' using errcode = '42501'; end if;
  select * into v from public.ventas where id = p.venta_id;
  eid := privado.exigir_rol(p.gimnasio_id, array['dueno', 'encargado', 'recepcion'], v.sede_id);
  if p.estado <> 'pendiente' then raise exception 'El pago ya está %', p.estado; end if;
  if p.medio = 'mercadopago' then raise exception 'Los pagos de MercadoPago los confirma el webhook'; end if;
  update public.pagos set estado = 'aprobado', aprobado_en = now(), aprobado_por = eid
   where id = p.id and estado = 'pendiente';
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'No se pudo aprobar el pago'; end if;
  n := privado.confirmar_venta(v.id, now());
  return jsonb_build_object('venta_id', v.id, 'generados', n,
    'veredicto', to_jsonb(privado.calcular_acceso(v.socio_id, now(), v.sede_id)));
end $$;

create or replace function public.rechazar_pago(p_pago_id uuid, p_motivo text) returns void
language plpgsql security definer set search_path = '' as $$
declare p public.pagos; v public.ventas; eid uuid; n int;
begin
  select * into p from public.pagos where id = p_pago_id for update;
  if not found then raise exception 'Sin permiso o pago inexistente' using errcode = '42501'; end if;
  select * into v from public.ventas where id = p.venta_id for update;
  eid := privado.exigir_rol(p.gimnasio_id, array['dueno', 'encargado', 'recepcion'], v.sede_id);
  if p.estado <> 'pendiente' then raise exception 'El pago ya está %', p.estado; end if;
  if length(trim(coalesce(p_motivo, ''))) = 0 then raise exception 'Decí por qué se rechaza: el socio lo va a ver'; end if;
  update public.pagos set estado = 'rechazado', rechazado_en = now(), rechazado_por = eid, rechazado_motivo = trim(p_motivo)
   where id = p.id and estado = 'pendiente';
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'No se pudo rechazar el pago'; end if;
  if v.estado = 'pendiente' and not exists (select 1 from public.pagos where venta_id = v.id and estado in ('pendiente', 'aprobado')) then
    update public.ventas set estado = 'anulada', anulada_en = now(), anulada_por = eid,
                             anulada_motivo = 'Comprobante rechazado: ' || trim(p_motivo)
     where id = v.id and estado = 'pendiente';
    get diagnostics n = row_count;
    if n <> 1 then raise exception 'No se pudo anular la venta del comprobante rechazado'; end if;
  end if;
end $$;

-- Comprobantes pendientes del gimnasio (para la pantalla "Por aprobar").
create or replace function public.pagos_por_aprobar(p_gimnasio_id uuid)
returns table (pago_id uuid, venta_id uuid, socio_id uuid, socio text, monto numeric, medio text,
               comprobante_path text, descripcion text, informado_en timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform privado.exigir_rol(p_gimnasio_id, array['dueno', 'encargado', 'recepcion']);
  return query
    select p.id, v.id, s.id, trim(s.nombre || ' ' || s.apellido), p.monto, p.medio, p.comprobante_path,
           (select string_agg(i.descripcion, ' + ' order by i.id) from public.venta_items i where i.venta_id = v.id),
           p.creado_en
      from public.pagos p join public.ventas v on v.id = p.venta_id left join public.socios s on s.id = v.socio_id
     where p.gimnasio_id = p_gimnasio_id and p.estado = 'pendiente' and p.medio <> 'mercadopago'
     order by p.creado_en;
end $$;

revoke all on function public.abrir_caja(uuid, numeric), public.cerrar_caja(uuid, numeric, text),
  public.resumen_caja(uuid), public.movimiento_caja(uuid, text, numeric, text),
  public.vender(uuid, jsonb, jsonb, uuid, uuid), public.informar_transferencia(uuid, text, int),
  public.aprobar_pago(uuid), public.rechazar_pago(uuid, text), public.pagos_por_aprobar(uuid)
  from public, anon, authenticated;
grant execute on function public.abrir_caja(uuid, numeric), public.cerrar_caja(uuid, numeric, text),
  public.resumen_caja(uuid), public.movimiento_caja(uuid, text, numeric, text),
  public.vender(uuid, jsonb, jsonb, uuid, uuid), public.informar_transferencia(uuid, text, int),
  public.aprobar_pago(uuid), public.rechazar_pago(uuid, text), public.pagos_por_aprobar(uuid)
  to authenticated, service_role;

-- ── Comprobantes (Supabase Storage, privado) ───────────────────────
-- Ruta: <gimnasio_id>/<socio_id>/<archivo>. El socio sube los suyos; el
-- equipo los lee. Nadie los ve sin sesión.
do $$
begin
  if to_regclass('storage.buckets') is null then
    raise notice 'Sin esquema storage (base local): se saltea el bucket comprobantes';
    return;
  end if;
  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('comprobantes', 'comprobantes', false, 5242880, array['image/png', 'image/jpeg', 'image/webp', 'application/pdf'])
  on conflict (id) do nothing;
  execute 'drop policy if exists comprobantes_socio_sube on storage.objects';
  execute $p$create policy comprobantes_socio_sube on storage.objects for insert to authenticated
    with check (bucket_id = 'comprobantes' and (storage.foldername(name))[2]::uuid in (select privado.mis_socios())
                and (storage.foldername(name))[1]::uuid = (select s.gimnasio_id from public.socios s
                                                           where s.id = (storage.foldername(name))[2]::uuid))$p$;
  execute 'drop policy if exists comprobantes_lectura on storage.objects';
  execute $p$create policy comprobantes_lectura on storage.objects for select to authenticated
    using (bucket_id = 'comprobantes' and (
      (storage.foldername(name))[1]::uuid in (select privado.mis_gimnasios(array['dueno','encargado','recepcion']))
      or (storage.foldername(name))[2]::uuid in (select privado.mis_socios())))$p$;
end $$;

revoke truncate, references, trigger on all tables in schema public from anon, authenticated;

do $$
begin
  if exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
              where n.nspname = 'public' and c.relname = 'productos' and not c.relrowsecurity) then
    raise exception 'Verificación: productos sin RLS';
  end if;
  if has_function_privilege('anon', 'public.vender(uuid, jsonb, jsonb, uuid, uuid)', 'execute') then
    raise exception 'Verificación: anon puede vender';
  end if;
end $$;
