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

- 2026-11-16 · Mateo (pasada de Pase 1.0, con captura de templegymsalta.com) · **El camino del socio, completo y re fácil** (D83 en PREGUNTAS). Todo se prueba en `[demo] Temple clon`, nunca en Temple Gym · ⏳
  1. **"Crear mi cuenta" aparece siempre** en la página del gimnasio: botón principal, verde, arriba de "Ya soy socio, entrar". Hoy no aparece porque depende de `altas_online` (apagado en Temple Gym). Desde ahora, crear la cuenta gratis NO depende de `altas_online`: esa llave decide solo si puede elegir y pagar un plan online. El dueño puede ocultar "Crear mi cuenta" con una llave nueva en Página, prendida por defecto. Migración aditiva, llave en datos, sin tocar la configuración de Temple Gym.
  2. **"Crear mi cuenta" lleva a `/hacete-socio`** (la dirección del QR impreso, no se renombra). Pide nombre, apellido, DNI obligatorio con su aviso, celular, mail y contraseña. El plan es opcional ("Lo elijo en el gimnasio"). Al terminar, sesión abierta y directo a su app.
  3. **Memoria:** con la sesión abierta en ese gimnasio, entrar a la página (templegymsalta.com, el QR, /g/<slug>) lo lleva **directo a su app** (`/app`), sin pasar por la portada. En la app, "Ver la página del gimnasio" para volver a la portada. El equipo con sesión va a su panel. Sin sesión, la portada.
  4. **Más info en la página, como landing:** la primera pantalla sigue limpia (logo, nombre, una frase, Crear mi cuenta, Ya soy socio). Abajo, al bajar y **prendido por defecto si hay datos**: planes y precios, horarios y clases de hoy, dónde queda (dirección con link a Maps), fotos, WhatsApp (wa.me) y preguntas frecuentes. Cada sección se apaga desde el editor. Sin datos, la sección no aparece (lo vacío está vacío).
  5. **En la recepción, el socio con cuenta y sin pagar:** la primera vez que llega, la barrita y la ventana ofrecen **"Clase de prueba"** como botón principal (si el gimnasio tiene clase de prueba y todavía no la usó) y "Dar el alta y cobrar" como segundo. Desde la segunda vez, "Dar el alta y cobrar" es el principal y dice "Ya usó su clase de prueba el DD/MM". La puerta sigue decidiendo con `calcular_acceso`; esto cambia solo qué botón se ofrece. Prueba de base con momentos fijos si cambia algún veredicto.
  6. **La app del socio completa y re fácil** (SOCIO-FLUJO.md § app, LANDING-SOCIO-1411.md L3): Inicio con 4 a 6 botones grandes. **Sin pagar:** "Pagá tu plan" (recepción o desde acá si hay cobro online), Mi QR bloqueado, Clases y horarios, Planes, Mi perfil, WhatsApp del gimnasio. **Pagando:** Mi QR, cuántos días le quedan, Reservar, Mis pagos, Mi perfil, WhatsApp. Revisar cada pantalla de `/app` contra las 21 reglas de FLUIDEZ, con capturas en celular mirándolas, y sacar lo que sobra.
  7. **Lo prueba un e2e de punta a punta** en el clon: página → Crear mi cuenta → app sin pagar con QR bloqueado → volver a la página → va directo a la app → recepción: clase de prueba → segunda vez: dar el alta y cobrar → QR activo sin recargar → entra en verde por QR y por DNI.
- 2026-11-16 · Mateo · El nombre de Temple Gym figura como "templegym": lo corrige Mateo desde su configuración (es dato del gimnasio, no se toca desde el código) · ⛔ Mateo
- 2026-11-16 · Mateo · El sistema mandó `/g/templegym1` a `templegym1.gym-os-pied.vercel.app` (una dirección armada con el dominio viejo). Las direcciones de un gimnasio bajo un dominio de `NEXT_PUBLIC_DOMINIOS_VIEJOS` (o bajo un dominio base que ya no es el actual) nunca se usan como destino de redirección: se ignoran y se anota en Estado de la plataforma. Con su prueba en `direcciones-viejas.test.ts` · ⏳
- 2026-11-11 · BRIK · Botón "¿Necesitás ayuda?" con WhatsApp a BRIK (pantalla, usuario y último error) para el dueño y la recepción · ✅ H6 (`scripts/e2e/ayuda-brik.mjs`)
- 2026-11-11 · Mateo · Canal único de pedidos y errores de Temple Gym (este archivo) · ✅ H6
