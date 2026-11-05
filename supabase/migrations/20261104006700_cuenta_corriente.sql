-- 0067 · Deuda / cuenta corriente (VEN-5, decisión D5).
-- D5: apagado por defecto. Si el gimnasio lo prende, se puede cobrar "a
-- cuenta" hasta un tope en $ por socio; la puerta muestra amarillo "debe $X"
-- y la deuda se cobra en Vender. Lo debido no se guarda: sale de los pagos a
-- cuenta menos lo que se pagó de deuda (ventas no anuladas).
--
--   configuracion_gimnasio.fiado_activo / fiado_tope
--   pagos.medio 'cuenta_corriente'; venta_items.tipo 'deuda' (pago de deuda)
--   privado.deuda_socio(socio)
--   privado.calcular_acceso: copia (0006) que avisa la deuda y pasa a amarillo
--     si puede entrar (no lo deja afuera: D5)
--   public.vender (0023), privado.vender (0066), precios_venta (0066) y
--   configuración (0061): copias con la cuenta corriente
--   panel_inicio (0013): "Cobrado hoy" no suma lo fiado (sí cuando paga la deuda)

-- ── Guarda de entrada ───────────────────────────────────────────────
do $$
begin
  if to_regclass('public.convenios') is null then raise exception 'Guarda: falta la migración 0066'; end if;
end $$;

alter table public.configuracion_gimnasio add column if not exists fiado_activo boolean not null default false;
alter table public.configuracion_gimnasio add column if not exists fiado_tope numeric(12,2) not null default 0;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'configuracion_fiado_valido' and conrelid = 'public.configuracion_gimnasio'::regclass) then
    alter table public.configuracion_gimnasio add constraint configuracion_fiado_valido check (fiado_tope >= 0 and fiado_tope <= 10000000);
  end if;
end $$;

alter table public.pagos drop constraint if exists pagos_medio_check;
alter table public.pagos add constraint pagos_medio_check
  check (medio in ('efectivo', 'transferencia', 'mercadopago', 'debito', 'credito', 'debito_automatico', 'cuenta_corriente'));
alter table public.venta_items drop constraint if exists venta_items_tipo_check;
alter table public.venta_items add constraint venta_items_tipo_check
  check (tipo in ('cuota', 'pase', 'pack', 'producto', 'matricula', 'adicional', 'otro', 'deuda'));

-- Lo que debe: pagos a cuenta menos pagos de deuda, de ventas no anuladas.
create or replace function privado.deuda_socio(p_socio_id uuid) returns numeric
language sql stable set search_path = '' as $$
  select coalesce((select sum(p.monto) from public.pagos p join public.ventas v on v.id = p.venta_id
                    where v.socio_id = p_socio_id and v.estado <> 'anulada' and p.medio = 'cuenta_corriente' and p.estado = 'aprobado'), 0)
       - coalesce((select sum(vi.cantidad * vi.precio_unitario - vi.descuento) from public.venta_items vi join public.ventas v on v.id = vi.venta_id
                    where v.socio_id = p_socio_id and v.estado <> 'anulada' and vi.tipo = 'deuda'), 0)
$$;
revoke all on function privado.deuda_socio(uuid) from public;

-- ── La puerta: copia de privado.calcular_acceso (0006) con la deuda ──
create or replace function privado.calcular_acceso(p_socio_id uuid, p_momento timestamptz, p_sede_id uuid default null)
returns public.veredicto_acceso
language plpgsql stable set search_path = '' as $$
declare
  so public.socios; zona text; cfg public.configuracion_gimnasio;
  v public.veredicto_acceso; vb public.veredicto_acceso;
  vm public.veredicto_acceso; vp public.veredicto_acceso; vk public.veredicto_acceso;
  avisos text[] := '{}'; hoy date; de_baja boolean; deuda numeric;
begin
  select * into so from public.socios where id = p_socio_id;
  if not found then raise exception 'Socio inexistente: %', p_socio_id using errcode = 'P0002'; end if;
  select g.zona_horaria into zona from public.gimnasios g where g.id = so.gimnasio_id;
  select * into cfg from public.configuracion_gimnasio where gimnasio_id = so.gimnasio_id;
  hoy := privado.dia_local(p_momento, zona);
  de_baja := so.dado_de_baja_en is not null and so.dado_de_baja_en <= p_momento;

  vb := privado.bloqueo_persona(p_socio_id, p_momento);
  if vb.color is not null then
    v := vb;
  else
    if not de_baja then vm := privado.via_membresia(p_socio_id, p_momento, p_sede_id, zona, cfg); end if;
    vp := privado.via_pase(p_socio_id, p_momento, p_sede_id, cfg);
    vk := privado.via_pack(p_socio_id, p_momento, p_sede_id, zona, cfg);

    if    coalesce(vm.puede, false) then v := vm;
    elsif coalesce(vp.puede, false) then v := vp;
    elsif coalesce(vk.puede, false) then v := vk;
    elsif vm.color is not null then v := vm;
    elsif vk.color is not null then v := vk;
    elsif vp.color is not null then v := vp;
    else
      v.puede := false; v.color := 'gris'; v.via := 'ninguna'; v.consume := 'nada';
      if de_baja then
        v.motivo := 'se_fue'; v.texto := 'Se dio de baja el ' || privado.fecha_corta(so.dado_de_baja_en, zona);
      else
        v.motivo := 'sin_plan'; v.texto := 'Sin plan activo';
      end if;
    end if;

    if vm.color is not null and vm.motivo is distinct from v.motivo and vm.color <> 'verde' then avisos := array_append(avisos, vm.texto); end if;
    if vk.color is not null and vk.motivo is distinct from v.motivo and vk.color <> 'verde' then avisos := array_append(avisos, vk.texto); end if;
    if vp.color is not null and vp.motivo is distinct from v.motivo and vp.color <> 'verde' then avisos := array_append(avisos, vp.texto); end if;
    if de_baja and v.motivo <> 'se_fue' then
      avisos := array_append(avisos, 'Se dio de baja el ' || privado.fecha_corta(so.dado_de_baja_en, zona));
    end if;
  end if;

  if so.fecha_nacimiento is not null and to_char(so.fecha_nacimiento, 'MMDD') = to_char(hoy, 'MMDD') then
    avisos := array_append(avisos, 'Cumple años hoy');
  end if;

  -- D5: si debe algo a cuenta, se avisa; si puede entrar, pasa a amarillo (no lo deja afuera).
  deuda := privado.deuda_socio(p_socio_id);
  if deuda > 0 then
    avisos := array_append(avisos, 'Debe ' || privado.formato_pesos(deuda) || ' a cuenta');
    if v.puede and v.color = 'verde' then v.color := 'amarillo'; end if;
  end if;

  -- Modo aviso: la primera semana nadie queda afuera por un dato mal
  -- importado. La suspensión no es un dato importado: es una decisión.
  v.modo_aviso := false;
  if not v.puede and v.motivo <> 'suspendido'
     and cfg.avisar_sin_bloquear_hasta is not null and cfg.avisar_sin_bloquear_hasta > p_momento then
    v.puede := true; v.modo_aviso := true;
    avisos := array_prepend('Modo aviso: el sistema habría bloqueado, pero deja pasar'::text, avisos);
  end if;
  v.avisos := avisos;
  v.consume := coalesce(v.consume, 'nada');
  return v;
end $$;

-- ── Configuración: copias de 0061 con el fiado ──────────────────────
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
    'reserva_dias_anticipacion', c.reserva_dias_anticipacion, 'cancelacion_horas_limite', c.cancelacion_horas_limite,
    'pausa_dias_por_anio', c.pausa_dias_por_anio, 'pide_apto', c.pide_apto, 'tope_dejar_pasar', c.tope_dejar_pasar, 'invitados_por_mes', c.invitados_por_mes,
    'recargo_tipo', c.recargo_tipo, 'recargo_valor', c.recargo_valor, 'recargo_dias', c.recargo_dias,
    'fiado_activo', c.fiado_activo, 'fiado_tope', c.fiado_tope);
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
  v_tol int; v_aviso int; v_aus int; v_nuevo int; v_venc int; v_fue int; v_res int; v_canc int; v_pausa int; v_apto boolean; v_tope int; v_invitados int; v_rtipo text; v_rvalor numeric; v_rdias int; v_rfinal record; v_fiado boolean; v_ftope numeric;
  v_acento text; v_fondo text; v_reingreso boolean; v_medios text[]; v_banco text; v_secciones_final text[]; v_medios_final text[];
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno']);
  if jsonb_typeof(p_datos) is distinct from 'object' then raise exception 'Datos inválidos'; end if;
  select array_agg(k) into desconocidos from jsonb_object_keys(p_datos) k
   where k not in ('nombre', 'color_acento', 'color_fondo', 'cobra_membresia', 'cobra_pase', 'cobra_pack', 'modo_clases',
                   'accesos_activos', 'tolerancia_dias', 'dias_aviso', 'reingreso_mismo_dia_consume', 'secciones_apagadas',
                   'alias_transferencia', 'cbu', 'titular_cuenta', 'descuento_max_recepcion', 'retencion_dias_ausencia',
                   'retencion_dias_nuevo', 'retencion_dias_vencido', 'retencion_dias_se_fue', 'reserva_dias_anticipacion',
                   'cancelacion_horas_limite', 'medios_aceptados', 'banco_transferencia', 'pausa_dias_por_anio', 'pide_apto', 'tope_dejar_pasar', 'invitados_por_mes',
                   'recargo_tipo', 'recargo_valor', 'recargo_dias', 'fiado_activo', 'fiado_tope');
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
  if p_datos ? 'pide_apto' then
    if jsonb_typeof(p_datos -> 'pide_apto') is distinct from 'boolean' then raise exception 'Pedir apto físico: elegí sí o no.' using errcode = '22023'; end if;
    v_apto := (p_datos ->> 'pide_apto')::boolean;
  end if;
  -- Recargo por pagar tarde (PLA-7, D8)
  if p_datos ? 'recargo_tipo' then
    v_rtipo := p_datos ->> 'recargo_tipo';
    if v_rtipo is null or v_rtipo not in ('no', 'porcentaje', 'monto') then
      raise exception 'Recargo por pagar tarde: elegí sin recargo, un porcentaje o un monto fijo.' using errcode = '22023';
    end if;
  end if;
  if p_datos ? 'recargo_valor' then
    begin
      v_rvalor := nullif(trim(coalesce(p_datos ->> 'recargo_valor', '')), '')::numeric;
    exception when invalid_text_representation then
      raise exception 'Recargo por pagar tarde: el valor tiene que ser un número.' using errcode = '22023';
    end;
    if v_rvalor is null or v_rvalor < 0 then raise exception 'Recargo por pagar tarde: el valor tiene que ser un número mayor a cero.' using errcode = '22023'; end if;
  end if;
  -- Cuenta corriente (VEN-5, D5)
  v_fiado := privado.config_booleano(p_datos, 'fiado_activo', 'Fiar (cuenta corriente)');
  if p_datos ? 'fiado_tope' then
    begin
      v_ftope := nullif(trim(coalesce(p_datos ->> 'fiado_tope', '')), '')::numeric;
    exception when invalid_text_representation then
      raise exception 'Fiar: el tope tiene que ser un monto en pesos.' using errcode = '22023';
    end;
    if v_ftope is null or v_ftope < 0 or v_ftope > 10000000 then raise exception 'Fiar: el tope va de $0 a $10.000.000.' using errcode = '22023'; end if;
  end if;
  v_rdias := privado.config_entero(p_datos, 'recargo_dias', 1, 60, 'Recargo: días de atraso');
  v_invitados := privado.config_entero(p_datos, 'invitados_por_mes', 0, 10, 'Invitados por socio por mes');
  v_tope := privado.config_entero(p_datos, 'tope_dejar_pasar', 0, 50, 'Dejar pasar: tope por día de la recepción');
  v_pausa := privado.config_entero(p_datos, 'pausa_dias_por_anio', 0, 365, 'Pausa: máximo de días por año');

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

  -- El recargo se valida con cómo queda (lo que viene + lo que ya estaba), antes de guardar.
  select coalesce(v_rtipo, c.recargo_tipo) as tipo, coalesce(v_rvalor, c.recargo_valor) as valor into v_rfinal
    from public.configuracion_gimnasio c where c.gimnasio_id = p_gimnasio_id;
  if v_rfinal.tipo <> 'no' and v_rfinal.valor <= 0 then
    raise exception 'Recargo por pagar tarde: poné de cuánto es (o elegí sin recargo).' using errcode = '22023';
  end if;
  if v_rfinal.tipo = 'porcentaje' and v_rfinal.valor > 50 then
    raise exception 'Recargo por pagar tarde: hasta 50 %%.' using errcode = '22023';
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
    pausa_dias_por_anio = coalesce(v_pausa, c.pausa_dias_por_anio),
    pide_apto = coalesce(v_apto, c.pide_apto),
    tope_dejar_pasar = coalesce(v_tope, c.tope_dejar_pasar),
    invitados_por_mes = coalesce(v_invitados, c.invitados_por_mes),
    recargo_tipo = coalesce(v_rtipo, c.recargo_tipo),
    recargo_valor = case when coalesce(v_rtipo, c.recargo_tipo) = 'no' then 0 else coalesce(v_rvalor, c.recargo_valor) end,
    recargo_dias = coalesce(v_rdias, c.recargo_dias),
    fiado_activo = coalesce(v_fiado, c.fiado_activo),
    fiado_tope = coalesce(round(v_ftope, 2), c.fiado_tope),
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

create or replace function privado.etiqueta_campo(p_campo text) returns text
language sql immutable set search_path = '' as $$
  select case
    when p_campo like 'mensaje.%' then 'Mensaje “' || coalesce((select x ->> 'titulo' from jsonb_array_elements(privado.mensajes_catalogo()) x
                                                              where x ->> 'clave' = substr(p_campo, 9)), substr(p_campo, 9)) || '”'
    -- "Sede principal: dirección" (no "Sede Sede principal"); "Sede Centro: dirección".
    when p_campo like 'sede.%' then case when split_part(p_campo, '.', 2) ilike 'sede%' then '' else 'Sede ' end
      || split_part(p_campo, '.', 2) || ': ' || case split_part(p_campo, '.', 3)
      when 'nombre' then 'nombre' when 'direccion' then 'dirección' when 'telefono' then 'teléfono' when 'mapa_url' then 'link del mapa'
      else split_part(p_campo, '.', 3) end
    else coalesce(jsonb_build_object(
      'nombre', 'Nombre del gimnasio', 'color_acento', 'Color principal', 'color_fondo', 'Color de fondo', 'logo_path', 'Logo',
      'favicon_path', 'Ícono de la pestaña', 'cobra_membresia', 'Cobra membresía', 'cobra_pase', 'Cobra pase diario',
      'cobra_pack', 'Cobra packs de clases', 'modo_clases', 'Clases', 'accesos_activos', 'Formas de entrada',
      'tolerancia_dias', 'Días de gracia al vencer', 'dias_aviso', 'Avisar que vence (días antes)',
      'reingreso_mismo_dia_consume', 'Volver a entrar el mismo día gasta otra entrada', 'secciones_apagadas', 'Secciones apagadas',
      'alias_transferencia', 'Alias', 'cbu', 'CBU / CVU', 'titular_cuenta', 'Titular de la cuenta', 'banco_transferencia', 'Banco o billetera',
      'medios_aceptados', 'Medios de pago', 'descuento_max_recepcion', 'Descuento máximo de la recepción (%)',
      'retencion_dias_ausencia', '“No viene” después de (días)', 'retencion_dias_nuevo', 'Socio nuevo durante (días)',
      'retencion_dias_vencido', 'Vencido pasa a “se fue” después de (días)', 'retencion_dias_se_fue', 'Los que se fueron se muestran durante (días)',
      'reserva_dias_anticipacion', 'Se reserva con hasta (días)', 'cancelacion_horas_limite', 'Cancelar hasta (horas antes)',
      'pagina.publicada', 'Página publicada', 'pagina.whatsapp', 'WhatsApp', 'pagina.instagram', 'Instagram',
      'pagina.email_contacto', 'Mail de contacto', 'altas_online', 'Altas online desde la página',
      'pausa_dias_por_anio', 'Pausa: máximo de días por año', 'pide_apto', 'Pedir apto físico', 'tope_dejar_pasar', 'Dejar pasar: tope por día de la recepción', 'invitados_por_mes', 'Invitados por socio por mes',
    'recargo_tipo', 'Recargo por pagar tarde', 'recargo_valor', 'Recargo: cuánto', 'recargo_dias', 'Recargo: días de atraso',
    'fiado_activo', 'Fiar (cuenta corriente)', 'fiado_tope', 'Fiar: tope por socio') ->> p_campo, p_campo)
  end
$$;

-- ── Vender ──────────────────────────────────────────────────────────
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
  select string_agg(distinct case x ->> 'medio' when 'credito' then 'tarjeta de crédito' when 'debito' then 'tarjeta de débito' when 'cuenta_corriente' then 'a cuenta (fiado)'
                                              else x ->> 'medio' end, ', ') into no_acepta
    from jsonb_array_elements(case when jsonb_typeof(p_pagos) = 'array' then p_pagos else '[]'::jsonb end) x
   where coalesce(x ->> 'medio', '') <> all (array(select m from unnest(c.medios_aceptados) m
                                                      where not (m = 'efectivo' and 'caja' = any (c.secciones_apagadas)))
                                                || case when c.fiado_activo then array['cuenta_corriente'] else '{}'::text[] end);
  if no_acepta is not null then
    raise exception 'Este gimnasio no cobra con %. Se cambia en Configuración → Cobros.', no_acepta using errcode = '22023';
  end if;
  if rol = 'recepcion' then
    select descuento_max_recepcion into tope from public.configuracion_gimnasio where gimnasio_id = g;
  end if;
  return privado.vender(g, p_sede_id, p_socio_id, p_items, p_pagos, p_turno_id, eid, tope, now());
end $$;

create or replace function privado.vender(
  p_gimnasio_id uuid, p_sede_id uuid, p_socio_id uuid, p_items jsonb, p_pagos jsonb,
  p_turno_id uuid, p_equipo_id uuid, p_tope_descuento numeric, p_momento timestamptz
) returns jsonb
language plpgsql set search_path = '' as $$
declare
  it jsonb; pg jsonb; vid uuid; total numeric := 0; pagado numeric := 0; generados int;
  medio_unico text; tipo text; cant int; precio numeric; desc_ numeric; pl public.planes; pr public.productos;
  sus public.suscripciones; descripcion text; subtotal numeric; medios text[]; mat jsonb; rec jsonb; hay_cuota boolean := false; hay_recargo boolean := false; conv jsonb; desc_conv numeric; motivo text; fiado numeric; deuda numeric; tope_fiado numeric; hay_deuda numeric := 0;
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

-- ── Inicio: copia de panel_inicio (0013); "Cobrado hoy" no cuenta lo fiado ──
create or replace function public.panel_inicio(p_gimnasio_id uuid, p_sede_id uuid default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  e public.equipo; zona text; c public.configuracion_gimnasio; hoy date; desde timestamptz; hasta timestamptz;
  entraron int; vencen int; al_dia int; cobrado numeric; por_aprobar int; clases_hoy int;
  numeros jsonb; ahora jsonb := '[]'::jsonb; s record; caja record; sede uuid;
begin
  e := privado.exigir_equipo(p_gimnasio_id);
  sede := coalesce(p_sede_id, e.sede_id);
  if e.sede_id is not null and sede <> e.sede_id then raise exception 'Sin permiso para esa sede' using errcode = '42501'; end if;
  if sede is not null and not exists (select 1 from public.sedes where id = sede and gimnasio_id = p_gimnasio_id) then
    raise exception 'Sede inexistente' using errcode = 'P0002';
  end if;
  select gi.zona_horaria into zona from public.gimnasios gi where gi.id = p_gimnasio_id;
  select * into c from public.configuracion_gimnasio where gimnasio_id = p_gimnasio_id;
  hoy := privado.dia_local(now(), zona);
  desde := privado.medianoche(hoy, zona);
  hasta := privado.medianoche(hoy + 1, zona);

  select count(distinct i.socio_id) into entraron from public.ingresos i
   where i.gimnasio_id = p_gimnasio_id and i.momento >= desde and i.momento < hasta and i.anulado_en is null
     and i.resultado <> 'rechazado' and (sede is null or i.sede_id = sede);

  select count(*) filter (where r.lista = 'por_vencer' and r.dias = 0) into vencen
    from privado.retencion(p_gimnasio_id, now()) r;

  select count(distinct cb.socio_id) into al_dia from public.coberturas cb
   where cb.gimnasio_id = p_gimnasio_id and cb.anulada_en is null and cb.desde <= now() and cb.hasta > now();

  select count(*) into por_aprobar from public.pagos p join public.ventas v on v.id = p.venta_id
   where p.gimnasio_id = p_gimnasio_id and p.estado = 'pendiente' and p.medio = 'transferencia'
     and p.comprobante_path is not null and (sede is null or v.sede_id = sede);

  if c.modo_clases <> 'ninguno' and not ('clases' = any (c.secciones_apagadas)) then
    for s in select id from public.sedes where gimnasio_id = p_gimnasio_id and activa and (sede is null or id = sede) loop
      perform privado.materializar_dia(s.id, hoy);
    end loop;
    select count(*) into clases_hoy from public.clases k
     where k.gimnasio_id = p_gimnasio_id and k.inicio >= desde and k.inicio < hasta and k.cancelada_en is null
       and (sede is null or k.sede_id = sede);
  end if;

  if e.rol in ('dueno', 'encargado') then
    select coalesce(sum(p.monto), 0) into cobrado from public.pagos p join public.ventas v on v.id = p.venta_id
     where p.gimnasio_id = p_gimnasio_id and p.estado = 'aprobado' and p.aprobado_en >= desde and p.aprobado_en < hasta
       and p.medio <> 'cuenta_corriente'   -- VEN-5: lo fiado no es plata que entró (entra cuando paga la deuda)
       and (sede is null or v.sede_id = sede);
    numeros := jsonb_build_array(
      jsonb_build_object('clave', 'entraron', 'emoji', '🚪', 'etiqueta', 'Entraron hoy', 'valor', entraron),
      jsonb_build_object('clave', 'vencen', 'emoji', '⏰', 'etiqueta', 'Vencen hoy', 'valor', vencen),
      jsonb_build_object('clave', 'cobrado', 'emoji', '💵', 'etiqueta', 'Cobrado hoy', 'valor', cobrado, 'formato', 'pesos'),
      jsonb_build_object('clave', 'al_dia', 'emoji', '✅', 'etiqueta', 'Socios al día', 'valor', al_dia));
  elsif e.rol = 'profe' then
    -- El profe ve lo suyo: sus clases de hoy, cuántos anotados y cuántos presentes.
    numeros := (
      select jsonb_build_array(
        jsonb_build_object('clave', 'mis_clases', 'emoji', '🗓️', 'etiqueta', 'Mis clases hoy', 'valor', count(*)),
        jsonb_build_object('clave', 'anotados', 'emoji', '📝', 'etiqueta', 'Anotados', 'valor',
          coalesce(sum((select count(*) from public.reservas r where r.clase_id = k.id and r.estado = 'confirmada')), 0)),
        jsonb_build_object('clave', 'presentes', 'emoji', '✅', 'etiqueta', 'Presentes', 'valor',
          coalesce(sum((select count(*) from public.asistencias a where a.clase_id = k.id and a.anulada_en is null)), 0)),
        jsonb_build_object('clave', 'faltan', 'emoji', '⏳', 'etiqueta', 'Me quedan hoy', 'valor', count(*) filter (where k.inicio > now())))
        from public.clases k
       where k.gimnasio_id = p_gimnasio_id and k.profe_id = e.id and k.cancelada_en is null
         and k.inicio >= desde and k.inicio < hasta);
  else
    numeros := jsonb_build_array(
      jsonb_build_object('clave', 'entraron', 'emoji', '🚪', 'etiqueta', 'Entraron hoy', 'valor', entraron),
      jsonb_build_object('clave', 'vencen', 'emoji', '⏰', 'etiqueta', 'Vencen hoy', 'valor', vencen),
      case when clases_hoy is not null
        then jsonb_build_object('clave', 'clases', 'emoji', '🗓️', 'etiqueta', 'Clases hoy', 'valor', clases_hoy)
        else jsonb_build_object('clave', 'al_dia', 'emoji', '✅', 'etiqueta', 'Socios al día', 'valor', al_dia) end,
      jsonb_build_object('clave', 'por_aprobar', 'emoji', '🧾', 'etiqueta', 'Transferencias por aprobar', 'valor', por_aprobar));
  end if;

  -- Ahora y lo que sigue: clases de las próximas horas, caja, pendientes.
  if clases_hoy is not null then
    ahora := ahora || coalesce((
      select jsonb_agg(jsonb_build_object(
               'tipo', 'clase', 'emoji', coalesce(a.emoji, '🗓️'), 'hora', to_char(k.inicio at time zone zona, 'HH24:MI'),
               'titulo', a.nombre,
               'detalle', (select count(*) from public.reservas r where r.clase_id = k.id and r.estado = 'confirmada')
                          || ' anotados' || case when k.cupo is not null then ' de ' || k.cupo else '' end
                          || coalesce(' · ' || p.nombre, ''),
               'href', '/clases') order by k.inicio)
        from public.clases k join public.actividades a on a.id = k.actividad_id
        left join public.equipo p on p.id = k.profe_id
       where k.gimnasio_id = p_gimnasio_id and k.cancelada_en is null and (sede is null or k.sede_id = sede)
         and k.fin > now() and k.inicio < now() + interval '6 hours'), '[]'::jsonb);
  end if;

  if e.rol in ('dueno', 'encargado', 'recepcion') and not ('caja' = any (c.secciones_apagadas)) then
    select t.abierto_en, q.nombre as quien into caja from public.turnos_caja t
      join public.cajas cj on cj.id = t.caja_id left join public.equipo q on q.id = t.abierto_por
     where t.gimnasio_id = p_gimnasio_id and t.cerrado_en is null and (sede is null or cj.sede_id = sede)
     order by t.abierto_en limit 1;
    ahora := ahora || jsonb_build_array(case when caja.abierto_en is null
      then jsonb_build_object('tipo', 'caja', 'emoji', '💵', 'titulo', 'La caja está cerrada', 'detalle', 'Abrila para cobrar en efectivo', 'href', '/caja', 'tono', 'amarillo')
      else jsonb_build_object('tipo', 'caja', 'emoji', '💵', 'titulo', 'Caja abierta',
                              'detalle', 'Desde las ' || to_char(caja.abierto_en at time zone zona, 'HH24:MI') || coalesce(' · ' || caja.quien, ''), 'href', '/caja') end);
  end if;
  if por_aprobar > 0 and e.rol <> 'profe' then
    ahora := ahora || jsonb_build_array(jsonb_build_object('tipo', 'transferencias', 'emoji', '🧾',
      'titulo', por_aprobar || case when por_aprobar = 1 then ' transferencia para aprobar' else ' transferencias para aprobar' end,
      'detalle', 'Mirá el comprobante y aprobala', 'href', '/transferencias', 'tono', 'azul'));
  end if;
  if vencen > 0 and e.rol <> 'profe' then
    ahora := ahora || jsonb_build_array(jsonb_build_object('tipo', 'vencen', 'emoji', '⏰',
      'titulo', vencen || case when vencen = 1 then ' socio vence hoy' else ' socios vencen hoy' end,
      'detalle', 'Avisales antes de que se vayan', 'href', '/vencen-hoy', 'tono', 'amarillo'));
  end if;

  return jsonb_build_object('hoy', hoy, 'numeros', numeros, 'ahora', ahora);
end $$;
revoke all on function public.panel_inicio(uuid, uuid) from public, anon, authenticated;
grant execute on function public.panel_inicio(uuid, uuid) to authenticated, service_role;

revoke all on function privado.calcular_acceso(uuid, timestamptz, uuid), privado.vender(uuid, uuid, uuid, jsonb, jsonb, uuid, uuid, numeric, timestamptz) from public;
revoke all on function public.configuracion_panel(uuid), public.guardar_configuracion(uuid, jsonb), public.precios_venta(uuid, uuid),
  public.vender(uuid, jsonb, jsonb, uuid, uuid) from public, anon, authenticated;
grant execute on function public.configuracion_panel(uuid), public.guardar_configuracion(uuid, jsonb), public.precios_venta(uuid, uuid),
  public.vender(uuid, jsonb, jsonb, uuid, uuid) to authenticated, service_role;

-- ── Verificación ────────────────────────────────────────────────────
do $$
declare f text;
begin
  foreach f in array array['public.configuracion_panel(uuid)', 'public.guardar_configuracion(uuid, jsonb)', 'public.precios_venta(uuid, uuid)', 'public.vender(uuid, jsonb, jsonb, uuid, uuid)'] loop
    if not exists (select 1 from pg_proc where oid = f::regprocedure and 'search_path=""' = any (proconfig)) then
      raise exception 'Verificación: % sin search_path vacío', f;
    end if;
    if has_function_privilege('anon', f, 'execute') then raise exception 'Verificación: anon puede ejecutar %', f; end if;
  end loop;
  if position('deuda_socio' in pg_get_functiondef('privado.calcular_acceso(uuid, timestamptz, uuid)'::regprocedure)) = 0 then
    raise exception 'Verificación: la puerta no mira la deuda';
  end if;
  if exists (select 1 from public.configuracion_gimnasio where fiado_activo) then raise exception 'Verificación: el fiado tiene que arrancar apagado'; end if;
end $$;
