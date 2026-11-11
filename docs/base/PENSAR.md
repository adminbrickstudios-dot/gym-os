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

## P8 · La landing del gimnasio, profesional con cero configuración (carril C, 11/11)
1. **Qué pidió Mateo:** que apenas crea su gimnasio, con solo el nombre y un color, ya tenga una web que parezca hecha por un profesional, sin huecos ni carteles de "armando".
2. **Cómo lo hace un producto profesional:** Glofox/Mindbody/Shopify: portada tipográfica enorme con el nombre, el acento de la marca, bloques que aparecen solos cuando hay datos y desaparecen cuando no, y lo técnico (título, imagen para compartir, sitemap, datos estructurados) resuelto sin que el dueño toque nada.
3. **Cinco formas en que se rompe:** (a) datos vacíos: sección con título y nada adentro; (b) celular: desborde horizontal por un título largo; (c) otro dominio: sitemap/robots/canonical de la dirección equivocada; (d) 1.000 gimnasios: caché por dirección y `revalidateTag` al editar; (e) vista previa contra producción: og:image con el host correcto.
4. **Lo que no pidió pero necesita:** 404 con la marca del gimnasio; íconos de línea en lugar de emojis (D38); que "Ocultar" deje solo la portada y no se indexe.
5. **Decisión y prueba:** casi todo ya estaba (BASE-9, U4): se completó la 404 con marca, `ExerciseGym` + `HealthClub`, y los emojis pasaron a `Icono`. `scripts/e2e/web-p8.mjs` mira: título grande en 390 px, sin secciones vacías, sin desborde, sin imágenes rotas, sin emojis, metadatos, sitemap y robots por dirección, 404 con marca y bloques con datos.

---

## F1.9 + mostrador + plazo de espera (carril D, 11/11)
1. **Qué quiso decir Mateo:** que los e2e viejos vuelvan a andar de verdad (si falla la pantalla se arregla la pantalla; si el test quedó viejo, el test), que la recepción tenga un mostrador (barra de búsqueda gigante) y que el dueño pueda poner el plazo de la lista de espera.
2. **Cómo lo hace un producto profesional:** las pruebas de pantalla esperan a la condición (no a un tiempo ni a una cuenta instantánea), no dependen del reloj ni de datos que dejó otra prueba, y un fallo se clasifica en "la pantalla cambió a propósito", "carrera de la prueba" o "bug".
3. **Cómo se rompe (5):** *internet lento* (comprobante que se arma después de cobrar, lista guardada 60 s: se espera con reintentos); *reloj* (la caja de ayer se cierra sola a las 14 h: caj-5 corre el corte a 23:59 y lo devuelve); *otro dominio* (el Supabase local es http y la CSP lo bloqueaba: se permite solo si es el de este despliegue); *celular* (el primer botón "Buscar" del DOM es el del menú de compu, invisible: `:visible`); *datos vacíos / de otra prueba* (la baja del socio "Testigo", no la primera de la lista).
4. **Lo que no pidió pero necesita:** que las pruebas que no pude explicar (vd-3, 15, 37, 38, 46f cortan sin resumen; vd-6, vd-9, vd-49) queden anotadas con lo que se sabe, y que vd-49 (plata) NO se toque.
5. **Decisión y prueba:** cambios mínimos a cada e2e y, donde era la pantalla, a la pantalla; todo se vuelve a correr en Actions. El plazo de espera: lectura nueva (`espera_plazo_gimnasio`) + interruptor en Configuración → Clases, probados en la base.

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
## P2, P3 y P9 · Direcciones, entornos y dominios (carril B, 10/11)

1. **Qué quiso decir Mateo:** que el día que compre el dominio sea "cargar tres variables y esperar", y que nunca más una pantalla mande a alguien a una dirección vieja o a un Supabase equivocado sin que se note.
2. **Cómo lo hacen otros:** Vercel Platforms arma cada URL desde `rootDomain` + subdominio en un solo helper y agrega dominios con la API de Vercel (`POST /v10/projects/{id}/domains`, `verify`, `config`) mostrando los registros DNS; Cal.com y Shopify muestran el estado de cada dominio en semáforo.
3. **Cómo se rompe (5):**
   - *otro dominio o subdominio*: sin comodín (vercel.app) las URLs caen en `/g/<slug>`; con dominio, en `<slug>.<dominio>`; el dominio propio sale de la tabla (`urlDeHost`).
   - *variables de entorno distintas*: Preview contra el Supabase de producción es el desastre; la lista compara el ref de la URL con el de las claves y con el esperado, sin mostrar claves.
   - *datos vacíos*: sin ninguna variable cargada las URLs son rutas relativas (nunca una dirección inventada) y la lista nombra lo que falta.
   - *sesión vencida / otro rol*: solo el principal agrega o verifica dominios; el servidor lo comprueba antes de hablar con Vercel.
   - *internet lento*: Vercel caído o lento devuelve un mensaje en palabras, y el token nunca aparece en un error.
4. **Lo que no pidió y necesita:** que un test falle si alguien escribe a mano un host, `vercel.app` o `/g/<slug>`, con las excepciones listadas (solo pueden achicarse) y los pasos de Mateo arriba de PROGRESO.md.
5. **Decisión y prueba:** `src/lib/urls.ts` + test que escanea `src`; `entorno.ts` (puro, probado con JWT falsos); `vercel-dominios.ts` con cliente inyectable, probado con un Vercel simulado; ⛔ en producción hasta `VERCEL_TOKEN` y `VERCEL_PROJECT_ID`. e2e `scripts/e2e/super-plat.mjs` para Actions.

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

## F9 · Plantillas, escala, monitoreo y plata del soporte (carril B, 11/11)

1. **Qué quiso decir Mateo:** que BRIK cambie un texto una vez y lo vean todos los gimnasios que no lo tocaron; que la plataforma aguante miles de gimnasios y avise sola si algo falla; y que el soporte pueda ayudar sin poder tocar la plata de nadie por error.
2. **Cómo lo hacen otros:** Shopify y WordPress multisitio heredan de un tema base y marcan lo "personalizado"; Stripe y Linear muestran uso contra el límite del plan; los equipos chicos usan un chequeo de salud externo antes de pagar un APM.
3. **Cómo se rompe (5):**
   - *gimnasio que editó el texto*: no se pisa (se compara con lo que valía la plantilla antes del cambio).
   - *tabla enorme*: nada devuelve "todo"; el registro va por cursor de 50 y hay un tope.
   - *rol equivocado*: la base decide (`exigir_brik`); soporte sin permiso de plata es frenado por trigger, no por la pantalla.
   - *1.000 gimnasios*: el script de carga se niega a correr contra una base que no sea local.
   - *datos vacíos*: sin límite cargado el plan es "sin límite"; sin SALUD_URL el chequeo se apaga.
4. **Lo que no pidió y necesita:** que los límites NO bloqueen altas (cambia quién cobra y qué), que todo quede en el registro de BRIK y la lista de lo que Mateo tiene que mirar (asesores, región).
5. **Decisión y prueba:** migraciones 020600 a 020800 con pruebas de base propias; guardas de seguridad del código en vitest; e2e `scripts/e2e/super-f9.mjs` para Actions.

## F7.1 · TV de entradas, ocupación, congelar solo y "tengo que cobrar" (carril B, 11/11)

1. **Qué quiso decir Mateo:** pantallas y atajos que le saquen trabajo a la recepción: ver quién entra y cuánta gente hay sin preguntar, que el socio resuelva su pausa solo, y llegar al día 1 con una cola de cobro lista.
2. **Cómo lo hacen otros:** los gimnasios con molinete muestran "Bienvenido, Ana" en una pantalla; Mindbody y Gympass muestran la ocupación como número; las pausas con tope se aprueban solas en Zen Planner si el dueño lo prende.
3. **Cómo se rompe (5):**
   - *plata en una pantalla pública*: la TV nunca recibe color, plan ni deuda (la función no los devuelve).
   - *sin salida registrada*: la ocupación cuenta de más; se acota a 3 horas y se dice en PREGUNTAS.
   - *pausa fuera del tope o superpuesta*: `validar_pausa` corre antes de aprobar sola; pasado el tope de días vuelve a pendiente.
   - *rol equivocado*: solo el dueño prende la aprobación sola y la ocupación; el socio ve el número solo si está prendido.
   - *dos clics*: guardar es idempotente y el pedido se aprueba una sola vez (update con estado pendiente y fila afectada verificada).
4. **Lo que no pidió y necesita:** que todo venga apagado por defecto, que quede marcado qué pausa fue aprobada sola, y que el token de la TV se pueda revocar.
5. **Decisión y prueba:** migraciones 021000 y 021100 con pruebas de base; e2e `scripts/e2e/super-f11.mjs` para Actions.
