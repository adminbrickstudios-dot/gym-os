-- H2c · Fechas de cobertura visibles y editables al cobrar y al dar de alta en el pasado.
-- La pantalla dice con letras "Cubre del 2/11 al 1/12" ANTES de confirmar y deja cambiar las dos fechas (dueño y encargado).
-- UNA sola función decide la cobertura: privado.proximo_periodo recibe las fechas elegidas (p_forzar_desde, p_forzar_hasta inclusive)
-- y las valida: desde <= hoy, hasta >= desde, sin pisar coberturas existentes, como máximo 12 meses. Sin fechas elegidas, igual que antes (H2b).
-- El MONTO no cambia solo al mover las fechas (no hay prorrateo): se ajusta a mano con lo que ya existe.
-- Queda guardado en el ítem: las fechas elegidas, la propuesta que había y quién las cambió; Control lo muestra (tipo "cobertura").
--   venta_items.cubre_desde / cubre_hasta (días, hasta inclusive) · cubre_propuesta_desde / _hasta (la propuesta) · cubre_cambiada_por (equipo)
--   privado.proximo_periodo(suscripción, momento, desde, hasta)   firma nueva (la de 2 parámetros se borra: dos versiones harían ambigua la llamada)
--   privado.confirmar_venta · privado.vender · normalizar_pagos_pasados · cargar_pagos_pasados   copias con las fechas de cobertura
--   public.linea_de_control   copia con el tipo "cobertura"
--   public.periodo_cuota_propuesto(sede, socio) · public.periodo_alta_propuesto(gimnasio, plan, alta, pago)   lo que ve la pantalla antes de confirmar
-- Solo reemplaza funciones y suma columnas nulas: no toca filas. Prueba: supabase/pruebas/fechas-cobertura.test.mjs.

do $$
begin
  if to_regprocedure('privado.proximo_periodo(uuid, timestamptz)') is null then raise exception 'Guarda: falta privado.proximo_periodo'; end if;
  if to_regprocedure('privado.confirmar_venta(uuid, timestamptz)') is null then raise exception 'Guarda: falta privado.confirmar_venta'; end if;
  if to_regprocedure('privado.vender(uuid, uuid, uuid, jsonb, jsonb, uuid, uuid, numeric, timestamptz)') is null then raise exception 'Guarda: falta privado.vender'; end if;
  if to_regprocedure('public.linea_de_control(uuid, date, date, text[], uuid, integer, text)') is null then raise exception 'Guarda: falta public.linea_de_control'; end if;
  if to_regprocedure('privado.fecha_importada(text)') is null then raise exception 'Guarda: falta privado.fecha_importada'; end if;
  if position('H2b' in pg_get_functiondef('privado.proximo_periodo(uuid, timestamptz)'::regprocedure)) = 0 then raise exception 'Guarda: falta H2b en proximo_periodo'; end if;
end $$;

-- ── Datos (nullable, sin backfill: lo viejo queda igual) ────────────
alter table public.venta_items add column if not exists cubre_desde date;
alter table public.venta_items add column if not exists cubre_hasta date;
alter table public.venta_items add column if not exists cubre_propuesta_desde timestamptz;
alter table public.venta_items add column if not exists cubre_propuesta_hasta timestamptz;
alter table public.venta_items add column if not exists cubre_cambiada_por uuid;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'venta_items_cubre_chk' and conrelid = 'public.venta_items'::regclass) then
    alter table public.venta_items add constraint venta_items_cubre_chk
      check ((cubre_desde is null) = (cubre_hasta is null) and (cubre_hasta is null or cubre_hasta >= cubre_desde));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'venta_items_cubre_cambiada_fk' and conrelid = 'public.venta_items'::regclass) then
    alter table public.venta_items add constraint venta_items_cubre_cambiada_fk
      foreign key (gimnasio_id, cubre_cambiada_por) references public.equipo (gimnasio_id, id);
  end if;
end $$;

-- ── La función que decide la cobertura, con las fechas elegidas ─────
drop function if exists privado.proximo_periodo(uuid, timestamptz);
create or replace function privado.proximo_periodo(
  p_suscripcion_id uuid, p_momento timestamptz, p_forzar_desde date default null, p_forzar_hasta date default null,
  out p_desde timestamptz, out p_hasta timestamptz, out p_ancla int,
  out p_parcial boolean, out p_modo text, out p_dias int, out p_dias_ciclo int, out p_factor numeric, out p_redondeo numeric
)
language plpgsql stable set search_path = '' as $$
declare
  s public.suscripciones; pl public.planes; rg record; zona text; hoy date;
  futuro timestamptz; ultimo timestamptz; ref timestamptz; inicio date; ult record; pe record; entrada boolean := false;
begin
  select * into s from public.suscripciones where id = p_suscripcion_id;
  if not found then raise exception 'Suscripción inexistente' using errcode = 'P0002'; end if;
  select * into pl from public.planes where id = s.plan_id;
  select * into rg from privado.regla_vencimiento(s.plan_id);
  select g.zona_horaria into zona from public.gimnasios g where g.id = s.gimnasio_id;
  hoy := privado.dia_local(p_momento, zona);
  p_parcial := false; p_factor := 1; p_redondeo := rg.p_redondeo;

  -- H2c: fechas elegidas por el dueño o el encargado. Las valida ESTA función (la misma que decide la cobertura): nada se calcula en la pantalla.
  if p_forzar_desde is not null or p_forzar_hasta is not null then
    if p_forzar_desde is null or p_forzar_hasta is null then raise exception 'Poné las dos fechas: desde y hasta.' using errcode = '22023'; end if;
    if p_forzar_desde < date '2000-01-01' then raise exception 'La fecha “desde” es imposible.' using errcode = '22023'; end if;
    -- "Hoy" es el de verdad (no el del momento del cobro): en una carga en el pasado el pago es de otro día y la cobertura puede empezar después de él.
    if p_forzar_desde > privado.dia_local(now(), zona) then
      raise exception 'La cobertura no puede empezar en el futuro: hoy es el %.', to_char(privado.dia_local(now(), zona), 'DD/MM/YYYY') using errcode = '22023';
    end if;
    if p_forzar_hasta < p_forzar_desde then raise exception 'El “hasta” no puede ser antes del “desde”.' using errcode = '22023'; end if;
    if p_forzar_hasta + 1 > (p_forzar_desde + interval '12 months')::date then
      raise exception 'Una cobertura dura como máximo 12 meses (del % hasta el %).', to_char(p_forzar_desde, 'DD/MM/YYYY'),
        to_char((p_forzar_desde + interval '12 months')::date - 1, 'DD/MM/YYYY') using errcode = '22023';
    end if;
    p_desde := privado.medianoche(p_forzar_desde, zona);
    p_hasta := privado.medianoche(p_forzar_hasta + 1, zona);
    select min(c.desde), max(c.hasta) into futuro, ultimo from public.coberturas c
     where c.suscripcion_id = s.id and c.anulada_en is null and c.desde < p_hasta and c.hasta > p_desde;
    if futuro is not null then
      raise exception 'Esas fechas se pisan con lo que ya está cubierto (del % al %).',
        to_char(privado.dia_local(futuro, zona), 'DD/MM/YYYY'), to_char(privado.dia_local(ultimo, zona) - 1, 'DD/MM/YYYY') using errcode = '22023';
    end if;
    p_ancla := extract(day from p_forzar_desde)::int;
    return;
  end if;

  select max(c.hasta) into futuro from public.coberturas c
   where c.suscripcion_id = s.id and c.anulada_en is null and c.hasta > p_momento;

  if futuro is not null then
    inicio := privado.dia_local(futuro, zona); ref := futuro;
  else
    select max(c.hasta) into ultimo from public.coberturas c
     where c.suscripcion_id = s.id and c.anulada_en is null and c.hasta <= p_momento;
    if ultimo is null then
      inicio := greatest(hoy, privado.dia_local(s.inicio, zona));
      entrada := rg.p_renovacion = 'dia_fijo';
      -- H2b: membresía cargada con inicio anterior a su creación (alta en el pasado / importación): la primera cuota
      -- cubre desde ese inicio si el primer período todavía no terminó.
      if rg.p_renovacion <> 'dia_fijo'
         and privado.dia_local(s.inicio, zona) < least(hoy, privado.dia_local(s.creado_en, zona))
         and privado.sumar_meses_ancla(privado.dia_local(s.inicio, zona), pl.duracion_meses,
                                       extract(day from privado.dia_local(s.inicio, zona))::int) > hoy then
        inicio := privado.dia_local(s.inicio, zona);
      end if;
    elsif pl.reinicio_tras_dias is not null and hoy - privado.dia_local(ultimo, zona) >= pl.reinicio_tras_dias then
      inicio := hoy;
      entrada := rg.p_renovacion = 'dia_fijo';
    elsif rg.p_renovacion = 'desde_pago' then
      inicio := hoy;
    elsif rg.p_renovacion = 'dia_fijo' then
      inicio := greatest(privado.ultimo_dia_x(hoy, rg.p_dia_fijo), privado.dia_local(ultimo, zona));
    else
      inicio := privado.dia_local(ultimo, zona); ref := ultimo;
    end if;
    if entrada then
      if rg.p_primera = 'completo' then
        inicio := privado.ultimo_dia_x(inicio, rg.p_dia_fijo);
      else
        select * into pe from privado.periodo_entrada(rg.p_dia_fijo, rg.p_primera, pl.duracion_meses, inicio);
        if pe.p_parcial then
          p_desde := privado.medianoche(pe.p_desde, zona);
          p_hasta := privado.medianoche(pe.p_hasta, zona);
          p_ancla := rg.p_dia_fijo;
          p_parcial := true; p_modo := rg.p_primera; p_dias := pe.p_dias; p_dias_ciclo := pe.p_dias_ciclo; p_factor := pe.p_factor;
          return;
        end if;
      end if;
    end if;
  end if;

  if ref is not null then
    -- Mantener el ancla de la última cuota si la cadena termina justo ahí;
    -- si terminó corrida (días devueltos), el ancla pasa a ser ese día.
    select c.hasta, c.ancla_dia into ult from public.coberturas c
     where c.suscripcion_id = s.id and c.anulada_en is null and c.origen <> 'compensacion' and c.hasta <= ref
     order by c.hasta desc limit 1;
    if found and ult.hasta = ref and ult.ancla_dia is not null then
      p_ancla := ult.ancla_dia;
    else
      p_ancla := extract(day from inicio)::int;
    end if;
  elsif rg.p_renovacion = 'dia_fijo' then
    p_ancla := rg.p_dia_fijo;
  else
    p_ancla := extract(day from inicio)::int;
  end if;

  p_desde := privado.medianoche(inicio, zona);
  p_hasta := privado.medianoche(privado.sumar_meses_ancla(inicio, pl.duracion_meses, p_ancla), zona);
  if p_hasta <= p_desde then
    p_hasta := privado.medianoche(privado.sumar_meses_ancla(inicio, pl.duracion_meses + 1, p_ancla), zona);
  end if;
end $$;
revoke all on function privado.proximo_periodo(uuid, timestamptz, date, date) from public, anon, authenticated;

-- ── Confirmar la venta con las fechas elegidas ──────────────────────
create or replace function privado.confirmar_venta(p_venta_id uuid, p_momento timestamptz) returns int
language plpgsql set search_path = '' as $$
declare
  v public.ventas; it public.venta_items; zona text; per record; pl public.planes; sus public.suscripciones;
  pagado numeric; total numeric; k int; n int; generados int := 0; prop record;
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
        -- H2c: si el cobro trae fechas elegidas, la propuesta y quién las cambió quedan guardadas junto al ítem.
        if it.cubre_desde is not null then
          if it.cantidad <> 1 then raise exception 'Las fechas se cambian cuando se cobra una sola cuota.' using errcode = '22023'; end if;
          select * into prop from privado.proximo_periodo(sus.id, p_momento);
          if prop.p_desde = privado.medianoche(it.cubre_desde, zona) and prop.p_hasta = privado.medianoche(it.cubre_hasta + 1, zona) then
            per := prop;   -- las mismas fechas que la propuesta: no hay nada que registrar
          else
            select * into per from privado.proximo_periodo(sus.id, p_momento, it.cubre_desde, it.cubre_hasta);
            update public.venta_items set cubre_propuesta_desde = prop.p_desde, cubre_propuesta_hasta = prop.p_hasta, cubre_cambiada_por = v.creado_por
             where id = it.id and gimnasio_id = v.gimnasio_id;
            get diagnostics n = row_count;
            if n <> 1 then raise exception 'No se pudo guardar el cambio de fechas'; end if;
          end if;
        else
          select * into per from privado.proximo_periodo(sus.id, p_momento);
        end if;
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

-- ── Cobrar con las fechas elegidas (solo dueño o encargado) ─────────
create or replace function privado.vender(
  p_gimnasio_id uuid, p_sede_id uuid, p_socio_id uuid, p_items jsonb, p_pagos jsonb,
  p_turno_id uuid, p_equipo_id uuid, p_tope_descuento numeric, p_momento timestamptz
) returns jsonb
language plpgsql set search_path = '' as $$
declare
  it jsonb; pg jsonb; vid uuid; total numeric := 0; pagado numeric := 0; generados int;
  medio_unico text; tipo text; cant int; precio numeric; desc_ numeric; pl public.planes; pr public.productos;
  sus public.suscripciones; descripcion text; subtotal numeric; medios text[]; mat jsonb; rec jsonb; hay_cuota boolean := false; hay_recargo boolean := false; conv jsonb; desc_conv numeric; motivo text; fiado numeric; deuda numeric; tope_fiado numeric; hay_deuda numeric := 0; per record; zona_g text; cuotas_n int := 0; serv_cants int[] := '{}'; cd date; ch date; erol text;
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
    pl := null; pr := null; sus := null; cd := null; ch := null;

    if tipo = 'cuota' then
      if p_socio_id is null then raise exception 'Una cuota necesita un socio'; end if;
      select * into sus from public.suscripciones where socio_id = p_socio_id and baja_en is null;
      if not found then raise exception 'El socio no tiene una membresía activa'; end if;
      select * into pl from public.planes where id = sus.plan_id;
      descripcion := case when cant = 1 then 'Cuota ' || pl.nombre else cant || ' cuotas ' || pl.nombre end;
      -- VD-7 (D18): la primera cuota con día fijo puede ser parcial. Se cobra sola, con el cálculo a la vista.
      select * into per from privado.proximo_periodo(sus.id, p_momento);
      -- H2c: fechas elegidas (solo dueño o encargado, una sola cuota). Se validan acá y otra vez al confirmar, con la misma función.
      if nullif(trim(coalesce(it ->> 'cubre_desde', '')), '') is not null or nullif(trim(coalesce(it ->> 'cubre_hasta', '')), '') is not null then
        begin
          cd := nullif(trim(coalesce(it ->> 'cubre_desde', '')), '')::date; ch := nullif(trim(coalesce(it ->> 'cubre_hasta', '')), '')::date;
        exception when others then raise exception 'Las fechas de lo que cubre la cuota no se entienden.' using errcode = '22023'; end;
        select e.rol into erol from public.equipo e where e.id = p_equipo_id;
        if erol is null or erol not in ('dueno', 'encargado') then
          raise exception 'Solo el dueño o el encargado puede cambiar las fechas de lo que cubre la cuota.' using errcode = '42501';
        end if;
        if cant <> 1 then raise exception 'Las fechas se cambian cuando se cobra una sola cuota.' using errcode = '22023'; end if;
        select * into per from privado.proximo_periodo(sus.id, p_momento, cd, ch);
        descripcion := descripcion || ' (del ' || to_char(cd, 'DD/MM') || ' al ' || to_char(ch, 'DD/MM') || ')';
      end if;
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
                                    cantidad, precio_unitario, descuento, descuento_motivo, cubre_desde, cubre_hasta)
    values (p_gimnasio_id, vid, case when tipo = 'recargo' then 'adicional' when tipo = 'servicio' then 'producto' else tipo end, pl.id, pr.id, sus.id, descripcion, cant, precio, desc_ + desc_conv,
            motivo, cd, ch);
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

-- ── Pagos pasados con las fechas elegidas ───────────────────────────
create or replace function privado.normalizar_pagos_pasados(p_gimnasio_id uuid, p_pagos jsonb, p_alta date) returns jsonb
language plpgsql stable set search_path = '' as $$
declare
  err text[] := '{}'; x jsonb; k int := 0; f date; m numeric; med text; c int; hoy date; zona text; ok_fila boolean;
  lista jsonb := '[]'::jsonb; ordenada jsonb; cdv date; chv date;
begin
  if p_pagos is null or jsonb_typeof(p_pagos) = 'null' then return jsonb_build_object('errores', '[]'::jsonb, 'pagos', '[]'::jsonb); end if;
  if jsonb_typeof(p_pagos) <> 'array' then raise exception 'Los pagos tienen que ser una lista' using errcode = '22023'; end if;
  if jsonb_array_length(p_pagos) > 36 then
    return jsonb_build_object('errores', to_jsonb(array['Hasta 36 pagos por socio']), 'pagos', '[]'::jsonb);
  end if;
  select g.zona_horaria into zona from public.gimnasios g where g.id = p_gimnasio_id;
  hoy := privado.dia_local(now(), coalesce(zona, 'America/Argentina/Buenos_Aires'));
  for x in select v from jsonb_array_elements(p_pagos) v loop
    k := k + 1; ok_fila := true; f := null; m := null; med := null; c := 1; cdv := null; chv := null;
    begin f := privado.fecha_importada(x ->> 'fecha');
    exception when others then err := array_append(err, format('Pago %s: la fecha “%s” no se entiende, usá día/mes/año', k, x ->> 'fecha')); ok_fila := false; end;
    if ok_fila and f is null then err := array_append(err, format('Pago %s: falta la fecha', k)); ok_fila := false; end if;
    if ok_fila and f > hoy then
      err := array_append(err, format('Pago %s: la fecha %s es futura. Solo se cargan pagos que ya pasaron.', k, to_char(f, 'DD/MM/YYYY'))); ok_fila := false;
    elsif ok_fila and f = hoy then
      err := array_append(err, format('Pago %s: la fecha es hoy. Un pago de hoy se cobra desde Cobrar, así entra en la caja de hoy.', k)); ok_fila := false;
    elsif ok_fila and f < date '2000-01-01' then
      err := array_append(err, format('Pago %s: la fecha %s es imposible', k, to_char(f, 'DD/MM/YYYY'))); ok_fila := false;
    elsif ok_fila and p_alta is not null and f < p_alta then
      err := array_append(err, format('Pago %s: la fecha %s es anterior a la fecha de alta (%s)', k, to_char(f, 'DD/MM/YYYY'), to_char(p_alta, 'DD/MM/YYYY'))); ok_fila := false;
    end if;
    begin m := privado.monto_importado(x ->> 'monto');
    exception when others then err := array_append(err, format('Pago %s: el monto “%s” no se entiende (escribí 25000 o 25000,50)', k, coalesce(x ->> 'monto', ''))); ok_fila := false; end;
    if m is not null and (m <= 0 or m >= 1000000000) then err := array_append(err, format('Pago %s: el monto tiene que ser mayor a cero y razonable', k)); ok_fila := false; end if;
    med := privado.medio_importado(x ->> 'medio');
    if med is null then
      err := array_append(err, case when nullif(trim(coalesce(x ->> 'medio', '')), '') is null then format('Pago %s: falta el medio de pago', k)
                                    else format('Pago %s: el medio “%s” no vale (efectivo, transferencia, débito o crédito)', k, x ->> 'medio') end);
      ok_fila := false;
    end if;
    if nullif(trim(coalesce(x ->> 'cuotas', '')), '') is not null then
      if (x ->> 'cuotas') !~ '^\d{1,2}$' or (x ->> 'cuotas')::int not between 1 and 12 then
        err := array_append(err, format('Pago %s: las cuotas son de 1 a 12', k)); ok_fila := false;
      else c := (x ->> 'cuotas')::int; end if;
    end if;
    if ok_fila and c > 1 and round(m / c, 2) * c <> m then
      err := array_append(err, format('Pago %s: el monto no se reparte en %s cuotas iguales', k, c)); ok_fila := false;
    end if;
    -- H2c: fechas de cobertura elegidas para este pago (opcionales; el resto lo valida proximo_periodo al cargar).
    if ok_fila and (nullif(trim(coalesce(x ->> 'cubre_desde', '')), '') is not null or nullif(trim(coalesce(x ->> 'cubre_hasta', '')), '') is not null) then
      begin cdv := privado.fecha_importada(x ->> 'cubre_desde'); chv := privado.fecha_importada(x ->> 'cubre_hasta');
      exception when others then err := array_append(err, format('Pago %s: las fechas de lo que cubre no se entienden, usá día/mes/año', k)); ok_fila := false; end;
      if ok_fila and (cdv is null or chv is null) then err := array_append(err, format('Pago %s: poné las dos fechas de lo que cubre, desde y hasta', k)); ok_fila := false; end if;
      if ok_fila and c <> 1 then err := array_append(err, format('Pago %s: las fechas de lo que cubre se cambian con una sola cuota', k)); ok_fila := false; end if;
    end if;
    if ok_fila then lista := lista || jsonb_build_array(jsonb_build_object('fecha', f, 'monto', m, 'medio', med, 'cuotas', c, 'orden', k, 'cubre_desde', cdv, 'cubre_hasta', chv)); end if;
  end loop;
  select coalesce(jsonb_agg(e - 'orden' order by (e ->> 'fecha')::date, (e ->> 'orden')::int), '[]'::jsonb) into ordenada
    from jsonb_array_elements(lista) e;
  return jsonb_build_object('errores', to_jsonb(err), 'pagos', ordenada);
end $$;
revoke all on function privado.normalizar_pagos_pasados(uuid, jsonb, date) from public, anon, authenticated;

create or replace function privado.cargar_pagos_pasados(
  p_gimnasio_id uuid, p_sede_id uuid, p_socio_id uuid, p_suscripcion_id uuid, p_pagos jsonb, p_alta date,
  p_equipo_id uuid, p_origen text, p_importacion_id uuid, p_motivo text
) returns jsonb
language plpgsql set search_path = '' as $$
declare
  norm jsonb; x jsonb; sus public.suscripciones; pl public.planes; zona text; momento timestamptz; vid uuid; iid uuid;
  carga_inicial boolean; k int; n int := 0; cob int := 0; gen int; total numeric := 0; esperado numeric := 0; guardado numeric;
  precio numeric; motivo text := coalesce(nullif(trim(p_motivo), ''), 'Carga de pagos anteriores');
begin
  norm := privado.normalizar_pagos_pasados(p_gimnasio_id, p_pagos, p_alta);
  if jsonb_array_length(norm -> 'errores') > 0 then
    raise exception '%', (norm -> 'errores') ->> 0 using errcode = '22023';
  end if;
  if jsonb_array_length(norm -> 'pagos') = 0 then return jsonb_build_object('pagos', 0, 'coberturas', 0, 'total', 0); end if;
  select * into sus from public.suscripciones s where s.id = p_suscripcion_id and s.gimnasio_id = p_gimnasio_id and s.socio_id = p_socio_id and s.baja_en is null;
  if not found then raise exception 'La membresía del socio no existe o no es de este gimnasio'; end if;
  if exists (select 1 from public.coberturas c where c.suscripcion_id = sus.id and c.anulada_en is null) then
    raise exception 'Este socio ya tiene cobertura: los pagos pasados se cargan solo al dar de alta' using errcode = '22023';
  end if;
  select * into pl from public.planes where id = sus.plan_id and gimnasio_id = p_gimnasio_id;
  if not found or pl.tipo <> 'membresia' then raise exception 'El plan del socio tiene que ser una membresía' using errcode = '22023'; end if;
  select g.zona_horaria, g.creado_en + interval '1 month' > now() into zona, carga_inicial from public.gimnasios g where g.id = p_gimnasio_id;
  if zona is null then raise exception 'No se encontró el gimnasio.'; end if;

  for x in select v from jsonb_array_elements(norm -> 'pagos') v loop
    -- Mediodía local del día del pago: es un día, no una hora.
    momento := privado.medianoche((x ->> 'fecha')::date, zona) + interval '12 hours';
    if momento >= now() then raise exception 'La fecha del pago no puede ser futura'; end if;
    precio := round((x ->> 'monto')::numeric / (x ->> 'cuotas')::int, 2);
    insert into public.ventas (gimnasio_id, sede_id, socio_id, estado, origen, turno_caja_id, creado_por, creado_en,
                               otro_dia_motivo, registrada_en, carga_inicial, importacion_id)
    values (p_gimnasio_id, p_sede_id, p_socio_id, 'pendiente', p_origen, null, p_equipo_id, momento,
            left(motivo, 200), now(), carga_inicial, p_importacion_id)
    returning id into vid;
    get diagnostics k = row_count;
    if k <> 1 then raise exception 'No se pudo cargar el pago del %', to_char((x ->> 'fecha')::date, 'DD/MM/YYYY'); end if;
    insert into public.venta_items (gimnasio_id, venta_id, tipo, plan_id, suscripcion_id, descripcion, cantidad, precio_unitario, cubre_desde, cubre_hasta)
    values (p_gimnasio_id, vid, 'cuota', pl.id, sus.id,
            case when (x ->> 'cuotas')::int = 1 then 'Cuota ' || pl.nombre else (x ->> 'cuotas') || ' cuotas ' || pl.nombre end,
            (x ->> 'cuotas')::int, precio, nullif(x ->> 'cubre_desde', '')::date, nullif(x ->> 'cubre_hasta', '')::date)
    returning id into iid;
    get diagnostics k = row_count;
    if k <> 1 then raise exception 'No se pudo cargar lo que se pagó el %', to_char((x ->> 'fecha')::date, 'DD/MM/YYYY'); end if;
    insert into public.pagos (gimnasio_id, venta_id, medio, monto, estado, turno_caja_id, aprobado_en, aprobado_por, creado_por, creado_en,
                              cargado_despues_en, cargado_despues_por)
    values (p_gimnasio_id, vid, x ->> 'medio', (x ->> 'monto')::numeric, 'aprobado', null, momento, p_equipo_id, p_equipo_id, momento,
            now(), p_equipo_id);
    get diagnostics k = row_count;
    if k <> 1 then raise exception 'No se pudo guardar el pago del %', to_char((x ->> 'fecha')::date, 'DD/MM/YYYY'); end if;
    gen := privado.confirmar_venta(vid, momento);
    if gen <> (x ->> 'cuotas')::int then raise exception 'El pago del % no armó su cobertura', to_char((x ->> 'fecha')::date, 'DD/MM/YYYY'); end if;
    n := n + 1; cob := cob + gen; esperado := esperado + (x ->> 'monto')::numeric;
  end loop;

  select coalesce(sum(p.monto), 0) into guardado from public.pagos p
   where p.gimnasio_id = p_gimnasio_id and p.cargado_despues_en is not null and p.turno_caja_id is null
     and p.venta_id in (select v.id from public.ventas v where v.gimnasio_id = p_gimnasio_id and v.socio_id = p_socio_id);
  if guardado <> esperado then raise exception 'Los pagos guardados suman % y se esperaban %', privado.formato_pesos(guardado), privado.formato_pesos(esperado); end if;
  total := esperado;
  return jsonb_build_object('pagos', n, 'coberturas', cob, 'total', total);
end $$;
revoke all on function privado.cargar_pagos_pasados(uuid, uuid, uuid, uuid, jsonb, date, uuid, text, uuid, text) from public, anon, authenticated;

-- ── Control: cobros con otras fechas ────────────────────────────────
create or replace function public.linea_de_control(
  p_gimnasio_id uuid, p_desde date, p_hasta date, p_tipos text[] default null, p_quien uuid default null,
  p_limite int default 50, p_cursor text default null
) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  validos constant text[] := array['cobro', 'anulacion', 'descuento', 'otro_dia', 'dejado_pasar', 'caja', 'precio',
                                   'configuracion', 'entrada_anulada', 'invitado', 'prestamo', 'cobertura'];
  tipos text[] := validos; zona text; ini timestamptz; fin timestamptz; lim int := coalesce(p_limite, 50);
  c_en timestamptz; c_clave text; filas jsonb; siguiente text; cuantas int;
begin
  perform privado.exigir_resultado(p_gimnasio_id);
  if p_desde is null or p_hasta is null then raise exception 'Elegí desde y hasta qué día.' using errcode = '22023'; end if;
  if p_hasta < p_desde then raise exception 'El "hasta" no puede ser antes del "desde".' using errcode = '22023'; end if;
  if p_hasta - p_desde > 366 then raise exception 'Se mira hasta un año por vez.' using errcode = '22023'; end if;
  if lim < 1 or lim > 200 then raise exception 'Se piden de 1 a 200 por vez.' using errcode = '22023'; end if;
  if p_tipos is not null and cardinality(p_tipos) > 0 then
    if exists (select 1 from unnest(p_tipos) t where t <> all (validos)) then raise exception 'Ese tipo de movimiento no existe.' using errcode = '22023'; end if;
    tipos := p_tipos;
  end if;
  if p_cursor is not null then
    if strpos(p_cursor, '|') = 0 then raise exception 'El cursor no es válido.' using errcode = '22023'; end if;
    begin
      c_en := split_part(p_cursor, '|', 1)::timestamptz;
    exception when others then
      raise exception 'El cursor no es válido.' using errcode = '22023';
    end;
    c_clave := substr(p_cursor, strpos(p_cursor, '|') + 1);
  end if;
  select g.zona_horaria into zona from public.gimnasios g where g.id = p_gimnasio_id;
  ini := privado.medianoche(p_desde, zona);
  fin := privado.medianoche(p_hasta + 1, zona);

  select coalesce(jsonb_agg(jsonb_build_object(
           'tipo', u.tipo, 'clave', u.clave, 'en', u.en, 'quien_id', u.quien_id, 'quien', q.nombre,
           'monto', u.monto, 'socio_id', u.socio_id, 'socio', nullif(trim(s.nombre || ' ' || s.apellido), ''),
           'detalle', u.detalle, 'extra', coalesce(u.extra, '{}'::jsonb)) order by u.en desc, u.clave desc), '[]'::jsonb)
    into filas
    from (
      select * from (
        -- Cobros (los anulados siguen estando: anular es un hecho nuevo)
        (select 'cobro'::text as tipo, v.confirmada_en as en, ('cobro:' || v.id::text) as clave, v.creado_por as quien_id,
                (select coalesce(sum(i.cantidad * i.precio_unitario - i.descuento), 0) from public.venta_items i where i.venta_id = v.id)::numeric as monto,
                v.socio_id as socio_id,
                (select string_agg(i.descripcion, ', ' order by i.descripcion) from public.venta_items i where i.venta_id = v.id)::text as detalle,
                jsonb_build_object('venta_id', v.id, 'anulada', v.estado = 'anulada',
                                   'medios', (select string_agg(distinct p.medio, ', ') from public.pagos p where p.venta_id = v.id)) as extra
           from public.ventas v
          where 'cobro' = any (tipos) and v.gimnasio_id = p_gimnasio_id and v.estado in ('confirmada', 'anulada')
            and v.confirmada_en >= ini and v.confirmada_en < fin
            and (p_quien is null or v.creado_por = p_quien)
            and (c_en is null or (v.confirmada_en, 'cobro:' || v.id::text) < (c_en, c_clave))
          order by v.confirmada_en desc, ('cobro:' || v.id::text) desc limit lim + 1)
        union all
        -- Anulaciones, con quién la pidió y quién la aprobó
        (select 'anulacion'::text, v.anulada_en, 'anulacion:' || v.id::text, v.anulada_por,
                (select coalesce(sum(i.cantidad * i.precio_unitario - i.descuento), 0) from public.venta_items i where i.venta_id = v.id)::numeric,
                v.socio_id, v.anulada_motivo::text,
                jsonb_build_object('venta_id', v.id, 'pidio', pa.pidio, 'aprobo', pa.aprobo)
           from public.ventas v
           left join lateral (select qp.nombre as pidio, qa.nombre as aprobo
                                from public.pedidos_anulacion x
                                left join public.equipo qp on qp.id = x.pedido_por
                                left join public.equipo qa on qa.id = x.resuelto_por
                               where x.venta_id = v.id and x.estado = 'aprobado'
                               order by x.resuelto_en desc limit 1) pa on true
          where 'anulacion' = any (tipos) and v.gimnasio_id = p_gimnasio_id
            and v.anulada_en >= ini and v.anulada_en < fin
            and (p_quien is null or v.anulada_por = p_quien)
            and (c_en is null or (v.anulada_en, 'anulacion:' || v.id::text) < (c_en, c_clave))
          order by v.anulada_en desc, ('anulacion:' || v.id::text) desc limit lim + 1)
        union all
        -- Descuentos (cada línea con descuento)
        (select 'descuento'::text, v.confirmada_en, 'descuento:' || i.id::text, v.creado_por,
                i.descuento::numeric, v.socio_id,
                (i.descripcion || ': ' || coalesce(i.descuento_motivo, 'sin motivo'))::text,
                jsonb_build_object('venta_id', v.id, 'anulada', v.estado = 'anulada',
                                   'porcentaje', round(i.descuento * 100 / nullif(i.cantidad * i.precio_unitario, 0)))
           from public.venta_items i join public.ventas v on v.id = i.venta_id
          where 'descuento' = any (tipos) and v.gimnasio_id = p_gimnasio_id and i.gimnasio_id = p_gimnasio_id
            and i.descuento > 0 and v.estado in ('confirmada', 'anulada')
            and v.confirmada_en >= ini and v.confirmada_en < fin
            and (p_quien is null or v.creado_por = p_quien)
            and (c_en is null or (v.confirmada_en, 'descuento:' || i.id::text) < (c_en, c_clave))
          order by v.confirmada_en desc, ('descuento:' || i.id::text) desc limit lim + 1)
        union all
        -- "Cobré otro día": cuándo se cargó de verdad, y de qué fecha es el cobro
        (select 'otro_dia'::text, v.registrada_en, 'otro_dia:' || v.id::text, v.creado_por,
                (select coalesce(sum(i.cantidad * i.precio_unitario - i.descuento), 0) from public.venta_items i where i.venta_id = v.id)::numeric,
                v.socio_id, v.otro_dia_motivo::text,
                jsonb_build_object('venta_id', v.id, 'cobrado_el', v.confirmada_en, 'anulada', v.estado = 'anulada')
           from public.ventas v
          where 'otro_dia' = any (tipos) and v.gimnasio_id = p_gimnasio_id and v.otro_dia_motivo is not null
            and v.registrada_en >= ini and v.registrada_en < fin
            and (p_quien is null or v.creado_por = p_quien)
            and (c_en is null or (v.registrada_en, 'otro_dia:' || v.id::text) < (c_en, c_clave))
          order by v.registrada_en desc, ('otro_dia:' || v.id::text) desc limit lim + 1)
        union all
        -- H2c: cobros donde se cambiaron las fechas de lo que cubre (quién, y cuál era la propuesta)
        (select 'cobertura'::text, coalesce(v.registrada_en, v.confirmada_en), 'cobertura:' || i.id::text, i.cubre_cambiada_por,
                (i.cantidad * i.precio_unitario - i.descuento)::numeric, v.socio_id,
                ('Cubre del ' || to_char(i.cubre_desde, 'DD/MM/YYYY') || ' al ' || to_char(i.cubre_hasta, 'DD/MM/YYYY')
                 || ' (la propuesta era del ' || to_char((i.cubre_propuesta_desde at time zone zona)::date, 'DD/MM/YYYY')
                 || ' al ' || to_char((i.cubre_propuesta_hasta at time zone zona)::date - 1, 'DD/MM/YYYY') || ')')::text,
                jsonb_build_object('venta_id', v.id, 'desde', i.cubre_desde, 'hasta', i.cubre_hasta,
                                   'propuesta_desde', i.cubre_propuesta_desde, 'propuesta_hasta', i.cubre_propuesta_hasta, 'anulada', v.estado = 'anulada')
           from public.venta_items i join public.ventas v on v.gimnasio_id = i.gimnasio_id and v.id = i.venta_id
          where 'cobertura' = any (tipos) and v.gimnasio_id = p_gimnasio_id and i.gimnasio_id = p_gimnasio_id
            and i.cubre_cambiada_por is not null and v.estado in ('confirmada', 'anulada')
            and coalesce(v.registrada_en, v.confirmada_en) >= ini and coalesce(v.registrada_en, v.confirmada_en) < fin
            and (p_quien is null or i.cubre_cambiada_por = p_quien)
            and (c_en is null or (coalesce(v.registrada_en, v.confirmada_en), 'cobertura:' || i.id::text) < (c_en, c_clave))
          order by coalesce(v.registrada_en, v.confirmada_en) desc, ('cobertura:' || i.id::text) desc limit lim + 1)
        union all
        -- Dejados pasar (con la promesa de pago, si la hubo)
        (select 'dejado_pasar'::text, i.momento, 'dejado:' || i.id::text, i.registrado_por,
                null::numeric, i.socio_id, coalesce(i.forzado_motivo, 'sin motivo')::text,
                jsonb_build_object('ingreso_id', i.id, 'promete_el', pp.promete_el, 'modo', pp.modo, 'anulado', i.anulado_en is not null)
           from public.ingresos i
           left join public.promesas_pago pp on pp.gimnasio_id = i.gimnasio_id and pp.ingreso_id = i.id
          where 'dejado_pasar' = any (tipos) and i.gimnasio_id = p_gimnasio_id and i.resultado = 'forzado'
            and i.momento >= ini and i.momento < fin
            and (p_quien is null or i.registrado_por = p_quien)
            and (c_en is null or (i.momento, 'dejado:' || i.id::text) < (c_en, c_clave))
          order by i.momento desc, ('dejado:' || i.id::text) desc limit lim + 1)
        union all
        -- Cajas: abrió
        (select 'caja'::text, t.abierto_en, 'caja_abre:' || t.id::text, t.abierto_por,
                t.monto_inicial::numeric, null::uuid, c.nombre::text,
                jsonb_build_object('evento', 'abrio', 'turno_id', t.id)
           from public.turnos_caja t join public.cajas c on c.id = t.caja_id
          where 'caja' = any (tipos) and t.gimnasio_id = p_gimnasio_id
            and t.abierto_en >= ini and t.abierto_en < fin
            and (p_quien is null or t.abierto_por = p_quien)
            and (c_en is null or (t.abierto_en, 'caja_abre:' || t.id::text) < (c_en, c_clave))
          order by t.abierto_en desc, ('caja_abre:' || t.id::text) desc limit lim + 1)
        union all
        -- Cajas: cerró contando (el monto es la diferencia: contado menos esperado)
        (select 'caja'::text, t.cerrado_en, 'caja_cierra:' || t.id::text, t.cerrado_por,
                (t.monto_contado - t.monto_esperado)::numeric, null::uuid, (c.nombre || coalesce(': ' || t.nota, ''))::text,
                jsonb_build_object('evento', 'cerro', 'turno_id', t.id, 'contado', t.monto_contado, 'esperado', t.monto_esperado)
           from public.turnos_caja t join public.cajas c on c.id = t.caja_id
          where 'caja' = any (tipos) and t.gimnasio_id = p_gimnasio_id and t.cerrado_en is not null and not t.sin_contar
            and t.cerrado_en >= ini and t.cerrado_en < fin
            and (p_quien is null or t.cerrado_por = p_quien)
            and (c_en is null or (t.cerrado_en, 'caja_cierra:' || t.id::text) < (c_en, c_clave))
          order by t.cerrado_en desc, ('caja_cierra:' || t.id::text) desc limit lim + 1)
        union all
        -- Cajas: quedó sin contar (nadie es responsable del conteo hasta que alguien la cuenta)
        (select 'caja'::text, t.sin_contar_en, 'caja_sin_contar:' || t.id::text, null::uuid,
                null::numeric, null::uuid, c.nombre::text,
                jsonb_build_object('evento', 'sin_contar', 'turno_id', t.id, 'esperado', t.monto_esperado, 'contado', t.monto_contado,
                                   'revisada', t.revisado_en is not null, 'nota', t.revisado_nota)
           from public.turnos_caja t join public.cajas c on c.id = t.caja_id
          where 'caja' = any (tipos) and t.gimnasio_id = p_gimnasio_id and p_quien is null and t.sin_contar
            and t.sin_contar_en >= ini and t.sin_contar_en < fin
            and (c_en is null or (t.sin_contar_en, 'caja_sin_contar:' || t.id::text) < (c_en, c_clave))
          order by t.sin_contar_en desc, ('caja_sin_contar:' || t.id::text) desc limit lim + 1)
        union all
        -- Precios de planes (cada precio nuevo es una fila nueva: nada se pisa)
        (select 'precio'::text, pp.creado_en, 'precio:' || pp.id::text, e.id,
                pp.monto::numeric, null::uuid, p.nombre::text,
                jsonb_build_object('que', 'plan', 'vigente_desde', pp.vigente_desde, 'medio', pp.medio_pago)
           from public.precios_plan pp
           join public.planes p on p.id = pp.plan_id
           left join public.equipo e on e.gimnasio_id = pp.gimnasio_id and e.usuario_id = pp.creado_por
          where 'precio' = any (tipos) and pp.gimnasio_id = p_gimnasio_id
            and pp.creado_en >= ini and pp.creado_en < fin
            and (p_quien is null or e.id = p_quien)
            and (c_en is null or (pp.creado_en, 'precio:' || pp.id::text) < (c_en, c_clave))
          order by pp.creado_en desc, ('precio:' || pp.id::text) desc limit lim + 1)
        union all
        -- Precios de productos (los anota el trigger en historial_configuracion)
        (select 'precio'::text, h.cambiado_en, 'precio_producto:' || h.id::text, h.equipo_id,
                case when jsonb_typeof(h.despues) = 'number' then (h.despues #>> '{}')::numeric end,
                null::uuid, regexp_replace(h.campo, '^producto\.(.*)\.precio$', '\1')::text,
                jsonb_build_object('que', 'producto', 'antes', h.antes)
           from public.historial_configuracion h
          where 'precio' = any (tipos) and h.gimnasio_id = p_gimnasio_id and h.campo ~ '^producto\..*\.precio$'
            and h.cambiado_en >= ini and h.cambiado_en < fin
            and (p_quien is null or h.equipo_id = p_quien)
            and (c_en is null or (h.cambiado_en, 'precio_producto:' || h.id::text) < (c_en, c_clave))
          order by h.cambiado_en desc, ('precio_producto:' || h.id::text) desc limit lim + 1)
        union all
        -- Cambios de configuración
        (select 'configuracion'::text, h.cambiado_en, 'config:' || h.id::text, h.equipo_id,
                null::numeric, null::uuid, h.campo::text,
                jsonb_build_object('antes', h.antes, 'despues', h.despues)
           from public.historial_configuracion h
          where 'configuracion' = any (tipos) and h.gimnasio_id = p_gimnasio_id and h.campo !~ '^producto\..*\.precio$'
            and h.cambiado_en >= ini and h.cambiado_en < fin
            and (p_quien is null or h.equipo_id = p_quien)
            and (c_en is null or (h.cambiado_en, 'config:' || h.id::text) < (c_en, c_clave))
          order by h.cambiado_en desc, ('config:' || h.id::text) desc limit lim + 1)
        union all
        -- Entradas anuladas
        (select 'entrada_anulada'::text, i.anulado_en, 'entrada_anulada:' || i.id::text, i.anulado_por,
                null::numeric, i.socio_id, i.anulado_motivo::text,
                jsonb_build_object('ingreso_id', i.id, 'momento', i.momento, 'resultado', i.resultado)
           from public.ingresos i
          where 'entrada_anulada' = any (tipos) and i.gimnasio_id = p_gimnasio_id and i.anulado_en is not null
            and i.anulado_en >= ini and i.anulado_en < fin
            and (p_quien is null or i.anulado_por = p_quien)
            and (c_en is null or (i.anulado_en, 'entrada_anulada:' || i.id::text) < (c_en, c_clave))
          order by i.anulado_en desc, ('entrada_anulada:' || i.id::text) desc limit lim + 1)
        union all
        -- Invitados (quién invitó; lo cargó el equipo o el propio socio desde la app)
        (select 'invitado'::text, iv.creado_en, 'invitado:' || iv.id::text, e.id,
                null::numeric, iv.socio_id, iv.nombre::text,
                jsonb_build_object('invitado_id', iv.id, 'para_el_dia', iv.para_el_dia, 'desde_la_app', iv.desde_la_app,
                                   'entro', iv.entro_en is not null, 'anulado', iv.anulado_en is not null)
           from public.invitados iv
           left join public.equipo e on e.gimnasio_id = iv.gimnasio_id and e.usuario_id = iv.creado_por
          where 'invitado' = any (tipos) and iv.gimnasio_id = p_gimnasio_id
            and iv.creado_en >= ini and iv.creado_en < fin
            and (p_quien is null or e.id = p_quien)
            and (c_en is null or (iv.creado_en, 'invitado:' || iv.id::text) < (c_en, c_clave))
          order by iv.creado_en desc, ('invitado:' || iv.id::text) desc limit lim + 1)
        union all
        -- Anti-préstamo: volvió a entrar por otra vía en pocos minutos
        (select 'prestamo'::text, a.momento, 'prestamo:' || a.id::text, null::uuid,
                null::numeric, a.socio_id, ('Volvió a entrar a los ' || a.minutos || ' min por otra vía')::text,
                jsonb_build_object('alerta_id', a.id, 'minutos', a.minutos, 'via_anterior', a.via_anterior, 'via_nueva', a.via_nueva)
           from public.alertas_prestamo a
          where 'prestamo' = any (tipos) and a.gimnasio_id = p_gimnasio_id and p_quien is null
            and a.momento >= ini and a.momento < fin
            and (c_en is null or (a.momento, 'prestamo:' || a.id::text) < (c_en, c_clave))
          order by a.momento desc, ('prestamo:' || a.id::text) desc limit lim + 1)
      ) b
      order by b.en desc, b.clave desc
      limit lim + 1
    ) u
    left join public.equipo q on q.id = u.quien_id
    left join public.socios s on s.id = u.socio_id;

  cuantas := jsonb_array_length(filas);
  if cuantas > lim then
    select jsonb_agg(f order by o) into filas from jsonb_array_elements(filas) with ordinality t(f, o) where o <= lim;
    siguiente := ((filas -> (lim - 1)) ->> 'en') || '|' || ((filas -> (lim - 1)) ->> 'clave');
  end if;
  return jsonb_build_object('items', filas, 'siguiente', siguiente);
end $$;
revoke all on function public.linea_de_control(uuid, date, date, text[], uuid, int, text) from public, anon, authenticated;
grant execute on function public.linea_de_control(uuid, date, date, text[], uuid, int, text) to authenticated, service_role;

-- ── Lo que ve la pantalla antes de confirmar ────────────────────────
-- Cobrar: la propuesta de la próxima cuota del socio ("Cubre del 2/11 al 1/12"), "cubierto hasta" y si puede cambiar las fechas.
create or replace function public.periodo_cuota_propuesto(p_sede_id uuid, p_socio_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare g uuid; e public.equipo; op public.equipo; sus public.suscripciones; per record; zona text; hoy date;
begin
  select gimnasio_id into g from public.sedes where id = p_sede_id;
  if g is null then raise exception 'Sin permiso o sede inexistente' using errcode = '42501'; end if;
  e := privado.exigir_equipo(g, array['dueno', 'encargado', 'recepcion']);
  if e.sede_id is not null and e.sede_id <> p_sede_id then raise exception 'Sin permiso para esa sede' using errcode = '42501'; end if;
  if not exists (select 1 from public.socios where id = p_socio_id and gimnasio_id = g) then raise exception 'El socio no es de este gimnasio'; end if;
  op := privado.operador(g);
  select * into sus from public.suscripciones where socio_id = p_socio_id and baja_en is null and gimnasio_id = g;
  if not found then return null; end if;
  select g2.zona_horaria into zona from public.gimnasios g2 where g2.id = g;
  hoy := privado.dia_local(now(), zona);
  select * into per from privado.proximo_periodo(sus.id, now());
  return jsonb_build_object(
    'desde', privado.dia_local(per.p_desde, zona), 'hasta', privado.dia_local(per.p_hasta, zona) - 1,
    'cubierto_hasta', privado.dia_local(per.p_hasta, zona) - 1, 'hoy', hoy, 'zona', zona,
    'puede_cambiar', coalesce(op.rol, e.rol) in ('dueno', 'encargado'), 'parcial', per.p_parcial);
end $$;

-- Alta en el pasado: la propuesta de la cuota que se carga con fecha de alta y fecha de pago, calculada por la MISMA función
-- sobre una membresía de mentira dentro de una subtransacción que se descarta (no queda nada; el contador de socios tampoco avanza).
create or replace function public.periodo_alta_propuesto(p_gimnasio_id uuid, p_plan_id uuid, p_fecha_alta date, p_fecha_pago date) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare zona text; hoy date; sid uuid; sus uuid; per record; r jsonb; det text; pago date := coalesce(p_fecha_pago, p_fecha_alta);
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado']);
  select g.zona_horaria into zona from public.gimnasios g where g.id = p_gimnasio_id;
  if zona is null then raise exception 'No se encontró el gimnasio.'; end if;
  hoy := privado.dia_local(now(), zona);
  if p_plan_id is null then raise exception 'Elegí el plan' using errcode = '22023'; end if;
  if p_fecha_alta is null then raise exception 'Cargá la fecha de alta' using errcode = '22023'; end if;
  if p_fecha_alta > hoy or pago > hoy then raise exception 'Las fechas no pueden ser futuras' using errcode = '22023'; end if;
  if pago < p_fecha_alta then raise exception 'El pago no puede ser anterior a la fecha de alta' using errcode = '22023'; end if;
  perform privado.validar_plan_nuevo(p_gimnasio_id, p_plan_id);
  begin
    insert into public.socios (gimnasio_id, nombre, apellido, creado_en) values (p_gimnasio_id, 'Vista', 'previa', privado.medianoche(p_fecha_alta, zona)) returning id into sid;
    insert into public.suscripciones (gimnasio_id, socio_id, plan_id, inicio, creado_por)
    values (p_gimnasio_id, sid, p_plan_id, least(now(), privado.medianoche(p_fecha_alta, zona)), auth.uid()) returning id into sus;
    select * into per from privado.proximo_periodo(sus, privado.medianoche(pago, zona) + interval '12 hours');
    r := jsonb_build_object('desde', privado.dia_local(per.p_desde, zona), 'hasta', privado.dia_local(per.p_hasta, zona) - 1,
                            'cubierto_hasta', privado.dia_local(per.p_hasta, zona) - 1, 'hoy', hoy, 'zona', zona);
    raise exception 'vista previa' using errcode = 'P0777', detail = r::text;
  exception when sqlstate 'P0777' then
    get stacked diagnostics det = pg_exception_detail;
    r := det::jsonb;
  end;
  return r;
end $$;

revoke all on function public.periodo_cuota_propuesto(uuid, uuid), public.periodo_alta_propuesto(uuid, uuid, date, date) from public, anon, authenticated;
grant execute on function public.periodo_cuota_propuesto(uuid, uuid), public.periodo_alta_propuesto(uuid, uuid, date, date) to authenticated, service_role;

-- ── Verificación ────────────────────────────────────────────────────
do $$
declare f text;
begin
  if to_regprocedure('privado.proximo_periodo(uuid, timestamptz)') is not null then raise exception 'Verificación: quedó la proximo_periodo vieja (ambigua)'; end if;
  if (select count(*) from pg_proc p join pg_namespace s on s.oid = p.pronamespace where s.nspname = 'privado' and p.proname = 'proximo_periodo') <> 1 then
    raise exception 'Verificación: proximo_periodo duplicada';
  end if;
  foreach f in array array['privado.proximo_periodo(uuid, timestamptz, date, date)', 'privado.confirmar_venta(uuid, timestamptz)',
      'privado.vender(uuid, uuid, uuid, jsonb, jsonb, uuid, uuid, numeric, timestamptz)', 'privado.normalizar_pagos_pasados(uuid, jsonb, date)',
      'public.linea_de_control(uuid, date, date, text[], uuid, integer, text)', 'public.periodo_cuota_propuesto(uuid, uuid)',
      'public.periodo_alta_propuesto(uuid, uuid, date, date)'] loop
    if not exists (select 1 from pg_proc where oid = f::regprocedure and 'search_path=""' = any (proconfig)) then
      raise exception 'Verificación: % sin search_path vacío', f;
    end if;
    if has_function_privilege('anon', f, 'execute') then raise exception 'Verificación: anon puede ejecutar %', f; end if;
  end loop;
  if has_function_privilege('authenticated', 'privado.proximo_periodo(uuid, timestamptz, date, date)', 'execute') then
    raise exception 'Verificación: proximo_periodo quedó ejecutable por la API';
  end if;
  if position('H2b' in pg_get_functiondef('privado.proximo_periodo(uuid, timestamptz, date, date)'::regprocedure)) = 0 then
    raise exception 'Verificación: proximo_periodo perdió lo de H2b';
  end if;
end $$;
