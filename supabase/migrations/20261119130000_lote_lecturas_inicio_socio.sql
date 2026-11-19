-- Paneles completos (19/11) · /app del socio de 9 viajes a 4: las seis lecturas que el Inicio pedía aparte (clave nueva, avisos, ocupación, ofertas de lugar,
-- avisos de la clase y del vencimiento, recomendación) pasan al lote de UN viaje. Solo se suman nombres a la lista cerrada de lote_lecturas: misma función, misma seguridad
-- (corre con los permisos de quien pregunta y cada lectura verifica por su cuenta que la ficha sea del propio socio: permiso denegado = error).
-- Compatible: el código anterior no usa estos nombres; el nuevo, contra una base sin esta migración, cae a pedir cada una por separado (rpcLote).
do $g$ begin
  if to_regprocedure('public.lote_lecturas(jsonb)') is null then raise exception 'Guarda: falta lote_lecturas'; end if;
end $g$;

do $lote$
declare def text;
begin
  def := pg_get_functiondef('public.lote_lecturas(jsonb)'::regprocedure);
  if position('''avisos_app_socio''' in def) = 0 then
    if position('''version_registro'']' in def) = 0 then raise exception 'Guarda: la lista de lote_lecturas no termina como se esperaba (falta la migración 20261118110000)'; end if;
    def := replace(def, '''version_registro'']', '''version_registro'',''aviso_clave_socio'',''mis_avisos'',''ocupacion_en_vivo'',''ofertas_socio'',''avisos_app_socio'',''resumen_app_socio'']');
    execute def;
  end if;
end $lote$;

do $v$ begin
  if has_function_privilege('anon', 'public.lote_lecturas(jsonb)', 'execute') then raise exception 'Verificación: anon puede ejecutar lote_lecturas'; end if;
  if not has_function_privilege('authenticated', 'public.lote_lecturas(jsonb)', 'execute') then raise exception 'Verificación: authenticated no puede ejecutar lote_lecturas'; end if;
  if position('''avisos_app_socio''' in pg_get_functiondef('public.lote_lecturas(jsonb)'::regprocedure)) = 0 then raise exception 'Verificación: faltan las lecturas del Inicio del socio en lote_lecturas'; end if;
end $v$;
