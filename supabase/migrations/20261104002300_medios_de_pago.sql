-- ═══════════════════════════════════════════════════════════════════
-- 0023 · Medios de pago que acepta cada gimnasio (CFG-3).
--
-- configuracion_gimnasio.medios_aceptados (efectivo, transferencia,
-- débito, crédito; al menos uno) y banco_transferencia (lo ve el socio
-- junto al alias). La base hace cumplir los medios, no solo la pantalla:
--   · vender rechaza un pago con un medio que el gimnasio no acepta (y el
--     efectivo con Caja apagada, que no tiene dónde contarse);
--   · informar_transferencia rechaza si el gimnasio no recibe transferencias;
--   · mi_socio muestra los datos para transferir solo si las recibe;
--   · precios_venta dice qué medios ofrecer en Vender;
--   · guardar_configuracion no deja apagar todos los medios, ni dejar el
--     efectivo como único medio con Caja apagada.
--
-- Las funciones se reescriben completas (create or replace, misma firma),
-- copiadas de su última versión con estos cambios.
-- ═══════════════════════════════════════════════════════════════════

do $$
begin
  if to_regprocedure('public.guardar_configuracion(uuid,jsonb)') is null then raise exception 'Guarda: falta la migración 0020'; end if;
  if to_regprocedure('public.precios_venta(uuid,uuid)') is null then raise exception 'Guarda: falta la migración 0014'; end if;
  if to_regprocedure('public.mi_socio(uuid,uuid)') is null then raise exception 'Guarda: falta la migración 0017'; end if;
  if to_regprocedure('public.vender(uuid,jsonb,jsonb,uuid,uuid)') is null then raise exception 'Guarda: falta la migración 0009'; end if;
  if to_regprocedure('public.informar_transferencia(uuid,text,integer)') is null then raise exception 'Guarda: falta la migración 0009'; end if;
end $$;

-- ── Columnas (nullable → backfill → not null) ───────────────────────
alter table public.configuracion_gimnasio add column if not exists medios_aceptados text[];
alter table public.configuracion_gimnasio add column if not exists banco_transferencia text;
update public.configuracion_gimnasio set medios_aceptados = array['efectivo', 'transferencia', 'debito', 'credito']
 where medios_aceptados is null;
alter table public.configuracion_gimnasio alter column medios_aceptados set default array['efectivo', 'transferencia', 'debito', 'credito'];
alter table public.configuracion_gimnasio alter column medios_aceptados set not null;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'configuracion_medios_validos') then
    alter table public.configuracion_gimnasio add constraint configuracion_medios_validos
      check (cardinality(medios_aceptados) >= 1 and medios_aceptados <@ array['efectivo', 'transferencia', 'debito', 'credito']);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'configuracion_banco_largo') then
    alter table public.configuracion_gimnasio add constraint configuracion_banco_largo
      check (banco_transferencia is null or length(banco_transferencia) <= 60);
  end if;
end $$;

create or replace function public.configuracion_panel(p_gimnasio_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare c public.configuracion_gimnasio; g public.gimnasios;
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado']);
  select * into c from public.configuracion_gimnasio where gimnasio_id = p_gimnasio_id;
  select * into g from public.gimnasios where id = p_gimnasio_id;
  return jsonb_build_object(
    'nombre', g.nombre, 'slug', g.slug,
    'color_acento', c.color_acento, 'color_fondo', c.color_fondo, 'logo_path', c.logo_path,
    'cobra_membresia', c.cobra_membresia, 'cobra_pase', c.cobra_pase, 'cobra_pack', c.cobra_pack,
    'modo_clases', c.modo_clases, 'accesos_activos', to_jsonb(c.accesos_activos),
    'tolerancia_dias', c.tolerancia_dias, 'dias_aviso', c.dias_aviso,
    'reingreso_mismo_dia_consume', c.reingreso_mismo_dia_consume,
    'secciones_apagadas', to_jsonb(c.secciones_apagadas),
    'alias_transferencia', c.alias_transferencia, 'banco_transferencia', c.banco_transferencia, 'medios_aceptados', to_jsonb(c.medios_aceptados), 'cbu', c.cbu, 'titular_cuenta', c.titular_cuenta,
    'descuento_max_recepcion', c.descuento_max_recepcion,
    'retencion_dias_ausencia', c.retencion_dias_ausencia, 'retencion_dias_nuevo', c.retencion_dias_nuevo,
    'retencion_dias_vencido', c.retencion_dias_vencido, 'retencion_dias_se_fue', c.retencion_dias_se_fue,
    'reserva_dias_anticipacion', c.reserva_dias_anticipacion, 'cancelacion_horas_limite', c.cancelacion_horas_limite);
end $$;

create or replace function public.guardar_configuracion(p_gimnasio_id uuid, p_datos jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare
  n int;
  desconocidos text[];
  v_nombre text;
  v_alias text;
  v_cbu text;
  v_titular text;
  v_descuento numeric;
  v_modo text;
  v_accesos text[];
  v_secciones text[];
  v_membresia boolean;
  v_pase boolean;
  v_pack boolean;
  v_tol int; v_aviso int; v_aus int; v_nuevo int; v_venc int; v_fue int; v_res int; v_canc int;
  v_acento text; v_fondo text; v_reingreso boolean; v_medios text[]; v_banco text; v_secciones_final text[]; v_medios_final text[];
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno']);
  if jsonb_typeof(p_datos) is distinct from 'object' then raise exception 'Datos inválidos'; end if;
  select array_agg(k) into desconocidos from jsonb_object_keys(p_datos) k
   where k not in ('nombre', 'color_acento', 'color_fondo', 'cobra_membresia', 'cobra_pase', 'cobra_pack', 'modo_clases',
                   'accesos_activos', 'tolerancia_dias', 'dias_aviso', 'reingreso_mismo_dia_consume', 'secciones_apagadas',
                   'alias_transferencia', 'cbu', 'titular_cuenta', 'descuento_max_recepcion', 'retencion_dias_ausencia',
                   'retencion_dias_nuevo', 'retencion_dias_vencido', 'retencion_dias_se_fue', 'reserva_dias_anticipacion',
                   'cancelacion_horas_limite', 'medios_aceptados', 'banco_transferencia');
  if desconocidos is not null then raise exception 'Campos que no se pueden cambiar acá: %', array_to_string(desconocidos, ', '); end if;

  -- Marca
  if p_datos ? 'nombre' then
    v_nombre := trim(coalesce(p_datos ->> 'nombre', ''));
    if v_nombre = '' then raise exception 'El nombre del gimnasio es obligatorio.' using errcode = '22023'; end if;
    if length(v_nombre) > 60 then raise exception 'El nombre del gimnasio puede tener hasta 60 letras.' using errcode = '22023'; end if;
  end if;
  v_acento := privado.config_color(p_datos, 'color_acento', 'Color principal');
  v_fondo := privado.config_color(p_datos, 'color_fondo', 'Color de fondo');

  -- Qué cobrás
  v_membresia := privado.config_booleano(p_datos, 'cobra_membresia', 'Membresía');
  v_pase := privado.config_booleano(p_datos, 'cobra_pase', 'Pase diario');
  v_pack := privado.config_booleano(p_datos, 'cobra_pack', 'Pack de clases');

  -- Medios de pago
  if p_datos ? 'medios_aceptados' then
    if jsonb_typeof(p_datos -> 'medios_aceptados') is distinct from 'array' then raise exception 'Datos inválidos'; end if;
    v_medios := array(select distinct x from jsonb_array_elements_text(p_datos -> 'medios_aceptados') x order by 1);
    if exists (select 1 from unnest(v_medios) x where x <> all (array['efectivo', 'transferencia', 'debito', 'credito'])) then
      raise exception 'Medio de pago desconocido.' using errcode = '22023';
    end if;
    if cardinality(v_medios) = 0 then
      raise exception 'Dejá prendido al menos un medio de pago.' using errcode = '22023';
    end if;
  end if;

  -- Clases y accesos
  if p_datos ? 'modo_clases' then
    v_modo := p_datos ->> 'modo_clases';
    if v_modo is null or v_modo not in ('reserva', 'sin_reserva', 'ninguno') then
      raise exception 'Elegí cómo funcionan las clases: con reserva, sin reserva o sin clases.' using errcode = '22023';
    end if;
  end if;
  if p_datos ? 'accesos_activos' then
    if jsonb_typeof(p_datos -> 'accesos_activos') is distinct from 'array' then raise exception 'Datos inválidos'; end if;
    v_accesos := array(select distinct x from jsonb_array_elements_text(p_datos -> 'accesos_activos') x);
    if exists (select 1 from unnest(v_accesos) x
                where x <> all (array['recepcion', 'qr_socio', 'qr_pared', 'kiosco', 'nfc', 'molinete'])) then
      raise exception 'Forma de entrada desconocida.' using errcode = '22023';
    end if;
    if cardinality(v_accesos) = 0 then
      raise exception 'Dejá prendida al menos una forma de entrar al gimnasio.' using errcode = '22023';
    end if;
  end if;
  if p_datos ? 'secciones_apagadas' then
    if jsonb_typeof(p_datos -> 'secciones_apagadas') is distinct from 'array' then raise exception 'Datos inválidos'; end if;
    v_secciones := array(select distinct x from jsonb_array_elements_text(p_datos -> 'secciones_apagadas') x);
    if exists (select 1 from unnest(v_secciones) x where x <> all (privado.secciones_validas())) then
      raise exception 'Sección desconocida';
    end if;
  end if;

  -- Reglas
  v_tol := privado.config_entero(p_datos, 'tolerancia_dias', 0, 60, 'Días de tolerancia');
  v_aviso := privado.config_entero(p_datos, 'dias_aviso', 0, 30, 'Días de aviso antes del vencimiento');
  v_reingreso := privado.config_booleano(p_datos, 'reingreso_mismo_dia_consume', 'Volver a entrar el mismo día');
  if p_datos ? 'descuento_max_recepcion' then
    begin
      v_descuento := nullif(trim(coalesce(p_datos ->> 'descuento_max_recepcion', '')), '')::numeric;
    exception when invalid_text_representation then
      raise exception 'Descuento máximo de recepción: tiene que ser un número entre 0 y 100.' using errcode = '22023';
    end;
    if v_descuento is null then raise exception 'Descuento máximo de recepción: no puede quedar vacío, poné un número entre 0 y 100.' using errcode = '22023'; end if;
    if v_descuento < 0 or v_descuento > 100 then raise exception 'Descuento máximo de recepción: tiene que estar entre 0 y 100 %%.' using errcode = '22023'; end if;
  end if;
  v_aus := privado.config_entero(p_datos, 'retencion_dias_ausencia', 3, 90, 'Días sin venir para avisar');
  v_nuevo := privado.config_entero(p_datos, 'retencion_dias_nuevo', 7, 90, 'Días que un socio cuenta como nuevo');
  v_venc := privado.config_entero(p_datos, 'retencion_dias_vencido', 1, 120, 'Días vencido para avisar');
  v_fue := privado.config_entero(p_datos, 'retencion_dias_se_fue', 7, 365, 'Días para darlo por ido');
  v_res := privado.config_entero(p_datos, 'reserva_dias_anticipacion', 0, 60, 'Días de anticipación para reservar');
  v_canc := privado.config_entero(p_datos, 'cancelacion_horas_limite', 0, 72, 'Horas límite para cancelar');

  -- Transferencias
  if p_datos ? 'alias_transferencia' then
    v_alias := nullif(trim(coalesce(p_datos ->> 'alias_transferencia', '')), '');
    if v_alias is not null and v_alias !~ '^[A-Za-z0-9.-]{6,20}$' then
      raise exception 'El alias tiene que tener de 6 a 20 caracteres: letras, números, puntos o guiones, sin espacios.' using errcode = '22023';
    end if;
  end if;
  if p_datos ? 'cbu' then
    v_cbu := nullif(regexp_replace(coalesce(p_datos ->> 'cbu', ''), '[\s-]', '', 'g'), '');
    if v_cbu is not null and v_cbu !~ '^[0-9]{22}$' then
      raise exception 'El CBU o CVU tiene 22 números (sin letras). El que pusiste tiene %.', length(regexp_replace(v_cbu, '\D', '', 'g'))
        using errcode = '22023';
    end if;
  end if;
  if p_datos ? 'banco_transferencia' then
    v_banco := nullif(trim(coalesce(p_datos ->> 'banco_transferencia', '')), '');
    if length(v_banco) > 60 then raise exception 'El banco puede tener hasta 60 letras.' using errcode = '22023'; end if;
  end if;
  if p_datos ? 'titular_cuenta' then
    v_titular := nullif(trim(coalesce(p_datos ->> 'titular_cuenta', '')), '');
    if length(v_titular) > 80 then raise exception 'El titular de la cuenta puede tener hasta 80 letras.' using errcode = '22023'; end if;
  end if;

  if v_nombre is not null then
    update public.gimnasios set nombre = v_nombre where id = p_gimnasio_id;
  end if;

  update public.configuracion_gimnasio c set
    color_acento = coalesce(v_acento, c.color_acento),
    color_fondo = coalesce(v_fondo, c.color_fondo),
    cobra_membresia = coalesce(v_membresia, c.cobra_membresia),
    cobra_pase = coalesce(v_pase, c.cobra_pase),
    cobra_pack = coalesce(v_pack, c.cobra_pack),
    modo_clases = coalesce(v_modo, c.modo_clases),
    accesos_activos = case when p_datos ? 'accesos_activos' then v_accesos else c.accesos_activos end,
    tolerancia_dias = coalesce(v_tol, c.tolerancia_dias),
    dias_aviso = coalesce(v_aviso, c.dias_aviso),
    reingreso_mismo_dia_consume = coalesce(v_reingreso, c.reingreso_mismo_dia_consume),
    secciones_apagadas = case when p_datos ? 'secciones_apagadas' then v_secciones else c.secciones_apagadas end,
    alias_transferencia = case when p_datos ? 'alias_transferencia' then v_alias else c.alias_transferencia end,
    cbu = case when p_datos ? 'cbu' then v_cbu else c.cbu end,
    titular_cuenta = case when p_datos ? 'titular_cuenta' then v_titular else c.titular_cuenta end,
    banco_transferencia = case when p_datos ? 'banco_transferencia' then v_banco else c.banco_transferencia end,
    medios_aceptados = coalesce(v_medios, c.medios_aceptados),
    descuento_max_recepcion = coalesce(v_descuento, c.descuento_max_recepcion),
    retencion_dias_ausencia = coalesce(v_aus, c.retencion_dias_ausencia),
    retencion_dias_nuevo = coalesce(v_nuevo, c.retencion_dias_nuevo),
    retencion_dias_vencido = coalesce(v_venc, c.retencion_dias_vencido),
    retencion_dias_se_fue = coalesce(v_fue, c.retencion_dias_se_fue),
    reserva_dias_anticipacion = coalesce(v_res, c.reserva_dias_anticipacion),
    cancelacion_horas_limite = coalesce(v_canc, c.cancelacion_horas_limite),
    actualizado_en = now()
   where c.gimnasio_id = p_gimnasio_id
  returning c.cobra_membresia, c.cobra_pase, c.cobra_pack, c.secciones_apagadas, c.medios_aceptados
       into v_membresia, v_pase, v_pack, v_secciones_final, v_medios_final;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'No se pudo guardar la configuración'; end if;
  if not (v_membresia or v_pase or v_pack) then
    raise exception 'Dejá prendida al menos una forma de cobrar (membresía, pase diario o pack de clases).' using errcode = '22023';
  end if;
  -- Sin Caja no se cobra en efectivo: si es el único medio, no quedaría cómo cobrar.
  if 'caja' = any (v_secciones_final) and v_medios_final <@ array['efectivo'] then
    raise exception 'Sin Caja no se cobra en efectivo, y es el único medio prendido: prendé otro medio de pago o dejá Caja prendida.' using errcode = '22023';
  end if;
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

create or replace function public.vender(
  p_sede_id uuid, p_items jsonb, p_pagos jsonb, p_socio_id uuid default null, p_turno_id uuid default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare g uuid; eid uuid; rol text; tope numeric; c public.configuracion_gimnasio; no_acepta text;
begin
  select gimnasio_id into g from public.sedes where id = p_sede_id;
  if g is null then raise exception 'Sin permiso o sede inexistente' using errcode = '42501'; end if;
  eid := privado.exigir_rol(g, array['dueno', 'encargado', 'recepcion'], p_sede_id);
  select e.rol into rol from public.equipo e where e.id = eid;
  select * into c from public.configuracion_gimnasio where gimnasio_id = g;
  select string_agg(distinct case x ->> 'medio' when 'credito' then 'tarjeta de crédito' when 'debito' then 'tarjeta de débito'
                                              else x ->> 'medio' end, ', ') into no_acepta
    from jsonb_array_elements(case when jsonb_typeof(p_pagos) = 'array' then p_pagos else '[]'::jsonb end) x
   where coalesce(x ->> 'medio', '') <> all (array(select m from unnest(c.medios_aceptados) m
                                                      where not (m = 'efectivo' and 'caja' = any (c.secciones_apagadas))));
  if no_acepta is not null then
    raise exception 'Este gimnasio no cobra con %. Se cambia en Configuración → Cobros.', no_acepta using errcode = '22023';
  end if;
  if rol = 'recepcion' then
    select descuento_max_recepcion into tope from public.configuracion_gimnasio where gimnasio_id = g;
  end if;
  return privado.vender(g, p_sede_id, p_socio_id, p_items, p_pagos, p_turno_id, eid, tope, now());
end $$;

create or replace function public.informar_transferencia(p_socio_id uuid, p_comprobante_path text, p_cuotas int default 1)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare g uuid; eid uuid;
begin
  select gimnasio_id into g from public.socios where id = p_socio_id;
  if g is null then raise exception 'Sin permiso o socio inexistente' using errcode = '42501'; end if;
  if not exists (select 1 from public.configuracion_gimnasio c where c.gimnasio_id = g and 'transferencia' = any (c.medios_aceptados)) then
    raise exception 'Este gimnasio no recibe pagos por transferencia: pagá en el mostrador.' using errcode = '22023';
  end if;
  if p_socio_id not in (select privado.mis_socios()) then
    eid := privado.exigir_rol(g, array['dueno', 'encargado', 'recepcion']);
  end if;
  return privado.informar_transferencia(p_socio_id, p_cuotas, p_comprobante_path, now(), eid);
end $$;

create or replace function public.mi_socio(p_gimnasio_id uuid, p_socio_id uuid default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare s public.socios; c public.configuracion_gimnasio; v public.veredicto_acceso; sus public.suscripciones; pl public.planes;
        mios jsonb;
begin
  if auth.uid() is null then raise exception 'Necesitás iniciar sesión' using errcode = '42501'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('socio_id', x.id, 'nombre', trim(x.nombre || ' ' || x.apellido)) order by x.nombre), '[]'::jsonb)
    into mios from public.socios x where x.gimnasio_id = p_gimnasio_id and x.usuario_id = auth.uid() and x.dado_de_baja_en is null;
  if jsonb_array_length(mios) = 0 then
    raise exception 'Tu cuenta no es de ningún socio de este gimnasio' using errcode = '42501';
  end if;
  if p_socio_id is null then
    if jsonb_array_length(mios) > 1 then
      return jsonb_build_object('elegir', true, 'socios', mios);
    end if;
    select * into s from public.socios where id = (mios -> 0 ->> 'socio_id')::uuid;
  else
    select * into s from public.socios where id = p_socio_id and gimnasio_id = p_gimnasio_id and usuario_id = auth.uid();
    if not found then raise exception 'Sin permiso para ver ese socio' using errcode = '42501'; end if;
  end if;

  select * into c from public.configuracion_gimnasio where gimnasio_id = p_gimnasio_id;
  v := privado.calcular_acceso(s.id, now(), null);
  select * into sus from public.suscripciones where socio_id = s.id and baja_en is null;
  if found then select * into pl from public.planes where id = sus.plan_id; end if;

  return jsonb_build_object(
    'elegir', false,
    'socios', mios,
    'socio', jsonb_build_object('socio_id', s.id, 'nombre', s.nombre, 'apellido', s.apellido, 'numero', s.numero),
    -- Mismo veredicto que la puerta; sin la indicación para la recepción ("· avisale").
    'acceso', to_jsonb(v) || jsonb_build_object('texto', replace(v.texto, ' · avisale', '')),
    'plan', case when pl.id is not null then jsonb_build_object('nombre', pl.nombre,
              'precio_transferencia', privado.precio_para(pl.id, now(), 'transferencia', null, true)) end,
    'packs', coalesce((select jsonb_agg(jsonb_build_object('plan', p2.nombre, 'cantidad', pk.cantidad, 'vence_en', pk.vence_en,
                         'usadas', (select count(*) from public.consumos_pack cp where cp.pack_id = pk.id and cp.anulado_en is null)))
                        from public.packs pk join public.planes p2 on p2.id = pk.plan_id
                       where pk.socio_id = s.id and pk.anulado_en is null and (pk.vence_en is null or pk.vence_en > now())), '[]'::jsonb),
    'reservas', coalesce((select jsonb_agg(jsonb_build_object('reserva_id', r.id, 'clase_id', k.id, 'actividad', a.nombre, 'emoji', a.emoji,
                            'inicio', k.inicio, 'estado', r.estado,
                            'posicion', case when r.estado = 'espera' then (select count(*) from public.reservas r2
                                          where r2.clase_id = r.clase_id and r2.estado = 'espera' and r2.creado_en <= r.creado_en) end)
                            order by k.inicio)
                           from public.reservas r join public.clases k on k.id = r.clase_id join public.actividades a on a.id = k.actividad_id
                          where r.socio_id = s.id and r.estado in ('confirmada', 'espera') and k.inicio > now() and k.cancelada_en is null), '[]'::jsonb),
    'transferencia', case when 'transferencia' = any (c.medios_aceptados) and (c.alias_transferencia is not null or c.cbu is not null) then
                       jsonb_build_object('alias', c.alias_transferencia, 'cbu', c.cbu, 'titular', c.titular_cuenta,
                                          'banco', c.banco_transferencia) end,
    'pendiente', (select jsonb_build_object('monto', p.monto, 'informado_en', p.creado_en)
                    from public.pagos p join public.ventas ve on ve.id = p.venta_id
                   where ve.socio_id = s.id and p.estado = 'pendiente' and p.comprobante_path is not null
                   order by p.creado_en desc limit 1),
    'modo_clases', c.modo_clases,
    'zona', (select gi.zona_horaria from public.gimnasios gi where gi.id = p_gimnasio_id),
    'sedes', coalesce((select jsonb_agg(jsonb_build_object('sede_id', se.id, 'nombre', se.nombre) order by se.es_principal desc, se.nombre)
                         from public.sedes se where se.gimnasio_id = p_gimnasio_id and se.activa), '[]'::jsonb)
  );
end $$;

-- ── Permisos (las firmas no cambian; se reafirman) ─────────────────
revoke all on function public.configuracion_panel(uuid), public.guardar_configuracion(uuid, jsonb), public.precios_venta(uuid, uuid),
  public.vender(uuid, jsonb, jsonb, uuid, uuid), public.informar_transferencia(uuid, text, int), public.mi_socio(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.configuracion_panel(uuid), public.guardar_configuracion(uuid, jsonb), public.precios_venta(uuid, uuid),
  public.vender(uuid, jsonb, jsonb, uuid, uuid), public.informar_transferencia(uuid, text, int), public.mi_socio(uuid, uuid)
  to authenticated, service_role;

-- ── Verificación ────────────────────────────────────────────────────
do $$
declare r record;
begin
  if exists (select 1 from public.configuracion_gimnasio where medios_aceptados is null or cardinality(medios_aceptados) = 0) then
    raise exception 'Verificación: un gimnasio quedó sin medios de pago';
  end if;
  for r in select p.oid, p.proname, p.proconfig from pg_proc p join pg_namespace s on s.oid = p.pronamespace
            where s.nspname = 'public' and p.proname in ('configuracion_panel', 'guardar_configuracion', 'precios_venta',
                                                        'vender', 'informar_transferencia', 'mi_socio') loop
    if r.proconfig is null or not ('search_path=""' = any (r.proconfig)) then raise exception 'Verificación: % sin search_path vacío', r.proname; end if;
    if has_function_privilege('anon', r.oid, 'execute') then raise exception 'Verificación: anon puede ejecutar %', r.proname; end if;
  end loop;
  if (select count(*) from pg_proc p join pg_namespace s on s.oid = p.pronamespace
       where s.nspname = 'public' and p.proname in ('vender', 'mi_socio', 'precios_venta', 'informar_transferencia')) <> 4 then
    raise exception 'Verificación: quedó más de una versión de alguna función';
  end if;
end $$;
