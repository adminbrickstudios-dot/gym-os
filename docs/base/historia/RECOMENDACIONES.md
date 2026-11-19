# Recomendaciones (11/11, Temple Gym ya en uso)

Lo que cambiaría en la forma de trabajar ahora que hay un gimnasio real
cobrando con Base, y las funciones nuevas que propongo. Las funciones están en
`RECTA-FINAL.md` (fase N). Lo de la forma de trabajar se aplica desde ya.

## Cómo trabajar desde ahora

1. **Ensayo antes de producción.** Un segundo proyecto de Supabase, gratis, que
   se llame "ensayo", con la vista previa de Vercel apuntando a él. Cada
   migración se aplica primero ahí, se prueba con la app de vista previa, y
   recién después va a producción. Con datos reales, probar directo en
   producción es apostar la plata del cliente. Lo crea Mateo en 5 minutos (pasos
   en `PROGRESO.md`, ⛔ hasta entonces). El agente deja el workflow listo.
2. **Copia antes de cada publicación** (H5): cifrada, nunca como archivo
   abierto, y con restaurar probado.
3. **Lo nuevo, primero en el demo.** Cada función nueva arranca apagada para
   Temple Gym (interruptor por gimnasio). Se prende cuando pasó en el demo y en
   el ensayo. Así un error nuevo no le cae al cliente en la hora pico.
4. **Publicar chico y seguido**, con una nota de "Qué hay de nuevo" para el
   dueño, en palabras simples, adentro del panel.
5. **Un solo canal para los pedidos.** Lo que Mateo o el gimnasio reportan va a
   `CAMBIOS-MATEO.md`, y el loop lo toma primero. No hace falta escribirle un
   prompt nuevo al agente por cada cosa.
6. **Errores de producción a la vista.** Sentry tiene un plan gratis; mientras
   no esté, el registro propio de errores de `/super` (SA-9). Cada error de
   Temple Gym le avisa a BRIK antes de que llame el cliente.
7. **Nunca probar en Temple Gym.** Las pruebas en producción van en un gimnasio
   `[demo]` que copia la configuración de Temple Gym (planes, reglas, sedes),
   nunca con sus socios.

## Funciones que propongo (fase N)

- **Débito automático con MercadoPago** (suscripciones): el socio se adhiere
  una vez y se le cobra solo cada mes. El webhook crea el pago. Es lo que más
  baja la mora en los gimnasios. Necesita las credenciales de MercadoPago del
  gimnasio (🔌).
- **Apto físico como fecha**: "presentó apto médico, vence el 12/03", sin
  guardar el certificado ni nada de salud. Avisa antes de que venza y, si el
  gimnasio lo elige, la entrada avisa o frena. En muchas provincias el apto es
  obligatorio para entrenar.
- **Resumen de la noche para el dueño**: a las 22 h, en la campana y por push,
  cuánto se cobró, cuántos entraron, altas, bajas y si la caja quedó cerrada.
  Se calcula al abrirlo: no depende de un cron.
- **De dónde vienen los socios nuevos**: el link de "Quiero ser socio" con su
  origen (Instagram, QR de la puerta, WhatsApp, referido) y cuántos se
  convierten en socios que pagan.
- **Factura electrónica (ARCA)**, opcional por gimnasio, una factura C por cada
  cobro (🔌, cuando haya servicio contratado).
- **Molinete o cerradura** (🔌, hardware): un punto de la API que abre si la
  entrada da verde, con la misma función de siempre.
