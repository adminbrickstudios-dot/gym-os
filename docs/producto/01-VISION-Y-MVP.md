# Visión y MVP

## Qué es

Gym OS es el sistema del gimnasio: quién puede entrar, quién pagó, quién se
está yendo y qué hay que hacer hoy. Lo usan cinco personas distintas:

| Quién | Para qué lo abre | Dónde |
|---|---|---|
| 👑 **Dueño** | Ver cómo va el negocio, la plata, quién se va; configurar | Celular, a cualquier hora |
| 🛎️ **Recepción** | Dejar entrar, cobrar, abrir y cerrar caja, atender | Compu o tablet en el mostrador |
| 💪 **Profe** | Sus clases, el presente, las rutinas de sus alumnos | Celular |
| 🏃 **Socio** | Entrar, saber si está al día, pagar, reservar, ver su rutina | Celular (app instalable desde la web) |
| 🧱 **BRIK** (super admin) | Dar de alta gimnasios, soporte, cobrarles el sistema | Compu |

## El problema que resuelve (en palabras de un dueño)

- "No sé quién está al día sin revisar un cuaderno."
- "Cobro en efectivo y no sé si la plata que está en la caja es la que tiene que estar."
- "La gente deja de venir y me entero cuando ya no paga."
- "Paso horas mandando WhatsApp de cobro."
- "Para hacerse socio alguien tiene que venir, llenar una ficha y pagar en el mostrador."
- "Las clases se llenan de más o quedan vacías y nadie avisa."

## Qué se automatiza (que nadie se tenga que mover)

| Antes | Con Gym OS |
|---|---|
| El socio viene a hacerse socio | Se registra y paga desde la página del gimnasio, entra al día siguiente o en el momento |
| La recepción busca en un cuaderno | El socio muestra su QR o pone su DNI y la puerta dice verde o rojo con el motivo |
| El dueño manda WhatsApp de cobro | El sistema avisa solo antes de vencer, el día que vence y después |
| El socio pide su recibo | Le llega solo después de cada pago |
| El dueño cuenta la plata con desconfianza | Arqueo ciego, cada cobro con nombre, resumen diario automático |
| "¿Hay lugar en la clase?" | Reserva desde la app, con cupo y lista de espera que sube sola |
| "¿Quién dejó de venir?" | Lista de retención armada sola cada día, con el mensaje listo |
| Transferencias que hay que chequear una por una | El socio sube el comprobante; con MercadoPago, se acredita solo |
| Aumentos de cuota a mano | Aumento programado: avisa a los socios y cambia solo en la fecha |

## MVP: lo que tiene que estar para vender (semana de prueba)

Un gimnasio real tiene que poder usarlo una semana entera sin llamar a BRIK.

**Para el dueño**
- [ ] Primeros pasos guiados: datos, logo y colores, planes, horarios, medios de pago, equipo, socios (importar Excel), publicar la página
- [ ] Inicio con los números del día y lo que hay que hacer
- [ ] Configuración completa en pestañas, todo explicado
- [ ] Resultado: la plata del mes por medio y por plan
- [ ] Resumen diario (en la app y por mail cuando esté conectado)

**Para la recepción**
- [ ] Entrada: buscar, QR, DNI o tarjeta → veredicto grande con motivo
- [ ] Vender y cobrar (cuotas, pases, packs, productos), precio por medio de pago
- [ ] Caja: abrir, retiros, cerrar con arqueo ciego
- [ ] Transferencias por aprobar
- [ ] Vencen hoy con WhatsApp listo

**Para el socio**
- [ ] Registrarse y pagar desde la página del gimnasio
- [ ] App: semáforo y QR, vencimiento, pagar o renovar, reservar clases, historial, avisos
- [ ] Comprobante de cada pago

**Para el profe**
- [ ] Sus clases, tomar presente

**Para BRIK**
- [ ] Crear gimnasio por tipo, entrar como soporte, claves, direcciones, salud de cada gimnasio

Lo que **no** es MVP y viene después: molinete, facturación electrónica ARCA,
WhatsApp automático oficial, multi-sede avanzada, comisiones de profes,
entrada sin internet.
