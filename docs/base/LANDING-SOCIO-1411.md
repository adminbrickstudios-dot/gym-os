# La página del gimnasio y la app del socio, simples (Mateo, 14/11)

Pedido de Mateo, textual en lo importante: *"hay que diseñarla de nuevo para que el cliente entre y vea
pocas cosas e info con nombre del gym, pone quiero ser socio, y le crea una cuenta gratis, después podrá
pagar desde la app, por ahora que adentro del panel de cliente aparezca de todo un poco como dijimos con
esos botones, que la cuenta tiene que ser paga para que el QR funcione, que esté lo del DNI"*.

Completa `SOCIO-FLUJO.md` (H3b, que ya está hecho): se rediseña, no se rehace. Va como **fase L** en
`RECTA-FINAL.md`, después de la velocidad (E8/E4).

---

## L1 · La página del gimnasio: una pantalla, pocas cosas

Lo que se ve al entrar, en el celular, **sin scroll**:
1. Logo y **nombre del gimnasio**, grande.
2. Una frase (la que escribe el dueño; si no escribió nada, la ciudad y "Gimnasio").
3. **Quiero ser socio**: el botón principal, verde y grande. Solo aparece con las altas prendidas; si no
   están, en su lugar va "Escribinos por WhatsApp".
4. **Ya soy socio, entrar**: el botón secundario.
5. Tres datos en una línea cada uno, con ícono: dirección (link a Maps), horario de hoy ("Hoy abierto de
   7 a 23"), WhatsApp (link `wa.me`).

Abajo, y **solo si el dueño las tiene prendidas**, van planes y precios, clases y horarios, y fotos, cada
una corta. Lo demás que hay hoy (equipo, eventos, flyers, "cómo empezar") queda **apagado por defecto en
el diseño nuevo**, y el dueño lo prende desde el editor de su página (P8b).

- **Lo que no cambia:** el editor de la landing, los datos (`landing_publica`), el dominio, los links
  viejos y el SEO.
- **Temple Gym:** se le aplica el diseño nuevo, porque es código, no datos. Sus textos y fotos se
  respetan. Antes de publicar: captura de cómo queda Temple Gym en un clon `[demo]` (sin tocar sus datos),
  y se publica fuera de 16–22 h.
- **LISTO SI:**
  - Lighthouse en celular ≥ 90.
  - En el primer pantallazo del celular (390 × 844) se ven nombre, Quiero ser socio, Ya soy socio y los 3
    datos.
  - Capturas en compu y celular, mirándolas.
  - e2e: con las altas apagadas no aparece Quiero ser socio.

## L2 · Quiero ser socio: la cuenta es gratis

- El formulario pide lo mínimo: nombre, apellido, **DNI obligatorio** (con el aviso "con este DNI vas a
  entrar todos los días"), celular, mail, contraseña, y el plan que le interesa (opcional: "Lo elijo
  después").
- **No se paga para crear la cuenta.** Al terminar, la sesión queda abierta y lo lleva a su app. Queda como
  "socio sin pagar" (D26).
- Lo que ya existe de H3b se reutiliza: reclamar una cuenta por DNI y celular, menores, el antirrobot y el
  origen del alta.

## L3 · La app del socio antes de pagar: de todo un poco, con los botones grandes

Inicio, con pocos botones grandes (SOCIO-FLUJO § app):
- **Arriba, lo que tiene que hacer:** "Para empezar a entrar, pagá tu plan", con el plan y el precio, y dos
  caminos:
  - **Pagar en la recepción**: dice que con el DNI lo cobran.
  - **Pagar desde acá**: solo si el gimnasio tiene el cobro online prendido. Si no, el botón no aparece.
- **Mi QR: bloqueado hasta que pague.** Se ve el lugar del QR difuminado, con un candado y "Tu QR se activa
  cuando pagues". Nunca se muestra un QR que la puerta va a rechazar. Apenas la recepción cobra (o llega el
  pago online), el QR se activa solo, sin recargar (el celular pregunta cada 8 s mientras está bloqueado y con la pantalla a la vista, y al volver a la app: D67 y D77).
- **Lo que puede ver igual:** horarios y clases de hoy, planes y precios, su perfil (datos y foto), el
  WhatsApp del gimnasio, y "Quiero probar una clase" si el gimnasio lo tiene prendido.
- **Después de pagar:** el Inicio de siempre (QR, cuántos días le quedan, reservar, pagos).
- **La puerta no cambia:** sin pagar, la entrada da rojo con el motivo ("Socio nuevo sin pagar: cobrale el
  plan…"). El QR bloqueado es solo lo que ve el socio; quien decide sigue siendo `calcular_acceso`.
- **LISTO SI:**
  - e2e: cuenta nueva → QR bloqueado → la recepción cobra → el QR se activa sin recargar → entra en verde
    con el QR y con el DNI.
  - Capturas mirándolas en celular.

## L4 · Pagar desde la app (después)

El cobro online del socio (MercadoPago, N1) sigue **apagado por defecto**. Cuando el gimnasio lo prenda,
el botón "Pagar desde acá" de L3 lo usa, con el webhook como única fuente del pago, nunca el navegador.
No se prende en Temple Gym sin que Mateo lo diga.
