# Inicio · inventario botón por botón (AUD-14)

Ruta `/panel`, para los cuatro roles. Probado con `npm run e2e:inicio` (cada rol: saludo, 4 números, "Ahora y lo que sigue" y cada acceso rápido abriendo su pantalla).

| Elemento | Qué hace hoy | Anda | Qué le falta | Se conecta con | Configurable |
|---|---|---|---|---|---|
| Saludo | "Buen día, Nombre 👋", fecha y gimnasio. | ✅ | — | `panel_gimnasio` | — |
| Primeros pasos | Al dueño, hasta que arma lo básico (o los oculta). | ✅ (ONB-1) | — | `primeros_pasos` | — |
| Accesos rápidos | Grilla editable ("✏️ Elegir mis accesos", hasta 9, el primero en verde). Solo los de su rol y secciones prendidas. | ✅ | — | `guardar_accesos_rapidos` | Por persona |
| 4 números | Dueño/encargado: entraron, vencen, cobrado, al día. Recepción: sin lo cobrado salvo que el dueño lo prenda (EQU-1). Profe: sus clases, anotados, presentes, le quedan. Cada uno lleva a su detalle. | ✅ | — | `panel_inicio` | EQU-1 |
| Ahora y lo que sigue | Clases, cajas, transferencias por aprobar… lo que lleva a una pantalla apagada no se muestra. | ✅ | — | `panel_inicio` | — |
| 👋 Pidieron la baja | Los que pidieron la baja desde la app, con el motivo; abre la ficha para resolver. | ✅ (nuevo) | — | `pedidos_baja_pendientes` | — |
| Dejados pasar, invitados, caja abierta, alertas de caja, por reponer, ventas para anular, pausas para aprobar, cumpleaños | Cada bloque aparece solo si hay algo. | ✅ | — | varias | — |
