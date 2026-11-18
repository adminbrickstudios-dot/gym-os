-- Cacería (Mateo, 16/11), Entrada: la Puerta pedía sola, al abrir, el modo de prueba gratis y si se registra la salida (2 viajes más a la base).
-- lote_lecturas ya junta las lecturas de la pantalla en UN viaje; acá solo se suman dos nombres a su lista cerrada. Misma función, misma seguridad:
-- corre con los permisos de quien pregunta y cada lectura verifica el gimnasio por su cuenta (permiso denegado = error, nunca una lista vacía).
-- Compatible: el código anterior no usa estos nombres; si el código nuevo corriera contra una base sin esta migración, rpcLote pide cada una por separado.
do $g$ begin
  if to_regprocedure('public.lote_lecturas(jsonb)') is null then raise exception 'Guarda: falta lote_lecturas'; end if;
end $g$;

do $lote$
declare def text;
begin
  def := pg_get_functiondef('public.lote_lecturas(jsonb)'::regprocedure);
  if position('''config_visita''' in def) = 0 then
    if position('''permisos_mensajes'']' in def) = 0 then raise exception 'Guarda: la lista de lote_lecturas no termina como se esperaba'; end if;
    def := replace(def, '''permisos_mensajes'']', '''permisos_mensajes'',''config_prueba_gratis'',''config_visita'']');
    execute def;
  end if;
end $lote$;

do $v$ begin
  if has_function_privilege('anon', 'public.lote_lecturas(jsonb)', 'execute') then raise exception 'Verificación: anon puede ejecutar lote_lecturas'; end if;
  if not has_function_privilege('authenticated', 'public.lote_lecturas(jsonb)', 'execute') then raise exception 'Verificación: authenticated no puede ejecutar lote_lecturas'; end if;
  if position('''config_visita''' in pg_get_functiondef('public.lote_lecturas(jsonb)'::regprocedure)) = 0 then raise exception 'Verificación: faltan las lecturas de la Entrada en lote_lecturas'; end if;
end $v$;
