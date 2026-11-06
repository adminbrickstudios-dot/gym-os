# Mapa de pantallas

**Generado por `node scripts/mapa-pantallas.mjs`** a partir del código: no se edita a mano.
Se vuelve a generar cada vez que una vuelta cambia una pantalla.

Quién la ve: los roles que exige la pantalla (👑 dueño · 🧭 encargado · 🛎️ recepción · 💪 profe); vacío = todo el equipo o lo decide la función de la base.

| Ruta | Tipo | Quién la ve | Se apaga con | Funciones de la base | Lleva a |
|---|---|---|---|---|---|
| `(middleware)` | cada pedido |  |  | `gimnasio_por_host`, `gimnasio_por_slug` |  |
| `/` | pantalla |  |  | `abonar_turno`, `apagar_ayudas`, `borrar_suscripcion_push`, `guardar_suscripcion_push`, `marcar_ayuda`, `quitar_turno`, `registrar_pedido_codigo`, `reiniciar_ayudas`, `socio_para_vincular_google`, `suscripcion_push`, `vincular_google` |  |
| `/admin` | pantalla |  |  | `admin_agregar_dominio`, `admin_agregar_nota`, `admin_agregar_persona`, `admin_anular_pago_brik`, `admin_aplicar_plantilla`, `admin_asignar_plan_brik`, `admin_atender_demo`, `admin_ayudas`, `admin_crear_gimnasio`, `admin_gimnasios`, `admin_guardar_marca`, `admin_guardar_plan_brik`, `admin_metricas`, `admin_novedades`, `admin_pedidos_demo`, `admin_planes_brik`, `admin_publicar_novedad`, `admin_quitar_dominio`, `admin_registrar_pago_brik`, `admin_resolver_ayuda`, `admin_retirar_novedad`, `cuenta_para_nueva_clave`, `mi_sesion`, `persona_para_dar_acceso`, `usuario_por_mail` | `/admin/` `/g/` |
| `/admin/[id]` | pantalla |  |  | `admin_gimnasio`, `admin_notas`, `admin_planes_brik`, `admin_soportes`, `admin_uso_semanal`, `historial_configuracion` | `/admin` `/g/` |
| `/admin/entrar` | acción (POST/GET) |  |  | `admin_entrar_gimnasio` |  |
| `/admin/salir-gimnasio` | acción (POST/GET) |  |  | `admin_salir_gimnasio` |  |
| `/api/webhooks/mercadopago` | acción (POST/GET) |  |  | `cerrar_evento_webhook`, `credenciales_mp`, `registrar_evento_webhook` |  |
| `/app` | pantalla |  |  | `anotar_ejercicio`, `campana_socio`, `cancelar_inscripcion_evento`, `cancelar_reserva`, `constancia_baja`, `credenciales_mp`, `documentos_socio`, `elegir_lugar`, `encuesta_socio`, `entrar_por_qr_pared`, `eventos_socio`, `grados_socio`, `informar_compra_app`, `informar_transferencia`, `iniciar_compra_online`, `iniciar_pago_online`, `inscribirse_evento`, `invitar`, `marcar_aviso_leido`, `marcar_bienvenida`, `mi_link_referido`, `mi_qr`, `mis_avisos`, `mis_invitados`, `novedades_socio`, `pago_online`, `pago_online_disponible`, `pedir_baja_socio`, `pedir_pausa_socio`, `pestanas_app`, `progreso_inicio`, `reservar`, `responder_encuesta`, `rutina_de_socio`, `usa_qr_pared`, `vista_compra_app` | `/app/clases` `/app/novedades` `/app/rutina` |
| `/app/clases` | pantalla |  |  | `avisos_lugar_socio`, `clases_del_dia`, `horarios_para_turno`, `lugares_clase`, `politica_reservas`, `profes_de_clases`, `turnos_socio`, `wods_socio` | `/app` `/app/yo` |
| `/app/cuenta` | pantalla |  |  | `mi_seguridad`, `pedido_baja_socio` | `/app` `/app/mis-datos` |
| `/app/historial` | pantalla |  |  | `mi_historial` | `/app` |
| `/app/mensajes` | pantalla |  |  | `escribir_al_gimnasio`, `mensajes_estado_socio`, `mis_mensajes`, `responder_hilo_socio` | `/app` `/app/mensajes/` `/app/mensajes/nuevo` `/app/yo` |
| `/app/mensajes/[id]` | pantalla |  |  | `mi_hilo` | `/app` `/app/mensajes` |
| `/app/mensajes/nuevo` | pantalla |  |  | `mensajes_estado_socio` | `/app` `/app/mensajes` |
| `/app/mis-datos` | acción (POST/GET) |  |  | `mis_datos` |  |
| `/app/novedades` | pantalla |  |  | `campana_socio`, `leer_campana`, `mensajes_estado_socio` | `/app` `/app/mensajes` |
| `/app/pago` | pantalla |  |  | `pago_online`, `pago_online_revisable` |  |
| `/app/plan` | pantalla |  |  | `opciones_compra_app` | `/app` `/app/yo` |
| `/app/rutina` | pantalla |  |  | `progreso_socio`, `rutina_de_socio` | `/app` |
| `/app/yo` | pantalla |  |  | `mensajes_estado_socio`, `mi_link_referido`, `mis_invitados`, `opciones_compra_app` | `/app` `/app/mis-datos` |
| `/auth/callback` | acción (POST/GET) |  |  | `entrar_con_google`, `mi_sesion` |  |
| `/auth/google` | acción (POST/GET) |  |  |  |  |
| `/auth/vincular` | pantalla |  |  | `mi_sesion` | `/ingresar` |
| `/elegir` | pantalla |  |  | `mi_sesion` | `/admin` `/entrar/` `/g/` |
| `/entrar/[slug]` | acción (POST/GET) |  |  | `mi_sesion` |  |
| `/foto-equipo/[id]` | acción (POST/GET) |  |  | `foto_equipo` |  |
| `/gimnasio-no-encontrado` | pantalla |  |  |  |  |
| `/hacete-socio` | pantalla |  |  | `alta_online`, `alta_publica` | `/` `/ingresar` |
| `/ingresar` | pantalla |  |  | `mi_sesion`, `registrar_pedido_codigo`, `telefono_para_ingresar`, `vincular_socios_por_email`, `vincular_socios_por_telefono` | `/auth/google` `/hacete-socio` |
| `/ingresar/recuperar` | pantalla |  |  |  | `/ingresar` |
| `/kiosco` | pantalla |  |  | `kiosco_emergencia`, `kiosco_entrar`, `kiosco_entrar_habitual`, `kiosco_estado`, `kiosco_habituales`, `kiosco_qr`, `kiosco_ultimo` |  |
| `/kiosco/activar` | acción (POST/GET) |  |  |  |  |
| `/panel` | pantalla |  |  | `anular_venta_panel`, `borrar_socios_ejemplo`, `buscar_socios`, `cargar_socios_ejemplo`, `cerrar_novedad_plataforma`, `config_entrada`, `dar_de_baja_equipo`, `estado_abono_panel`, `estado_soporte`, `formas_de_entrada`, `guardar_accesos_rapidos`, `guardar_numeros_inicio`, `marcar_alertas_vistas`, `ocultar_primeros_pasos`, `pedir_anulacion`, `pedir_ayuda_brik`, `pendientes_panel`, `registrar_sesion_equipo`, `resolver_pedido_anulacion`, `ultimas_entradas` | `/elegir` `/panel/caja` `/panel/entrada/control` `/panel/planes` `/panel/resumen` `/panel/socios/` `/panel/tareas` |
| `/panel/avisos` | pantalla | 👑 🧭 🛎️ |  | `bandeja_avisos`, `marcar_avisado`, `novedades_panel`, `publicar_novedad`, `quitar_novedad` | `/panel/socios/` |
| `/panel/caja` | pantalla | 👑 🧭 🛎️ | caja | `abrir_caja`, `cajas_para_revisar`, `cerrar_caja`, `confirmar_ticket`, `contar_caja_sin_contar`, `dejar_caja_sin_contar`, `guardar_config_caja`, `movimiento_caja`, `preparar_ticket`, `ticket_movimiento` | `/panel/caja/historial` `/panel/caja/reporte` |
| `/panel/caja/historial` | pantalla | 👑 🧭 | caja | `historial_caja` | `/panel/caja/reporte` |
| `/panel/caja/reporte` | pantalla | 👑 🧭 🛎️ | caja | `reporte_dia`, `reporte_turno` | `/panel/caja` |
| `/panel/campana` | pantalla |  |  | `campana_panel`, `guardar_preferencia_aviso`, `leer_campana`, `preferencias_aviso_panel` | `/panel/cuenta` |
| `/panel/clases` | pantalla |  | clases | `anular_presente`, `avisar_clase`, `cancelar_clase`, `clases_del_dia`, `crear_tv`, `guardar_lugares`, `guardar_wod`, `reemplazar_profe`, `reservar`, `revocar_tv`, `tomar_asistencia` | `/panel/clases/` `/panel/clases/grilla` `/panel/clases/tv` `/panel/grados` |
| `/panel/clases/[id]` | pantalla |  | clases | `avisos_clase`, `clase_detalle`, `equipo_gimnasio`, `faltas_clase`, `lista_clase`, `reemplazos_clase` | `/panel/clases` |
| `/panel/clases/grilla` | pantalla | 👑 🧭 | clases | `actividades_gimnasio`, `agregar_horario`, `cerrar_horario`, `editar_horario`, `equipo_gimnasio`, `guardar_actividad`, `horarios_gimnasio`, `ocupacion_horarios` | `/panel/clases` |
| `/panel/clases/tv` | pantalla | 👑 🧭 | clases | `tvs_panel` |  |
| `/panel/configuracion` | pantalla | 👑 🧭 |  | `anular_cierre`, `autorizar_tablet`, `autoservicio_panel`, `cierres_panel`, `config_caja`, `config_dejar_pasar`, `config_entrada`, `config_turnos_fijos`, `configuracion_panel`, `confirmar_imagen_marca`, `crear_cierre`, `datos_gimnasio_panel`, `encuestas_panel`, `estado_pagos_online`, `guardar_compras_app`, `guardar_config_dejar_pasar`, `guardar_configuracion`, `guardar_datos_gimnasio`, `guardar_horarios_apertura`, `guardar_link_resena`, `guardar_mensaje`, `guardar_mercadopago`, `guardar_meta_visitas`, `guardar_plan_familiar`, `guardar_registro_socios`, `guardar_regla_plan`, `guardar_regla_vencimiento`, `guardar_turnos_fijos`, `historial_configuracion`, `horarios_apertura_panel`, `mensajes_panel`, `meta_visitas_panel`, `ordenar_fotos`, `plan_familiar_estado`, `preparar_imagen_marca`, `publicar_pagina`, `quitar_imagen_marca`, `quitar_mercadopago`, `reglas_vencimiento`, `restaurar_mensaje`, `revocar_tablet`, `simular_cuota`, `sumar_sede`, `tablets_panel`, `vista_previa_mensaje` | `/panel/documentos` `/panel/exportar` `/panel/pagina` `/panel/socios` |
| `/panel/control` | pantalla | 👑 🧭 | control | `beneficios_mes`, `devolucion_baja_config`, `equipo_gimnasio`, `linea_de_control`, `moderacion_control`, `soportes_del_gimnasio` | `/panel/control/exportar` `/panel/entrada/control` `/panel/equipo/actividad` |
| `/panel/control/exportar` | acción (POST/GET) |  |  | `linea_de_control` |  |
| `/panel/cuenta` | pantalla |  |  | `ayudas_vistas`, `mi_seguridad` | `/panel/pin` |
| `/panel/cupones` | pantalla | 👑 🧭 |  | `cupones_panel`, `desactivar_cupon`, `guardar_cupon`, `planes_gimnasio` |  |
| `/panel/documentos` | pantalla | 👑 🧭 |  | `archivar_documento`, `documentos_panel`, `firmar_documento`, `firmas_propias_pendientes`, `guardar_documento` | `/panel/socios/` |
| `/panel/entrada` | pantalla | 👑 🧭 🛎️ | entrada | `activar_emergencia_puerta`, `anular_ingreso`, `apto_socio`, `cerrar_emergencia_puerta`, `config_visita`, `confirmar_invitado`, `copia_entrada`, `cupo_dejar_pasar`, `descongelar`, `documentos_socio`, `entradas_de_emergencia`, `entrar_con_pin`, `estado_acceso`, `estado_emergencia_puerta`, `eventos_del_dia_socio`, `guardar_config_entrada`, `guardar_config_visita`, `guia_entrada`, `habilitar_emergencia_puerta`, `ingresos_del_dia`, `invitados_de_hoy`, `leer_llavero`, `leer_qr`, `pausas_socio`, `registrar_ingreso`, `registrar_invitado`, `sincronizar_sin_internet` | `/panel/caja` `/panel/entrada/control` `/panel/socios/` `/panel/socios/nuevo` |
| `/panel/entrada/control` | pantalla | 👑 🧭 | entrada | `alertas_prestamo`, `control_entrada` | `/panel/control` `/panel/socios/` |
| `/panel/entrada/ultimas` | acción (POST/GET) |  |  |  |  |
| `/panel/equipo` | pantalla | 👑 🧭 |  | `equipo_gimnasio`, `equipo_perfiles`, `guardar_equipo`, `guardar_equipo_ajuste`, `guardar_foto_equipo`, `guardar_perfil_equipo`, `guardar_permisos_equipo`, `permisos_equipo`, `preparar_foto_equipo` | `/panel/configuracion` `/panel/control` `/panel/equipo/actividad` |
| `/panel/equipo/actividad` | pantalla | 👑 🧭 |  | `actividad_equipo` | `/panel/control` `/panel/equipo` |
| `/panel/eventos` | pantalla | 👑 🧭 🛎️ |  | `cerrar_evento`, `confirmar_foto_producto`, `crear_evento`, `eventos_panel`, `preparar_foto_producto`, `publicar_evento` | `/panel/socios/` `/panel/vender` |
| `/panel/exportar` | acción (POST/GET) |  |  | `exportar_gimnasio` |  |
| `/panel/gastos` | pantalla | 👑 🧭 | gastos | `anular_gasto`, `cargar_gasto`, `comprobante_gasto`, `confirmar_comprobante_gasto`, `ganancia_mes`, `guardar_gasto_fijo`, `guardar_permiso_gastos`, `guardar_presupuesto_gasto`, `preparar_comprobante_gasto`, `terminar_gasto_fijo` | `/panel/gastos/exportar` |
| `/panel/gastos/exportar` | acción (POST/GET) |  |  | `exportar_gastos` |  |
| `/panel/grados` | pantalla |  | clases | `anular_grado_socio`, `archivar_grado`, `grados_panel`, `guardar_grado`, `otorgar_grado` | `/panel/socios/` |
| `/panel/hoy` | pantalla |  |  |  |  |
| `/panel/incidentes` | pantalla |  | incidentes | `corregir_incidente`, `crear_incidente`, `incidentes_panel` | `/panel/socios/` |
| `/panel/mensajes` | pantalla | 👑 🧭 🛎️ | mensajes | `bandeja_mensajes`, `cambiar_estado_hilo`, `guardar_permisos_mensajes`, `guardar_respuesta_rapida`, `hilo_mensajes`, `permisos_mensajes`, `quitar_respuesta_rapida`, `responder_mensaje`, `respuestas_rapidas` | `/panel/socios/` |
| `/panel/pagina` | pantalla | 👑 🧭 |  | `altas_panel`, `guardar_altas`, `guardar_medicion`, `guardar_pagina`, `guardar_prueba_social`, `medicion_panel`, `pagina_panel`, `prueba_social_panel` | `/panel/configuracion` |
| `/panel/pin` | pantalla |  |  | `entrar_con_pin`, `guardar_mi_pin`, `operador_actual` | `/panel/cuenta` |
| `/panel/planes` | pantalla | 👑 🧭 |  | `actividades_gimnasio`, `ajustes_planes`, `anular_precio_programado`, `aplicar_aumento`, `asignar_servicio`, `aviso_previo_aumento`, `configurar_stock`, `confirmar_foto_producto`, `confirmar_remito_stock`, `contar_stock`, `convenios_gimnasio`, `entrada_stock`, `guardar_actividades_plan`, `guardar_ajustes_plan`, `guardar_config_aumento`, `guardar_convenio`, `guardar_ficha_producto`, `guardar_matricula_plan`, `guardar_plan`, `guardar_producto`, `guardar_regla_plan`, `guardar_servicio`, `lista_precios_plan`, `movimientos_stock_producto`, `ordenar_planes`, `planes_gimnasio`, `preparar_foto_producto`, `preparar_remito_stock`, `productos_mostrador`, `programar_lista_precios`, `programar_precio`, `quitar_foto_producto`, `remito_stock`, `servicios_gimnasio`, `vista_aumento` | `/panel/cupones` `/panel/planes/aumento` |
| `/panel/planes/aumento` | pantalla | 👑 🧭 |  | `aumentos_hechos`, `config_aumento`, `planes_gimnasio` | `/panel/planes` |
| `/panel/prospectos` | pantalla | 👑 🧭 🛎️ |  | `actualizar_prospecto`, `crear_prospecto`, `prospectos_panel` | `/panel/socios/` `/panel/socios/nuevo` |
| `/panel/resultado` | pantalla | 👑 🧭 |  | `anular_gasto`, `cargar_gasto`, `cupones_panel`, `deuda_con_socios`, `encuestas_panel`, `ganancia_mes`, `motivos_baja_mes`, `repetir_gastos`, `resultado_mes`, `resultado_por_sede`, `retencion_numeros` | `/panel/gastos` `/panel/resultado/exportar` `/panel/socios/` |
| `/panel/resultado/exportar` | acción (POST/GET) |  |  | `exportar_mes` |  |
| `/panel/resumen` | pantalla | 👑 🧭 |  | `resumen_dueno` | `/panel/caja/historial` |
| `/panel/retencion` | pantalla | 👑 🧭 🛎️ | retencion | `etiquetas_gimnasio`, `ex_socios`, `registrar_contacto`, `retencion`, `retencion_numeros`, `retencion_periodo`, `retencion_resumen`, `riesgo_baja`, `socios_con_etiqueta`, `tablero_retencion` |  |
| `/panel/retencion/exportar` | acción (POST/GET) |  |  | `retencion_periodo` |  |
| `/panel/rutinas` | pantalla | 👑 🧭 💪 | rutinas | `archivar_rutina`, `asignar_rutina`, `asignar_rutina_varios`, `copiar_rutina`, `ejercicios_gimnasio`, `guardar_ejercicio`, `guardar_rutina`, `marcar_plantilla`, `rutinas_gimnasio`, `rutinas_progreso_equipo` | `/panel/rutinas/editar` `/panel/rutinas/socio` |
| `/panel/rutinas/editar` | pantalla | 👑 🧭 💪 | rutinas | `ejercicios_gimnasio`, `rutina_detalle`, `rutinas_gimnasio` | `/panel/rutinas` `/panel/rutinas/socio` |
| `/panel/rutinas/socio` | pantalla | 👑 🧭 💪 | rutinas | `progreso_socio`, `rutina_de_socio` | `/panel/rutinas` |
| `/panel/socios` | pantalla | 👑 🧭 🛎️ | socios | `agregar_nota`, `anonimizar_socio`, `anular_apto`, `anular_congelamiento`, `anular_cortesia`, `anular_devolucion`, `asignar_convenio`, `asignar_llavero`, `asignar_plan`, `borrar_nota`, `calcular_devolucion_baja`, `cargar_apto`, `confirmar_foto_socio`, `congelar`, `dar_cortesia`, `dar_de_baja`, `descongelar`, `ficha_socio`, `fijar_titular_familia`, `guardar_devolucion_baja_modo`, `guardar_motivo_beneficio`, `guardar_socio`, `guardar_topes_beneficios`, `levantar_suspension`, `marcar_no_escribirle`, `motivos_beneficio_gimnasio`, `pedir_pausa`, `planes_para_alta`, `poner_etiqueta`, `preparar_foto_socio`, `prospecto_es_socio`, `prospecto_por_dni`, `prospecto_por_telefono`, `quitar_convenio`, `quitar_llavero`, `quitar_titular_familia`, `registrar_devolucion`, `resolver_pedido_baja`, `resolver_pedido_pausa`, `revisar_suspension`, `sacar_de_familia`, `sacar_etiqueta`, `suspender_socio`, `vincular_familia`, `vista_cambio_plan`, `volver_a_dar_de_alta` | `/panel/socios/` `/panel/socios/duplicados` `/panel/socios/exportar` `/panel/socios/importar` `/panel/socios/nuevo` |
| `/panel/socios/[id]` | pantalla | 👑 🧭 🛎️ | socios | `apto_socio`, `asistencia_socio`, `calcular_devolucion_baja`, `constancia_baja`, `convenio_socio`, `convenios_gimnasio`, `cortesias_socio`, `devoluciones_socio`, `documentos_socio`, `faltas_socio_detalle`, `familia_socio`, `ficha_socio`, `foto_socio`, `grados_socio`, `historial_mensajes_socio`, `horarios_para_turno`, `llavero_socio`, `no_escribirle_socio`, `notas_y_etiquetas`, `origen_socio`, `pausas_socio`, `pedido_baja_socio`, `plan_familiar_socio`, `planes_gimnasio`, `primer_mes_socio`, `riesgo_baja`, `suspension_socio`, `turnos_socio`, `ventas_socio` | `/panel/entrada` `/panel/mensajes` `/panel/socios` `/panel/socios/` `/panel/tareas` `/panel/vender` |
| `/panel/socios/[id]/editar` | pantalla | 👑 🧭 🛎️ | socios | `ficha_socio` |  |
| `/panel/socios/[id]/foto` | acción (POST/GET) |  |  | `foto_socio` |  |
| `/panel/socios/[id]/reglamento` | pantalla | 👑 🧭 🛎️ | socios | `reglamento_aceptado` | `/panel/socios/` |
| `/panel/socios/duplicados` | pantalla | 👑 🧭 | socios | `posibles_duplicados`, `unir_socios` | `/panel/socios/` |
| `/panel/socios/exportar` | acción (POST/GET) |  |  | `exportar_socios` |  |
| `/panel/socios/importar` | pantalla | 👑 🧭 | socios | `deshacer_importacion`, `importaciones_panel`, `importar_socios`, `revisar_importacion` | `/panel/socios` |
| `/panel/socios/nuevo` | pantalla | 👑 🧭 🛎️ | socios | `ficha_socio`, `planes_para_alta`, `prospectos_panel` |  |
| `/panel/tareas` | pantalla |  |  | `checklist_hoy`, `crear_tarea`, `ficha_socio`, `guardar_checklist_item`, `guardar_tarea_auto`, `marcar_tarea`, `para_hacer_hoy`, `tareas_auto_config`, `tareas_panel`, `tildar_checklist` | `/panel` `/panel/socios/` |
| `/panel/transferencias` | pantalla | 👑 🧭 🛎️ | transferencias | `aprobar_pago`, `estado_pagos_online`, `pagos_por_aprobar`, `rechazar_pago` | `/panel/socios/` |
| `/panel/vencen-hoy` | pantalla | 👑 🧭 🛎️ | vencen_hoy |  | `/panel/retencion` |
| `/panel/vender` | pantalla | 👑 🧭 🛎️ | vender | `cajas_sede`, `comprobante_venta`, `contexto_cobro`, `ficha_socio`, `guardar_config_cobro`, `precios_venta`, `registrar_uso_cupon`, `validar_cupon`, `vender` | `/panel/caja` `/panel/entrada` `/panel/socios/` `/panel/socios/nuevo` |
| `/salir` | acción (POST/GET) |  |  |  |  |
| `/tv` | pantalla |  |  | `tv_estado` |  |
| `/tv/activar` | acción (POST/GET) |  |  |  |  |

## Funciones que ninguna pantalla llama

(Sin base conectada: no se pudo revisar.)
