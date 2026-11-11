# La prueba de Mateo: pasada visual y prueba del dueño

Es lo último. Lo hace Mateo, en producción, cuando arriba de `PROGRESO.md` dice
**"LISTO PARA TU PASADA"**. El agente completa los links y los usuarios de
prueba (sin contraseñas: esas van en `ACCESOS.md`, que no se sube) y deja todo
preparado para que esto lleve **una hora, no un día**.

Cada cosa que no le guste a Mateo la anota en `docs/base/CAMBIOS-MATEO.md`,
una por línea, con la pantalla. El loop siguiente la toma como un ítem.

## Antes de empezar (lo deja listo el agente)

- [ ] Un gimnasio de prueba en producción, "Gimnasio Prueba Mateo":
  - Con marca, 3 planes y 30 socios ficticios en todos los estados: al día,
    por vencer, debe, en prueba, suspendido.
  - Con clases y una recepcionista y un profe de prueba.
  - Marcado `[demo]`, para que no cuente como gimnasio real.
- [ ] Los links de cada rol de ese gimnasio, escritos acá abajo.
- [ ] Una compu y un celular: la prueba se hace en los dos.

| Rol | Link | Usuario |
|---|---|---|
| Super admin | | |
| Dueño | | |
| Recepción | | |
| Profe | | |
| Socio al día | | |
| Socio que debe | | |

## 1. Como super admin (10 min)

1. Entrá a `/super`. ¿Se entiende el tablero? ¿Lo que "necesita atención" tiene sentido?
2. Creá un gimnasio nuevo con su dueño, poniendo vos la contraseña. Copiá los links.
3. Abrí la ficha del gimnasio de prueba. ¿Ves todo lo del local?
4. Entrá como soporte con rol recepción y salí.

## 2. Como dueño, el primer día (20 min)

1. Entrá con el link `/dueno` del gimnasio nuevo. Hacé el asistente de 9 pasos
   completo, con logo, colores, planes, cómo entra la gente y un Excel de socios.
2. Mirá la página del gimnasio: ¿la mostrarías?
3. En Equipo, creá una recepcionista con contraseña.
4. En el gimnasio de prueba, recorré Inicio. ¿Los números se entienden? ¿Tocar
   cada uno lleva a su lista?
5. Recorré Socios, Vencen hoy, Retención, Caja, Resultado y Configuración.

## 3. Como recepción, la hora pico (15 min)

1. Entrá con `/recepcion`.
2. Hacé 10 ingresos seguidos con F2: DNI, nombre, un QR.
   - ¿El aviso de la esquina se lee rápido?
   - ¿Los colores dicen lo que tienen que decir?
3. Tocá un rojo. En el panel lateral, **Cobrar ahora**, y cobrá en efectivo
   (te pide abrir la caja).
4. Dejá pasar a uno que debe, con motivo.
5. Alta de alguien nuevo en menos de 30 s. Vendé un pase diario.
6. Cerrá la caja.

## 4. Como socio, en el celular (10 min)

1. Entrá con `/socio`. ¿Se ve si estás al día, cuántos días te quedan y cuánto debés?
2. Mostrá el QR. Reservá una clase. Mirá tu historial.
3. Instalala en la pantalla de inicio.

## 5. La pasada visual (lo que mira el ojo)

En cada pantalla, en compu y en celular:
- ¿Se ve prolijo, claro, con el color del gimnasio y sin emojis?
- ¿Algo se desborda, se corta o queda desalineado?
- ¿Hay algún botón que no hace nada, o que te deja sin cómo volver?
- ¿Algo tarda más de 2 s?
- ¿Algún texto no se entiende?

Todo lo que no te cierre va a `CAMBIOS-MATEO.md`.
