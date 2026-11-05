-- 0066 · Convenios y descuentos automáticos (VEN-3, decisión D14).
-- Un convenio (estudiante, empresa X, familiar) es un % o un monto fijo por
-- cuota. Se le asigna al socio, con vencimiento opcional, y Vender lo aplica
-- solo a la cuota: la base lo calcula y lo guarda como descuento con motivo
-- "Convenio X" (no cuenta para el tope de la recepción). En pantalla va como
-- una línea aparte.
--
--   convenios / socio_convenios (con RLS, FK compuestas)
--   convenios_gimnasio, guardar_convenio, asignar_convenio, quitar_convenio, convenio_socio
--   privado.convenio_vigente(socio, momento)
--   privado.vender y precios_venta: copias (0061) con el convenio. De paso,
--   el tope de la recepción se muestra "10 %" y no "10.00 %".

-- ── Guarda de entrada ───────────────────────────────────────────────
do $$
begin
  if to_regprocedure('public.stock_productos(uuid)') is null then raise exception 'Guarda: falta la migración 0065'; end if;
  if position('recargo_pendiente' in pg_get_functiondef('privado.vender(uuid, uuid, uuid, jsonb, jsonb, uuid, uuid, numeric, timestamptz)'::regprocedure)) = 0 then
    raise exception 'Guarda: privado.vender no es la de 0061';
  end if;
end $$;

create table if not exists public.convenios (
  id           uuid primary key default gen_random_uuid(),
  gimnasio_id  uuid not null references public.gimnasios(id),
  nombre       text not null check (length(trim(nombre)) between 1 and 60),
  tipo         text not null check (tipo in ('porcentaje', 'monto')),
  valor        numeric(12,2) not null check (valor > 0),
  activo       boolean not null default true,
  creado_en    timestamptz not null default now(),
  unique (gimnasio_id, id),
  unique (gimnasio_id, nombre),
  check (tipo <> 'porcentaje' or valor <= 100)
);
select privado.politicas_estandar('public.convenios', array['dueno', 'encargado', 'recepcion'], null);
revoke all on table public.convenios from anon;

create table if not exists public.socio_convenios (
  id           uuid primary key default gen_random_uuid(),
  gimnasio_id  uuid not null references public.gimnasios(id),
  socio_id     uuid not null,
  convenio_id  uuid not null,
  desde        timestamptz not null default now(),
  hasta        timestamptz,
  creado_por   uuid not null,
  quitado_en   timestamptz,
  quitado_por  uuid,
  unique (gimnasio_id, id),
  foreign key (gimnasio_id, socio_id) references public.socios (gimnasio_id, id),
  foreign key (gimnasio_id, convenio_id) references public.convenios (gimnasio_id, id),
  foreign key (gimnasio_id, creado_por) references public.equipo (gimnasio_id, id),
  foreign key (gimnasio_id, quitado_por) references public.equipo (gimnasio_id, id),
  check (hasta is null or hasta > desde),
  check ((quitado_en is null) = (quitado_por is null))
);
create unique index if not exists socio_convenios_uno_activo on public.socio_convenios (gimnasio_id, socio_id) where quitado_en is null;
select privado.politicas_estandar('public.socio_convenios', array['dueno', 'encargado', 'recepcion'], null);
revoke all on table public.socio_convenios from anon;

create or replace function privado.convenio_vigente(p_socio_id uuid, p_momento timestamptz) returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object('convenio_id', c.id, 'nombre', c.nombre, 'tipo', c.tipo, 'valor', c.valor, 'hasta', sc.hasta)
    from public.socio_convenios sc join public.convenios c on c.id = sc.convenio_id
   where sc.socio_id = p_socio_id and sc.quitado_en is null and c.activo
     and sc.desde <= p_momento and (sc.hasta is null or sc.hasta > p_momento)
   limit 1
$$;
revoke all on function privado.convenio_vigente(uuid, timestamptz) from public;

create or replace function public.convenios_gimnasio(p_gimnasio_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado', 'recepcion']);
  return coalesce((select jsonb_agg(jsonb_build_object('convenio_id', c.id, 'nombre', c.nombre, 'tipo', c.tipo, 'valor', c.valor, 'activo', c.activo,
                     'socios', (select count(*) from public.socio_convenios sc where sc.convenio_id = c.id and sc.quitado_en is null
                                  and (sc.hasta is null or sc.hasta > now()))) order by c.activo desc, c.nombre)
                     from public.convenios c where c.gimnasio_id = p_gimnasio_id), '[]'::jsonb);
end $$;

create or replace function public.guardar_convenio(p_gimnasio_id uuid, p_convenio_id uuid, p_nombre text, p_tipo text, p_valor numeric, p_activo boolean default true)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare cid uuid; n int;
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado']);
  if length(trim(coalesce(p_nombre, ''))) = 0 then raise exception 'Poné el nombre del convenio (ej: Estudiantes)' using errcode = '22023'; end if;
  if length(trim(p_nombre)) > 60 then raise exception 'El nombre puede tener hasta 60 letras' using errcode = '22023'; end if;
  if p_tipo is null or p_tipo not in ('porcentaje', 'monto') then raise exception 'Elegí si descuenta un porcentaje o un monto fijo' using errcode = '22023'; end if;
  if p_valor is null or p_valor <= 0 then raise exception 'El descuento tiene que ser mayor a cero' using errcode = '22023'; end if;
  if p_tipo = 'porcentaje' and p_valor > 100 then raise exception 'Un porcentaje va hasta 100' using errcode = '22023'; end if;
  if exists (select 1 from public.convenios where gimnasio_id = p_gimnasio_id and lower(nombre) = lower(trim(p_nombre)) and id is distinct from p_convenio_id) then
    raise exception 'Ya hay un convenio que se llama así' using errcode = '22023';
  end if;
  if p_convenio_id is null then
    insert into public.convenios (gimnasio_id, nombre, tipo, valor, activo) values (p_gimnasio_id, trim(p_nombre), p_tipo, round(p_valor, 2), coalesce(p_activo, true))
    returning id into cid;
  else
    update public.convenios set nombre = trim(p_nombre), tipo = p_tipo, valor = round(p_valor, 2), activo = coalesce(p_activo, activo)
     where id = p_convenio_id and gimnasio_id = p_gimnasio_id returning id into cid;
    get diagnostics n = row_count;
    if n <> 1 then raise exception 'Sin permiso o convenio inexistente' using errcode = '42501'; end if;
  end if;
  return cid;
end $$;

-- Reemplaza el que tenía. p_hasta: último día que rige (inclusive), o null.
create or replace function public.asignar_convenio(p_socio_id uuid, p_convenio_id uuid, p_hasta date default null) returns void
language plpgsql security definer set search_path = '' as $$
declare s public.socios; c public.convenios; eid uuid; zona text;
begin
  select * into s from public.socios where id = p_socio_id;
  if not found then raise exception 'Sin permiso o socio inexistente' using errcode = '42501'; end if;
  eid := privado.exigir_rol(s.gimnasio_id, array['dueno', 'encargado']);
  select * into c from public.convenios where id = p_convenio_id and gimnasio_id = s.gimnasio_id;
  if not found then raise exception 'Ese convenio no es de este gimnasio' using errcode = '22023'; end if;
  if not c.activo then raise exception 'El convenio % está desactivado', c.nombre using errcode = '22023'; end if;
  select zona_horaria into zona from public.gimnasios where id = s.gimnasio_id;
  if p_hasta is not null and p_hasta < privado.dia_local(now(), zona) then raise exception 'El vencimiento ya pasó' using errcode = '22023'; end if;
  update public.socio_convenios set quitado_en = now(), quitado_por = eid where socio_id = s.id and gimnasio_id = s.gimnasio_id and quitado_en is null;
  insert into public.socio_convenios (gimnasio_id, socio_id, convenio_id, hasta, creado_por)
  values (s.gimnasio_id, s.id, c.id, case when p_hasta is not null then privado.medianoche(p_hasta + 1, zona) end, eid);
end $$;

create or replace function public.quitar_convenio(p_socio_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare s public.socios; eid uuid; n int;
begin
  select * into s from public.socios where id = p_socio_id;
  if not found then raise exception 'Sin permiso o socio inexistente' using errcode = '42501'; end if;
  eid := privado.exigir_rol(s.gimnasio_id, array['dueno', 'encargado']);
  update public.socio_convenios set quitado_en = now(), quitado_por = eid where socio_id = s.id and gimnasio_id = s.gimnasio_id and quitado_en is null;
  get diagnostics n = row_count;
  if n = 0 then raise exception 'No tenía convenio' using errcode = '22023'; end if;
end $$;

create or replace function public.convenio_socio(p_socio_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare g uuid;
begin
  select gimnasio_id into g from public.socios where id = p_socio_id;
  if g is null then raise exception 'Sin permiso o socio inexistente' using errcode = '42501'; end if;
  perform privado.exigir_equipo(g, array['dueno', 'encargado', 'recepcion']);
  return privado.convenio_vigente(p_socio_id, now());
end $$;

-- ── Vender: copia de privado.vender (0061) con el convenio ──────────
create or replace function privado.vender(
  p_gimnasio_id uuid, p_sede_id uuid, p_socio_id uuid, p_items jsonb, p_pagos jsonb,
  p_turno_id uuid, p_equipo_id uuid, p_tope_descuento numeric, p_momento timestamptz
) returns jsonb
language plpgsql set search_path = '' as $$
declare
  it jsonb; pg jsonb; vid uuid; total numeric := 0; pagado numeric := 0; generados int;
  medio_unico text; tipo text; cant int; precio numeric; desc_ numeric; pl public.planes; pr public.productos;
  sus public.suscripciones; descripcion text; subtotal numeric; medios text[]; mat jsonb; rec jsonb; hay_cuota boolean := false; hay_recargo boolean := false; conv jsonb; desc_conv numeric; motivo text;
begin
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
  if exists (select 1 from unnest(medios) m where m is null or m not in ('efectivo', 'transferencia', 'debito', 'credito')) then
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
    if cant < 1 or cant > (case when tipo = 'cuota' then 12 else 50 end) then raise exception 'Cantidad inválida en el carrito'; end if;
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
    elsif tipo = 'otro' then
      descripcion := nullif(trim(coalesce(it ->> 'descripcion', '')), '');
      if descripcion is null then raise exception 'Un ítem "otro" necesita descripción'; end if;
    else
      raise exception 'Tipo de ítem no válido: %', coalesce(tipo, '(vacío)');
    end if;

    precio := case
      when tipo = 'matricula' then (mat ->> 'monto')::numeric
      when tipo = 'recargo' then (rec ->> 'monto')::numeric
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
    values (p_gimnasio_id, vid, case when tipo = 'recargo' then 'adicional' else tipo end, pl.id, pr.id, sus.id, descripcion, cant, precio, desc_ + desc_conv,
            motivo);
    total := total + subtotal - desc_ - desc_conv;
    if tipo = 'cuota' then hay_cuota := true; end if;
  end loop;
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

  if pagado <> total then
    raise exception 'Los pagos suman % y el total es %', privado.formato_pesos(pagado), privado.formato_pesos(total);
  end if;

  generados := privado.confirmar_venta(vid, p_momento);
  return jsonb_build_object('venta_id', vid, 'total', total, 'generados', generados,
    'veredicto', case when p_socio_id is not null then to_jsonb(privado.calcular_acceso(p_socio_id, p_momento, p_sede_id)) end);
end $$;

-- ── precios_venta: copia de 0061 con el convenio ────────────────────
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
    'cuota', case when pl.id is not null and c.cobra_membresia then jsonb_build_object(
               'plan_id', pl.id, 'plan', pl.nombre, 'duracion_meses', pl.duracion_meses,
               'precios', privado.precios_por_medio(pl.id, p_sede_id, now())) end,
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
                             from public.productos pr where pr.gimnasio_id = g and pr.activo), '[]'::jsonb)
  );
end $$;

revoke all on function privado.vender(uuid, uuid, uuid, jsonb, jsonb, uuid, uuid, numeric, timestamptz) from public;
revoke all on function public.convenios_gimnasio(uuid), public.guardar_convenio(uuid, uuid, text, text, numeric, boolean), public.asignar_convenio(uuid, uuid, date),
  public.quitar_convenio(uuid), public.convenio_socio(uuid), public.precios_venta(uuid, uuid) from public, anon, authenticated;
grant execute on function public.convenios_gimnasio(uuid), public.guardar_convenio(uuid, uuid, text, text, numeric, boolean), public.asignar_convenio(uuid, uuid, date),
  public.quitar_convenio(uuid), public.convenio_socio(uuid), public.precios_venta(uuid, uuid) to authenticated, service_role;

-- ── Verificación ────────────────────────────────────────────────────
do $$
declare f text;
begin
  if not (select relrowsecurity from pg_class where oid = 'public.convenios'::regclass) then raise exception 'Verificación: convenios sin RLS'; end if;
  if not (select relrowsecurity from pg_class where oid = 'public.socio_convenios'::regclass) then raise exception 'Verificación: socio_convenios sin RLS'; end if;
  foreach f in array array['public.convenios_gimnasio(uuid)', 'public.guardar_convenio(uuid, uuid, text, text, numeric, boolean)', 'public.asignar_convenio(uuid, uuid, date)',
                           'public.quitar_convenio(uuid)', 'public.convenio_socio(uuid)', 'public.precios_venta(uuid, uuid)'] loop
    if not exists (select 1 from pg_proc where oid = f::regprocedure and 'search_path=""' = any (proconfig)) then
      raise exception 'Verificación: % sin search_path vacío', f;
    end if;
    if has_function_privilege('anon', f, 'execute') then raise exception 'Verificación: anon puede ejecutar %', f; end if;
  end loop;
  if position('convenio_vigente' in pg_get_functiondef('privado.vender(uuid, uuid, uuid, jsonb, jsonb, uuid, uuid, numeric, timestamptz)'::regprocedure)) = 0 then
    raise exception 'Verificación: privado.vender no aplica el convenio';
  end if;
end $$;
