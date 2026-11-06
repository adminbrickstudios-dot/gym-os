# Mapa de pantallas

**Generado por `node scripts/mapa-pantallas.mjs`** a partir del código: no se edita a mano.
Se vuelve a generar cada vez que una vuelta cambia una pantalla.

Quién la ve: los roles que exige la pantalla (👑 dueño · 🧭 encargado · 🛎️ recepción · 💪 profe); vacío = todo el equipo o lo decide la función de la base.

| Ruta | Tipo | Quién la ve | Se apaga con | Funciones de la base | Lleva a |
|---|---|---|---|---|---|
| `(middleware)` | cada pedido |  |  | `gimnasio_por_host`, `gimnasio_por_slug` |  |
| `/` | pantalla |  |  | `abonar_turno`, `borrar_suscripcion_push`, `guardar_suscripcion_push`, `quitar_turno`, `suscripcion_push` | `/ingresar` |
| `/admin` | pantalla |  |  | `admin_agregar_dominio`, `admin_agregar_persona`, `admin_anular_pago_brik`, `admin_aplicar_plantilla`, `admin_asignar_plan_brik`, `admin_crear_gimnasio`, `admin_gimnasios`, `admin_guardar_plan_brik`, `admin_novedades`, `admin_planes_brik`, `admin_publicar_novedad`, `admin_quitar_dominio`, `admin_registrar_pago_brik`, `admin_retirar_novedad`, `cuenta_para_nueva_clave`, `mi_sesion`, `persona_para_dar_acceso`, `usuario_por_mail` | `/admin/` `/g/` |
| `/admin/[id]` | pantalla |  |  | `admin_gimnasio`, `admin_planes_brik`, `historial_configuracion` | `/admin` `/g/` |
| `/admin/entrar` | acción (POST/GET) |  |  | `admin_entrar_gimnasio` |  |
| `/admin/salir-gimnasio` | acción (POST/GET) |  |  | `admin_salir_gimnasio` |  |
| `/api/webhooks/mercadopago` | acción (POST/GET) |  |  | `acreditar_pago_mp`, `cerrar_evento_webhook`, `credenciales_mp`, `registrar_evento_webhook` |  |
| `/app` | pantalla |  |  | `anotar_ejercicio`, `campana_socio`, `cancelar_reserva`, `credenciales_mp`, `documentos_socio`, `elegir_lugar`, `encuesta_socio`, `entrar_por_qr_pared`, `eventos_socio`, `grados_socio`, `informar_transferencia`, `iniciar_pago_online`, `invitar`, `marcar_bienvenida`, `mi_link_referido`, `mi_qr`, `mis_invitados`, `novedades_socio`, `pago_online`, `pago_online_disponible`, `pedir_baja_socio`, `pedir_pausa_socio`, `pestanas_app`, `progreso_inicio`, `reservar`, `responder_encuesta`, `rutina_de_socio`, `usa_qr_pared` | `/app/clases` `/app/novedades` `/app/rutina` |
| `/app/clases` | pantalla |  |  | `clases_del_dia`, `horarios_para_turno`, `lugares_clase`, `politica_reservas`, `turnos_socio`, `wods_socio` | `/app` |
| `/app/cuenta` | pantalla |  |  | `mi_seguridad`, `pedido_baja_socio` | `/app` `/app/mis-datos` |
| `/app/historial` | pantalla |  |  | `mi_historial` | `/app` |
| `/app/mis-datos` | acción (POST/GET) |  |  | `mis_datos` |  |
| `/app/novedades` | pantalla |  |  | `campana_socio`, `leer_campana` | `/app` |
| `/app/pago` | pantalla |  |  | `pago_online` |  |
| `/app/rutina` | pantalla |  |  | `progreso_socio`, `rutina_de_socio` | `/app` |
| `/app/yo` | pantalla |  |  | `mi_link_referido`, `mis_invitados` | `/app` `/app/mis-datos` |
| `/elegir` | pantalla |  |  | `mi_sesion` | `/admin` `/entrar/` `/g/` |
| `/entrar/[slug]` | acción (POST/GET) |  |  | `mi_sesion` |  |
| `/gimnasio-no-encontrado` | pantalla |  |  |  |  |
| `/hacete-socio` | pantalla |  |  | `alta_online`, `alta_publica` | `/` `/ingresar` |
| `/ingresar` | pantalla |  |  | `mi_sesion`, `registrar_pedido_codigo`, `telefono_para_ingresar`, `vincular_socios_por_email`, `vincular_socios_por_telefono` |  |
| `/ingresar/recuperar` | pantalla |  |  |  | `/ingresar` |
| `/kiosco` | pantalla |  |  | `kiosco_entrar`, `kiosco_entrar_habitual`, `kiosco_estado`, `kiosco_habituales`, `kiosco_qr`, `kiosco_ultimo` |  |
| `/kiosco/activar` | acción (POST/GET) |  |  |  |  |
| `/panel` | pantalla |  |  | `anular_venta_panel`, `buscar_socios`, `cerrar_novedad_plataforma`, `config_entrada`, `estado_abono_panel`, `formas_de_entrada`, `guardar_accesos_rapidos`, `guardar_numeros_inicio`, `ocultar_primeros_pasos`, `pedir_anulacion`, `resolver_pedido_anulacion`, `ultimas_entradas` | `/elegir` `/panel/caja` `/panel/entrada/control` `/panel/planes` `/panel/resumen` `/panel/socios/` `/panel/tareas` |
| `/panel/avisos` | pantalla | 👑 🧭 🛎️ |  | `bandeja_avisos`, `marcar_avisado`, `novedades_panel`, `publicar_novedad`, `quitar_novedad` | `/panel/socios/` |
| `/panel/caja` | pantalla | 👑 🧭 🛎️ | caja | `abrir_caja`, `cerrar_caja`, `confirmar_ticket`, `movimiento_caja`, `preparar_ticket`, `ticket_movimiento` | `/panel/caja/historial` |
| `/panel/caja/historial` | pantalla | 👑 🧭 | caja | `historial_caja` |  |
| `/panel/campana` | pantalla |  |  | `campana`, `leer_campana` |  |
| `/panel/clases` | pantalla |  | clases | `anular_presente`, `avisar_clase`, `cancelar_clase`, `clases_del_dia`, `crear_tv`, `guardar_lugares`, `guardar_wod`, `reservar`, `revocar_tv`, `tomar_asistencia` | `/panel/clases/` `/panel/clases/grilla` `/panel/clases/tv` `/panel/grados` |
| `/panel/clases/[id]` | pantalla |  | clases | `avisos_clase`, `clase_detalle`, `lista_clase` | `/panel/clases` |
| `/panel/clases/grilla` | pantalla | 👑 🧭 | clases | `actividades_gimnasio`, `agregar_horario`, `cerrar_horario`, `editar_horario`, `equipo_gimnasio`, `guardar_actividad`, `horarios_gimnasio`, `ocupacion_horarios` | `/panel/clases` |
| `/panel/clases/tv` | pantalla | 👑 🧭 | clases | `tvs_panel` |  |
| `/panel/configuracion` | pantalla | 👑 🧭 |  | `anular_cierre`, `autorizar_tablet`, `cierres_panel`, `config_dejar_pasar`, `config_entrada`, `config_turnos_fijos`, `configuracion_panel`, `confirmar_imagen_marca`, `crear_cierre`, `datos_gimnasio_panel`, `encuestas_panel`, `estado_pagos_online`, `guardar_config_dejar_pasar`, `guardar_configuracion`, `guardar_datos_gimnasio`, `guardar_horarios_apertura`, `guardar_link_resena`, `guardar_mensaje`, `guardar_mercadopago`, `guardar_meta_visitas`, `guardar_regla_plan`, `guardar_regla_vencimiento`, `guardar_turnos_fijos`, `historial_configuracion`, `horarios_apertura_panel`, `mensajes_panel`, `meta_visitas_panel`, `ordenar_fotos`, `preparar_imagen_marca`, `publicar_pagina`, `quitar_imagen_marca`, `quitar_mercadopago`, `reglas_vencimiento`, `restaurar_mensaje`, `revocar_tablet`, `simular_cuota`, `sumar_sede`, `tablets_panel`, `vista_previa_mensaje` | `/panel/documentos` `/panel/exportar` `/panel/pagina` |
| `/panel/cuenta` | pantalla |  |  | `mi_seguridad` | `/panel/pin` |
| `/panel/cupones` | pantalla | 👑 🧭 |  | `cupones_panel`, `desactivar_cupon`, `guardar_cupon`, `planes_gimnasio` |  |
| `/panel/documentos` | pantalla | 👑 🧭 |  | `archivar_documento`, `documentos_panel`, `firmar_documento`, `guardar_documento` |  |
| `/panel/entrada` | pantalla | 👑 🧭 🛎️ | entrada | `anular_ingreso`, `apto_socio`, `confirmar_invitado`, `copia_entrada`, `cupo_dejar_pasar`, `descongelar`, `documentos_socio`, `entrar_con_pin`, `estado_acceso`, `guardar_config_entrada`, `guia_entrada`, `ingresos_del_dia`, `invitados_de_hoy`, `leer_llavero`, `leer_qr`, `pausas_socio`, `registrar_ingreso`, `registrar_invitado`, `sincronizar_sin_internet` | `/panel/entrada/control` `/panel/socios/` `/panel/socios/nuevo` |
| `/panel/entrada/control` | pantalla | 👑 🧭 | entrada | `control_entrada` | `/panel/socios/` |
| `/panel/equipo` | pantalla | 👑 🧭 |  | `equipo_gimnasio`, `guardar_equipo`, `guardar_permisos_equipo`, `permisos_equipo` | `/panel/configuracion` `/panel/equipo/actividad` |
| `/panel/equipo/actividad` | pantalla | 👑 🧭 |  | `actividad_equipo` | `/panel/equipo` |
| `/panel/eventos` | pantalla | 👑 🧭 🛎️ |  | `cerrar_evento`, `crear_evento`, `eventos_panel` | `/panel/socios/` `/panel/vender` |
| `/panel/exportar` | acción (POST/GET) |  |  | `exportar_gimnasio` |  |
| `/panel/grados` | pantalla |  | clases | `anular_grado_socio`, `archivar_grado`, `grados_panel`, `guardar_grado`, `otorgar_grado` | `/panel/socios/` |
| `/panel/pagina` | pantalla | 👑 🧭 |  | `altas_panel`, `guardar_altas`, `guardar_medicion`, `guardar_pagina`, `medicion_panel`, `pagina_panel` | `/panel/configuracion` |
| `/panel/pin` | pantalla |  |  | `entrar_con_pin`, `guardar_mi_pin`, `operador_actual` | `/panel/cuenta` |
| `/panel/planes` | pantalla | 👑 🧭 |  | `actividades_gimnasio`, `anular_precio_programado`, `aplicar_aumento`, `configurar_stock`, `contar_stock`, `convenios_gimnasio`, `guardar_actividades_plan`, `guardar_convenio`, `guardar_matricula_plan`, `guardar_plan`, `guardar_producto`, `lista_precios_plan`, `planes_gimnasio`, `productos_gimnasio`, `programar_lista_precios`, `programar_precio`, `vista_aumento` | `/panel/cupones` `/panel/planes/aumento` |
| `/panel/planes/aumento` | pantalla | 👑 🧭 |  | `planes_gimnasio` | `/panel/planes` |
| `/panel/prospectos` | pantalla | 👑 🧭 🛎️ |  | `actualizar_prospecto`, `crear_prospecto`, `prospectos_panel` | `/panel/socios/` `/panel/socios/nuevo` |
| `/panel/resultado` | pantalla | 👑 🧭 |  | `cupones_panel`, `encuestas_panel`, `gastos_mes`, `guardar_gasto`, `motivos_baja_mes`, `quitar_gasto`, `repetir_gastos`, `resultado_mes`, `retencion_numeros` | `/panel/resultado/exportar` `/panel/socios/` |
| `/panel/resultado/exportar` | acción (POST/GET) |  |  | `exportar_mes` |  |
| `/panel/resumen` | pantalla | 👑 🧭 |  | `resumen_dueno` | `/panel/caja/historial` |
| `/panel/retencion` | pantalla | 👑 🧭 🛎️ | retencion | `etiquetas_gimnasio`, `registrar_contacto`, `retencion`, `retencion_numeros`, `retencion_resumen`, `riesgo_baja`, `socios_con_etiqueta`, `tablero_retencion` |  |
| `/panel/rutinas` | pantalla | 👑 🧭 💪 | rutinas | `archivar_rutina`, `asignar_rutina`, `ejercicios_gimnasio`, `guardar_ejercicio`, `guardar_rutina`, `rutinas_gimnasio` | `/panel/rutinas/editar` |
| `/panel/rutinas/editar` | pantalla | 👑 🧭 💪 | rutinas | `ejercicios_gimnasio`, `rutina_detalle` | `/panel/rutinas` `/panel/rutinas/socio` |
| `/panel/rutinas/socio` | pantalla | 👑 🧭 💪 | rutinas | `progreso_socio`, `rutina_de_socio` | `/panel/rutinas` |
| `/panel/socios` | pantalla | 👑 🧭 🛎️ | socios | `agregar_nota`, `anonimizar_socio`, `anular_apto`, `anular_congelamiento`, `asignar_convenio`, `asignar_llavero`, `asignar_plan`, `borrar_nota`, `cargar_apto`, `confirmar_foto_socio`, `congelar`, `dar_de_baja`, `descongelar`, `ficha_socio`, `guardar_socio`, `pedir_pausa`, `planes_para_alta`, `poner_etiqueta`, `preparar_foto_socio`, `prospecto_es_socio`, `prospecto_por_telefono`, `quitar_convenio`, `quitar_llavero`, `resolver_pedido_baja`, `resolver_pedido_pausa`, `sacar_de_familia`, `sacar_etiqueta`, `vincular_familia`, `vista_cambio_plan`, `volver_a_dar_de_alta` | `/panel/socios/` `/panel/socios/duplicados` `/panel/socios/exportar` `/panel/socios/importar` `/panel/socios/nuevo` |
| `/panel/socios/[id]` | pantalla | 👑 🧭 🛎️ | socios | `apto_socio`, `asistencia_socio`, `convenio_socio`, `convenios_gimnasio`, `documentos_socio`, `faltas_socio`, `familia_socio`, `ficha_socio`, `foto_socio`, `grados_socio`, `horarios_para_turno`, `llavero_socio`, `notas_y_etiquetas`, `origen_socio`, `pausas_socio`, `pedido_baja_socio`, `planes_gimnasio`, `primer_mes_socio`, `riesgo_baja`, `turnos_socio`, `ventas_socio` | `/panel/socios` `/panel/socios/` `/panel/tareas` `/panel/vender` |
| `/panel/socios/[id]/editar` | pantalla | 👑 🧭 🛎️ | socios | `ficha_socio` |  |
| `/panel/socios/[id]/foto` | acción (POST/GET) |  |  | `foto_socio` |  |
| `/panel/socios/[id]/reglamento` | pantalla | 👑 🧭 🛎️ | socios | `reglamento_aceptado` | `/panel/socios/` |
| `/panel/socios/duplicados` | pantalla | 👑 🧭 | socios | `posibles_duplicados`, `unir_socios` | `/panel/socios/` |
| `/panel/socios/exportar` | acción (POST/GET) |  |  | `exportar_socios` |  |
| `/panel/socios/importar` | pantalla | 👑 🧭 | socios | `deshacer_importacion`, `importaciones_panel`, `importar_socios`, `revisar_importacion` | `/panel/socios` |
| `/panel/socios/nuevo` | pantalla | 👑 🧭 🛎️ | socios | `ficha_socio`, `planes_para_alta`, `prospectos_panel` |  |
| `/panel/tareas` | pantalla |  |  | `crear_tarea`, `ficha_socio`, `marcar_tarea`, `tareas_panel` | `/panel/socios/` |
| `/panel/transferencias` | pantalla | 👑 🧭 🛎️ | transferencias | `aprobar_pago`, `pagos_por_aprobar`, `rechazar_pago` | `/panel/socios/` |
| `/panel/vencen-hoy` | pantalla | 👑 🧭 🛎️ | vencen_hoy |  | `/panel/retencion` |
| `/panel/vender` | pantalla | 👑 🧭 🛎️ | vender | `cajas_sede`, `comprobante_venta`, `contexto_cobro`, `ficha_socio`, `guardar_config_cobro`, `precios_venta`, `registrar_uso_cupon`, `validar_cupon`, `vender` | `/panel/caja` `/panel/entrada` `/panel/socios/` `/panel/socios/nuevo` |
| `/salir` | acción (POST/GET) |  |  |  |  |
| `/tv` | pantalla |  |  | `tv_estado` |  |
| `/tv/activar` | acción (POST/GET) |  |  |  |  |

## Funciones que ninguna pantalla llama

(Sin base conectada: no se pudo revisar.)
