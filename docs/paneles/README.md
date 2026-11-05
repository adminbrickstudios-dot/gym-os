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
| `/app` | pantalla |  |  | `agenda_publica`, `cancelar_reserva`, `informar_transferencia`, `landing_publica`, `mi_socio`, `panel_gimnasio`, `reservar` | `/app/clases` |
| `/app/clases` | pantalla |  |  | `clases_del_dia`, `mi_socio`, `panel_gimnasio` | `/app` |
| `/elegir` | pantalla |  |  | `mi_sesion`, `panel_gimnasio` | `/admin` `/entrar/` |
| `/entrar/[slug]` | acción (POST/GET) |  |  | `mi_sesion`, `panel_gimnasio` |  |
| `/gimnasio-no-encontrado` | pantalla |  |  |  |  |
| `/hacete-socio` | pantalla |  |  | `agenda_publica`, `alta_online`, `alta_publica`, `landing_publica` | `/` `/ingresar` |
| `/ingresar` | pantalla |  |  | `agenda_publica`, `landing_publica`, `mi_sesion`, `panel_gimnasio`, `vincular_socios_por_telefono` |  |
| `/panel` | pantalla |  |  | `agenda_publica`, `buscar_socios`, `cumplen_hoy`, `guardar_accesos_rapidos`, `landing_publica`, `ocultar_primeros_pasos`, `panel_gimnasio`, `panel_inicio`, `pedidos_pausa_pendientes`, `primeros_pasos` | `/elegir` `/panel/socios/` |
| `/panel/caja` | pantalla | 👑 🧭 🛎️ | caja | `abrir_caja`, `cajas_sede`, `cerrar_caja`, `movimiento_caja`, `panel_gimnasio`, `resumen_caja` |  |
| `/panel/clases` | pantalla |  | clases | `cancelar_clase`, `clases_del_dia`, `panel_gimnasio`, `reservar`, `tomar_asistencia` | `/panel/clases/` `/panel/clases/grilla` |
| `/panel/clases/[id]` | pantalla |  | clases | `clase_detalle`, `lista_clase`, `panel_gimnasio` | `/panel/clases` |
| `/panel/clases/grilla` | pantalla | 👑 🧭 | clases | `actividades_gimnasio`, `agregar_horario`, `cerrar_horario`, `equipo_gimnasio`, `guardar_actividad`, `horarios_gimnasio`, `panel_gimnasio` | `/panel/clases` |
| `/panel/configuracion` | pantalla | 👑 🧭 |  | `anular_cierre`, `cierres_panel`, `configuracion_panel`, `confirmar_imagen_marca`, `crear_cierre`, `datos_gimnasio_panel`, `guardar_configuracion`, `guardar_datos_gimnasio`, `guardar_horarios_apertura`, `guardar_mensaje`, `historial_configuracion`, `horarios_apertura_panel`, `mensajes_panel`, `ordenar_fotos`, `panel_gimnasio`, `preparar_imagen_marca`, `publicar_pagina`, `quitar_imagen_marca`, `restaurar_mensaje`, `vista_previa_mensaje` | `/panel/pagina` |
| `/panel/cuenta` | pantalla |  |  | `panel_gimnasio` |  |
| `/panel/entrada` | pantalla | 👑 🧭 🛎️ | entrada | `anular_ingreso`, `estado_acceso`, `ingresos_del_dia`, `panel_gimnasio`, `registrar_ingreso` | `/panel/socios/` `/panel/socios/nuevo` `/panel/vender` |
| `/panel/equipo` | pantalla | 👑 🧭 |  | `equipo_gimnasio`, `guardar_equipo`, `panel_gimnasio`, `usuario_por_mail`, `vincular_usuario_equipo` |  |
| `/panel/pagina` | pantalla | 👑 🧭 |  | `agenda_publica`, `altas_panel`, `guardar_altas`, `guardar_pagina`, `landing_publica`, `pagina_panel`, `panel_gimnasio` | `/hacete-socio` `/ingresar` `/panel/configuracion` |
| `/panel/planes` | pantalla | 👑 🧭 |  | `guardar_plan`, `guardar_producto`, `panel_gimnasio`, `planes_gimnasio`, `productos_gimnasio`, `programar_precio` |  |
| `/panel/prospectos` | pantalla | 👑 🧭 🛎️ |  | `actualizar_prospecto`, `crear_prospecto`, `panel_gimnasio`, `prospectos_panel` | `/panel/socios/` `/panel/socios/nuevo` |
| `/panel/retencion` | pantalla | 👑 🧭 | retencion | `etiquetas_gimnasio`, `panel_gimnasio`, `registrar_contacto`, `retencion`, `retencion_resumen`, `socios_con_etiqueta` | `/panel/socios/` |
| `/panel/socios` | pantalla | 👑 🧭 🛎️ | socios | `agregar_nota`, `anular_apto`, `anular_congelamiento`, `asignar_plan`, `borrar_nota`, `buscar_socios`, `cargar_apto`, `confirmar_foto_socio`, `congelar`, `dar_de_baja`, `descongelar`, `etiquetas_gimnasio`, `filtros_socios`, `guardar_socio`, `panel_gimnasio`, `pedir_pausa`, `poner_etiqueta`, `preparar_foto_socio`, `prospecto_es_socio`, `resolver_pedido_pausa`, `sacar_de_familia`, `sacar_etiqueta`, `vincular_familia`, `volver_a_dar_de_alta` | `/panel/socios/` `/panel/socios/duplicados` `/panel/socios/exportar` `/panel/socios/importar` `/panel/socios/nuevo` |
| `/panel/socios/[id]` | pantalla | 👑 🧭 🛎️ | socios | `apto_socio`, `asistencia_socio`, `familia_socio`, `ficha_socio`, `foto_socio`, `notas_y_etiquetas`, `origen_socio`, `panel_gimnasio`, `pausas_socio`, `planes_gimnasio` | `/panel/socios` `/panel/socios/` `/panel/vender` |
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

(Sin base conectada: no se pudo revisar.)
