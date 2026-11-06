# Gym OS v2 — dueño, recepción y socio

Pedido de Mateo del 05/11/2026. Es la especificación de lo que se codea
ahora. **No reemplaza nada**: todo lo que ya existe se queda (ver
`docs/paneles/README.md` y `docs/HOJA-DE-RUTA.md`); esto lo ordena, lo
conecta, lo hace más rápido y suma lo que falta.

## La idea en una frase

> Llega alguien al mostrador, pone el DNI en el teclado numérico, y en un
> segundo la recepción sabe quién es, si puede pasar, cuánto le falta para
> pagar, y con un toque lo cobra, lo deja pasar o lo da de alta — esté en la
> pantalla que esté.

Todo lo demás (dueño, socio, página) gira alrededor de eso: **quién entra,
quién paga, cuándo paga, y quién dejó de venir**.

## Los archivos

| Archivo | Qué tiene |
|---|---|
| `00-LEEME.md` | Esto: principios, decisiones de Mateo, cómo se trabaja |
| `01-ENTRADA.md` | La ventana de Entrada que está en todos lados, todas las situaciones, QR en vivo, reingreso |
| `02-COBROS-Y-CAJA.md` | Cómo cobra cada gimnasio, cobrar en un toque, fiado, caja por turno, anti-robo |
| `03-DUENO.md` | Inicio, números, tareas inteligentes, socios, planes, productos, eventos, rutinas, configuración |
| `04-RECEPCION.md` | El día de la recepción, qué ve y qué no |
| `05-SOCIO.md` | La app del socio: ingreso con Google, todo lo que tiene |
| `06-PAGINA.md` | La página del gimnasio (y la de Gym OS) |
| `07-DISENO-VELOCIDAD-NAVEGACION.md` | Diseño v2, animaciones, rapidez, escala, memoria y botones de volver |
| `08-PLAN.md` | Los ítems VD-* en orden, cada uno con su LISTO SI (también están en la COLA de la hoja de ruta) |
| `09-INSPIRACION.md` | Lo que hacen los mejores sistemas y qué tomamos |
| `10-SUPER-ADMIN.md` | El panel de BRIK para manejar muchos gimnasios |
| `11-INGRESO-Y-SEGURIDAD.md` | Ingreso más lindo, registro, contraseñas, sesiones, 2FA, equipo |
| `12-NOTIFICACIONES-Y-ONBOARDING.md` | Puntitos rojos, campana, push, primeros pasos, ayuda |
| `13-CONFIABILIDAD-Y-ESCALA.md` | Nada dos veces, nada se pierde, nada se cae, miles a la vez |
| `14-SITUACIONES.md` | Lo que pasa todos los días en un gimnasio, del más grande al más chico |
| `15-RECOMENDACIONES.md` | Lo que se puede estar escapando (producto, negocio, mañana) |
| `NOCHE-WINDOWS.md` | Cómo trabaja el agente de noche desde la compu de Mateo (Windows) |

## Principios (valen para cada ítem)

1. **No se saca nada.** Toda función que existe hoy sigue existiendo. Si se
   mueve de lugar, el lugar viejo lleva al nuevo.
2. **La pregunta central sigue siendo una sola función** (`calcular_acceso`
   / `registrar_ingreso`). La ventana flotante, el kiosco, el QR, la app:
   todos la llaman. Prohibido recalcular en TypeScript.
3. **Todo configurable.** Cada cosa que un gimnasio podría querer distinto
   va en Configuración, con un valor por defecto sensato y una línea que
   explica qué hace.
4. **Rápido siempre.** Menos de 100 ms entre el toque y el primer cambio en
   pantalla. Nada de pantallas en blanco: esqueletos con la forma real.
5. **Todo tiene memoria.** Volver deja donde estabas (con el filtro, la
   búsqueda y el scroll). Después de una acción, se vuelve al origen.
6. **Todo conectado.** De cualquier socio se llega a cobrarle, a su entrada,
   a su ficha, a su WhatsApp. De cualquier número se llega a la lista que
   lo forma.
7. **Todo queda registrado.** Quién, qué, cuándo y por qué. Nadie puede
   cobrar, anular, dejar pasar ni tocar la caja sin que quede escrito.
8. **Anticiparse.** Antes de dar un ítem por hecho, pensarlo como el dueño
   ("¿y por qué no puedo ver esto?"), como la recepción a las 19 h con 10
   personas en la fila, y como el socio desde el celular. Lo que falte se
   hace o se suma a la COLA.
9. **Nada importante depende de un cron.** "Cierre automático a la
   medianoche" se calcula: una caja de un día anterior *es* una caja
   cerrada sin contar, la cierre alguien o no.
10. **Mobile-first** en dueño y socio; la recepción se piensa para la compu
    del mostrador con teclado numérico, y también anda en tablet.

## Decisiones de Mateo (05/11/2026)

Contestadas en el chat; están también en la tabla de decisiones de la hoja
de ruta (D17 a D28) con su ✅.

| # | Pregunta | Lo que decidió Mateo |
|---|---|---|
| D17 | ¿Cómo se abre la Entrada? | **Las tres formas, juntas y adaptándose entre sí**: se abre sola al tipear un número en cualquier pantalla, hay un botón (grande en Inicio, chico en el resto) y una barra fija opcional. Si se usa una, las otras se acomodan a esa. Muy fluido. Configurable. |
| D18 | Gimnasio que cobra en día fijo y alguien se anota el 20 | **Paga proporcional** hasta el día fijo y entra al ciclo de todos. (En Configuración también: mes entero, o gratis hasta el día fijo.) |
| D19 | Cuánto puede fiar la recepción ("paga mañana, dejalo pasar") | **Los tres modos, elegibles en Configuración**: (a) la recepción hasta N días sola, más con PIN del dueño; (b) siempre con PIN del dueño; (c) libre, con registro. Todo anotado con nombre y motivo. |
| D20 | Cierre de caja | **Por turno y a la medianoche**: cada recepcionista abre y cierra su turno; si alguien se olvida, a la medianoche queda "cerrada sin contar" para que la revise el dueño. |
| D21 | Vender | **Productos y stock.** Las cuotas y pases se cobran desde la ventana de Entrada, la ficha del socio, Vencen hoy y el alta (el mismo "Cobrar"). |
| D22 | Prospectos | **Pasa a Socios como "Interesados"**, con "darlo de alta" que lleva los datos al alta. |
| D23 | ¿Con qué entra el socio a su app? | **Google, mail y contraseña, código por mail y código por SMS/WhatsApp.** |
| D24 | Reingreso | **Una visita dura 5 horas** (configurable): dentro de esa ventana, volver a pasar es "ya entraste" y no cuenta otra entrada ni consume otra clase; pasadas las 5 h, es una entrada nueva. |
| D25 | ¿Se publica durante la noche? | **Sí, por tanda**, cuando toda la tanda da verde en GitHub. |
| D26 | Socio que se registra solo | **Socio sin pagar** con su plan; paga desde la app y entra cuando paga. |
| D27 | Consultas y quejas | **Mensajes en la app**, que llegan al panel con número de pendientes. |
| D28 | Cambiar de plan desde la app | **Sí, lo pide y lo paga** (con lo que le queda a favor). |

## Cómo se trabaja

- Los ítems están en `08-PLAN.md` y en la COLA de `docs/HOJA-DE-RUTA.md`
  (bloque 20), con el formato que lee `scripts/noche/pendientes.mjs`.
- De noche, desde Windows: `NOCHE-WINDOWS.md`.
- Se publica en producción **por tanda** cuando toda la tanda da verde en
  GitHub (D25): prevuelo → aplicar → merge (procedimiento en
  `NOCHE-WINDOWS.md`). Si existe `.claude/BASE_CON_DATOS_REALES`, no: las
  aplica Mateo.
- Lo que se sumó la segunda vez (05/11 a la noche): `10-SUPER-ADMIN.md`,
  `11-INGRESO-Y-SEGURIDAD.md`, `12-NOTIFICACIONES-Y-ONBOARDING.md`,
  `13-CONFIABILIDAD-Y-ESCALA.md`, `14-SITUACIONES.md`,
  `15-RECOMENDACIONES.md`, y las decisiones D25 a D28.
