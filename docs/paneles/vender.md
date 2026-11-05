# Vender, Caja y Transferencias · inventario botón por botón (AUD-6)

Rutas `/panel/vender`, `/panel/caja`, `/panel/transferencias`. Las ven dueño,
encargado y recepción (el profe no). Caja y Transferencias se apagan por
gimnasio (CFG-7); sin Caja no se cobra en efectivo.

Probado haciendo clic con `npm run e2e:vender` (`scripts/e2e/panel-vender.mjs`,
12 pasos): recepción en compu, dueña en celular.

| Elemento | Qué hace hoy | Anda | Qué le falta | Se conecta con | Configurable |
|---|---|---|---|---|---|
| Buscar socio | Para cuotas, pases y packs; sin socio, solo productos y "otra cosa". | ✅ | — | `buscar_socios` | — |
| Botones de lo que se vende | Cuota del plan del socio, pases, packs, productos, matrícula (si la debe) y "✍️ Otra cosa". El precio cambia con el medio elegido. | ✅ | — | `precios_venta` | Qué cobrás, Planes |
| Carrito | Cantidad (+/−), 🏷️ Descuento con motivo (la recepción, hasta su tope), recargo por pagar tarde (va con la cuota). | ✅ | — | `vender` | Descuento máximo, recargo |
| ¿Cómo paga? | Los medios que acepta el gimnasio; sin caja abierta no arranca en efectivo (arreglado, AUD-6). "➗ Paga con dos medios" dice cuánto falta. | ✅ | — | — | Medios de pago |
| ✅ Cobrar | La base vuelve a calcular todo y cobra; "Cobrado $…" con el veredicto del socio. "↩️ Anular" (dueño y encargado) o "pedir que la anulen" (recepción). | ✅ | Comprobante por WhatsApp (VEN-1) | `vender`, `anular_venta_panel`, `pedir_anulacion` | — |
| Montos escritos a mano | "1.500", "1500,50" y "1500.50" se leen bien (arreglado, AUD-6: "1.500" era $1,50). | ✅ | — | `leerMonto()` | — |
| Caja · Abrir | Con cuánto arranca. | ✅ | Caja olvidada abierta (CAJ-5) | `abrir_caja` | — |
| Caja · Entra / Sale plata | Monto y motivo. | ✅ | Foto del ticket y aviso al dueño (CAJ-4) | `movimiento_caja` | — |
| Caja · Cerrar | Arqueo ciego: la recepción cuenta y recién ahí ve cuánto tenía que haber; el dueño y el encargado lo ven siempre. Caja justa, sobran o faltan. | ✅ | Historial de turnos (CAJ-1), cierre para compartir (CAJ-2) | `cerrar_caja`, `resumen_caja` | — |
| Transferencias | Comprobantes de la app: ver (link de 10 minutos), aprobar, rechazar con motivo. "Nada para revisar" si no hay. | ✅ ("Ver comprobante" ya no lo bloquea el celular, AUD-6) | — | `pagos_por_aprobar`, `aprobar_pago`, `rechazar_pago` | Sección Transferencias |
| Celular (390 px) | Sin desborde. | ✅ | El carrito queda abajo de todo (DIS-4) | — | — |

## Lo que se pensó en cadena

- Para que el dueño controle la caja necesita ver los movimientos y los turnos
  cerrados: CAJ-1 y CAJ-4 ya están en la cola.
- El error de la base dice "Tu descuento máximo es 10.00 %": el número sale
  con dos decimales. Se arregla la próxima vez que se toque `privado.vender`.
