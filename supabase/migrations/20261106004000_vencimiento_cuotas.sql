-- VD-7 · Cómo vencen las cuotas, con pantalla (D18, docs/v2/02 §1).
-- La base ya tenía planes.renovacion (continua / desde_pago / dia_fijo) sin pantalla. Ahora:
--   * Configuración → Cobros decide la regla del gimnasio y cada plan puede pisarla
--     (planes.usa_regla_gimnasio). Los planes que ya existen NO cambian (usan la suya).
--   * D18: con día fijo, quien se anota a mitad de mes paga PROPORCIONAL a los días que faltan
--     hasta el día fijo (redondeado, por defecto a $100) y desde ahí entra al ciclo de todos.
--     Opciones: proporcional · mes entero (hasta el día fijo del mes siguiente) · gratis hasta el día fijo
--     · completo (lo de siempre: cobra el mes desde el último día fijo). Un gimnasio que nunca
--     lo configuró sigue en "completo": ningún cobro cambia solo.
--   * El cálculo sale de la base (privado.proximo_periodo) y se muestra antes de cobrar:
--     precios_venta trae el precio ya escalado y el detalle ("10 días de 30").
--   * Cada cambio de regla se aplica a los cobros NUEVOS; lo ya cobrado (coberturas, ventas) no se toca.
--   * Todo cambio queda escrito en public.cambios_cobro con quién, cuándo, antes y después.
-- Copias (misma firma, la definición más nueva + el cambio): privado.vender, public.precios_venta.
-- privado.proximo_periodo cambia de columnas de salida: la anterior se borra acá mismo.

-- ── Guarda de entrada ───────────────────────────────────────────────
do $$
begin
  if to_regprocedure('privado.proximo_periodo(uuid, timestamptz)') is null then raise exception 'Guarda: falta privado.proximo_periodo'; end if;
  if to_regprocedure('privado.sumar_meses_ancla(date, int, int)') is null then raise exception 'Guarda: falta privado.sumar_meses_ancla'; end if;
  if to_regprocedure('privado.ultimo_dia_x(date, int)') is null then raise exception 'Guarda: falta privado.ultimo_dia_x'; end if;
  if to_regprocedure('privado.vender(uuid, uuid, uuid, jsonb, jsonb, uuid, uuid, numeric, timestamptz)') is null then raise exception 'Guarda: falta privado.vender'; end if;
  if to_regprocedure('public.precios_venta(uuid, uuid)') is null then raise exception 'Guarda: falta public.precios_venta'; end if;
  if to_regprocedure('privado.politicas_estandar(regclass, text[], text[], boolean)') is null then raise exception 'Guarda: falta privado.politicas_estandar'; end if;
  if to_regprocedure('privado.hecho_inmutable()') is null then raise exception 'Guarda: falta privado.hecho_inmutable'; end if;
  if to_regprocedure('public.vender(uuid, jsonb, jsonb, uuid, uuid, uuid, timestamptz, text, text)') is null then raise exception 'Guarda: falta public.vender (VD-5)'; end if;
end $$;

-- ── 1 · La regla del gimnasio y la marca en cada plan ───────────────
create table if not exists public.configuracion_vencimiento (
  gimnasio_id      uuid primary key references public.gimnasios(id),
  renovacion       text not null default 'continua' check (renovacion in ('continua', 'desde_pago', 'dia_fijo')),
  dia_fijo         int check (dia_fijo between 1 and 28),
  primera_cuota    text not null default 'proporcional' check (primera_cuota in ('proporcional', 'mes_entero', 'gratis', 'completo')),
  redondeo         numeric(12,2) not null default 100 check (redondeo >= 0 and redondeo <= 10000),
  actualizado_por  uuid,
  actualizado_en   timestamptz not null default now(),
  check (renovacion <> 'dia_fijo' or dia_fijo is not null),
  foreign key (gimnasio_id, actualizado_por) references public.equipo (gimnasio_id, id)
);
-- Lee todo el equipo del gimnasio; se escribe solo por las funciones de abajo.
select privado.politicas_estandar('public.configuracion_vencimiento', null, '{}');
revoke all on table public.configuracion_vencimiento from anon;
revoke truncate, references, trigger on public.configuracion_vencimiento from authenticated;

alter table public.planes add column if not exists usa_regla_gimnasio boolean;
update public.planes set usa_regla_gimnasio = false where usa_regla_gimnasio is null;
alter table public.planes alter column usa_regla_gimnasio set default false;
alter table public.planes alter column usa_regla_gimnasio set not null;

-- El rastro de cada cambio de regla de cobro (vencimiento, plan, dejar pasar). No se edita ni se borra.
create table if not exists public.cambios_cobro (
  id           uuid primary key default gen_random_uuid(),
  gimnasio_id  uuid not null references public.gimnasios(id),
  tema         text not null check (tema in ('vencimiento', 'plan', 'dejar_pasar')),
  detalle      text not null check (length(detalle) between 1 and 300),
  antes        jsonb,
  despues      jsonb,
  equipo_id    uuid,
  usuario_id   uuid,
  cambiado_en  timestamptz not null default now(),
  unique (gimnasio_id, id),
  foreign key (gimnasio_id, equipo_id) references public.equipo (gimnasio_id, id)
);
create index if not exists cambios_cobro_reciente on public.cambios_cobro (gimnasio_id, cambiado_en desc);
select privado.politicas_estandar('public.cambios_cobro', array['dueno', 'encargado'], '{}');
revoke all on table public.cambios_cobro from anon;
revoke truncate, references, trigger on public.cambios_cobro from authenticated;
drop trigger if exists cambios_cobro_inmutable on public.cambios_cobro;
create trigger cambios_cobro_inmutable before update or delete on public.cambios_cobro
  for each row execute function privado.hecho_inmutable();

-- ── 2 · La regla que rige para un plan ──────────────────────────────
-- Un plan que usa la regla del gimnasio (y el gimnasio la configuró) toma renovación y día fijo de ahí.
-- Sin configuración, la primera cuota de día fijo sigue como siempre ('completo').
create or replace function privado.regla_vencimiento(
  p_plan_id uuid, out p_renovacion text, out p_dia_fijo int, out p_primera text, out p_redondeo numeric
) language plpgsql stable set search_path = '' as $$
declare pl public.planes; c public.configuracion_vencimiento; hay boolean;
begin
  select * into pl from public.planes where id = p_plan_id;
  select * into c from public.configuracion_vencimiento where gimnasio_id = pl.gimnasio_id;
  hay := found;
  if hay then p_primera := c.primera_cuota; p_redondeo := c.redondeo; else p_primera := 'completo'; p_redondeo := 100; end if;
  if hay and pl.usa_regla_gimnasio then p_renovacion := c.renovacion; p_dia_fijo := c.dia_fijo;
  else p_renovacion := pl.renovacion; p_dia_fijo := pl.dia_fijo; end if;
end $$;
revoke all on function privado.regla_vencimiento(uuid) from public, anon, authenticated;

-- ── 3 · La cuenta pura de la primera cuota con día fijo ─────────────
-- p_e = el día en que arranca. Si ese día ES el día fijo, es un ciclo entero (nada parcial).
-- Si no: parcial hasta el próximo día fijo (proporcional / gratis) o hasta el del mes siguiente (mes entero).
-- Los días del ciclo son los del mes que atraviesa (febrero 28, abril 30, enero 31): el proporcional es exacto.
create or replace function privado.periodo_entrada(
  p_dia_fijo int, p_modo text, p_meses int, p_e date,
  out p_desde date, out p_hasta date, out p_parcial boolean, out p_dias int, out p_dias_ciclo int, out p_factor numeric
) language plpgsql immutable set search_path = '' as $$
declare ult date; sig date;
begin
  ult := privado.ultimo_dia_x(p_e, p_dia_fijo);
  p_desde := p_e; p_parcial := false; p_factor := 1;
  if ult = p_e then
    p_hasta := privado.sumar_meses_ancla(p_e, p_meses, p_dia_fijo);
    return;
  end if;
  sig := privado.sumar_meses_ancla(ult, 1, p_dia_fijo);
  p_parcial := true; p_dias := sig - p_e; p_dias_ciclo := sig - ult;
  if p_modo = 'mes_entero' then
    p_hasta := privado.sumar_meses_ancla(sig, p_meses, p_dia_fijo);
  else
    p_hasta := sig;
    p_factor := case when p_modo = 'gratis' then 0 else p_dias::numeric / (p_dias_ciclo * greatest(p_meses, 1)) end;
  end if;
end $$;
revoke all on function privado.periodo_entrada(int, text, int, date) from public, anon, authenticated;

create or replace function privado.escalar_cuota(p_precio numeric, p_factor numeric, p_redondeo numeric) returns numeric
language sql immutable set search_path = '' as $$
  select case
    when p_precio is null then null
    when p_factor >= 1 then p_precio
    when p_factor <= 0 then 0
    else least(p_precio, case when coalesce(p_redondeo, 0) > 0 then round(p_precio * p_factor / p_redondeo) * p_redondeo
                              else round(p_precio * p_factor, 2) end) end
$$;
revoke all on function privado.escalar_cuota(numeric, numeric, numeric) from public, anon, authenticated;

-- ── 4 · Qué período cubre la próxima cuota (con la regla de arriba) ──
-- Igual que antes (hasta la migración 0005) salvo que renovación y día fijo salen de la regla del plan
-- y que la primera cuota (o la de quien vuelve tras reinicio_tras_dias) con día fijo puede ser parcial.
-- Salidas nuevas: p_parcial, p_modo, p_dias, p_dias_ciclo, p_factor (0 a 1), p_redondeo.
drop function if exists privado.proximo_periodo(uuid, timestamptz);
create or replace function privado.proximo_periodo(
  p_suscripcion_id uuid, p_momento timestamptz,
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
revoke all on function privado.proximo_periodo(uuid, timestamptz) from public, anon, authenticated;

-- El texto de una primera cuota parcial: "10 días de 30" / "gratis hasta el 01/12" / "hasta el 01/01 (mes entero)".
create or replace function privado.texto_primera_cuota(p_modo text, p_dias int, p_dias_ciclo int, p_hasta timestamptz, p_zona text) returns text
language sql immutable set search_path = '' as $$
  select case p_modo
    when 'gratis' then 'gratis hasta el ' || to_char(p_hasta at time zone p_zona, 'DD/MM')
    when 'mes_entero' then 'mes entero, cubre hasta el ' || to_char(p_hasta at time zone p_zona, 'DD/MM')
    else p_dias || ' días de ' || p_dias_ciclo end
$$;
revoke all on function privado.texto_primera_cuota(text, int, int, timestamptz, text) from public, anon, authenticated;

-- Los precios de la cuota de un socio ya con la primera cuota parcial aplicada, más el detalle para mostrar.
-- Misma cuenta que privado.vender: precio del medio (o de lista) escalado por el factor.
create or replace function privado.precios_cuota(p_suscripcion_id uuid, p_plan_id uuid, p_sede_id uuid, p_momento timestamptz) returns jsonb
language plpgsql stable set search_path = '' as $$
declare per record; base jsonb; k text; v jsonb; sal jsonb := '{}'::jsonb; zona text; gim uuid;
begin
  base := privado.precios_por_medio(p_plan_id, p_sede_id, p_momento);
  select * into per from privado.proximo_periodo(p_suscripcion_id, p_momento);
  if not per.p_parcial then return jsonb_build_object('precios', base, 'parcial', null); end if;
  select s.gimnasio_id into gim from public.suscripciones s where s.id = p_suscripcion_id;
  select g.zona_horaria into zona from public.gimnasios g where g.id = gim;
  for k, v in select * from jsonb_each(base) loop
    sal := sal || jsonb_build_object(k, case when jsonb_typeof(v) = 'number' then to_jsonb(privado.escalar_cuota((v #>> '{}')::numeric, per.p_factor, per.p_redondeo)) else v end);
  end loop;
  return jsonb_build_object('precios', sal, 'parcial', jsonb_build_object(
    'modo', per.p_modo, 'dias', per.p_dias, 'dias_ciclo', per.p_dias_ciclo, 'desde', per.p_desde, 'hasta', per.p_hasta,
    'texto', privado.texto_primera_cuota(per.p_modo, per.p_dias, per.p_dias_ciclo, per.p_hasta, zona),
    'lista_entera', base -> 'lista'));
end $$;
revoke all on function privado.precios_cuota(uuid, uuid, uuid, timestamptz) from public, anon, authenticated;

-- ── privado.vender: copia de la 20261104006700 con la cuota parcial ──
create or replace function privado.vender(
  p_gimnasio_id uuid, p_sede_id uuid, p_socio_id uuid, p_items jsonb, p_pagos jsonb,
  p_turno_id uuid, p_equipo_id uuid, p_tope_descuento numeric, p_momento timestamptz
) returns jsonb
language plpgsql set search_path = '' as $$
declare
  it jsonb; pg jsonb; vid uuid; total numeric := 0; pagado numeric := 0; generados int;
  medio_unico text; tipo text; cant int; precio numeric; desc_ numeric; pl public.planes; pr public.productos;
  sus public.suscripciones; descripcion text; subtotal numeric; medios text[]; mat jsonb; rec jsonb; hay_cuota boolean := false; hay_recargo boolean := false; conv jsonb; desc_conv numeric; motivo text; fiado numeric; deuda numeric; tope_fiado numeric; hay_deuda numeric := 0; per record; zona_g text;
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

-- ── precios_venta: copia de la 20261104006700 con el precio de la cuota ya escalado ──
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

-- ── 5 · La pantalla de Configuración → Cobros → "Cómo vencen las cuotas" ──
create or replace function public.reglas_vencimiento(p_gimnasio_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare c public.configuracion_vencimiento; hay boolean; tol int; ult jsonb;
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado']);
  select * into c from public.configuracion_vencimiento where gimnasio_id = p_gimnasio_id;
  hay := found;
  select tolerancia_dias into tol from public.configuracion_gimnasio where gimnasio_id = p_gimnasio_id;
  select jsonb_build_object('detalle', x.detalle, 'por', q.nombre, 'cuando', x.cambiado_en) into ult
    from public.cambios_cobro x left join public.equipo q on q.id = x.equipo_id
   where x.gimnasio_id = p_gimnasio_id and x.tema in ('vencimiento', 'plan') order by x.cambiado_en desc limit 1;
  return jsonb_build_object(
    'configurado', hay,
    'renovacion', case when hay then c.renovacion else 'continua' end,
    'dia_fijo', case when hay then c.dia_fijo end,
    'primera_cuota', case when hay then c.primera_cuota else 'completo' end,
    'redondeo', case when hay then c.redondeo else 100 end,
    'tolerancia_dias', tol,
    'ultimo_cambio', ult,
    'planes', coalesce((select jsonb_agg(jsonb_build_object(
        'plan_id', p.id, 'nombre', p.nombre, 'usa_regla_gimnasio', p.usa_regla_gimnasio,
        'renovacion', p.renovacion, 'dia_fijo', p.dia_fijo,
        'rige_renovacion', r.p_renovacion, 'rige_dia_fijo', r.p_dia_fijo) order by p.orden, p.nombre)
      from public.planes p cross join lateral privado.regla_vencimiento(p.id) r
     where p.gimnasio_id = p_gimnasio_id and p.tipo = 'membresia' and p.activo), '[]'::jsonb));
end $$;

create or replace function public.guardar_regla_vencimiento(p_gimnasio_id uuid, p_datos jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare e public.equipo; desconocidos text[]; c public.configuracion_vencimiento; antes jsonb; despues jsonb; n int; nuevo boolean;
begin
  e := privado.exigir_equipo(p_gimnasio_id, array['dueno']);
  if jsonb_typeof(p_datos) is distinct from 'object' then raise exception 'Datos inválidos' using errcode = '22023'; end if;
  select array_agg(k) into desconocidos from jsonb_object_keys(p_datos) k where k not in ('renovacion', 'dia_fijo', 'primera_cuota', 'redondeo');
  if desconocidos is not null then raise exception 'Campos que no se pueden cambiar acá: %', array_to_string(desconocidos, ', ') using errcode = '22023'; end if;

  select * into c from public.configuracion_vencimiento where gimnasio_id = p_gimnasio_id;
  nuevo := not found;
  if nuevo then
    c.gimnasio_id := p_gimnasio_id; c.renovacion := 'continua'; c.dia_fijo := null; c.primera_cuota := 'completo'; c.redondeo := 100;
  end if;
  antes := jsonb_build_object('renovacion', c.renovacion, 'dia_fijo', c.dia_fijo, 'primera_cuota', c.primera_cuota, 'redondeo', c.redondeo);

  if p_datos ? 'renovacion' then
    if p_datos ->> 'renovacion' is null or p_datos ->> 'renovacion' not in ('continua', 'desde_pago', 'dia_fijo') then
      raise exception 'Cómo vencen las cuotas: elegí desde el día que paga, continua o día fijo.' using errcode = '22023';
    end if;
    c.renovacion := p_datos ->> 'renovacion';
  end if;
  if p_datos ? 'dia_fijo' then
    if p_datos -> 'dia_fijo' = 'null'::jsonb then c.dia_fijo := null;
    elsif jsonb_typeof(p_datos -> 'dia_fijo') is distinct from 'number' or (p_datos ->> 'dia_fijo')::numeric <> trunc((p_datos ->> 'dia_fijo')::numeric)
          or (p_datos ->> 'dia_fijo')::numeric not between 1 and 28 then
      raise exception 'El día fijo es un día del 1 al 28.' using errcode = '22023';
    else c.dia_fijo := (p_datos ->> 'dia_fijo')::int; end if;
  end if;
  if c.renovacion = 'dia_fijo' and c.dia_fijo is null then raise exception 'Con día fijo, elegí qué día vencen todos (del 1 al 28).' using errcode = '22023'; end if;
  if c.renovacion <> 'dia_fijo' then c.dia_fijo := null; end if;
  if p_datos ? 'primera_cuota' then
    if p_datos ->> 'primera_cuota' is null or p_datos ->> 'primera_cuota' not in ('proporcional', 'mes_entero', 'gratis', 'completo') then
      raise exception 'Primera cuota con día fijo: elegí proporcional, mes entero, gratis hasta el día fijo o mes completo.' using errcode = '22023';
    end if;
    c.primera_cuota := p_datos ->> 'primera_cuota';
  end if;
  if p_datos ? 'redondeo' then
    if jsonb_typeof(p_datos -> 'redondeo') is distinct from 'number' or (p_datos ->> 'redondeo')::numeric not between 0 and 10000 then
      raise exception 'Redondeo: un monto entre $0 y $10.000 (0 = sin redondear).' using errcode = '22023';
    end if;
    c.redondeo := round((p_datos ->> 'redondeo')::numeric, 2);
  end if;

  insert into public.configuracion_vencimiento (gimnasio_id, renovacion, dia_fijo, primera_cuota, redondeo, actualizado_por, actualizado_en)
  values (p_gimnasio_id, c.renovacion, c.dia_fijo, c.primera_cuota, c.redondeo, e.id, now())
  on conflict (gimnasio_id) do update set renovacion = excluded.renovacion, dia_fijo = excluded.dia_fijo,
    primera_cuota = excluded.primera_cuota, redondeo = excluded.redondeo, actualizado_por = excluded.actualizado_por, actualizado_en = now();
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'No se pudo guardar cómo vencen las cuotas.'; end if;

  despues := jsonb_build_object('renovacion', c.renovacion, 'dia_fijo', c.dia_fijo, 'primera_cuota', c.primera_cuota, 'redondeo', c.redondeo);
  if antes is distinct from despues or nuevo then
    insert into public.cambios_cobro (gimnasio_id, tema, detalle, antes, despues, equipo_id, usuario_id)
    values (p_gimnasio_id, 'vencimiento', 'Cómo vencen las cuotas del gimnasio (rige para los cobros nuevos; lo ya cobrado no cambia)',
            case when nuevo then null else antes end, despues, e.id, auth.uid());
  end if;
  return public.reglas_vencimiento(p_gimnasio_id);
end $$;

create or replace function public.guardar_regla_plan(p_plan_id uuid, p_usa_gimnasio boolean, p_renovacion text default null, p_dia_fijo int default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare g uuid; e public.equipo; pl public.planes; antes jsonb; n int;
begin
  select gimnasio_id into g from public.planes where id = p_plan_id;
  if g is null then raise exception 'Sin permiso o plan inexistente' using errcode = '42501'; end if;
  e := privado.exigir_equipo(g, array['dueno']);
  select * into pl from public.planes where id = p_plan_id;
  if pl.tipo <> 'membresia' then raise exception 'Solo las membresías tienen regla de vencimiento.' using errcode = '22023'; end if;
  if p_usa_gimnasio is null then raise exception 'Elegí si el plan usa la regla del gimnasio o la suya.' using errcode = '22023'; end if;
  antes := jsonb_build_object('usa_regla_gimnasio', pl.usa_regla_gimnasio, 'renovacion', pl.renovacion, 'dia_fijo', pl.dia_fijo);
  if p_usa_gimnasio then
    if not exists (select 1 from public.configuracion_vencimiento where gimnasio_id = g) then
      raise exception 'Primero elegí la regla del gimnasio.' using errcode = '22023';
    end if;
    update public.planes set usa_regla_gimnasio = true where id = p_plan_id;
  else
    if p_renovacion is null or p_renovacion not in ('continua', 'desde_pago', 'dia_fijo') then
      raise exception 'Elegí cómo vence este plan: desde el día que paga, continua o día fijo.' using errcode = '22023';
    end if;
    if p_renovacion = 'dia_fijo' and (p_dia_fijo is null or p_dia_fijo not between 1 and 28) then
      raise exception 'Con día fijo, elegí el día (del 1 al 28).' using errcode = '22023';
    end if;
    update public.planes set usa_regla_gimnasio = false, renovacion = p_renovacion,
           dia_fijo = case when p_renovacion = 'dia_fijo' then p_dia_fijo end where id = p_plan_id;
  end if;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'No se pudo guardar la regla del plan.'; end if;
  insert into public.cambios_cobro (gimnasio_id, tema, detalle, antes, despues, equipo_id, usuario_id)
  select g, 'plan', 'Cómo vence el plan ' || p.nombre || ' (rige para los cobros nuevos)', antes,
         jsonb_build_object('usa_regla_gimnasio', p.usa_regla_gimnasio, 'renovacion', p.renovacion, 'dia_fijo', p.dia_fijo), e.id, auth.uid()
    from public.planes p where p.id = p_plan_id;
  return public.reglas_vencimiento(g);
end $$;

-- "¿Y si alguien se anota el …?": el cálculo exacto de la base para una fecha, sin cobrar nada.
create or replace function public.simular_cuota(p_gimnasio_id uuid, p_plan_id uuid, p_dia date) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare pl public.planes; rg record; zona text; pe record; precio numeric; escalado numeric; texto text; hasta date;
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado']);
  select * into pl from public.planes where id = p_plan_id and gimnasio_id = p_gimnasio_id and tipo = 'membresia';
  if not found then raise exception 'Ese plan no es una membresía de este gimnasio' using errcode = '22023'; end if;
  if p_dia is null then raise exception 'Elegí un día' using errcode = '22023'; end if;
  select g.zona_horaria into zona from public.gimnasios g where g.id = p_gimnasio_id;
  select * into rg from privado.regla_vencimiento(p_plan_id);
  precio := privado.precio_para(p_plan_id, privado.medianoche(p_dia, zona), null, null, false);
  if rg.p_renovacion is distinct from 'dia_fijo' then
    hasta := privado.sumar_meses_ancla(p_dia, pl.duracion_meses, extract(day from p_dia)::int);
    return jsonb_build_object('parcial', false, 'precio_lista', precio, 'precio', precio, 'desde', p_dia, 'hasta', hasta,
      'texto', 'Paga la cuota entera: cubre del ' || to_char(p_dia, 'DD/MM') || ' al ' || to_char(hasta, 'DD/MM') || '.');
  end if;
  if rg.p_primera = 'completo' then
    return jsonb_build_object('parcial', false, 'precio_lista', precio, 'precio', precio,
      'desde', privado.ultimo_dia_x(p_dia, rg.p_dia_fijo), 'hasta', privado.sumar_meses_ancla(privado.ultimo_dia_x(p_dia, rg.p_dia_fijo), pl.duracion_meses, rg.p_dia_fijo),
      'texto', 'Paga la cuota entera, que cubre desde el ' || to_char(privado.ultimo_dia_x(p_dia, rg.p_dia_fijo), 'DD/MM') || '.');
  end if;
  select * into pe from privado.periodo_entrada(rg.p_dia_fijo, rg.p_primera, pl.duracion_meses, p_dia);
  escalado := privado.escalar_cuota(precio, pe.p_factor, rg.p_redondeo);
  texto := case when not pe.p_parcial then 'Se anota justo el día fijo: paga la cuota entera.'
    when rg.p_primera = 'gratis' then 'No paga: gratis hasta el ' || to_char(pe.p_hasta, 'DD/MM') || ', y desde ahí entra al ciclo de todos.'
    when rg.p_primera = 'mes_entero' then 'Paga la cuota entera y queda cubierto hasta el ' || to_char(pe.p_hasta, 'DD/MM') || '.'
    else 'Paga ' || pe.p_dias || ' días de ' || pe.p_dias_ciclo || ' (hasta el ' || to_char(pe.p_hasta, 'DD/MM') || '), y desde ahí entra al ciclo de todos.' end;
  return jsonb_build_object('parcial', pe.p_parcial, 'modo', rg.p_primera, 'dias', pe.p_dias, 'dias_ciclo', pe.p_dias_ciclo,
    'precio_lista', precio, 'precio', escalado, 'desde', pe.p_desde, 'hasta', pe.p_hasta, 'texto', texto);
end $$;

-- ── Permisos ────────────────────────────────────────────────────────
revoke all on function public.reglas_vencimiento(uuid), public.guardar_regla_vencimiento(uuid, jsonb),
  public.guardar_regla_plan(uuid, boolean, text, int), public.simular_cuota(uuid, uuid, date) from public, anon, authenticated;
grant execute on function public.reglas_vencimiento(uuid), public.guardar_regla_vencimiento(uuid, jsonb),
  public.guardar_regla_plan(uuid, boolean, text, int), public.simular_cuota(uuid, uuid, date) to authenticated, service_role;
revoke all on function privado.vender(uuid, uuid, uuid, jsonb, jsonb, uuid, uuid, numeric, timestamptz) from public;
revoke all on function public.precios_venta(uuid, uuid) from public, anon, authenticated;
grant execute on function public.precios_venta(uuid, uuid) to authenticated, service_role;

-- ── Verificación ────────────────────────────────────────────────────
do $$
declare r record;
begin
  if not (select relrowsecurity from pg_class where oid = 'public.configuracion_vencimiento'::regclass) then raise exception 'Verificación: configuracion_vencimiento sin RLS'; end if;
  if not (select relrowsecurity from pg_class where oid = 'public.cambios_cobro'::regclass) then raise exception 'Verificación: cambios_cobro sin RLS'; end if;
  if exists (select 1 from public.planes where usa_regla_gimnasio is null) then raise exception 'Verificación: falta usa_regla_gimnasio'; end if;
  if (select count(*) from pg_proc p join pg_namespace s on s.oid = p.pronamespace where s.nspname = 'privado' and p.proname = 'proximo_periodo') <> 1 then
    raise exception 'Verificación: proximo_periodo duplicada';
  end if;
  for r in select p.oid, p.proname, p.proconfig from pg_proc p join pg_namespace s on s.oid = p.pronamespace
            where (s.nspname = 'public' and p.proname in ('reglas_vencimiento', 'guardar_regla_vencimiento', 'guardar_regla_plan', 'simular_cuota', 'precios_venta'))
               or (s.nspname = 'privado' and p.proname in ('regla_vencimiento', 'periodo_entrada', 'escalar_cuota', 'proximo_periodo', 'texto_primera_cuota', 'precios_cuota', 'vender')) loop
    if r.proconfig is null or not ('search_path=""' = any (r.proconfig)) then raise exception 'Verificación: % sin search_path vacío', r.proname; end if;
    if has_function_privilege('anon', r.oid, 'execute') then raise exception 'Verificación: anon puede ejecutar %', r.proname; end if;
  end loop;
  -- La cuenta pura: día fijo 1, se anota el 20/11 (ciclo del 01/11 al 01/12 = 30 días): 11 días de 30.
  select * into r from privado.periodo_entrada(1, 'proporcional', 1, date '2026-11-20');
  if not r.p_parcial or r.p_dias <> 11 or r.p_dias_ciclo <> 30 or r.p_hasta <> date '2026-12-01' then raise exception 'Verificación: proporcional mal calculado'; end if;
  select * into r from privado.periodo_entrada(1, 'proporcional', 1, date '2027-02-10');
  if r.p_dias <> 19 or r.p_dias_ciclo <> 28 then raise exception 'Verificación: febrero mal calculado'; end if;
end $$;
