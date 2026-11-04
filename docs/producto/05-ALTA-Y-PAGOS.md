# Alta y pagos: el socio se registra y paga solo

## Hacerse socio desde la página del gimnasio (REG-1)

1. En la página, **"💪 Hacete socio"** (y en cada plan, "Elegir este").
2. Elige plan (con precio por medio de pago visible: "Efectivo $25.000 · Transferencia $26.000 · Tarjeta $28.000").
3. Sus datos: nombre, apellido, DNI, celular, mail, fecha de nacimiento (opcional, para el saludo de cumpleaños). Si es menor: datos del adulto responsable (D10).
4. **Reglamento** del gimnasio (texto que escribe el dueño en Configuración): casilla "Leí y acepto" → se guarda versión, fecha y hora.
5. **Cómo paga**:
   - **MercadoPago** (si el gimnasio lo conectó): paga en el momento → queda **al día** apenas MercadoPago confirma (webhook firmado, idempotente).
   - **Transferencia**: ve alias/CBU con botón copiar, sube el comprobante → queda **pendiente** hasta que la recepción lo aprueba (aviso a la recepción en el momento).
   - **En el mostrador**: queda **pendiente de pago**; en la entrada sale amarillo "Se registró online: cobrale el plan X".
6. Se crea su cuenta (entra con el código que le llega, ver P1) y aterriza en la app: "¡Bienvenido a Olympo! 🎉".
7. El gimnasio recibe aviso: "🌱 Nuevo socio online: Juan Pérez · Plan Libre · pagó con MercadoPago".

**Si el DNI ya existe** (ya era socio): no duplica; le ofrece "Ya sos socio, entrá con tu celular" y vincula.
**Si el gimnasio no quiere altas online**: interruptor en Configuración → la página muestra "Consultanos por WhatsApp".

## Renovar y pagar desde la app

- **Pagar ahora** en la app: elige medio (MercadoPago / transferencia), con el precio de cada uno.
- **Débito automático** (MP-3, 🔌): el socio adhiere su tarjeta una vez; se cobra solo cada mes; si falla, aviso al socio y al gimnasio y queda amarillo con días de gracia.
- **Adelantar meses**: pagar 3/6/12 meses si el plan lo ofrece (PLA-1), con el descuento que ponga el dueño.

## Medios de pago

| Medio | Cómo se acredita | Dónde queda | Estado |
|---|---|---|---|
| Efectivo | La recepción cobra en Vender | Caja del turno | ✅ |
| Transferencia en mostrador | La recepción cobra en Vender | Caja del turno (medio transferencia) | ✅ |
| Transferencia desde la app | Comprobante → aprobación | "Transferencias" (no caja) | ✅ |
| Débito / crédito con posnet | La recepción cobra en Vender | Caja del turno (medio tarjeta) | ✅ |
| MercadoPago link / checkout | Webhook firmado | "Pagos online" | 🔌 MP-2 |
| Débito automático MercadoPago | Webhook de suscripción | "Pagos online" | 🔌 MP-3 |
| Dos medios a la vez | Vender | Caja | ✅ |

Precio **por medio de pago** y **por día** (pase diario en semana o finde): ya en la base, falta pantalla (PLA-5).

## Comprobantes (VEN-1)

Cada pago genera un comprobante con link único (no adivinable): gimnasio, socio,
qué pagó, cuánto, medio, quién cobró, fecha y hora, número correlativo. Se manda
solo al socio (app, y por WhatsApp/mail cuando estén conectados) y queda en
su historial. **No es factura**: la factura electrónica de ARCA es FAC-1 (🔌,
después del MVP, con un integrador: TusFacturas, Facturante o similar).

## Lo que nunca pasa

- Un pago online que no se acredita: el webhook es la verdad; si el socio vuelve de MercadoPago antes que el webhook, ve "Estamos confirmando tu pago…" y la pantalla se actualiza sola.
- Un cobro doble: cada pago online tiene su ID externo (`eventos_webhook`); el mismo evento dos veces no acredita dos veces.
- Cobrar un precio distinto al que ve el socio: el precio lo calcula la base al momento de pagar, y se muestra antes.
