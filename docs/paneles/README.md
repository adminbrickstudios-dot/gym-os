# Mapa de pantallas

**Generado por `node scripts/mapa-pantallas.mjs`** a partir del código: no se edita a mano.
Se vuelve a generar cada vez que una vuelta cambia una pantalla.

Quién la ve: los roles que exige la pantalla (👑 dueño · 🧭 encargado · 🛎️ recepción · 💪 profe); vacío = todo el equipo o lo decide la función de la base.

| Ruta | Tipo | Quién la ve | Se apaga con | Funciones de la base | Lleva a |
|---|---|---|---|---|---|
| `(middleware)` | cada pedido |  |  | `gimnasio_por_host`, `gimnasio_por_slug` |  |
| `/` | pantalla |  |  | `agenda_publica`, `landing_publica` | `/hacete-socio` `/ingresar` |
| `/admin` | pantalla |  |  | `admin_agregar_dominio`, `admin_agregar_persona`, `admin_crear_gimnasio`, `admin_gimnasios`, `admin_quitar_dominio`, `cuenta_para_nueva_clave`, `mi_sesion`, `panel_gimnasio`, `persona_para_dar_acceso`, `usuario_por_mail`, `vincular_usuario_equipo` | `/admin/` `/g/` |
| `/admin/[id]` | pantalla |  |  | `admin_gimnasio`, `historial_configuracion`, `panel_gimnasio` | `/admin` `/g/` |
| `/admin/entrar` | acción (POST/GET) |  |  | `admin_entrar_gimnasio` |  |
| `/admin/salir-gimnasio` | acción (POST/GET) |  |  | `admin_salir_gimnasio` |  |
| `/app` | pantalla |  |  | `agenda_publica`, `cancelar_reserva`, `entrar_por_qr_pared`, `informar_transferencia`, `invitar`, `landing_publica`, `mi_qr`, `mi_socio`, `mis_invitados`, `panel_gimnasio`, `reservar`, `usa_qr_pared` | `/app/clases` |
| `/app/clases` | pantalla |  |  | `clases_del_dia`, `mi_socio`, `panel_gimnasio` | `/app` |
| `/elegir` | pantalla |  |  | `mi_sesion`, `panel_gimnasio` | `/admin` `/entrar/` |
| `/entrar/[slug]` | acción (POST/GET) |  |  | `mi_sesion`, `panel_gimnasio` |  |
| `/gimnasio-no-encontrado` | pantalla |  |  |  |  |
| `/hacete-socio` | pantalla |  |  | `agenda_publica`, `alta_online`, `alta_publica`, `landing_publica` | `/` `/ingresar` |
| `/ingresar` | pantalla |  |  | `agenda_publica`, `landing_publica`, `mi_sesion`, `panel_gimnasio`, `vincular_socios_por_telefono` |  |
| `/kiosco` | pantalla |  |  | `kiosco_entrar`, `kiosco_estado`, `kiosco_qr`, `kiosco_ultimo` |  |
| `/kiosco/activar` | acción (POST/GET) |  |  |  |  |
| `/panel` | pantalla |  |  | `agenda_publica`, `anular_venta_panel`, `buscar_socios`, `cumplen_hoy`, `dejados_pasar`, `guardar_accesos_rapidos`, `invitados_de_hoy`, `landing_publica`, `ocultar_primeros_pasos`, `panel_gimnasio`, `panel_inicio`, `pedidos_anulacion_pendientes`, `pedidos_pausa_pendientes`, `pedir_anulacion`, `primeros_pasos`, `resolver_pedido_anulacion` | `/elegir` `/panel/entrada/control` `/panel/socios/` |
| `/panel/caja` | pantalla | 👑 🧭 🛎️ | caja | `abrir_caja`, `cajas_sede`, `cerrar_caja`, `movimiento_caja`, `panel_gimnasio`, `resumen_caja` |  |
| `/panel/clases` | pantalla |  | clases | `cancelar_clase`, `clases_del_dia`, `panel_gimnasio`, `reservar`, `tomar_asistencia` | `/panel/clases/` `/panel/clases/grilla` |
| `/panel/clases/[id]` | pantalla |  | clases | `clase_detalle`, `lista_clase`, `panel_gimnasio` | `/panel/clases` |
| `/panel/clases/grilla` | pantalla | 👑 🧭 | clases | `actividades_gimnasio`, `agregar_horario`, `cerrar_horario`, `equipo_gimnasio`, `guardar_actividad`, `horarios_gimnasio`, `panel_gimnasio` | `/panel/clases` |
| `/panel/configuracion` | pantalla | 👑 🧭 |  | `anular_cierre`, `autorizar_tablet`, `cierres_panel`, `configuracion_panel`, `confirmar_imagen_marca`, `crear_cierre`, `datos_gimnasio_panel`, `guardar_configuracion`, `guardar_datos_gimnasio`, `guardar_horarios_apertura`, `guardar_mensaje`, `historial_configuracion`, `horarios_apertura_panel`, `mensajes_panel`, `ordenar_fotos`, `panel_gimnasio`, `preparar_imagen_marca`, `publicar_pagina`, `quitar_imagen_marca`, `restaurar_mensaje`, `revocar_tablet`, `tablets_panel`, `vista_previa_mensaje` | `/panel/pagina` |
| `/panel/cuenta` | pantalla |  |  | `panel_gimnasio` |  |
| `/panel/entrada` | pantalla | 👑 🧭 🛎️ | entrada | `anular_ingreso`, `apto_socio`, `confirmar_invitado`, `cupo_dejar_pasar`, `descongelar`, `estado_acceso`, `ficha_socio`, `formas_de_entrada`, `ingresos_del_dia`, `invitados_de_hoy`, `leer_llavero`, `leer_qr`, `panel_gimnasio`, `pausas_socio`, `registrar_ingreso`, `registrar_invitado` | `/panel/entrada/control` `/panel/socios/` `/panel/socios/nuevo` `/panel/vender` |
| `/panel/entrada/control` | pantalla | 👑 🧭 | entrada | `control_entrada`, `panel_gimnasio` | `/panel/socios/` |
| `/panel/equipo` | pantalla | 👑 🧭 |  | `equipo_gimnasio`, `guardar_equipo`, `panel_gimnasio`, `usuario_por_mail`, `vincular_usuario_equipo` |  |
| `/panel/pagina` | pantalla | 👑 🧭 |  | `agenda_publica`, `altas_panel`, `guardar_altas`, `guardar_pagina`, `landing_publica`, `pagina_panel`, `panel_gimnasio` | `/hacete-socio` `/ingresar` `/panel/configuracion` |
| `/panel/planes` | pantalla | 👑 🧭 |  | `actividades_gimnasio`, `anular_precio_programado`, `aplicar_aumento`, `guardar_actividades_plan`, `guardar_matricula_plan`, `guardar_plan`, `guardar_producto`, `lista_precios_plan`, `panel_gimnasio`, `planes_gimnasio`, `productos_gimnasio`, `programar_lista_precios`, `programar_precio`, `vista_aumento` | `/panel/planes/aumento` |
| `/panel/planes/aumento` | pantalla | 👑 🧭 |  | `panel_gimnasio`, `planes_gimnasio` | `/panel/planes` |
| `/panel/prospectos` | pantalla | 👑 🧭 🛎️ |  | `actualizar_prospecto`, `crear_prospecto`, `panel_gimnasio`, `prospectos_panel` | `/panel/socios/` `/panel/socios/nuevo` |
| `/panel/retencion` | pantalla | 👑 🧭 | retencion | `etiquetas_gimnasio`, `panel_gimnasio`, `registrar_contacto`, `retencion`, `retencion_resumen`, `socios_con_etiqueta` | `/panel/socios/` |
| `/panel/socios` | pantalla | 👑 🧭 🛎️ | socios | `agregar_nota`, `anular_apto`, `anular_congelamiento`, `asignar_llavero`, `asignar_plan`, `borrar_nota`, `buscar_socios`, `cargar_apto`, `confirmar_foto_socio`, `congelar`, `dar_de_baja`, `descongelar`, `etiquetas_gimnasio`, `filtros_socios`, `guardar_socio`, `panel_gimnasio`, `pedir_pausa`, `poner_etiqueta`, `preparar_foto_socio`, `prospecto_es_socio`, `quitar_llavero`, `resolver_pedido_pausa`, `sacar_de_familia`, `sacar_etiqueta`, `vincular_familia`, `vista_cambio_plan`, `volver_a_dar_de_alta` | `/panel/socios/` `/panel/socios/duplicados` `/panel/socios/exportar` `/panel/socios/importar` `/panel/socios/nuevo` |
| `/panel/socios/[id]` | pantalla | 👑 🧭 🛎️ | socios | `apto_socio`, `asistencia_socio`, `familia_socio`, `ficha_socio`, `foto_socio`, `llavero_socio`, `notas_y_etiquetas`, `origen_socio`, `panel_gimnasio`, `pausas_socio`, `planes_gimnasio`, `ventas_socio` | `/panel/socios` `/panel/socios/` `/panel/vender` |
| `/panel/socios/[id]/editar` | pantalla | 👑 🧭 🛎️ | socios | `ficha_socio`, `panel_gimnasio` |  |
| `/panel/socios/[id]/foto` | acción (POST/GET) |  |  | `foto_socio`, `panel_gimnasio` |  |
| `/panel/socios/[id]/reglamento` | pantalla | 👑 🧭 🛎️ | socios | `panel_gimnasio`, `reglamento_aceptado` | `/panel/socios/` |
| `/panel/socios/duplicados` | pantalla | 👑 🧭 | socios | `panel_gimnasio`, `posibles_duplicados`, `unir_socios` | `/panel/socios/` |
| `/panel/socios/exportar` | acción (POST/GET) |  |  | `exportar_socios`, `panel_gimnasio` |  |
| `/panel/socios/importar` | pantalla | 👑 🧭 | socios | `deshacer_importacion`, `importaciones_panel`, `importar_socios`, `panel_gimnasio`, `revisar_importacion` | `/panel/socios` |
| `/panel/socios/nuevo` | pantalla | 👑 🧭 🛎️ | socios | `panel_gimnasio`, `planes_gimnasio`, `prospectos_panel` |  |
| `/panel/transferencias` | pantalla | 👑 🧭 🛎️ | transferencias | `aprobar_pago`, `pagos_por_aprobar`, `panel_gimnasio`, `rechazar_pago` | `/panel/socios/` |
| `/panel/vencen-hoy` | pantalla | 👑 🧭 🛎️ | vencen_hoy | `panel_gimnasio`, `vencen_hoy` | `/panel/socios/` |
| `/panel/vender` | pantalla | 👑 🧭 🛎️ | vender | `cajas_sede`, `ficha_socio`, `panel_gimnasio`, `precios_venta`, `vender` | `/panel/caja` `/panel/entrada` `/panel/socios/` `/panel/socios/nuevo` |
| `/salir` | acción (POST/GET) |  |  |  |  |

## Funciones que ninguna pantalla llama

Habilitadas para el equipo o el socio pero sin pantalla que las use (candidatas a pantalla nueva o a revisar):

- `actividades_por_plan`
- `anular_asistencia`
- `anular_invitado`
- `anular_venta`
- `caja_abierta`
- `cambiar_plan`
- `cobrar_cuota`
- `matriculas_planes`
- `precio_cuota`
- `quiero_probar`
