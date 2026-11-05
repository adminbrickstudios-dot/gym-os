-- 0127 · Kiosco con los habituales de esta hora (COM-7).
-- Si el dueño lo prende (Configuración → Reglas; viene apagado), la tablet de
-- la puerta muestra a los que suelen venir a esta hora (nombre e inicial del
-- apellido) para tocar en vez de escribir. Tocar el nombre no alcanza: pide
-- los últimos 3 números del DNI (si no, cualquiera entraría tocando un nombre
-- ajeno). Después es lo mismo que escribir el DNI: mismo cálculo, mismo
-- registro y el mismo freno de intentos.
--   kiosco_habituales(token)                      → [{ socio_id, nombre }] (hasta 12)
--   kiosco_entrar_habitual(token, socio, dni_fin)  → como kiosco_entrar
-- Copias: guardar_configuracion y configuracion_panel (0122).

-- ── Guarda de entrada ───────────────────────────────────────────────
do $$
begin
  if to_regprocedure('privado.tablet_del_token(text)') is null then raise exception 'Guarda: falta el kiosco (0050)'; end if;
  if to_regprocedure('public.primer_mes_socio(uuid)') is null then raise exception 'Guarda: falta la migración 0122'; end if;
end $$;

alter table public.configuracion_gimnasio add column if not exists kiosco_habituales boolean not null default false;

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
  v_tol int; v_aviso int; v_aus int; v_nuevo int; v_venc int; v_fue int; v_res int; v_canc int; v_pausa int; v_apto boolean; v_tope int; v_invitados int; v_rtipo text; v_rvalor numeric; v_rdias int; v_rfinal record; v_fiado boolean; v_ftope numeric; v_falta text; v_fbloq int; v_meta int; v_habituales boolean;
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
                   'meta_primer_mes', 'kiosco_habituales');
  if desconocidos is not null then raise exception 'Campos que no se pueden cambiar acá: %', array_to_string(desconocidos, ', '); end if;

  -- COM-2: la meta de entradas del primer mes.
  if p_datos ? 'meta_primer_mes' then
    if jsonb_typeof(p_datos -> 'meta_primer_mes') <> 'number' or (p_datos ->> 'meta_primer_mes')::numeric not between 1 and 60
       or (p_datos ->> 'meta_primer_mes')::numeric <> trunc((p_datos ->> 'meta_primer_mes')::numeric) then
      raise exception 'Meta del primer mes: un número de entradas entre 1 y 60.' using errcode = '22023';
    end if;
    v_meta := (p_datos ->> 'meta_primer_mes')::int;
  end if;

  -- COM-7: los habituales en la tablet de la puerta.
  if p_datos ? 'kiosco_habituales' then
    if jsonb_typeof(p_datos -> 'kiosco_habituales') is distinct from 'boolean' then raise exception 'Habituales en la tablet: elegí sí o no.' using errcode = '22023'; end if;
    v_habituales := (p_datos ->> 'kiosco_habituales')::boolean;
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
    kiosco_habituales = coalesce(v_habituales, c.kiosco_habituales),
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
    'tolerancia_dias', c.tolerancia_dias, 'dias_aviso', c.dias_aviso, 'meta_primer_mes', c.meta_primer_mes, 'kiosco_habituales', c.kiosco_habituales,
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

create or replace function public.kiosco_habituales(p_token text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare d public.dispositivos; zona text; hora int; hoy date;
begin
  d := privado.tablet_del_token(p_token);
  if not (select c.kiosco_habituales from public.configuracion_gimnasio c where c.gimnasio_id = d.gimnasio_id) then return '[]'; end if;
  select g.zona_horaria into zona from public.gimnasios g where g.id = d.gimnasio_id;
  hoy := (now() at time zone zona)::date;
  hora := extract(hour from now() at time zone zona)::int * 60 + extract(minute from now() at time zone zona)::int;
  return coalesce((
    select jsonb_agg(jsonb_build_object('socio_id', x.socio_id, 'nombre', x.nombre) order by x.nombre)
      from (
        select s.id as socio_id, s.nombre || coalesce(' ' || left(nullif(trim(s.apellido), ''), 1) || '.', '') as nombre, count(distinct (i.momento at time zone zona)::date) as dias
          from public.ingresos i join public.socios s on s.id = i.socio_id
         where i.gimnasio_id = d.gimnasio_id and i.sede_id = d.sede_id and i.anulado_en is null and i.resultado <> 'rechazado'
           and i.momento > now() - interval '28 days' and (i.momento at time zone zona)::date < hoy
           and abs((extract(hour from i.momento at time zone zona)::int * 60 + extract(minute from i.momento at time zone zona)::int) - hora) <= 45
           and s.dado_de_baja_en is null and s.dni is not null
           and not exists (select 1 from public.ingresos h where h.socio_id = s.id and h.anulado_en is null and h.resultado <> 'rechazado'
                             and h.momento >= privado.medianoche(hoy, zona))
         group by s.id, s.nombre, s.apellido
        having count(distinct (i.momento at time zone zona)::date) >= 3
         order by count(distinct (i.momento at time zone zona)::date) desc
         limit 12
      ) x), '[]');
end $$;

create or replace function public.kiosco_entrar_habitual(p_token text, p_socio_id uuid, p_dni_fin text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare d public.dispositivos; s public.socios;
begin
  d := privado.tablet_del_token(p_token);
  if not (select c.kiosco_habituales from public.configuracion_gimnasio c where c.gimnasio_id = d.gimnasio_id) then
    raise exception 'Esta tablet no muestra habituales: escribí tu DNI.' using errcode = '22023';
  end if;
  select * into s from public.socios where id = p_socio_id and gimnasio_id = d.gimnasio_id and dado_de_baja_en is null;
  if s.id is null or s.dni is null then raise exception 'Escribí tu DNI, sin puntos.' using errcode = '22023'; end if;
  -- Mismo freno que con el DNI: 30 intentos por minuto por tablet (cuenta los que no coinciden).
  if (select count(*) from public.ingresos i where i.dispositivo_id = d.id and i.momento > now() - interval '1 minute') >= 30 then
    raise exception 'Demasiados intentos: esperá un minuto.' using errcode = '54000';
  end if;
  if regexp_replace(coalesce(p_dni_fin, ''), '\D', '', 'g') is distinct from right(s.dni, 3) then
    raise exception 'Esos no son los últimos números de tu DNI. Probá de nuevo o escribí el DNI entero.' using errcode = '22023';
  end if;
  return public.kiosco_entrar(p_token, s.dni);
end $$;
revoke all on function public.kiosco_habituales(text), public.kiosco_entrar_habitual(text, uuid, text) from public, anon, authenticated;
grant execute on function public.kiosco_habituales(text), public.kiosco_entrar_habitual(text, uuid, text) to anon, authenticated, service_role;

-- ── Verificación ────────────────────────────────────────────────────
do $$
begin
  if to_regprocedure('public.kiosco_entrar_habitual(text, uuid, text)') is null then raise exception 'Verificación: falta kiosco_entrar_habitual'; end if;
  if (select column_default from information_schema.columns where table_schema = 'public' and table_name = 'configuracion_gimnasio'
        and column_name = 'kiosco_habituales') is distinct from 'false' then raise exception 'Verificación: tiene que venir apagado'; end if;
end $$;
