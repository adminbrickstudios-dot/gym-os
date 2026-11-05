# Socios · inventario botón por botón (AUD-3)

Rutas `/panel/socios` (lista), `/panel/socios/nuevo` (alta; desde Prospectos
llega con `?prospecto=`), `/panel/socios/<id>` (ficha) y `/panel/socios/<id>/editar`.
Las ven dueño, encargado y recepción; el profe no (barrido). Con la sección
Socios apagada no abre ninguna (CFG-7). Lee `buscar_socios`, `ficha_socio`,
`planes_gimnasio`; escribe `guardar_socio`, `asignar_plan`, `cambiar_plan`,
`dar_de_baja`, `volver_a_dar_de_alta` (0033).

Probado haciendo clic con `npm run e2e:socios` (`scripts/e2e/panel-socios.mjs`,
16 pasos): dueña en compu, recepción en celular.

| Pantalla | Elemento | Qué hace hoy | Anda | Qué le falta | Se conecta con | Configurable |
|---|---|---|---|---|---|---|
| Lista | Buscar | Por nombre, apellido, DNI, teléfono o número (sin acentos ni mayúsculas). Hasta 60. | ✅ | Filtros por estado y plan (SOC-12), etiquetas (SOC-3) | `buscar_socios` | — |
| Lista | Fila | Punto de color, nombre, #número, el porqué del estado y el plan; dados de baja en gris. Toca → ficha. | ✅ | — | Ficha | — |
| Lista | ➕ Nuevo socio | Abre el alta. | ✅ | Importar (SOC-1), exportar (SOC-4) | Alta | — |
| Lista | Sin resultados | "Nadie con …" y "Darlo de alta". Sin socios: "Cargar el primero". | ✅ | — | Alta | — |
| Alta / Editar | Nombre (obligatorio), apellido, DNI, fecha de nacimiento, WhatsApp, mail, emergencia, notas | Guarda y abre la ficha. DNI repetido: "Ya hay un socio con el DNI …". El teléfono se escribe como lo dice la gente (387 15 555-1234, 011 …): lo normaliza la base (0033). Aviso de no anotar datos de salud. | ✅ | Plan y cobro en el mismo paso (SOC-13) | `guardar_socio` | — |
| Alta | Desde Prospectos | Llega con nombre, apellido y WhatsApp; al guardar el prospecto queda "se hizo socio". | ✅ (PAG-3) | — | Prospectos | — |
| Ficha | Semáforo | Color y el porqué (misma cuenta que la Entrada). | ✅ | — | `estado_acceso` | — |
| Ficha | 💵 Cobrar / 🛒 Vender | Sin pagar: Cobrar (con el monto) en verde; al día: Vender. Van a Vender con el socio elegido. Con Vender apagado no aparecen. | ✅ | — | Vender | — |
| Ficha | 💬 WhatsApp | Abre el chat con su número. | ✅ | Mensaje armado según su estado (va con SOC-2) | — | — |
| Ficha | ✏️ Editar | Abre el formulario con sus datos. | ✅ | — | `guardar_socio` | — |
| Ficha | 🏷️ Asignar plan / 🔄 Cambiar plan | Lista de membresías activas; cambiar cierra el plan actual hoy. | ✅ | — | `asignar_plan`, `cambiar_plan` | — |
| Ficha | 👋 Dar de baja | Pide el motivo (precio, horario, se mudó…). | ✅ | Ofrecer pausa antes (RET-3) | Retención | — |
| Ficha | ↩️ Volver a darlo de alta | Dado de baja: borra la baja (queda en `historial_bajas`) y vuelve sin plan: se asigna y se cobra. | ✅ (nuevo, AUD-3) | — | Entrada, Retención | — |
| Ficha | Plan · Contacto · Últimas entradas · Pagos | Datos del plan, packs, contacto, entradas con resultado y pagos (dueño y encargado). | ✅ | Pestañas, asistencia del mes, notas (SOC-2), anular un pago desde acá, origen y reglamento aceptado (SOC-14) | — | — |
| Todo | Celular (390 px) | Lista y ficha sin desborde. | ✅ | — | — | — |

## Lo que se arregló en esta auditoría

- Un socio dado de baja que volvía era un callejón: la ficha no ofrecía nada
  y la Entrada lo mostraba rojo para siempre. Ahora "Volver a darlo de alta"
  (migración 0033, con historial de la baja).
- Teléfonos: el alta pedía escribir "+54 9 …" y la pantalla armaba mal algunos
  números (un 0 de más o de menos); el "15" del celular no se entendía en
  ningún lado. Ahora todos los teléfonos del sistema pasan por una sola
  función en la base que entiende cómo los escribe la gente.

## Lo que va a la COLA

- **SOC-12**: filtros de la lista (al día, por vencer, vencidos, en pausa, nuevos, dados de baja, plan).
- **SOC-13**: alta en un paso: datos, plan y "Guardar y cobrar".
- **SOC-14**: la ficha dice cómo llegó (alta online, prospecto, importado) y qué versión del reglamento aceptó y cuándo.
