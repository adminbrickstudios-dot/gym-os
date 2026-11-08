# Reglas del negocio

Lo que el sistema tiene que respetar siempre. Lo que ya está construido manda
(está en la base y en sus pruebas); acá se escribe en palabras para que nadie
lo tenga que adivinar leyendo SQL. El agente completa cada sección con lo que
encuentra en la base real (BASE-DOC) y marca lo que no coincide.

## La pregunta central

¿Este socio puede entrar ahora? La contesta **una sola función**:
`privado.calcular_acceso(socio, momento, sede)`, y la usa todo lo que pregunta:
`registrar_ingreso`, la Entrada, el aviso flotante, el kiosco, el QR, la app.
Devuelve color, motivo, texto listo para mostrar, qué consume y por qué vía
entra (membresía, pase, pack, prueba, cubierto por el titular).

Prohibido recalcularla en TypeScript.

### Los colores

| Color | Cuándo |
|---|---|
| Verde | Puede pasar. |
| Amarillo | Puede pasar, pero hay algo para mirar: vence en 3 días o menos, foto para comparar (anti-préstamo), etc. |
| Azul | Puede pasar porque está en prueba (dice hasta cuándo). |
| Rojo | No puede pasar. Siempre con el motivo escrito ("Debe desde el 3/11", "Suspendido hasta el 20/11", "Ya usó la clase de hoy"). |
| Gris | No tiene plan o se dio de baja. |

## Vigencia: `cubierto_hasta` (D36)

**Qué se guarda.** En `socios`, una columna `cubierto_hasta timestamptz`: el
final de la cobertura de membresía continua del socio, ya sumados los
congelamientos, los días cerrados (VD-57) y la gracia que corresponda.

**Por qué no se pudre.** No depende de la hora: depende solo de los hechos
(pagos, coberturas, anulaciones, congelamientos, días cerrados, regla de
vencimiento, plan familiar). Mientras nadie toque un hecho, la fecha sigue
siendo correcta. El color sale de comparar esa fecha con el momento: si
`cubierto_hasta` es el jueves, hoy es verde, el martes es amarillo y el viernes
es rojo, sin que nadie haga nada y sin cron.

**Qué no se guarda.** Ni `estado`, ni `al_dia`, ni la deuda de la puerta. La
deuda **crece sola con los días** (cada período que pasa sin pagar suma), así
que guardarla obligaría a un proceso nocturno. Se calcula a partir de
`cubierto_hasta`, el plan y el momento: es una cuenta sobre una fecha guardada,
sin recorrer pagos, y es rápida.

**Quién la mantiene.** Una función `privado.recalcular_cubierto_hasta(socio)`
que la calcula desde los hechos con la misma lógica que `via_membresia`, y
triggers que la llaman **en la misma transacción** cuando cambia cualquier
hecho que la mueve:

| Hecho | Recalcula |
|---|---|
| Cobertura nueva, anulada o cambiada (pago, venta anulada, devolución, contracargo) | ese socio |
| Congelamiento nuevo, cambiado o levantado | ese socio |
| Cambio de plan | ese socio |
| Día cerrado nuevo o borrado (VD-57) | todos los socios del gimnasio |
| Cambio de la regla de vencimiento o de la gracia | todos los socios del gimnasio |
| Titular del plan familiar cambia de cobertura o se da de baja | el titular y sus vinculados |

**Dónde se usa.** En todo lo que muestra **muchos socios a la vez**, que es
donde se va el tiempo: Vencen hoy, el buscador (color al lado de cada
resultado), la lista de Socios, Retención, los números de Inicio. Con índice
`(gimnasio_id, cubierto_hasta)`.

En la puerta, para **un** socio, `calcular_acceso` sigue haciendo la cuenta
completa (ya tarda menos de 300 ms, VD-47Y). Solo pasa a leer la columna si
`VELOCIDAD.md` muestra que la puerta es lenta, y solo después de la prueba de
equivalencia.

**Cómo se prueba que no miente:**
- Prueba de base: para cada socio del demo de 5.000 y en 6 momentos fijos
  (antes, el día que vence, el siguiente, en un congelamiento, en un día
  cerrado, con plan familiar), el veredicto con la columna y sin ella son
  idénticos.
- Chequeo en `npm run chequeos` y en producción: `cubierto_hasta` guardado =
  recalculado, para todos los socios. Si alguno difiere, falla con la lista.
- Prueba por trigger: cada hecho de la tabla de arriba mueve la fecha.

**La migración:** columna nullable → función → triggers → backfill de todos
los socios → verificación de que guardado = recalculado → índice. Aditiva y
sin `not null` (un socio sin membresía tiene `null`).

**`CLAUDE.md`** se actualiza: "Se calcula, nunca se guarda", con una excepción
escrita: `cubierto_hasta`, que es un hecho derivado mantenido por trigger en la
misma transacción, nunca un estado.

## Cobros

(Lo completa el agente desde la base: VD-5, VD-7, VD-8, VD-9, VD-49, VD-50.)

- Un solo flujo de cobro (la hoja Cobrar) desde todos lados.
- Cómo vence la cuota: día fijo con proporcional, desde el pago, o continua
  (VD-7, D18).
- Efectivo pide el turno de caja abierto de quien cobra (VD-49).
- La misma cuota cobrada hace poco desde otra compu frena y pide confirmación
  con motivo (VD-50).
- Plata en `numeric(12,2)`; se muestra con `formatearPesos()`.

## Accesos

(Lo completa el agente: VD-3, VD-8, VD-46M, VD-48, VD-51.)

- Una visita dura 5 h (configurable): volver a pasar adentro de esa ventana no
  cuenta otra entrada (VD-3, D24).
- Dejar pasar sin pagar: tres modos configurables, siempre con nombre y motivo
  (VD-8, D19).
- Prueba gratis: una vez por DNI (VD-51).

## Deuda

(Lo completa el agente.) Qué cuenta como deuda, desde cuándo, qué se le
sugiere cobrar, y cómo se muestra en el aviso, el panel lateral y la app.

## Avisos al socio

Por WhatsApp solo con links `wa.me` armados (sin API paga). Los avisos de la
app, por push. Nadie marcado "No escribirle" recibe avisos masivos (VD-46N).
