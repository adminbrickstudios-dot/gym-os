-- 0059 · Matrícula / inscripción por plan (PLA-3).
-- Cada plan puede tener una matrícula: un cargo único al darse de alta, o una
-- vez por año. Si el socio la debe no se guarda: se calcula de lo cobrado
-- (privado.matricula_pendiente). Vender la ofrece junto a la cuota y la cobra
-- como ítem 'matricula' (el tipo ya existía en venta_items); una venta anulada
-- la vuelve a deber.
--
--   planes.matricula / planes.matricula_anual
--   guardar_matricula_plan(plan, monto, anual)    dueño y encargado
--   matriculas_planes(gimnasio)                   para la pantalla de Planes
--   privado.matricula_pendiente(socio, momento)   la usa Vender y la venta
--   precios_venta y privado.vender: copias (0023 y 0009) con la matrícula

-- ── Guarda de entrada ───────────────────────────────────────────────
do $$
begin
  if to_regprocedure('public.guardar_actividades_plan(uuid, uuid[])') is null then raise exception 'Guarda: falta la migración 0058'; end if;
  if to_regprocedure('privado.vender(uuid, uuid, uuid, jsonb, jsonb, uuid, uuid, numeric, timestamptz)') is null then raise exception 'Guarda: falta privado.vender (0009)'; end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.venta_items'::regclass and pg_get_constraintdef(oid) like '%matricula%') then
    raise exception 'Guarda: venta_items no acepta el tipo matricula';
  end if;
end $$;

alter table public.planes add column if not exists matricula numeric(12,2);
alter table public.planes add column if not exists matricula_anual boolean not null default false;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'planes_matricula_positiva' and conrelid = 'public.planes'::regclass) then
    alter table public.planes add constraint planes_matricula_positiva check (matricula is null or matricula > 0);
  end if;
end $$;

-- La matrícula que debe hoy el socio: la de su plan activo, si no tiene una
-- cobrada (venta no anulada; si es anual, en los últimos 12 meses). Null si no debe.
create or replace function privado.matricula_pendiente(p_socio_id uuid, p_momento timestamptz) returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object('plan_id', pl.id, 'plan', pl.nombre, 'monto', pl.matricula, 'anual', pl.matricula_anual)
    from public.suscripciones su join public.planes pl on pl.id = su.plan_id
   where su.socio_id = p_socio_id and su.baja_en is null and pl.matricula is not null
     and not exists (select 1 from public.venta_items vi join public.ventas ve on ve.id = vi.venta_id
                      where ve.socio_id = p_socio_id and vi.tipo = 'matricula' and ve.estado <> 'anulada'
                        and (not pl.matricula_anual or ve.creado_en > p_momento - interval '1 year'))
   order by su.inicio desc limit 1
$$;
revoke all on function privado.matricula_pendiente(uuid, timestamptz) from public;

create or replace function public.guardar_matricula_plan(p_plan_id uuid, p_monto numeric, p_anual boolean default false) returns void
language plpgsql security definer set search_path = '' as $$
declare p public.planes; n int;
begin
  select * into p from public.planes where id = p_plan_id;
  if not found then raise exception 'Sin permiso o plan inexistente' using errcode = '42501'; end if;
  perform privado.exigir_equipo(p.gimnasio_id, array['dueno', 'encargado']);
  if p.tipo <> 'membresia' then raise exception 'La matrícula es de las membresías (no de pases ni packs)' using errcode = '22023'; end if;
  if p_monto is not null and p_monto <= 0 then raise exception 'La matrícula tiene que ser mayor a cero (vacío = sin matrícula)' using errcode = '22023'; end if;
  update public.planes set matricula = round(p_monto, 2), matricula_anual = coalesce(p_anual, false) and p_monto is not null
   where id = p.id and gimnasio_id = p.gimnasio_id;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'Sin permiso o plan inexistente' using errcode = '42501'; end if;
end $$;

create or replace function public.matriculas_planes(p_gimnasio_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado']);
  return coalesce((select jsonb_object_agg(p.id, jsonb_build_object('monto', p.matricula, 'anual', p.matricula_anual))
                     from public.planes p where p.gimnasio_id = p_gimnasio_id and p.matricula is not null), '{}'::jsonb);
end $$;

-- ── Vender: copia de privado.vender (0009) con el ítem matrícula ─────
create or replace function privado.vender(
  p_gimnasio_id uuid, p_sede_id uuid, p_socio_id uuid, p_items jsonb, p_pagos jsonb,
  p_turno_id uuid, p_equipo_id uuid, p_tope_descuento numeric, p_momento timestamptz
) returns jsonb
language plpgsql set search_path = '' as $$
declare
  it jsonb; pg jsonb; vid uuid; total numeric := 0; pagado numeric := 0; generados int;
  medio_unico text; tipo text; cant int; precio numeric; desc_ numeric; pl public.planes; pr public.productos;
  sus public.suscripciones; descripcion text; subtotal numeric; medios text[]; mat jsonb;
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
    elsif tipo = 'otro' then
      descripcion := nullif(trim(coalesce(it ->> 'descripcion', '')), '');
      if descripcion is null then raise exception 'Un ítem "otro" necesita descripción'; end if;
    else
      raise exception 'Tipo de ítem no válido: %', coalesce(tipo, '(vacío)');
    end if;

    precio := case
      when tipo = 'matricula' then (mat ->> 'monto')::numeric
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

-- ── precios_venta: copia de 0023 con la matrícula que debe ──────────
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
revoke all on function public.precios_venta(uuid, uuid), public.guardar_matricula_plan(uuid, numeric, boolean), public.matriculas_planes(uuid)
  from public, anon, authenticated;
grant execute on function public.precios_venta(uuid, uuid), public.guardar_matricula_plan(uuid, numeric, boolean), public.matriculas_planes(uuid)
  to authenticated, service_role;

-- ── Verificación ────────────────────────────────────────────────────
do $$
declare f text;
begin
  foreach f in array array['public.precios_venta(uuid, uuid)', 'public.guardar_matricula_plan(uuid, numeric, boolean)', 'public.matriculas_planes(uuid)'] loop
    if not exists (select 1 from pg_proc where oid = f::regprocedure and 'search_path=""' = any (proconfig)) then
      raise exception 'Verificación: % sin search_path vacío', f;
    end if;
    if has_function_privilege('anon', f, 'execute') then raise exception 'Verificación: anon puede ejecutar %', f; end if;
  end loop;
  if position('matricula_pendiente' in pg_get_functiondef('privado.vender(uuid, uuid, uuid, jsonb, jsonb, uuid, uuid, numeric, timestamptz)'::regprocedure)) = 0 then
    raise exception 'Verificación: privado.vender no cobra la matrícula';
  end if;
  if (select count(*) from pg_proc p join pg_namespace s on s.oid = p.pronamespace where s.nspname = 'privado' and p.proname = 'vender') <> 1 then
    raise exception 'Verificación: quedó más de una versión de privado.vender';
  end if;
end $$;
