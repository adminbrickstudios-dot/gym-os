# El camino del socio: de la landing a entrar todos los días (11/11)

Pedido de Mateo del 11/11. Hoy el botón "Quiero ser socio" de la landing de
Temple Gym lleva a "No encontramos esta página" (mismo error que H3). Esto es
cómo tiene que ser el camino entero. Mucho ya existe (alta online VD-35, app del
socio en 4 pestañas VD-36, QR que cambia, prueba gratis VD-51, D26 "socio sin
pagar"): se completa y se conecta, no se rehace.

## 1. Desde la landing

- Dos botones grandes arriba:
  - **"Quiero ser socio"**.
  - **"Ya soy socio, entrar"** (o **"Ir a mi perfil"** si ya hay sesión).
- Si el gimnasio lo tiene prendido, un tercer botón **"Quiero probar una
  clase"** (prueba gratis, D31).
- Con sesión abierta, la landing lo saluda por el nombre y ofrece "Ir a mi
  perfil" y "Cerrar sesión". Nunca le pide entrar de nuevo.

## 2. "Quiero ser socio": crear la cuenta

1. **Elegir el plan.** Se ven los planes y precios de ese momento, que salen de
   los datos del gimnasio y se actualizan solos. El dueño puede elegir no
   mostrar precios.
2. **Datos**: nombre, apellido, **DNI obligatorio**, celular, mail, contraseña
   y fecha de nacimiento (ya la pide el alta online).
   - Al lado del DNI, en grande: *"Anotalo bien: con este DNI vas a entrar al
     gimnasio todos los días."*
   - Se valida que sea un número de 7 u 8 cifras y que no esté ya en el
     gimnasio. Si ya está: "Ese DNI ya es socio de Temple Gym. ¿Querés
     entrar?", con el link para entrar.
3. Reglamento y consentimiento de datos (Ley 25.326), si el gimnasio los tiene.
4. **Listo.** La cuenta queda creada y con la sesión abierta. Queda **socio sin
   pagar** (D26) con el plan elegido. Pantalla final:
   - "¡Listo, Juan! Ya tenés tu cuenta en Temple Gym."
   - "Para empezar a entrar, pagá tu plan en la recepción o desde acá", con
     "Pagar online" si el gimnasio tiene MercadoPago.
   - "Tu DNI para entrar: 12.345.678".
   - Botón "Ir a mi perfil".
5. La recepción lo ve al toque en el panel: Interesados/Altas, con su plan,
   y "Cobrar" a un toque.

**Sin mails**: la cuenta se crea con el mail y la contraseña que él escribe, ya
confirmada. Si olvida la contraseña, se la da la recepción (C1).

## 3. Cuándo puede entrar

- Mientras no pague, la entrada lo pone en **rojo con el motivo**: "Socio
  nuevo sin pagar: cobrale el plan Mensual $25.000". Lo dice la función de
  siempre: nada se calcula aparte.
- **Apenas la recepción cobra** (o llega el pago online), ya puede entrar con
  su DNI o su QR. Sin tocar nada más.
- Cada gimnasio elige cómo se entra (Configuración → Cómo entra la gente):
  - solo DNI,
  - solo QR,
  - los dos (por defecto).

  La app del socio muestra solo lo que su gimnasio usa.

## 4. El panel del socio (la app)

**Inicio**, con botones grandes y pocos:
- **Mostrar mi QR**: grande, que cambia y no se puede reenviar. Si el gimnasio
  no usa QR, en su lugar "Tu DNI para entrar: 12.345.678".
- **Estado en grande**:
  - "Al día · te quedan 12 días · vence el 23/11", o
  - "Tenés que pagar: $25.000 desde el 3/11", con el botón **Pagar**.
- **Reservar una clase**, si el gimnasio tiene clases con reserva.
- **Mi plan**: cuál tiene, cuánto sale, cambiar de plan (D28).

**Perfil (Yo)**, completo y editable:
- Nombre.
- DNI (se ve; cambiarlo lo hace la recepción, porque es con lo que entra).
- Celular, mail y foto (si el gimnasio lo permite, D57).
- Historial de pagos con sus recibos.
- Historial de entradas.
- Cambiar la contraseña.
- Cerrar sesión.

**Memoria**:
- La sesión queda abierta en su celular, también si cierra el navegador.
- Entrando por cualquier link del gimnasio (la landing, el QR, `/socio`), si
  ya tiene sesión va directo a su perfil.
- "Cerrar sesión" está siempre a mano, en Yo.

Se instala como app (PWA), y en el primer ingreso le ofrece "Agregar a la
pantalla de inicio".

## 5. Configuración del gimnasio (con valores por defecto)

| Opción | Por defecto |
|---|---|
| "Quiero ser socio" (registrarse por su cuenta) | Prendido |
| "Quiero probar" (prueba gratis) | Prendido |
| Mostrar precios en la landing y en el alta | Prendido |
| Cómo se entra: DNI, QR o los dos | Los dos |
| Plan sugerido en el alta | El primero de la lista |

## LISTO SI

e2e en celular (390 px), contra producción en un gimnasio `[demo]` y contra
local:
1. La landing → "Quiero ser socio" → elegir plan → DNI con aviso → cuenta creada
   → "Listo" → perfil. Ningún "No encontramos esta página".
2. Con un DNI ya usado, avisa y ofrece entrar.
3. Sin pagar: la entrada da rojo con el motivo. La recepción cobra y la misma
   entrada da verde, con el DNI y con el QR.
4. Cerrar el navegador y volver a abrir la landing: va directo al perfil.
   "Cerrar sesión" funciona.
5. Con "Quiero ser socio" apagado: el botón no aparece y el link directo dice
   que hoy no se puede, con el WhatsApp.
6. Con "solo DNI": la app no muestra QR. Con "solo QR": el DNI no deja entrar.
