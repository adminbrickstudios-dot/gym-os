-- F1.3 / BASE-4 · "Caja del turno" como número de Inicio de la recepción.
-- Cuenta los cobros (ventas confirmadas) del turno de caja ABIERTO de quien mira, en su sede. Es un conteo, nunca plata: el arqueo es ciego
-- y la recepción no ve lo que "tiene que haber" (ver caja/page.tsx); un monto en Inicio sería un permiso nuevo (recepcion_ve_cobrado) que
-- decide el dueño y que acá no se toca. Con la caja cerrada el número es 0. Solo lo ve la recepción y solo si Caja está prendida.
-- Lo suma a: la restricción de las claves permitidas, guardar_numeros_inicio (que valida contra la misma lista), y numeros_inicio (parte de
-- la definición vigente en la base, no de una copia, con un reemplazo que verifica que cada trozo se haya cambiado).
-- Los números que ya estaban no cambian; la recepción lo ve además por defecto cuando no eligió ninguno.

do $g$ begin
  if to_regprocedure('public.numeros_inicio(uuid, uuid)') is null then raise exception 'Guarda: falta public.numeros_inicio'; end if;
  if to_regprocedure('public.guardar_numeros_inicio(uuid, text[])') is null then raise exception 'Guarda: falta public.guardar_numeros_inicio'; end if;
  if not exists (select 1 from pg_constraint where conname = 'configuracion_numeros_inicio_ck') then raise exception 'Guarda: falta configuracion_numeros_inicio_ck'; end if;
end $g$;

-- 1) La restricción acepta la clave nueva.
alter table public.configuracion_gimnasio drop constraint if exists configuracion_numeros_inicio_ck;
alter table public.configuracion_gimnasio add constraint configuracion_numeros_inicio_ck
  check (numeros_inicio <@ array['adentro','entraron','cobrado','a_cobrar','deben','por_vencer','plata_riesgo','activos','altas_mes','bajas_mes','ocupacion','caja_turno']::text[]
         and cardinality(numeros_inicio) <= 8);

-- 2) y la función que guarda la elección.
do $m$
declare def text; nuevo text;
begin
  def := pg_get_functiondef('public.guardar_numeros_inicio(uuid, text[])'::regprocedure);
  nuevo := replace(def, '''bajas_mes'',''ocupacion'']::text[]', '''bajas_mes'',''ocupacion'',''caja_turno'']::text[]');
  if nuevo = def then raise exception 'guardar_numeros_inicio: no se encontró la lista de claves para ampliar'; end if;
  execute nuevo;
end $m$;

-- 3) y el cálculo.
do $m$
declare def text; nuevo text;
begin
  def := pg_get_functiondef('public.numeros_inicio(uuid, uuid)'::regprocedure);
  nuevo := def;
  -- la lista de claves
  nuevo := replace(nuevo, '''bajas_mes'',''ocupacion''];', '''bajas_mes'',''ocupacion'',''caja_turno''];');
  -- la etiqueta
  nuevo := replace(nuevo, 'Ocupación de clases (%)'');', 'Ocupación de clases (%)'', ''caja_turno'', ''💵|Caja del turno'');');
  -- quién la ve: la recepción, con Caja prendida
  nuevo := replace(nuevo, 'or (k = ''ocupacion'' and not hay_clases) then continue;',
                          'or (k = ''ocupacion'' and not hay_clases) or (k = ''caja_turno'' and (e.rol <> ''recepcion'' or ''caja'' = any (c.secciones_apagadas))) then continue;');
  -- por defecto (cuando no eligieron ninguno): a la recepción se le suma
  nuevo := replace(nuevo, 'array[''adentro'',''entraron'',''cobrado'',''a_cobrar'',''por_vencer'',''deben'',''plata_riesgo'']',
                          'array[''adentro'',''entraron'',''cobrado'',''a_cobrar'',''por_vencer'',''deben'',''plata_riesgo'',''caja_turno'']');
  nuevo := replace(nuevo, 'array[''adentro'',''entraron'',''a_cobrar'',''por_vencer'',''deben''] end loop',
                          'array[''adentro'',''entraron'',''a_cobrar'',''por_vencer'',''deben'',''caja_turno''] end loop');
  -- el número: cobros confirmados en MI turno abierto de esta sede
  nuevo := replace(nuevo, 'elsif k = ''deben'' then',
    'elsif k = ''caja_turno'' then
      select count(*) into v from public.ventas ve
        join public.turnos_caja tc on tc.gimnasio_id = ve.gimnasio_id and tc.id = ve.turno_caja_id
        join public.cajas cj on cj.id = tc.caja_id
       where ve.gimnasio_id = p_gimnasio_id and ve.estado = ''confirmada'' and tc.cerrado_en is null and tc.abierto_por = e.id
         and (sede is null or cj.sede_id = sede);
    elsif k = ''deben'' then');
  if nuevo not like '%''caja_turno'', ''💵|Caja del turno''%' or nuevo not like '%k = ''caja_turno'' and (e.rol%' or nuevo not like '%elsif k = ''caja_turno'' then%'
     or nuevo not like '%''plata_riesgo'',''caja_turno'']%' or nuevo not like '%''deben'',''caja_turno''] end loop%' or nuevo not like '%''ocupacion'',''caja_turno'']%' then
    raise exception 'numeros_inicio: algún trozo no se pudo reemplazar (la definición cambió)';
  end if;
  execute nuevo;
end $m$;

revoke all on function public.numeros_inicio(uuid, uuid), public.guardar_numeros_inicio(uuid, text[]) from public, anon, authenticated;
grant execute on function public.numeros_inicio(uuid, uuid), public.guardar_numeros_inicio(uuid, text[]) to authenticated, service_role;

-- ── Verificación ────────────────────────────────────────────────────
do $v$
declare f text;
begin
  foreach f in array array['public.numeros_inicio(uuid, uuid)', 'public.guardar_numeros_inicio(uuid, text[])'] loop
    if pg_get_functiondef(f::regprocedure) not like '%caja_turno%' then raise exception 'Verificación: % no conoce caja_turno', f; end if;
    if not exists (select 1 from pg_proc where oid = f::regprocedure and 'search_path=""' = any (proconfig)) then raise exception 'Verificación: % sin search_path vacío', f; end if;
    if has_function_privilege('anon', f, 'execute') then raise exception 'Verificación: anon puede ejecutar %', f; end if;
  end loop;
  if pg_get_functiondef('public.numeros_inicio(uuid, uuid)'::regprocedure) not like '%r_riesgo%' then raise exception 'Verificación: numeros_inicio perdió la pasada única'; end if;
end $v$;
