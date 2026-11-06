-- VD-17 · Planes y servicios (docs/v2/03 §7).
-- Lo que la base ya tenía sin pantalla (renovación por plan, tolerancia, consume_en, sedes, orden,
-- visible en la página) ahora se edita; y los servicios adicionales recurrentes (locker, toalla,
-- nutrición) se asignan al socio y se suman a su cuota en el mismo Cobrar.
--
--   productos.recurrente                  true = servicio adicional (no sale en el mostrador)
--   servicios_socio                       hecho: qué servicio tiene contratado cada socio, desde y hasta cuándo
--   servicios_gimnasio(gimnasio)          los servicios, con a quiénes se los cobra
--   guardar_servicio(gimnasio, id, nombre, precio, activo)
--   asignar_servicio(socio, servicio, asignar)
--   ajustes_planes(gimnasio)              renovación efectiva, tolerancia, consume_en y sedes de cada plan
--   guardar_ajustes_plan(plan, datos)     tolerancia, consume_en, visible en la página, sedes
--   ordenar_planes(gimnasio, ids)         el orden en que se ofrecen
--   privado.vender / precios_venta        copia de la 20261106004000 con el ítem 'servicio'
--
-- El servicio no es una columna de la cuota: se guarda como un hecho (servicios_socio) y se cobra
-- como una línea de la misma venta (tipo 'producto', con su producto_id). Cobrar la cuota sin su servicio se puede (la
-- recepción lo saca con un descuento con motivo, como el recargo); cobrar un servicio sin cuota no.

-- ── Guarda de entrada ───────────────────────────────────────────────
do $$
begin
  if to_regprocedure('privado.vender(uuid, uuid, uuid, jsonb, jsonb, uuid, uuid, numeric, timestamptz)') is null then
    raise exception 'Guarda: falta privado.vender';
  end if;
  if to_regprocedure('privado.regla_vencimiento(uuid)') is null then raise exception 'Guarda: falta la migración 20261106004000'; end if;
  if to_regprocedure('public.guardar_regla_plan(uuid, boolean, text, int)') is null then raise exception 'Guarda: falta guardar_regla_plan'; end if;
end $$;

-- ── Servicios adicionales ───────────────────────────────────────────
alter table public.productos add column if not exists recurrente boolean not null default false;

create table if not exists public.servicios_socio (
  id           uuid primary key default gen_random_uuid(),
  gimnasio_id  uuid not null references public.gimnasios(id),
  socio_id     uuid not null,
  producto_id  uuid not null,
  desde        timestamptz not null default now(),
  hasta        timestamptz,
  creado_por   uuid not null,
  unique (gimnasio_id, id),
  foreign key (gimnasio_id, socio_id) references public.socios (gimnasio_id, id),
  foreign key (gimnasio_id, producto_id) references public.productos (gimnasio_id, id),
  foreign key (gimnasio_id, creado_por) references public.equipo (gimnasio_id, id),
  check (hasta is null or hasta > desde)
);
-- Un servicio vigente por socio y servicio.
create unique index if not exists servicios_socio_uno_vigente on public.servicios_socio (gimnasio_id, socio_id, producto_id) where hasta is null;
create index if not exists servicios_socio_producto on public.servicios_socio (producto_id) where hasta is null;
select privado.politicas_estandar('public.servicios_socio', array['dueno', 'encargado', 'recepcion'], array['dueno', 'encargado']);
revoke all on table public.servicios_socio from anon;

-- El mostrador no vende servicios sueltos: productos_gimnasio los deja afuera.
create or replace function public.productos_gimnasio(p_gimnasio_id uuid)
returns table (producto_id uuid, nombre text, precio numeric, activo boolean, orden int)
language plpgsql security definer set search_path = '' as $$
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado', 'recepcion']);
  return query select pr.id, pr.nombre, pr.precio, pr.activo, pr.orden from public.productos pr
                where pr.gimnasio_id = p_gimnasio_id and not pr.recurrente order by pr.activo desc, pr.orden, pr.nombre;
end $$;

create or replace function public.servicios_gimnasio(p_gimnasio_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado']);
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'producto_id', pr.id, 'nombre', pr.nombre, 'precio', pr.precio, 'activo', pr.activo,
             'socios', coalesce((select jsonb_agg(jsonb_build_object('socio_id', s.id, 'nombre', trim(s.nombre || ' ' || s.apellido)) order by s.apellido, s.nombre)
                                   from public.servicios_socio ss join public.socios s on s.id = ss.socio_id
                                  where ss.producto_id = pr.id and ss.hasta is null), '[]'::jsonb))
           order by pr.activo desc, pr.orden, pr.nombre)
      from public.productos pr where pr.gimnasio_id = p_gimnasio_id and pr.recurrente), '[]'::jsonb);
end $$;

create or replace function public.guardar_servicio(p_gimnasio_id uuid, p_producto_id uuid, p_nombre text, p_precio numeric, p_activo boolean default true) returns uuid
language plpgsql security definer set search_path = '' as $$
declare pid uuid; n int;
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado']);
  if length(trim(coalesce(p_nombre, ''))) = 0 then raise exception 'Poné el nombre del servicio' using errcode = '22023'; end if;
  if p_precio is null or p_precio < 0 then raise exception 'El precio no puede ser negativo' using errcode = '22023'; end if;
  if p_producto_id is null then
    insert into public.productos (gimnasio_id, nombre, precio, recurrente, orden)
    values (p_gimnasio_id, trim(p_nombre), round(p_precio, 2), true,
            coalesce((select max(orden) + 1 from public.productos where gimnasio_id = p_gimnasio_id), 0))
    returning id into pid;
  else
    update public.productos set nombre = trim(p_nombre), precio = round(p_precio, 2), activo = coalesce(p_activo, true)
     where id = p_producto_id and gimnasio_id = p_gimnasio_id and recurrente
    returning id into pid;
    get diagnostics n = row_count;
    if n <> 1 then raise exception 'Sin permiso o servicio inexistente' using errcode = '42501'; end if;
  end if;
  return pid;
end $$;

create or replace function public.asignar_servicio(p_socio_id uuid, p_producto_id uuid, p_asignar boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare so public.socios; pr public.productos; eid uuid; n int;
begin
  select * into so from public.socios where id = p_socio_id;
  if not found then raise exception 'Sin permiso o socio inexistente' using errcode = '42501'; end if;
  eid := privado.exigir_rol(so.gimnasio_id, array['dueno', 'encargado']);
  select * into pr from public.productos where id = p_producto_id and gimnasio_id = so.gimnasio_id and recurrente;
  if not found then raise exception 'Sin permiso o servicio inexistente' using errcode = '42501'; end if;
  if p_asignar is null then raise exception 'Elegí si se asigna o se quita' using errcode = '22023'; end if;
  if p_asignar then
    if not pr.activo then raise exception '% no se está ofreciendo: activalo primero', pr.nombre using errcode = '22023'; end if;
    if exists (select 1 from public.servicios_socio where socio_id = so.id and producto_id = pr.id and hasta is null) then
      raise exception 'Este socio ya tiene %', pr.nombre using errcode = '22023';
    end if;
    insert into public.servicios_socio (gimnasio_id, socio_id, producto_id, creado_por) values (so.gimnasio_id, so.id, pr.id, eid);
  else
    update public.servicios_socio set hasta = greatest(now(), desde + interval '1 second')
     where socio_id = so.id and producto_id = pr.id and gimnasio_id = so.gimnasio_id and hasta is null;
    get diagnostics n = row_count;
    if n <> 1 then raise exception 'Este socio no tiene %', pr.nombre using errcode = '22023'; end if;
  end if;
end $$;

-- ── Ajustes de cada plan ────────────────────────────────────────────
-- Cómo vence (el del plan o el del gimnasio), tolerancia, qué consume el pack y en qué sedes vale.
create or replace function public.ajustes_planes(p_gimnasio_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare c public.configuracion_vencimiento; cg public.configuracion_gimnasio; hay boolean;
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado']);
  select * into c from public.configuracion_vencimiento where gimnasio_id = p_gimnasio_id;
  hay := found;
  select * into cg from public.configuracion_gimnasio where gimnasio_id = p_gimnasio_id;
  return jsonb_build_object(
    'regla_gimnasio', case when hay then jsonb_build_object('renovacion', c.renovacion, 'dia_fijo', c.dia_fijo) end,
    'tolerancia_gimnasio', cg.tolerancia_dias,
    'sedes', coalesce((select jsonb_agg(jsonb_build_object('sede_id', s.id, 'nombre', s.nombre) order by s.es_principal desc, s.nombre)
                         from public.sedes s where s.gimnasio_id = p_gimnasio_id and s.activa), '[]'::jsonb),
    'planes', coalesce((
      select jsonb_object_agg(p.id, jsonb_build_object(
               'usa_regla_gimnasio', p.usa_regla_gimnasio and hay,
               'renovacion', case when p.tipo = 'membresia' then r.p_renovacion end,
               'dia_fijo', case when p.tipo = 'membresia' then r.p_dia_fijo end,
               'renovacion_propia', p.renovacion, 'dia_fijo_propio', p.dia_fijo,
               'tolerancia_dias', p.tolerancia_dias, 'consume_en', p.consume_en,
               'visible_en_landing', p.visible_en_landing,
               'todas_las_sedes', p.todas_las_sedes,
               'sedes', coalesce((select jsonb_agg(ps.sede_id) from public.plan_sedes ps where ps.plan_id = p.id), '[]'::jsonb)))
        from public.planes p cross join lateral privado.regla_vencimiento(p.id) r
       where p.gimnasio_id = p_gimnasio_id), '{}'::jsonb));
end $$;

create or replace function public.guardar_ajustes_plan(p_plan_id uuid, p_datos jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare pl public.planes; n int; todas boolean; ids uuid[]; tol int;
begin
  select * into pl from public.planes where id = p_plan_id;
  if not found then raise exception 'Sin permiso o plan inexistente' using errcode = '42501'; end if;
  perform privado.exigir_equipo(pl.gimnasio_id, array['dueno', 'encargado']);
  if jsonb_typeof(p_datos) is distinct from 'object' then raise exception 'Datos inválidos' using errcode = '22023'; end if;

  if p_datos ? 'tolerancia_dias' then
    tol := nullif(p_datos ->> 'tolerancia_dias', '')::int;
    if tol is not null and tol not between 0 and 60 then raise exception 'La tolerancia va de 0 a 60 días (vacío = la del gimnasio)' using errcode = '22023'; end if;
    if pl.tipo <> 'membresia' then raise exception 'Solo las membresías tienen tolerancia' using errcode = '22023'; end if;
  end if;
  if p_datos ? 'consume_en' then
    if pl.tipo <> 'pack' then raise exception 'Solo los packs eligen cuándo se descuenta una clase' using errcode = '22023'; end if;
    if p_datos ->> 'consume_en' is null or p_datos ->> 'consume_en' not in ('ingreso', 'asistencia') then
      raise exception 'Elegí si la clase se descuenta al entrar o al tomar asistencia' using errcode = '22023';
    end if;
  end if;
  todas := coalesce((p_datos ->> 'todas_las_sedes')::boolean, pl.todas_las_sedes);
  if p_datos ? 'sedes' then
    ids := coalesce(array(select x::uuid from jsonb_array_elements_text(p_datos -> 'sedes') x), '{}');
    if exists (select 1 from unnest(ids) i where not exists (select 1 from public.sedes s where s.id = i and s.gimnasio_id = pl.gimnasio_id)) then
      raise exception 'Esa sede no es de este gimnasio' using errcode = '22023';
    end if;
  end if;

  update public.planes set
    tolerancia_dias = case when p_datos ? 'tolerancia_dias' then tol else tolerancia_dias end,
    consume_en = case when p_datos ? 'consume_en' then p_datos ->> 'consume_en' else consume_en end,
    visible_en_landing = coalesce((p_datos ->> 'visible_en_landing')::boolean, visible_en_landing),
    todas_las_sedes = todas
   where id = pl.id and gimnasio_id = pl.gimnasio_id;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'No se pudo guardar el plan' using errcode = '42501'; end if;

  if p_datos ? 'sedes' or (p_datos ? 'todas_las_sedes' and todas) then
    delete from public.plan_sedes where plan_id = pl.id and gimnasio_id = pl.gimnasio_id;
    if not todas and ids is not null then
      insert into public.plan_sedes (gimnasio_id, plan_id, sede_id) select pl.gimnasio_id, pl.id, i from unnest(ids) i;
    end if;
  end if;
  if not todas and not exists (select 1 from public.plan_sedes where plan_id = pl.id) then
    raise exception 'Elegí en qué sedes se vende (o todas)' using errcode = '22023';
  end if;
end $$;

create or replace function public.ordenar_planes(p_gimnasio_id uuid, p_ids uuid[]) returns void
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado']);
  if p_ids is null or cardinality(p_ids) = 0 then raise exception 'Falta el orden' using errcode = '22023'; end if;
  update public.planes p set orden = x.pos
    from (select t.id, (t.ord - 1)::int as pos from unnest(p_ids) with ordinality as t(id, ord)) x
   where p.id = x.id and p.gimnasio_id = p_gimnasio_id;
  get diagnostics n = row_count;
  if n <> cardinality(p_ids) then raise exception 'Algún plan no es de este gimnasio (o está repetido)' using errcode = '42501'; end if;
end $$;

-- ── privado.vender y precios_venta: copia de la 20261106004000 con el ítem 'servicio' ──
create or replace function privado.vender(
  p_gimnasio_id uuid, p_sede_id uuid, p_socio_id uuid, p_items jsonb, p_pagos jsonb,
  p_turno_id uuid, p_equipo_id uuid, p_tope_descuento numeric, p_momento timestamptz
) returns jsonb
language plpgsql set search_path = '' as $$
declare
  it jsonb; pg jsonb; vid uuid; total numeric := 0; pagado numeric := 0; generados int;
  medio_unico text; tipo text; cant int; precio numeric; desc_ numeric; pl public.planes; pr public.productos;
  sus public.suscripciones; descripcion text; subtotal numeric; medios text[]; mat jsonb; rec jsonb; hay_cuota boolean := false; hay_recargo boolean := false; conv jsonb; desc_conv numeric; motivo text; fiado numeric; deuda numeric; tope_fiado numeric; hay_deuda numeric := 0; per record; zona_g text; cuotas_n int := 0; serv_cants int[] := '{}';
begin
  -- VD-7: `per` tiene que existir antes del primer ítem (el CASE del precio lo lee aunque el ítem no sea una cuota).
  select false as p_parcial, 1::numeric as p_factor, 100::numeric as p_redondeo into per;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'El carrito está vacío';
  end if;
  if p_pagos is null or jsonb_typeof(p_pagos) <> 'array' then
    raise exception 'Falta el pago';
  end if;
  if p_socio_id is not null and not exists (select 1 from public.socios where id = p_socio_id and gimnasio_id = p_gimnasio_id) then
    raise exception 'El socio no es de este gimnasio';
  end if;
  if not exists (select 1 from public.sedes where id = p_sede_id and gimnasio_id = p_gimnasio_id) then
    raise exception 'La sede no es de este gimnasio';
  end if;

  select coalesce(array_agg(distinct x ->> 'medio'), '{}') into medios from jsonb_array_elements(p_pagos) x;
  if exists (select 1 from unnest(medios) m where m is null or m not in ('efectivo', 'transferencia', 'debito', 'credito', 'cuenta_corriente')) then
    raise exception 'Medio de pago no válido en el mostrador (MercadoPago lo confirma el webhook)';
  end if;
  medio_unico := case when cardinality(medios) = 1 then medios[1] end;  -- con pago mixto rige el precio de lista

  -- El turno se bloquea: si alguien lo está cerrando, esta venta espera y
  -- después ve que está cerrado. Nunca queda plata en un turno ya contado.
  if p_turno_id is not null then
    if not exists (select 1 from public.turnos_caja t join public.cajas c on c.id = t.caja_id
                    where t.id = p_turno_id and c.sede_id = p_sede_id) then
      raise exception 'La caja indicada no es de esta sede';
    end if;
    perform 1 from public.turnos_caja where id = p_turno_id and cerrado_en is null for update;
    if not found then raise exception 'La caja indicada no está abierta'; end if;
  elsif 'efectivo' = any (medios) then
    raise exception 'Para cobrar en efectivo tiene que haber una caja abierta en esta sede';
  end if;

  insert into public.ventas (gimnasio_id, sede_id, socio_id, estado, origen, turno_caja_id, creado_por, creado_en)
  values (p_gimnasio_id, p_sede_id, p_socio_id, 'pendiente', 'recepcion', p_turno_id, p_equipo_id, p_momento)
  returning id into vid;

  for it in select * from jsonb_array_elements(p_items) loop
    tipo := it ->> 'tipo';
    cant := coalesce((it ->> 'cantidad')::int, 1);
    if cant < 1 or cant > (case when tipo in ('cuota', 'servicio') then 12 else 50 end) then raise exception 'Cantidad inválida en el carrito'; end if;
    desc_ := round(coalesce((it ->> 'descuento')::numeric, 0), 2);
    if desc_ < 0 then raise exception 'El descuento no puede ser negativo'; end if;
    pl := null; pr := null; sus := null;

    if tipo = 'cuota' then
      if p_socio_id is null then raise exception 'Una cuota necesita un socio'; end if;
      select * into sus from public.suscripciones where socio_id = p_socio_id and baja_en is null;
      if not found then raise exception 'El socio no tiene una membresía activa'; end if;
      select * into pl from public.planes where id = sus.plan_id;
      descripcion := case when cant = 1 then 'Cuota ' || pl.nombre else cant || ' cuotas ' || pl.nombre end;
      -- VD-7 (D18): la primera cuota con día fijo puede ser parcial. Se cobra sola, con el cálculo a la vista.
      select * into per from privado.proximo_periodo(sus.id, p_momento);
      if per.p_parcial then
        if cant > 1 then
          raise exception 'La primera cuota es parcial (hasta el día fijo): cobrala sola y después las demás' using errcode = '22023';
        end if;
        select g.zona_horaria into zona_g from public.gimnasios g where g.id = p_gimnasio_id;
        descripcion := descripcion || ' (' || privado.texto_primera_cuota(per.p_modo, per.p_dias, per.p_dias_ciclo, per.p_hasta, zona_g) || ')';
      end if;
    elsif tipo in ('pase', 'pack') then
      if p_socio_id is null then raise exception 'Un pase o un pack necesita un socio (cargalo con el alta rápida)'; end if;
      select * into pl from public.planes where id = (it ->> 'plan_id')::uuid and gimnasio_id = p_gimnasio_id and activo;
      if not found then raise exception 'Plan inexistente o inactivo'; end if;
      if (tipo = 'pase' and pl.tipo <> 'pase_diario') or (tipo = 'pack' and pl.tipo <> 'pack') then
        raise exception 'El plan % no es un %', pl.nombre, tipo;
      end if;
      descripcion := case when cant = 1 then pl.nombre else cant || ' × ' || pl.nombre end;
    elsif tipo = 'producto' then
      select * into pr from public.productos where id = (it ->> 'producto_id')::uuid and gimnasio_id = p_gimnasio_id and activo and not recurrente;
      if not found then raise exception 'Producto inexistente o inactivo'; end if;
      descripcion := case when cant = 1 then pr.nombre else cant || ' × ' || pr.nombre end;
    elsif tipo = 'matricula' then
      -- PLA-3: la del plan del socio, si la debe. Una sola por venta (la segunda ya la ve cobrada).
      if p_socio_id is null then raise exception 'La matrícula necesita un socio'; end if;
      if cant <> 1 then raise exception 'La matrícula se cobra una vez'; end if;
      mat := privado.matricula_pendiente(p_socio_id, p_momento);
      if mat is null then raise exception 'Este socio no debe matrícula (ya la pagó, o su plan no tiene)' using errcode = '22023'; end if;
      select * into pl from public.planes where id = (mat ->> 'plan_id')::uuid;
      descripcion := 'Matrícula ' || pl.nombre;
    elsif tipo = 'recargo' then
      -- PLA-7: lo calcula la base; se guarda como 'adicional'. Una vez por venta.
      if p_socio_id is null then raise exception 'El recargo necesita un socio'; end if;
      if cant <> 1 or hay_recargo then raise exception 'El recargo se cobra una vez'; end if;
      rec := privado.recargo_pendiente(p_socio_id, p_momento);
      if rec is null then raise exception 'Este socio no tiene recargo por pagar tarde' using errcode = '22023'; end if;
      descripcion := 'Recargo por pagar tarde (' || (rec ->> 'atraso') || ' días)';
      hay_recargo := true;
    elsif tipo = 'deuda' then
      -- VEN-5: pagar (toda o parte de) la deuda a cuenta.
      if p_socio_id is null then raise exception 'Pagar una deuda necesita un socio'; end if;
      if cant <> 1 then raise exception 'La deuda se paga de a un monto'; end if;
      deuda := privado.deuda_socio(p_socio_id);
      if deuda <= 0 then raise exception 'Este socio no debe nada a cuenta' using errcode = '22023'; end if;
      if round(coalesce((it ->> 'precio_unitario')::numeric, 0), 2) <= 0 or round((it ->> 'precio_unitario')::numeric, 2) > deuda - hay_deuda then
        raise exception 'Se paga hasta lo que debe: %', privado.formato_pesos(deuda) using errcode = '22023';
      end if;
      hay_deuda := hay_deuda + round((it ->> 'precio_unitario')::numeric, 2);
      descripcion := 'Pago de deuda a cuenta';
    elsif tipo = 'servicio' then
      -- VD-17: un servicio adicional (locker, toalla…) que el socio tiene contratado; va con su cuota, mes a mes.
      if p_socio_id is null then raise exception 'Un servicio necesita un socio'; end if;
      select * into pr from public.productos where id = (it ->> 'producto_id')::uuid and gimnasio_id = p_gimnasio_id and activo and recurrente;
      if not found then raise exception 'Servicio inexistente o inactivo'; end if;
      if not exists (select 1 from public.servicios_socio ss where ss.socio_id = p_socio_id and ss.producto_id = pr.id and ss.hasta is null) then
        raise exception 'Este socio no tiene contratado %', pr.nombre using errcode = '22023';
      end if;
      descripcion := 'Servicio ' || pr.nombre || case when cant > 1 then ' (' || cant || ' meses)' else '' end;
      serv_cants := serv_cants || cant;
    elsif tipo = 'otro' then
      descripcion := nullif(trim(coalesce(it ->> 'descripcion', '')), '');
      if descripcion is null then raise exception 'Un ítem "otro" necesita descripción'; end if;
    else
      raise exception 'Tipo de ítem no válido: %', coalesce(tipo, '(vacío)');
    end if;

    precio := case
      when tipo = 'matricula' then (mat ->> 'monto')::numeric
      when tipo = 'recargo' then (rec ->> 'monto')::numeric
      when tipo = 'deuda' then round((it ->> 'precio_unitario')::numeric, 2)
      when tipo = 'cuota' then privado.escalar_cuota(privado.precio_para(pl.id, p_momento, medio_unico, p_sede_id, true), per.p_factor, per.p_redondeo)
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
      raise exception 'Tu descuento máximo es % %%: lo autoriza el dueño o el encargado', rtrim(to_char(p_tope_descuento, 'FM9990.99'), '.');
    end if;

    -- VEN-3 (D14): el convenio del socio se aplica solo a la cuota; no cuenta para el tope de la recepción.
    desc_conv := 0; motivo := nullif(trim(coalesce(it ->> 'descuento_motivo', '')), '');
    if tipo = 'cuota' then
      conv := privado.convenio_vigente(p_socio_id, p_momento);
      if conv is not null then
        desc_conv := least(subtotal - desc_, round(case when conv ->> 'tipo' = 'porcentaje' then precio * (conv ->> 'valor')::numeric / 100
                                                        else (conv ->> 'valor')::numeric end, 2) * cant);
        motivo := concat_ws('; ', 'Convenio ' || (conv ->> 'nombre'), motivo);
      end if;
    end if;

    insert into public.venta_items (gimnasio_id, venta_id, tipo, plan_id, producto_id, suscripcion_id, descripcion,
                                    cantidad, precio_unitario, descuento, descuento_motivo)
    values (p_gimnasio_id, vid, case when tipo = 'recargo' then 'adicional' when tipo = 'servicio' then 'producto' else tipo end, pl.id, pr.id, sus.id, descripcion, cant, precio, desc_ + desc_conv,
            motivo);
    total := total + subtotal - desc_ - desc_conv;
    if tipo = 'cuota' then hay_cuota := true; cuotas_n := cuotas_n + cant; end if;
  end loop;
  -- VD-17: los servicios se cobran con la cuota y por los mismos meses.
  if cardinality(serv_cants) > 0 then
    if cuotas_n = 0 then raise exception 'Los servicios adicionales se cobran junto con la cuota' using errcode = '22023'; end if;
    if exists (select 1 from unnest(serv_cants) c where c <> cuotas_n) then
      raise exception 'Los servicios se cobran por los mismos meses que la cuota (%)', cuotas_n using errcode = '22023';
    end if;
  end if;
  -- Con la cuota va el recargo, si corresponde (D8: siempre a la vista; no cobrarlo es un descuento con motivo).
  if hay_cuota and not hay_recargo and privado.recargo_pendiente(p_socio_id, p_momento) is not null then
    raise exception 'Falta el recargo por pagar tarde (%): va en el carrito; si no se lo cobrás, ponele un descuento con motivo.',
      privado.formato_pesos((privado.recargo_pendiente(p_socio_id, p_momento) ->> 'monto')::numeric) using errcode = '22023';
  end if;

  for pg in select * from jsonb_array_elements(p_pagos) loop
    if (pg ->> 'monto') is null or (pg ->> 'monto')::numeric <= 0 then raise exception 'Cada pago tiene que tener un monto mayor a cero'; end if;
    insert into public.pagos (gimnasio_id, venta_id, medio, monto, estado, turno_caja_id, aprobado_en, aprobado_por, creado_por, creado_en)
    values (p_gimnasio_id, vid, pg ->> 'medio', round((pg ->> 'monto')::numeric, 2), 'aprobado',
            case when pg ->> 'medio' = 'efectivo' then p_turno_id end, p_momento, p_equipo_id, p_equipo_id, p_momento);
    pagado := pagado + round((pg ->> 'monto')::numeric, 2);
  end loop;

  -- VEN-5: a cuenta solo si el gimnasio fía, a un socio, sin pagar deuda con deuda, y hasta el tope.
  select coalesce(sum(round((x ->> 'monto')::numeric, 2)), 0) into fiado from jsonb_array_elements(p_pagos) x where x ->> 'medio' = 'cuenta_corriente';
  if fiado > 0 then
    select case when c.fiado_activo then c.fiado_tope end into tope_fiado from public.configuracion_gimnasio c where c.gimnasio_id = p_gimnasio_id;
    if tope_fiado is null then raise exception 'Este gimnasio no fía' using errcode = '22023'; end if;
    if p_socio_id is null then raise exception 'A cuenta solo se le puede cobrar a un socio' using errcode = '22023'; end if;
    if hay_deuda > 0 then raise exception 'Una deuda no se paga a cuenta' using errcode = '22023'; end if;
    deuda := privado.deuda_socio(p_socio_id) - fiado;   -- los pagos de esta venta ya están insertados
    if deuda + fiado > tope_fiado then
      raise exception 'Supera el tope para fiar (%): ya debe % y quedaría en %', privado.formato_pesos(tope_fiado),
        privado.formato_pesos(deuda), privado.formato_pesos(deuda + fiado) using errcode = '22023';
    end if;
  end if;

  if pagado <> total then
    raise exception 'Los pagos suman % y el total es %', privado.formato_pesos(pagado), privado.formato_pesos(total);
  end if;

  generados := privado.confirmar_venta(vid, p_momento);
  return jsonb_build_object('venta_id', vid, 'total', total, 'generados', generados,
    'veredicto', case when p_socio_id is not null then to_jsonb(privado.calcular_acceso(p_socio_id, p_momento, p_sede_id)) end);
end $$;

create or replace function public.precios_venta(p_sede_id uuid, p_socio_id uuid default null) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare g uuid; e public.equipo; c public.configuracion_gimnasio; sus public.suscripciones; pl public.planes;
begin
  select gimnasio_id into g from public.sedes where id = p_sede_id;
  if g is null then raise exception 'Sin permiso o sede inexistente' using errcode = '42501'; end if;
  e := privado.exigir_equipo(g, array['dueno', 'encargado', 'recepcion']);
  if e.sede_id is not null and e.sede_id <> p_sede_id then raise exception 'Sin permiso para esa sede' using errcode = '42501'; end if;
  if p_socio_id is not null and not exists (select 1 from public.socios where id = p_socio_id and gimnasio_id = g) then
    raise exception 'El socio no es de este gimnasio';
  end if;
  select * into c from public.configuracion_gimnasio where gimnasio_id = g;
  if p_socio_id is not null then
    select * into sus from public.suscripciones where socio_id = p_socio_id and baja_en is null;
    if found then select * into pl from public.planes where id = sus.plan_id; end if;
  end if;
  return jsonb_build_object(
    'tope_descuento', case when e.rol = 'recepcion' then c.descuento_max_recepcion end,
    -- Los medios que acepta el gimnasio; sin Caja, el efectivo no (no hay dónde contarlo).
    'medios', to_jsonb(array(select m from unnest(c.medios_aceptados) m where not (m = 'efectivo' and 'caja' = any (c.secciones_apagadas)))),
    -- PLA-3: la matrícula del plan, si la debe (se calcula de lo cobrado; no se guarda).
    'matricula', case when p_socio_id is not null and c.cobra_membresia then privado.matricula_pendiente(p_socio_id, now()) end,
    -- PLA-7: el recargo por pagar tarde, si corresponde hoy.
    'recargo', case when p_socio_id is not null and c.cobra_membresia then privado.recargo_pendiente(p_socio_id, now()) end,
    -- VEN-3: el convenio vigente del socio (Vender lo muestra como línea aparte; la base lo aplica igual).
    'convenio', case when p_socio_id is not null then privado.convenio_vigente(p_socio_id, now()) end,
    -- VEN-5: lo que debe a cuenta y, si el gimnasio fía, cuánto más se le puede fiar.
    'deuda', case when p_socio_id is not null then nullif(privado.deuda_socio(p_socio_id), 0) end,
    'fiado', case when c.fiado_activo and p_socio_id is not null then
               jsonb_build_object('tope', c.fiado_tope, 'disponible', greatest(c.fiado_tope - privado.deuda_socio(p_socio_id), 0)) end,
    'cuota', case when pl.id is not null and c.cobra_membresia then jsonb_build_object(
               'plan_id', pl.id, 'plan', pl.nombre, 'duracion_meses', pl.duracion_meses,
               'precios', privado.precios_cuota(sus.id, pl.id, p_sede_id, now()) -> 'precios',
               -- VD-7: la primera cuota con día fijo, si es parcial ("10 días de 30"); null si es entera.
               'parcial', privado.precios_cuota(sus.id, pl.id, p_sede_id, now()) -> 'parcial') end,
    -- VD-17: los servicios adicionales que tiene contratados; la cuota los lleva (siempre a la vista, como el recargo).
    'servicios', case when p_socio_id is not null and c.cobra_membresia then coalesce((
               select jsonb_agg(jsonb_build_object('producto_id', pr.id, 'nombre', pr.nombre, 'precio', pr.precio) order by pr.orden, pr.nombre)
                 from public.servicios_socio ss join public.productos pr on pr.id = ss.producto_id
                where ss.socio_id = p_socio_id and ss.hasta is null and pr.activo and pr.recurrente), '[]'::jsonb) else '[]'::jsonb end,
    'pases', case when c.cobra_pase then coalesce((
               select jsonb_agg(jsonb_build_object('plan_id', p.id, 'nombre', p.nombre,
                                                   'precios', privado.precios_por_medio(p.id, p_sede_id, now())) order by p.orden, p.nombre)
                 from public.planes p where p.gimnasio_id = g and p.activo and p.tipo = 'pase_diario'), '[]'::jsonb) else '[]'::jsonb end,
    'packs', case when c.cobra_pack then coalesce((
               select jsonb_agg(jsonb_build_object('plan_id', p.id, 'nombre', p.nombre, 'cantidad_clases', p.cantidad_clases,
                                                   'precios', privado.precios_por_medio(p.id, p_sede_id, now())) order by p.orden, p.nombre)
                 from public.planes p where p.gimnasio_id = g and p.activo and p.tipo = 'pack'), '[]'::jsonb) else '[]'::jsonb end,
    'productos', coalesce((select jsonb_agg(jsonb_build_object('producto_id', pr.id, 'nombre', pr.nombre, 'precio', pr.precio)
                                            order by pr.orden, pr.nombre)
                             from public.productos pr where pr.gimnasio_id = g and pr.activo and not pr.recurrente), '[]'::jsonb)
  );
end $$;

-- ── Permisos ────────────────────────────────────────────────────────
revoke all on function privado.vender(uuid, uuid, uuid, jsonb, jsonb, uuid, uuid, numeric, timestamptz) from public;
revoke all on function public.precios_venta(uuid, uuid), public.productos_gimnasio(uuid), public.servicios_gimnasio(uuid),
  public.guardar_servicio(uuid, uuid, text, numeric, boolean), public.asignar_servicio(uuid, uuid, boolean), public.ajustes_planes(uuid),
  public.guardar_ajustes_plan(uuid, jsonb), public.ordenar_planes(uuid, uuid[]) from public, anon, authenticated;
grant execute on function public.precios_venta(uuid, uuid), public.productos_gimnasio(uuid), public.servicios_gimnasio(uuid),
  public.guardar_servicio(uuid, uuid, text, numeric, boolean), public.asignar_servicio(uuid, uuid, boolean), public.ajustes_planes(uuid),
  public.guardar_ajustes_plan(uuid, jsonb), public.ordenar_planes(uuid, uuid[]) to authenticated, service_role;

-- ── Verificación ────────────────────────────────────────────────────
do $$
declare f text;
begin
  if not (select relrowsecurity from pg_class where oid = 'public.servicios_socio'::regclass) then raise exception 'Verificación: servicios_socio sin RLS'; end if;
  foreach f in array array['public.servicios_gimnasio(uuid)', 'public.guardar_servicio(uuid, uuid, text, numeric, boolean)', 'public.asignar_servicio(uuid, uuid, boolean)',
                           'public.ajustes_planes(uuid)', 'public.guardar_ajustes_plan(uuid, jsonb)', 'public.ordenar_planes(uuid, uuid[])',
                           'public.productos_gimnasio(uuid)', 'public.precios_venta(uuid, uuid)',
                           'privado.vender(uuid, uuid, uuid, jsonb, jsonb, uuid, uuid, numeric, timestamptz)'] loop
    if not exists (select 1 from pg_proc where oid = f::regprocedure and 'search_path=""' = any (proconfig)) then
      raise exception 'Verificación: % sin search_path vacío', f;
    end if;
    if has_function_privilege('anon', f, 'execute') then raise exception 'Verificación: anon puede ejecutar %', f; end if;
  end loop;
  if (select count(*) from pg_proc p join pg_namespace s on s.oid = p.pronamespace where s.nspname = 'privado' and p.proname = 'vender') <> 1 then
    raise exception 'Verificación: privado.vender duplicada';
  end if;
  if position('servicio' in pg_get_functiondef('privado.vender(uuid, uuid, uuid, jsonb, jsonb, uuid, uuid, numeric, timestamptz)'::regprocedure)) = 0 then
    raise exception 'Verificación: vender no conoce el servicio';
  end if;
end $$;
