# Avisos y automatizaciones

**Regla:** nada que importe depende de un cron. Los avisos se **calculan** al
abrir la bandeja o al llegar la hora; si un envío falla, el estado del socio no
cambia y el aviso queda pendiente para mandar a mano.

## Canales

| Canal | Costo | Para qué | Estado |
|---|---|---|---|
| **En la app** (campana 🔔 y tarjeta arriba) | Gratis | Todo | 🆕 AVI-5 |
| **Notificación push** del celular (web push, la app instalada) | Gratis (claves VAPID propias) | Socio: vence, reserva, cancelaciones. Dueño: alertas de caja, resumen diario. En iPhone, requiere la app agregada a inicio | 🆕 PUSH-1 |
| **WhatsApp armado** (un toque abre WhatsApp con el mensaje listo) | Gratis | Cobranza, retención, cumpleaños, bienvenida | ✅ en retención · 🆕 AVI-1 bandeja |
| **Mail** | Gratis hasta 3.000/mes (Resend) | Comprobantes, resumen diario, códigos de ingreso | 🔌 AVI-2 |
| **WhatsApp automático** (API oficial) | Paga por mensaje | Cuando el gimnasio lo quiera | 🔌 AVI-3 |

Cada gimnasio elige qué aviso va por qué canal y edita los textos (CFG-5).

## Los avisos

**Al socio**
| Cuándo | Mensaje (editable) |
|---|---|
| Se registra | Bienvenida + cómo entrar + reglamento |
| Cada pago | Comprobante |
| 3 días antes de vencer | "Tu plan vence el viernes. Pagá desde la app 👉" |
| El día que vence | "Hoy vence tu plan" |
| Venció hace 3 días | "Te extrañamos 💪, renová acá" |
| Transferencia aprobada / rechazada | Con el motivo si se rechaza |
| Reserva confirmada / sube de la espera / clase cancelada | Con la hora y la actividad |
| No viene hace 10 días (configurable) | "¿Todo bien? Te esperamos" |
| Cumpleaños | Saludo (y regalo si el dueño lo configura: un pase para un amigo) |
| Aumento programado | 15 días antes, con el precio nuevo |
| Pack por terminarse | "Te quedan 2 clases" |
| Débito automático falló | "No pudimos cobrar tu tarjeta" |

**Al gimnasio (dueño, encargado, recepción según corresponda)**
| Cuándo | A quién |
|---|---|
| Nuevo socio online / prospecto nuevo | Recepción y dueño |
| Transferencia para aprobar | Recepción |
| Diferencia de caja, retiro, anulación, descuento grande | Dueño |
| Caja olvidada abierta | Quien la abrió y dueño |
| Resumen diario | Dueño |
| Resumen semanal (altas, bajas, plata, retención) | Dueño |
| Clase llena / clase sin anotados 2 h antes | Profe y encargado |
| Socio pide pausa o baja | Encargado y dueño |
| Stock bajo | Encargado |

## Bandeja de avisos (AVI-1)

Una pantalla con todo lo que hay que avisar hoy, agrupado (vencen, vencidos,
no vienen, cumpleaños, rechazados), con el mensaje ya escrito y **"Avisar a
todos"**: va abriendo WhatsApp uno por uno y marca "avisado ✓". Lo que tenga
canal automático conectado, sale solo y aparece como "enviado".

## Otras automatizaciones

- **Aumento programado** (PLA-4): cambia el precio solo en la fecha.
- **Lista de espera**: sube sola cuando se libera un lugar (✅ en la base).
- **Turnos fijos** (CLA-2): reserva sola cada semana mientras esté al día.
- **Cierres y feriados**: cancelan las clases y compensan días (✅ en la base).
- **Débito automático**: cobra solo (🔌).
- **Prospectos**: si no se contactó en 24 h, sube a la bandeja.
