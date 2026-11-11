# Permisos por rol (sacado de la base real)

Generado con `node scripts/datos/permisos-md.mjs` leyendo el cuerpo de cada función en la base (`pg_proc`). 318 funciones piden un rol del equipo con `privado.exigir_equipo`; 395 no (las decide la propia función con la sesión, el socio o RLS); 26 son solo del servidor.
**Un permiso denegado es un error, nunca una lista vacía.** Lo prueba `supabase/pruebas/permisos-equipo.test.mjs` y el chequeo de RLS de `npm run chequeos`.

| Función | dueno | encargado | recepcion | profe |
|---|:-:|:-:|:-:|:-:|
| `actividades_por_plan` | ✓ | ✓ | — | — |
| `actualizar_prospecto` | ✓ | ✓ | ✓ | — |
| `agregar_horario` | ✓ | ✓ | — | — |
| `ajustes_planes` | ✓ | ✓ | — | — |
| `alertas_caja` | ✓ | ✓ | — | — |
| `alertas_patron_entradas` | ✓ | ✓ | — | — |
| `alertas_prestamo` | ✓ | ✓ | — | — |
| `altas_panel` | ✓ | ✓ | — | — |
| `anular_apto` | ✓ | ✓ | ✓ | — |
| `anular_fichaje` | ✓ | — | — | — |
| `anular_grado_socio` | ✓ | ✓ | — | — |
| `anular_horas_profe` | ✓ | — | — | — |
| `anular_invitado` | ✓ | ✓ | ✓ | — |
| `anular_pago_profe` | ✓ | — | — | — |
| `anular_precio_programado` | ✓ | ✓ | — | — |
| `anular_presente` | ✓ | ✓ | ✓ | ✓ |
| `aplicar_aumento` | ✓ | ✓ | — | — |
| `archivar_documento` | ✓ | — | — | — |
| `archivar_grado` | ✓ | ✓ | — | — |
| `archivar_rutina` | ✓ | ✓ | — | ✓ |
| `asignar_rutina` | ✓ | ✓ | — | ✓ |
| `asignar_rutina_varios` | ✓ | ✓ | — | ✓ |
| `aumentos_hechos` | ✓ | ✓ | — | — |
| `autoaltas_web` | ✓ | ✓ | ✓ | — |
| `autorizar_tablet` | ✓ | — | — | — |
| `autoservicio_panel` | ✓ | ✓ | — | — |
| `avisar_sin_bloquear_estado` | ✓ | ✓ | — | — |
| `aviso_previo_aumento` | ✓ | ✓ | — | — |
| `avisos_pagos_mp` | ✓ | ✓ | — | — |
| `bandeja_avisos` | ✓ | ✓ | ✓ | — |
| `beneficios_mes` | ✓ | ✓ | — | — |
| `borrar_nota` | ✓ | ✓ | ✓ | — |
| `borrar_socios_ejemplo` | ✓ | — | — | — |
| `buscar_socios` | ✓ | ✓ | ✓ | — |
| `buscar_socios_profe` | ✓ | ✓ | ✓ | ✓ |
| `cajas_olvidadas` | ✓ | ✓ | ✓ | — |
| `cajas_para_revisar` | ✓ | ✓ | — | — |
| `calcular_devolucion_baja` | ✓ | ✓ | ✓ | — |
| `campana` | ✓ | ✓ | ✓ | ✓ |
| `campana_control` | ✓ | ✓ | — | — |
| `campana_panel` | ✓ | ✓ | ✓ | ✓ |
| `cargar_horas_profe` | ✓ | — | — | — |
| `cargar_socios_ejemplo` | ✓ | — | — | — |
| `cerrar_emergencia_puerta` | ✓ | ✓ | — | — |
| `cerrar_evento` | ✓ | ✓ | — | — |
| `cerrar_horario` | ✓ | ✓ | — | — |
| `cerrar_novedad_plataforma` | ✓ | — | — | — |
| `checklist_hoy` | ✓ | ✓ | ✓ | — |
| `cierres_panel` | ✓ | ✓ | — | — |
| `comprobante_venta` | ✓ | ✓ | ✓ | — |
| `config_aumento` | ✓ | ✓ | — | — |
| `config_caja` | ✓ | ✓ | ✓ | — |
| `config_cobro` | ✓ | ✓ | ✓ | — |
| `config_dejar_pasar` | ✓ | ✓ | — | — |
| `config_entrada` | ✓ | ✓ | ✓ | ✓ |
| `config_liquidacion` | ✓ | — | — | — |
| `config_prueba_gratis` | ✓ | ✓ | ✓ | — |
| `config_turnos_fijos` | ✓ | ✓ | — | — |
| `config_visita` | ✓ | ✓ | ✓ | ✓ |
| `configuracion_panel` | ✓ | ✓ | — | — |
| `configurar_stock` | ✓ | ✓ | — | — |
| `confirmar_foto_producto` | ✓ | ✓ | — | — |
| `confirmar_foto_socio` | ✓ | ✓ | ✓ | — |
| `confirmar_foto_subida` | ✓ | ✓ | ✓ | — |
| `confirmar_imagen_marca` | ✓ | — | — | — |
| `confirmar_ticket` | ✓ | ✓ | ✓ | — |
| `constancia_baja` | ✓ | ✓ | ✓ | — |
| `contexto_cobro` | ✓ | ✓ | ✓ | — |
| `control_entrada` | ✓ | ✓ | — | — |
| `convenio_socio` | ✓ | ✓ | ✓ | — |
| `convenios_gimnasio` | ✓ | ✓ | ✓ | — |
| `copiar_rutina` | ✓ | ✓ | — | ✓ |
| `corregir_fichaje` | ✓ | — | — | — |
| `cortesias_socio` | ✓ | ✓ | ✓ | — |
| `crear_evento` | ✓ | ✓ | — | — |
| `crear_prospecto` | ✓ | ✓ | ✓ | — |
| `crear_tarea` | ✓ | ✓ | ✓ | ✓ |
| `crear_tv` | ✓ | ✓ | ✓ | ✓ |
| `cumplen_hoy` | ✓ | ✓ | ✓ | — |
| `cupo_dejar_pasar` | ✓ | ✓ | ✓ | — |
| `cupones_panel` | ✓ | ✓ | — | — |
| `dar_de_baja_equipo` | ✓ | — | — | — |
| `datos_ejemplo` | ✓ | — | — | — |
| `datos_gimnasio_panel` | ✓ | ✓ | — | — |
| `dejados_pasar` | ✓ | ✓ | — | — |
| `desactivar_cupon` | ✓ | — | — | — |
| `deshacer_importacion` | ✓ | ✓ | — | — |
| `devolucion_baja_config` | ✓ | ✓ | — | — |
| `diferencia_caja_por_cajero` | ✓ | ✓ | — | — |
| `documentos_panel` | ✓ | ✓ | — | — |
| `documentos_socio` | ✓ | ✓ | ✓ | — |
| `editar_horario` | ✓ | ✓ | — | — |
| `ejercicios_gimnasio` | ✓ | ✓ | — | ✓ |
| `encuestas_panel` | ✓ | ✓ | — | — |
| `entradas_de_emergencia` | ✓ | ✓ | — | — |
| `entradas_desde` | ✓ | ✓ | ✓ | — |
| `equipo_gimnasio` | ✓ | ✓ | — | — |
| `equipo_perfiles` | ✓ | ✓ | ✓ | ✓ |
| `espera_plazo_gimnasio` | ✓ | ✓ | — | — |
| `estado_emergencia_puerta` | ✓ | ✓ | ✓ | — |
| `estado_pagos_online` | ✓ | ✓ | — | — |
| `etiquetas_gimnasio` | ✓ | ✓ | ✓ | — |
| `evento_marcar_presente` | ✓ | ✓ | ✓ | — |
| `evento_quitar_presente` | ✓ | ✓ | ✓ | — |
| `eventos_del_dia_socio` | ✓ | ✓ | ✓ | — |
| `eventos_panel` | ✓ | ✓ | ✓ | — |
| `exportar_socios` | ✓ | ✓ | — | — |
| `faltas_clase` | ✓ | ✓ | — | — |
| `faltas_socio` | ✓ | ✓ | ✓ | ✓ |
| `faltas_socio_detalle` | ✓ | ✓ | ✓ | ✓ |
| `ficha_socio` | ✓ | ✓ | ✓ | — |
| `fichajes_persona` | ✓ | ✓ | — | — |
| `fichar` | — | ✓ | ✓ | ✓ |
| `filtros_socios` | ✓ | ✓ | ✓ | — |
| `firmar_documento` | ✓ | ✓ | ✓ | — |
| `firmas_propias_pendientes` | ✓ | ✓ | ✓ | — |
| `formas_de_entrada` | ✓ | ✓ | ✓ | — |
| `foto_estado_socio` | ✓ | ✓ | ✓ | ✓ |
| `foto_socio` | ✓ | ✓ | ✓ | ✓ |
| `foto_socio_permitida_gimnasio` | ✓ | ✓ | — | — |
| `fotos_de_clase` | ✓ | ✓ | ✓ | ✓ |
| `gastos_mes` | ✓ | — | — | — |
| `grados_panel` | ✓ | ✓ | ✓ | ✓ |
| `grados_socio` | ✓ | ✓ | ✓ | ✓ |
| `guardar_actividad` | ✓ | ✓ | — | — |
| `guardar_actividades_plan` | ✓ | ✓ | — | — |
| `guardar_ajustes_plan` | ✓ | ✓ | — | — |
| `guardar_altas` | ✓ | — | — | — |
| `guardar_avisar_sin_bloquear` | ✓ | — | — | — |
| `guardar_checklist_item` | ✓ | ✓ | — | — |
| `guardar_compras_app` | ✓ | — | — | — |
| `guardar_config_aumento` | ✓ | — | — | — |
| `guardar_config_caja` | ✓ | — | — | — |
| `guardar_config_cobro` | ✓ | ✓ | — | — |
| `guardar_config_dejar_pasar` | ✓ | — | — | — |
| `guardar_config_entrada` | ✓ | ✓ | — | — |
| `guardar_config_fichaje` | ✓ | — | — | — |
| `guardar_config_liquidacion` | ✓ | — | — | — |
| `guardar_config_visita` | ✓ | ✓ | — | — |
| `guardar_configuracion` | ✓ | — | — | — |
| `guardar_convenio` | ✓ | ✓ | — | — |
| `guardar_cupon` | ✓ | — | — | — |
| `guardar_datos_gimnasio` | ✓ | — | — | — |
| `guardar_doble_cobro` | ✓ | — | — | — |
| `guardar_documento` | ✓ | — | — | — |
| `guardar_ejercicio` | ✓ | ✓ | — | ✓ |
| `guardar_equipo` | ✓ | — | — | — |
| `guardar_equipo_ajuste` | ✓ | — | — | — |
| `guardar_espera_plazo` | ✓ | — | — | — |
| `guardar_ficha_producto` | ✓ | ✓ | — | — |
| `guardar_foto_socio_permitida` | ✓ | — | — | — |
| `guardar_grado` | ✓ | ✓ | — | — |
| `guardar_horarios_apertura` | ✓ | — | — | — |
| `guardar_link_resena` | ✓ | — | — | — |
| `guardar_matricula_plan` | ✓ | ✓ | — | — |
| `guardar_medicion` | ✓ | — | — | — |
| `guardar_mensaje` | ✓ | ✓ | — | — |
| `guardar_meta_visitas` | ✓ | — | — | — |
| `guardar_numeros_inicio` | ✓ | — | — | — |
| `guardar_pagina` | ✓ | — | — | — |
| `guardar_perfil_equipo` | ✓ | ✓ | — | — |
| `guardar_plan` | ✓ | ✓ | — | — |
| `guardar_plan_familiar` | ✓ | — | — | — |
| `guardar_politica_privacidad` | ✓ | — | — | — |
| `guardar_preferencia_aviso` | ✓ | ✓ | ✓ | ✓ |
| `guardar_producto` | ✓ | ✓ | — | — |
| `guardar_prueba_gratis` | ✓ | — | — | — |
| `guardar_prueba_social` | ✓ | — | — | — |
| `guardar_registro_socios` | ✓ | — | — | — |
| `guardar_regla_plan` | ✓ | — | — | — |
| `guardar_regla_profe` | ✓ | — | — | — |
| `guardar_regla_vencimiento` | ✓ | — | — | — |
| `guardar_respuesta_rapida` | ✓ | ✓ | — | — |
| `guardar_rutina` | ✓ | ✓ | — | ✓ |
| `guardar_servicio` | ✓ | ✓ | — | — |
| `guardar_socio` | ✓ | ✓ | ✓ | — |
| `guardar_tarea_auto` | ✓ | ✓ | — | — |
| `guardar_tema_usuario` | ✓ | ✓ | ✓ | ✓ |
| `guardar_video_portada` | ✓ | — | — | — |
| `habilitar_emergencia_puerta` | ✓ | — | — | — |
| `historial_configuracion` | ✓ | ✓ | — | — |
| `historial_emergencias_puerta` | ✓ | ✓ | — | — |
| `horarios_apertura_panel` | ✓ | ✓ | ✓ | — |
| `horarios_para_turno` | ✓ | ✓ | ✓ | — |
| `horas_equipo` | ✓ | ✓ | — | — |
| `importaciones_panel` | ✓ | ✓ | — | — |
| `importar_socios` | ✓ | ✓ | — | — |
| `ingresos_del_dia` | ✓ | ✓ | ✓ | — |
| `invitado_a_interesado` | ✓ | ✓ | ✓ | — |
| `invitados_de_hoy` | ✓ | ✓ | ✓ | — |
| `invitados_sin_seguimiento` | ✓ | ✓ | ✓ | — |
| `leer_llavero` | ✓ | ✓ | ✓ | — |
| `leer_qr` | ✓ | ✓ | ✓ | — |
| `lista_precios_plan` | ✓ | ✓ | — | — |
| `lockers_vencen_semana` | ✓ | ✓ | ✓ | — |
| `maquinas_fuera_de_servicio` | ✓ | ✓ | ✓ | ✓ |
| `marcar_alertas_vistas` | ✓ | — | — | — |
| `marcar_avisado` | ✓ | ✓ | ✓ | — |
| `marcar_no_escribirle` | ✓ | ✓ | ✓ | — |
| `marcar_plantilla` | ✓ | ✓ | — | ✓ |
| `marcar_tarea` | ✓ | ✓ | ✓ | ✓ |
| `matriculas_planes` | ✓ | ✓ | — | — |
| `medicion_panel` | ✓ | ✓ | — | — |
| `mensajes_panel` | ✓ | ✓ | — | — |
| `mensajes_sin_responder` | ✓ | ✓ | ✓ | ✓ |
| `meta_visitas_panel` | ✓ | ✓ | — | — |
| `mi_historial` | ✓ | ✓ | ✓ | — |
| `mi_locker` | ✓ | ✓ | ✓ | — |
| `mi_tema` | ✓ | ✓ | ✓ | ✓ |
| `motivos_baja_mes` | ✓ | ✓ | — | — |
| `motivos_beneficio_gimnasio` | ✓ | ✓ | ✓ | — |
| `motivos_reserva` | ✓ | ✓ | ✓ | — |
| `movimientos_stock_producto` | ✓ | ✓ | — | — |
| `no_escribirle_socio` | ✓ | ✓ | ✓ | — |
| `no_escribirles_de` | ✓ | ✓ | ✓ | — |
| `novedades_dueno` | ✓ | — | — | — |
| `novedades_historial` | ✓ | ✓ | — | — |
| `novedades_panel` | ✓ | ✓ | ✓ | — |
| `numeros_inicio` | ✓ | ✓ | ✓ | — |
| `ocultar_primeros_pasos` | ✓ | — | — | — |
| `ocupacion_horarios` | ✓ | ✓ | — | — |
| `ordenar_fotos` | ✓ | — | — | — |
| `ordenar_planes` | ✓ | ✓ | — | — |
| `otorgar_grado` | ✓ | ✓ | — | ✓ |
| `pagar_profe` | ✓ | — | — | — |
| `pagina_panel` | ✓ | ✓ | — | — |
| `pasos_asistente` | ✓ | — | — | — |
| `pedido_baja_socio` | ✓ | ✓ | ✓ | — |
| `pedidos_anulacion_pendientes` | ✓ | ✓ | — | — |
| `pedidos_baja_pendientes` | ✓ | ✓ | ✓ | — |
| `pedidos_datos_panel` | ✓ | ✓ | — | — |
| `pedidos_pausa_pendientes` | ✓ | ✓ | — | — |
| `pedir_ayuda_brik` | ✓ | ✓ | — | — |
| `pendientes_panel` | ✓ | ✓ | ✓ | ✓ |
| `perdonar_bloqueo` | ✓ | ✓ | — | — |
| `perdonar_falta` | ✓ | ✓ | — | — |
| `permisos_equipo` | ✓ | ✓ | — | — |
| `permisos_mensajes` | ✓ | ✓ | — | — |
| `plan_familiar_estado` | ✓ | ✓ | — | — |
| `planes_para_alta` | ✓ | ✓ | ✓ | — |
| `politica_privacidad_propia` | ✓ | ✓ | — | — |
| `posibles_duplicados` | ✓ | ✓ | — | — |
| `precios_venta` | ✓ | ✓ | ✓ | — |
| `preferencias_aviso_panel` | ✓ | ✓ | ✓ | ✓ |
| `preparar_foto_producto` | ✓ | ✓ | — | — |
| `preparar_foto_socio` | ✓ | ✓ | ✓ | — |
| `preparar_imagen_marca` | ✓ | — | — | — |
| `preparar_remito_stock` | ✓ | ✓ | — | — |
| `preparar_ticket` | ✓ | ✓ | ✓ | — |
| `primer_mes_socio` | ✓ | ✓ | ✓ | — |
| `primeros_pasos` | ✓ | — | — | — |
| `productos_gimnasio` | ✓ | ✓ | ✓ | — |
| `productos_mostrador` | ✓ | ✓ | — | — |
| `programar_lista_precios` | ✓ | ✓ | — | — |
| `programar_precio` | ✓ | ✓ | — | — |
| `progreso_inicio` | ✓ | ✓ | ✓ | ✓ |
| `prometieron_pagar` | ✓ | ✓ | ✓ | — |
| `prospecto_es_socio` | ✓ | ✓ | ✓ | — |
| `prospecto_por_dni` | ✓ | ✓ | ✓ | — |
| `prospecto_por_telefono` | ✓ | ✓ | ✓ | — |
| `prospectos_panel` | ✓ | ✓ | ✓ | — |
| `prueba_por_dni` | ✓ | ✓ | ✓ | — |
| `prueba_social_panel` | ✓ | ✓ | — | — |
| `pt_socio` | ✓ | ✓ | ✓ | — |
| `publicar_evento` | ✓ | ✓ | — | — |
| `publicar_pagina` | ✓ | — | — | — |
| `quitar_foto_producto` | ✓ | ✓ | — | — |
| `quitar_imagen_marca` | ✓ | — | — | — |
| `quitar_respuesta_rapida` | ✓ | ✓ | — | — |
| `quitar_rutina_socio` | ✓ | ✓ | — | ✓ |
| `racha_socio` | ✓ | ✓ | ✓ | ✓ |
| `recibo_venta` | ✓ | ✓ | ✓ | — |
| `registrar_uso_cupon` | ✓ | ✓ | ✓ | — |
| `registro_socios_panel` | ✓ | ✓ | — | — |
| `reglas_beneficios` | ✓ | ✓ | — | — |
| `reglas_vencimiento` | ✓ | ✓ | — | — |
| `remito_stock` | ✓ | ✓ | — | — |
| `resolver_pedido_datos` | ✓ | ✓ | — | — |
| `resolver_pedido_pausa` | ✓ | ✓ | — | — |
| `restaurar_mensaje` | ✓ | ✓ | — | — |
| `resumen_dueno` | ✓ | ✓ | — | — |
| `retencion_numeros` | ✓ | ✓ | — | — |
| `retencion_periodo` | ✓ | ✓ | — | — |
| `revisar_importacion` | ✓ | ✓ | — | — |
| `revocar_tablet` | ✓ | — | — | — |
| `revocar_tv` | ✓ | ✓ | — | — |
| `rutina_detalle` | ✓ | ✓ | — | ✓ |
| `rutinas_gimnasio` | ✓ | ✓ | — | ✓ |
| `rutinas_progreso_equipo` | ✓ | ✓ | — | ✓ |
| `sacar_de_familia` | ✓ | ✓ | — | — |
| `seguridad_dueno` | ✓ | — | — | — |
| `servicios_gimnasio` | ✓ | ✓ | — | — |
| `simular_cuota` | ✓ | ✓ | — | — |
| `socios_con_etiqueta` | ✓ | ✓ | ✓ | — |
| `soportes_del_gimnasio` | ✓ | — | — | — |
| `stock_productos` | ✓ | ✓ | ✓ | — |
| `sumar_sede` | ✓ | — | — | — |
| `suspension_socio` | ✓ | ✓ | ✓ | — |
| `tablero_retencion` | ✓ | ✓ | — | — |
| `tablets_panel` | ✓ | ✓ | — | — |
| `tareas_auto_config` | ✓ | ✓ | — | — |
| `tareas_panel` | ✓ | ✓ | ✓ | ✓ |
| `tasa_de_cobro` | ✓ | ✓ | — | — |
| `ticket_movimiento` | ✓ | ✓ | — | — |
| `tildar_checklist` | ✓ | ✓ | ✓ | — |
| `turnos_socio` | ✓ | ✓ | ✓ | ✓ |
| `tvs_panel` | ✓ | ✓ | ✓ | ✓ |
| `ultimas_entradas` | ✓ | ✓ | ✓ | — |
| `unir_socios` | ✓ | — | — | — |
| `validar_cupon` | ✓ | ✓ | ✓ | — |
| `vencen_hoy` | ✓ | ✓ | ✓ | — |
| `vencen_pestanas` | ✓ | ✓ | ✓ | — |
| `ventas_socio` | ✓ | ✓ | — | — |
| `ver_mensajes_equipo` | ✓ | ✓ | ✓ | ✓ |
| `version_registro` | ✓ | ✓ | ✓ | — |
| `vincular_familia` | ✓ | ✓ | — | — |
| `vista_aumento` | ✓ | ✓ | — | — |
| `vista_previa_mensaje` | ✓ | ✓ | — | — |

## Sin rol del equipo en la función (lo decide otra regla)
- `abonar_turno`
- `abrir_caja`
- `aceptar_oferta`
- `activar_emergencia_puerta`
- `actividad_equipo`
- `actividades_gimnasio`
- `admin_abonos`
- `admin_agregar_dominio`
- `admin_agregar_nota`
- `admin_agregar_persona`
- `admin_alertas`
- `admin_anotar_registro`
- `admin_anular_pago_brik`
- `admin_aplicar_plantilla`
- `admin_asignar_plan_brik`
- `admin_atender_demo`
- `admin_ayudas`
- `admin_borrar_definitivo`
- `admin_borrar_demos_vencidas`
- `admin_borrar_socio`
- `admin_buscar_persona`
- `admin_cambiar_dueno`
- `admin_cambiar_rol_persona`
- `admin_cambiar_slug`
- `admin_cancelar_mantenimiento`
- `admin_clonar_configuracion`
- `admin_confirmar_cuenta`
- `admin_crear_demo`
- `admin_crear_gimnasio`
- `admin_dar_de_baja`
- `admin_dar_rol_brik`
- `admin_demos_vencidas`
- `admin_entrar_gimnasio`
- `admin_errores`
- `admin_estado_persona`
- `admin_estado_seguridad`
- `admin_evento_webhook`
- `admin_exigir_2fa`
- `admin_exportar_gimnasio`
- `admin_exportar_socio`
- `admin_ficha_extra`
- `admin_funciones_prueba`
- `admin_gimnasio`
- `admin_gimnasios`
- `admin_guardar_ciudad`
- `admin_guardar_contacto_plataforma`
- `admin_guardar_descuento`
- `admin_guardar_limites_plan`
- `admin_guardar_link_pago`
- `admin_guardar_marca`
- `admin_guardar_modulos`
- `admin_guardar_plan_brik`
- `admin_guardar_plantilla_texto`
- `admin_guardar_prueba`
- `admin_guardar_tipo_gimnasio`
- `admin_lanzamiento`
- `admin_limites_gimnasios`
- `admin_link_pago`
- `admin_lista_gimnasios`
- `admin_mantenimientos`
- `admin_marcar_favorito`
- `admin_metricas`
- `admin_mover_persona`
- `admin_notas`
- `admin_novedades`
- `admin_papelera`
- `admin_pausar_gimnasio`
- `admin_pedidos_demo`
- `admin_planes_brik`
- `admin_planes_con_limites`
- `admin_plantillas_texto`
- `admin_plataforma_estado`
- `admin_prender_funcion`
- `admin_probar_acceso`
- `admin_probar_acceso_gimnasio`
- `admin_programar_mantenimiento`
- `admin_publicar_novedad`
- `admin_quitar_descuento`
- `admin_quitar_dominio`
- `admin_quitar_rol_brik`
- `admin_reanudar_gimnasio`
- `admin_registrar_pago_brik`
- `admin_registro_brik`
- `admin_resolver_ayuda`
- `admin_restaurar_baja`
- `admin_restaurar_plan`
- `admin_restaurar_plantilla_texto`
- `admin_restaurar_socio`
- `admin_restaurar_texto_gimnasio`
- `admin_retirar_novedad`
- `admin_salir_gimnasio`
- `admin_salud_gimnasios`
- `admin_salud_v2`
- `admin_soportes`
- `admin_tablero`
- `admin_tamano_tablas`
- `admin_uso_gimnasios`
- `admin_uso_semanal`
- `admin_ver_socio`
- `agenda_pt`
- `agenda_publica (también anónimo)`
- `agregar_nota`
- `alquilar_locker`
- `alta_online (también anónimo)`
- `alta_publica (también anónimo)`
- `anonimizar_socio`
- `anotar_ejercicio`
- `anular_asistencia`
- `anular_cierre`
- `anular_congelamiento`
- `anular_cortesia`
- `anular_devolucion`
- `anular_gasto`
- `anular_ingreso`
- `anular_prueba_gratis`
- `anular_registro`
- `anular_venta`
- `anular_venta_panel`
- `apagar_ayudas`
- `aprobar_pago`
- `apto_socio`
- `arreglar_falla`
- `asignar_convenio`
- `asignar_llavero`
- `asignar_plan`
- `asignar_responsable_falla`
- `asignar_servicio`
- `asistencia_socio`
- `avisar_clase`
- `aviso_clase_socio`
- `avisos_app_socio`
- `avisos_clase`
- `avisos_lugar_socio`
- `ayudas_vistas`
- `bandeja_mensajes`
- `borrar_suscripcion_push`
- `caja_para_cobrar`
- `cajas_sede`
- `cambiar_estado_hilo`
- `cambiar_plan`
- `campana_socio`
- `cancelar_clase`
- `cancelar_inscripcion_evento`
- `cancelar_reserva`
- `cancelar_sesion_pt`
- `cargar_apto`
- `cargar_franjas_pt`
- `cargar_gasto`
- `cerrar_caja`
- `clase_detalle`
- `clases_del_dia`
- `clases_para_probar (también anónimo)`
- `comprobante_gasto`
- `config_cierres`
- `config_fichaje`
- `confirmar_comprobante_gasto`
- `confirmar_foto_falla`
- `confirmar_foto_mensaje`
- `confirmar_foto_propia`
- `confirmar_invitado`
- `confirmar_remito_stock`
- `congelar`
- `contacto_plataforma_publico (también anónimo)`
- `contar_caja_sin_contar`
- `contar_stock`
- `contexto_pantalla`
- `copia_entrada`
- `corregir_incidente`
- `crear_cierre`
- `crear_incidente`
- `crear_locker`
- `crear_lockers_serie`
- `crear_maquina`
- `cuenta_para_nueva_clave`
- `dar_cortesia`
- `dar_de_baja`
- `dar_de_baja_locker`
- `dar_de_baja_maquina`
- `dar_prueba_gratis`
- `dejar_caja_sin_contar`
- `descongelar`
- `desmarcar_dia_rutina`
- `deuda_con_socios`
- `devoluciones_socio`
- `elegir_lugar`
- `encuesta_socio`
- `entrada_stock`
- `entrar_con_pin`
- `entrar_por_qr_pared`
- `escribir_al_gimnasio`
- `estado_abono_panel`
- `estado_acceso`
- `estado_soporte`
- `eventos_publicos (también anónimo)`
- `eventos_socio`
- `ex_socios`
- `exportar_gastos`
- `exportar_gimnasio`
- `exportar_mes`
- `familia_socio`
- `fichar_con_pin`
- `fijar_titular_familia`
- `foto_equipo (también anónimo)`
- `foto_falla`
- `foto_mensaje`
- `foto_propia`
- `foto_propia_permitida`
- `funcion_prendida`
- `ganancia_mes`
- `gimnasio_por_host (también anónimo)`
- `gimnasio_por_slug (también anónimo)`
- `guardar_accesos_rapidos`
- `guardar_aviso_clase`
- `guardar_config_cierres`
- `guardar_config_pt`
- `guardar_devolucion_baja_modo`
- `guardar_foto_equipo`
- `guardar_gasto`
- `guardar_gasto_fijo`
- `guardar_lugares`
- `guardar_mercadopago`
- `guardar_mi_pin`
- `guardar_motivo_beneficio`
- `guardar_pack_pt`
- `guardar_permiso_gastos`
- `guardar_permisos_equipo`
- `guardar_permisos_mensajes`
- `guardar_presupuesto_gasto`
- `guardar_suscripcion_push`
- `guardar_tarifa_locker`
- `guardar_topes_beneficios`
- `guardar_turnos_fijos`
- `guardar_wod`
- `guia_entrada`
- `hilo_mensajes`
- `historial_caja`
- `historial_maquina`
- `historial_mensajes_socio`
- `horarios_gimnasio`
- `incidentes_panel`
- `info_gimnasio_socio`
- `informar_compra_app`
- `informar_transferencia`
- `iniciar_compra_online`
- `iniciar_pago_online`
- `inscribirse_evento`
- `inscribirse_evento_publico (también anónimo)`
- `invitar`
- `kiosco_emergencia (también anónimo)`
- `kiosco_entrar (también anónimo)`
- `kiosco_entrar_habitual (también anónimo)`
- `kiosco_estado (también anónimo)`
- `kiosco_habituales (también anónimo)`
- `kiosco_qr (también anónimo)`
- `kiosco_salida_activa (también anónimo)`
- `kiosco_salir (también anónimo)`
- `kiosco_ultimo (también anónimo)`
- `landing_publica (también anónimo)`
- `leer_campana`
- `levantar_suspension`
- `liberar_locker`
- `linea_de_control`
- `liquidacion_profe_detalle`
- `liquidacion_profes`
- `lista_clase`
- `llavero_socio`
- `lockers_panel`
- `lugares_clase`
- `mantenimiento_vigente (también anónimo)`
- `maquinas_panel`
- `marcar_aviso_leido`
- `marcar_ayuda`
- `marcar_bienvenida`
- `marcar_dia_rutina`
- `marcar_serie_rutina`
- `marcar_sesion_pt`
- `medicion_publica (también anónimo)`
- `mensajes_estado_socio`
- `mi_fichaje`
- `mi_hilo`
- `mi_link_referido`
- `mi_liquidacion`
- `mi_qr`
- `mi_seguridad`
- `mi_sesion`
- `mi_socio`
- `mi_turno_caja`
- `mis_avisos`
- `mis_datos`
- `mis_horas`
- `mis_invitados`
- `mis_mensajes`
- `moderacion_control`
- `motivo_reserva`
- `movimiento_caja`
- `notas_y_etiquetas`
- `novedades_socio`
- `ofertas_socio`
- `opciones_compra_app`
- `operador_actual`
- `origen_socio`
- `pago_online`
- `pago_online_disponible`
- `pago_online_revisable`
- `pagos_por_aprobar`
- `panel_gimnasio`
- `panel_inicio`
- `para_hacer_hoy`
- `pausas_socio`
- `pedir_anulacion`
- `pedir_baja_socio`
- `pedir_demo_brik (también anónimo)`
- `pedir_mis_datos`
- `pedir_pausa`
- `pedir_pausa_socio`
- `persona_para_dar_acceso`
- `pestanas_app`
- `plan_familiar_socio`
- `planes_brik_publicos (también anónimo)`
- `planes_gimnasio`
- `politica_privacidad_publica (también anónimo)`
- `politica_reservas`
- `poner_etiqueta`
- `preparar_comprobante_gasto`
- `preparar_foto_equipo`
- `preparar_foto_falla`
- `preparar_foto_mensaje`
- `preparar_foto_propia`
- `previsualizar_cierre`
- `profes_de_clases`
- `progreso_socio`
- `publicar_novedad`
- `quiero_probar (también anónimo)`
- `quitar_convenio`
- `quitar_franja_pt`
- `quitar_gasto`
- `quitar_llavero`
- `quitar_mercadopago`
- `quitar_novedad`
- `quitar_titular_familia`
- `quitar_turno`
- `rechazar_oferta`
- `rechazar_pago`
- `reemplazar_profe`
- `reemplazos_clase`
- `registra_salida`
- `registrar_contacto`
- `registrar_devolucion`
- `registrar_error_app`
- `registrar_ingreso`
- `registrar_invitado`
- `registrar_salida`
- `registrar_sesion_equipo`
- `reglamento_aceptado`
- `reiniciar_ayudas`
- `renovar_alquiler_locker`
- `repetir_gastos`
- `reportar_falla`
- `reporte_dia`
- `reporte_turno`
- `reservar`
- `reservar_prueba_publica (también anónimo)`
- `reservar_sesion_pt`
- `resolver_pedido_anulacion`
- `resolver_pedido_baja`
- `responder_encuesta`
- `responder_hilo_socio`
- `responder_mensaje`
- `respuestas_rapidas`
- `resultado_mes`
- `resultado_por_sede`
- `resumen_app_socio`
- `resumen_caja`
- `retencion`
- `retencion_resumen`
- `revisar_suspension`
- `riesgo_baja`
- `rutina_de_socio`
- `sacar_etiqueta`
- `salir_por_qr_pared`
- `series_hechas_hoy`
- `sesiones_dictadas_pt`
- `sincronizar_sin_internet`
- `suscripcion_push`
- `suspender_socio`
- `terminar_gasto_fijo`
- `tomar_asistencia`
- `tv_estado (también anónimo)`
- `usa_qr_pared`
- `vender`
- `verificar_version`
- `vista_cambio_plan`
- `vista_compra_app`
- `volver_a_dar_de_alta`
- `wods_socio`

## Solo el servidor (`service_role`)
- `acreditar_pago_mp`
- `baja_push`
- `caja_abierta`
- `cerrar_evento_webhook`
- `cobrar_cuota`
- `credenciales_mp`
- `destinos_push`
- `destinos_push_clases`
- `destinos_push_mensajes`
- `entrar_con_google`
- `ingreso_permitido`
- `mail_para_ingresar`
- `precio_cuota`
- `registrar_envio_publico`
- `registrar_evento_webhook`
- `registrar_ingreso_fallido`
- `registrar_pedido_codigo`
- `revertir_pago_mp`
- `revisar_pagos_mp`
- `socio_para_vincular_google`
- `telefono_para_ingresar`
- `usuario_por_mail`
- `vincular_google`
- `vincular_socios_por_email`
- `vincular_socios_por_telefono`
- `vincular_usuario_equipo`
