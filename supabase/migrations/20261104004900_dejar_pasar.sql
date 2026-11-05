-- 0049 · Reglas de "dejar pasar" (ENT-4, decisión D1).
-- La recepción deja pasar, con motivo, a quien no puede entrar (vencido, sin
-- clases, fuera de horario…), hasta un tope por día y por persona que pone el
-- dueño (por defecto 5; 0 = la recepción no deja pasar). A un suspendido o a
-- un dado de baja lo deja pasar solo el dueño o el encargado. Cada "dejar
-- pasar" aparece en Inicio del dueño y del encargado (dejados_pasar).
-- Se controla en la base (public.registrar_ingreso, misma firma), no en la pantalla.

-- ── Guarda de entrada ───────────────────────────────────────────────
do $$
begin
  if to_regprocedure('public.leer_qr(uuid, text, timestamptz)') is null then raise exception 'Guarda: falta la migración 0048'; end if;
end $$;

alter table public.configuracion_gimnasio add column if not exists tope_dejar_pasar int;
update public.configuracion_gimnasio set tope_dejar_pasar = 5 where tope_dejar_pasar is null;
alter table public.configuracion_gimnasio alter column tope_dejar_pasar set default 5;
alter table public.configuracion_gimnasio alter column tope_dejar_pasar set not null;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'configuracion_tope_dejar_pasar_rango') then
    alter table public.configuracion_gimnasio add constraint configuracion_tope_dejar_pasar_rango check (tope_dejar_pasar between 0 and 50);
  end if;
end $$;

-- Cuántas veces dejó pasar hoy esta persona (hora del gimnasio).
create or replace function privado.dejados_hoy(p_gimnasio_id uuid, p_equipo_id uuid) returns int
language sql stable set search_path = '' as $$
  select count(*)::int from public.ingresos i
   where i.gimnasio_id = p_gimnasio_id and i.registrado_por = p_equipo_id and i.resultado = 'forzado' and i.anulado_en is null
     and i.momento >= privado.medianoche(privado.dia_local(now(), (select zona_horaria from public.gimnasios where id = p_gimnasio_id)),
                                         (select zona_horaria from public.gimnasios where id = p_gimnasio_id))
$$;
revoke all on function privado.dejados_hoy(uuid, uuid) from public, anon, authenticated;

-- ¿Esta persona puede dejar pasar a este socio ahora? Si no, dice por qué (y qué hacer).
create or replace function privado.puede_dejar_pasar(p_gimnasio_id uuid, p_equipo_id uuid, p_socio_id uuid, p_sede_id uuid) returns void
language plpgsql stable set search_path = '' as $$
declare v_rol text; tope int; v public.veredicto_acceso; baja boolean; n int;
begin
  select e.rol into v_rol from public.equipo e where e.id = p_equipo_id;
  if v_rol in ('dueno', 'encargado') then return; end if;
  v := privado.calcular_acceso(p_socio_id, now(), p_sede_id);
  if v.puede then return; end if;                       -- no hace falta dejarlo pasar
  select s.dado_de_baja_en is not null into baja from public.socios s where s.id = p_socio_id;
  if v.motivo = 'suspendido' or baja then
    raise exception 'A un socio % lo deja pasar el dueño o el encargado.', case when baja then 'dado de baja' else 'suspendido' end
      using errcode = '42501';
  end if;
  select c.tope_dejar_pasar into tope from public.configuracion_gimnasio c where c.gimnasio_id = p_gimnasio_id;
  if tope = 0 then raise exception 'En este gimnasio la recepción no deja pasar: que lo autorice el dueño o el encargado.' using errcode = '42501'; end if;
  n := privado.dejados_hoy(p_gimnasio_id, p_equipo_id);
  if n >= tope then
    raise exception 'Ya dejaste pasar a % hoy (el tope es %): que lo autorice el dueño o el encargado.', n, tope using errcode = '42501';
  end if;
end $$;
revoke all on function privado.puede_dejar_pasar(uuid, uuid, uuid, uuid) from public, anon, authenticated;

create or replace function public.registrar_ingreso(
  p_socio_id uuid, p_sede_id uuid, p_via_acceso text default 'recepcion',
  p_forzar_motivo text default null, p_dispositivo_id uuid default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare g uuid; eid uuid;
begin
  select gimnasio_id into g from public.socios where id = p_socio_id;
  if g is null then raise exception 'Sin permiso o socio inexistente' using errcode = '42501'; end if;
  if privado.es_servicio() then
    eid := null;   -- kiosco o QR: el servidor validó el dispositivo antes de llamar
    if p_dispositivo_id is not null and not exists (
         select 1 from public.dispositivos d
          where d.id = p_dispositivo_id and d.gimnasio_id = g and d.sede_id = p_sede_id and d.revocado_en is null) then
      raise exception 'Dispositivo revocado o de otra sede' using errcode = '42501';
    end if;
  else
    eid := privado.exigir_rol(g, array['dueno', 'encargado', 'recepcion'], p_sede_id);
    if p_dispositivo_id is not null then raise exception 'Un dispositivo solo registra desde el servidor' using errcode = '42501'; end if;
    -- D1: la recepción deja pasar con un tope por día; a suspendidos y dados de baja, solo dueño o encargado.
    if length(trim(coalesce(p_forzar_motivo, ''))) > 0 then perform privado.puede_dejar_pasar(g, eid, p_socio_id, p_sede_id); end if;
  end if;
  return privado.registrar_ingreso(p_socio_id, p_sede_id, p_via_acceso, eid, p_dispositivo_id, p_forzar_motivo, null);
end $$;

-- ── Lo que ve la pantalla antes de dejar pasar ──────────────────────
create or replace function public.cupo_dejar_pasar(p_gimnasio_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare e public.equipo; tope int;
begin
  e := privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado', 'recepcion']);
  select c.tope_dejar_pasar into tope from public.configuracion_gimnasio c where c.gimnasio_id = p_gimnasio_id;
  return jsonb_build_object('sin_tope', e.rol in ('dueno', 'encargado'), 'tope', tope, 'usados', privado.dejados_hoy(p_gimnasio_id, e.id));
end $$;

-- ── El resumen del dueño: a quién dejaron pasar hoy ─────────────────
create or replace function public.dejados_pasar(p_gimnasio_id uuid, p_dia date default null) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare zona text; dia date;
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado']);
  select g.zona_horaria into zona from public.gimnasios g where g.id = p_gimnasio_id;
  dia := coalesce(p_dia, privado.dia_local(now(), zona));
  return coalesce((select jsonb_agg(jsonb_build_object(
      'ingreso_id', i.id, 'momento', i.momento, 'socio_id', s.id, 'socio', trim(s.nombre || ' ' || s.apellido),
      'por', q.nombre, 'motivo', i.forzado_motivo, 'porque_no', i.texto) order by i.momento desc)
    from public.ingresos i join public.socios s on s.id = i.socio_id left join public.equipo q on q.id = i.registrado_por
   where i.gimnasio_id = p_gimnasio_id and i.resultado = 'forzado' and i.anulado_en is null
     and i.momento >= privado.medianoche(dia, zona) and i.momento < privado.medianoche(dia + 1, zona)), '[]');
end $$;

-- ── Configuración: el tope con el resto de las reglas ───────────────
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
    'pausa_dias_por_anio', c.pausa_dias_por_anio, 'pide_apto', c.pide_apto, 'tope_dejar_pasar', c.tope_dejar_pasar);
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
  v_tol int; v_aviso int; v_aus int; v_nuevo int; v_venc int; v_fue int; v_res int; v_canc int; v_pausa int; v_apto boolean; v_tope int;
  v_acento text; v_fondo text; v_reingreso boolean; v_medios text[]; v_banco text; v_secciones_final text[]; v_medios_final text[];
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno']);
  if jsonb_typeof(p_datos) is distinct from 'object' then raise exception 'Datos inválidos'; end if;
  select array_agg(k) into desconocidos from jsonb_object_keys(p_datos) k
   where k not in ('nombre', 'color_acento', 'color_fondo', 'cobra_membresia', 'cobra_pase', 'cobra_pack', 'modo_clases',
                   'accesos_activos', 'tolerancia_dias', 'dias_aviso', 'reingreso_mismo_dia_consume', 'secciones_apagadas',
                   'alias_transferencia', 'cbu', 'titular_cuenta', 'descuento_max_recepcion', 'retencion_dias_ausencia',
                   'retencion_dias_nuevo', 'retencion_dias_vencido', 'retencion_dias_se_fue', 'reserva_dias_anticipacion',
                   'cancelacion_horas_limite', 'medios_aceptados', 'banco_transferencia', 'pausa_dias_por_anio', 'pide_apto', 'tope_dejar_pasar');
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
      'pausa_dias_por_anio', 'Pausa: máximo de días por año', 'pide_apto', 'Pedir apto físico', 'tope_dejar_pasar', 'Dejar pasar: tope por día de la recepción') ->> p_campo, p_campo)
  end
$$;
revoke all on function privado.etiqueta_campo(text) from public, anon, authenticated;

-- ── Permisos ────────────────────────────────────────────────────────
revoke all on function public.registrar_ingreso(uuid, uuid, text, text, uuid), public.cupo_dejar_pasar(uuid), public.dejados_pasar(uuid, date),
  public.configuracion_panel(uuid), public.guardar_configuracion(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.registrar_ingreso(uuid, uuid, text, text, uuid), public.cupo_dejar_pasar(uuid), public.dejados_pasar(uuid, date),
  public.configuracion_panel(uuid), public.guardar_configuracion(uuid, jsonb) to authenticated, service_role;

-- ── Verificación ────────────────────────────────────────────────────
do $$
declare r record;
begin
  if exists (select 1 from public.configuracion_gimnasio where tope_dejar_pasar is null) then raise exception 'Verificación: falta el tope'; end if;
  for r in select p.oid, p.proname, p.proconfig from pg_proc p join pg_namespace s on s.oid = p.pronamespace
            where (s.nspname = 'public' and p.proname in ('registrar_ingreso', 'cupo_dejar_pasar', 'dejados_pasar', 'configuracion_panel', 'guardar_configuracion'))
               or (s.nspname = 'privado' and p.proname in ('puede_dejar_pasar', 'dejados_hoy')) loop
    if r.proconfig is null or not ('search_path=""' = any (r.proconfig)) then raise exception 'Verificación: % sin search_path vacío', r.proname; end if;
    if has_function_privilege('anon', r.oid, 'execute') then raise exception 'Verificación: anon puede ejecutar %', r.proname; end if;
  end loop;
end $$;
