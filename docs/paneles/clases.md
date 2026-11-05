# Clases · inventario botón por botón (AUD-9)

Rutas `/panel/clases` (día), `/panel/clases/<id>` (lista), `/panel/clases/grilla`
(actividades y horarios). Las ven todos los roles; la grilla, dueño y encargado.
Se apaga por gimnasio (`clases`; también con "sin clases" en Configuración).

Probado haciendo clic con `npm run e2e:clases` (`scripts/e2e/panel-clases.mjs`).

| Elemento | Qué hace hoy | Anda | Qué le falta | Se conecta con | Configurable |
|---|---|---|---|---|---|
| Días (Hoy, Mañana, …) | 7 días desde hoy. | ✅ | — | `clases_del_dia` | — |
| Selector de sede | Si hay varias y quien mira no está atado a una. | ✅ | — | `sedeActiva` | Sedes |
| Fila de clase | Hora, actividad, profe, cupo/anotados, espera; cancelada o pasada, más tenue. | ✅ | Ocupación por horario (CLA-5) | — | Modo de clases |
| Vacío | "No hay clases este día" y manda a revisar la grilla. | ✅ | — | — | — |
| Lista de la clase | Anotados, en espera con su número, los que vinieron sin reservar. | ✅ | WOD del día (CLA-4) | `lista_clase`, `clase_detalle` | — |
| ✅ Presente | Lo marca (el profe, solo en sus clases). | ✅ | Deshacer un presente por error (CLA-7); un verde por fila (DIS-9) | `tomar_asistencia` | — |
| ➕ Agregar a alguien | Buscar socio → Reservar o Presente (no el profe). | ✅ | — | `buscarSociosRapido`, `reservar` | — |
| 🚫 Cancelar esta clase | Con motivo; avisa a los anotados (campana y push). Lo ven dueño, encargado y profe. | ✅ | Mostrárselo a la recepción: la base ya la deja (CLA-3) | `cancelar_clase` | — |
| 🧩 Armar la grilla | Dueño y encargado. | ✅ | — | — | — |
| Actividades | Se crean con emoji y nombre; se ven con cuántos horarios tienen. | ✅ | Cambiar nombre o emoji, apagar una (CLA-8) | `guardar_actividad` | — |
| Agregar a la grilla | Actividad, día, hora, duración, cupo, profe, sede. | ✅ | Cambiar hora, cupo o profe sin sacar y volver a agregar (CLA-8) | `agregar_horario` | — |
| Sacar | Confirmación en pantalla ("Sí, sacar"); cancela las clases desde hoy y avisa. | ✅ (arreglado: usaba el diálogo del navegador) | — | `cerrar_horario` | — |
| Cargando | `loading.tsx` con la forma real en las tres pantallas. | ✅ (nuevo) | — | — | — |

## Lo que se pensó en cadena

- Para cambiar el cupo de un horario hoy hay que sacarlo (y se cancelan las
  clases con sus reservas) y volver a agregarlo: CLA-8.
- Un presente mal tocado no tiene vuelta desde la pantalla, aunque la base
  sabe anularlo (`anular_asistencia`): CLA-7 ya está en la cola.
