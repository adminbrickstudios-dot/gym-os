# Retención · inventario botón por botón (AUD-10)

Ruta `/panel/retencion`. La ven dueño, encargado y recepción (D2 / RET-2: la recepción sin la plata). Se apaga por gimnasio (`retencion`).

Probado haciendo clic con `npm run e2e:retencion` (`scripts/e2e/panel-retencion.mjs`).

| Elemento | Qué hace hoy | Anda | Qué le falta | Se conecta con | Configurable |
|---|---|---|---|---|---|
| Tablero | Al día (12 semanas), altas y bajas del mes, plata por mes en riesgo. | ✅ (RET-1) | — | `tablero_retencion`, `retencion_resumen` | — |
| Listas | Vencidos, Por vencer, Nuevos que no vienen, No vienen, Se fueron; cada una con su número. Abre la primera con gente. | ✅ | — | `retencion` | Días de cada lista (Configuración → Reglas) |
| Filtro por etiqueta | Solo elige filas; quién está en cada lista lo dice la base. | ✅ | — | `socios_con_etiqueta` | Etiquetas |
| 💬 WhatsApp | Mensaje de Configuración → Mensajes ya escrito; tocarlo anota "le escribió". | ✅ | — | `registrar_contacto` | Mensajes |
| 🙌 Dice que vuelve | Queda anotado en la fila ("Dijo que vuelve el …"). | ✅ | — | `registrar_contacto` | — |
| 💵 Cobrar | En Vencidos y Por vencer: abre Vender con la cuota. | ✅ (nuevo) | — | Vender | — |
| Lista vacía | "Nadie en esta lista" y el link a la que sí tiene gente (antes era una línea suelta). | ✅ (arreglado) | — | — | — |
| Cargando | `loading.tsx` con la forma real. | ✅ (nuevo) | — | — | — |

## Lo que se pensó en cadena

- Antes de la baja, ofrecer pausa y preguntar el motivo (RET-3): sin el motivo,
  Retención no puede decir por qué se va la gente.
- "Avisar a todos" (VEH-1) existe en Vencen hoy y en Avisos de hoy; en
  Retención las listas son más largas y menos urgentes: se deja así.
