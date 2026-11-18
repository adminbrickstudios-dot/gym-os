-- Cacería (Mateo, 16/11), Inicio del dueño (datos_ejemplo, seguridad_dueno), "¿Quién atiende?" de Vender y Caja (operador_actual), la versión de Configuración (version_registro) e Interesados (Socios → Interesados y /panel/prospectos): la lista, los invitados sin seguimiento y las funciones prendidas
-- se pedían en tres viajes seguidos. lote_lecturas ya junta lecturas en UN viaje; acá solo se suman dos nombres a su lista cerrada
-- (prospectos_panel ya está). Misma función, misma seguridad: corre con los permisos de quien pregunta y cada lectura verifica el gimnasio por su cuenta.
-- Compatible: el código anterior no usa estos nombres; si el código nuevo corriera contra una base sin esta migración, rpcLote pide cada una por separado.
do $g$ begin
  if to_regprocedure('public.lote_lecturas(jsonb)') is null then raise exception 'Guarda: falta lote_lecturas'; end if;
end $g$;

do $lote$
declare def text;
begin
  def := pg_get_functiondef('public.lote_lecturas(jsonb)'::regprocedure);
  if position('''invitados_sin_seguimiento''' in def) = 0 then
    if position('''config_visita'']' in def) = 0 then raise exception 'Guarda: la lista de lote_lecturas no termina como se esperaba (falta la migración 20261118100000)'; end if;
    def := replace(def, '''config_visita'']', '''config_visita'',''invitados_sin_seguimiento'',''funciones_nuevas_activas'',''datos_ejemplo'',''seguridad_dueno'',''operador_actual'',''version_registro'']');
    execute def;
  end if;
end $lote$;

do $v$ begin
  if has_function_privilege('anon', 'public.lote_lecturas(jsonb)', 'execute') then raise exception 'Verificación: anon puede ejecutar lote_lecturas'; end if;
  if not has_function_privilege('authenticated', 'public.lote_lecturas(jsonb)', 'execute') then raise exception 'Verificación: authenticated no puede ejecutar lote_lecturas'; end if;
  if position('''funciones_nuevas_activas''' in pg_get_functiondef('public.lote_lecturas(jsonb)'::regprocedure)) = 0 then raise exception 'Verificación: faltan las lecturas de Interesados en lote_lecturas'; end if;
end $v$;
