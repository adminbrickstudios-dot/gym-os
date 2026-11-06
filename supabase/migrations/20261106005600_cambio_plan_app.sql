-- VD-39 · Cambio de plan y compra de pases desde la app (D28, docs/v2/05-SOCIO.md §2d)
--
-- El socio, desde su app, puede pasarse a otro plan o comprar un pase diario o un pack, y pagarlo con
-- MercadoPago o con transferencia (comprobante). Todo lo calcula la base:
--   · Cambio de plan: regla D6 (PLA-6). Lo que le quedaba pago del plan viejo pasa al nuevo como DÍAS A FAVOR
--     (cobertura 'traspaso', lo hace privado.cambiar_plan) y paga la cuota del plan nuevo. Nada cambia mientras
--     no se acredita el pago: el plan se cambia EN EL MOMENTO en que se aprueba el comprobante (una persona del
--     equipo, la aprobación de siempre) o llega el aviso de MercadoPago. Si el pago se rechaza, el plan sigue igual.
--   · Pase o pack: es una venta común; la cobertura nace al aprobarse (privado.confirmar_venta).
--
-- Cómo: la compra es una venta 'app' pendiente con su pago. Un pedido de cambio (cambios_plan_app) la marca;
-- un trigger sobre pagos aplica el cambio de plan justo antes de que privado.confirmar_venta genere la cuota,
-- sirva el pago una aprobación (aprobar_pago) o MercadoPago (acreditar_pago_mp): no se redefine ninguna de las dos.
-- Los pagos de la app llevan la clave de operación de VD-34 (doble toque = una sola venta).
--
-- El dueño puede apagar todo esto (ajustes_autoservicio.compras_app, prendido por defecto): la transferencia
-- ya pasa por la aprobación del equipo; aprobación previa del dueño para MercadoPago queda como ítem aparte.

-- ── Guarda de entrada ───────────────────────────────────────────────
do $$
begin
  if to_regprocedure('privado.cambiar_plan(uuid, uuid, timestamptz, uuid)') is null then raise exception 'Guarda: falta privado.cambiar_plan'; end if;
  if to_regprocedure('privado.validar_plan_nuevo(uuid, uuid)') is null then raise exception 'Guarda: falta privado.validar_plan_nuevo (0060)'; end if;
  if to_regprocedure('privado.datos_transferencia(uuid)') is null then raise exception 'Guarda: falta privado.datos_transferencia (0032)'; end if;
  if to_regprocedure('public.registro_socios_panel(uuid)') is null then raise exception 'Guarda: falta registro_socios_panel (VD-35)'; end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'ventas' and column_name = 'clave_operacion') then
    raise exception 'Guarda: falta ventas.clave_operacion (VD-34)';
  end if;
end $$;

-- ── Ajustes del autoservicio (chica, del gimnasio) ──────────────────
create table if not exists public.ajustes_autoservicio (
  gimnasio_id    uuid primary key references public.gimnasios(id),
  compras_app    boolean not null default true,
  actualizado_en timestamptz not null default now()
);
select privado.politicas_estandar('public.ajustes_autoservicio', array['dueno', 'encargado'], '{}');
revoke all on table public.ajustes_autoservicio from anon;
revoke insert, update, delete, truncate, references, trigger on public.ajustes_autoservicio from authenticated;

-- ── Pedidos de cambio de plan hechos desde la app ───────────────────
create table if not exists public.cambios_plan_app (
  id           uuid primary key default gen_random_uuid(),
  gimnasio_id  uuid not null references public.gimnasios(id),
  socio_id     uuid not null,
  plan_id      uuid not null,
  venta_id     uuid not null,
  creado_en    timestamptz not null default now(),
  aplicado_en  timestamptz,
  unique (gimnasio_id, id),
  unique (gimnasio_id, venta_id),
  foreign key (gimnasio_id, socio_id) references public.socios (gimnasio_id, id),
  foreign key (gimnasio_id, plan_id) references public.planes (gimnasio_id, id),
  foreign key (gimnasio_id, venta_id) references public.ventas (gimnasio_id, id)
);
create index if not exists cambios_plan_app_socio on public.cambios_plan_app (gimnasio_id, socio_id, creado_en desc);
select privado.politicas_estandar('public.cambios_plan_app', array['dueno', 'encargado', 'recepcion'], '{}', true);
revoke all on table public.cambios_plan_app from anon;
revoke insert, update, delete, truncate, references, trigger on public.cambios_plan_app from authenticated;

-- ── D6: qué pasa al cambiar (una sola fuente; la usan el equipo y el socio) ──
create or replace function privado.vista_cambio(p_socio_id uuid, p_plan_id uuid) returns jsonb
language plpgsql stable set search_path = '' as $$
declare g uuid; zona text; vieja public.suscripciones; pv public.planes; pn public.planes; fin timestamptz; hoy date;
begin
  select gimnasio_id into g from public.socios where id = p_socio_id;
  if g is null then raise exception 'Sin permiso o socio inexistente' using errcode = '42501'; end if;
  pn := privado.validar_plan_nuevo(g, p_plan_id);
  select zona_horaria into zona from public.gimnasios where id = g;
  hoy := privado.dia_local(now(), zona);
  select * into vieja from public.suscripciones where socio_id = p_socio_id and baja_en is null;
  if found then
    select * into pv from public.planes where id = vieja.plan_id;
    select max(c.hasta) into fin from public.coberturas c where c.suscripcion_id = vieja.id and c.anulada_en is null and c.hasta > now();
  end if;
  return jsonb_build_object(
    'plan_viejo', pv.nombre, 'plan_nuevo', pn.nombre,
    'precio_viejo', case when pv.id is not null then round(privado.precio_base(pv.id, now()) / pv.duracion_meses, 2) end,
    'precio_nuevo', round(privado.precio_base(pn.id, now()) / pn.duracion_meses, 2),
    'hasta', case when fin is not null then privado.dia_local(fin, zona) - 1 end,
    'dias_a_favor', case when fin is not null then greatest(privado.dia_local(fin, zona) - hoy, 0) else 0 end,
    'congelado', vieja.id is not null and exists (select 1 from public.congelamientos c where c.suscripcion_id = vieja.id and c.anulado_en is null
                                                   and coalesce(c.hasta_real, c.hasta_prevista) > now()));
end $$;
revoke all on function privado.vista_cambio(uuid, uuid) from public, anon, authenticated;

-- La del equipo (0060) ahora es solo el permiso + la misma cuenta.
create or replace function public.vista_cambio_plan(p_socio_id uuid, p_plan_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare g uuid;
begin
  select gimnasio_id into g from public.socios where id = p_socio_id;
  if g is null then raise exception 'Sin permiso o socio inexistente' using errcode = '42501'; end if;
  perform privado.exigir_rol(g, array['dueno', 'encargado', 'recepcion']);
  return privado.vista_cambio(p_socio_id, p_plan_id);
end $$;

-- ── Lo que ve el socio ──────────────────────────────────────────────
create or replace function public.opciones_compra_app(p_socio_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare so public.socios; sede uuid; actual public.suscripciones;
begin
  if p_socio_id is null or p_socio_id not in (select privado.mis_socios()) then raise exception 'Sin permiso' using errcode = '42501'; end if;
  select * into so from public.socios where id = p_socio_id;
  select id into sede from public.sedes where gimnasio_id = so.gimnasio_id and es_principal;
  select * into actual from public.suscripciones where socio_id = so.id and baja_en is null;
  return jsonb_build_object(
    'habilitado', coalesce((select a.compras_app from public.ajustes_autoservicio a where a.gimnasio_id = so.gimnasio_id), true),
    'plan_actual', case when actual.id is not null then jsonb_build_object('plan_id', actual.plan_id,
                          'nombre', (select p.nombre from public.planes p where p.id = actual.plan_id)) end,
    'transferencia', privado.datos_transferencia(so.gimnasio_id),
    'mercadopago', exists (select 1 from public.proveedores_pago pp where pp.gimnasio_id = so.gimnasio_id and pp.proveedor = 'mercadopago' and pp.activo),
    'planes', coalesce((
      select jsonb_agg(jsonb_build_object('plan_id', p.id, 'nombre', p.nombre, 'tipo', p.tipo, 'descripcion', p.descripcion,
               'cantidad_clases', p.cantidad_clases, 'validez_dias', p.validez_dias, 'duracion_meses', p.duracion_meses,
               'precio_transferencia', privado.precio_para(p.id, now(), 'transferencia', sede, true),
               'precio_mercadopago', privado.precio_para(p.id, now(), 'mercadopago', sede, true))
             order by case p.tipo when 'membresia' then 0 when 'pase_diario' then 1 else 2 end, p.orden, p.nombre)
        from public.planes p
       where p.gimnasio_id = so.gimnasio_id and p.activo and p.visible_en_landing and p.id is distinct from actual.plan_id
         and (privado.precio_para(p.id, now(), 'transferencia', sede, true) is not null
              or privado.precio_para(p.id, now(), 'mercadopago', sede, true) is not null)), '[]'::jsonb),
    'pendiente', (select jsonb_build_object('descripcion', (select string_agg(i.descripcion, ' + ' order by i.id) from public.venta_items i where i.venta_id = v.id),
                         'monto', pg.monto, 'medio', pg.medio, 'desde', pg.creado_en)
                    from public.ventas v join public.pagos pg on pg.venta_id = v.id
                   where v.socio_id = so.id and v.origen = 'app' and v.estado = 'pendiente' and pg.estado = 'pendiente'
                     and pg.medio = 'transferencia' and pg.comprobante_path is not null
                   order by pg.creado_en desc limit 1));
end $$;

-- Un plan elegido: qué pasa y cuánto se paga (D6 para una membresía).
create or replace function public.vista_compra_app(p_socio_id uuid, p_plan_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare so public.socios; pl public.planes; sede uuid; actual public.suscripciones; v jsonb;
begin
  if p_socio_id is null or p_socio_id not in (select privado.mis_socios()) then raise exception 'Sin permiso' using errcode = '42501'; end if;
  select * into so from public.socios where id = p_socio_id;
  select * into pl from public.planes p where p.id = p_plan_id and p.gimnasio_id = so.gimnasio_id and p.activo and p.visible_en_landing;
  if pl.id is null then raise exception 'Ese plan no está a la venta' using errcode = '22023'; end if;
  select id into sede from public.sedes where gimnasio_id = so.gimnasio_id and es_principal;
  select * into actual from public.suscripciones where socio_id = so.id and baja_en is null;
  if pl.tipo = 'membresia' and actual.plan_id = pl.id then raise exception 'Ya estás en ese plan: tu cuota se paga desde Inicio' using errcode = '22023'; end if;
  v := case when pl.tipo = 'membresia' then privado.vista_cambio(so.id, pl.id) else '{}'::jsonb end;
  return v || jsonb_build_object('plan_id', pl.id, 'nombre', pl.nombre, 'tipo', pl.tipo, 'cantidad_clases', pl.cantidad_clases, 'validez_dias', pl.validez_dias,
    'cambia_plan', pl.tipo = 'membresia',
    'precio_transferencia', privado.precio_para(pl.id, now(), 'transferencia', sede, true),
    'precio_mercadopago', privado.precio_para(pl.id, now(), 'mercadopago', sede, true));
end $$;

-- ── La compra (venta pendiente + pago) ──────────────────────────────
create or replace function privado.crear_compra_app(p_socio_id uuid, p_plan_id uuid, p_medio text, p_comprobante_path text, p_clave_operacion uuid) returns jsonb
language plpgsql set search_path = '' as $$
declare
  so public.socios; pl public.planes; actual public.suscripciones; sede uuid; precio numeric; vid uuid; pid uuid; previa public.ventas; pg public.pagos;
  vista jsonb; desc_item text; existe boolean;
begin
  select * into so from public.socios where id = p_socio_id for update;
  if not found then raise exception 'Socio inexistente' using errcode = 'P0002'; end if;
  if p_medio not in ('transferencia', 'mercadopago') then raise exception 'Elegí cómo pagás' using errcode = '22023'; end if;

  -- Misma operación otra vez: se devuelve lo ya hecho (el lock turna dos envíos simultáneos).
  if p_clave_operacion is not null then
    perform pg_advisory_xact_lock(hashtextextended(so.gimnasio_id::text || p_clave_operacion::text, 0));
    select * into previa from public.ventas v where v.gimnasio_id = so.gimnasio_id and v.clave_operacion = p_clave_operacion;
    if found then
      if previa.socio_id is distinct from so.id then raise exception 'Esa operación ya se usó' using errcode = '22023'; end if;
      select * into pg from public.pagos p where p.venta_id = previa.id order by p.creado_en limit 1;
      return jsonb_build_object('venta_id', previa.id, 'pago_id', pg.id, 'gimnasio_id', so.gimnasio_id, 'monto', pg.monto, 'repetida', true,
        'descripcion', (select string_agg(i.descripcion, ' + ' order by i.id) from public.venta_items i where i.venta_id = previa.id));
    end if;
  end if;

  if not coalesce((select a.compras_app from public.ajustes_autoservicio a where a.gimnasio_id = so.gimnasio_id), true) then
    raise exception 'Este gimnasio no vende planes ni pases desde la app: pasá por recepción.' using errcode = '22023';
  end if;
  if p_medio = 'transferencia' and privado.datos_transferencia(so.gimnasio_id) is null then
    raise exception 'Este gimnasio no recibe pagos por transferencia: pagá en el mostrador.' using errcode = '22023';
  end if;
  if p_medio = 'mercadopago' and not exists (select 1 from public.proveedores_pago pp where pp.gimnasio_id = so.gimnasio_id and pp.proveedor = 'mercadopago' and pp.activo) then
    raise exception 'El gimnasio no tiene pagos online' using errcode = '22023';
  end if;

  select * into pl from public.planes p where p.id = p_plan_id and p.gimnasio_id = so.gimnasio_id and p.activo and p.visible_en_landing;
  if pl.id is null then raise exception 'Ese plan no está a la venta' using errcode = '22023'; end if;
  select id into sede from public.sedes where gimnasio_id = so.gimnasio_id and es_principal;
  precio := privado.precio_para(pl.id, now(), p_medio, sede, true);
  if precio is null or precio <= 0 then raise exception '% no tiene precio cargado para ese medio de pago', pl.nombre using errcode = '22023'; end if;

  select * into actual from public.suscripciones where socio_id = so.id and baja_en is null;
  if pl.tipo = 'membresia' then
    if actual.plan_id = pl.id then raise exception 'Ya estás en ese plan: tu cuota se paga desde Inicio' using errcode = '22023'; end if;
    vista := privado.vista_cambio(so.id, pl.id);
    if (vista ->> 'congelado')::boolean then
      raise exception 'Tenés un congelamiento en curso o programado: resolvelo con el gimnasio antes de cambiar de plan' using errcode = '22023';
    end if;
    -- Un cambio con comprobante esperando no se pisa con otro pago (se aplicaría dos veces).
    if exists (select 1 from public.pagos p join public.ventas v on v.id = p.venta_id
                where v.socio_id = so.id and p.estado = 'pendiente' and p.medio = 'transferencia') then
      raise exception 'Ya hay un comprobante esperando aprobación: esperá a que lo revisen' using errcode = '22023';
    end if;
  end if;

  -- MercadoPago: si ya abrió ese mismo pago hace menos de una hora y no lo terminó, se reusa (no se apilan).
  if p_medio = 'mercadopago' then
    select p.id, v.id into pid, vid from public.pagos p join public.ventas v on v.id = p.venta_id
      join public.venta_items i on i.venta_id = v.id
     where v.socio_id = so.id and v.origen = 'app' and v.estado = 'pendiente' and p.medio = 'mercadopago' and p.estado = 'pendiente'
       and i.plan_id = pl.id and p.monto = precio and p.creado_en > now() - interval '1 hour'
     order by p.creado_en desc limit 1;
    if pid is not null then
      return jsonb_build_object('venta_id', vid, 'pago_id', pid, 'gimnasio_id', so.gimnasio_id, 'monto', precio, 'repetida', true,
        'descripcion', (select string_agg(i.descripcion, ' + ' order by i.id) from public.venta_items i where i.venta_id = vid));
    end if;
  end if;

  if p_medio = 'transferencia' then
    if length(trim(coalesce(p_comprobante_path, ''))) = 0 then raise exception 'Falta el comprobante'; end if;
    if split_part(p_comprobante_path, '/', 1) <> so.gimnasio_id::text or split_part(p_comprobante_path, '/', 2) <> so.id::text then
      raise exception 'El comprobante tiene que estar en la carpeta del socio';
    end if;
    if exists (select 1 from public.pagos where gimnasio_id = so.gimnasio_id and comprobante_path = p_comprobante_path and estado <> 'rechazado') then
      raise exception 'Ese comprobante ya se usó';
    end if;
    if to_regclass('storage.objects') is not null then
      execute 'select exists (select 1 from storage.objects where bucket_id = ''comprobantes'' and name = $1)' into existe using p_comprobante_path;
      if not existe then raise exception 'No encontramos el comprobante: volvé a subirlo'; end if;
    end if;
    if exists (select 1 from public.pagos p join public.ventas v on v.id = p.venta_id
                where v.socio_id = so.id and p.estado = 'pendiente' and p.medio = 'transferencia') then
      raise exception 'Ya hay un comprobante esperando aprobación';
    end if;
  end if;

  desc_item := case pl.tipo when 'membresia' then 'Cambio a ' || pl.nombre when 'pase_diario' then 'Pase · ' || pl.nombre else 'Pack · ' || pl.nombre end;
  insert into public.ventas (gimnasio_id, sede_id, socio_id, estado, origen, clave_operacion)
  values (so.gimnasio_id, sede, so.id, 'pendiente', 'app', p_clave_operacion) returning id into vid;
  -- El cambio de plan entra como "otro": la cuota del plan nuevo se arma sola cuando el pago se aprueba (trigger de abajo).
  insert into public.venta_items (gimnasio_id, venta_id, tipo, plan_id, descripcion, cantidad, precio_unitario)
  values (so.gimnasio_id, vid, case pl.tipo when 'membresia' then 'otro' when 'pase_diario' then 'pase' else 'pack' end, pl.id, desc_item, 1, precio);
  insert into public.pagos (gimnasio_id, venta_id, medio, monto, estado, comprobante_path)
  values (so.gimnasio_id, vid, p_medio, precio, 'pendiente', case when p_medio = 'transferencia' then p_comprobante_path end) returning id into pid;
  if pl.tipo = 'membresia' then
    insert into public.cambios_plan_app (gimnasio_id, socio_id, plan_id, venta_id) values (so.gimnasio_id, so.id, pl.id, vid);
  end if;
  return jsonb_build_object('venta_id', vid, 'pago_id', pid, 'gimnasio_id', so.gimnasio_id, 'monto', precio, 'descripcion', desc_item,
                            'dias_a_favor', vista -> 'dias_a_favor');
end $$;
revoke all on function privado.crear_compra_app(uuid, uuid, text, text, uuid) from public, anon, authenticated;

create or replace function public.informar_compra_app(p_socio_id uuid, p_plan_id uuid, p_comprobante_path text, p_clave_operacion uuid default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if p_socio_id is null or p_socio_id not in (select privado.mis_socios()) then raise exception 'Sin permiso' using errcode = '42501'; end if;
  return privado.crear_compra_app(p_socio_id, p_plan_id, 'transferencia', p_comprobante_path, p_clave_operacion);
end $$;

create or replace function public.iniciar_compra_online(p_socio_id uuid, p_plan_id uuid, p_clave_operacion uuid default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if p_socio_id is null or p_socio_id not in (select privado.mis_socios()) then raise exception 'Sin permiso' using errcode = '42501'; end if;
  return privado.crear_compra_app(p_socio_id, p_plan_id, 'mercadopago', null, p_clave_operacion);
end $$;

-- ── Al aprobarse el pago, el cambio de plan se aplica ───────────────
-- Corre antes de que privado.confirmar_venta genere la cuota (la llama aprobar_pago, o acreditar_pago_mp).
-- Si falla (p. ej. quedó un congelamiento), la aprobación entera falla con el motivo y el pago sigue pendiente.
create or replace function privado.aplicar_cambio_plan_app() returns trigger
language plpgsql set search_path = '' as $$
declare cp public.cambios_plan_app; actual public.suscripciones; nueva uuid; nombre text; n int;
begin
  select * into cp from public.cambios_plan_app c where c.venta_id = new.venta_id and c.aplicado_en is null for update;
  if not found then return new; end if;
  select * into actual from public.suscripciones where socio_id = cp.socio_id and baja_en is null;
  if not found then
    nueva := privado.asignar_plan(cp.socio_id, cp.plan_id, now(), new.aprobado_por);
  elsif actual.plan_id = cp.plan_id then
    nueva := actual.id;          -- ya lo pasaron a ese plan en el mostrador: solo se acredita la cuota
  else
    nueva := privado.cambiar_plan(cp.socio_id, cp.plan_id, now(), new.aprobado_por);
  end if;
  select p.nombre into nombre from public.planes p where p.id = cp.plan_id;
  update public.venta_items set tipo = 'cuota', suscripcion_id = nueva, descripcion = 'Cuota ' || nombre
   where venta_id = new.venta_id and tipo = 'otro' and plan_id = cp.plan_id;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'No se pudo armar la cuota del plan nuevo'; end if;
  update public.cambios_plan_app set aplicado_en = now() where id = cp.id;
  return new;
end $$;
revoke all on function privado.aplicar_cambio_plan_app() from public, anon, authenticated;
drop trigger if exists pagos_aplicar_cambio_plan on public.pagos;
create trigger pagos_aplicar_cambio_plan before update of estado on public.pagos
  for each row when (old.estado = 'pendiente' and new.estado = 'aprobado')
  execute function privado.aplicar_cambio_plan_app();

-- ── Panel: el interruptor del dueño ─────────────────────────────────
create or replace function public.autoservicio_panel(p_gimnasio_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado']);
  return public.registro_socios_panel(p_gimnasio_id)
      || jsonb_build_object('compras_app', coalesce((select a.compras_app from public.ajustes_autoservicio a where a.gimnasio_id = p_gimnasio_id), true));
end $$;

create or replace function public.guardar_compras_app(p_gimnasio_id uuid, p_activo boolean) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno']);
  if p_activo is null then raise exception 'Elegí si se pueden comprar planes y pases desde la app' using errcode = '22023'; end if;
  insert into public.ajustes_autoservicio (gimnasio_id, compras_app) values (p_gimnasio_id, p_activo)
  on conflict (gimnasio_id) do update set compras_app = excluded.compras_app, actualizado_en = now();
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'No se pudo guardar'; end if;
  return public.autoservicio_panel(p_gimnasio_id);
end $$;

-- ── Permisos ────────────────────────────────────────────────────────
revoke all on function public.vista_cambio_plan(uuid, uuid), public.opciones_compra_app(uuid), public.vista_compra_app(uuid, uuid),
  public.informar_compra_app(uuid, uuid, text, uuid), public.iniciar_compra_online(uuid, uuid, uuid),
  public.autoservicio_panel(uuid), public.guardar_compras_app(uuid, boolean) from public, anon, authenticated;
grant execute on function public.vista_cambio_plan(uuid, uuid), public.opciones_compra_app(uuid), public.vista_compra_app(uuid, uuid),
  public.informar_compra_app(uuid, uuid, text, uuid), public.iniciar_compra_online(uuid, uuid, uuid),
  public.autoservicio_panel(uuid), public.guardar_compras_app(uuid, boolean) to authenticated, service_role;

-- ── Verificación ────────────────────────────────────────────────────
do $$
declare f text;
begin
  if not (select relrowsecurity from pg_class where oid = 'public.ajustes_autoservicio'::regclass) then raise exception 'Verificación: ajustes_autoservicio sin RLS'; end if;
  if not (select relrowsecurity from pg_class where oid = 'public.cambios_plan_app'::regclass) then raise exception 'Verificación: cambios_plan_app sin RLS'; end if;
  foreach f in array array['public.vista_cambio_plan(uuid, uuid)', 'public.opciones_compra_app(uuid)', 'public.vista_compra_app(uuid, uuid)',
                           'public.informar_compra_app(uuid, uuid, text, uuid)', 'public.iniciar_compra_online(uuid, uuid, uuid)',
                           'public.autoservicio_panel(uuid)', 'public.guardar_compras_app(uuid, boolean)', 'privado.vista_cambio(uuid, uuid)',
                           'privado.crear_compra_app(uuid, uuid, text, text, uuid)', 'privado.aplicar_cambio_plan_app()'] loop
    if not exists (select 1 from pg_proc where oid = f::regprocedure and 'search_path=""' = any (proconfig)) then
      raise exception 'Verificación: % sin search_path vacío', f;
    end if;
    if has_function_privilege('anon', f, 'execute') then raise exception 'Verificación: anon puede ejecutar %', f; end if;
  end loop;
  if not exists (select 1 from pg_trigger where tgname = 'pagos_aplicar_cambio_plan' and tgrelid = 'public.pagos'::regclass) then
    raise exception 'Verificación: falta el trigger que aplica el cambio de plan';
  end if;
end $$;
