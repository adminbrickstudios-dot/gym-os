# Entrada · inventario botón por botón (AUD-4)

Ruta `/panel/entrada`. La ven dueño, encargado y recepción; el profe no
(barrido). Con la sección Entrada apagada no abre (CFG-7). Con varias sedes,
el dueño elige la sede; quien tiene una sede asignada ve la suya. Lee
`buscar_socios` (vía `buscarSociosRapido`), `estado_acceso`, `apto_socio`,
`pausas_socio`, `ingresos_del_dia`; escribe `registrar_ingreso`,
`anular_ingreso`, `descongelar`.

Probado haciendo clic con `npm run e2e:entrada` (`scripts/e2e/panel-entrada.mjs`,
12 pasos): recepción en compu y celular, dueña para la pausa y el apto.

| Elemento | Qué hace hoy | Anda | Qué le falta | Se conecta con | Configurable |
|---|---|---|---|---|---|
| Buscador | Arranca con foco y vuelve a tenerlo después de cada entrada. Nombre, DNI, teléfono o número; desde 2 letras. Enter elige al primero, Esc limpia. | ✅ | Lector de llavero/QR (ENT-2, ENT-7) | `buscar_socios` | — |
| 📷 Leer QR | Si el gimnasio prendió "QR del socio": abre la cámara y lee el QR de la app; un lector USB escribe el código en el buscador y Enter. La base dice de quién es, si venció, si ya se usó o si es de otro gimnasio. Si puede entrar, se anota solo (forma "con QR"); si no, queda el veredicto. (ENT-2) | ✅ | — | `leer_qr`, `estado_acceso`, `registrar_ingreso` | Sí (Reglas → QR del socio) |
| Resultados | Punto de color, nombre, #número y el porqué. | ✅ | — | — | — |
| No lo encuentra | "No encontramos a … · Darlo de alta". | ✅ | Pase de invitado o de prueba desde acá (INV-1, CLA-6) | Alta | — |
| Veredicto | A pantalla completa del color: emoji, foto (si tiene), nombre grande, el porqué, avisos, "para ponerse al día $…". Suena distinto si entra o no. Enter anota (solo si puede), Esc vuelve a buscar, escribir busca a otro. (ENT-1) | ✅ | — | `estado_acceso` | 🔊/🔇 por compu |
| Aviso de apto | Si el gimnasio pide apto y no lo presentó o venció: "🩺 …" en amarillo. No frena. | ✅ (nuevo, AUD-4) | — | `apto_socio`, Reglas | Sí (Reglas → Pedir apto) |
| ✅ Anotar entrada | Anota y muestra "Entró <nombre>". Repetido en el momento: "ya estaba anotado". | ✅ | — | `registrar_ingreso` | Reingreso (Reglas) |
| ↩️ Deshacer | Después de anotar: la anula ("Anotada por error"). La recepción, dentro de los 5 minutos. | ✅ (nuevo, AUD-4) | — | `anular_ingreso` | — |
| 💵 Cobrar | Rojo o amarillo: abre Vender con el socio. | ✅ | Con la cuota del plan ya en el carrito (como el alta, SOC-13) | Vender | Se va con Vender apagado |
| 🏃 Volvió antes | En pausa: en vez de Cobrar, termina la pausa hoy y el veredicto se actualiza. | ✅ (nuevo, AUD-4) | Si la pausa empezó hoy, la base pide anularla (lo hace dueño o encargado) | `descongelar` | — |
| 🚪 Dejar pasar igual | Motivos frecuentes de un toque o texto libre; lo anota como "Lo dejaron pasar". La recepción tiene un tope por día (dice cuántos le quedan); a suspendidos y dados de baja solo los deja pasar el dueño o el encargado. Lo controla la base. (ENT-4, D1) | ✅ | — | `registrar_ingreso`, `cupo_dejar_pasar` | Sí (Reglas → tope) |
| 👤 Ver ficha · ✕ Otro socio | Abre la ficha; vuelve a buscar. | ✅ | — | Ficha | — |
| Hoy | Cuántos entraron (personas, no entradas) y las últimas 40: hora, color, resultado, forma (QR, tablet…) y quién dejó pasar. Toca → ficha. | ✅ | Ver un día anterior y filtrar "los que dejaron pasar" (ENT-8) | `ingresos_del_dia` | — |
| Hoy · ⋯ Anular | Con motivo. La recepción solo en los primeros 5 minutos; dueño y encargado siempre (lo decide la base y lo dice). | ✅ (nuevo, AUD-4) | — | `anular_ingreso` | — |
| Celular (390 px) | Sin desborde, con el veredicto abierto. | ✅ | — | — | — |

## Lo que se pensó en cadena

- Para que el dueño controle a la recepción necesita ver **a quién dejaron
  pasar y por qué**, sin abrir la Entrada de cada día: ENT-8.
- Para que la recepción no tipee en hora pico, el socio tiene que entrar solo
  (QR o tablet): ENT-2, ENT-3, ENT-6 ya están en la cola.
- Para cobrar en la puerta sin pasos de más, Cobrar tiene que llegar con la
  cuota en el carrito: ENT-9.
