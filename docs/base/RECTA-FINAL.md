🟡 e2e `base-ingresos` 9/9 en Actions (20 ingresos, mediana 199 ms, peor 254 ms, tope 1 s; 3 colores); aviso, opción en Configuración y “Dejar pasar igual” andan; atajo `/` agregado y sonido ya existía; falta el e2e de los 4 colores y del atajo `/` |✅ `DOMINIO.md` escrito con los pasos exactos; `host.test.ts` prueba plataforma en la raíz, `gim.dominio` y dominio propio con hosts simulados (`base.localhost`, `gim.base.localhost`, `migimnasio.com.ar`), 6/6; ningún `vercel.app` en el código salvo un ejemplo del formulario, que ya cambié |🟡 fuentes ya salen de `@fontsource` (propias, sin Google); falta Barlow (con F1.4), `next/image` en las fotos de la app y el ingreso, y JS por ruta |🟡 `entradaRapida` (una llamada, sin revalidar antes del aviso, refresco único 2 s después), aviso, opción en Configuración y ventana grande andan en e2e; local con la app compilada: mediana 1,4 a 2 s y mejor 0,56 s (compu Windows con base simulada, no sirve de medida); falta medirlo en producción/Actions (< 1 s), el atajo `/` y el sonido a verificar |🟡 `staleTimes` 30 s puesto; faltan `useOptimistic` en ingreso, cobrar, asistencia, tareas y reservas |🟡 el menú ya llega después de pintar (cliente); falta bajar `pendientes_panel` de 300 a <50 ms (va con F1.6, `cubierto_hasta`) |🟡 contexto y layout en paralelo (de 7 viajes en fila a 3); falta `contexto_pantalla` en una sola función y la caché por gimnasio |🟡 script `scripts/medir/produccion.mjs` + `medir-produccion.yml` escritos, `Server-Timing` del proxy y log `[rpc] nombre ms` puestos; falta correrlo en producción (⛔ faltan secretos, ver PROGRESO) |# La recta final de Base (09/11)

**La única lista que sigue el loop desde ahora.** Al terminarla, a Mateo le
queda solo su pasada visual y la prueba del dueño (`PRUEBA-DUENO.md`). Todo lo
demás lo hace el agente.

Cada ítem dice dónde está el detalle. El estado se marca acá: ✅ (cumple su
LISTO SI completo y se verificó ejecutando) · 🟡 · ❌ · ⛔ (trabado: dice qué
hace falta).
- Un 🟡 no cuenta como terminado.
- Se publica al cerrar cada fase, o antes si un ítem grande queda listo.
- `PROGRESO.md` sigue teniendo el detalle de cada BASE-* y arriba el
  "RESUMEN PARA MATEO", que se reescribe al cerrar cada fase.

Dónde quedó (09/11, mediodía):
- Publicado: BASE-0, 2, 3, 4, 5, 7, 8 y 11 (PR #5 a #13).
- Quedan a medias: BASE-1, 3, 6, 8, 9 y 10.
- Desde el 08/11 a las 15:21 no se hizo nada: el loop se cortó.

---

## Fase U · Urgente antes de todo (Mateo, 09/11 a la noche): **se publica apenas está en verde, esta misma noche**

| # | Qué | LISTO SI | Estado |
|---|---|---|---|
| U0.1 | **URG-01/02 · El login está roto** (Mateo, 09/11): entra por `/g/template-gym/ingresar` con el mail y la contraseña que creó, lo manda a `/ingresar` y le dice "mail o contraseña incorrectos". Reproducirlo **en producción**: crear un gimnasio de prueba con su dueño desde `/super`, cerrar la sesión y entrar por las 3 puertas. Anotar a qué dirección redirige, el error real de Supabase y qué filas existen (`auth.users`, equipo, gimnasio). Revisar las 7 causas de `AJUSTES-0911-NOCHE.md` (URG-02). La más probable: la cuenta nunca se creó porque el alta falló con "Invalid API key" (U1). La causa real va a `docs/LECCIONES.md` | La causa escrita con la prueba (SQL y registro); el dueño de un gimnasio nuevo entra en producción | 🟡 causa probable escrita (LECCIONES.md) y e2e `fase-u0-login` 18 pasos en verde en Actions (alta con mail en mayúsculas, 3 puertas, rol dueño, errores con motivo, mail ya existente); falta confirmarlo en producción (clave de servicio de Vercel) |
| U0.2 | **URG-03 · Login universal y errores honestos**: PLAT-02, PLAT-03, PLAT-07 y PLAT-08 de `PLATAFORMA.md` | e2e: 0, 1 y varios gimnasios; desde la puerta de un gimnasio ajeno, el mensaje claro; cada caso de PLAT-08 con su texto; nunca cae al demo | 🟡 e2e: puerta ajena dice "no es de este gimnasio", `/elegir` solo lista los de la cuenta (fase-u3), 0 gimnasios con mensaje con salida (vitest); falta e2e de 0 y varios gimnasios y el wa.me de BRIK |
| U0.3 | **URG-04 · Prueba permanente en producción**: después de cada publicación, el super admin crea un gimnasio con su dueño, se entra por las 3 puertas (`/ingresar`, `/g/<slug>/ingresar`, `/dueno`), se aterriza en el panel correcto con el rol correcto y se borra el gimnasio de prueba. Corre en Actions (`humo-produccion.yml`, junto con CAL-07) | La corrida en verde después de la publicación de la fase U | 🟡 `humo-produccion.yml` y script escritos; ⛔ falta que cargues `BRIK_ADMIN_MAIL` y `BRIK_ADMIN_CLAVE` y publicar |
| U1 | **Crear un gimnasio con su dueño desde el super admin funciona en producción.** Hoy falla con "Invalid API key": en Vercel, `SUPABASE_SERVICE_ROLE_KEY` falta, es de otro proyecto o no es la clave `service_role`. Lo carga Mateo (pasos arriba de `PROGRESO.md`). El agente: (a) el error dice en palabras qué pasa y qué hacer ("Falta la clave de servicio en Vercel: …"), nunca "Invalid API key"; (b) si el alta falla a la mitad, el gimnasio queda con "Terminar alta: dar acceso al dueño" en la ficha y en la lista, sin crear otro; (c) el chequeo de `/super` (Estado de la plataforma) prueba la clave creando y borrando un usuario de prueba | e2e contra supabase-local con la clave mal puesta: muestra el error claro y "Terminar alta" funciona después; en producción Mateo crea un gimnasio y su dueño entra | 🟡 e2e `fase-u1-u2` 40 pasos en verde en Actions (error en palabras, "Terminar alta", chequeo de la clave); falta producción: Mateo carga la clave `service_role` en Vercel y crea un gimnasio |
| U2 | **Sin mails: la cuenta se crea en la base con el mail y la contraseña que escribe quien la crea** (ya es así: `createUser` con `email_confirm`). Que en ningún alta (dueño, equipo, socio) se mande un mail ni se pida confirmar el mail. El acceso lo pasa Mateo por chat | e2e: alta de dueño, de recepcionista y de socio con contraseña; ninguno recibe mail (supabase-local no registra envíos) y los tres entran al toque | ✅ `fase-u1-u2` en Actions (alta de dueño, recepcionista y socio con contraseña entran al toque, sin mails); los códigos que pide la propia persona siguen (PREGUNTAS.md) |
| U3 | **Cada cuenta entra solo a su gimnasio.** Un dueño de A no ve nada de B: ni por la dirección de B, ni por `/g/<slug-de-B>`, ni cambiando la cookie, ni llamando a las funciones con el id de B. Lo mismo recepción, profe y socio. El mismo mail puede ser dueño de dos gimnasios solo si el super admin lo da de alta en los dos | prueba de base por rol y por función (todas las `public.*` con `p_gimnasio_id` ajeno dan error 42501, nunca datos ni lista vacía) + e2e que intenta entrar a B con el dueño de A por las 4 vías | ✅ prueba de base `aislamiento-gimnasios` (2.224 + 195 llamadas, RLS; arregló `usa_qr_pared` y `registra_salida`) + e2e `fase-u3` 36 pasos en verde en Actions (4 vías) |
| U4 | **La página del gimnasio es siempre su landing.** Se saca el "Estamos armando nuestra página": desde que se crea, cada gimnasio muestra la landing predeterminada con lo que tenga (nombre, logo, color, dirección, planes, horarios, clases, WhatsApp, "Soy socio" y "Quiero ser socio"). Las secciones sin datos no se muestran. "Soy del equipo" va chico al pie. Si el dueño no quiere página pública, la opción "Ocultar mi página" deja solo una portada con su marca y los dos botones, nunca un cartel de "en construcción". Lo mismo en la imagen OG | e2e: un gimnasio recién creado sin cargar nada muestra su landing con nombre, color y los botones; al cargar planes y horarios aparecen; con "Ocultar" queda la portada; en ningún caso aparece "armando" | ✅ `fase-u4` 24 pasos en verde en Actions (landing siempre, "Ocultar mi página", sin "armando", planes/horarios/dirección aparecen al cargarlos, og) |
| U5 | **El dominio (Mateo lo compra el 10/11).** Dejar todo listo para conectarlo en minutos: `docs/base/DOMINIO.md` con los pasos exactos para Mateo (agregar el dominio y el comodín `*.dominio` en Vercel, los registros DNS, las variables `NEXT_PUBLIC_DOMINIO_BASE` y `NEXT_PUBLIC_DOMINIO_PLATAFORMA`, redeploy). Verificar en el código que la plataforma quede en la raíz del dominio, cada gimnasio en su subdominio (`gimnasio.dominio`) y que el dominio propio de un gimnasio siga funcionando. El agente no compra nada | `DOMINIO.md` escrito; prueba local con hosts simulados (`base.localhost`, `gim.base.localhost`, un dominio propio) que resuelve cada caso; nada que diga `vercel.app` hardcodeado | ❌ |

## Fase P · Plataforma, alta y web (`PLATAFORMA.md`, `AJUSTES-0911-NOCHE.md`)

| # | Qué | Estado |
|---|---|---|
| P1 | PLAT-01: el mapa de direcciones en el código, listo para el dominio (con U5) | ❌ |
| P2 | PLAT-04: ninguna dirección escrita a mano, con su chequeo | 🟡 carril/b-super: src/lib/urls.ts + test que falla con direcciones a mano; reemplazado en src/app/admin y src/lib/admin; el resto está en EXCEPCIONES (otros carriles) |
| P3 | PLAT-06: variables por entorno y el chequeo de que producción apunta al Supabase correcto | 🟡 carril/b-super: lista de variables por entorno en Estado de la plataforma (ref de la URL vs claves vs SUPABASE_REF_ESPERADO); falta que Mateo cargue SUPABASE_REF_ESPERADO |
| P4 | EDIT-S01: crear un gimnasio en 1 minuto desde una plantilla (slug validado, único y sin tildes; dueño ya confirmado; landing publicada; filas verificadas; "Probar acceso" automático al terminar). Completar lo de U1 y SA-6, no rehacer | 🟡 carril/b-super: dirección normalizada y reservada, plan de Base, dueño confirmado, landing publicada y "Probar acceso" automático; e2e super-p.mjs escrito, sin correr |
| P5 | EDIT-S02: tarjeta "Accesos" lista para mandar por wa.me (link del panel, mail, contraseña visible solo al crearla, link de la web) | 🟡 carril/b-super: tarjeta Accesos con panel, mail, contraseña (solo al crear), web, copiar y wa.me; no ofrece una contraseña que no se aplicó; e2e escrito, sin correr |
| P6 | EDIT-S03: "Probar acceso" por usuario (existe, confirmado, activo, gimnasio, rol, último ingreso), en verde o rojo, con "Arreglar" | 🟡 carril/b-super: Probar acceso por persona con verde, amarillo y rojo y Arreglar (confirmar, activar, reanudar); prueba de base 5/5; e2e escrito, sin correr |
| P7 | EDIT-S04 y S05: resetear contraseña, desactivar, cambiar rol, mover de gimnasio; "Entrar como" con la barra "Estás viendo como <gimnasio>" (completar SA-4) | 🟡 carril/b-super: desactivar, activar, cambiar rol, mover (misma cuenta) y barra "Estás viendo como"; resetear contraseña ya existía; e2e escrito, sin correr |
| P8 | WEB-01 a 05: la landing se ve profesional con cero configuración (solo nombre y color: portada tipográfica fuerte, nunca un hueco); bloques por datos (portada, planes, clases, horarios, galería, profes, mapa, preguntas, wa.me, Soy socio, Quiero ser socio); estilo de `DISENO.md`; celular primero, menos de 2,5 s en 4G con caché por gimnasio (`revalidateTag` al editar); Google (título, imagen para compartir, sitemap y robots por gimnasio, `ExerciseGym`, favicon con el logo, 404 con el estilo del gimnasio). Completar U4 y BASE-9 | ❌ |
| P9 | PLAT-05: dominios desde el super admin por la API de Vercel (⛔ hasta el dominio y `VERCEL_TOKEN`) | ⛔ carril/b-super: escrito y probado con un Vercel simulado; bloqueado en producción hasta VERCEL_TOKEN, VERCEL_PROJECT_ID y el dominio (pasos arriba de PROGRESO.md) |

## Fase 0 · Que sea rapidísimo en producción (primero: Mateo lo ve lento; objetivos en `VELOCIDAD.md`, por debajo del promedio)

| # | Qué | Detalle | Estado |
|---|---|---|---|
| F0.1 | Medir en producción: `Server-Timing` y `medir-produccion.yml` (Playwright contra producción desde Actions), con la tabla de antes | `VELOCIDAD.md` § Plan de la fase 0 | ❌ |
| F0.2 | Un solo viaje para el contexto (`contexto_pantalla`), caché de lo que no cambia, el proxy sin viajes de más | `VELOCIDAD.md` | 🟡 `contexto_pantalla` (un solo viaje) aplicado y probado igual-a-las-piezas 5/5; layout y `contextoPanel` la usan; falta la caché por gimnasio y verlo en Actions/producción |
| F0.3 | El menú (`pendientes_panel`) después de pintar y en menos de 50 ms | `VELOCIDAD.md` | ❌ |
| F0.4 | Navegación instantánea: `staleTimes`, `prefetch`, `useOptimistic` en las acciones de todos los días | `VELOCIDAD.md` | ❌ |
| F0.5 | Imágenes, fuentes, JS por ruta, búsqueda, índices y re-renders (punto 6 del plan) | `VELOCIDAD.md` | ❌ |
| F0.6 | Pasos para Mateo (claves asimétricas de Supabase, planes) escritos arriba de `PROGRESO.md`; la tabla de después con todos los objetivos cumplidos en producción | `VELOCIDAD.md` | ❌ |

## Fase 1 · Cerrar lo que quedó a medias del P0

| # | Qué | Detalle | Estado |
|---|---|---|---|
| F1.1 | **BASE-3**: el ingreso que hace la recepción sale como aviso abajo a la derecha. Además: la opción en Configuración "aviso en la esquina / ventana grande", "Dejar pasar igual" dentro del panel, el atajo `/` y el sonido (D50). E2e de 20 ingresos con los 4 colores | `PROGRESO.md` BASE-3 | ❌ |
| F1.2 | **BASE-10 + BASE-2**: el socio entra con mail y contraseña y "Olvidé mi contraseña". Al darlo de alta con mail, recibe el link para crear su contraseña. Errores con nombre ("Ese mail no tiene cuenta en Gimnasio X"). E2e de "Olvidé" | `PROGRESO.md` BASE-2 y BASE-10 | ❌ |
| F1.3 | **BASE-4**: "Caja del turno" como número de la recepción; botones rápidos Cobrar, Alta y Pase diario en Inicio | `PROGRESO.md` BASE-4 | ❌ |
| F1.4 | **BASE-6**: tema claro u oscuro elegible por usuario, íconos de línea en lugar de emojis (componente `Icono`), letra Barlow, recepción como mostrador, modales revisados, chequeo que falla con un color suelto o un emoji como ícono, barrido en claro y oscuro con capturas | `DISENO.md`, `PROGRESO.md` BASE-6 | ❌ |
| F1.5 | **BASE-7**: pasos 6 y 7 medidos como hechos, vista previa de logo y portada, "Probar conexión" de MercadoPago dentro del asistente, e2e con un gimnasio recién creado | `PROGRESO.md` BASE-7 | ❌ |
| F1.6 | **BASE-1** (lo que no cubrió la fase 0): las listas usan `cubierto_hasta` (retención, vencen hoy, panel de inicio, pendientes, para hacer hoy, filtros de socios) y bajan de 300 ms con 5.000 socios. Pantallas medidas con la app compilada. El ingreso medido en producción contra el demo, en menos de 1 s | `VELOCIDAD.md` | ❌ |
| F1.7 | **BASE-8**: tope en "Olvidé mi contraseña" y en los formularios públicos, anti-robot de "Quiero ser socio" (D49), prueba de permisos por rol contra `PERMISOS.md`, Ley 25.326 (D52), ninguna contraseña demo débil en producción | `PROGRESO.md` BASE-8 | ❌ |
| F1.8 | **BASE-9**: el botón dice "Quiero ser socio", Lighthouse local en celular ≥ 90, validador de datos estructurados sin errores | `PROGRESO.md` BASE-9 | ❌ |
| F1.9 | Los **24 recorridos e2e viejos** sin verde: cada uno arreglado (la pantalla o la prueba) | `DIAGNOSTICO-BASE0.md` | ❌ |

## Fase 2 · Super admin

| # | Qué | Detalle | Estado |
|---|---|---|---|
| F2.1 | SA-3 Ficha del gimnasio (todo de un local) | `SUPER-ADMIN.md` | 🟡 carril/b-super: ficha con datos, ciudad, links y QR, equipo, módulos, integraciones, lanzamiento, errores, registro y ciclo de vida; reprocesar webhook a pedido, papelera y clonar hechos; botones "abrir como soporte en esta pantalla" hechos |
| F2.2 | SA-4 Entrar como soporte con rol, motivo, 60 min y aviso al dueño; "ver la app como este socio" | `SUPER-ADMIN.md` | 🟡 carril/b-super: rol, motivo, aviso en la campana; restricción de plata del soporte y "ver como este socio" hechos (migración 020800) |
| F2.3 | SA-5 Buscar a cualquiera en todos los gimnasios | `SUPER-ADMIN.md` | 🟡 carril/b-super: hecho y probado en la base y con vitest; falta el e2e con sesión real (lo corre el principal) |
| F2.4 | SA-2 Lista de gimnasios con filtros | `SUPER-ADMIN.md` | 🟡 carril/b-super: hecho y probado en la base y con vitest; falta el e2e con sesión real (lo corre el principal) |
| F2.5 | SA-1 Tablero con "necesitan atención" | `SUPER-ADMIN.md` | 🟡 carril/b-super: tablero con errores; medido con 200 gimnasios: tablero 429 ms y lista 758 ms (prueba de base) |
| F2.6 | SA-6 Alta, lista de lanzamiento, pausa, baja y papelera | `SUPER-ADMIN.md` | 🟡 carril/b-super: lanzamiento, pausa, baja, restaurar, papelera, clonar y borrado definitivo (anonimizar); falta la pantalla de "pausado" y los botones "abrir como soporte en esta pantalla" |
| F2.7 | SA-11 Datos personales (Ley 25.326) | `SUPER-ADMIN.md` | 🟡 carril/b-super: exportar y borrar a un socio, exportar el gimnasio; falta estado de copias |
| F2.8 | SA-10 Segundo factor, roles de BRIK y registro | `SUPER-ADMIN.md` | 🟡 carril/b-super: 2FA exigible, roles y registro; roles solo en lo nuevo, faltan aviso de equipo nuevo y cerrar sesiones |
| F2.9 | SA-7, SA-8, SA-9 y SA-12 | `SUPER-ADMIN.md` | 🟡 carril/b-super: demo, errores, novedades por destino, mantenimiento (falta la franja en los paneles), prueba, descuento, recordatorio, estado, uso y funciones a prueba |

## Fase 3 · Fluidez: la pasada botón por botón

| # | Qué | Detalle | Estado |
|---|---|---|---|
| F3.1 | `scripts/e2e/botones.mjs`: los 6 roles en compu y celular, cada botón | `FLUIDEZ.md` | ❌ |
| F3.2 | `FLUIDEZ-PANTALLAS.md`: cada pantalla contra las 21 reglas, arreglada; y todos los textos revisados con la regla de `DISENO.md` § Textos | `FLUIDEZ.md` | ❌ |

## Fase 4 · Los 70 detalles

| # | Qué | Detalle | Estado |
|---|---|---|---|
| F4.1 | Cada fila de `DETALLES-70.md` en ✅ con la prueba que la cubre (columna Prueba llena), o hecha si es 🟡 o ❌. Primero se actualiza lo que quedó viejo: #16 (SEG-5), #38 (SOC-1), #39, #40, #42 y #46 (BASE-2) | `DETALLES-70.md` | ❌ |

## Fase 5 · Lo que faltaba de todo lo que pidió Mateo

Revisado el 09/11 contra todos los pedidos (`docs/v2/`, `PEDIDO-ORIGINAL.md`,
el mensaje de arranque). Lo que no estaba en ninguna lista está en
`FALTANTES.md`, y se hace en ese orden. FA-1 a FA-6 van antes, en la fase 1
(dentro del ítem que dice cada una).

| # | Qué | Detalle | Estado |
|---|---|---|---|
| F5.1 | Cada ítem de `FALTANTES.md` | `FALTANTES.md` | ❌ |

## Fase 6 · Lo chico de antes

| # | Qué | Detalle | Estado |
|---|---|---|---|
| F6.1 | Los grupos 2 a 9 de `docs/v2/DETALLES.md` (VD-*) que no quedaron hechos en las fases anteriores | `docs/v2/DETALLES.md` | ❌ |

## Fase 7 · Propuestas (P2)

| # | Qué | Detalle | Estado |
|---|---|---|---|
| F7.1 | TV de entradas, pase de invitado, ocupación en vivo para el socio, congelar solo, modo "tengo que cobrar" el día 1, tablet kiosco pulida | `PROGRESO.md` P2 | ❌ |

## Fase 9 · Edición en capas, escala y seguridad (`AJUSTES-0911-NOCHE.md`)

| # | Qué | Estado |
|---|---|---|
| F9.1 | EDIT-S07: plantillas globales (landing, textos, mensajes): valor de la plataforma → plantilla del tipo → valor del gimnasio, con "Restaurar por defecto"; al cambiar la plantilla se actualizan los gimnasios que no la editaron | 🟡 carril/b-super: plantillas de texto (landing) con herencia plataforma → tipo → gimnasio, restaurar y propagación; probado en la base; falta el e2e (Actions) |
| F9.2 | EDIT-D01 a D06: Configuración del dueño por secciones con buscador; Equipo (crear, permisos, desactivar, resetear); Web y estilo con vista previa en vivo; aviso de guardado, deshacer, historial y restaurar en cada cambio; estado de su dominio; exportar sus datos | ❌ |
| F9.3 | WEB-06: términos y privacidad por gimnasio desde una plantilla editable (con FA-19) | ❌ |
| F9.4 | ESC-01, 02 y 03: pool de conexiones de Supabase en las funciones; las páginas públicas en caché y sin auth en el proxy; EXPLAIN de lo que se usa seguido, RLS con `(select auth.uid())` y los asesores de Supabase sin errores | 🟡 carril/b-super: RLS con select auth.uid(), índices, aviso de pooler y región, ver `ESCALA.md`; ⛔ asesores de Supabase y pedido del proxy (en PREGUNTAS.md) |
| F9.5 | ESC-04: carga de 1.000 gimnasios demo y 500 usuarios simultáneos, **en local o en Actions, nunca contra producción**; resultados anotados y lo que falle, arreglado | 🟡 carril/b-super: `scripts/medir/carga.mjs` y workflow `carga.yml`; sin resultados todavía (se corre en Actions) |
| F9.6 | ESC-05, 06 y 08: tablas que crecen (ingresos, registro) listas para partirse por mes y listas siempre paginadas; monitoreo propio (errores, chequeo de que responde, alertas; Sentry ⛔); límites por plan en datos | 🟡 carril/b-super: registro paginado, tamaño de tablas, `/api/salud`, alertas y límites por plan; Sentry ⛔ |
| F9.7 | ESC-07: procedimiento para restaurar una copia de seguridad (⛔ hasta Supabase Pro, D51) | ❌ |
| F9.8 | SEG-01 a 07 que no hayan quedado cubiertos por U3, BASE-8 y SA-10/11 | 🟡 carril/b-super: guardas SEG-02/07 en vitest; restricción de plata del soporte y ver como socio hechos |

## Fase 8 · El cierre

| # | Qué | Estado |
|---|---|---|
| F8.1 | `scripts/e2e/base-simulacion.mjs` entera con el tope de 1 s, medida en Actions con 5.000 socios y la app compilada | ❌ |
| F8.2 | La cadena e2e completa y el barrido en verde, en tandas, con la base nueva | ❌ |
| F8.3 | Prueba de humo en producción: `/super`, `/dueno`, `/recepcion`, `/profe`, `/socio` y la página del demo, en compu y celular, con capturas | ❌ |
| F8.4 | Preparar `PRUEBA-DUENO.md`: el "Gimnasio Prueba Mateo" `[demo]` en producción, con marca, planes, 30 socios en todos los estados, clases y equipo; links y usuarios escritos; contraseñas en `ACCESOS.md` | ❌ |
| F8.5 | Arriba de `PROGRESO.md`: **"LISTO PARA TU PASADA"**, con qué se hizo, qué quedó ⛔ y por qué, y lo que tiene que hacer Mateo (planes pagos, mail propio, MercadoPago, dominio). Entrada final en `docs/LOG.md` | ❌ |
