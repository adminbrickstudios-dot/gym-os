# Caja y control: que nadie se pueda quedar con plata

La idea central: **la puerta está atada al pago**. Si alguien cobra y no lo
registra, ese socio sale en rojo en la entrada y en su app dice "no pagaste".
El socio reclama y el robo aparece solo. Encima de eso, cada paso queda con
nombre y hora, y el dueño lo ve en el momento.

## El día de la caja

| Momento | Qué pasa | Estado |
|---|---|---|
| **Abrir** | La recepción abre su turno con el efectivo que hay (fondo). Sin caja abierta no se puede cobrar en efectivo | ✅ |
| **Cobrar** | Cada cobro va a la caja abierta, con quién, qué, medio y hora. El precio lo pone el sistema | ✅ |
| **Retiro** | Sacar plata (pago a proveedor, cambio) con motivo obligatorio y foto del ticket opcional → aviso al dueño | ✅ retiro · 🆕 foto y aviso (CAJ-4) |
| **Ingreso** | Poner plata (más cambio) con motivo | ✅ |
| **Cambio de turno** | La que se va cierra; la que llega abre. No se comparte una caja entre dos personas | ✅ (PIN: CAJ-3) |
| **Cerrar** | Cuenta el efectivo **sin ver cuánto tenía que haber** (arqueo ciego); el sistema compara | ✅ |
| **Diferencia** | Si falta o sobra más que el margen que pone el dueño → aviso al dueño en el momento, con nombre y monto | 🆕 CAJ-4 |
| **Caja olvidada abierta** | Si a la hora de cierre del gimnasio sigue abierta → aviso a quien la abrió y al dueño; al día siguiente pide cerrarla antes de abrir otra | 🆕 CAJ-5 |

## Controles

1. **Precios fijos**: la recepción no escribe precios; elige qué vende.
2. **Descuentos con motivo y tope** (por persona, configurable) → aparecen en el resumen del dueño.
3. **Anular una venta**: solo encargado o dueño, con motivo, nunca se borra (queda tachada) → aviso al dueño. La recepción puede **pedir** la anulación.
4. **Dejar pasar con tope** diario por persona (D1) → resumen del dueño.
5. **Comprobante automático al socio** en cada cobro: "Si no te llegó el comprobante, avisanos" (en la app y la página) convierte a los socios en auditores.
6. **Arqueo ciego** al cerrar.
7. **Cada uno con su usuario o PIN** (D15): nada se hace "como la recepción" en general.
8. **Registro que no se borra**: ventas, anulaciones, retiros, descuentos, dejados pasar, cambios de precio y de plan. Nadie, ni el dueño, borra historia; se corrige con un movimiento nuevo.
9. **Cruces automáticos** (EQU-3 y RES):
   - Entró pero no tiene pago que lo cubra (y no lo dejaron pasar) → no debería existir; si existe, alerta.
   - Muchas entradas "dejadas pasar" a la misma persona → alerta.
   - Transferencias aprobadas sin comprobante → no se puede.
   - Pagos en efectivo que se anulan y vuelven a cobrar por transferencia → alerta.
10. **Invitados** (pase de cortesía): se registra con nombre y DNI, límite por socio por mes, nunca anónimo (INV-1).
11. **Resumen diario al dueño** (AVI-4): cobrado por medio y por persona, diferencias de caja, retiros, descuentos, anulaciones, dejados pasar, entradas, altas y bajas. En la app a las 22 h (o al cerrar la última caja) y por mail cuando esté conectado.

## Lo que ve cada uno

- **Recepción**: su caja (lo que cobró por medio, sin el total esperado de efectivo), sus ventas del turno, botones Abrir / Retiro / Cerrar.
- **Encargado**: todas las cajas abiertas en vivo, con lo esperado.
- **Dueño**: todo, en vivo y en el historial (CAJ-1), con las alertas arriba.
