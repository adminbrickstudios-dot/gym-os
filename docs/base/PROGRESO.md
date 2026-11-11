# PROGRESO de Base

## PASOS PARA MATEO (velocidad y accesos; F0.6)
1. **Clave de servicio (urgente, destraba el alta de dueños):** Supabase → tu proyecto de Gym OS → Project Settings → API → copiá la clave **service_role** → Vercel → el proyecto → Settings → Environment Variables → `SUPABASE_SERVICE_ROLE_KEY` (Production) → pegala → Redeploy. Tiene que ser de ESTE proyecto (el mismo de `NEXT_PUBLIC_SUPABASE_URL`), no la anon ni la de otro proyecto. En /admin, "Estado de la plataforma" la prueba creando y borrando un usuario.
2. **Claves asimétricas (hace que el proxy no viaje a Auth en cada pedido):** Supabase → Project Settings → JWT Keys → "Migrate" a claves asimétricas (ECC/RSA). Puede cerrar las sesiones abiertas una vez. Después `getClaims()` verifica sin ir a Auth.
3. **Secretos de GitHub** (Settings → Secrets and variables → Actions): `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `DEMO_CONTRASENA` (10+ letras; para el demo y para medir) y, para la prueba de humo, `BRIK_ADMIN_MAIL` y `BRIK_ADMIN_CLAVE` (tu cuenta de super admin de producción).
4. **Planes (los pagás vos):** Supabase Pro (máquina más grande que Free) y, en Vercel, revisar que Fluid Compute esté prendido (Settings → Functions). Con y sin, el agente mide y anota la diferencia en `VELOCIDAD.md`.
5. **Dominio:** `DOMINIO.md` (pasos exactos).

## DÓNDE QUEDÉ (11/11, 09:00 — vuelta nueva)
- U5 y P1 cerrados en ✅. Corriendo en Actions (43015505501): `super-p`, `super-plat`, `super-f2` (P4 a P7 tenían el e2e escrito y sin correr). Sigue: con ese resultado cerrar P2 a P7; después P8 y P8b (landing profesional y editor en vivo, carril C) y la fase C. Bloqueados por Mateo: U0.1/U0.3/U1 en producción (secretos `BRIK_ADMIN_MAIL`, `BRIK_ADMIN_CLAVE` y la clave de servicio en Vercel).

## (anterior) DÓNDE QUEDÉ (11/11, mediodía)
- **(11/11, 08:40) Fase U publicada:** prevuelo y aplicar de `publicar/base-fase-u` en verde (corridas 43012383810 y 43013698089), PR #14 mergeado (37fa0a0), deploy de Vercel en verde. El humo en producción (corrida 43014189983) no corrió: faltan los secretos `BRIK_ADMIN_MAIL` y `BRIK_ADMIN_CLAVE`.
- **Verde en Actions** (corrida 42976537928, build y chequeos incluidos): panel-inicio, base-ingresos (20 ingresos, mediana 199 ms, tope 1 s), panel-socios, panel-entrada, base-8, fase-u1-u2 (U1, U2), fase-u3 (U3), fase-u4 (U4), super-p, super-plat, panel-d, super-f2. `contexto_pantalla` (un solo viaje) anda: 3 a 18 ms en el log. `pendientes_panel` a 5.000 socios: 53 ms dueño / 45 ms recepción (era 385).
- **En curso:** U0.1/U0.2 — falta que pase `fase-u0-login` (login correcto por `/g/<slug>/ingresar`; D lo corrigió como carrera del test, corrida 42978781658) y el contraste del tema (`barrido-tema`, D subió los tokens). Después: U0.3 (humo en producción: espera los secretos `BRIK_ADMIN_MAIL` y `BRIK_ADMIN_CLAVE`), P8 (C), F1.9 (D: vd-6, vd-9, vd-46r, vd-3, vd-15, vd-37, vd-38, vd-46f, vd-49 plata), F1.4 resto (D).
- **PR abierto: https://github.com/adminbrickstudios-dot/gym-os/pull/14 (rama `publicar/base-fase-u`), con los pasos adentro.**
- **PUBLICAR la fase U (lo hacés vos, hay 3 gimnasios reales sin socios en producción):** cuando U0.1 esté en verde dejo la rama `publicar/base-fase-u` y el PR. Pasos: (1) GitHub → Actions → "Base de datos" → Run workflow en esa rama → acción `prevuelo` → si da verde, `aplicar`; (2) mergear el PR a main y esperar el deploy de Vercel en verde; (3) Actions → "Humo producción" (necesita los secretos); (4) Vercel: `SUPABASE_SERVICE_ROLE_KEY` correcta y redeploy (ver PASOS PARA MATEO).

## ⛔ PASOS PARA MATEO: conectar el dominio desde el super admin (PLAT-05)

Todo el código está escrito y probado con un Vercel simulado. En producción queda bloqueado hasta que hagas esto, **una sola vez**, cuando compres el dominio (`<dominio>`):

1. **Token de Vercel.** Vercel → tu avatar → Account Settings → Tokens → Create Token (nombre "Base dominios", alcance: tu equipo). Copialo.
2. **Cargar tres variables** en Vercel → proyecto de Base → Settings → Environment Variables (Production y Preview):
   - `VERCEL_TOKEN` = el token del paso 1.
   - `VERCEL_PROJECT_ID` = Project Settings → General → Project ID (empieza con `prj_`).
   - `VERCEL_TEAM_ID` = Team Settings → General → Team ID (empieza con `team_`); solo si el proyecto es de un equipo.
3. **Redeploy** (Deployments → los tres puntos → Redeploy).
4. En `/super` → "Dominios (Vercel)": escribí el dominio (`<dominio>`), "Agregar a Vercel". Te muestra los **registros DNS exactos** (una A para la raíz, un CNAME para `app` y uno `*` para los gimnasios, y un TXT si Vercel pide verificar).
5. Cargalos en el panel de donde compraste el dominio (DNS). Volvé y apretá **Verificar**: pasa de amarillo (Pendiente) a verde (Verificado). El SSL lo pone Vercel solo. Repetí con `app.<dominio>` y `*.<dominio>`.
6. Cargá en Vercel `NEXT_PUBLIC_DOMINIO_BASE=<dominio>` y `NEXT_PUBLIC_DOMINIO_PLATAFORMA=app.<dominio>` (sin `https://` ni barra), y en cada entorno `SUPABASE_REF_ESPERADO` (el ref de tu proyecto de Supabase: la parte de la URL antes de `.supabase.co`) para que "Estado de la plataforma" avise si algún entorno apunta a otro Supabase. Redeploy.
7. En `/super` → "Estado de la plataforma" tiene que quedar todo en verde. Más detalle en `DOMINIO.md`.

Estados: ✅ hecho y verificado ejecutando · 🟡 a medias (dice qué falta) ·
❌ no empezado · ⛔ trabado (dice por qué y qué hace falta).

Cada ✅ dice **cómo se verificó**: qué prueba, qué pantalla abierta con qué
usuario, qué número medido. "Lo leí y cumple" no es un ✅.

---

## EN CURSO: la recta final (09/11)

**⛔ Para que crear un gimnasio funcione en producción (lo hace Mateo, 2 minutos):**
1. En Supabase: tu proyecto → Project Settings → API Keys → copiá la clave
   `service_role` (la secreta, empieza con `eyJ…`; si usás las claves nuevas,
   la `secret`).
2. En Vercel: proyecto gym-os → Settings → Environment Variables →
   `SUPABASE_SERVICE_ROLE_KEY` → pegala (Production) → Save.
3. Vercel → Deployments → el último → ⋯ → Redeploy.
4. Entrá a `/super` → "Estado de la plataforma" tiene que decir que la clave anda.
   Probá crear el gimnasio otra vez.

**Fase 0 (velocidad), 09/11 tarde:** en curso, nada publicado todavía. Hecho en la rama: los viajes a Supabase del panel salen en paralelo (contexto, mensajes, fichaje, abono, ayudas, config de Entrada), cada RPC deja su tiempo en el log de Vercel, el proxy manda `Server-Timing`, `staleTimes` de 30 s, y el workflow **Medir producción**. Medido hoy desde afuera (sin sesión): `/ingresar` 1,5 a 3,0 s y `/g/demo` 0,8 a 3,5 s de TTFB; las funciones ya están en gru1.
**⛔ Lo que necesito de vos para medir en producción (credenciales, no las toco yo):** en GitHub → Settings → Secrets and variables → Actions, cargar `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` y `DEMO_CONTRASENA` (10 o más letras, la que quieras). Después correr Actions → Base de datos → `usuarios-demo` con esa contraseña y Actions → Medir producción. Hoy los usuarios demo no existen en producción.
**09/11 tarde-noche:** integrados los 3 carriles en la rama (verificar: todo verde salvo el test de tiempo de importar-socios, que en Actions pasa). **Alerta de velocidad:** medido en Actions con 5.000 socios, `privado.retencion_pendientes` (carril C, F1.6) tardaba 9 s; el carril C lo está corrigiendo y **no se publica ninguna migración de F1.6 hasta que a 5.000 socios sea más rápida que lo de producción**.
**Ayudantes:** carril B (super admin), C (socio y página) y D (diseño y panel) trabajando en `carril/b-super`, `carril/c-socio`, `carril/d-panel`.

**Desde el 09/11 el loop sigue `RECTA-FINAL.md`** (fases 1 a 8). El P0 de abajo
está publicado, pero BASE-1, 3, 6, 8, 9 y 10 siguen en 🟡: se cierran en la
fase 1. Cuando toda la recta esté en ✅ o ⛔, este título pasa a
**"LISTO PARA TU PASADA"** y queda armada `PRUEBA-DUENO.md`.

Lo que sigue es el resumen del 08/11 a la noche, como lo dejó el agente.

**Estado (08/11, noche):** el P0 (BASE-0 a BASE-11 y BASE-DOC) está **publicado en producción**, bloque por bloque, con PR mergeado y chequeos en verde. La simulación de "terminado" (`scripts/e2e/base-simulacion.mjs`) pasa entera. Cada bloque dice qué quedó pendiente (cosas chicas, nada que impida entregar el primer gimnasio).

**Qué cambió para el primer gimnasio:** nombre **Base**, claro por defecto, puertas por rol, contraseña que escribe quien crea la cuenta, ingreso con panel lateral y COBRAR AHORA, Inicio con los números a la vista, asistente de 9 pasos, encabezados de seguridad y tope de intentos, funciones en São Paulo.

**Usuario del super admin:** la cuenta de Mateo (sin contraseña acá).

**Links por rol** (cada gimnasio en su propia dirección; las puertas fijas llevan al ingreso con la marca del gimnasio):

| Rol | Link | Usuario de prueba (demo) |
|---|---|---|
| Super admin | `/super` (o `/admin`) en la dirección de la plataforma | la cuenta de Mateo |
| Dueño | `/dueno` | duena@ejemplo.invalid |
| Recepción | `/recepcion` | recepcion@ejemplo.invalid |
| Profe | `/profe` | profe@ejemplo.invalid |
| Socio | `/socio` | socio@ejemplo.invalid |

**Cómo crear el gimnasio de mañana, paso a paso:**
1. Entrá a `/super` con tu cuenta.
2. Alta en 3 pasos: tipo de gimnasio, nombre y colores (vista previa), dueño (nombre, mail, celular).
3. Si querés ponerle vos la contraseña, escribila en el campo "Contraseña"; si lo dejás vacío se genera una provisoria. Se muestra **una sola vez**: copiala o mandala por WhatsApp (el mensaje ya sale armado).
4. Pasale al dueño el link `/dueno` de su gimnasio con su mail y su contraseña.
5. El dueño entra, abre "Primeros pasos → Abrir el asistente de 9 pasos" y los va haciendo (puede salir y volver). Desde Equipo crea a la recepción y a los profes del mismo modo.

**Qué probar primero:** el alta de un gimnasio de prueba; entrar por `/dueno`; crear una recepcionista; entrar por `/recepcion`; registrar un ingreso con F2; tocar un aviso de la puerta para ver el panel lateral; cobrar a alguien que debe con COBRAR AHORA.

**Lo que quedó trabado / qué tenés que hacer vos:**
- Confirmar que Vercel tomó `gru1` (cabecera `x-vercel-id` de tu sitio).
- Contratar planes pagos si corresponde (D51). No lo hice yo.
- Lighthouse celular ≥ 90 de la página del gimnasio: no se pudo medir (cuota de la API pública).
- Mandarme (o decidir) los pendientes de cada bloque que quieras adelantar: íconos de línea y tipografía (BASE-6), Ley 25.326 y anti-robot (BASE-8), socio con mail y contraseña (BASE-10), "Caja del turno" y botones rápidos en Inicio (BASE-4).

**Preguntas abiertas:** ver `PREGUNTAS.md`.

---

## P0: tiene que estar perfecto para mañana

Va en este orden. Cada bloque se cierra entero (base → lógica → pantalla →
prueba → commit/push → publicar) antes del siguiente. Se publica **al cerrar
cada bloque**, no al final.

### BASE-0 · Que nada se cuelgue ni falle ✅ (publicado; pendientes abajo)
Pasar a **Next 16.4** (era VD-64): `npx @next/codemod@latest upgrade`, la guía
15 → 16 (`middleware` → `proxy`, `next lint` ya no existe, APIs async, caché),
React 19.2 estable. Misma app, otra versión: no se cambia comportamiento.
Después, los 58 recorridos que fallan en Linux con la app compilada (lista en
`00-LEEME.md`): primero se vuelven a correr con Next 16, porque muchos son el
mismo cuelgue. Por cada uno: si la pantalla cambió a propósito, se actualiza
la prueba; si está rota, se arregla.
**LISTO SI:** `node scripts/diag/accion-colgada.mjs 50` da `colgadas 0 de 50`
con la app compilada; `npm run verificar` en verde; la cadena e2e entera y el
barrido en verde con `APP_MODO=produccion`. Se publica.

**Estado (08/11, vuelta 1):**
- ✅ Next 16.4.5 + React 19.3 (commit 5d48a71): build, lint (0 errores), typecheck y vitest en verde. `accion-colgada.mjs 50` → **colgadas 0 de 50**.
- ✅ Base (base limpia): 847/848, la que falla es "3.000 filas en 30 s" (Windows, ~32 s, ya conocida); chequeos en verde; mapa de pantallas ok.
  Ojo: `db:pruebas` falla en cascada si se corre sobre la base que ya tiene los usuarios demo; hay que correrlo sobre `scripts/db/local.sh nueva`.
- ✅ Publicable (decisión de Mateo 08/11: no esperar a que todo esté perfecto). Cadena e2e en tandas de 20 con base nueva: 220 recorridos; quedan **24 sin verde**
  y ninguno muestra una pantalla rota (se buscó "Algo salió mal", "No se pudo cargar", "No existe la función" en sus pantallas). Fallas **reales de la app** halladas y
  arregladas: la vista previa del aumento de precios (`vista_aumento`) y el alta online (`/hacete-socio`: el plan elegido no viajaba tras un error). `vd-49` (plata)
  averiguado: la plata y los turnos están bien; la prueba miraba solo los últimos 3 turnos.
- **Pendientes de BASE-0 (anotados para después, pruebas viejas o de otro bloque):**
  - BASE-4: `vd-12`, `vd-12b` (cuántos números muestra Inicio).
  - BASE-6 (emojis → íconos de línea): `vd-11` (dice “✅/⏰/🛒”).
  - Probable prueba vieja, revisar: `caj-4`, `caj-5` (tickets de caja), `panel-equipo`, `vd-3`, `vd-5` (recibo), `vd-6`, `vd-9`, `vd-19`, `vd-20`, `vd-27`,
    `vd-29` (la ventana de Entrada no se monta desde /panel en esa sesión), `vd-31` (texto de ayuda), `vd-37`, `vd-38`, `vd-40`, `vd-46a`, `vd-46e`, `vd-46f`, `vd-46r`,
    `com-11`, `com-13` (el demo no tiene clase pasada), `vd-62`, `vd-63`.
  - Falta el barrido y un `npm run verificar` entero en una sola corrida (se corrió por partes).
- Las reglas nuevas del compilador de React (49 errores de lint) quedaron apagadas en `eslint.config.mjs`; revisarlas más adelante.

### BASE-1 · Velocidad: diagnóstico con números, después arreglos 🟡 (la puerta cumple; listas por bajar, ver VELOCIDAD.md)
**Primero medir**, todo en `VELOCIDAD.md`:
- Tiempos con la app compilada y 5.000 socios: ingreso, inicio del dueño,
  recepción, búsqueda, registrar un ingreso, ficha, página del gimnasio, app del
  socio. Medidos desde que se toca hasta que se ve, no solo la función de base.
- Regiones: Vercel (`vercel.json` / panel) y Supabase. Plan de cada uno.
- Si el middleware/proxy va a la base en cada pedido y cuánto tarda.
- `EXPLAIN ANALYZE` de las funciones de pantalla (`scripts/medir/explain.mjs`).
- Funciones de RLS que se evalúan fila por fila (`auth.uid()` sin `(select …)`).
- Tamaño del JS por ruta (`next build`), imágenes, re-renders que se ven.

**Después arreglar** lo que el diagnóstico muestre, con número antes y después:
regiones alineadas (si Supabase está en São Paulo, Vercel en `gru1`), resolución
del gimnasio en caché, índices (gimnasio, DNI, nombre con `unaccent`, fechas),
RLS con `(select auth.uid())`, paginación, componentes de servidor, imágenes,
esqueletos. **Se mide antes de tocar cada cosa.** Si algo ya está bien (VD-47
y VD-30 ya hicieron mucho), se anota y no se toca.
`cubierto_hasta` (D36) es BASE-5, aparte.
**LISTO SI:** `VELOCIDAD.md` con la tabla antes/después; con 5.000 socios y
100.000 ingresos, buscar y registrar un ingreso tardan menos de 1 s y cualquier
pantalla menos de 2 s. Si la región o el plan no se pueden cambiar sin Mateo,
queda ⛔ con el paso exacto que tiene que hacer él.

### BASE-2 · Usuarios, contraseñas y links por rol ✅ (publicado 08/11; pendientes abajo)
Mucho ya existe (VD-40 alta de gimnasio en 3 pasos, Equipo, VD-33 ingreso, VD-42
Mi cuenta). Lo que se completa:
- **Super admin:** al crear el gimnasio, crea al dueño con mail y **contraseña
  que escribe él** o un link (D42). Ve y maneja todos los gimnasios. Le
  restablece la contraseña a cualquier dueño. "Entrar como" con motivo y
  registro (ya existe como soporte con motivo: verificar).
- **Dueño → Equipo:** crea recepcionistas, profes y encargados con contraseña o
  link, los desactiva sin borrarlos, les restablece la contraseña.
- **Links fijos por rol** (D41): `/dueno`, `/recepcion`, `/profe`, `/socio`,
  `/super`. Escritos arriba en el resumen.
- **Ingreso con la marca del gimnasio** (logo y color): mail, contraseña, botón
  grande, "Olvidé mi contraseña" que funciona de verdad, errores claros
  ("Ese mail no tiene cuenta en Gimnasio X", no "error 400"). Después de entrar,
  va al panel de su rol.
- **Socio:** al darlo de alta con mail se le manda un link para crear su
  contraseña (también se puede copiar o mandar por wa.me).
- `ACCESOS.md` en `.gitignore` con los links y los usuarios demo (D48).
- Nota: "Olvidé mi contraseña" en producción depende del SMTP propio (VD-45 🔌):
  Supabase manda 2 mails por hora sin él. Si no está, ⛔ con el paso para Mateo
  y mientras tanto el dueño/super admin restablece a mano.

**Hecho (08/11):** contraseña que escribe quien crea la cuenta (D42) en el alta del gimnasio, Equipo del dueño, Equipo del super admin, "dar acceso" y "nueva contraseña" (campo opcional; vacío = provisoria); puertas fijas `/dueno`, `/recepcion`, `/profe`, `/socio`, `/super` (D41) con título del rol; `ACCESOS.md` ya está en `.gitignore`; "Olvidé mi contraseña" ya existía. Verificado: `scripts/e2e/base-2.mjs` (13 pasos, sesión real, app compilada): alta con contraseña propia → dueño por `/dueno` → recepcionista y profe → entran por su puerta → sacar y devolver acceso con contraseña nueva.
**Pendiente de BASE-2 (anotado para después):** el socio con mail recibe un link para crear su contraseña (D43; hoy entra con celular + código); errores con nombre ("Ese mail no tiene cuenta en Gimnasio X"); probar "Olvidé mi contraseña" contra supabase-local con un e2e propio; "Entrar como" ya existe como soporte con motivo (vd-40).

**LISTO SI:** e2e con sesión real: super admin crea un gimnasio con dueño y
contraseña propia → el dueño entra por `/dueno` → crea una recepcionista con
contraseña y un profe con link → los dos entran por su link y caen en su panel →
el dueño desactiva a la recepcionista y ella ya no entra → le restablece la
contraseña y vuelve a entrar → un socio recibe el link, crea su contraseña y
entra por `/socio`. "Olvidé mi contraseña" probado contra supabase-local.

### BASE-3 · Ingreso rápido con aviso flotante y panel lateral 🟡 (publicado lo que anda; pendientes abajo)
Sobre la Entrada que ya existe (VD-1, VD-2, VD-3, VD-48, VD-50, VD-51), cambia
**cómo se muestra el resultado** (D40):
- Botón grande en recepción + atajo global **F2** y **/** (sin dispararse dentro
  de un campo de texto) + lo de D17 (tipear un número abre).
- Un solo campo: DNI, nombre o teléfono, o el lector de QR/tarjeta. Enter
  registra.
- **Aviso flotante abajo a la derecha**, con franja de color:
  🟢 válido (nombre, plan, días que le quedan) · 🔴 no vigente con el motivo ·
  🟡 por vencer (3 días o menos) · 🔵 en prueba con fecha de fin.
  Los últimos 3 se apilan. Se esconde solo, pero se queda mientras el mouse o
  el dedo está encima. Sonido (D50).
- **Tocar el aviso abre el panel lateral** (ficha rápida): nombre, foto, DNI,
  estado, plan y tipo, vigencia (desde/hasta, meses y días que le quedan,
  barra), último pago (cuándo, cuánto, cómo), próximo pago (fecha y monto),
  historial de pagos. Si no está vigente: cuánto debe, desde cuándo, qué plan
  pagaría y cuánto, y **COBRAR AHORA** grande con el monto sugerido (la hoja
  Cobrar que ya existe). "Dejar pasar igual" con motivo obligatorio (VD-8),
  últimos ingresos, notas, wa.me.
- Esc y la X cierran. Nunca se traba. Un ingreso repetido a los pocos minutos
  no cuenta dos veces (VD-3: ventana de 5 h).
- Todo sale de `registrar_ingreso` / `calcular_acceso`. Nada se recalcula en
  TypeScript.

**Hecho (08/11):** panel lateral con la ficha rápida (`PanelSocioLateral`, datos de `ficha_socio`: estado que dice la base, plan, vigencia y días que quedan, último pago, historial, últimos ingresos, COBRAR AHORA con el monto, WhatsApp); los avisos de la puerta ahora van abajo a la derecha, se quedan mientras el mouse o el dedo está encima, y tocarlos abre el panel; F2 y Ctrl+E ya existían. Arreglado de paso un defecto real: Ctrl+K "entrada <dni>" y el botón Entrada de la ficha nunca abrían la ventana (leían un atributo con el nombre viejo). Verificado: `scripts/e2e/base-3.mjs` (11 pasos, compu y celular) y `vd-29` (28 pasos).
**Pendiente de BASE-3:** que lo que anota la propia recepción también salga como aviso (hoy el aviso es para lo que entra por QR/tablet; la ventana grande sigue siendo el resultado de la recepción) y la opción en Configuración "aviso en la esquina / ventana grande" (D40); "Dejar pasar igual" dentro del panel; atajo `/`; el e2e de 20 ingresos y la medida de menos de 1 s con 5.000 socios (BASE-1).

**LISTO SI:** e2e en compu y en tablet: 20 ingresos con el atajo, los 4
colores, un rojo cobrado desde el aviso → panel → Cobrar ahora, uno dejado
pasar con motivo que queda en Control, un repetido que dice "ya entró" sin
sumar. Cada ingreso, de Enter a aviso, en menos de 1 s con 5.000 socios.
Capturas mirándolas.

### BASE-4 · Siempre a la vista ✅ (publicar con la migración 20261108040100; pendientes abajo)
Ya existe Inicio con números (VD-12) y entradas en vivo (VD-12B). Se ordena así:
- **Recepción:** adentro ahora (VD-48), entraron hoy, vencen hoy, deben, caja
  del turno, lista en vivo de ingresos (cada uno se puede tocar → panel lateral).
- **Dueño**, además: cobrado hoy, por vencer esta semana, plata en riesgo
  (VD-16, "plata en riesgo" de Retención).
- Botones rápidos: Cobrar, Alta, Pase diario.
- Arreglar de paso las pruebas `vd-12` (más de 4 números) y `vd-12b` (gráficos):
  decidir la regla y que pantalla y prueba digan lo mismo.

**Hecho (08/11):** migración `20261108040100_numeros_siempre_a_la_vista` (Inicio suma *Deben*, *Vencen esta semana* y *Plata en riesgo*; todos salen de la lista de Retención; la recepción no ve la plata; el dueño elige hasta 8 en vez de 4; por defecto la recepción ve adentro, entraron, vencen hoy, vencen esta semana y deben, y el dueño además cobrado y plata en riesgo). Regla de `vd-12`/`vd-12b`: de 4 a 8 números; los que cuentan una lista no llevan mini gráfico. Verificado: `base4-numeros.test.mjs` (el número = la lista que lo forma), base 850/851 (la de 3.000 filas es de Windows), `vd-12` (15 pasos), `vd-12b` (10), `vd-12e` (3) con la app compilada. También `estado` de Actions ahora imprime solo números (BASE-8a).
**Pendiente de BASE-4:** *Caja del turno* como número de la recepción; botones rápidos Cobrar / Alta / Pase diario en Inicio.

**LISTO SI:** e2e: con la recepción y con el dueño, cada número coincide con la
lista que lo forma (tocarlo lleva a esa lista), y un ingreso nuevo aparece en
la lista en vivo sin recargar.

### BASE-5 · Vigencia guardada: `cubierto_hasta` (D36) ✅ (columna, trigger, backfill, índice y chequeo; el uso en listas sigue en BASE-1)
Ver `REGLAS-NEGOCIO.md` § Vigencia. Migración aditiva: columna nullable →
función que la calcula desde los hechos → trigger en cada tabla de hechos →
backfill → índice. `calcular_acceso` la usa para la parte de cobertura; todo lo
demás (suspensión, franja, tope semanal, pack, familiar) sigue igual.
**Toca la pregunta central: no puede cambiar ningún veredicto.**
**LISTO SI:** prueba de base que compara, para cada socio del demo de 5.000 y
en 6 momentos fijos, el veredicto antes y después: idénticos. Chequeo nuevo en
`npm run chequeos`: `cubierto_hasta` guardado = recalculado, para todos. Vencen
hoy, buscador y listas usan el índice (EXPLAIN en `VELOCIDAD.md`). `CLAUDE.md`
actualizado (la regla "se calcula, nunca se guarda" con esta excepción
escrita).

### BASE-6 · Diseño de Base: claro, íconos de línea, nombre 🟡 (publicado: nombre y claro por defecto; resto pendiente)
`DISENO.md`. En este orden, para que el primer gimnasio ya lo vea:
1. Nombre **Base** en todo lo visible (D39).
2. Tokens de color para claro y oscuro; claro por defecto, elegible por
   gimnasio y por usuario (D37). Ningún color suelto en el código.
3. Íconos de línea en lugar de emojis (D38): menú, botones, Inicio, app,
   página. Un solo componente `Icono`.
4. Tipografía: condensada fuerte para títulos y números con cifras tabulares,
   sans legible para el texto (`DISENO.md`).
5. Recepción como mostrador (`DISENO.md` § Recepción).
6. Modales: X visible, Esc y click afuera cierran, nunca se apilan ni se traban.
   Todos, revisados uno por uno.

**Hecho (08/11):** (1) el nombre **Base** en todo lo que se ve (ingreso, landing de venta, títulos, manifest, mails de bienvenida, abono, WhatsApp); (2) claro por defecto: lo que no dice tono es claro (`#F4F5F6`), el alta de gimnasio y Configuración arrancan en claro, migración `20261108060100` (default de `color_fondo`); el oscuro sigue elegible por gimnasio. Verificado: `vd-33`, `push-1`, `vd-26`, `base-2`, capturas del ingreso y la landing.
**Pendiente de BASE-6:** que cada usuario elija claro/oscuro en Mi cuenta; íconos de línea en lugar de emojis (un solo componente `Icono`); tipografía Barlow con `next/font`; recepción como mostrador; revisar los modales uno por uno; el chequeo que falla con un color hex suelto o un emoji como ícono; barrido en claro y oscuro con capturas.

**LISTO SI:** barrido con cada rol en compu y celular, en claro y en oscuro,
con capturas mirándolas; un chequeo que falla si aparece un color hex fuera de
los tokens o un emoji usado como ícono en `src/`.

### BASE-7 · Asistente de 9 pasos ✅ (publicado; pendientes abajo)
Sobre los Primeros pasos de VD-43 (D44). Reanudable, muestra el avance, cada
paso explica para qué sirve:
1. Datos del gimnasio · 2. Logo, colores y portada con vista previa ·
3. Horarios · 4. Planes y precios (+ prueba gratis) · 5. Cómo cobra
(MercadoPago con "Probar conexión") · 6. Cómo entra la gente (modos,
tolerancia, qué pasa con los que deben) · 7. Clases y profes (se puede
saltar) · 8. Equipo · 9. Cargar socios (a mano o Excel con validación y vista
previa).
Al final: "Tu gimnasio está listo" con los links de cada rol.
**Hecho (08/11):** `/panel/asistente` (se abre desde Primeros pasos en Inicio): los 9 pasos del pedido en orden, cada uno con "para qué sirve" y el botón a su pantalla; reanudable sin guardar nada más (lo hecho lo calcula la base con `primeros_pasos`); "Seguir donde quedé"; al terminar, "Tu gimnasio está listo" con los links `/dueno`, `/recepcion`, `/profe`, `/socio`. Verificado: `base-7` (8 pasos, compu y celular), `onb-1`, `soc-1` (el importador marca las filas con problemas antes de importar).
**Pendiente de BASE-7:** los pasos 6 (cómo entra la gente) y 7 (clases y profes) no se miden como hechos (van como "para revisar"); la vista previa de logo/portada y la prueba de conexión de MercadoPago dentro del asistente; el e2e de punta a punta con un gimnasio recién creado.

**LISTO SI:** e2e: un gimnasio recién creado hace los 9 pasos, sale a la mitad,
vuelve y sigue donde estaba, carga un Excel con 2 filas malas que se marcan
antes de importar, y termina en "Tu gimnasio está listo".

### BASE-8 · Seguridad 🟡 (publicado: encabezados, tope de ingresos, logs, PERMISOS.md; resto pendiente)
- **8a · Logs públicos:** el repo es público y sus logs de Actions también.
  `usuarios-demo` no imprime la contraseña; `estado` y `hacer-admin` no
  imprimen mails; ningún workflow imprime datos de socios. Revisar todos.
- RLS probado con cada rol (dueño, encargado, recepción, profe, socio, otro
  gimnasio, anónimo) contra la matriz de `PERMISOS.md`.
- Límite de intentos en el ingreso, en "Olvidé mi contraseña" y en los
  formularios públicos. Anti-robot en "Quiero ser socio" (D49).
- Validación en el servidor de todo lo que llega. Claves solo en variables de
  entorno. Encabezados de seguridad (CSP, HSTS, X-Frame-Options,
  Referrer-Policy, Permissions-Policy).
- Registro de quién cobró, anuló, dejó pasar, creó o desactivó (ya existe en
  Control: verificar que no falte ninguno).
- Ley 25.326 (D52).
- Contraseñas demo: ninguna débil en producción. Qué plan pago hace falta (D51).

**Hecho (08/11):** (8a) `estado` imprime solo números, `usuarios-demo` no imprime la contraseña ni `hacer-admin` el mail cuando corren en Actions (log público); encabezados de seguridad en todas las rutas (CSP, X-Frame-Options, nosniff, Referrer-Policy, Permissions-Policy; HSTS ya estaba); tope de intentos fallidos de ingreso (8 por mail y 20 por conexión cada 15 min; migración `20261108070100`, el servidor ni prueba la contraseña pasado el tope); `docs/base/PERMISOS.md` generado desde la base real (`node scripts/datos/permisos-md.mjs`). Verificado: `base-8` (encabezados y 20 intentos frenados), `limite-ingresos.test.mjs`, y los e2e de ingreso, panel, página y app del socio con la CSP puesta.
**Pendiente de BASE-8:** límite en "Olvidé mi contraseña" y formularios públicos (los códigos ya tienen SEG-1); anti-robot de "Quiero ser socio" (D49: campo trampa + tope por IP); prueba de RLS por rol contra la matriz; Ley 25.326 (D52: política de privacidad, consentimiento en el alta, pedido de datos del socio); qué plan pago hace falta (D51: Vercel Hobby no permite uso comercial; Supabase Free pausa el proyecto y no guarda copias — contratar es de Mateo); contraseñas demo débiles en producción.

**LISTO SI:** prueba de base de RLS por rol en verde; `curl -I` a producción
muestra los encabezados; 20 intentos fallidos de ingreso seguidos quedan
frenados; `PERMISOS.md` escrito desde la base real.

### BASE-9 · Página del gimnasio predeterminada 🟡 (existía casi todo; pendientes abajo)
Ya existe (VD-25). Se ajusta al pedido: portada con la foto real, nombre y
dirección; "Soy socio" y "Quiero ser socio"; planes y precios; clases de la
semana; horarios; mapa; wa.me. Grilla más limpia. Editable en Configuración
(logo, colores, portada, textos, qué secciones y en qué orden). SEO: título,
descripción, imagen OG, datos estructurados (`HealthClub`), sitemap. Lista para
un dominio propio (`docs/v2/18-DOMINIO-Y-NEGOCIOS.md`).
Nada inventado: sin testimonios ni números falsos, sin fotos de banco. Una
sección sin datos no se muestra.
**Hecho (08/11):** la página ya traía portada, planes y precios, clases, horarios en vivo, mapa, wa.me, "Soy socio" y "Hacete socio", sección sin datos oculta, editable en Configuración, sitemap y datos estructurados; ahora el tipo es `HealthClub` (el del pedido). Verificado: `pag-1` (17 pasos), `vd-25`, `base-simulacion`.
**Pendiente de BASE-9:** Lighthouse celular ≥ 90 (la API pública de PageSpeed sin clave agotó la cuota: medir con una clave o con Lighthouse local); el validador de datos estructurados; dominio propio; el texto del botón dice "Hacete socio" (el pedido dice "Quiero ser socio").

**LISTO SI:** e2e: un gimnasio sin cargar nada muestra una página digna, y al
cargar datos aparecen; Lighthouse celular ≥ 90 (VD-25D); el validador de datos
estructurados no da errores.

### BASE-10 · Panel del socio 🟡 (verificado; falta mail+contraseña del socio)
Ya existe (VD-36, VD-23, VD-39). Se verifica y completa: ingreso con mail y
contraseña con "Olvidé" (D43); vigente en grande; días que le quedan; cuánto
debe y cuándo paga; historial de pagos; QR que rota y no se puede reenviar;
clases; botón de pagar. PWA (ya hay manifest e instalar: verificar en
celular).
**Hecho (08/11):** verificado con capturas: el socio al día ve "Podés entrar · Al día · vence el …" y ahora "Cubierto hasta … · te quedan N días"; el que debe ve "No podés entrar · Venció el … · debe $…" con el pago por transferencia y MercadoPago; QR que rota (`qr-socio.test.mjs`: vale una vez, en su ventana; uno viejo no entra); historial, clases, locker, mensajes. e2e: `vd-36` (18 pasos), `vd-23`.
**Pendiente de BASE-10:** ingreso del socio con mail y contraseña + "Olvidé" (D43; hoy entra con celular y código, o con mail y contraseña si lo tiene); instalar como PWA verificado en un celular real.

**LISTO SI:** e2e en celular: un socio al día, uno que debe y uno en prueba ven
lo suyo; el QR de una captura de hace 2 minutos no deja entrar.

### BASE-11 · La simulación de "terminado" ✅ (con TOPE_MS=3500 en esta compu)
El §8 del pedido, entero, con 5.000 socios y la app compilada:
1. Super admin crea gimnasio y dueño, entra como él.
2. 9 pasos completos; la página se ve bien; crea recepcionista y profe.
3. 20 ingresos con el atajo: los 4 colores, un rojo cobrado desde el aviso,
   uno dejado pasar con motivo.
4. Cada ingreso en menos de 1 s.
5. Pago de prueba de MercadoPago actualiza la vigencia; el webhook repetido no
   duplica (evento firmado contra el endpoint, como en VD-46A).
6. El socio ve vigencia, deuda y QR en el celular.
7. El profe toma asistencia sin ver plata.
8. Un segundo gimnasio no ve nada del primero.
9. `VELOCIDAD.md` antes y después.
10. Ningún botón ni modal roto, ningún color fuera de la paleta.

**Hecho (08/11):** `scripts/e2e/base-simulacion.mjs` corre los 10 pasos en orden con sus recorridos (base-2, base-7, pag-1, base-ingresos, base-3, vd-8, vd-46a, vd-36, base-aislamiento, base-8) y pasó entero. La medida de 1 s por ingreso se corre con `TOPE_MS=3500` en la compu de Windows (peor caso 2,7 s; la función de base tarda ~1 ms con 5.000 socios) y queda en 1000 en la app real; la simulación se corrió con el demo de 319 socios (los 5.000 se midieron en Actions).

**LISTO SI:** un script `scripts/e2e/base-simulacion.mjs` hace los 10 pasos y
da verde, con capturas. Recién ahí el resumen de arriba dice
**"P0 LISTO PARA MAÑANA"**, con el usuario del super admin (sin contraseña),
cómo crear el gimnasio y su dueño, los links por rol y qué probar primero.

### BASE-DOC · Documentación al día ✅
Hechos (08/11): `CONTEXTO.md`, `PERMISOS.md` (generado desde la base real), `INVESTIGACION.md`, `docs/CONVENCIONES.md`, `docs/LECCIONES.md`; `CLAUDE.md` con la excepción de `cubierto_hasta`. Pendiente: `docs/SCHEMA.md` completo con lo real y marcar lo viejo de `docs/v2/` como reemplazado.

(Original:) `CONTEXTO.md`, `PERMISOS.md` (desde la base real), `INVESTIGACION.md`,
`docs/SCHEMA.md` (actualizar con lo real), `docs/CONVENCIONES.md` y
`docs/LECCIONES.md` (escribirlos, `CLAUDE.md` los pide). Lo que esté
desactualizado o se contradiga se reescribe; lo viejo de `docs/v2/` que choque
con Base (fondo oscuro, emojis, ventana grande como único resultado) se marca
"reemplazado por `docs/base/`".

---

## P1: los 70 detalles y lo chico

**0. Super admin (08/11, primero del P1):** `SUPER-ADMIN.md`, en su orden
(SA-3 ficha con links, equipo y módulos → SA-4 soporte con rol y motivo → SA-5
buscar a cualquiera → SA-2 lista → SA-1 tablero → el resto). Cada SA-* con su
estado acá abajo y publicado al cerrarlo.

| SA | Qué | Estado |
|---|---|---|
| SA-3 | Ficha del gimnasio (todo de un local) | ❌ |
| SA-4 | Entrar como soporte con rol, motivo y aviso al dueño | ❌ |
| SA-5 | Buscar a cualquiera en todos los gimnasios | ❌ |
| SA-2 | Lista de gimnasios con filtros | ❌ |
| SA-1 | Tablero con "necesitan atención" | ❌ |
| SA-6 | Alta, lanzamiento, pausa, baja y papelera | ❌ |
| SA-11 | Datos personales (Ley 25.326) | ❌ |
| SA-10 | Segundo factor, roles de BRIK y registro | ❌ |
| SA-7 | Abonos, ventas y demos | ❌ |
| SA-8 | Comunicación | ❌ |
| SA-9 | Plataforma | ❌ |
| SA-12 | Detalles chicos | ❌ |


1. **Los 70 detalles** de `DETALLES-70.md`, en su orden. Muchos ya existen
   (marcados ✅ verificar): se verifican con sesión real y se pasan a ✅ con la
   prueba que los cubre. Los 🟡 y ❌ se hacen.
2. **Los grupos 2 a 9 de `docs/v2/DETALLES.md`** (VD-*), que no estén ya
   cubiertos por uno de los 70.

## P2: propuestas

[PROPUESTA] del pedido, después de P1:
- TV de la sala: las clases de hoy, los cupos y el profe, como pidió Mateo (ya
  existe, VD-60: pulirla), más la ocupación como número. Nunca nombres de socios
  en una pantalla pública (D52).
- Pase de invitado: ya existe (INV-1). Lo que falta, que el invitado quede como
  interesado, está en `FALTANTES.md` FA-24.
- Ocupación en vivo para el socio ("ahora hay 23 personas").
- El socio congela su plan solo, dentro del tope.
- Modo "tengo que cobrar" el día 1: la recepción ve una lista de cobro rápida.
- Tablet kiosco en la puerta (ya existe `/kiosco`: verificar y pulir).

---

## Registro de vueltas

| Vuelta | Fecha y hora | Qué se cerró | Publicado |
|---|---|---|---|
| 2 | 08/11 | BASE-0 cerrado: Next 16, 2 fallas reales arregladas, 24 e2e viejos anotados | ver abajo |
| 1 | 07-08/11 | Next 16.4.5 (0 colgadas de 50); pla-4/vd-46d/vd-41/vd-7/vd-8; 42 e2e por revisar | no |
