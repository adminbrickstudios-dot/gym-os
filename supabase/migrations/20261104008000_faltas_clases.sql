-- 0080 · Faltas a clases reservadas (CLA-1, decisión D16).
-- Una falta es una reserva confirmada de una clase que ya terminó (y no se
-- canceló) sin presente. No se guarda: se calcula. El gimnasio elige qué
-- pasa: nada (por defecto) o no dejar reservar por N días. Cuenta solo desde
-- que se prendió la regla (nadie queda bloqueado por algo de antes). La
-- recepción puede anotar igual (no la frena). El socio lo ve antes de reservar.
--   faltas_socio(socio)       las faltas recientes (equipo o el socio)
--   politica_reservas(socio)  lo que ve el socio en la app, y si está bloqueado
-- Copias: configuracion_panel, guardar_configuracion, etiqueta_campo (0067)
-- y public.reservar (0011), que ahora mira el bloqueo.

-- ── Guarda de entrada ───────────────────────────────────────────────
do $$
begin
  if to_regprocedure('public.acreditar_pago_mp(uuid, text, numeric, text)') is null then raise exception 'Guarda: falta la migración 0079'; end if;
  if to_regprocedure('privado.reservar(uuid, uuid, timestamptz)') is null then raise exception 'Guarda: falta privado.reservar'; end if;
end $$;

alter table public.configuracion_gimnasio add column if not exists falta_politica text not null default 'nada';
alter table public.configuracion_gimnasio add column if not exists falta_bloqueo_dias int not null default 7;
alter table public.configuracion_gimnasio add column if not exists falta_politica_desde timestamptz;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'configuracion_falta_valida' and conrelid = 'public.configuracion_gimnasio'::regclass) then
    alter table public.configuracion_gimnasio add constraint configuracion_falta_valida
      check (falta_politica in ('nada', 'bloquear') and falta_bloqueo_dias between 1 and 60);
  end if;
end $$;

-- Faltas desde un momento (las clases terminadas con reserva confirmada y sin presente).
create or replace function privado.faltas(p_socio_id uuid, p_desde timestamptz) returns table (reserva_id uuid, clase_id uuid, actividad text, inicio timestamptz, fin timestamptz)
language sql stable set search_path = '' as $$
  select r.id, c.id, a.nombre, c.inicio, c.fin
    from public.reservas r join public.clases c on c.id = r.clase_id join public.actividades a on a.id = c.actividad_id
   where r.socio_id = p_socio_id and r.estado = 'confirmada' and c.cancelada_en is null
     and c.fin <= now() and c.inicio >= coalesce(p_desde, '-infinity'::timestamptz)
     and not exists (select 1 from public.asistencias x where x.clase_id = c.id and x.socio_id = p_socio_id and x.anulada_en is null)
   order by c.inicio desc
$$;
revoke all on function privado.faltas(uuid, timestamptz) from public;

-- Hasta cuándo no puede reservar (null = puede), y por qué falta.
create or replace function privado.bloqueo_reservas(p_socio_id uuid) returns jsonb
language plpgsql stable set search_path = '' as $$
declare cfg public.configuracion_gimnasio; f record; zona text; hasta date;
begin
  select c.* into cfg from public.configuracion_gimnasio c join public.socios s on s.gimnasio_id = c.gimnasio_id where s.id = p_socio_id;
  if cfg.falta_politica <> 'bloquear' then return null; end if;
  select g.zona_horaria into zona from public.gimnasios g where g.id = cfg.gimnasio_id;
  select * into f from privado.faltas(p_socio_id, greatest(coalesce(cfg.falta_politica_desde, now()), now() - make_interval(days => cfg.falta_bloqueo_dias + 1))) limit 1;
  if not found then return null; end if;
  hasta := privado.dia_local(f.fin, zona) + cfg.falta_bloqueo_dias;
  if hasta <= privado.dia_local(now(), zona) then return null; end if;
  return jsonb_build_object('hasta', hasta, 'actividad', f.actividad, 'clase_inicio', f.inicio,
    'texto', 'No podés reservar hasta el ' || to_char(hasta, 'DD/MM') || ': faltaste a ' || f.actividad || ' del '
             || to_char(f.inicio at time zone zona, 'DD/MM') || ' sin cancelar.');
end $$;
revoke all on function privado.bloqueo_reservas(uuid) from public;

create or replace function public.faltas_socio(p_socio_id uuid, p_dias int default 60) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare g uuid;
begin
  select gimnasio_id into g from public.socios where id = p_socio_id;
  if g is null then raise exception 'Sin permiso o socio inexistente' using errcode = '42501'; end if;
  if p_socio_id not in (select privado.mis_socios()) then perform privado.exigir_equipo(g, array['dueno', 'encargado', 'recepcion', 'profe']); end if;
  return coalesce((select jsonb_agg(jsonb_build_object('clase_id', f.clase_id, 'actividad', f.actividad, 'inicio', f.inicio))
                     from privado.faltas(p_socio_id, now() - make_interval(days => least(greatest(coalesce(p_dias, 60), 1), 365))) f), '[]'::jsonb);
end $$;

create or replace function public.politica_reservas(p_socio_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare cfg public.configuracion_gimnasio;
begin
  if p_socio_id is null or p_socio_id not in (select privado.mis_socios()) then raise exception 'Sin permiso' using errcode = '42501'; end if;
  select c.* into cfg from public.configuracion_gimnasio c join public.socios s on s.gimnasio_id = c.gimnasio_id where s.id = p_socio_id;
  return jsonb_build_object(
    'reglas', array_remove(array[
      case when cfg.cancelacion_horas_limite > 0 then 'Podés cancelar hasta ' || cfg.cancelacion_horas_limite || ' h antes de la clase.' end,
      case when cfg.falta_politica = 'bloquear' then 'Si reservás y no venís sin cancelar, no podés reservar por ' || cfg.falta_bloqueo_dias
           || case when cfg.falta_bloqueo_dias = 1 then ' día.' else ' días.' end end], null),
    'bloqueo', privado.bloqueo_reservas(p_socio_id));
end $$;

-- ── Reservar: copia de 0011; el socio con una falta reciente no reserva (la recepción sí lo anota) ──
create or replace function public.reservar(p_clase_id uuid, p_socio_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare g uuid; sede uuid; b jsonb;
begin
  select gimnasio_id, sede_id into g, sede from public.clases where id = p_clase_id;
  if g is null then raise exception 'Sin permiso o clase inexistente' using errcode = '42501'; end if;
  if not (p_socio_id in (select privado.mis_socios()) or privado.es_servicio()) then
    perform privado.exigir_rol(g, array['dueno', 'encargado', 'recepcion'], sede);
  elsif not privado.es_servicio() then
    b := privado.bloqueo_reservas(p_socio_id);
    if b is not null then raise exception '%', b ->> 'texto' using errcode = '22023'; end if;
  end if;
  return privado.reservar(p_clase_id, p_socio_id, now());
end $$;

-- ── Configuración: copias de 0067 con la regla de faltas ──
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
    'fiado_activo', c.fiado_activo, 'fiado_tope', c.fiado_tope,
    'falta_politica', c.falta_politica, 'falta_bloqueo_dias', c.falta_bloqueo_dias);
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
  v_tol int; v_aviso int; v_aus int; v_nuevo int; v_venc int; v_fue int; v_res int; v_canc int; v_pausa int; v_apto boolean; v_tope int; v_invitados int; v_rtipo text; v_rvalor numeric; v_rdias int; v_rfinal record; v_fiado boolean; v_ftope numeric; v_falta text; v_fbloq int;
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
                   'recargo_tipo', 'recargo_valor', 'recargo_dias', 'fiado_activo', 'fiado_tope', 'falta_politica', 'falta_bloqueo_dias');
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
  -- Faltas a clases reservadas (CLA-1, D16)
  if p_datos ? 'falta_politica' then
    v_falta := p_datos ->> 'falta_politica';
    if v_falta is null or v_falta not in ('nada', 'bloquear') then
      raise exception 'Faltas: elegí no hacer nada o no dejar reservar por unos días.' using errcode = '22023';
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
    'fiado_activo', 'Fiar (cuenta corriente)', 'fiado_tope', 'Fiar: tope por socio',
    'falta_politica', 'Faltas a clases reservadas', 'falta_bloqueo_dias', 'Faltas: días sin poder reservar') ->> p_campo, p_campo)
  end
$$;

-- La regla cuenta desde que se prende (no castiga lo de antes).
create or replace function privado.falta_politica_desde() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.falta_politica = 'bloquear' and (tg_op = 'INSERT' or old.falta_politica is distinct from 'bloquear') then
    new.falta_politica_desde := now();
  end if;
  return new;
end $$;
revoke all on function privado.falta_politica_desde() from public;
drop trigger if exists falta_politica_desde on public.configuracion_gimnasio;
create trigger falta_politica_desde before insert or update of falta_politica on public.configuracion_gimnasio
  for each row execute function privado.falta_politica_desde();

revoke all on function public.faltas_socio(uuid, int), public.politica_reservas(uuid) from public, anon, authenticated;
grant execute on function public.faltas_socio(uuid, int), public.politica_reservas(uuid) to authenticated, service_role;

-- ── Verificación ────────────────────────────────────────────────────
do $$
declare f text;
begin
  foreach f in array array['public.faltas_socio(uuid, int)', 'public.politica_reservas(uuid)', 'public.reservar(uuid, uuid)',
                           'privado.faltas(uuid, timestamptz)', 'privado.bloqueo_reservas(uuid)', 'public.guardar_configuracion(uuid, jsonb)'] loop
    if not exists (select 1 from pg_proc where oid = f::regprocedure and 'search_path=""' = any (proconfig)) then
      raise exception 'Verificación: % sin search_path vacío', f;
    end if;
    if has_function_privilege('anon', f, 'execute') then raise exception 'Verificación: anon puede ejecutar %', f; end if;
  end loop;
  if position('falta_politica' in pg_get_functiondef('public.configuracion_panel(uuid)'::regprocedure)) = 0 then
    raise exception 'Verificación: configuración sin la regla de faltas';
  end if;
end $$;
