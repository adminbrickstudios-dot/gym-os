-- VD-46T · La base rechaza un descuento manual cuyo motivo no esté en la lista del gimnasio (VD-46C: motivos_beneficio).
-- Hasta ahora lo exigía solo la pantalla (un select): quien llamaba a vender() sin la pantalla podía escribir cualquier texto.
-- Motivos válidos de una línea con descuento:
--   · un motivo ACTIVO de motivos_beneficio del gimnasio (sin distinguir mayúsculas ni espacios de los bordes), o
--   · "Cupón X" con X un cupón ACTIVO del gimnasio (el cupón se valida y se registra por su lado).
-- El convenio del socio no pasa por acá: la base lo suma sola al motivo de la línea, nunca viene del cliente.
-- Se copia la definición VIGENTE de privado.vender (20261106004800: servicios adicionales 4700, stock 4800,
-- vencimiento 4000) con esa única condición más. public.vender no cambia (llama a privado.vender).

-- ── Guarda de entrada ──────────────────────────────────────────────
do $$
begin
  if to_regprocedure('privado.vender(uuid, uuid, uuid, jsonb, jsonb, uuid, uuid, numeric, timestamptz)') is null then raise exception 'Guarda: falta privado.vender'; end if;
  if to_regclass('public.motivos_beneficio') is null then raise exception 'Guarda: falta motivos_beneficio (VD-46C)'; end if;
  if to_regclass('public.cupones') is null then raise exception 'Guarda: falta cupones'; end if;
  if position('permite_stock_negativo' in pg_get_functiondef('privado.vender(uuid, uuid, uuid, jsonb, jsonb, uuid, uuid, numeric, timestamptz)'::regprocedure)) = 0 then
    raise exception 'Guarda: privado.vender no es la versión con stock (4800)';
  end if;
end $$;

create or replace function privado.motivo_descuento_valido(p_gimnasio_id uuid, p_motivo text) returns boolean
language sql stable set search_path = '' as $$
  select length(trim(coalesce(p_motivo, ''))) > 0 and (
    exists (select 1 from public.motivos_beneficio m
             where m.gimnasio_id = p_gimnasio_id and m.activo and lower(trim(m.nombre)) = lower(trim(p_motivo)))
    or exists (select 1 from public.cupones c
                where c.gimnasio_id = p_gimnasio_id and c.activo and trim(p_motivo) = 'Cupón ' || c.codigo))
$$;
revoke all on function privado.motivo_descuento_valido(uuid, text) from public, anon, authenticated;

-- ── Copia de 20261106004800 con la condición del motivo ─────────────
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
      -- VD-18: con stock llevado, no se vende más de lo que hay (salvo que el producto lo permita). El producto se
      -- bloquea: dos ventas a la vez no se llevan las mismas unidades. Lo ya cargado en este carrito cuenta.
      if pr.controla_stock and not pr.permite_stock_negativo then
        perform 1 from public.productos where id = pr.id for update;
        if privado.stock_producto(pr.id) < cant then
          raise exception 'De % quedan %: no alcanza para %', pr.nombre, greatest(privado.stock_producto(pr.id), 0), cant using errcode = '22023';
        end if;
      end if;
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
    -- VD-46T: el motivo de un descuento manual sale de la lista del gimnasio (o es un cupón que existe). Antes lo exigía solo la pantalla.
    if desc_ > 0 and not privado.motivo_descuento_valido(p_gimnasio_id, it ->> 'descuento_motivo') then
      raise exception 'El motivo del descuento de % no está en la lista del gimnasio: elegí uno de la lista (el dueño la edita en Configuración → Reglas)', descripcion;
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
revoke all on function privado.vender(uuid, uuid, uuid, jsonb, jsonb, uuid, uuid, numeric, timestamptz) from public;

-- ── Verificación ────────────────────────────────────────────────────
do $$
declare f text;
begin
  foreach f in array array['privado.vender(uuid, uuid, uuid, jsonb, jsonb, uuid, uuid, numeric, timestamptz)', 'privado.motivo_descuento_valido(uuid, text)'] loop
    if not exists (select 1 from pg_proc where oid = f::regprocedure and 'search_path=""' = any (proconfig)) then
      raise exception 'Verificación: % sin search_path vacío', f;
    end if;
    if has_function_privilege('anon', f, 'execute') then raise exception 'Verificación: anon puede ejecutar %', f; end if;
  end loop;
  if (select count(*) from pg_proc p join pg_namespace s on s.oid = p.pronamespace where s.nspname = 'privado' and p.proname = 'vender') <> 1 then
    raise exception 'Verificación: privado.vender duplicada';
  end if;
  if position('permite_stock_negativo' in pg_get_functiondef('privado.vender(uuid, uuid, uuid, jsonb, jsonb, uuid, uuid, numeric, timestamptz)'::regprocedure)) = 0 then
    raise exception 'Verificación: vender perdió el stock';
  end if;
  if position('servicio' in pg_get_functiondef('privado.vender(uuid, uuid, uuid, jsonb, jsonb, uuid, uuid, numeric, timestamptz)'::regprocedure)) = 0 then
    raise exception 'Verificación: vender perdió el servicio';
  end if;
  if position('motivo_descuento_valido' in pg_get_functiondef('privado.vender(uuid, uuid, uuid, jsonb, jsonb, uuid, uuid, numeric, timestamptz)'::regprocedure)) = 0 then
    raise exception 'Verificación: vender no valida el motivo del descuento';
  end if;
end $$;
