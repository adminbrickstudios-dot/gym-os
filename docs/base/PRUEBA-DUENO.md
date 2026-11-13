# La prueba de Mateo: pasada visual y prueba del dueño

Es lo último. Lo hace Mateo, en producción, cuando arriba de `PROGRESO.md` dice
**"LISTO PARA TU PASADA"**. El agente completa los links y los usuarios de
prueba (sin contraseñas: esas van en `ACCESOS.md`, que no se sube) y deja todo
preparado para que esto lleve **una hora, no un día**.

Cada cosa que no le guste a Mateo la anota en `docs/base/CAMBIOS-MATEO.md`,
una por línea, con la pantalla. El loop siguiente la toma como un ítem.

## Antes de empezar (lo deja listo el agente)

Estado al 12/11: **el código y las acciones están listos y probados contra la base de prueba; el gimnasio todavía NO está creado en
producción** (el agente no corre nada contra producción). Para crearlo, 5 pasos tuyos, de a uno:

1. **Secretos** en GitHub → Settings → Secrets and variables → Actions → Secrets → New repository secret (hoy solo existe `SUPABASE_DB_URL`):
   - `CLAVE_PRUEBA_MATEO`: la contraseña de los 5 usuarios de prueba (10 o más letras; elegila vos). **Anotala en `ACCESOS.md`** (archivo
     local, fuera del repo): no va en ningún otro lado.
   - `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` (Supabase → Project Settings → API): los usa la acción que crea los logins.
   - `BRIK_ADMIN_MAIL` y `BRIK_ADMIN_CLAVE`: tu cuenta de super admin, para el humo de `/super`.
2. Actions → **Base de datos** → Run workflow, acción `sembrar-prueba-mateo`, dominio `gym-os-pied.vercel.app` (o `pasegym.com` si ya cambiaste
   los dominios). Crea `[demo] Gimnasio Prueba Mateo` (slug `demo-mateo`): marca naranja y oscura, 3 planes a la venta (Full, 3 veces, Mañana)
   más los de los casos testigo, **30 socios** en todos los estados (al día, por vencer, vence hoy, en tolerancia, debe, nunca pagó, en
   pausa, suspendido, en prueba, con pack, con pase de hoy, dado de baja), 4 actividades con grilla de clases, productos de mostrador,
   interesados, una recepcionista y un profe. Solo crea: si ya existe lo dice y no lo toca.
3. Actions → **Base de datos** → `usuarios-prueba-mateo`. Crea los 5 logins con la contraseña del secreto `CLAVE_PRUEBA_MATEO`. Si falta
   algún secreto se frena y dice cuál.
4. Actions → **Humo producción** → Run workflow: el trabajo `puertas` abre `/super`, `/dueno`, `/recepcion`, `/profe`, `/socio` y la página del
   gimnasio, en compu y celular, y deja las capturas (artefacto `humo-puertas`). Lo que no tenga su secreto lo marca ⛔ "sin probar".
5. Si todo dio verde, empezá por el punto 1 de abajo.

- [ ] El gimnasio `[demo] Gimnasio Prueba Mateo` creado (paso 2) y con sus usuarios (paso 3).
- [ ] El logo: lo subís vos en Configuración → Marca (el script no sube imágenes; los colores sí vienen cargados).
- [ ] Una compu y un celular: la prueba se hace en los dos.

Los links valen con la dirección de hoy; tras el cambio de dominios (`DOMINIO.md`) es la misma ruta con `pasegym.com` en vez de
`gym-os-pied.vercel.app`. En `*.vercel.app` no hay subdominios: por eso todos llevan `/g/demo-mateo`.

| Rol | Link | Usuario (contraseña: `CLAVE_PRUEBA_MATEO`, en `ACCESOS.md`) |
|---|---|---|
| Super admin | `https://gym-os-pied.vercel.app/super` | tu cuenta real de super admin (la de `BRIK_ADMIN_MAIL`) |
| Dueño | `https://gym-os-pied.vercel.app/g/demo-mateo/dueno` | `prueba-duena@ejemplo.invalid` |
| Recepción | `https://gym-os-pied.vercel.app/g/demo-mateo/recepcion` | `prueba-recepcion@ejemplo.invalid` |
| Profe | `https://gym-os-pied.vercel.app/g/demo-mateo/profe` | `prueba-profe@ejemplo.invalid` |
| Socio al día | `https://gym-os-pied.vercel.app/g/demo-mateo/socio` | `prueba-socio@ejemplo.invalid` (Testigo Al Día) |
| Socio que debe | `https://gym-os-pied.vercel.app/g/demo-mateo/socio` | `prueba-socio-debe@ejemplo.invalid` (Testigo Vencida: debe $25.000) |
| Página pública | `https://gym-os-pied.vercel.app/g/demo-mateo` | sin usuario |
| Hacete socio | `https://gym-os-pied.vercel.app/g/demo-mateo/hacete-socio` | sin usuario |

Qué socios de prueba hay (para no buscarlos): `Testigo Al Día` (verde), `Testigo Por Vencer` (amarillo), `Testigo Vence Hoy`,
`Testigo En Tolerancia` (naranja), `Testigo Vencida` y `Testigo Sin Pago` (rojo, con la cuenta para regularizar), `Testigo Congelada`,
`Testigo Suspendido`, `Testigo Pase Hoy`, `Testigo Con Pack`, `Testigo Fuera De Franja`, `Testigo Sin Plan` (gris), `Testigo Se Fue` (de baja)
y once `… Prueba NN` comunes. Todo es ficticio: teléfonos `+54 9 000…`, mails `@ejemplo.invalid`.

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
