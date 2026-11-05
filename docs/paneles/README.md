# Mapa de pantallas

**Generado por `node scripts/mapa-pantallas.mjs`** a partir del código: no se edita a mano.
Se vuelve a generar cada vez que una vuelta cambia una pantalla.

Quién la ve: los roles que exige la pantalla (👑 dueño · 🧭 encargado · 🛎️ recepción · 💪 profe); vacío = todo el equipo o lo decide la función de la base.

| Ruta | Tipo | Quién la ve | Se apaga con | Funciones de la base | Lleva a |
|---|---|---|---|---|---|
| `(middleware)` | cada pedido |  |  | `gimnasio_por_host`, `gimnasio_por_slug` |  |
| `/` | pantalla |  |  | `agenda_publica`, `landing_publica` | `/ingresar` |
| `/admin` | pantalla |  |  | `admin_agregar_dominio`, `admin_agregar_persona`, `admin_crear_gimnasio`, `admin_gimnasios`, `admin_quitar_dominio`, `cuenta_para_nueva_clave`, `mi_sesion`, `panel_gimnasio`, `persona_para_dar_acceso`, `usuario_por_mail`, `vincular_usuario_equipo` | `/admin/` `/g/` |
| `/admin/[id]` | pantalla |  |  | `admin_gimnasio`, `panel_gimnasio` | `/admin` `/g/` |
| `/admin/entrar` | acción (POST/GET) |  |  | `admin_entrar_gimnasio` |  |
| `/admin/salir-gimnasio` | acción (POST/GET) |  |  | `admin_salir_gimnasio` |  |
| `/app` | pantalla |  |  | `agenda_publica`, `cancelar_reserva`, `informar_transferencia`, `landing_publica`, `mi_socio`, `panel_gimnasio`, `reservar` | `/app/clases` |
| `/app/clases` | pantalla |  |  | `clases_del_dia`, `mi_socio`, `panel_gimnasio` | `/app` |
| `/elegir` | pantalla |  |  | `mi_sesion`, `panel_gimnasio` | `/admin` `/entrar/` |
| `/entrar/[slug]` | acción (POST/GET) |  |  | `mi_sesion`, `panel_gimnasio` |  |
| `/gimnasio-no-encontrado` | pantalla |  |  |  |  |
| `/ingresar` | pantalla |  |  | `agenda_publica`, `landing_publica`, `mi_sesion`, `panel_gimnasio`, `vincular_socios_por_telefono` |  |
| `/panel` | pantalla |  |  | `agenda_publica`, `buscar_socios`, `guardar_accesos_rapidos`, `landing_publica`, `ocultar_primeros_pasos`, `panel_gimnasio`, `panel_inicio`, `primeros_pasos` | `/elegir` |
| `/panel/caja` | pantalla | 👑 🧭 🛎️ | caja | `abrir_caja`, `cajas_sede`, `cerrar_caja`, `movimiento_caja`, `panel_gimnasio`, `resumen_caja` |  |
| `/panel/clases` | pantalla |  | clases | `cancelar_clase`, `clases_del_dia`, `panel_gimnasio`, `reservar`, `tomar_asistencia` | `/panel/clases/` `/panel/clases/grilla` |
| `/panel/clases/[id]` | pantalla |  | clases | `clase_detalle`, `lista_clase`, `panel_gimnasio` | `/panel/clases` |
| `/panel/clases/grilla` | pantalla | 👑 🧭 | clases | `actividades_gimnasio`, `agregar_horario`, `cerrar_horario`, `equipo_gimnasio`, `guardar_actividad`, `horarios_gimnasio`, `panel_gimnasio` | `/panel/clases` |
| `/panel/configuracion` | pantalla | 👑 🧭 |  | `anular_cierre`, `cierres_panel`, `configuracion_panel`, `confirmar_imagen_marca`, `crear_cierre`, `datos_gimnasio_panel`, `guardar_configuracion`, `guardar_datos_gimnasio`, `guardar_horarios_apertura`, `guardar_mensaje`, `horarios_apertura_panel`, `mensajes_panel`, `ordenar_fotos`, `panel_gimnasio`, `preparar_imagen_marca`, `publicar_pagina`, `quitar_imagen_marca`, `restaurar_mensaje`, `vista_previa_mensaje` |  |
| `/panel/cuenta` | pantalla |  |  | `panel_gimnasio` |  |
| `/panel/entrada` | pantalla | 👑 🧭 🛎️ | entrada | `anular_ingreso`, `estado_acceso`, `ingresos_del_dia`, `panel_gimnasio`, `registrar_ingreso` | `/panel/socios/` `/panel/socios/nuevo` `/panel/vender` |
| `/panel/equipo` | pantalla | 👑 🧭 |  | `equipo_gimnasio`, `guardar_equipo`, `panel_gimnasio`, `usuario_por_mail`, `vincular_usuario_equipo` |  |
| `/panel/planes` | pantalla | 👑 🧭 |  | `guardar_plan`, `guardar_producto`, `panel_gimnasio`, `planes_gimnasio`, `productos_gimnasio`, `programar_precio` |  |
| `/panel/retencion` | pantalla | 👑 🧭 | retencion | `panel_gimnasio`, `registrar_contacto`, `retencion`, `retencion_resumen` | `/panel/socios/` |
| `/panel/socios` | pantalla | 👑 🧭 🛎️ | socios | `buscar_socios`, `dar_de_baja`, `guardar_socio`, `panel_gimnasio` | `/panel/socios/` `/panel/socios/nuevo` |
| `/panel/socios/[id]` | pantalla | 👑 🧭 🛎️ | socios | `ficha_socio`, `panel_gimnasio`, `planes_gimnasio` | `/panel/socios` `/panel/socios/` `/panel/vender` |
| `/panel/socios/[id]/editar` | pantalla | 👑 🧭 🛎️ | socios | `ficha_socio`, `panel_gimnasio` |  |
| `/panel/socios/nuevo` | pantalla | 👑 🧭 🛎️ | socios | `panel_gimnasio` |  |
| `/panel/transferencias` | pantalla | 👑 🧭 🛎️ | transferencias | `aprobar_pago`, `pagos_por_aprobar`, `panel_gimnasio`, `rechazar_pago` | `/panel/socios/` |
| `/panel/vencen-hoy` | pantalla | 👑 🧭 🛎️ | vencen_hoy | `panel_gimnasio`, `vencen_hoy` | `/panel/socios/` |
| `/panel/vender` | pantalla | 👑 🧭 🛎️ | vender | `cajas_sede`, `ficha_socio`, `panel_gimnasio`, `precios_venta`, `vender` | `/panel/caja` `/panel/entrada` `/panel/socios/` `/panel/socios/nuevo` |
| `/salir` | acción (POST/GET) |  |  |  |  |

## Funciones que ninguna pantalla llama

Habilitadas para el equipo o el socio pero sin pantalla que las use (candidatas a pantalla nueva o a revisar):

- `anular_asistencia`
- `anular_congelamiento`
- `anular_venta`
- `asignar_plan`
- `caja_abierta`
- `cambiar_plan`
- `cobrar_cuota`
- `congelar`
- `descongelar`
- `precio_cuota`
