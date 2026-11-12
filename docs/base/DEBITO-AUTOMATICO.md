# Débito automático con MercadoPago (N1)

Estado: 🔌 base y aviso listos y probados con el simulador local; **apagado** (interruptor `debito_automatico`, N5). No cobra sin las credenciales
reales del gimnasio. Toca plata: antes de prenderlo en un gimnasio real lo mira Mateo (ver `PREGUNTAS.md`, P-N3).

## Cómo funciona

1. El socio se adhiere una vez: se crea una **suscripción** (preapproval) en MercadoPago con el monto mensual. La base la guarda en
   `debitos_automaticos` (ID de MercadoPago, monto acordado, estado `pendiente | activa | pausada | cancelada`, una viva por socio).
2. Cada mes MercadoPago cobra y avisa al webhook `POST /api/webhooks/mercadopago-debito?g=<gimnasio>`:
   - la firma `x-signature` se verifica con la clave del webhook **del gimnasio** (la misma de los pagos online); sin firma válida, 401;
   - el estado y el monto se **leen de la API de MercadoPago** con el token del gimnasio, no del aviso;
   - el evento se registra en `eventos_webhook` (`mp_cobros` / `debito_cobro` / `<id de pago>:<estado>`): el mismo aviso otra vez no hace nada;
   - la base (`acreditar_cobro_debito`, solo `service_role`) acredita **una vez por ID de pago de MercadoPago** (`cobros_debito`, único por gimnasio),
     exige que el monto coincida con el acordado, crea la venta de la cuota con un pago `debito_automatico` aprobado y la confirma: la cobertura se mueve
     como en cualquier cobro.
3. Un cobro rechazado se anota sin tocar nada. Una **devolución o un contracargo no se revierten solos** (devuelven `devolucion_manual`): toca plata y lo resuelve una persona.
   Un cobro que llega con la adhesión cancelada o sin membresía queda como `sin_acreditar` para devolverlo a mano; la pantalla lo muestra.
4. Con la función apagada el aviso responde 200 y no acredita nada, pero el evento **queda abierto**: prendida después, el mismo aviso se acredita (no se pierde un cobro).
5. Los avisos de la suscripción (`subscription_preapproval`: authorized, paused, cancelled) cambian el estado de la adhesión. Una cancelada no revive.

## Qué se probó

- Base (`supabase/pruebas/n-nuevas.test.mjs`): apagado no deja ver, adherir ni acreditar; solo el servidor acredita; idempotencia por ID externo; monto distinto
  rechazado; rechazo, devolución y cancelación; la cobertura avanza con el pago.
- Unitarias (`src/lib/mp-debito-procesar.test.ts`): normalización del cobro, evento único, error del monto, función apagada.
- Pantallas (`scripts/e2e/n-nuevas.mjs`, demo, simulador `scripts/local/mp-simulado.mjs`): aviso firmado se acredita, reenvío no, firma mala 401, monto distinto 500,
  cobro tarde con la adhesión cancelada no se acredita.

## Lo que falta para producción (🔌 y ⛔)

1. 🔌 **Crear la suscripción contra MercadoPago.** Hoy la adhesión la deja la prueba por la base (`registrar_adhesion_debito` existe, pero no hay botón
   "Adherir" que llame a `POST /preapproval` con el token del gimnasio y mande al socio al link de autorización). Falta: la pantalla y la acción del servidor, y el flujo del
   socio en su app.
2. 🔌 **Confirmar los campos reales de la API.** `normalizarCobroDebito` está escrito según la documentación (`/authorized_payments/{id}`, `/preapproval/{id}`);
   hay que verificarlo con una cuenta real en modo prueba antes de prender (nombres de estado: `processed`, `recycling`, `approved`…).
3. 🔌 **Dar de alta en MercadoPago** el webhook de suscripciones (`subscription_authorized_payment` y `subscription_preapproval`) apuntando a la dirección de arriba, con la clave secreta del gimnasio.
4. ⛔ **Devoluciones y contracargos de cobros automáticos**: hoy solo avisan. Falta decidir la regla (P-N3) y construir la reversión (hoy existe `revertir_pago_mp` solo para pagos con checkout).
5. ⛔ **Reintentos y mora**: qué pasa con la membresía cuando el débito falla (hoy: nada, sigue la regla de vencimiento de siempre; la puerta no cambia).
6. Probarlo en el proyecto de ensayo (N0) y en el gimnasio `[demo]` de producción, nunca con socios de Temple Gym.
