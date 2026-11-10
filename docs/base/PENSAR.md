# Pensar antes de cada bloque (pedido de Mateo, 09/11)

Antes de construir cada ítem, el agente escribe acá un bloque de **15 líneas
como máximo**. Los bloques nuevos van arriba.

1. **Qué pidió Mateo y qué quiso decir.** No es un técnico: se lee la
   intención, no la letra.
2. **Cómo lo resuelve un producto profesional**: Vercel Platforms
   (github.com/vercel/platforms), Cal.com, Shopify, Mindbody, Glofox. Se busca
   en internet o en GitHub cuando hace falta.
3. **Abogado del diablo: 5 formas en que se rompe.** Se eligen de esta lista:
   - otro dominio o subdominio
   - otro rol
   - celular
   - internet lento
   - datos vacíos
   - 1.000 gimnasios
   - doble clic
   - sesión vencida
   - mail con mayúsculas o espacios
   - vista previa contra producción
   - variables de entorno distintas
4. **Lo que Mateo no pidió pero necesita.**
5. **La decisión, y cómo se va a probar.**

Después de construir, se prueban esas 5 formas. Si una falla, no está
terminado.

---

## F1.4 · BASE-6: claro y oscuro, íconos de línea, Barlow (carril D, 09/11 noche)
1. **Qué quiso decir Mateo:** que Base se vea como un producto serio de gimnasio (un mostrador), no una app con emojis: sin emojis como ícono, un solo estilo, letra con cuerpo, y que cada persona elija claro u oscuro y se vea bien en los dos.
2. **Cómo lo hacen otros:** Linear, Vercel y Mindbody usan un set de íconos de línea con un solo componente, tokens de color con modo claro/oscuro por usuario (cookie + preferencia guardada) y una fuente propia autoalojada.
3. **Cómo se rompe (5):**
   - *emoji que viene de datos* (la actividad "🚴" del dueño, íconos que arma la base): `Icono` muestra como texto lo que no es un nombre de ícono, así que un dato del dueño se respeta y no se rompe.
   - *tema oscuro sobre un gimnasio de fondo claro:* el tema de la persona manda sobre el fondo del gimnasio (el acento sigue siendo el suyo); `propsMarca` lo recibe de la cookie `tema`.
   - *celular:* los íconos miden 1,15 em y escalan con el texto; el barrido mide desborde y contraste en 390 px.
   - *internet lento:* Barlow va autoalojada con `next/font/local` y `swap`: sin pedidos a Google ni texto invisible.
   - *otros roles y pantallas de otros carriles* (super admin, app del socio, ingreso): `Encabezado`, `Aviso` y `Vacio` aceptan todavía `emoji` para no romperlas; el chequeo de diseño (trinquete) las lista hasta que cada carril convierta las suyas.
4. **Lo que no pidió pero necesita:** un chequeo que impida volver a meter colores sueltos o emojis, y un barrido que mida el contraste de verdad (no solo mirar capturas).
5. **Decisión y prueba:** set propio de íconos (sin dependencia nueva), codemod sobre componentes y panel, tokens en `globals.css`; tsc, eslint, vitest y `barrido-tema.mjs` (claro y oscuro, compu y celular) en Actions.

---

## U0.1 · El login roto (09/11 noche)
1. **Qué pidió y qué quiso decir.** Mateo crea un gimnasio con su dueño, entra por `/g/template-gym/ingresar` con el mail y la contraseña que puso, y lo manda al `/ingresar` genérico con "mail o contraseña incorrectos". Quiere: entrar a su gimnasio, con su marca, o un mensaje que diga exactamente qué pasa.
2. **Cómo lo hace un producto profesional.** Vercel Platforms / Cal.com / Shopify: una sola pantalla de ingreso, la dirección del gimnasio muestra su marca y usa el mismo login; los errores distinguen "no existe", "contraseña", "sin confirmar", "sin gimnasio", y nunca caen a un gimnasio por defecto.
3. **5 formas en que se rompe.**
   - **Cuenta ya existente:** el mail ya tenía cuenta (el de Mateo, por ejemplo) y la contraseña que escribió al crear NO se aplica (no se pisa la de una cuenta existente): el ingreso dice "incorrectos". Es la causa más probable junto con "Invalid API key" (la cuenta nunca se creó).
   - **Mayúsculas o espacios** en el mail: se normaliza (minúsculas, sin espacios) al crear y al entrar. Probado.
   - **Redirect que pierde el gimnasio:** `/g/<slug>/ingresar` rebotaba a `/ingresar` sin marca. Ahora se queda en esa dirección (reescritura) y comprueba que la cuenta sea de ese gimnasio.
   - **Sin confirmar o desactivada:** antes se veía como "incorrectos"; ahora cada una dice lo suyo.
   - **Cero, uno o varios gimnasios** y **doble clic / sesión vencida**: 0 → mensaje con salida; 1 → panel; varios → elegir.
4. **Lo que no pidió pero necesita.** Que el alta diga en palabras cuando el mail YA tenía cuenta y que la contraseña escrita no se aplicó (pedido a B), y la prueba permanente en producción (U0.3).
5. **Decisión y prueba.** Reescritura en el proxy, mensajes por motivo, vitest de `motivoDeEntrada`, e2e de las tres puertas (`fase-u0-login.mjs`) en Actions.

---
## P4 a P7 · Crear gimnasios y gestionar personas (carril B, 09/11 noche)

1. **Qué quiso decir Mateo:** que dar de alta un gimnasio sea un trámite de un minuto y que, al terminar, sepa con certeza que el dueño ENTRA. Y que si alguien no entra, la pantalla le diga por qué y lo arregle con un botón.
2. **Cómo lo hacen otros:** Vercel Platforms y Shopify crean el "tenant" con una dirección validada y única, y dejan una pantalla de "listo" con el link y las credenciales; Cal.com y Mindbody tienen "impersonar" con una barra fija arriba y registro de auditoría.
3. **Cómo se rompe (5):**
   - *mail con mayúsculas o espacios*: se normaliza (`trim().toLowerCase()`) antes de buscar o crear la cuenta.
   - *doble clic*: el botón queda ocupado y repetir el alta con la misma dirección termina el mismo gimnasio (no crea otro).
   - *datos vacíos*: sin nombre no hay dirección; sin mail el alta queda con "Terminar alta"; la prueba distingue rojo (no puede entrar) de amarillo (no impide).
   - *otro rol*: la base decide (`exigir_brik`): lectura mira, soporte arregla, solo el principal mueve de gimnasio.
   - *1.000 gimnasios*: la prueba mira un solo gimnasio por vez; las listas no la corren.
4. **Lo que no pidió y necesita:** que un gimnasio nunca se quede sin dueño (ni al desactivar, ni al cambiar rol, ni al mover), direcciones reservadas de la plataforma (`admin`, `www`, `app`…) y que mover a una persona no rompa su historial.
5. **Decisión y prueba:** reuso lo de U1 y SA-3 a SA-5. Slug normalizado y reservado en el servidor; `admin_probar_acceso(_gimnasio)` en la base con pasos ok/aviso/falta; "Arreglar" confirma la cuenta, activa o reanuda; mover = misma cuenta, fila nueva en el destino y la vieja desactivada. Prueba: 5 pruebas de base, vitest del slug y el e2e `scripts/e2e/super-p.mjs`.
