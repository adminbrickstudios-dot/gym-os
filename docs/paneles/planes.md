# Planes y precios · inventario botón por botón (AUD-5)

Ruta `/panel/planes`. La ven dueño y encargado; recepción y profe reciben
"No tenés acceso" (lo decide `exigirRol` y, abajo, la base). Lee
`planes_gimnasio` y `productos_gimnasio`; escribe `guardar_plan`,
`programar_precio` y `guardar_producto`.

Probado haciendo clic con `npm run e2e:planes` (`scripts/e2e/panel-planes.mjs`):
dueña en compu, encargado en celular, recepción sin acceso.

| Elemento | Qué hace hoy | Anda | Qué le falta | Se conecta con | Configurable |
|---|---|---|---|---|---|
| ➕ Nuevo plan | Membresía (meses, veces por semana), pase o pack (clases, días de vencimiento). Nombre, precio y descripción. | ✅ | Trimestral/semestral con precio propio (PLA-1), horario (PLA-2), matrícula (PLA-3) | `guardar_plan`, `programar_precio` | — |
| Lista por tipo | Membresías, Pases, Packs. Cada plan: precio de hoy, meses, clases, vencimiento del pack, veces por semana, horario, socios activos, descripción. | ✅ (más datos, AUD-5) | — | `planes_gimnasio` | Cobros apagados en Configuración |
| 💲 Precios | Precio general, más barato por medio de pago y por pagar antes de un día, y "desde" (vacío = hoy; no deja elegir días pasados). Lo cobrado no cambia; el que viene se ve con 📅 y se puede anular. (PLA-5) | ✅ | Aumento de varios a la vez (PLA-4) | `lista_precios_plan`, `programar_lista_precios`, `anular_precio_programado` | — |
| ✏️ Editar | Nombre, descripción y veces por semana. El tipo y la duración no: cambiarían lo ya vendido. | ✅ (nuevo, AUD-5) | — | `guardar_plan` | — |
| Dejar de vender / Volver a vender | Lo saca de Vender y de la página; los socios que lo tienen siguen igual. | ✅ (arreglado, AUD-5: borraba las veces por semana) | — | `guardar_plan` | — |
| 🥤 Productos | Agregar, ✏️ Editar (nombre y precio), Ocultar/Mostrar en Vender. Vacío: "Todavía no cargaste productos". | ✅ (editar nuevo, AUD-5) | Stock (no existe) | `guardar_producto`, Vender | — |
| Montos | "84.500", "84500,50", "1500.50" y "$ 1.500" se leen bien; lo que no se entiende avisa cómo escribirlo. | ✅ (arreglado, AUD-5) | — | `leerMonto()` | — |
| Celular (390 px) | Sin desborde. | ✅ | — | — | — |

## Lo que se arregló

- **"Dejar de vender" borraba datos del plan.** `guardar_plan` pisaba con
  vacío todo lo que no venía; el botón mandaba solo nombre y activo. Un plan
  de 2 veces por semana quedaba libre y la Entrada dejaba pasar de más.
  Migración `0055`: la base cambia solo lo que viene.
- **"1500.50" se cobraba como 150.050.** El lector de montos sacaba todos los
  puntos. `leerMonto()` en `src/lib/formato.ts`, con pruebas.

## Lo que se pensó en cadena

- Vender y Caja leían montos con su propia cuenta y tenían el mismo problema
  ("1.500" en Vender se lee 1,5; "1500.50" en Caja, 150.050). Toca plata: se
  arregla en AUD-6 usando `leerMonto()`.
- Un precio nuevo arma una lista nueva: si hoy hay un precio en efectivo más
  barato, subir el precio general lo borra sin avisar. Lo resuelve PLA-5 (el
  precio se edita como lista completa).
