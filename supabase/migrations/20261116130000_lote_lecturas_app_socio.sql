-- Cacería (Mateo, 16/11) · La app del socio (Inicio) hacía 22 pedidos a la base por cada apertura, y Caja y Mensajes del panel 6 a 9. lote_lecturas ya junta lecturas del panel en UN viaje;
-- acá solo se suman nombres a su lista cerrada: las lecturas del Inicio del socio, de Caja (cajas_sede) y de Mensajes (bandeja, respuestas rápidas y permisos). Misma función, misma seguridad: lote_lecturas corre con los permisos de quien
-- pregunta y cada lectura verifica por su cuenta que la ficha sea del propio socio (permiso denegado = error, nunca una lista vacía).
-- Compatible: el código anterior no usa estos nombres; si el código nuevo corriera contra una base sin esta migración, rpcLote cae a pedir cada una por separado.
do $g$ begin
  if to_regprocedure('public.lote_lecturas(jsonb)') is null then raise exception 'Guarda: falta lote_lecturas'; end if;
end $g$;

do $lote$
declare def text; nuevos text := '''mi_qr'',''usa_qr_pared'',''mis_invitados'',''campana_socio'',''pago_online_disponible'',''progreso_inicio'',''novedades_socio'',''mi_link_referido'',''rutina_de_socio'',''documentos_socio'',''eventos_socio'',''encuesta_socio'',''grados_socio'',''mi_dni'',''registra_salida'',''cajas_sede'',''bandeja_mensajes'',''respuestas_rapidas'',''permisos_mensajes''';
begin
  def := pg_get_functiondef('public.lote_lecturas(jsonb)'::regprocedure);
  if position('''progreso_inicio''' in def) = 0 then
    def := replace(def, '''alertas_patron_entradas'']', '''alertas_patron_entradas'',' || nuevos || ']');
    if position('''progreso_inicio''' in def) = 0 then raise exception 'Guarda: no se pudo sumar la lista del Inicio del socio a lote_lecturas'; end if;
    execute def;
  end if;
end $lote$;

do $v$ begin
  if has_function_privilege('anon', 'public.lote_lecturas(jsonb)', 'execute') then raise exception 'Verificación: anon puede ejecutar lote_lecturas'; end if;
  if not has_function_privilege('authenticated', 'public.lote_lecturas(jsonb)', 'execute') then raise exception 'Verificación: authenticated no puede ejecutar lote_lecturas'; end if;
  if position('''progreso_inicio''' in pg_get_functiondef('public.lote_lecturas(jsonb)'::regprocedure)) = 0 then raise exception 'Verificación: faltan las lecturas del Inicio del socio'; end if;
end $v$;
