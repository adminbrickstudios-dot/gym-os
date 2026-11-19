# Ajustes del 09/11 a la noche (pedido de Mateo)

Abajo está el pedido de Mateo del 09/11 a la noche, **textual**. Primero, cómo
quedó cruzado con lo que ya existe, y lo que se cambió del pedido para que no
choque con el proyecto.

## Cómo se integró (no se crea una estructura nueva de documentos)

El pedido proponía crear `MAESTRO.md`, `DECISIONES.md`, `PLATAFORMA.md` y
`CALIDAD.md`, y reescribir el resto. **No se hace.** El 09/11 ya se habían
ordenado los documentos (`docs/base/`). Una segunda estructura en paralelo
haría que el loop siga dos listas y se pise, como pasó con el prompt de Rack.
Cada parte del pedido queda en el documento que ya existe:

| Pedido | Dónde vive |
|---|---|
| MAESTRO.md (índice y orden) | `docs/base/00-LEEME.md` (índice) y `docs/base/RECTA-FINAL.md` (orden) |
| PROGRESO.md con "DÓNDE QUEDÉ" | Arriba de `docs/base/PROGRESO.md` (el agente lo mantiene) |
| DECISIONES.md con "NECESITO DE MATEO" | `docs/base/PREGUNTAS.md` (decisiones) y arriba de `PROGRESO.md` (lo que necesita de Mateo) |
| PLATAFORMA.md | Se crea: `docs/base/PLATAFORMA.md` (PLAT-01 a 08) |
| CALIDAD.md | `docs/base/FLUIDEZ.md` (las 19 reglas; CAL-01 a 08 se suman ahí) |
| DISEÑO.md | `docs/base/DISENO.md` |
| SEGURIDAD.md | `docs/base/PERMISOS.md` y BASE-8 / U3 |
| LECCIONES.md | `docs/LECCIONES.md` |
| PENSAR.md | Se crea: `docs/base/PENSAR.md` (la sección 0, antes de cada bloque) |

## Qué se corrigió del pedido

- **`negocio_id` → `gimnasio_id`** (D46).
- **`/loop 5m` → `/loop` sin intervalo.** Con 5 minutos el mismo prompt se
  vuelve a disparar cada 5 minutos aunque el agente esté a mitad de algo. Sin
  intervalo, el agente sigue a su ritmo.
- **"Si se llena el contexto, hacé /clear":** el agente no puede hacerse
  `/clear` solo. Lo que sirve: "DÓNDE QUEDÉ" siempre al día, para que al
  pegarle de nuevo el prompt siga exacto.
- **URG-02 a)** ya está bien en el código: `darAcceso` crea con
  `email_confirm: true`. La causa más probable es otra. El alta de producción
  fallaba con "Invalid API key" (falta o está mal `SUPABASE_SERVICE_ROLE_KEY`
  en Vercel), así que **la cuenta del dueño nunca se creó**, y el ingreso dice
  "mail o contraseña incorrectos". Además, `/g/<slug>/ingresar` redirige a
  `/ingresar` a propósito (deja el gimnasio en una cookie). Eso no es el error,
  pero la pantalla tiene que seguir mostrando la marca del gimnasio. Igual se
  revisan las 7 causas, con SQL y registros.
- **ESC-04 (carga de 1.000 gimnasios y 500 usuarios):** se corre contra la base
  local y Actions, **nunca contra producción**. Supabase Free no lo aguanta y
  ensuciaría la base real.
- **ESC-07 (restaurar una copia de seguridad):** necesita Supabase Pro (D51).
  ⛔ hasta que Mateo lo contrate. Se deja escrito el procedimiento.
- **PLAT-05 (dominios por la API de Vercel):** necesita un token de Vercel
  (`VERCEL_TOKEN`) que carga Mateo en Vercel. Sin él, ⛔ con los pasos.
- **PLAT-01 cambia la estructura de direcciones**: los paneles van en
  `app.<dominio>`, la web de cada gimnasio en `<slug>.<dominio>` y la página de
  venta en la raíz. Las puertas por rol (`/dueno`, `/recepcion`, `/profe`,
  `/socio`, `/super`, D41) siguen y llevan al login universal con la marca del
  gimnasio.
- **CAL-07 (prueba de humo en producción con crear socio, ingreso y cobro):**
  se hace solo en el gimnasio demo `[demo]` de producción, nunca en uno real.

## Dónde quedó cada ID en `RECTA-FINAL.md`

| IDs | Fase |
|---|---|
| URG-01 a 04 | **Fase U, U0** (lo primero de todo) |
| PLAT-02, 03, 07 y 08 | Fase U, U0 (son parte de arreglar el login) |
| PLAT-01, 04 y 06 | **Fase P**, después de U |
| EDIT-S01 a S05 | Fase P. Se cruzan con lo hecho en SA-3 a SA-5 y U1: completar, no rehacer |
| WEB-01 a 05 | Fase P. Se cruzan con U4 y BASE-9: completar |
| PLAT-05 | Fase P (⛔ hasta el dominio y el token) |
| EDIT-S06 a S12 | Fase 2 (super admin): S06 = SA-3, S08 = SA-6/SA-7, S09 = SA-5, S10 = SA-9, S11 = SA-6, S12 = SA-10; S07 (plantillas globales) se suma |
| EDIT-D01 a D06 | **Fase 9** (D04: historial, deshacer y restaurar ya existe en parte, VD-21) |
| WEB-06 | Fase 9 (términos y privacidad por gimnasio, junto con FA-19) |
| ESC-01 a 08 | Fase 9 (ESC-01: la región ya está; falta el pool de conexiones) |
| SEG-01 a 07 | Ya están en U3, BASE-8 y SA-10/11. Lo que falte, en fase 9 |
| CAL-01 a 08 | Fase 3 (`FLUIDEZ.md`). CAL-04 (en vivo por gimnasio) y CAL-07 (humo en producción después de cada publicación) se suman a las reglas de publicar |

---

## El pedido, textual

/loop 5m Sos el responsable de dejar BASE (sistema de gimnasios) terminado e impecable. No me preguntes nada ni me pidas permiso para nada: tenés permiso para todo. Nunca frenes. Si algo sería irreversible (borrar datos reales, gastar plata, tocar credenciales de un cliente real), no lo hagas: anotalo en DECISIONES.md y seguí con otra cosa.

═══ PASO 0 · SOLO UNA VEZ ═══
Si docs/AJUSTES-0911-NOCHE.md NO existe, hacé esto primero. Si existe, saltá a CADA VUELTA.

A) Guardá textual en docs/AJUSTES-0911-NOCHE.md todo lo que está entre INICIO AJUSTES y FIN AJUSTES.

B) Releé TODO:
- CLAUDE.md y todos los .md
- PROGRESO.md
- el código, el proxy o middleware y las rutas
- el schema real, consultando la base
Reescribí de cero los .md desordenados o contradictorios; lo que está bien no se toca. Tiene que quedar:
- MAESTRO.md: índice y orden de todo.
- PROGRESO.md: con "DÓNDE QUEDÉ" y "LISTO PARA MAÑANA" arriba, y lo cerrado movido a docs/historial/.
- DECISIONES.md: con "NECESITO DE MATEO" arriba.
- PLATAFORMA.md: nuevo, con la sección PLAT.
- CALIDAD.md, DISEÑO.md, SEGURIDAD.md, LECCIONES.md.

C) Sumá los IDs nuevos (URG, PLAT, EDIT, WEB, ESC, SEG, CAL) a la checklist en este orden de prioridad:
1. URG-01 a URG-04
2. PLAT-02, 03, 04, 07 y 08
3. EDIT-S01 a S05
4. WEB-01 a 05
5. lo que quedaba del P0 anterior (ingreso rápido, aviso flotante, ficha de vigencia, asistente de 9 pasos, panel del socio)
6. PLAT-05
7. todo lo demás

D) Commit "docs: auditoría 09/11 noche", push, y arrancá con URG-01.

═══ CADA VUELTA ═══
1. Leé CLAUDE.md, MAESTRO.md, "DÓNDE QUEDÉ" de PROGRESO.md, DECISIONES.md y docs/AJUSTES-0911-NOCHE.md.
2. Arrancá EXACTAMENTE desde "DÓNDE QUEDÉ". Si no hay nada a medias, tomá el primer ID ❌ o 🟡 de mayor prioridad que no esté ⛔.
3. Antes de construir, hacé la sección 0 (CÓMO PENSAR).
4. Hacelo completo:
   - base, lógica, pantalla
   - probar ejecutando: build, SQL, Playwright a 1280 y 390 px, y las 5 formas de romperse
   - commit, push, publicar
   - PRUEBA DE HUMO EN PRODUCCIÓN (CAL-07)
   - anotar en PROGRESO.md la prueba y su salida, y actualizar "DÓNDE QUEDÉ"
5. Nada se marca ✅ sin pasar CALIDAD.md y sin el comando y su salida.

REGLAS:
- Encadená un ID tras otro mientras tengas contexto. Si se llena: actualizá "DÓNDE QUEDÉ", hacé /clear y seguí.
- Dudas: anotalas en DECISIONES.md con tu recomendación y seguí con ella.
- Si algo depende de algo externo (dominio, Mercado Pago, mails, Sentry): construilo en modo prueba, marcalo ⛔ y seguí.
- Si un ID falla dos veces: anotá el error real, dejalo 🟡 y seguí.
- Reglas fijas de siempre:
  - schema antes que código
  - nombres en español
  - RLS en todo
  - todo filtrado por negocio_id
  - cero hardcodeo
  - módulos apagables por negocio
  - WhatsApp solo con links wa.me
  - registro cerrado
  - verificar filas afectadas
- Al terminar URG, PLAT núcleo, EDIT-S01 a S05 y WEB-01 a 05, escribí arriba de PROGRESO.md "LISTO PARA MAÑANA" con:
  - cómo crear un gimnasio desde el superadmin
  - los links de cada puerta
  - la salida de la prueba de humo en producción
  - los pasos exactos para el dominio
- No declares terminado mientras quede un ❌ o 🟡 sin bloqueo. Al final corré la simulación completa y escribí RESUMEN.md.

INICIO AJUSTES

## 0. CÓMO PENSAR (obligatorio antes de cada bloque)
Escribí en docs/PENSAR.md, máximo 15 líneas por bloque:
1. Qué pidió Mateo y qué QUISO decir. No es técnico: leé la intención, no la letra.
2. Cómo lo resuelve un producto profesional: Vercel Platforms (github.com/vercel/platforms), Cal.com, Shopify, Mindbody, Glofox. Buscá en internet y en GitHub cuando haga falta.
3. Abogado del diablo, 5 formas en que esto se rompe. Elegí entre:
   - otro dominio o subdominio
   - otro rol
   - celular
   - internet lento
   - datos vacíos
   - 1.000 negocios
   - doble clic
   - sesión vencida
   - mail con mayúsculas o espacios
   - vista previa contra producción
   - variables de entorno distintas
4. Lo que Mateo no pidió pero necesita.
5. Decisión y cómo la vas a probar.
Después de construir, probá esas 5 formas. Si una falla, no está terminado.

## URG · Login roto: arreglarlo antes que nada
Síntoma: entro por /template-gym/ingresar, pongo el mail y la contraseña que creé para ese gimnasio, me manda a /ingresar (sin el gimnasio) y dice que el mail o la contraseña son incorrectos.

- URG-01 Reproducilo EN PRODUCCIÓN, no solo en local:
  1. Desde el superadmin, creá un gimnasio de prueba con su dueño.
  2. Cerrá la sesión.
  3. Entrá por /<slug>/ingresar y por /ingresar.
  Anotá a qué URL redirige, el código de error REAL que devuelve Supabase y qué filas existen (auth.users, la membresía, el negocio).
- URG-02 Revisá en este orden, con SQL y registros, y anotá cuál era:
  a) Usuario creado con admin.createUser SIN email_confirm: true. Supabase devuelve "email not confirmed" y la pantalla lo muestra como "incorrecto". Arreglá la creación y confirmá los usuarios ya creados por el superadmin.
  b) El usuario existe pero falta su fila usuario ↔ gimnasio ↔ rol, o apunta a otro gimnasio.
  c) El redirect pierde el slug y el sistema resuelve el gimnasio por la ruta. Sin slug cae a uno por defecto o al demo. Es la LECCIÓN de yadeportes: el login rebotaba porque el respaldo caía al club demo.
  d) El usuario fue creado en otro proyecto de Supabase (variables de vista previa contra producción).
  e) Mail con mayúsculas o espacios, o una contraseña que no se guardó (formulario que falla en silencio sin verificar filas afectadas).
  f) El límite de intentos o el anti-bots bloquea y se muestra como "incorrecto".
  g) La cookie de sesión no viaja después del redirect (otro host o ruta).
  Anotá la causa real en LECCIONES.md, con la prueba.
- URG-03 Login universal (PLAT-02) y mensajes de error honestos (PLAT-08).
- URG-04 Prueba automática permanente: el superadmin crea un gimnasio con su dueño → se entra por las tres puertas → se aterriza en el panel correcto con el rol correcto. Corre contra PRODUCCIÓN después de cada publicación.

## PLAT · Estructura de plataforma (pensada para miles de gimnasios)
- PLAT-01 Mapa de dominios en PLATAFORMA.md:
  - Dominio de la plataforma (a definir) → página de venta de Base.
  - app.<plataforma> → login universal y todos los paneles (superadmin, dueño, recepción, profe).
  - <slug>.<plataforma> → web pública del gimnasio y login de socios. Mientras no haya dominio, /<slug> sigue funcionando y después redirige al subdominio.
  - Dominio propio del gimnasio → la misma web pública, mapeada en una tabla de dominios.
- PLAT-02 Login universal del equipo: una sola pantalla (app.<plataforma>/ingresar y, mientras tanto, /ingresar). Al entrar se buscan sus membresías:
  - 0 → "Tu usuario no tiene un gimnasio asignado. Escribinos." (wa.me de BRIK)
  - 1 → directo a su panel según su rol
  - varias → elige el gimnasio
  /<slug>/ingresar y dominio-propio/ingresar muestran el logo del gimnasio y usan el MISMO login. Si el usuario no es de ese gimnasio, mensaje claro. El socio entra desde la web de su gimnasio.
- PLAT-03 El proxy resuelve el gimnasio en este orden: dominio propio → subdominio → /slug → si no hay ninguno, 404 de plataforma.
  - NUNCA caer a un gimnasio por defecto ni al demo.
  - Resolución cacheada, sin consultar la base en cada pedido, e invalidada al cambiar dominios.
- PLAT-04 Cero rutas escritas a mano: toda URL se arma con un helper (urlNegocio, urlPanel). Reemplazá cada "/ingresar", "/panel", host o slug escrito a mano. Sumá un test que falle si aparece uno nuevo.
- PLAT-05 Dominios desde el superadmin:
  1. Se carga el dominio y se agrega a Vercel por API.
  2. Se muestran los registros DNS exactos a cargar.
  3. Se verifica, con estado en semáforo (pendiente, verificado, error).
  4. SSL automático.
  ⛔ hasta que Mateo compre el dominio. Todo listo para que sea cargarlo y esperar.
- PLAT-06 Variables de entorno: dominio de plataforma, URLs y claves por entorno, ninguna en el código. Checklist que confirme que producción y vista previa apuntan al Supabase correcto.
- PLAT-07 Gimnasio demo marcado es_demo, aislado y jamás usado como respaldo.
- PLAT-08 Errores de login:
  - al usuario, un mensaje humano según el caso: credenciales, sin confirmar, sin gimnasio, desactivado, demasiados intentos
  - en el registro del servidor, el código real

## EDIT · Todo editable, en capas
Principio: configuración en capas. Valor de plataforma → plantilla del tipo de gimnasio → valor del gimnasio. Todo tiene "Restaurar por defecto".

SUPERADMIN
- EDIT-S01 Crear un gimnasio en 1 minuto desde una plantilla:
  - nombre, slug (validado, único, sin tildes), tipo y plan
  - crea el dueño con mail y contraseña YA confirmado, con su membresía
  - la landing base queda publicada
  Verificá las filas creadas y corré "Probar acceso" automáticamente al terminar.
- EDIT-S02 Tarjeta "Accesos", lista para mandar por wa.me: link del panel, mail, contraseña (visible solo al crearla) y link de la web.
- EDIT-S03 "Probar acceso" por usuario: checklist verde o rojo (existe, confirmado, activo, membresía, rol, último ingreso), con botón "Arreglar".
- EDIT-S04 Resetear contraseña, desactivar o activar, cambiar rol y mover de gimnasio.
- EDIT-S05 "Entrar como" auditado, con una barra visible "Estás viendo como <gimnasio>" y un botón para salir.
- EDIT-S06 Módulos y pantallas encendidos o apagados por gimnasio, más su plantilla y su modo.
- EDIT-S07 Plantillas globales (landing, textos, mensajes): al cambiarlas se actualizan los gimnasios que no las editaron.
- EDIT-S08 Estado de cada gimnasio (prueba, activo, suspendido), su suscripción mensual y suspender sin borrar.
- EDIT-S09 Buscador global de gimnasios, usuarios y socios, y auditoría de toda la plataforma.
- EDIT-S10 Salud: errores recientes por gimnasio, tiempos de respuesta y última publicación.
- EDIT-S11 Duplicar un gimnasio, pasarlo de prueba a real y exportar sus datos.
- EDIT-S12 Verificación en dos pasos para el superadmin.

DUEÑO
- EDIT-D01 Configuración por secciones, con buscador: Gimnasio · Web y estilo · Planes y precios · Cobros · Accesos · Clases · Equipo y permisos · Mensajes · Funciones · Dominio.
- EDIT-D02 Equipo:
  - crear recepcionistas, profes y otros usuarios con mail
  - permisos editables
  - desactivar y resetear contraseñas
- EDIT-D03 Web y estilo: editor con vista previa en vivo (logo, colores, tipografía, fotos, textos, secciones encendidas o apagadas y su orden).
- EDIT-D04 Cada cambio: aviso de guardado, deshacer, historial y restaurar por defecto.
- EDIT-D05 Ver el estado de su dominio.
- EDIT-D06 Exportar sus datos.

## WEB · Landing base de gimnasio, tremenda
- WEB-01 La plantilla base se ve profesional con CERO configuración: con solo el nombre y un color ya es una web lista. Sin fotos, portada tipográfica fuerte; nunca un hueco.
- WEB-02 Bloques configurables por datos:
  - portada
  - planes y precios
  - clases de la semana
  - horarios
  - galería
  - profes
  - ubicación y mapa
  - preguntas frecuentes
  - contacto por wa.me
  - "Soy socio" y "Quiero ser socio"
- WEB-03 Estilo de gimnasio: tipografía condensada fuerte, números grandes, el acento del gimnasio y fondo claro. Reglas anti-IA de DISEÑO.md: sin degradados violetas, sin emojis, sin tarjetas clonadas, sin frases vacías, sin datos inventados.
- WEB-04 Celular primero. Menos de 2,5 s en 4G, imágenes optimizadas, cache por gimnasio que se actualiza al editar (revalidateTag).
- WEB-05 Google:
  - título y descripción
  - imagen para compartir generada
  - sitemap y robots por gimnasio
  - datos estructurados (ExerciseGym)
  - favicon con el logo
  - 404 con el estilo del gimnasio
- WEB-06 Términos y privacidad por gimnasio, desde una plantilla editable.

## ESC · Escala a miles
- ESC-01 La región de Vercel tiene que ser la misma que la de Supabase. Usar el pool de conexiones de Supabase para las funciones.
- ESC-02 Las páginas públicas se sirven cacheadas. El proxy no consulta la autenticación en páginas públicas.
- ESC-03 Revisar con EXPLAIN todas las consultas que se usan seguido. RLS con el patrón (select auth.uid()) y asesores de Supabase sin errores.
- ESC-04 Prueba de carga: 1.000 gimnasios demo y 500 usuarios simultáneos. Anotar los resultados y arreglar lo que falle.
- ESC-05 Las tablas que crecen sin fin (ingresos, auditoría) quedan preparadas para partirse por mes, y las listas siempre paginadas.
- ESC-06 Monitoreo: errores (Sentry ⛔; mientras tanto, un registro propio), chequeo de que el sitio responde, y alertas.
- ESC-07 Copias de seguridad probadas de verdad: restaurar una en un proyecto de prueba.
- ESC-08 Límites por plan (socios, usuarios) guardados en datos.

## SEG · Seguridad
- SEG-01 Test automático de RLS con cada rol y entre gimnasios: intenta leer datos de otro gimnasio y TIENE que fallar.
- SEG-02 La clave service_role solo en el servidor. Buscar en el código claves expuestas.
- SEG-03 Cabeceras de seguridad (CSP, HSTS, anti-iframe) y cookies seguras.
- SEG-04 Límite de intentos y anti-bots en el login, el alta y los formularios públicos.
- SEG-05 Auditoría de las acciones sensibles.
- SEG-06 DNI y datos personales: los mínimos, con exportar y borrar a pedido (Ley 25.326).
- SEG-07 Ninguna contraseña demo en producción.

## CAL · Calidad y fluidez (si no existe CALIDAD.md, crearlo con esto)
- CAL-01 Siempre se puede volver:
  - Volver y la X en cada ventana
  - el atrás del celular funciona
  - errores, 404 y sesión vencida tienen salida
- CAL-02 Nada se traba:
  - "Guardando…" y bloqueo del doble toque
  - nada carga más de 10 s sin avisar
  - cada error con "Reintentar"
- CAL-03 Nada queda quieto: cada toque responde en menos de 100 ms y cada acción termina con un aviso concreto.
- CAL-04 Todo sincronizado entre paneles en vivo (Supabase Realtime filtrado por gimnasio).
- CAL-05 Un robot entra con cada rol, toca todos los botones y falla si un toque no cambia nada visible.
- CAL-06 Prueba con internet y celular lentos simulados.
- CAL-07 PRUEBA DE HUMO EN PRODUCCIÓN después de cada publicación: login por las tres puertas, crear socio, registrar ingreso y cobrar.
- CAL-08 Cero errores en la consola, en todas las pantallas.

FIN AJUSTES