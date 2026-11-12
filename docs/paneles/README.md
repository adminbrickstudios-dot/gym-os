# Mapa de pantallas

**Generado por `node scripts/mapa-pantallas.mjs`** a partir del código: no se edita a mano.
Se vuelve a generar cada vez que una vuelta cambia una pantalla.

Quién la ve: los roles que exige la pantalla (👑 dueño · 🧭 encargado · 🛎️ recepción · 💪 profe); vacío = todo el equipo o lo decide la función de la base.

| Ruta | Tipo | Quién la ve | Se apaga con | Funciones de la base | Lleva a |
|---|---|---|---|---|---|
| `(middleware)` | cada pedido |  |  | `gimnasio_por_host`, `gimnasio_por_slug` |  |
| `/` | pantalla |  |  | `abonar_turno`, `apagar_ayudas`, `borrar_suscripcion_push`, `guardar_suscripcion_push`, `marcar_ayuda`, `quitar_turno`, `registrar_pedido_codigo`, `reiniciar_ayudas`, `socio_para_vincular_google`, `suscripcion_push`, `vincular_google` | `/ingresar` |
| `/admin` | pantalla |  |  | `admin_agregar_dominio`, `admin_agregar_nota`, `admin_agregar_persona`, `admin_alertas`, `admin_anotar_registro`, `admin_anular_pago_brik`, `admin_aplicar_plantilla`, `admin_asignar_plan_brik`, `admin_atender_demo`, `admin_ayudas`, `admin_borrar_definitivo`, `admin_borrar_demos_vencidas`, `admin_borrar_socio`, `admin_buscar_persona`, `admin_cambiar_dueno`, `admin_cambiar_rol_persona`, `admin_cambiar_slug`, `admin_cancelar_mantenimiento`, `admin_clonar_configuracion`, `admin_confirmar_cuenta`, `admin_crear_demo`, `admin_crear_gimnasio`, `admin_dar_de_baja`, `admin_dar_rol_brik`, `admin_demos_vencidas`, `admin_errores`, `admin_estado_copias`, `admin_estado_persona`, `admin_estado_seguridad`, `admin_evento_webhook`, `admin_funciones_prueba`, `admin_gimnasio`, `admin_gimnasios`, `admin_guardar_ciudad`, `admin_guardar_contacto_plataforma`, `admin_guardar_descuento`, `admin_guardar_limites_plan`, `admin_guardar_link_pago`, `admin_guardar_marca`, `admin_guardar_modulos`, `admin_guardar_plan_brik`, `admin_guardar_plantilla_texto`, `admin_guardar_prueba`, `admin_guardar_tipo_gimnasio`, `admin_limites_gimnasios`, `admin_link_pago`, `admin_mantenimientos`, `admin_marcar_favorito`, `admin_metricas`, `admin_mover_persona`, `admin_novedades`, `admin_pausar_gimnasio`, `admin_pedidos_demo`, `admin_plan_publico`, `admin_planes_brik`, `admin_planes_con_limites`, `admin_plataforma_estado`, `admin_prender_funcion`, `admin_probar_acceso`, `admin_probar_acceso_gimnasio`, `admin_programar_mantenimiento`, `admin_publicar_novedad`, `admin_quitar_descuento`, `admin_quitar_dominio`, `admin_quitar_rol_brik`, `admin_reanudar_gimnasio`, `admin_registrar_equipo`, `admin_registrar_pago_brik`, `admin_resolver_ayuda`, `admin_restaurar_baja`, `admin_restaurar_plan`, `admin_restaurar_plantilla_texto`, `admin_restaurar_socio`, `admin_restaurar_texto_gimnasio`, `admin_retirar_novedad`, `admin_tablero`, `admin_tamano_tablas`, `admin_uso_gimnasios`, `cerrar_evento_webhook`, `contacto_plataforma_publico`, `credenciales_mp`, `cuenta_para_nueva_clave`, `mi_sesion`, `persona_para_dar_acceso` | `/admin/` `/admin/buscar` `/admin/gimnasios` `/admin/plantillas` `/admin/registro` `/admin/seguridad` |
| `/admin/[id]` | pantalla |  |  | `admin_errores`, `admin_ficha_extra`, `admin_gimnasio`, `admin_gimnasios`, `admin_lanzamiento`, `admin_link_pago`, `admin_lista_gimnasios`, `admin_notas`, `admin_papelera`, `admin_planes_brik`, `admin_soportes`, `admin_uso_semanal`, `historial_configuracion` | `/admin/` `/admin/gimnasios` |
| `/admin/[id]/exportar` | acción (POST/GET) |  |  | `admin_exportar_gimnasio` |  |
| `/admin/buscar` | pantalla |  |  |  | `/admin` `/admin/` `/admin/buscar/exportar-socio` `/admin/ver-socio` |
| `/admin/buscar/exportar-socio` | acción (POST/GET) |  |  | `admin_exportar_socio` |  |
| `/admin/entrar` | acción (POST/GET) |  |  | `admin_entrar_gimnasio` |  |
| `/admin/gimnasios` | pantalla |  |  | `admin_gimnasios`, `admin_lista_gimnasios` | `/admin` `/admin/` `/admin/gimnasios/exportar` |
| `/admin/gimnasios/exportar` | acción (POST/GET) |  |  | `admin_lista_gimnasios` |  |
| `/admin/plantillas` | pantalla |  |  | `admin_plantillas_texto` | `/admin` |
| `/admin/registro` | pantalla |  |  | `admin_registro_brik` | `/admin/` `/admin/seguridad` |
| `/admin/salir-gimnasio` | acción (POST/GET) |  |  | `admin_salir_gimnasio` |  |
| `/admin/seguridad` | pantalla |  |  | `admin_estado_seguridad`, `mi_seguridad` | `/admin` `/admin/registro` |
| `/admin/ver-socio` | pantalla |  |  | `admin_ver_socio` | `/admin/buscar` |
| `/api/salud` | acción (POST/GET) |  |  |  |  |
| `/api/webhooks/mercadopago` | acción (POST/GET) |  |  | `cerrar_evento_webhook`, `credenciales_mp`, `registrar_evento_webhook` |  |
| `/api/webhooks/mercadopago-debito` | acción (POST/GET) |  |  | `credenciales_mp` |  |
| `/app` | pantalla |  |  | `aceptar_oferta`, `anotar_ejercicio`, `aviso_clave_socio`, `avisos_app_socio`, `campana_socio`, `cancelar_inscripcion_evento`, `cancelar_reserva`, `constancia_baja`, `credenciales_mp`, `documentos_socio`, `elegir_lugar`, `encuesta_socio`, `entrar_por_qr_pared`, `eventos_socio`, `grados_socio`, `guardar_aviso_clase`, `informar_compra_app`, `informar_transferencia`, `iniciar_compra_online`, `iniciar_pago_online`, `inscribirse_evento`, `invitar`, `marcar_aviso_clave_visto`, `marcar_aviso_leido`, `marcar_bienvenida`, `mi_dni`, `mi_link_referido`, `mi_qr`, `mis_avisos`, `mis_invitados`, `novedades_socio`, `ocupacion_en_vivo`, `ofertas_socio`, `pago_online`, `pago_online_disponible`, `pedir_baja_socio`, `pedir_pausa_socio`, `pestanas_app`, `progreso_inicio`, `rechazar_oferta`, `registra_salida`, `reservar`, `responder_encuesta`, `resumen_app_socio`, `rutina_de_socio`, `salir_por_qr_pared`, `usa_qr_pared`, `vista_compra_app` | `/app/clases` `/app/info` `/app/novedades` `/app/resumen` `/app/rutina` `/app/yo` |
| `/app/ayuda` | pantalla |  |  | `pestanas_app` | `/app/ayuda/guia` `/app/info` |
| `/app/ayuda/guia` | pantalla |  |  | `pestanas_app` | `/app/ayuda` |
| `/app/clases` | pantalla |  |  | `avisos_lugar_socio`, `clases_del_dia`, `horarios_para_turno`, `lugares_clase`, `politica_reservas`, `profes_de_clases`, `turnos_socio`, `wods_socio` | `/app` `/app/yo` |
| `/app/cuenta` | pantalla |  |  | `mi_seguridad`, `pedido_baja_socio` | `/app` `/app/mis-datos` `/app/pedir-datos` `/app/yo` `/privacidad` |
| `/app/foto` | acción (POST/GET) |  |  | `foto_propia` |  |
| `/app/historial` | pantalla |  |  | `mi_historial` | `/app` `/app/recibo/` `/app/yo` |
| `/app/info` | pantalla |  |  | `info_gimnasio_socio` | `/app` `/app/mensajes/nuevo` |
| `/app/locker` | pantalla |  |  | `mi_locker` | `/app` `/app/yo` |
| `/app/mensajes` | pantalla |  |  | `escribir_al_gimnasio`, `mensajes_estado_socio`, `mis_mensajes`, `responder_hilo_socio` | `/app` `/app/mensajes/` `/app/mensajes/nuevo` `/app/yo` |
| `/app/mensajes/[id]` | pantalla |  |  | `mi_hilo` | `/app` `/app/mensajes` |
| `/app/mensajes/nuevo` | pantalla |  |  | `mensajes_estado_socio` | `/app` `/app/mensajes` |
| `/app/mis-datos` | acción (POST/GET) |  |  | `mis_datos` |  |
| `/app/novedades` | pantalla |  |  | `campana_socio`, `leer_campana`, `mensajes_estado_socio` | `/app` `/app/mensajes` |
| `/app/pago` | pantalla |  |  | `pago_online`, `pago_online_revisable` | `/app/historial` |
| `/app/pedir-datos` | pantalla |  |  | `pedir_mis_datos` | `/app` `/app/mis-datos` `/app/yo` `/privacidad` |
| `/app/plan` | pantalla |  |  | `opciones_compra_app` | `/app` `/app/yo` |
| `/app/pt` | pantalla |  |  | `cancelar_sesion_pt`, `pt_socio`, `reservar_sesion_pt` | `/app` `/app/yo` |
| `/app/recibo/[venta]` | pantalla |  |  | `recibo_venta` | `/app` `/app/historial` |
| `/app/resumen` | pantalla |  |  | `resumen_app_socio` | `/app` `/app/yo` |
| `/app/rutina` | pantalla |  |  | `marcar_serie_rutina`, `progreso_socio`, `rutina_de_socio`, `series_hechas_hoy` | `/app` |
| `/app/yo` | pantalla |  |  | `aviso_clase_socio`, `confirmar_foto_propia`, `foto_propia`, `foto_propia_permitida`, `mensajes_estado_socio`, `mi_dni`, `mi_link_referido`, `mi_locker`, `mis_invitados`, `opciones_compra_app`, `preparar_foto_propia`, `pt_socio` | `/app` `/app/mis-datos` |
| `/auth/callback` | acción (POST/GET) |  |  | `entrar_con_google`, `mi_sesion` |  |
| `/auth/google` | acción (POST/GET) |  |  |  |  |
| `/auth/vincular` | pantalla |  |  | `mi_sesion` | `/ingresar` |
| `/dueno` | acción (POST/GET) |  |  |  |  |
| `/elegir` | pantalla |  |  | `mi_sesion` | `/admin` `/entrar/` `/g/` |
| `/entrar/[slug]` | acción (POST/GET) |  |  | `mi_sesion` |  |
| `/estado` | pantalla |  |  | `planes_brik_publicos` |  |
| `/foto-equipo/[id]` | acción (POST/GET) |  |  | `foto_equipo` |  |
| `/gimnasio-no-encontrado` | pantalla |  |  |  |  |
| `/hacete-socio` | pantalla |  |  | `alta_online`, `alta_publica`, `anotar_origen_alta`, `pago_online_disponible` | `/ingresar` `/privacidad` |
| `/ingresar` | pantalla |  |  | `contacto_plataforma_publico`, `ingreso_permitido`, `mail_para_ingresar`, `mi_sesion`, `registrar_ingreso_fallido`, `registrar_pedido_codigo`, `socio_para_reclamar`, `telefono_para_ingresar`, `vincular_socios_por_email`, `vincular_socios_por_telefono` | `/auth/google` `/hacete-socio` |
| `/ingresar/recuperar` | pantalla |  |  |  | `/ingresar` |
| `/kiosco` | pantalla |  |  | `kiosco_emergencia`, `kiosco_entrar`, `kiosco_entrar_habitual`, `kiosco_estado`, `kiosco_habituales`, `kiosco_qr`, `kiosco_salida_activa`, `kiosco_salir`, `kiosco_ultimo` |  |
| `/kiosco/activar` | acción (POST/GET) |  |  |  |  |
| `/panel` | pantalla |  |  | `anular_venta_panel`, `borrar_socios_ejemplo`, `buscar_socios`, `cargar_socios_ejemplo`, `cerrar_novedad_plataforma`, `contacto_plataforma_publico`, `dar_de_baja_equipo`, `estado_gimnasio_aviso`, `estado_soporte`, `guardar_accesos_rapidos`, `guardar_numeros_inicio`, `marcar_alertas_vistas`, `ocultar_primeros_pasos`, `pedir_anulacion`, `pedir_ayuda_brik`, `pendientes_panel`, `registrar_sesion_equipo`, `resolver_pedido_anulacion`, `ultimas_entradas` | `/elegir` `/panel/caja` `/panel/entrada/control` `/panel/planes` `/panel/resumen` `/panel/socios/` `/panel/socios/nuevo` `/panel/tareas` `/panel/vender` |
| `/panel/asistente` | pantalla | 👑 |  | `configuracion_panel`, `estado_pagos_online`, `pagina_panel`, `pasos_asistente` |  |
| `/panel/avisos` | pantalla | 👑 🧭 🛎️ |  | `bandeja_avisos`, `marcar_avisado`, `novedades_panel`, `publicar_novedad`, `quitar_novedad` | `/panel/socios/` |
| `/panel/ayuda` | pantalla |  |  |  | `/panel/ayuda/guias` |
| `/panel/ayuda/carteles` | pantalla | 👑 🧭 |  |  |  |
| `/panel/ayuda/carteles/anotate` | pantalla | 👑 🧭 |  | `guardar_alta_plan_sugerido` | `/panel/pagina` |
| `/panel/ayuda/carteles/app` | pantalla | 👑 🧭 |  |  |  |
| `/panel/ayuda/carteles/puerta` | pantalla | 👑 🧭 |  |  |  |
| `/panel/ayuda/guias` | pantalla |  |  |  | `/panel/ayuda/carteles` `/panel/ayuda/guias/` |
| `/panel/ayuda/guias/[rol]` | pantalla |  |  |  |  |
| `/panel/caja` | pantalla | 👑 🧭 🛎️ | caja | `abrir_caja`, `cajas_para_revisar`, `cerrar_caja`, `cobros_de_turnos`, `confirmar_ticket`, `contar_caja_sin_contar`, `dejar_caja_sin_contar`, `guardar_config_caja`, `movimiento_caja`, `preparar_ticket`, `ticket_movimiento` | `/panel/caja/historial` `/panel/caja/reporte` |
| `/panel/caja/historial` | pantalla | 👑 🧭 | caja | `diferencia_caja_por_cajero`, `historial_caja` | `/panel/caja/reporte` |
| `/panel/caja/reporte` | pantalla | 👑 🧭 🛎️ | caja | `cobros_de_turnos`, `reporte_dia`, `reporte_turno` | `/panel/caja` |
| `/panel/campana` | pantalla |  |  | `aptos_por_vencer`, `campana_panel`, `funciones_nuevas_activas`, `guardar_preferencia_aviso`, `leer_campana`, `preferencias_aviso_panel`, `que_hay_de_nuevo`, `resumen_noche` | `/panel/configuracion` `/panel/cuenta` `/panel/socios/` |
| `/panel/clases` | pantalla |  | clases | `anular_presente`, `avisar_clase`, `cancelar_clase`, `clases_del_dia`, `crear_tv`, `guardar_lugares`, `guardar_wod`, `reemplazar_profe`, `reservar`, `revocar_tv`, `tomar_asistencia` | `/panel/clases/` `/panel/clases/grilla` `/panel/clases/tv` `/panel/grados` |
| `/panel/clases/[id]` | pantalla |  | clases | `avisos_clase`, `clase_detalle`, `equipo_gimnasio`, `faltas_clase`, `fotos_de_clase`, `lista_clase`, `reemplazos_clase` | `/panel/clases` |
| `/panel/clases/grilla` | pantalla | 👑 🧭 💪 🛎️ | clases | `actividades_gimnasio`, `agregar_horario`, `cerrar_horario`, `editar_horario`, `equipo_gimnasio`, `guardar_actividad`, `horarios_gimnasio`, `ocupacion_horarios` | `/panel/clases` |
| `/panel/clases/tv` | pantalla | 👑 🧭 💪 🛎️ | clases | `tvs_panel` |  |
| `/panel/configuracion` | pantalla | 👑 🧭 |  | `anular_cierre`, `apto_config`, `autonomia_socios_estado`, `autorizar_tablet`, `autoservicio_panel`, `avisar_sin_bloquear_estado`, `cambiar_funcion_nueva`, `cancelar_adhesion_debito`, `cierres_panel`, `config_caja`, `config_cierres`, `config_cobro`, `config_dejar_pasar`, `config_entrada`, `config_prueba_gratis`, `config_turnos_fijos`, `configuracion_panel`, `confirmar_imagen_marca`, `crear_cierre`, `credenciales_mp`, `datos_gimnasio_panel`, `debito_estado`, `encuestas_panel`, `espera_plazo_gimnasio`, `estado_pagos_online`, `foto_socio_permitida_gimnasio`, `funciones_nuevas_panel`, `guardar_apto_config`, `guardar_autonomia_socios`, `guardar_avisar_sin_bloquear`, `guardar_compras_app`, `guardar_config_cierres`, `guardar_config_dejar_pasar`, `guardar_configuracion`, `guardar_datos_gimnasio`, `guardar_doble_cobro`, `guardar_espera_plazo`, `guardar_foto_socio_permitida`, `guardar_horarios_apertura`, `guardar_link_resena`, `guardar_mensaje`, `guardar_mercadopago`, `guardar_meta_visitas`, `guardar_plan_familiar`, `guardar_prueba_gratis`, `guardar_registro_socios`, `guardar_regla_plan`, `guardar_regla_vencimiento`, `guardar_turnos_fijos`, `historial_configuracion`, `horarios_apertura_panel`, `mensajes_panel`, `meta_visitas_panel`, `ordenar_fotos`, `plan_familiar_estado`, `preparar_imagen_marca`, `previsualizar_cierre`, `publicar_pagina`, `que_hay_de_nuevo`, `quitar_imagen_marca`, `quitar_mercadopago`, `reglas_vencimiento`, `restaurar_mensaje`, `revocar_tablet`, `simular_cuota`, `sumar_sede`, `tablets_panel`, `vista_previa_mensaje` | `/panel/datos-personales` `/panel/documentos` `/panel/exportar` `/panel/pagina` `/panel/socios` |
| `/panel/control` | pantalla | 👑 🧭 | control | `alertas_patron_entradas`, `beneficios_mes`, `devolucion_baja_config`, `equipo_gimnasio`, `linea_de_control`, `moderacion_control`, `soportes_del_gimnasio` | `/panel/control/exportar` `/panel/entrada/control` `/panel/equipo/actividad` `/panel/socios/` |
| `/panel/control/exportar` | acción (POST/GET) |  |  | `linea_de_control` |  |
| `/panel/cuenta` | pantalla |  |  | `ayudas_vistas`, `guardar_tema_usuario`, `mi_liquidacion`, `mi_seguridad`, `mi_tema` | `/panel/pin` |
| `/panel/cupones` | pantalla | 👑 🧭 |  | `cupones_panel`, `desactivar_cupon`, `guardar_cupon`, `planes_gimnasio` |  |
| `/panel/datos-personales` | pantalla | 👑 🧭 |  | `guardar_politica_privacidad`, `pedidos_datos_panel`, `politica_privacidad_propia`, `resolver_pedido_datos` |  |
| `/panel/documentos` | pantalla | 👑 🧭 |  | `archivar_documento`, `documentos_panel`, `firmar_documento`, `firmas_propias_pendientes`, `guardar_documento` | `/panel/socios/` |
| `/panel/entrada` | pantalla | 👑 🧭 🛎️ | entrada | `activar_emergencia_puerta`, `anular_ingreso`, `apto_socio`, `cerrar_emergencia_puerta`, `config_prueba_gratis`, `config_visita`, `confirmar_invitado`, `copia_entrada`, `cupo_dejar_pasar`, `dar_prueba_gratis`, `descongelar`, `documentos_socio`, `entradas_de_emergencia`, `entrar_con_pin`, `estado_acceso`, `estado_emergencia_puerta`, `eventos_del_dia_socio`, `ficha_socio`, `guardar_config_entrada`, `guardar_config_visita`, `guia_entrada`, `habilitar_emergencia_puerta`, `ingresos_del_dia`, `invitados_de_hoy`, `leer_llavero`, `leer_qr`, `pausas_socio`, `prueba_por_dni`, `registrar_ingreso`, `registrar_invitado`, `registrar_salida`, `sincronizar_sin_internet` | `/panel/caja` `/panel/entrada/control` `/panel/socios/` `/panel/socios/nuevo` |
| `/panel/entrada/control` | pantalla | 👑 🧭 | entrada | `alertas_prestamo`, `control_entrada` | `/panel/control` `/panel/socios/` |
| `/panel/entrada/ultimas` | acción (POST/GET) |  |  |  |  |
| `/panel/equipo` | pantalla | 👑 🧭 |  | `cuenta_para_nueva_clave`, `equipo_gimnasio`, `equipo_perfiles`, `guardar_equipo`, `guardar_equipo_ajuste`, `guardar_foto_equipo`, `guardar_perfil_equipo`, `guardar_permisos_equipo`, `permisos_equipo`, `preparar_foto_equipo`, `registrar_clave_entregada` | `/panel/configuracion` `/panel/control` `/panel/equipo/actividad` |
| `/panel/equipo/actividad` | pantalla | 👑 🧭 |  | `actividad_equipo` | `/panel/control` `/panel/equipo` |
| `/panel/eventos` | pantalla | 👑 🧭 🛎️ |  | `cerrar_evento`, `confirmar_foto_producto`, `crear_evento`, `eventos_panel`, `preparar_foto_producto`, `publicar_evento` | `/panel/socios/` `/panel/vender` |
| `/panel/exportar` | acción (POST/GET) |  |  | `exportar_gimnasio` |  |
| `/panel/fichar` | pantalla | 🧭 💪 🛎️ | fichar | `fichar`, `fichar_con_pin`, `mi_fichaje`, `mis_horas` |  |
| `/panel/gastos` | pantalla | 👑 🧭 | gastos | `anular_gasto`, `cargar_gasto`, `comprobante_gasto`, `confirmar_comprobante_gasto`, `ganancia_mes`, `guardar_gasto_fijo`, `guardar_permiso_gastos`, `guardar_presupuesto_gasto`, `preparar_comprobante_gasto`, `terminar_gasto_fijo` | `/panel/gastos/exportar` |
| `/panel/gastos/exportar` | acción (POST/GET) |  |  | `exportar_gastos` |  |
| `/panel/grados` | pantalla |  | clases | `anular_grado_socio`, `archivar_grado`, `grados_panel`, `guardar_grado`, `otorgar_grado` | `/panel/socios/` |
| `/panel/horas` | pantalla | 👑 🧭 |  | `anular_fichaje`, `config_fichaje`, `corregir_fichaje`, `fichajes_persona`, `guardar_config_fichaje`, `horas_equipo` |  |
| `/panel/hoy` | pantalla |  |  |  |  |
| `/panel/incidentes` | pantalla |  | incidentes | `corregir_incidente`, `crear_incidente`, `incidentes_panel` | `/panel/socios/` |
| `/panel/lockers` | pantalla |  | lockers | `alquilar_locker`, `crear_locker`, `crear_lockers_serie`, `dar_de_baja_locker`, `guardar_tarifa_locker`, `liberar_locker`, `lockers_panel`, `renovar_alquiler_locker` | `/panel/socios/` |
| `/panel/maquinas` | pantalla |  | maquinas | `arreglar_falla`, `asignar_responsable_falla`, `confirmar_foto_falla`, `crear_maquina`, `dar_de_baja_maquina`, `foto_falla`, `historial_maquina`, `maquinas_panel`, `preparar_foto_falla`, `reportar_falla` |  |
| `/panel/mensajes` | pantalla | 👑 🧭 🛎️ | mensajes | `bandeja_mensajes`, `cambiar_estado_hilo`, `guardar_permisos_mensajes`, `guardar_respuesta_rapida`, `hilo_mensajes`, `permisos_mensajes`, `quitar_respuesta_rapida`, `responder_mensaje`, `respuestas_rapidas` | `/panel/socios/` |
| `/panel/pagina` | pantalla | 👑 🧭 |  | `altas_panel`, `datos_gimnasio_panel`, `guardar_altas`, `guardar_estilo_pagina`, `guardar_medicion`, `guardar_pagina`, `guardar_prueba_social`, `guardar_video_portada`, `medicion_panel`, `pagina_panel`, `pagina_por_defecto`, `prueba_social_panel` | `/panel/configuracion` |
| `/panel/pin` | pantalla |  |  | `entrar_con_pin`, `guardar_mi_pin`, `operador_actual` | `/panel/cuenta` |
| `/panel/planes` | pantalla | 👑 🧭 |  | `actividades_gimnasio`, `ajustes_planes`, `anular_precio_programado`, `aplicar_aumento`, `asignar_servicio`, `aviso_previo_aumento`, `configurar_stock`, `confirmar_foto_producto`, `confirmar_remito_stock`, `contar_stock`, `convenios_gimnasio`, `entrada_stock`, `guardar_actividades_plan`, `guardar_ajustes_plan`, `guardar_config_aumento`, `guardar_convenio`, `guardar_ficha_producto`, `guardar_matricula_plan`, `guardar_plan`, `guardar_producto`, `guardar_regla_plan`, `guardar_servicio`, `lista_precios_plan`, `movimientos_stock_producto`, `ordenar_planes`, `planes_gimnasio`, `preparar_foto_producto`, `preparar_remito_stock`, `productos_mostrador`, `programar_lista_precios`, `programar_precio`, `quitar_foto_producto`, `remito_stock`, `servicios_gimnasio`, `vista_aumento` | `/panel/cupones` `/panel/planes/aumento` |
| `/panel/planes/aumento` | pantalla | 👑 🧭 |  | `aumentos_hechos`, `config_aumento`, `planes_gimnasio` | `/panel/planes` |
| `/panel/profes` | pantalla | 👑 🧭 |  | `anular_horas_profe`, `anular_pago_profe`, `cargar_horas_profe`, `config_liquidacion`, `guardar_config_liquidacion`, `guardar_regla_profe`, `liquidacion_profe_detalle`, `liquidacion_profes`, `pagar_profe` | `/panel/caja` |
| `/panel/prospectos` | pantalla | 👑 🧭 🛎️ |  | `actualizar_prospecto`, `crear_prospecto`, `invitado_a_interesado`, `prospectos_panel` | `/panel/socios/` `/panel/socios/nuevo` |
| `/panel/pt` | pantalla |  | pt | `agenda_pt`, `cancelar_sesion_pt`, `cargar_franjas_pt`, `guardar_config_pt`, `guardar_pack_pt`, `marcar_sesion_pt`, `pt_socio`, `quitar_franja_pt`, `reservar_sesion_pt` | `/panel/socios/` |
| `/panel/recibo/[venta]` | pantalla | 👑 🧭 🛎️ |  | `recibo_venta` | `/panel` |
| `/panel/resultado` | pantalla | 👑 🧭 |  | `anular_gasto`, `cargar_gasto`, `cupones_panel`, `deuda_con_socios`, `encuestas_panel`, `ganancia_mes`, `motivos_baja_mes`, `repetir_gastos`, `resultado_mes`, `resultado_por_sede`, `retencion_numeros`, `tasa_de_cobro` | `/panel/gastos` `/panel/resultado/exportar` `/panel/socios/` |
| `/panel/resultado/exportar` | acción (POST/GET) |  |  | `exportar_mes` |  |
| `/panel/resumen` | pantalla | 👑 🧭 |  | `resumen_dueno` | `/panel/caja/historial` |
| `/panel/retencion` | pantalla | 👑 🧭 🛎️ | retencion | `etiquetas_gimnasio`, `ex_socios`, `registrar_contacto`, `retencion`, `retencion_numeros`, `retencion_periodo`, `retencion_resumen`, `riesgo_baja`, `socios_con_etiqueta`, `tablero_retencion` |  |
| `/panel/retencion/exportar` | acción (POST/GET) |  |  | `retencion_periodo` |  |
| `/panel/rutinas` | pantalla | 👑 🧭 💪 | rutinas | `archivar_rutina`, `asignar_rutina`, `asignar_rutina_varios`, `copiar_rutina`, `ejercicios_gimnasio`, `guardar_ejercicio`, `guardar_rutina`, `marcar_plantilla`, `rutinas_gimnasio`, `rutinas_progreso_equipo` | `/panel/rutinas/editar` `/panel/rutinas/socio` |
| `/panel/rutinas/editar` | pantalla | 👑 🧭 💪 | rutinas | `ejercicios_gimnasio`, `rutina_detalle`, `rutinas_gimnasio` | `/panel/rutinas` `/panel/rutinas/socio` |
| `/panel/rutinas/socio` | pantalla | 👑 🧭 💪 | rutinas | `progreso_socio`, `rutina_de_socio` | `/panel/rutinas` |
| `/panel/socios` | pantalla | 👑 🧭 🛎️ | socios | `agregar_nota`, `alta_socio_pasado`, `anonimizar_socio`, `anular_apto`, `anular_congelamiento`, `anular_cortesia`, `anular_devolucion`, `asignar_convenio`, `asignar_llavero`, `asignar_plan`, `borrar_nota`, `calcular_devolucion_baja`, `cargar_apto`, `confirmar_foto_socio`, `confirmar_foto_subida`, `congelar`, `cuenta_para_clave_socio`, `dar_cortesia`, `dar_de_baja`, `descongelar`, `ficha_socio`, `fijar_titular_familia`, `guardar_devolucion_baja_modo`, `guardar_motivo_beneficio`, `guardar_socio`, `guardar_topes_beneficios`, `levantar_suspension`, `marcar_no_escribirle`, `motivos_beneficio_gimnasio`, `no_escribirles_de`, `pedir_pausa`, `planes_para_alta`, `poner_etiqueta`, `preparar_foto_socio`, `prospecto_es_socio`, `prospecto_por_dni`, `prospecto_por_telefono`, `quitar_convenio`, `quitar_llavero`, `quitar_titular_familia`, `registrar_clave_entregada`, `registrar_devolucion`, `resolver_pedido_baja`, `resolver_pedido_pausa`, `revisar_suspension`, `sacar_de_familia`, `sacar_etiqueta`, `suspender_socio`, `vincular_familia`, `vista_cambio_plan`, `volver_a_dar_de_alta` | `/panel/socios/` `/panel/socios/duplicados` `/panel/socios/exportar` `/panel/socios/importar` `/panel/socios/nuevo` |
| `/panel/socios/[id]` | pantalla | 👑 🧭 🛎️ | socios | `apto_socio`, `asistencia_socio`, `calcular_devolucion_baja`, `constancia_baja`, `convenio_socio`, `convenios_gimnasio`, `cortesias_socio`, `devoluciones_socio`, `documentos_socio`, `faltas_socio_detalle`, `familia_socio`, `ficha_socio`, `foto_estado_socio`, `foto_socio`, `grados_socio`, `historial_mensajes_socio`, `horarios_para_turno`, `llavero_socio`, `no_escribirle_socio`, `notas_y_etiquetas`, `origen_alta_socio`, `origen_socio`, `pausas_socio`, `pedido_baja_socio`, `plan_familiar_socio`, `planes_gimnasio`, `primer_mes_socio`, `riesgo_baja`, `suspension_socio`, `turnos_socio`, `ventas_socio` | `/panel/entrada` `/panel/mensajes` `/panel/socios` `/panel/socios/` `/panel/tareas` `/panel/vender` |
| `/panel/socios/[id]/editar` | pantalla | 👑 🧭 🛎️ | socios | `ficha_socio` |  |
| `/panel/socios/[id]/foto` | acción (POST/GET) |  |  | `foto_socio` |  |
| `/panel/socios/[id]/reglamento` | pantalla | 👑 🧭 🛎️ | socios | `reglamento_aceptado` | `/panel/socios/` |
| `/panel/socios/duplicados` | pantalla | 👑 🧭 | socios | `posibles_duplicados`, `unir_socios` | `/panel/socios/` |
| `/panel/socios/exportar` | acción (POST/GET) |  |  | `exportar_socios` |  |
| `/panel/socios/importar` | pantalla | 👑 🧭 | socios | `deshacer_importacion`, `importaciones_panel`, `revisar_importacion` | `/panel/socios` |
| `/panel/socios/nuevo` | pantalla | 👑 🧭 🛎️ | socios | `ficha_socio`, `planes_para_alta`, `prospectos_panel` |  |
| `/panel/tareas` | pantalla |  |  | `checklist_hoy`, `crear_tarea`, `ficha_socio`, `guardar_checklist_item`, `guardar_tarea_auto`, `marcar_tarea`, `para_hacer_hoy`, `tareas_auto_config`, `tareas_panel`, `tildar_checklist` | `/panel` `/panel/socios/` |
| `/panel/transferencias` | pantalla | 👑 🧭 🛎️ | transferencias | `aprobar_pago`, `cobradas_en_mostrador`, `estado_pagos_online`, `marcar_transferencia_vista`, `pagos_por_aprobar`, `rechazar_pago` | `/panel/socios/` |
| `/panel/vencen-hoy` | pantalla | 👑 🧭 🛎️ | vencen_hoy |  | `/panel/retencion` |
| `/panel/vender` | pantalla | 👑 🧭 🛎️ | vender | `caja_para_cobrar`, `comprobante_venta`, `contexto_cobro`, `ficha_socio`, `guardar_config_cobro`, `precios_venta`, `registrar_uso_cupon`, `validar_cupon`, `vender` | `/panel/entrada` `/panel/recibo/` `/panel/socios/` |
| `/privacidad` | pantalla |  |  | `politica_privacidad_publica` | `/` |
| `/profe` | acción (POST/GET) |  |  |  |  |
| `/recepcion` | acción (POST/GET) |  |  |  |  |
| `/salir` | acción (POST/GET) |  |  |  |  |
| `/socio` | acción (POST/GET) |  |  |  |  |
| `/super` | acción (POST/GET) |  |  |  |  |
| `/tv` | pantalla |  |  | `tv_estado` |  |
| `/tv/activar` | acción (POST/GET) |  |  |  |  |

## Funciones que ninguna pantalla llama

(Sin base conectada: no se pudo revisar.)
