# Mapa de pantallas

**Generado por `node scripts/mapa-pantallas.mjs`** a partir del código: no se edita a mano.
Se vuelve a generar cada vez que una vuelta cambia una pantalla.

Quién la ve: los roles que exige la pantalla (👑 dueño · 🧭 encargado · 🛎️ recepción · 💪 profe); vacío = todo el equipo o lo decide la función de la base.

| Ruta | Tipo | Quién la ve | Se apaga con | Funciones de la base | Lleva a |
|---|---|---|---|---|---|
| `(middleware)` | cada pedido |  |  | `gimnasio_por_host`, `gimnasio_por_slug` |  |
| `/` | pantalla |  |  | `abonar_turno`, `agenda_publica`, `baja_push`, `borrar_suscripcion_push`, `destinos_push`, `guardar_suscripcion_push`, `landing_publica`, `panel_gimnasio`, `quitar_turno`, `suscripcion_push` | `/hacete-socio` `/ingresar` |
| `/admin` | pantalla |  |  | `admin_agregar_dominio`, `admin_agregar_persona`, `admin_anular_pago_brik`, `admin_aplicar_plantilla`, `admin_asignar_plan_brik`, `admin_crear_gimnasio`, `admin_gimnasios`, `admin_guardar_plan_brik`, `admin_novedades`, `admin_planes_brik`, `admin_publicar_novedad`, `admin_quitar_dominio`, `admin_registrar_pago_brik`, `admin_retirar_novedad`, `cuenta_para_nueva_clave`, `mi_sesion`, `panel_gimnasio`, `persona_para_dar_acceso`, `usuario_por_mail`, `vincular_usuario_equipo` | `/admin/` `/g/` `/panel/pin` |
| `/admin/[id]` | pantalla |  |  | `admin_gimnasio`, `admin_planes_brik`, `historial_configuracion`, `panel_gimnasio` | `/admin` `/g/` `/panel/pin` |
| `/admin/entrar` | acción (POST/GET) |  |  | `admin_entrar_gimnasio` |  |
| `/admin/salir-gimnasio` | acción (POST/GET) |  |  | `admin_salir_gimnasio` |  |
| `/api/webhooks/mercadopago` | acción (POST/GET) |  |  | `acreditar_pago_mp`, `cerrar_evento_webhook`, `credenciales_mp`, `registrar_evento_webhook` |  |
| `/app` | pantalla |  |  | `agenda_publica`, `anotar_ejercicio`, `baja_push`, `campana_socio`, `cancelar_reserva`, `credenciales_mp`, `destinos_push`, `entrar_por_qr_pared`, `informar_transferencia`, `iniciar_pago_online`, `invitar`, `landing_publica`, `mi_link_referido`, `mi_qr`, `mi_socio`, `mis_invitados`, `novedades_socio`, `pago_online`, `pago_online_disponible`, `panel_gimnasio`, `pedir_baja_socio`, `pedir_pausa_socio`, `racha_socio`, `reservar`, `rutina_de_socio`, `usa_qr_pared` | `/app/clases` `/app/cuenta` `/app/historial` `/app/novedades` `/app/rutina` `/panel/pin` |
| `/app/clases` | pantalla |  |  | `clases_del_dia`, `horarios_para_turno`, `mi_socio`, `panel_gimnasio`, `politica_reservas`, `turnos_socio`, `wods_socio` | `/app` |
| `/app/cuenta` | pantalla |  |  | `mi_socio`, `panel_gimnasio`, `pedido_baja_socio` | `/app` `/app/mis-datos` |
| `/app/historial` | pantalla |  |  | `mi_historial`, `mi_socio`, `panel_gimnasio` | `/app` |
| `/app/mis-datos` | acción (POST/GET) |  |  | `mi_socio`, `mis_datos`, `panel_gimnasio` |  |
| `/app/novedades` | pantalla |  |  | `campana_socio`, `leer_campana`, `mi_socio`, `panel_gimnasio` | `/app` |
| `/app/pago` | pantalla |  |  | `pago_online`, `panel_gimnasio` |  |
| `/app/rutina` | pantalla |  |  | `mi_socio`, `panel_gimnasio`, `progreso_socio`, `rutina_de_socio` | `/app` |
| `/elegir` | pantalla |  |  | `mi_sesion`, `panel_gimnasio` | `/admin` `/entrar/` `/g/` |
| `/entrar/[slug]` | acción (POST/GET) |  |  | `mi_sesion`, `panel_gimnasio` |  |
| `/gimnasio-no-encontrado` | pantalla |  |  |  |  |
| `/hacete-socio` | pantalla |  |  | `agenda_publica`, `alta_online`, `alta_publica`, `landing_publica` | `/` `/ingresar` |
| `/ingresar` | pantalla |  |  | `agenda_publica`, `landing_publica`, `mi_sesion`, `panel_gimnasio`, `registrar_pedido_codigo`, `telefono_para_ingresar`, `vincular_socios_por_email`, `vincular_socios_por_telefono` |  |
| `/kiosco` | pantalla |  |  | `kiosco_entrar`, `kiosco_estado`, `kiosco_qr`, `kiosco_ultimo` |  |
| `/kiosco/activar` | acción (POST/GET) |  |  |  |  |
| `/panel` | pantalla |  |  | `agenda_publica`, `alertas_caja`, `anular_venta_panel`, `baja_push`, `buscar_socios`, `cajas_olvidadas`, `cerrar_novedad_plataforma`, `cumplen_hoy`, `dejados_pasar`, `destinos_push`, `estado_abono_panel`, `guardar_accesos_rapidos`, `invitados_de_hoy`, `landing_publica`, `novedades_dueno`, `ocultar_primeros_pasos`, `panel_gimnasio`, `panel_inicio`, `pedidos_anulacion_pendientes`, `pedidos_baja_pendientes`, `pedidos_pausa_pendientes`, `pedir_anulacion`, `primeros_pasos`, `productos_gimnasio`, `resolver_pedido_anulacion`, `tareas_panel` | `/elegir` `/panel/caja` `/panel/entrada/control` `/panel/pin` `/panel/planes` `/panel/resumen` `/panel/socios/` `/panel/tareas` |
| `/panel/avisos` | pantalla | 👑 🧭 🛎️ |  | `bandeja_avisos`, `marcar_avisado`, `novedades_panel`, `panel_gimnasio`, `publicar_novedad`, `quitar_novedad` | `/panel/pin` `/panel/socios/` |
| `/panel/caja` | pantalla | 👑 🧭 🛎️ | caja | `abrir_caja`, `baja_push`, `cajas_olvidadas`, `cajas_sede`, `cerrar_caja`, `confirmar_ticket`, `destinos_push`, `movimiento_caja`, `operador_actual`, `panel_gimnasio`, `preparar_ticket`, `resumen_caja`, `ticket_movimiento` | `/panel/caja/historial` `/panel/pin` |
| `/panel/caja/historial` | pantalla | 👑 🧭 | caja | `historial_caja`, `panel_gimnasio` | `/panel/pin` |
| `/panel/campana` | pantalla |  |  | `campana`, `leer_campana`, `panel_gimnasio` | `/panel/pin` |
| `/panel/clases` | pantalla |  | clases | `anular_presente`, `avisar_clase`, `baja_push`, `cancelar_clase`, `clases_del_dia`, `destinos_push`, `guardar_wod`, `panel_gimnasio`, `reservar`, `tomar_asistencia` | `/panel/clases/` `/panel/clases/grilla` `/panel/pin` |
| `/panel/clases/[id]` | pantalla |  | clases | `avisos_clase`, `clase_detalle`, `lista_clase`, `panel_gimnasio` | `/panel/clases` |
| `/panel/clases/grilla` | pantalla | 👑 🧭 | clases | `actividades_gimnasio`, `agregar_horario`, `cerrar_horario`, `editar_horario`, `equipo_gimnasio`, `guardar_actividad`, `horarios_gimnasio`, `ocupacion_horarios`, `panel_gimnasio` | `/panel/clases` `/panel/pin` |
| `/panel/configuracion` | pantalla | 👑 🧭 |  | `anular_cierre`, `autorizar_tablet`, `cierres_panel`, `config_turnos_fijos`, `configuracion_panel`, `confirmar_imagen_marca`, `crear_cierre`, `datos_gimnasio_panel`, `estado_pagos_online`, `guardar_configuracion`, `guardar_datos_gimnasio`, `guardar_horarios_apertura`, `guardar_mensaje`, `guardar_mercadopago`, `guardar_turnos_fijos`, `historial_configuracion`, `horarios_apertura_panel`, `mensajes_panel`, `ordenar_fotos`, `panel_gimnasio`, `preparar_imagen_marca`, `publicar_pagina`, `quitar_imagen_marca`, `quitar_mercadopago`, `restaurar_mensaje`, `revocar_tablet`, `sumar_sede`, `tablets_panel`, `vista_previa_mensaje` | `/panel/exportar` `/panel/pagina` `/panel/pin` |
| `/panel/cuenta` | pantalla |  |  | `panel_gimnasio` | `/panel/pin` |
| `/panel/entrada` | pantalla | 👑 🧭 🛎️ | entrada | `anular_ingreso`, `apto_socio`, `confirmar_invitado`, `cupo_dejar_pasar`, `descongelar`, `estado_acceso`, `ficha_socio`, `formas_de_entrada`, `ingresos_del_dia`, `invitados_de_hoy`, `leer_llavero`, `leer_qr`, `panel_gimnasio`, `pausas_socio`, `registrar_ingreso`, `registrar_invitado` | `/panel/entrada/control` `/panel/pin` `/panel/socios/` `/panel/socios/nuevo` `/panel/vender` |
| `/panel/entrada/control` | pantalla | 👑 🧭 | entrada | `control_entrada`, `panel_gimnasio` | `/panel/pin` `/panel/socios/` |
| `/panel/equipo` | pantalla | 👑 🧭 |  | `equipo_gimnasio`, `guardar_equipo`, `guardar_permisos_equipo`, `panel_gimnasio`, `permisos_equipo`, `usuario_por_mail`, `vincular_usuario_equipo` | `/panel/configuracion` `/panel/equipo/actividad` `/panel/pin` |
| `/panel/equipo/actividad` | pantalla | 👑 🧭 |  | `actividad_equipo`, `panel_gimnasio` | `/panel/equipo` `/panel/pin` |
| `/panel/exportar` | acción (POST/GET) |  |  | `exportar_gimnasio`, `panel_gimnasio` |  |
| `/panel/pagina` | pantalla | 👑 🧭 |  | `agenda_publica`, `altas_panel`, `guardar_altas`, `guardar_pagina`, `landing_publica`, `pagina_panel`, `panel_gimnasio` | `/hacete-socio` `/ingresar` `/panel/configuracion` `/panel/pin` |
| `/panel/pin` | pantalla |  |  | `entrar_con_pin`, `guardar_mi_pin`, `operador_actual`, `panel_gimnasio` | `/panel/cuenta` |
| `/panel/planes` | pantalla | 👑 🧭 |  | `actividades_gimnasio`, `anular_precio_programado`, `aplicar_aumento`, `configurar_stock`, `contar_stock`, `convenios_gimnasio`, `guardar_actividades_plan`, `guardar_convenio`, `guardar_matricula_plan`, `guardar_plan`, `guardar_producto`, `lista_precios_plan`, `panel_gimnasio`, `planes_gimnasio`, `productos_gimnasio`, `programar_lista_precios`, `programar_precio`, `vista_aumento` | `/panel/pin` `/panel/planes/aumento` |
| `/panel/planes/aumento` | pantalla | 👑 🧭 |  | `panel_gimnasio`, `planes_gimnasio` | `/panel/pin` `/panel/planes` |
| `/panel/prospectos` | pantalla | 👑 🧭 🛎️ |  | `actualizar_prospecto`, `agenda_publica`, `crear_prospecto`, `landing_publica`, `panel_gimnasio`, `prospectos_panel` | `/panel/pin` `/panel/socios/` `/panel/socios/nuevo` |
| `/panel/resultado` | pantalla | 👑 🧭 |  | `gastos_mes`, `guardar_gasto`, `motivos_baja_mes`, `panel_gimnasio`, `quitar_gasto`, `repetir_gastos`, `resultado_mes` | `/panel/pin` `/panel/resultado/exportar` |
| `/panel/resultado/exportar` | acción (POST/GET) |  |  | `exportar_mes`, `panel_gimnasio` |  |
| `/panel/resumen` | pantalla | 👑 🧭 |  | `panel_gimnasio`, `resumen_dueno` | `/panel/caja/historial` `/panel/pin` |
| `/panel/retencion` | pantalla | 👑 🧭 🛎️ | retencion | `etiquetas_gimnasio`, `panel_gimnasio`, `registrar_contacto`, `retencion`, `retencion_resumen`, `riesgo_baja`, `socios_con_etiqueta`, `tablero_retencion` | `/panel/pin` `/panel/socios/` `/panel/tareas` `/panel/vender` |
| `/panel/rutinas` | pantalla | 👑 🧭 💪 | rutinas | `archivar_rutina`, `asignar_rutina`, `ejercicios_gimnasio`, `guardar_ejercicio`, `guardar_rutina`, `panel_gimnasio`, `rutinas_gimnasio` | `/panel/pin` `/panel/rutinas/editar` |
| `/panel/rutinas/editar` | pantalla | 👑 🧭 💪 | rutinas | `ejercicios_gimnasio`, `panel_gimnasio`, `rutina_detalle` | `/panel/pin` `/panel/rutinas` `/panel/rutinas/socio` |
| `/panel/rutinas/socio` | pantalla | 👑 🧭 💪 | rutinas | `panel_gimnasio`, `progreso_socio`, `rutina_de_socio` | `/panel/pin` `/panel/rutinas` |
| `/panel/socios` | pantalla | 👑 🧭 🛎️ | socios | `agregar_nota`, `anonimizar_socio`, `anular_apto`, `anular_congelamiento`, `asignar_convenio`, `asignar_llavero`, `asignar_plan`, `borrar_nota`, `buscar_socios`, `cargar_apto`, `confirmar_foto_socio`, `congelar`, `dar_de_baja`, `descongelar`, `etiquetas_gimnasio`, `filtros_socios`, `guardar_socio`, `panel_gimnasio`, `pedir_pausa`, `poner_etiqueta`, `preparar_foto_socio`, `prospecto_es_socio`, `quitar_convenio`, `quitar_llavero`, `resolver_pedido_baja`, `resolver_pedido_pausa`, `sacar_de_familia`, `sacar_etiqueta`, `vincular_familia`, `vista_cambio_plan`, `volver_a_dar_de_alta` | `/panel/pin` `/panel/socios/` `/panel/socios/duplicados` `/panel/socios/exportar` `/panel/socios/importar` `/panel/socios/nuevo` |
| `/panel/socios/[id]` | pantalla | 👑 🧭 🛎️ | socios | `apto_socio`, `asistencia_socio`, `convenio_socio`, `convenios_gimnasio`, `faltas_socio`, `familia_socio`, `ficha_socio`, `foto_socio`, `horarios_para_turno`, `llavero_socio`, `notas_y_etiquetas`, `origen_socio`, `panel_gimnasio`, `pausas_socio`, `pedido_baja_socio`, `planes_gimnasio`, `primer_mes_socio`, `riesgo_baja`, `turnos_socio`, `ventas_socio` | `/panel/socios` `/panel/socios/` `/panel/tareas` `/panel/vender` |
| `/panel/socios/[id]/editar` | pantalla | 👑 🧭 🛎️ | socios | `ficha_socio`, `panel_gimnasio` | `/panel/pin` |
| `/panel/socios/[id]/foto` | acción (POST/GET) |  |  | `foto_socio`, `panel_gimnasio` |  |
| `/panel/socios/[id]/reglamento` | pantalla | 👑 🧭 🛎️ | socios | `panel_gimnasio`, `reglamento_aceptado` | `/panel/socios/` |
| `/panel/socios/duplicados` | pantalla | 👑 🧭 | socios | `panel_gimnasio`, `posibles_duplicados`, `unir_socios` | `/panel/pin` `/panel/socios/` |
| `/panel/socios/exportar` | acción (POST/GET) |  |  | `exportar_socios`, `panel_gimnasio` |  |
| `/panel/socios/importar` | pantalla | 👑 🧭 | socios | `deshacer_importacion`, `importaciones_panel`, `importar_socios`, `panel_gimnasio`, `revisar_importacion` | `/panel/pin` `/panel/socios` |
| `/panel/socios/nuevo` | pantalla | 👑 🧭 🛎️ | socios | `panel_gimnasio`, `planes_gimnasio`, `prospectos_panel` | `/panel/pin` |
| `/panel/tareas` | pantalla |  |  | `crear_tarea`, `ficha_socio`, `marcar_tarea`, `panel_gimnasio`, `tareas_panel` | `/panel/pin` `/panel/socios/` |
| `/panel/transferencias` | pantalla | 👑 🧭 🛎️ | transferencias | `aprobar_pago`, `baja_push`, `destinos_push`, `pagos_por_aprobar`, `panel_gimnasio`, `rechazar_pago` | `/panel/pin` `/panel/socios/` |
| `/panel/vencen-hoy` | pantalla | 👑 🧭 🛎️ | vencen_hoy | `bandeja_avisos`, `panel_gimnasio`, `prometieron_pagar`, `vencen_hoy` | `/panel/pin` `/panel/retencion` `/panel/socios/` `/panel/tareas` `/panel/vender` |
| `/panel/vender` | pantalla | 👑 🧭 🛎️ | vender | `cajas_sede`, `comprobante_venta`, `ficha_socio`, `operador_actual`, `panel_gimnasio`, `precios_venta`, `vender` | `/panel/caja` `/panel/entrada` `/panel/pin` `/panel/socios/` `/panel/socios/nuevo` |
| `/salir` | acción (POST/GET) |  |  |  |  |

## Funciones que ninguna pantalla llama

(Sin base conectada: no se pudo revisar.)
