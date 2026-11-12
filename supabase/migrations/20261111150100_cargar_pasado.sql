-- C10 · Cargar socios en el pasado: fecha de alta pasada y pagos pasados que generan la cobertura real.
-- Completa 20261111090100 (importar) y el alta de a uno; no edita ninguna migración entregada.
--
-- REGLAS DE PLATA (innegociables):
--  * Un pago cargado con fecha pasada NUNCA entra en la caja de hoy: se guarda sin turno de caja
--    (pagos.turno_caja_id nulo, ventas.turno_caja_id nulo). La caja del turno suma solo lo que tiene
--    su turno, así que no cambia ni se descuadra. Una restricción lo garantiza: un pago "cargado
--    después" no puede tener turno.
--  * Cuenta en el Resultado del mes de SU fecha: aprobado_en y creado_en de la venta son la fecha del
--    pago (mediodía local), no la de la carga. El mes actual no lo ve.
--  * Queda marcado: pagos.cargado_despues_en / cargado_despues_por (quién y cuándo se cargó de
--    verdad) y la venta con otro_dia_motivo + registrada_en (VD-5), que es lo que ya muestra Control.
--  * Sin fechas futuras ni de hoy (un pago de hoy se cobra desde Cobrar y entra en la caja de hoy).
--  * VD-10: la carga inicial de un gimnasio nuevo (su primer mes de vida) no dispara el aviso de
--    "cobro con fecha atrasada" (ventas.carga_inicial); una carga atrasada después del primer mes sí.
--  * Efectivo del pasado: ahora se puede (la caja de hoy no lo ve): pagos_check1 se reemplaza por una
--    restricción que lo permite solo si el pago está marcado "cargado después".
--  * La cobertura sale de privado.confirmar_venta con el momento del pago: la misma cuenta que si se
--    hubiera cobrado ese día. cubierto_hasta lo mantiene el trigger. La puerta sigue siendo
--    privado.calcular_acceso.
--  * Solo dueño y encargado cargan pagos pasados (la recepción no).
--
-- Una sola transacción por carga (importar_socios / alta_socio_pasado), filas afectadas verificadas.
-- Se cambia: fila_importacion y importar_socios (misma firma; suman "pagos"), campana_control
-- (copia de 20261106007200 que saltea lo marcado carga_inicial), deshacer_importacion (misma firma;
-- avisa en palabras que lo que cargó plata no se deshace). Se suman: privado.monto_importado,
-- privado.medio_importado, privado.normalizar_pagos_pasados, privado.cargar_pagos_pasados y
-- public.alta_socio_pasado.

-- ── Guarda de entrada ───────────────────────────────────────────────
do $$
begin
  if to_regprocedure('public.importar_socios(uuid, jsonb, text)') is null
     or to_regprocedure('privado.fila_importacion(uuid, jsonb)') is null
     or to_regprocedure('privado.fecha_importada(text)') is null then
    raise exception 'Guarda: falta la importación de socios (20261111090100)';
  end if;
  if to_regprocedure('privado.confirmar_venta(uuid, timestamptz)') is null then raise exception 'Guarda: falta privado.confirmar_venta'; end if;
  if to_regprocedure('privado.validar_plan_nuevo(uuid, uuid)') is null then raise exception 'Guarda: falta privado.validar_plan_nuevo'; end if;
  if to_regprocedure('public.guardar_socio(uuid, uuid, jsonb)') is null then raise exception 'Guarda: falta guardar_socio'; end if;
  if to_regprocedure('privado.avisos_moderacion(uuid, text)') is null then raise exception 'Guarda: falta privado.avisos_moderacion (campana_control)'; end if;
  if to_regprocedure('public.deshacer_importacion(uuid, uuid)') is null then raise exception 'Guarda: falta deshacer_importacion'; end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'ventas' and column_name = 'otro_dia_motivo') then
    raise exception 'Guarda: falta ventas.otro_dia_motivo (VD-5)';
  end if;
end $$;

-- ── Columnas ────────────────────────────────────────────────────────
alter table public.ventas add column if not exists carga_inicial boolean not null default false;
alter table public.ventas add column if not exists importacion_id uuid;
alter table public.pagos add column if not exists cargado_despues_en timestamptz;
alter table public.pagos add column if not exists cargado_despues_por uuid;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'ventas_importacion_fk') then
    alter table public.ventas add constraint ventas_importacion_fk
      foreign key (gimnasio_id, importacion_id) references public.importaciones (gimnasio_id, id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'pagos_cargado_por_fk') then
    alter table public.pagos add constraint pagos_cargado_por_fk
      foreign key (gimnasio_id, cargado_despues_por) references public.equipo (gimnasio_id, id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'pagos_cargado_completo') then
    alter table public.pagos add constraint pagos_cargado_completo
      check ((cargado_despues_en is null) = (cargado_despues_por is null));
  end if;
  -- Un pago cargado después jamás tiene turno de caja: no entra en ninguna caja.
  if not exists (select 1 from pg_constraint where conname = 'pagos_cargado_sin_caja') then
    alter table public.pagos add constraint pagos_cargado_sin_caja
      check (cargado_despues_en is null or turno_caja_id is null);
  end if;
  -- El efectivo necesita turno de caja, salvo el cargado después (no entra en la caja de hoy).
  if exists (select 1 from pg_constraint where conrelid = 'public.pagos'::regclass and conname = 'pagos_check1'
                and pg_get_constraintdef(oid) like '%efectivo%turno_caja_id IS NOT NULL%') then
    alter table public.pagos drop constraint pagos_check1;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'pagos_efectivo_con_turno') then
    alter table public.pagos add constraint pagos_efectivo_con_turno
      check (medio <> 'efectivo' or turno_caja_id is not null or cargado_despues_en is not null);
  end if;
end $$;
create index if not exists ventas_por_importacion on public.ventas (gimnasio_id, importacion_id) where importacion_id is not null;

-- ── Un monto como lo escribe la gente: 25000 · 25.000 · 25.000,50 · $ 25000,5 ─
create or replace function privado.monto_importado(p_texto text) returns numeric
language plpgsql immutable set search_path = '' as $$
declare t text := regexp_replace(coalesce(p_texto, ''), '[\s$]', '', 'g');
begin
  if t = '' then raise exception 'monto'; end if;
  if position(',' in t) > 0 and position('.' in t) > 0 then
    -- el último separador es el decimal
    if position(',' in reverse(t)) < position('.' in reverse(t)) then t := replace(replace(t, '.', ''), ',', '.');
    else t := replace(t, ',', ''); end if;
  elsif position(',' in t) > 0 then
    if t ~ '^\d+,\d{3}$' then raise exception 'monto'; end if;      -- "25,000": no se sabe si son miles o decimales
    t := replace(t, ',', '.');
  elsif t ~ '^\d{1,3}(\.\d{3})+$' then
    t := replace(t, '.', '');                                     -- "25.000": miles
  end if;
  if t !~ '^\d+(\.\d{1,2})?$' then raise exception 'monto'; end if;
  return t::numeric;
end $$;
revoke all on function privado.monto_importado(text) from public, anon, authenticated;

create or replace function privado.medio_importado(p_texto text) returns text
language sql immutable set search_path = '' as $$
  select case
    when t in ('efectivo', 'cash') then 'efectivo'
    when t like 'transf%' then 'transferencia'
    when t in ('debito', 'tarjeta de debito', 'tarjeta debito') then 'debito'
    when t in ('credito', 'tarjeta de credito', 'tarjeta credito', 'tarjeta') then 'credito'
    else null end
  from (select privado.sin_acentos(lower(trim(coalesce(p_texto, '')))) as t) x
$$;
revoke all on function privado.medio_importado(text) from public, anon, authenticated;

-- ── Revisar los pagos pasados de un socio (la misma revisión sirve a la vista previa y a la carga) ─
-- Devuelve {errores: [...], pagos: [{fecha, monto, medio, cuotas}]} con los pagos ordenados por fecha.
create or replace function privado.normalizar_pagos_pasados(p_gimnasio_id uuid, p_pagos jsonb, p_alta date) returns jsonb
language plpgsql stable set search_path = '' as $$
declare
  err text[] := '{}'; x jsonb; k int := 0; f date; m numeric; med text; c int; hoy date; zona text; ok_fila boolean;
  lista jsonb := '[]'::jsonb; ordenada jsonb;
begin
  if p_pagos is null or jsonb_typeof(p_pagos) = 'null' then return jsonb_build_object('errores', '[]'::jsonb, 'pagos', '[]'::jsonb); end if;
  if jsonb_typeof(p_pagos) <> 'array' then raise exception 'Los pagos tienen que ser una lista' using errcode = '22023'; end if;
  if jsonb_array_length(p_pagos) > 36 then
    return jsonb_build_object('errores', to_jsonb(array['Hasta 36 pagos por socio']), 'pagos', '[]'::jsonb);
  end if;
  select g.zona_horaria into zona from public.gimnasios g where g.id = p_gimnasio_id;
  hoy := privado.dia_local(now(), coalesce(zona, 'America/Argentina/Buenos_Aires'));
  for x in select v from jsonb_array_elements(p_pagos) v loop
    k := k + 1; ok_fila := true; f := null; m := null; med := null; c := 1;
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
    if ok_fila then lista := lista || jsonb_build_array(jsonb_build_object('fecha', f, 'monto', m, 'medio', med, 'cuotas', c, 'orden', k)); end if;
  end loop;
  select coalesce(jsonb_agg(e - 'orden' order by (e ->> 'fecha')::date, (e ->> 'orden')::int), '[]'::jsonb) into ordenada
    from jsonb_array_elements(lista) e;
  return jsonb_build_object('errores', to_jsonb(err), 'pagos', ordenada);
end $$;
revoke all on function privado.normalizar_pagos_pasados(uuid, jsonb, date) from public, anon, authenticated;

-- ── Cargar los pagos pasados de un socio nuevo ──────────────────────
-- Cada pago es una venta confirmada (cuota del plan de su membresía) con el mismo camino que un cobro de ese día:
-- privado.confirmar_venta(venta, momento) arma la cobertura con proximo_periodo(momento). Sin turno de caja.
-- Los pagos se cargan en orden de fecha: cada uno encadena con el anterior como si se hubiera cobrado ese día.
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
    insert into public.venta_items (gimnasio_id, venta_id, tipo, plan_id, suscripcion_id, descripcion, cantidad, precio_unitario)
    values (p_gimnasio_id, vid, 'cuota', pl.id, sus.id,
            case when (x ->> 'cuotas')::int = 1 then 'Cuota ' || pl.nombre else (x ->> 'cuotas') || ' cuotas ' || pl.nombre end,
            (x ->> 'cuotas')::int, precio)
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

-- ── Revisar una fila de importación (suma los pagos) ────────────────
create or replace function privado.fila_importacion(p_gimnasio_id uuid, f jsonb) returns jsonb
language plpgsql stable set search_path = '' as $$
declare
  err text[] := '{}'; v_nombre text := trim(coalesce(f ->> 'nombre', '')); v_apellido text := trim(coalesce(f ->> 'apellido', ''));
  v_dni text := nullif(regexp_replace(coalesce(f ->> 'dni', ''), '\D', '', 'g'), ''); v_tel text; v_mail text := nullif(lower(trim(coalesce(f ->> 'email', ''))), '');
  v_nac date; v_vence date; v_alta date; v_plan uuid; v_plan_nombre text := nullif(trim(coalesce(f ->> 'plan', '')), '');
  v_zona text; v_hoy date; v_pagos jsonb := '[]'::jsonb; v_norm jsonb; v_hay_pagos boolean := false;
begin
  select g.zona_horaria into v_zona from public.gimnasios g where g.id = p_gimnasio_id;
  v_hoy := (now() at time zone coalesce(v_zona, 'America/Argentina/Buenos_Aires'))::date;
  -- "Juan Pérez" en una sola columna: se separa en nombre y apellido.
  if v_apellido = '' and position(' ' in v_nombre) > 0 then
    v_apellido := trim(substr(v_nombre, position(' ' in v_nombre) + 1)); v_nombre := split_part(v_nombre, ' ', 1);
  end if;
  if v_nombre = '' then err := array_append(err, 'Falta el nombre'); end if;
  if length(v_nombre) > 80 or length(v_apellido) > 80 then err := array_append(err, 'Nombre o apellido de más de 80 letras'); end if;
  if v_dni is not null and v_dni !~ '^[0-9]{6,9}$' then err := array_append(err, format('DNI “%s”: entre 6 y 9 números', f ->> 'dni')); end if;
  if v_dni is not null and exists (select 1 from public.socios s where s.gimnasio_id = p_gimnasio_id and s.dni = v_dni) then
    err := array_append(err, format('DNI %s: ya es socio', v_dni));
  end if;
  begin
    v_tel := privado.telefono_normalizado(f ->> 'telefono', 'Celular');
  exception when others then err := array_append(err, format('Celular “%s”: no se entiende', f ->> 'telefono'));
  end;
  -- Sin DNI no hay otra forma de reconocer a un socio que ya está: nombre y celular iguales.
  if v_dni is null and v_tel is not null and v_nombre <> '' and exists (
       select 1 from public.socios s where s.gimnasio_id = p_gimnasio_id and s.telefono = v_tel
          and privado.sin_acentos(lower(s.nombre)) = privado.sin_acentos(lower(v_nombre))) then
    err := array_append(err, format('Sin DNI: ya hay un socio con el nombre %s y ese celular', v_nombre));
  end if;
  if v_mail is not null and v_mail !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then err := array_append(err, format('Mail “%s”: no es válido', f ->> 'email')); end if;
  begin v_nac := privado.fecha_importada(f ->> 'nacimiento');
  exception when others then err := array_append(err, format('Nacimiento “%s”: usá día/mes/año', f ->> 'nacimiento')); end;
  if v_nac is not null and (v_nac > v_hoy or v_nac < date '1900-01-01') then err := array_append(err, 'Nacimiento: fecha imposible'); end if;
  begin v_alta := privado.fecha_importada(f ->> 'alta');
  exception when others then err := array_append(err, format('Fecha de alta “%s”: usá día/mes/año', f ->> 'alta')); end;
  if v_alta is not null and (v_alta > v_hoy or v_alta < date '1990-01-01') then err := array_append(err, 'Fecha de alta: fecha imposible'); v_alta := null; end if;
  begin v_vence := privado.fecha_importada(f ->> 'vence');
  exception when others then err := array_append(err, format('Pagó hasta “%s”: usá día/mes/año', f ->> 'vence')); end;
  if v_vence is not null and (v_vence < date '1990-01-01' or v_vence > date '2100-01-01') then err := array_append(err, 'Pagó hasta: fecha imposible'); v_vence := null; end if;
  if v_alta is not null and v_vence is not null and v_vence < v_alta then err := array_append(err, 'Pagó hasta es anterior a la fecha de alta'); end if;
  if v_plan_nombre is not null then
    select p.id into v_plan from public.planes p
     where p.gimnasio_id = p_gimnasio_id and p.activo and p.tipo = 'membresia'
       and privado.sin_acentos(lower(p.nombre)) = privado.sin_acentos(lower(v_plan_nombre));
    if v_plan is null then err := array_append(err, format('Plan “%s”: no existe (o no es una membresía activa)', v_plan_nombre)); end if;
  end if;
  if v_vence is not null and v_plan is null and v_plan_nombre is null then err := array_append(err, 'Tiene “pagó hasta” pero no plan'); end if;
  -- C10 · Pagos pasados (fecha, monto, medio): arman la cobertura real. Con pagos no va “pagó hasta”.
  if jsonb_typeof(f -> 'pagos') = 'array' and jsonb_array_length(f -> 'pagos') > 0 then
    v_hay_pagos := true;
    if v_vence is not null then err := array_append(err, 'Usá “pagó hasta” o los pagos, no los dos'); end if;
    if v_plan is null and v_plan_nombre is null then err := array_append(err, 'Tiene pagos pero no plan'); end if;
    v_norm := privado.normalizar_pagos_pasados(p_gimnasio_id, f -> 'pagos', v_alta);
    err := err || coalesce((select array_agg(e) from jsonb_array_elements_text(v_norm -> 'errores') e), '{}'::text[]);
    v_pagos := v_norm -> 'pagos';
    -- Sin fecha de alta, el alta es el día del primer pago (nadie paga antes de ser socio).
    if v_alta is null and jsonb_array_length(v_pagos) > 0 then v_alta := (v_pagos -> 0 ->> 'fecha')::date; end if;
  end if;
  return jsonb_build_object('errores', to_jsonb(err), 'datos', jsonb_build_object(
    'nombre', v_nombre, 'apellido', v_apellido, 'dni', v_dni, 'telefono', v_tel, 'email', v_mail,
    'nacimiento', v_nac, 'plan_id', v_plan, 'vence', v_vence, 'alta', v_alta, 'pagos', case when v_hay_pagos then v_pagos else '[]'::jsonb end));
end $$;
revoke all on function privado.fila_importacion(uuid, jsonb) from public, anon, authenticated;

-- ── Revisar: suma cuántos pagos y cuánta plata se cargan ────────────
create or replace function public.revisar_importacion(p_gimnasio_id uuid, p_filas jsonb) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare r jsonb;
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado']);
  r := privado.revisar_filas(p_gimnasio_id, p_filas);
  return jsonb_build_object(
    'filas', r,
    'validas', (select count(*) from jsonb_array_elements(r) x where not exists (
                  select 1 from jsonb_array_elements_text(x -> 'errores') e where e not like 'Celular repetido%')),
    'ya_existian', (select count(*) from jsonb_array_elements(r) x where exists (
                  select 1 from jsonb_array_elements_text(x -> 'errores') e where e like '%ya es socio' or e like 'Sin DNI: ya hay%')),
    'repetidas_en_archivo', (select count(*) from jsonb_array_elements(r) x where exists (
                  select 1 from jsonb_array_elements_text(x -> 'errores') e where e like 'DNI%repetido en el archivo')),
    'pagos', (select count(*) from jsonb_array_elements(r) x, jsonb_array_elements(x -> 'datos' -> 'pagos') p
               where not exists (select 1 from jsonb_array_elements_text(x -> 'errores') e where e not like 'Celular repetido%')),
    'monto_pagos', (select coalesce(sum((p ->> 'monto')::numeric), 0) from jsonb_array_elements(r) x, jsonb_array_elements(x -> 'datos' -> 'pagos') p
               where not exists (select 1 from jsonb_array_elements_text(x -> 'errores') e where e not like 'Celular repetido%'))
  );
end $$;

-- ── Importar: una transacción, un candado por gimnasio, ahora con pagos pasados ─
create or replace function public.importar_socios(p_gimnasio_id uuid, p_filas jsonb, p_archivo text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  e public.equipo; r jsonb; x jsonb; d jsonb; imp uuid; sid uuid; sus uuid; zona text; hoy date; n int := 0; filas_n int; k int;
  v_alta date; v_vence date; v_desde date; v_ya int := 0; v_rep int := 0; v_cob int := 0; v_n_final int;
  v_sede uuid; v_pg jsonb; v_pagos int := 0; v_monto numeric := 0; v_ventas int;
begin
  e := privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado']);
  -- Dos importaciones a la vez del mismo gimnasio se turnan: la segunda ve los DNI de la primera.
  perform pg_advisory_xact_lock(hashtextextended('importar_socios:' || p_gimnasio_id::text, 0));
  r := privado.revisar_filas(p_gimnasio_id, p_filas);
  filas_n := jsonb_array_length(p_filas);
  select g.zona_horaria into zona from public.gimnasios g where g.id = p_gimnasio_id;
  if zona is null then raise exception 'No se encontró el gimnasio.'; end if;
  hoy := (now() at time zone zona)::date;
  -- La sede de los pagos pasados: la del encargado si tiene una, si no la principal.
  select coalesce(e.sede_id, (select s.id from public.sedes s where s.gimnasio_id = p_gimnasio_id and s.activa order by s.es_principal desc, s.creado_en limit 1)) into v_sede;
  insert into public.importaciones (gimnasio_id, archivo, filas, importados, creado_por)
  values (p_gimnasio_id, left(p_archivo, 200), filas_n, 0, auth.uid()) returning id into imp;
  get diagnostics k = row_count;
  if k <> 1 then raise exception 'No se pudo registrar la importación.'; end if;
  for x in select v from jsonb_array_elements(r) v loop
    if exists (select 1 from jsonb_array_elements_text(x -> 'errores') e2 where e2 like '%ya es socio' or e2 like 'Sin DNI: ya hay%') then v_ya := v_ya + 1; end if;
    if exists (select 1 from jsonb_array_elements_text(x -> 'errores') e2 where e2 like 'DNI%repetido en el archivo') then v_rep := v_rep + 1; end if;
    if exists (select 1 from jsonb_array_elements_text(x -> 'errores') e2 where e2 not like 'Celular repetido%') then continue; end if;
    d := x -> 'datos';
    v_alta := nullif(d ->> 'alta', '')::date; v_vence := nullif(d ->> 'vence', '')::date;
    insert into public.socios (gimnasio_id, nombre, apellido, dni, telefono, email, fecha_nacimiento, origen, importacion_id, creado_por, creado_en)
    values (p_gimnasio_id, d ->> 'nombre', coalesce(d ->> 'apellido', ''), d ->> 'dni', d ->> 'telefono', d ->> 'email',
            (d ->> 'nacimiento')::date, 'importacion', imp, auth.uid(),
            case when v_alta is not null then privado.medianoche(v_alta, zona) else now() end)
    returning id into sid;
    get diagnostics k = row_count;
    if k <> 1 or sid is null then raise exception 'No se pudo crear el socio de la fila %', x ->> 'fila'; end if;
    if (d ->> 'plan_id') is not null then
      -- La cobertura va de la fecha de alta (o de hoy si todavía rige, o del último día si ya venció)
      -- hasta el día siguiente a "pagó hasta" a la medianoche local: [desde, hasta).
      v_desde := case when v_vence is null then null
                      when v_alta is not null then v_alta
                      when v_vence >= hoy then hoy
                      else v_vence end;
      insert into public.suscripciones (gimnasio_id, socio_id, plan_id, inicio, creado_por, importacion_id)
      values (p_gimnasio_id, sid, (d ->> 'plan_id')::uuid,
              least(now(), privado.medianoche(coalesce(v_desde, v_alta, hoy), zona)), auth.uid(), imp)
      returning id into sus;
      get diagnostics k = row_count;
      if k <> 1 or sus is null then raise exception 'No se pudo crear la suscripción de la fila %', x ->> 'fila'; end if;
      if v_vence is not null then
        insert into public.coberturas (gimnasio_id, suscripcion_id, socio_id, desde, hasta, origen, importacion_id, motivo, creado_por)
        values (p_gimnasio_id, sus, sid, privado.medianoche(v_desde, zona), privado.medianoche(v_vence + 1, zona),
                'importacion', imp, 'Importado: pagó hasta el ' || to_char(v_vence, 'DD/MM/YYYY'), auth.uid());
        get diagnostics k = row_count;
        if k <> 1 then raise exception 'No se pudo cargar lo que pagó la fila %', x ->> 'fila'; end if;
        v_cob := v_cob + 1;
      end if;
      -- C10 · Pagos pasados: venta + pago (sin caja) + cobertura por cada uno, con quién y cuándo se cargó.
      if jsonb_typeof(d -> 'pagos') = 'array' and jsonb_array_length(d -> 'pagos') > 0 then
        v_pg := privado.cargar_pagos_pasados(p_gimnasio_id, v_sede, sid, sus, d -> 'pagos', v_alta, e.id, 'importacion', imp,
                                             'Carga de pagos anteriores · archivo ' || coalesce(left(p_archivo, 80), 'sin nombre'));
        v_pagos := v_pagos + (v_pg ->> 'pagos')::int; v_monto := v_monto + (v_pg ->> 'total')::numeric; v_cob := v_cob + (v_pg ->> 'coberturas')::int;
      end if;
    end if;
    n := n + 1;
  end loop;
  update public.importaciones set importados = n where id = imp;
  get diagnostics k = row_count;
  if k <> 1 then raise exception 'No se pudo cerrar la importación.'; end if;
  select count(*) into v_n_final from public.socios s where s.gimnasio_id = p_gimnasio_id and s.importacion_id = imp;
  if v_n_final <> n then raise exception 'La importación no cerró: % socios creados, % esperados', v_n_final, n; end if;
  select count(*) into v_ventas from public.ventas v where v.gimnasio_id = p_gimnasio_id and v.importacion_id = imp;
  if v_ventas <> v_pagos then raise exception 'La importación no cerró: % pagos cargados, % esperados', v_ventas, v_pagos; end if;
  analyze public.socios;
  return jsonb_build_object('importacion_id', imp, 'importados', n, 'salteados', filas_n - n,
                            'ya_existian', v_ya, 'repetidas_en_archivo', v_rep, 'con_cobertura', v_cob,
                            'pagos_cargados', v_pagos, 'monto_pagos', v_monto);
end $$;

-- ── El alta de a uno, en el pasado: socio + membresía + pagos, todo o nada ──
create or replace function public.alta_socio_pasado(
  p_gimnasio_id uuid, p_sede_id uuid, p_datos jsonb, p_plan_id uuid, p_fecha_alta date, p_pagos jsonb default '[]'::jsonb
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  e public.equipo; zona text; hoy date; norm jsonb; alta date; sid uuid; sus uuid; k int; v_pg jsonb := jsonb_build_object('pagos', 0, 'coberturas', 0, 'total', 0);
  n_pagos int;
begin
  e := privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado']);
  if not exists (select 1 from public.sedes s where s.id = p_sede_id and s.gimnasio_id = p_gimnasio_id) then
    raise exception 'La sede no es de este gimnasio' using errcode = '22023';
  end if;
  if e.sede_id is not null and e.sede_id <> p_sede_id then raise exception 'Sin permiso para esa sede' using errcode = '42501'; end if;
  select g.zona_horaria into zona from public.gimnasios g where g.id = p_gimnasio_id;
  if zona is null then raise exception 'No se encontró el gimnasio.'; end if;
  hoy := privado.dia_local(now(), zona);
  if p_fecha_alta is not null and p_fecha_alta > hoy then raise exception 'La fecha de alta no puede ser futura' using errcode = '22023'; end if;
  if p_fecha_alta is not null and p_fecha_alta < date '1990-01-01' then raise exception 'La fecha de alta es imposible' using errcode = '22023'; end if;
  norm := privado.normalizar_pagos_pasados(p_gimnasio_id, coalesce(p_pagos, '[]'::jsonb), p_fecha_alta);
  if jsonb_array_length(norm -> 'errores') > 0 then raise exception '%', (norm -> 'errores') ->> 0 using errcode = '22023'; end if;
  n_pagos := jsonb_array_length(norm -> 'pagos');
  if p_plan_id is null and n_pagos > 0 then raise exception 'Para cargar pagos anteriores elegí el plan' using errcode = '22023'; end if;
  alta := coalesce(p_fecha_alta, case when n_pagos > 0 then (norm -> 'pagos' -> 0 ->> 'fecha')::date end);
  if alta is null then raise exception 'Cargá la fecha de alta o al menos un pago anterior' using errcode = '22023'; end if;
  if p_plan_id is not null then perform privado.validar_plan_nuevo(p_gimnasio_id, p_plan_id); end if;

  sid := public.guardar_socio(p_gimnasio_id, null, p_datos);
  update public.socios set creado_en = privado.medianoche(alta, zona) where id = sid and gimnasio_id = p_gimnasio_id;
  get diagnostics k = row_count;
  if k <> 1 then raise exception 'No se pudo poner la fecha de alta'; end if;
  if p_plan_id is not null then
    insert into public.suscripciones (gimnasio_id, socio_id, plan_id, inicio, creado_por)
    values (p_gimnasio_id, sid, p_plan_id, least(now(), privado.medianoche(alta, zona)), auth.uid())
    returning id into sus;
    get diagnostics k = row_count;
    if k <> 1 or sus is null then raise exception 'No se pudo crear la membresía'; end if;
    if n_pagos > 0 then
      v_pg := privado.cargar_pagos_pasados(p_gimnasio_id, p_sede_id, sid, sus, norm -> 'pagos', alta, e.id, 'recepcion', null,
                                           'Alta con fecha del ' || to_char(alta, 'DD/MM/YYYY') || ': pagos anteriores');
    end if;
  end if;
  return jsonb_build_object('socio_id', sid, 'alta', alta, 'pagos', (v_pg ->> 'pagos')::int, 'coberturas', (v_pg ->> 'coberturas')::int,
                            'total', (v_pg ->> 'total')::numeric);
end $$;

-- ── Control: la campana avisa cobros con fecha atrasada, salvo la carga inicial del gimnasio nuevo ──
-- Copia de campana_control (20261106007200) con una sola condición más: not v.carga_inicial.
create or replace function public.campana_control(p_gimnasio_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare e public.equipo; items jsonb := '[]'::jsonb; zona text;
begin
  e := privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado']);
  perform privado.exigir_resultado(p_gimnasio_id);
  select g.zona_horaria into zona from public.gimnasios g where g.id = p_gimnasio_id;

  -- Un cobro cargado con una fecha que no es la de hoy (de otros, últimos 7 días). La carga inicial
  -- de un gimnasio nuevo (su primer mes) no avisa: queda en Control, sin alerta.
  items := items || coalesce((select jsonb_agg(jsonb_build_object(
             'clave', 'otro_dia:' || v.id::text, 'emoji', '📅',
             'titulo', 'Cobro cargado con fecha del ' || to_char(v.confirmada_en at time zone zona, 'DD/MM') || ': ' || privado.formato_pesos(t.total),
             'detalle', concat_ws(' · ', q.nombre, v.otro_dia_motivo),
             'href', '/control?tipos=otro_dia', 'en', v.registrada_en))
           from public.ventas v
           left join public.equipo q on q.id = v.creado_por
           cross join lateral (select coalesce(sum(i.cantidad * i.precio_unitario - i.descuento), 0) as total
                                 from public.venta_items i where i.venta_id = v.id) t
          where v.gimnasio_id = p_gimnasio_id and v.otro_dia_motivo is not null and not v.carga_inicial
            and v.registrada_en > now() - interval '7 days' and v.creado_por is distinct from e.id), '[]'::jsonb);

  -- Anti-préstamo: alguien que ya había entrado volvió por otra vía en pocos minutos.
  items := items || coalesce((select jsonb_agg(jsonb_build_object(
             'clave', 'prestamo:' || a.id::text, 'emoji', '🪪',
             'titulo', 'Posible préstamo de entrada: ' || trim(s.nombre || ' ' || s.apellido),
             'detalle', 'Volvió a entrar a los ' || a.minutos || ' min por otra vía',
             'href', '/control?tipos=prestamo', 'en', a.momento))
           from public.alertas_prestamo a join public.socios s on s.id = a.socio_id
          where a.gimnasio_id = p_gimnasio_id and a.momento > now() - interval '7 days'), '[]'::jsonb);

  -- VD-46: suspensiones por revisar, cortesías repetidas, bajas sin responder, devoluciones.
  items := items || privado.avisos_moderacion(p_gimnasio_id, zona);

  return privado.con_leidos(p_gimnasio_id, items);
end $$;

-- ── Deshacer una importación: lo que cargó plata no se deshace de un golpe ──
create or replace function public.deshacer_importacion(p_gimnasio_id uuid, p_importacion_id uuid) returns int
language plpgsql security definer set search_path = '' as $$
declare i public.importaciones; n int;
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado']);
  select * into i from public.importaciones x where x.gimnasio_id = p_gimnasio_id and x.id = p_importacion_id for update;
  if i.id is null then raise exception 'No se encontró esa importación.'; end if;
  if i.deshecha_en is not null then raise exception 'Esa importación ya se deshizo.'; end if;
  if i.creado_en <= now() - interval '24 hours' then raise exception 'Pasaron más de 24 horas: ya no se puede deshacer entera. Corregí los socios uno por uno.'; end if;
  if exists (select 1 from public.ventas v where v.gimnasio_id = p_gimnasio_id and v.importacion_id = i.id) then
    raise exception 'Esa importación cargó pagos: la plata no se borra. Si un pago está mal, anulá esa venta desde la ficha del socio; el resto de los socios queda como está.';
  end if;
  perform set_config('gymos.deshacer_importacion', i.id::text, true);
  begin
    delete from public.coberturas c where c.gimnasio_id = p_gimnasio_id and c.importacion_id = i.id;
    delete from public.suscripciones s where s.gimnasio_id = p_gimnasio_id and s.importacion_id = i.id;
    delete from public.socios s where s.gimnasio_id = p_gimnasio_id and s.importacion_id = i.id;
    get diagnostics n = row_count;
  exception when foreign_key_violation or check_violation then
    raise exception 'No se puede deshacer: algunos de esos socios ya tienen movimientos (entradas, ventas, reservas o pagos).';
  end;
  perform set_config('gymos.deshacer_importacion', '', true);
  update public.importaciones set deshecha_en = now(), deshecha_por = auth.uid() where id = i.id;
  return n;
end $$;

-- ── Permisos (las firmas que ya existían no cambian; se reafirman) ──
revoke all on function public.revisar_importacion(uuid, jsonb), public.importar_socios(uuid, jsonb, text),
  public.campana_control(uuid), public.deshacer_importacion(uuid, uuid) from public, anon, authenticated;
grant execute on function public.revisar_importacion(uuid, jsonb), public.importar_socios(uuid, jsonb, text),
  public.campana_control(uuid), public.deshacer_importacion(uuid, uuid) to authenticated, service_role;
revoke all on function public.alta_socio_pasado(uuid, uuid, jsonb, uuid, date, jsonb) from public, anon, authenticated;
grant execute on function public.alta_socio_pasado(uuid, uuid, jsonb, uuid, date, jsonb) to authenticated, service_role;

-- ── Verificación ────────────────────────────────────────────────────
do $$
declare f text;
begin
  foreach f in array array[
    'privado.monto_importado(text)', 'privado.medio_importado(text)', 'privado.normalizar_pagos_pasados(uuid, jsonb, date)',
    'privado.cargar_pagos_pasados(uuid, uuid, uuid, uuid, jsonb, date, uuid, text, uuid, text)', 'privado.fila_importacion(uuid, jsonb)',
    'public.revisar_importacion(uuid, jsonb)', 'public.importar_socios(uuid, jsonb, text)', 'public.alta_socio_pasado(uuid, uuid, jsonb, uuid, date, jsonb)',
    'public.campana_control(uuid)', 'public.deshacer_importacion(uuid, uuid)'] loop
    if not exists (select 1 from pg_proc where oid = f::regprocedure and 'search_path=""' = any (proconfig)) then
      raise exception 'Verificación: % sin search_path vacío', f;
    end if;
    if has_function_privilege('anon', f, 'execute') then raise exception 'Verificación: anon puede ejecutar %', f; end if;
  end loop;
  foreach f in array array[
    'privado.monto_importado(text)', 'privado.medio_importado(text)', 'privado.normalizar_pagos_pasados(uuid, jsonb, date)',
    'privado.cargar_pagos_pasados(uuid, uuid, uuid, uuid, jsonb, date, uuid, text, uuid, text)'] loop
    if has_function_privilege('authenticated', f, 'execute') then raise exception 'Verificación: authenticated puede ejecutar %', f; end if;
  end loop;
  if (select count(*) from pg_proc p join pg_namespace s on s.oid = p.pronamespace where s.nspname = 'public' and p.proname = 'importar_socios') <> 1 then
    raise exception 'Verificación: importar_socios quedó duplicada';
  end if;
  if not exists (select 1 from pg_constraint where conname = 'pagos_cargado_sin_caja') then raise exception 'Verificación: falta pagos_cargado_sin_caja'; end if;
  if exists (select 1 from pg_constraint where conrelid = 'public.pagos'::regclass and conname = 'pagos_check1') then
    raise exception 'Verificación: quedó pagos_check1 (el efectivo del pasado no entra)';
  end if;
  if position('carga_inicial' in pg_get_functiondef('public.campana_control(uuid)'::regprocedure)) = 0 then
    raise exception 'Verificación: campana_control no saltea la carga inicial';
  end if;
end $$;
