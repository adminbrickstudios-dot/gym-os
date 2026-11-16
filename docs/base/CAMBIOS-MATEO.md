# Cambios pedidos por Mateo y por Temple Gym (H6)

El canal único de pedidos. Lo que Mateo o el gimnasio reportan se anota acá, y es lo primero que toma cada vuelta
del agente (no hace falta escribirle un prompt nuevo por cada cosa).

**Cómo se anota.** Una línea por pedido, la más nueva arriba:

```
- AAAA-MM-DD · <quién: Mateo, Temple Gym (dueño, recepción) o BRIK> · <qué pidió o qué se rompió, con la pantalla y la captura descripta> · <estado>
```

Estados: ⏳ pedido · 🔧 en curso · ✅ hecho (con la corrida o el commit) · ⛔ necesita algo de Mateo (decir qué).

**De dónde llegan.** El botón "¿Necesitás ayuda?" del panel del dueño y de la recepción arma un WhatsApp a BRIK con la
pantalla, quién escribe (nombre y rol) y el último error. El dueño y el encargado además dejan un pedido guardado que
BRIK ve en su tablero (`/admin`). Mateo pasa lo que llega acá. No lleva datos de socios. El número de BRIK lo carga el
super admin en la plataforma (Contacto): sin número, el botón de WhatsApp no aparece.

**Regla de oro.** Nada de esto se prueba en Temple Gym: se reproduce en el gimnasio `[demo]` clonado de su configuración
(`[demo] Temple clon`, ver `docs/base/RECOMENDACIONES.md` punto 7 y el workflow `botones-temple.yml`).

---

- 2026-11-16 · Mateo · **Reglamento para aceptar, simple.** Ya existe (`reglamentos` por versión, `aceptaciones_reglamento`, se escribe en Página → "Hacerse socio desde la página"). Con D83:
  - El reglamento se acepta también al **crear la cuenta**, con una casilla "Leí y acepto el reglamento" y el texto completo a un toque, no solo en el alta online.
  - Si el dueño publica una **versión nueva**, el socio la acepta al abrir su app la próxima vez: una sola pantalla, con un botón "Acepto". Hasta que acepte, ve la app igual: la puerta no cambia por esto.
  - La ficha del socio en recepción dice "Aceptó el reglamento (versión N) el DD/MM".
  - Se puede escribir y editar desde Configuración → Página sin tener las altas online prendidas.
  Mateo carga el texto de Temple Gym él mismo; el agente no lo escribe en Temple Gym · ⏳
- 2026-11-16 · Mateo · **Cacería: lo que llama a la base de más y lo que está roto** (va después de D83 y los dos arreglos de direcciones) · ⏳
  1. **La app del socio, Inicio (`/app`): 22 pedidos a la base** por cada apertura (`scripts/medir/topes-viajes.json`). Es la pantalla que más se abre (cada socio, cada día). Meta: 2, con una sola función de lectura como `contexto_pantalla`. Después `/app/clases` (8).
  2. **El mostrador a la hora pico:** Caja (8 a 9), Entrada (7), Prospectos (9), Inicio del panel (6), Configuración (6), Mensajes (6), Vender (5). Meta: 3 como máximo en cada una, empezando por Entrada y Caja. El tope de `topes-viajes.json` se baja con cada mejora y no vuelve a subir.
  3. **Los relojes que preguntan solos:** `CartelEmergencia` (cada 30 s), `UltimasEntradas`, `Navegacion` (60 s), `Campana` (60 s), `ActualizarSola`, `conexion.tsx` y el respaldo de `entradas-vivo`. Juntarlos en el canal de Realtime que ya existe (`panel_vivo`), con un único respaldo cada 60 s y solo con la pestaña visible. Medir cuántos pedidos por minuto hace una recepción quieta, antes y después.
  4. **Lo roto que se ve:**
     - la tabla de errores de H6 en producción (lo que les salió a Temple Gym y a los demos los últimos 7 días), uno por uno;
     - los errores de consola del barrido (cada rol en cada pantalla, compu y celular);
     - las pantallas que tardan más de 1 s en producción (`medir-produccion.yml`).
     Cada error encontrado: su prueba que falla, el arreglo, y la prueba en verde.
  5. **`ent-6`** (Entrada, apartado por intermitente el 15/11): averiguar si es la prueba o la app. Si es la app, es un error del mostrador a las 19 h: se arregla primero.
  6. Lo que toca plata o permisos se anota en PREGUNTAS y no se arregla solo.
- 2026-11-16 · Mateo (pasada de Pase 1.0, con captura de templegymsalta.com) · **El camino del socio, completo y re fácil** (D83 en PREGUNTAS). Todo se prueba en `[demo] Temple clon`, nunca en Temple Gym · ⏳
  1. **"Crear mi cuenta" aparece siempre** en la página del gimnasio: botón principal, verde, arriba de "Ya soy socio, entrar". Hoy no aparece porque depende de `altas_online` (apagado en Temple Gym). Desde ahora, crear la cuenta gratis NO depende de `altas_online`: esa llave decide solo si puede elegir y pagar un plan online. El dueño puede ocultar "Crear mi cuenta" con una llave nueva en Página, prendida por defecto. Migración aditiva, llave en datos, sin tocar la configuración de Temple Gym.
  2. **"Crear mi cuenta" lleva a `/hacete-socio`** (la dirección del QR impreso, no se renombra). Pide nombre, apellido, DNI obligatorio con su aviso, celular, mail y contraseña. El plan es opcional ("Lo elijo en el gimnasio"). Al terminar, sesión abierta y directo a su app.
  3. **Memoria:** con la sesión abierta en ese gimnasio, entrar a la página (templegymsalta.com, el QR, /g/<slug>) lo lleva **directo a su app** (`/app`), sin pasar por la portada. En la app, "Ver la página del gimnasio" para volver a la portada. El equipo con sesión va a su panel. Sin sesión, la portada.
  4. **Más info en la página, como landing:** la primera pantalla sigue limpia (logo, nombre, una frase, Crear mi cuenta, Ya soy socio). Abajo, al bajar y **prendido por defecto si hay datos**: planes y precios, horarios y clases de hoy, dónde queda (dirección con link a Maps), fotos, WhatsApp (wa.me) y preguntas frecuentes. Cada sección se apaga desde el editor. Sin datos, la sección no aparece (lo vacío está vacío).
  5. **En la recepción, el socio con cuenta y sin pagar:** la primera vez que llega, la barrita y la ventana ofrecen **"Clase de prueba"** como botón principal (si el gimnasio tiene clase de prueba y todavía no la usó) y "Dar el alta y cobrar" como segundo. Desde la segunda vez, "Dar el alta y cobrar" es el principal y dice "Ya usó su clase de prueba el DD/MM". La puerta sigue decidiendo con `calcular_acceso`; esto cambia solo qué botón se ofrece. Prueba de base con momentos fijos si cambia algún veredicto.
  6. **La app del socio completa y re fácil** (SOCIO-FLUJO.md § app, LANDING-SOCIO-1411.md L3): Inicio con 4 a 6 botones grandes. **Sin pagar:** "Pagá tu plan" (recepción o desde acá si hay cobro online), Mi QR bloqueado, Clases y horarios, Planes, Mi perfil, WhatsApp del gimnasio. **Pagando:** Mi QR, cuántos días le quedan, Reservar, Mis pagos, Mi perfil, WhatsApp. Revisar cada pantalla de `/app` contra las 21 reglas de FLUIDEZ, con capturas en celular mirándolas, y sacar lo que sobra.
  7. **Lo prueba un e2e de punta a punta** en el clon: página → Crear mi cuenta → app sin pagar con QR bloqueado → volver a la página → va directo a la app → recepción: clase de prueba → segunda vez: dar el alta y cobrar → QR activo sin recargar → entra en verde por QR y por DNI.
- 2026-11-16 · Mateo · El nombre de Temple Gym figura como "templegym": lo corrige Mateo desde su configuración (es dato del gimnasio, no se toca desde el código) · ⛔ Mateo
- 2026-11-16 · Mateo · **Cambiar el slug de un gimnasio no puede romper un QR impreso.** Temple Gym pasó de `templegym1` a `templegymsalta` y `/g/templegym1/hacete-socio` (el QR) da hoy "Gimnasio no encontrado". Los slugs anteriores de cada gimnasio se guardan (tabla aditiva, por gimnasio, con RLS) y `/g/<slug viejo>/…` redirige 308 para siempre a la dirección actual, con la misma ruta. Se carga `templegym1` como slug anterior de Temple Gym (un dato de dirección, no de socios ni de plata: permitido). En el super admin, al cambiar el slug avisa "el QR viejo va a seguir andando". Con su prueba · ⏳
- 2026-11-16 · Mateo · El sistema mandó `/g/templegym1` a `templegym1.gym-os-pied.vercel.app` (una dirección armada con el dominio viejo). Las direcciones de un gimnasio bajo un dominio de `NEXT_PUBLIC_DOMINIOS_VIEJOS` (o bajo un dominio base que ya no es el actual) nunca se usan como destino de redirección: se ignoran y se anota en Estado de la plataforma. Con su prueba en `direcciones-viejas.test.ts` · ⏳
- 2026-11-11 · BRIK · Botón "¿Necesitás ayuda?" con WhatsApp a BRIK (pantalla, usuario y último error) para el dueño y la recepción · ✅ H6 (`scripts/e2e/ayuda-brik.mjs`)
- 2026-11-11 · Mateo · Canal único de pedidos y errores de Temple Gym (este archivo) · ✅ H6
