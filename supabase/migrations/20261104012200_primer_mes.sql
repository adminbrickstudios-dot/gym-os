-- 0122 · El primer mes del socio nuevo (COM-2).
-- Meta de entradas del primer mes, configurable (por defecto 8). En la ficha:
-- "Día 12 de 30 · 4 entradas (meta 8)". En Retención (En riesgo): el nuevo
-- que en su primera semana vino menos de 2 veces. En Avisos de hoy, los
-- mensajes de los días 1 (bienvenida), 7 y 30, con plantillas editables.
-- Todo calculado de las suscripciones y los ingresos; nada se guarda.
-- Copias: guardar_configuracion (0095), configuracion_panel (0080), mensajes_catalogo, marcar_avisado,
-- bandeja_avisos y vista_previa_mensaje (0084), riesgo_baja (0121).

-- ── Guarda de entrada ───────────────────────────────────────────────
do $$
begin
  if to_regprocedure('public.riesgo_baja(uuid, uuid)') is null then raise exception 'Guarda: falta la migración 0121'; end if;
  if to_regprocedure('privado.crear_plantillas(uuid)') is null then raise exception 'Guarda: falta privado.crear_plantillas'; end if;
end $$;

alter table public.configuracion_gimnasio add column if not exists meta_primer_mes int not null default 8;
alter table public.configuracion_gimnasio drop constraint if exists configuracion_meta_primer_mes;
alter table public.configuracion_gimnasio add constraint configuracion_meta_primer_mes check (meta_primer_mes between 1 and 60);

alter table public.plantillas_mensaje drop constraint if exists plantillas_mensaje_clave_check;
alter table public.plantillas_mensaje add constraint plantillas_mensaje_clave_check
  check (clave in ('no_viene', 'por_vencer', 'vencido', 'se_fue', 'nuevo', 'bienvenida', 'cumpleanos', 'comprobante_rechazado', 'prospecto', 'comprobante_pago', 'clase_cancelada',
                   'primera_semana', 'primer_mes'));
alter table public.avisos_enviados drop constraint if exists avisos_enviados_clave_check;
alter table public.avisos_enviados add constraint avisos_enviados_clave_check
  check (clave in ('por_vencer', 'vencido', 'no_viene', 'cumpleanos', 'comprobante_rechazado', 'clase_cancelada', 'bienvenida', 'primera_semana', 'primer_mes'));

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
  v_tol int; v_aviso int; v_aus int; v_nuevo int; v_venc int; v_fue int; v_res int; v_canc int; v_pausa int; v_apto boolean; v_tope int; v_invitados int; v_rtipo text; v_rvalor numeric; v_rdias int; v_rfinal record; v_fiado boolean; v_ftope numeric; v_falta text; v_fbloq int; v_meta int;
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
                   'recargo_tipo', 'recargo_valor', 'recargo_dias', 'fiado_activo', 'fiado_tope', 'falta_politica', 'falta_bloqueo_dias',
                   'meta_primer_mes');
  if desconocidos is not null then raise exception 'Campos que no se pueden cambiar acá: %', array_to_string(desconocidos, ', '); end if;

  -- COM-2: la meta de entradas del primer mes.
  if p_datos ? 'meta_primer_mes' then
    if jsonb_typeof(p_datos -> 'meta_primer_mes') <> 'number' or (p_datos ->> 'meta_primer_mes')::numeric not between 1 and 60
       or (p_datos ->> 'meta_primer_mes')::numeric <> trunc((p_datos ->> 'meta_primer_mes')::numeric) then
      raise exception 'Meta del primer mes: un número de entradas entre 1 y 60.' using errcode = '22023';
    end if;
    v_meta := (p_datos ->> 'meta_primer_mes')::int;
  end if;

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
  -- Faltas a clases reservadas (CLA-1, D16)
  if p_datos ? 'falta_politica' then
    v_falta := p_datos ->> 'falta_politica';
    if v_falta is null or v_falta not in ('nada', 'bloquear', 'descontar') then
      raise exception 'Faltas: elegí no hacer nada, descontar la clase del pack o no dejar reservar por unos días.' using errcode = '22023';
    end if;
  end if;
  v_fbloq := privado.config_entero(p_datos, 'falta_bloqueo_dias', 1, 60, 'Faltas: días sin poder reservar');
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
    falta_politica = coalesce(v_falta, c.falta_politica),
    falta_bloqueo_dias = coalesce(v_fbloq, c.falta_bloqueo_dias),
    meta_primer_mes = coalesce(v_meta, c.meta_primer_mes),
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
    'tolerancia_dias', c.tolerancia_dias, 'dias_aviso', c.dias_aviso, 'meta_primer_mes', c.meta_primer_mes,
    'reingreso_mismo_dia_consume', c.reingreso_mismo_dia_consume,
    'secciones_apagadas', to_jsonb(c.secciones_apagadas),
    'alias_transferencia', c.alias_transferencia, 'banco_transferencia', c.banco_transferencia, 'medios_aceptados', to_jsonb(c.medios_aceptados), 'cbu', c.cbu, 'titular_cuenta', c.titular_cuenta,
    'descuento_max_recepcion', c.descuento_max_recepcion,
    'retencion_dias_ausencia', c.retencion_dias_ausencia, 'retencion_dias_nuevo', c.retencion_dias_nuevo,
    'retencion_dias_vencido', c.retencion_dias_vencido, 'retencion_dias_se_fue', c.retencion_dias_se_fue,
    'reserva_dias_anticipacion', c.reserva_dias_anticipacion, 'cancelacion_horas_limite', c.cancelacion_horas_limite,
    'pausa_dias_por_anio', c.pausa_dias_por_anio, 'pide_apto', c.pide_apto, 'tope_dejar_pasar', c.tope_dejar_pasar, 'invitados_por_mes', c.invitados_por_mes,
    'recargo_tipo', c.recargo_tipo, 'recargo_valor', c.recargo_valor, 'recargo_dias', c.recargo_dias,
    'fiado_activo', c.fiado_activo, 'fiado_tope', c.fiado_tope,
    'falta_politica', c.falta_politica, 'falta_bloqueo_dias', c.falta_bloqueo_dias);
end $$;

create or replace function privado.mensajes_catalogo() returns jsonb
language sql immutable set search_path = '' as $$
  select '[
    {"clave": "por_vencer", "titulo": "Vence pronto", "emoji": "⏰", "cuando": "A los que se les termina la cuota en los próximos días.",
     "usado_en": ["Retención", "Vencen hoy"], "variables": ["nombre", "gimnasio", "plan", "vence", "dias", "debe"],
     "original": "Hola {nombre}! Te recordamos que tu plan en {gimnasio} vence el {vence}. Podés renovarlo cuando vengas o por transferencia 🙌"},
    {"clave": "vencido", "titulo": "Venció", "emoji": "⛔", "cuando": "A los que se les terminó la cuota y no renovaron.",
     "usado_en": ["Retención"], "variables": ["nombre", "gimnasio", "plan", "vence", "dias", "debe", "monto"],
     "original": "Hola {nombre}! Tu plan en {gimnasio} venció el {vence}. Para seguir entrenando son {monto}. ¿Te esperamos esta semana?"},
    {"clave": "no_viene", "titulo": "No viene", "emoji": "👀", "cuando": "A los que pagan pero hace días que no vienen.",
     "usado_en": ["Retención"], "variables": ["nombre", "gimnasio", "plan", "dias"],
     "original": "Hola {nombre}! Te extrañamos en {gimnasio} 💪 Hace {dias} días que no venís. ¿Todo bien? Si querés te ayudamos a armar un horario que te quede cómodo."},
    {"clave": "nuevo", "titulo": "Nuevo que no viene", "emoji": "🌱", "cuando": "A los recién anotados que todavía no agarraron ritmo.",
     "usado_en": ["Retención"], "variables": ["nombre", "gimnasio", "plan", "dias"],
     "original": "Hola {nombre}! ¿Cómo te fue en tus primeras semanas en {gimnasio}? Si necesitás ayuda con la rutina o los horarios, decinos 🙂"},
    {"clave": "se_fue", "titulo": "Se fue", "emoji": "👋", "cuando": "A los que dejaron de pagar hace tiempo o se dieron de baja.",
     "usado_en": ["Retención"], "variables": ["nombre", "gimnasio", "plan", "dias"],
     "original": "Hola {nombre}! ¿Cómo andás? En {gimnasio} nos encantaría volver a verte. Si querés retomar, escribinos y vemos juntos qué plan te conviene."},
    {"clave": "bienvenida", "titulo": "Bienvenida", "emoji": "🎉", "cuando": "Al socio que se acaba de anotar (su primer día).",
     "usado_en": ["Avisos de hoy"], "variables": ["nombre", "gimnasio", "plan", "vence"],
     "original": "¡Bienvenido/a a {gimnasio}, {nombre}! 💪 Tu plan {plan} ya está activo. Cualquier cosa, escribinos por acá."},
    {"clave": "cumpleanos", "titulo": "Cumpleaños", "emoji": "🎂", "cuando": "El día del cumpleaños del socio.",
     "usado_en": [], "variables": ["nombre", "gimnasio"],
     "original": "¡Feliz cumpleaños, {nombre}! 🎂 Todo el equipo de {gimnasio} te desea un gran año. ¡Te esperamos para festejarlo entrenando!"},
    {"clave": "comprobante_rechazado", "titulo": "Comprobante rechazado", "emoji": "🧾", "cuando": "Cuando no se puede aprobar una transferencia que mandó el socio.",
     "usado_en": [], "variables": ["nombre", "gimnasio", "plan", "debe"],
     "original": "Hola {nombre}, no pudimos aprobar el comprobante que mandaste en {gimnasio}. ¿Nos mandás otro, o pasás por recepción? Son {debe}."},
    {"clave": "prospecto", "titulo": "Quiere probar", "emoji": "🌱", "cuando": "Al que dejó sus datos para probar una clase.",
     "usado_en": ["Prospectos"], "variables": ["nombre", "gimnasio"],
     "original": "Hola {nombre}! Te escribimos de {gimnasio} 👋 Vimos que querés venir a probar. ¿Qué día y horario te queda cómodo?"},
    {"clave": "comprobante_pago", "titulo": "Comprobante de pago", "emoji": "🧾", "cuando": "Después de cobrarle algo en Vender, para mandárselo por WhatsApp.",
     "usado_en": ["Vender"], "variables": ["nombre", "gimnasio", "monto", "detalle", "fecha", "al_dia"],
     "original": "Hola {nombre}! Recibimos tu pago de {monto} en {gimnasio} ({detalle}, {fecha}). {al_dia} ¡Gracias! 💪"},
    {"clave": "clase_cancelada", "titulo": "Clase cancelada", "emoji": "❌", "cuando": "A los anotados en una clase que se canceló.",
     "usado_en": ["Avisos de hoy"], "variables": ["nombre", "gimnasio", "clase", "dia", "motivo"],
     "original": "Hola {nombre}! Te avisamos de {gimnasio}: se canceló {clase} del {dia} ({motivo}). Perdón por el cambio 🙏 Podés reservar otra clase desde la app."},
    {"clave": "primera_semana", "titulo": "Primera semana", "emoji": "🌱", "cuando": "Al socio nuevo, a la semana de anotarse.",
     "usado_en": ["Avisos de hoy"], "variables": ["nombre", "gimnasio", "entradas", "meta"],
     "original": "Hola {nombre}! Ya pasó tu primera semana en {gimnasio} 💪 Viniste {entradas}. ¿Cómo te sentiste? Si querés, te ayudamos a armar tu rutina y tus horarios."},
    {"clave": "primer_mes", "titulo": "Primer mes", "emoji": "🎉", "cuando": "Al socio nuevo, al cumplir su primer mes.",
     "usado_en": ["Avisos de hoy"], "variables": ["nombre", "gimnasio", "entradas", "meta"],
     "original": "Hola {nombre}! Se cumple tu primer mes en {gimnasio} 🎉 Viniste {entradas}. ¡Gracias por entrenar con nosotros! ¿Hay algo que te gustaría que mejoremos?"}
  ]'::jsonb
$$;

-- Los mensajes nuevos, con su texto original, en cada gimnasio.
do $$
declare g uuid;
begin
  for g in select id from public.gimnasios loop perform privado.crear_plantillas(g); end loop;
end $$;

create or replace function public.marcar_avisado(p_socio_id uuid, p_clave text, p_referencia text) returns void
language plpgsql security definer set search_path = '' as $$
declare g uuid; e public.equipo;
begin
  select gimnasio_id into g from public.socios where id = p_socio_id;
  if g is null then raise exception 'Sin permiso o socio inexistente' using errcode = '42501'; end if;
  e := privado.exigir_equipo(g, array['dueno', 'encargado', 'recepcion']);
  if p_clave is null or p_clave not in ('por_vencer', 'vencido', 'no_viene', 'cumpleanos', 'comprobante_rechazado', 'clase_cancelada', 'bienvenida', 'primera_semana', 'primer_mes') then
    raise exception 'Aviso desconocido' using errcode = '22023';
  end if;
  insert into public.avisos_enviados (gimnasio_id, socio_id, clave, referencia, creado_por)
  values (g, p_socio_id, p_clave, left(coalesce(nullif(trim(p_referencia), ''), 'sin'), 64), e.id)
  on conflict (gimnasio_id, socio_id, clave, referencia) do nothing;
end $$;

create or replace function public.bandeja_avisos(p_gimnasio_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare zona text; hoy date; gim text; plantilla text; plantilla_cc text; meta int;
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado', 'recepcion']);
  select g.zona_horaria, g.nombre into zona, gim from public.gimnasios g where g.id = p_gimnasio_id;
  hoy := privado.dia_local(now(), zona);
  select c.meta_primer_mes into meta from public.configuracion_gimnasio c where c.gimnasio_id = p_gimnasio_id;
  select coalesce(p.texto, (select m ->> 'original' from jsonb_array_elements(privado.mensajes_catalogo()) m where m ->> 'clave' = 'comprobante_rechazado'))
    into plantilla from public.plantillas_mensaje p where p.gimnasio_id = p_gimnasio_id and p.clave = 'comprobante_rechazado';
  select coalesce(p.texto, (select m ->> 'original' from jsonb_array_elements(privado.mensajes_catalogo()) m where m ->> 'clave' = 'clase_cancelada'))
    into plantilla_cc from public.plantillas_mensaje p where p.gimnasio_id = p_gimnasio_id and p.clave = 'clase_cancelada';
  return coalesce((
    with candidatos as (
      -- De Retención: misma cuenta, mismo mensaje.
      select r.socio_id, r.nombre, r.telefono, r.lista as clave, r.texto as motivo, r.mensaje,
             case r.lista when 'no_viene' then coalesce(privado.dia_local(r.ultimo_ingreso, zona)::text, 'nunca')
                          else coalesce(privado.dia_local(r.vence_en, zona)::text, hoy::text) end as referencia
        from privado.retencion(p_gimnasio_id, now()) r
       where r.lista in ('por_vencer', 'no_viene') or (r.lista = 'vencido' and r.dias between 1 and 3)
      union all
      select (c ->> 'socio_id')::uuid, c ->> 'nombre', c ->> 'telefono', 'cumpleanos', 'Cumple ' || (c ->> 'cumple') || ' hoy', c ->> 'mensaje',
             extract(year from hoy)::text
        from jsonb_array_elements(public.cumplen_hoy(p_gimnasio_id, now())) c
      union all
      select s.id, trim(s.nombre || ' ' || s.apellido), privado.celular_aviso(s.telefono, s.responsable_telefono, s.fecha_nacimiento, hoy),
             'comprobante_rechazado', 'Le rechazaron el comprobante: ' || p.rechazado_motivo,
             privado.armar_mensaje(plantilla, privado.variables_socio(s.id, now())), p.id::text
        from public.pagos p join public.ventas v on v.id = p.venta_id join public.socios s on s.id = v.socio_id
       where p.gimnasio_id = p_gimnasio_id and p.estado = 'rechazado' and p.rechazado_en > now() - interval '3 days'
         and s.dado_de_baja_en is null
      union all
      -- CLA-3: los anotados de una clase cancelada (en los últimos 2 días, si la clase no pasó hace más de un día).
      select s.id, trim(s.nombre || ' ' || s.apellido), privado.celular_aviso(s.telefono, s.responsable_telefono, s.fecha_nacimiento, hoy),
             'clase_cancelada', 'Se canceló ' || a.nombre || ' del ' || to_char(c.inicio at time zone zona, 'DD/MM HH24:MI') || coalesce(': ' || c.cancelada_motivo, ''),
             privado.armar_mensaje(plantilla_cc, privado.variables_socio(s.id, now()) || jsonb_build_object('clase', a.nombre,
               'dia', to_char(c.inicio at time zone zona, 'DD/MM') || ' a las ' || to_char(c.inicio at time zone zona, 'HH24:MI'),
               'motivo', coalesce(c.cancelada_motivo, 'se canceló'))),
             c.id::text
        from public.reservas r join public.clases c on c.id = r.clase_id join public.actividades a on a.id = c.actividad_id
        join public.socios s on s.id = r.socio_id
       where r.gimnasio_id = p_gimnasio_id and r.cancelada_por = 'clase_cancelada' and c.cancelada_en > now() - interval '2 days'
         and c.inicio > now() - interval '1 day' and s.dado_de_baja_en is null
      union all
      -- COM-2: el primer mes del socio nuevo. Bienvenida (días 1 y 2), primera semana (7 a 9) y primer mes (30 a 33).
      select n.socio_id, n.nombre, n.telefono, n.clave,
             case n.clave when 'bienvenida' then 'Se anotó el ' || to_char(n.primer_dia, 'DD/MM')
                          when 'primera_semana' then 'Primera semana: vino ' || n.entradas || (case when n.entradas = 1 then ' vez' else ' veces' end)
                          else 'Primer mes: vino ' || n.entradas || (case when n.entradas = 1 then ' vez' else ' veces' end) || ' (la meta era ' || meta || ')' end,
             privado.armar_mensaje(coalesce(
               (select p.texto from public.plantillas_mensaje p where p.gimnasio_id = p_gimnasio_id and p.clave = n.clave),
               (select m ->> 'original' from jsonb_array_elements(privado.mensajes_catalogo()) m where m ->> 'clave' = n.clave)),
               privado.variables_socio(n.socio_id, now()) || jsonb_build_object('entradas', n.entradas || case when n.entradas = 1 then ' vez' else ' veces' end, 'meta', meta::text)),
             n.primer_dia::text
        from (
          select s.id as socio_id, trim(s.nombre || ' ' || s.apellido) as nombre,
                 privado.celular_aviso(s.telefono, s.responsable_telefono, s.fecha_nacimiento, hoy) as telefono,
                 pm.primer_dia,
                 case when hoy - pm.primer_dia between 0 and 1 then 'bienvenida'
                      when hoy - pm.primer_dia between 7 and 9 then 'primera_semana'
                      when hoy - pm.primer_dia between 30 and 33 then 'primer_mes' end as clave,
                 (select count(distinct (i.momento at time zone zona)::date) from public.ingresos i
                   where i.socio_id = s.id and i.anulado_en is null and i.resultado <> 'rechazado') as entradas
            from public.socios s
            join (select su.socio_id, min((su.inicio at time zone zona)::date) as primer_dia from public.suscripciones su
                   where su.gimnasio_id = p_gimnasio_id group by su.socio_id) pm on pm.socio_id = s.id
           where s.gimnasio_id = p_gimnasio_id and s.dado_de_baja_en is null and hoy - pm.primer_dia between 0 and 33
        ) n
       where n.clave is not null
    )
    select jsonb_agg(jsonb_build_object('socio_id', c.socio_id, 'nombre', c.nombre, 'telefono', c.telefono, 'clave', c.clave,
             'motivo', c.motivo, 'mensaje', c.mensaje, 'referencia', c.referencia,
             'avisado_en', a.creado_en, 'avisado_por', (select q.nombre from public.equipo q where q.id = a.creado_por))
             order by (a.id is not null), array_position(array['clase_cancelada', 'por_vencer', 'vencido', 'comprobante_rechazado', 'bienvenida', 'primera_semana', 'primer_mes', 'cumpleanos', 'no_viene'], c.clave), c.nombre)
      from candidatos c
      left join public.avisos_enviados a on a.gimnasio_id = p_gimnasio_id and a.socio_id = c.socio_id and a.clave = c.clave and a.referencia = c.referencia
     -- Lo avisado otro día no vuelve; lo avisado hoy se ve con ✓.
     where a.id is null or privado.dia_local(a.creado_en, zona) = hoy
  ), '[]'::jsonb);
end $$;

create or replace function public.vista_previa_mensaje(p_gimnasio_id uuid, p_clave text, p_texto text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare t text; r record; sid uuid;
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado']);
  t := privado.validar_mensaje(p_clave, p_texto);
  if p_clave in ('no_viene', 'por_vencer', 'vencido', 'se_fue', 'nuevo') then
    select x.socio_id, x.nombre, x.texto, x.mensaje into r
      from privado.retencion_con(p_gimnasio_id, now(), jsonb_build_object(p_clave, t)) x
     where x.lista = p_clave limit 1;
    if found then
      return jsonb_build_object('socio', r.nombre, 'situacion', r.texto, 'texto', r.mensaje, 'de_la_lista', true);
    end if;
  end if;
  select s.id into sid from public.socios s
    join public.suscripciones x on x.socio_id = s.id and x.baja_en is null
   where s.gimnasio_id = p_gimnasio_id and s.dado_de_baja_en is null
   order by s.numero limit 1;
  if sid is null then
    select s.id into sid from public.socios s where s.gimnasio_id = p_gimnasio_id and s.dado_de_baja_en is null order by s.numero limit 1;
  end if;
  if sid is null then
    return jsonb_build_object('socio', null, 'situacion', null, 'de_la_lista', false,
      'texto', privado.armar_mensaje(t, jsonb_build_object('nombre', 'Sofía', 'gimnasio', (select g.nombre from public.gimnasios g where g.id = p_gimnasio_id),
                                                           'plan', 'Mensual', 'vence', 'el 10/12', 'dias', '7', 'debe', '$25.000', 'monto', '$25.000', 'entradas', '6 veces', 'meta', '8')));
  end if;
  return jsonb_build_object('socio', (select trim(s.nombre || ' ' || s.apellido) from public.socios s where s.id = sid),
                            'situacion', null, 'de_la_lista', false,
                            'texto', privado.armar_mensaje(t, jsonb_build_object('clase', 'Spinning', 'dia', '10/11 a las 19:00', 'motivo', 'el profe está enfermo',
                                       'detalle', 'Cuota Mensual', 'fecha', '10/11', 'al_dia', 'Quedaste al día hasta el 10/12.', 'monto', '$25.000', 'entradas', '6 veces', 'meta', '8')
                                     || privado.variables_socio(sid, now())));
end $$;

create or replace function public.riesgo_baja(p_gimnasio_id uuid, p_socio_id uuid default null) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare zona text; gim text; ahora timestamptz := now(); plantilla text; meta int;
begin
  perform privado.exigir_rol(p_gimnasio_id, array['dueno', 'encargado', 'recepcion']);
  select g.zona_horaria, g.nombre into zona, gim from public.gimnasios g where g.id = p_gimnasio_id;
  select c.meta_primer_mes into meta from public.configuracion_gimnasio c where c.gimnasio_id = p_gimnasio_id;
  select coalesce(p.texto, (select m ->> 'original' from jsonb_array_elements(privado.mensajes_catalogo()) m where m ->> 'clave' = 'no_viene'))
    into plantilla from (select 1) x left join public.plantillas_mensaje p on p.gimnasio_id = p_gimnasio_id and p.clave = 'no_viene';
  return coalesce((
    with activos as (
      -- Pagan hoy: una cobertura vigente (los vencidos ya están en sus listas de Retención).
      select s.id, s.nombre, s.apellido, s.telefono, s.responsable_telefono, s.fecha_nacimiento,
             (select max(c.hasta) from public.coberturas c where c.socio_id = s.id and c.anulada_en is null and c.desde <= ahora and c.hasta > ahora) as fin,
             exists (select 1 from public.coberturas c where c.socio_id = s.id and c.anulada_en is null and c.desde > ahora) as renovo,
             (select max(i.momento) from public.ingresos i where i.socio_id = s.id and i.anulado_en is null and i.resultado <> 'rechazado' and i.momento <= ahora) as ultimo,
             (select min(su.inicio) from public.suscripciones su where su.socio_id = s.id) as primer_inicio
        from public.socios s
       where s.gimnasio_id = p_gimnasio_id and s.dado_de_baja_en is null and (p_socio_id is null or s.id = p_socio_id)
         and exists (select 1 from public.coberturas c where c.socio_id = s.id and c.anulada_en is null and c.desde <= ahora and c.hasta > ahora)
    ),
    visitas as (
      select a.id,
             count(distinct (i.momento at time zone zona)::date) filter (where i.momento < ahora - interval '14 days')::numeric / 8 as antes,
             count(distinct (i.momento at time zone zona)::date) filter (where i.momento >= ahora - interval '14 days')::numeric / 2 as ahora_sem
        from activos a
        join public.ingresos i on i.socio_id = a.id and i.anulado_en is null and i.resultado <> 'rechazado'
                              and i.momento >= ahora - interval '70 days' and i.momento <= ahora
       group by a.id
    ),
    reservas as (
      select a.id,
             count(*) filter (where c.inicio < ahora - interval '14 days') as antes,
             count(*) filter (where c.inicio >= ahora - interval '14 days') as ahora_n
        from activos a
        join public.reservas r on r.socio_id = a.id and r.estado <> 'cancelada'
        join public.clases c on c.id = r.clase_id and c.inicio >= ahora - interval '42 days' and c.inicio <= ahora + interval '14 days'
       group by a.id
    ),
    senales as (
      select a.*, array_remove(array[
          case when v.antes >= 1.5 and v.ahora_sem <= v.antes / 2 then
            'Venía ' || round(v.antes) || ' veces por semana' ||
            case when v.ahora_sem = 0 then ' y hace ' || ((ahora at time zone zona)::date - (a.ultimo at time zone zona)::date) || ' días que no viene'
                 else '; las últimas 2 semanas, ' || round(v.ahora_sem, 1) || ' por semana' end end,
          case when coalesce(r.antes, 0) >= 3 and coalesce(r.ahora_n, 0) = 0 then 'Reservaba seguido y hace 2 semanas que no reserva' end,
          -- COM-2: socio nuevo que en su primera semana vino menos de 2 veces.
          (select 'Primera semana: vino ' || count(distinct (i.momento at time zone zona)::date) ||
                  (case when count(distinct (i.momento at time zone zona)::date) = 1 then ' vez' else ' veces' end) || ' (la meta del mes es ' || meta || ')'
             from public.ingresos i
            where i.socio_id = a.id and i.anulado_en is null and i.resultado <> 'rechazado'
              and i.momento >= a.primer_inicio and i.momento < a.primer_inicio + interval '7 days'
           having a.primer_inicio between ahora - interval '30 days' and ahora - interval '7 days'
              and count(distinct (i.momento at time zone zona)::date) < 2),
          (select 'Pidió una pausa el ' || privado.fecha_corta(max(pp.pedido_en), zona) from public.pedidos_pausa pp
            where pp.socio_id = a.id and pp.estado <> 'rechazado' and pp.pedido_en >= ahora - interval '30 days' having count(*) > 0),
          (select 'Pidió la baja el ' || privado.fecha_corta(max(pb.pedido_en), zona) from public.pedidos_baja pb
            where pb.socio_id = a.id and pb.estado = 'pendiente' having count(*) > 0)
        ], null) as base,
        exists (select 1 from public.pedidos_baja pb where pb.socio_id = a.id and pb.estado = 'pendiente') as pidio_baja,
        coalesce(v.ahora_sem, 0) as viene
        from activos a left join visitas v on v.id = a.id left join reservas r on r.id = a.id
    ),
    con_vence as (
      select x.*,
             case when cardinality(x.base) > 0 and not x.renovo and x.fin <= ahora + interval '7 days'
                  then x.base || ('Vence el ' || privado.ultimo_dia(x.fin, zona) || ' y no renovó') else x.base end as porque
        from senales x
       where cardinality(x.base) > 0
    )
    select jsonb_agg(jsonb_build_object(
             'socio_id', c.id, 'nombre', trim(c.nombre || ' ' || c.apellido),
             'telefono', privado.celular_aviso(c.telefono, c.responsable_telefono, c.fecha_nacimiento, (ahora at time zone zona)::date),
             'nivel', case when c.pidio_baja or cardinality(c.porque) >= 2 then 'alto' else 'medio' end,
             'porque', to_jsonb(c.porque),
             -- El mensaje es el de "No viene" (CFG-5), con los días desde su última visita.
             'mensaje', privado.armar_mensaje(plantilla, jsonb_build_object('nombre', c.nombre, 'gimnasio', gim,
                        'dias', coalesce(((ahora at time zone zona)::date - (c.ultimo at time zone zona)::date)::text, 'varios'))))
           order by (c.pidio_baja or cardinality(c.porque) >= 2) desc, cardinality(c.porque) desc, c.viene, c.nombre)
      from con_vence c), '[]');
end $$;

create or replace function public.primer_mes_socio(p_socio_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare s public.socios; zona text; meta int; primero date; hoy date; n int; n7 int;
begin
  select * into s from public.socios where id = p_socio_id;
  if not found then raise exception 'Sin permiso o socio inexistente' using errcode = '42501'; end if;
  perform privado.exigir_equipo(s.gimnasio_id, array['dueno', 'encargado', 'recepcion']);
  select g.zona_horaria into zona from public.gimnasios g where g.id = s.gimnasio_id;
  select c.meta_primer_mes into meta from public.configuracion_gimnasio c where c.gimnasio_id = s.gimnasio_id;
  select min((su.inicio at time zone zona)::date) into primero from public.suscripciones su where su.socio_id = s.id;
  hoy := (now() at time zone zona)::date;
  if primero is null or hoy - primero > 30 or hoy < primero then return null; end if;
  select count(distinct (i.momento at time zone zona)::date),
         count(distinct (i.momento at time zone zona)::date) filter (where (i.momento at time zone zona)::date < primero + 7)
    into n, n7
    from public.ingresos i where i.socio_id = s.id and i.anulado_en is null and i.resultado <> 'rechazado';
  return jsonb_build_object('dia', hoy - primero + 1, 'de', 30, 'entradas', n, 'meta', meta,
                            'primera_semana_floja', hoy - primero >= 7 and n7 < 2);
end $$;
revoke all on function public.primer_mes_socio(uuid) from public, anon, authenticated;
grant execute on function public.primer_mes_socio(uuid) to authenticated, service_role;

-- ── Verificación ────────────────────────────────────────────────────
do $$
begin
  if exists (select 1 from public.gimnasios g where not exists (select 1 from public.plantillas_mensaje p where p.gimnasio_id = g.id and p.clave = 'primer_mes')) then
    raise exception 'Verificación: un gimnasio quedó sin la plantilla Primer mes';
  end if;
  if (select count(*) from jsonb_array_elements(privado.mensajes_catalogo()) m where m ->> 'clave' in ('primera_semana', 'primer_mes')) <> 2 then
    raise exception 'Verificación: faltan mensajes en el catálogo';
  end if;
  if to_regprocedure('public.primer_mes_socio(uuid)') is null or has_function_privilege('anon', 'public.primer_mes_socio(uuid)', 'execute') then
    raise exception 'Verificación: primer_mes_socio';
  end if;
end $$;
