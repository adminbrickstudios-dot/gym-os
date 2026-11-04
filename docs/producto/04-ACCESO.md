# Cómo se entra al gimnasio

Todas las formas terminan en **la misma función** (`estado_acceso` +
registrar la entrada): misma respuesta, mismo motivo, mismo registro. Cada
gimnasio prende las que usa (Configuración → Entrada) y pueden convivir.

## Las formas

| # | Forma | Cómo es | Hace falta | Para quién | Estado |
|---|---|---|---|---|---|
| A1 | **Recepción busca** | Nombre, DNI o número de socio en Entrada | Una compu o tablet | Todos | ✅ (mejora ENT-1) |
| A2 | **Socio muestra su QR** | La app muestra un QR que cambia cada 30 s; la recepción lo escanea con la cámara de la compu/tablet o con un lector USB | Cámara o lector (lector USB de QR ~$20.000) | Recepción atendida, mucho tráfico | 🆕 ENT-2 |
| A3 | **Tablet en la puerta (kiosco)** | El socio escribe su DNI (o su PIN) en una tablet fija | Una tablet vieja | Gimnasio chico, recepción ocupada | 🆕 ENT-3 |
| A4 | **Kiosco con QR en pantalla** | La tablet muestra un QR que cambia cada 30 s; el socio lo escanea con su app y la tablet lo saluda en verde | Una tablet (sin cámara) | Sin recepción o 24 h | 🆕 ENT-6 |
| A5 | **Tarjeta o llavero** | Llavero RFID; el lector USB "escribe" el número en el buscador de Entrada o del kiosco | Lector USB RFID (~$15.000) y llaveros | Gimnasio clásico, gente grande que no usa app | 🆕 ENT-7 |
| A6 | **Molinete o cerradura** | El veredicto verde abre un relé (la recepción o el kiosco le avisan al equipo de la puerta) | Molinete con entrada de relé + placa (🔌) | Cadenas, 24 h | 🔌 ENT-5 |
| A7 | **Reserva = entrada** | En gimnasios de clases, el presente que toma el profe cuenta como entrada | — | Box, yoga, pilates | 🆕 CLA (presente → ingreso) |

**No se usan huella ni cara**: son datos biométricos (Ley 25.326, datos sensibles); exigen consentimiento, registro y seguridad que no se justifican. Si un gimnasio lo pide, se integra un equipo externo por relé (A6) y el dato nunca entra a Gym OS.

## Reglas que valen para todas

- **Veredicto siempre con motivo**: "✅ Al día hasta el 30/11", "🟡 Vence hoy: cobrale", "⛔ Venció el 2/11 · debe $28.000", "⛔ Ya entró hoy hace 5 min (otro QR)".
- **Anti-préstamo**: el QR vence a los 30 s y no se puede usar dos veces; la entrada muestra la **foto** del socio (SOC-7) para que la recepción compare; dos entradas del mismo socio en menos de N minutos (configurable, por defecto 60) → amarillo "ya entró hace 12 min".
- **Horario del plan**: si el plan es "solo mañana" y son las 19 h → rojo con el motivo (PLA-2).
- **Clases**: en gimnasios con reserva, si el socio tiene clase reservada se muestra "Tenés Spinning a las 19:00 ✓".
- **Rojo con salida**: desde el rojo, un toque a Cobrar (con el plan sugerido) o a Dejar pasar (con motivo y tope, D1).
- **Sin internet**: SEG-5 (después del MVP); mientras tanto, la recepción anota a mano y la pantalla lo dice claro.
- **Todo queda registrado**: quién, cómo (A1…A7), cuándo, con qué resultado, quién lo dejó pasar.

## Lo que ve el socio

- En la app, arriba de todo: semáforo grande, "Al día hasta el 30/11", su QR y "Mostrá esto en la entrada".
- Si está rojo: el motivo y un botón **Pagar ahora** (MercadoPago o transferencia).
- Después de entrar: "Entraste 19:04 ✓ · llevás 12 entradas este mes 🔥".
