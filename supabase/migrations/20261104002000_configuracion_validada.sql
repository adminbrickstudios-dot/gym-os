-- ═══════════════════════════════════════════════════════════════════
-- 0020 · Configuración validada con mensajes que entiende el dueño.
--
-- Hasta acá guardar_configuracion dejaba que los CHECK de la tabla
-- frenaran los valores imposibles: el dueño veía el texto crudo de
-- Postgres ("violates check constraint ..."). Un campo vacío o con
-- letras rompía el cast con otro mensaje crudo. Ahora cada campo se
-- valida antes de escribir y el error dice qué campo, qué rango y qué
-- poner. Los CHECK siguen como red de abajo.
--
-- Además:
--   · El alias se valida como lo validan los bancos: 6 a 20 caracteres,
--     letras, números, puntos y guiones.
--   · No se puede apagar todo lo que se cobra: sin membresía, pase ni
--     pack, el gimnasio no tiene nada para vender.
--   · El nombre del gimnasio tiene un largo máximo (se muestra en la
--     barra, el saludo y la página pública).
--
-- La firma no cambia: create or replace sobre la de 0013.
-- ═══════════════════════════════════════════════════════════════════

do $$
begin
  if to_regprocedure('public.guardar_configuracion(uuid,jsonb)') is null then raise exception 'Guarda: falta la migración 0013'; end if;
  if to_regprocedure('privado.secciones_validas()') is null then raise exception 'Guarda: falta privado.secciones_validas()'; end if;
  if to_regprocedure('privado.exigir_equipo(uuid,text[])') is null then raise exception 'Guarda: falta privado.exigir_equipo'; end if;
end $$;

-- Un número entero de p_datos, validado. Null si la clave no viene.
create or replace function privado.config_entero(p_datos jsonb, p_clave text, p_min int, p_max int, p_etiqueta text)
returns int language plpgsql immutable set search_path = '' as $$
declare v text;
begin
  if not (p_datos ? p_clave) then return null; end if;
  v := trim(coalesce(p_datos ->> p_clave, ''));
  if v = '' then raise exception '%: no puede quedar vacío, poné un número entre % y %.', p_etiqueta, p_min, p_max using errcode = '22023'; end if;
  if v !~ '^-?[0-9]+$' then raise exception '%: tiene que ser un número entero entre % y %.', p_etiqueta, p_min, p_max using errcode = '22023'; end if;
  if length(v) > 9 or v::int < p_min or v::int > p_max then
    raise exception '%: tiene que estar entre % y %.', p_etiqueta, p_min, p_max using errcode = '22023';
  end if;
  return v::int;
end $$;

-- Un sí/no de p_datos. Null si la clave no viene.
create or replace function privado.config_booleano(p_datos jsonb, p_clave text, p_etiqueta text)
returns boolean language plpgsql immutable set search_path = '' as $$
begin
  if not (p_datos ? p_clave) then return null; end if;
  if jsonb_typeof(p_datos -> p_clave) is distinct from 'boolean' then
    raise exception '%: tiene que ser sí o no.', p_etiqueta using errcode = '22023';
  end if;
  return (p_datos ->> p_clave)::boolean;
end $$;

-- Un color de p_datos. Null si la clave no viene.
create or replace function privado.config_color(p_datos jsonb, p_clave text, p_etiqueta text)
returns text language plpgsql immutable set search_path = '' as $$
declare v text;
begin
  if not (p_datos ? p_clave) then return null; end if;
  v := lower(trim(coalesce(p_datos ->> p_clave, '')));
  if v !~ '^#[0-9a-f]{6}$' then
    raise exception '%: tiene que ser un color como #2fbf5b.', p_etiqueta using errcode = '22023';
  end if;
  return v;
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
  v_acento text; v_fondo text; v_reingreso boolean;
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno']);
  if jsonb_typeof(p_datos) is distinct from 'object' then raise exception 'Datos inválidos'; end if;
  select array_agg(k) into desconocidos from jsonb_object_keys(p_datos) k
   where k not in ('nombre', 'color_acento', 'color_fondo', 'cobra_membresia', 'cobra_pase', 'cobra_pack', 'modo_clases',
                   'accesos_activos', 'tolerancia_dias', 'dias_aviso', 'reingreso_mismo_dia_consume', 'secciones_apagadas',
                   'alias_transferencia', 'cbu', 'titular_cuenta', 'descuento_max_recepcion', 'retencion_dias_ausencia',
                   'retencion_dias_nuevo', 'retencion_dias_vencido', 'retencion_dias_se_fue', 'reserva_dias_anticipacion',
                   'cancelacion_horas_limite');
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
    descuento_max_recepcion = coalesce(v_descuento, c.descuento_max_recepcion),
    retencion_dias_ausencia = coalesce(v_aus, c.retencion_dias_ausencia),
    retencion_dias_nuevo = coalesce(v_nuevo, c.retencion_dias_nuevo),
    retencion_dias_vencido = coalesce(v_venc, c.retencion_dias_vencido),
    retencion_dias_se_fue = coalesce(v_fue, c.retencion_dias_se_fue),
    reserva_dias_anticipacion = coalesce(v_res, c.reserva_dias_anticipacion),
    cancelacion_horas_limite = coalesce(v_canc, c.cancelacion_horas_limite),
    actualizado_en = now()
   where c.gimnasio_id = p_gimnasio_id
  returning c.cobra_membresia, c.cobra_pase, c.cobra_pack into v_membresia, v_pase, v_pack;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'No se pudo guardar la configuración'; end if;
  if not (v_membresia or v_pase or v_pack) then
    raise exception 'Dejá prendida al menos una forma de cobrar (membresía, pase diario o pack de clases).' using errcode = '22023';
  end if;
end $$;

-- ── Permisos ────────────────────────────────────────────────────────
revoke all on function
  privado.config_entero(jsonb, text, int, int, text), privado.config_booleano(jsonb, text, text),
  privado.config_color(jsonb, text, text)
  from public, anon, authenticated;
revoke all on function public.guardar_configuracion(uuid, jsonb) from public, anon;
grant execute on function public.guardar_configuracion(uuid, jsonb) to authenticated, service_role;

-- ── Verificación ────────────────────────────────────────────────────
do $$
declare r record;
begin
  for r in select p.oid, p.proname, p.proconfig from pg_proc p join pg_namespace s on s.oid = p.pronamespace
            where (s.nspname = 'privado' and p.proname in ('config_entero', 'config_booleano', 'config_color'))
               or (s.nspname = 'public' and p.proname = 'guardar_configuracion') loop
    if r.proconfig is null or not ('search_path=""' = any (r.proconfig)) then
      raise exception 'Verificación: % sin search_path vacío', r.proname;
    end if;
    if has_function_privilege('anon', r.oid, 'execute') then raise exception 'Verificación: anon puede ejecutar %', r.proname; end if;
  end loop;
  if not has_function_privilege('authenticated', 'public.guardar_configuracion(uuid,jsonb)', 'execute') then
    raise exception 'Verificación: el equipo no puede guardar la configuración';
  end if;
  if privado.config_entero('{"x":"5"}', 'x', 0, 10, 'X') <> 5 or privado.config_entero('{}', 'x', 0, 10, 'X') is not null then
    raise exception 'Verificación: config_entero no lee bien';
  end if;
  begin
    perform privado.config_entero('{"x":"99"}', 'x', 0, 10, 'X');
    raise exception 'Verificación: config_entero dejó pasar un valor fuera de rango';
  exception when invalid_parameter_value then null;
  end;
end $$;
