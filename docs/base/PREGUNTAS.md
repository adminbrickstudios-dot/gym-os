# Preguntas para Mateo

El agente no frena por una pregunta: aplica la opción recomendada, la marca
**decidido por defecto** y sigue. Mateo contesta cuando puede; si elige otra
opción, se cambia en la vuelta siguiente.

Formato de cada pregunta nueva:

```
## P-<n> · <tema> (<fecha>)
<la pregunta, en una línea>
- A) … (recomendada: por qué)
- B) …
Decidido por defecto: A. Dónde se nota: <pantalla o ítem>.
Respuesta de Mateo: (vacío)
```

---

## Contestadas por Mateo (07/11)

| # | Pregunta | Respuesta |
|---|---|---|
| D36 | ¿Guardar la vigencia en el socio? | Guardar `cubierto_hasta` por trigger; el color se calcula comparando con hoy. |
| D37 | ¿Fondo claro u oscuro? | Claro por defecto, oscuro elegible. |
| D38 | ¿Emojis? | Íconos de línea propios. |
| D39 | ¿Se llama Base? | Sí. |

## Decididas por defecto (07/11, al armar `docs/base/`)

| # | Pregunta | Por defecto | Por qué |
|---|---|---|---|
| D40 | El pedido pide aviso en la esquina + panel lateral; hoy está la ventana grande del veredicto (VD-1). | Aviso + panel en la recepción; la ventana grande queda como opción en Configuración. | Con 10 personas en la fila, un aviso que no tapa deja seguir tipeando; la ventana grande sirve para una tablet en la puerta. |
| D41 | ¿Pantallas nuevas en `/dueno`, `/recepcion`…? | Puertas fijas que llevan a lo que ya existe. | Duplicar pantallas duplica errores. |
| D42 | ¿Quién pone la contraseña del dueño y del equipo? | Quien crea la cuenta elige: la escribe o manda un link. | Mañana Mateo necesita darle la clave al dueño en el momento; el link sirve cuando haya SMTP. |
| D43 | ¿Cómo se entra? | Mail y contraseña adelante; Google y código abajo si están configurados. | Es lo que todos entienden y no depende de cuentas externas. |
| D44 | ¿Asistente nuevo o el de Primeros pasos? | El de Primeros pasos, con los 9 pasos del pedido. | Ya calcula qué está hecho (VD-43). |
| D45 | ¿Con cuántos datos se mide? | 5.000 socios, 100.000 ingresos. | Lo pide el pedido; hoy se midió con 3.000. |
| D46 | ¿`negocio_id` o `gimnasio_id`? | `gimnasio_id`. | Renombrar 215 migraciones no suma nada. |
| D47 | ¿Y si no se puede leer el repo de Sillón? | Se sigue la barra de yadeportes. | No frena nada. |
| D48 | ¿Dónde quedan los accesos? | `ACCESOS.md` local, en `.gitignore`. | El repo es público. |
| D49 | ¿Anti-robot sin cuenta externa? | Turnstile si está la variable, más campo trampa y tope por IP siempre. | Anda desde mañana sin configurar nada. |
| D50 | ¿Sonido? | Prendido, distinto para el rojo, se apaga desde la recepción. | En el mostrador no siempre se mira la pantalla. |
| D51 | ¿Planes pagos? | El agente escribe qué hace falta; no contrata. | Gastar plata es de Mateo. |
| D52 | ¿Ley 25.326? | Política, consentimiento y pedido de datos del socio; la inscripción en la AAIP la hace el gimnasio. | Es obligación del responsable de la base, que es el gimnasio. |

## Decididas por defecto en la revisión del 09/11

| # | Pregunta | Por defecto | Por qué |
|---|---|---|---|
| D53 | El segundo factor estaba pedido en cuatro lugares (VD-33D, VD-42B, VD-42C, SA-10) | Uno solo: SA-10. Obligatorio para el super admin; para el dueño, recomendado y que él lo prenda. | Un dueño que pierde el celular no puede quedar afuera de su gimnasio el primer día. |
| D54 | VD-40B repetía el super admin nuevo | Pasa a los SA-* de `SUPER-ADMIN.md`. | Una sola lista. |
| D55 | La demo que "se borra sola a los 7 días" chocaba con "nada depende de un cron" y con ADM-5 | La demo es un gimnasio `[demo]` aparte. A los 7 días queda vencida (se calcula) y se borra entera con un botón. | Borrar un gimnasio sin datos reales no rompe ninguna regla, y destraba ADM-5. |
| D56 | Los avisos de abajo a la derecha tapaban el botón de Entrada | Se apilan arriba del botón, o a la izquierda de la barra fija. | Nada tapa nada. |
| D57 | ¿El socio sube su foto desde la app? | Solo si el gimnasio lo prende (apagado por defecto). La recepción ve "foto nueva" hasta confirmarla. | Es la foto con la que lo reconocen en la puerta (anti-préstamo). |
| D58 | ¿Qué es lo principal del Inicio? | Recepción: el mostrador (búsqueda, números, lista en vivo). Dueño: números y Para hacer hoy. | Cada uno hace otra cosa en su primer minuto. |
| D59 | Reseñas en la página y "+N socios" contra "nada inventado" | Reseñas solo con nombre, fecha y link a la reseña de Google; sin link no se muestran. "+N socios" sale de la base y solo aparece con 20 o más. | Así nada de la página puede ser inventado. |
| D60 | Términos BRIK–gimnasio y contrato de encargado del tratamiento | El agente escribe un borrador, marcado "revisar con un abogado"; el dueño lo acepta al entrar y queda la fecha y la versión. | Sin texto no hay qué aceptar; la revisión legal es de Mateo. |

---

## Abiertas

### BASE-0 · vd-7 y vd-8 (averiguados el 08/11, base nueva y app compilada con Next 16.4.5)

- **vd-8 (PIN equivocado): no era un fallo de permisos.** El PIN equivocado no deja pasar y sí avisa
  ("PIN equivocado: te quedan N intentos"). La prueba miraba el primer `role="alert"` de la página, que es el
  anunciador de rutas de Next (vacío). Se corrigió la prueba: pasa 15 de 15. **Nada que decidir.**
- **vd-7 (simulación vs. hoja Cobrar): no hay diferencia de plata.** La simulación mostraba "Paga la cuota entera" porque
  la prueba la corría ANTES de pasar los planes a la regla del gimnasio, y `simular_cuota` usa la regla de ese plan
  (que era "continua"): correcto. Además la prueba pedía fechas de dos dígitos ("8/11"). Se reordenó la prueba y se acepta
  una cifra. **Nada que decidir**; la cuenta de la base no se tocó.
- Decidido por defecto: lo que dice la hoja Cobrar y lo que dice la simulación vienen de la misma regla; no se cambió ninguna función.
- vd-41: la sección Gastos, apagada para el encargado sin permiso, decía "sección apagada por el gimnasio". Ahora dice
  "No tenés permiso para ver los gastos" (solo cambia el texto, quién ve qué no cambió).

- (09/11, decidido por defecto) **Medición en producción sin usuarios demo:** se escribió igual el script y el workflow, y se mide desde afuera lo público; las pantallas con sesión quedan ⛔ hasta que Mateo cargue los tres secretos. Recomendada: cargarlos y correr `usuarios-demo`.
- (09/11, decidido por defecto) **F0.2:** primero se paralelizaron los viajes (ganancia inmediata, sin migración); `contexto_pantalla` en una sola función queda para después de medir.
### Carril B · Super admin (09/11, ayudante 1)

- **SA-4 plata como soporte: NO está aplicada.** Pide que, entrando como soporte, cobrar/anular/tocar la caja no se
  permita salvo "lo pidió el dueño" en el motivo. Eso cambia quién puede cobrar en `vender`, `anular_*` y la caja
  (permisos y plata), así que no lo toqué. Hoy el soporte entra con el rol elegido (dueño, recepción o profe) y puede
  lo que ese rol. Recomendado: una sola función `privado.exigir_equipo` que mire `soportes_gimnasio` y rechace
  esas acciones si el motivo no dice "lo pidió el dueño". Lo hace el principal.
- **SA-5 buscar a cualquiera:** devuelve nombre, gimnasio y rol (nunca DNI, mail ni teléfono), pide motivo y deja
  registro en `registro_brik` con lo buscado y cuántos encontró, no con el resultado. Busca socios por mail exacto,
  DNI exacto o teléfono (últimos dígitos) y al equipo por mail exacto. Decidido: coincidencia exacta, para que nadie
  explore la base de a letras.
- **Registro de BRIK (`registro_brik`):** tabla nueva sin `gimnasio_id` obligatorio (la búsqueda no tiene gimnasio).
  La sumé a la lista de excepciones de `scripts/chequeos.mjs` (junto con `favoritos_brik`): el principal debe confirmarlo.
- **Bug de base encontrado:** `privado.hecho_inmutable()` sin argumentos NO frena los UPDATE (con la lista de columnas
  permitidas vacía, la comparación da NULL). Por eso `registro_brik` lo usa con un argumento que no es columna. Otras
  tablas que lo usen sin argumentos podrían dejarse editar: conviene revisarlo (permisos, no lo arreglé).
- **Ciudad del gimnasio:** no existe la columna, así que la lista no filtra ni muestra ciudad. Recomendado: agregarla a
  `configuracion_gimnasio` cuando el dueño la cargue en el asistente.
- **Errores de las últimas 24 h (tablero y ficha):** no hay tabla de errores de la app, solo `ultimo_error` en las ayudas.
  Quedó sin hacer hasta decidir dónde se guardan (recomendado: `errores_app` alimentada desde `error.tsx`).
- **Reprocesar webhook:** la ficha lista los fallidos pero no los reprocesa: eso toca la ruta del webhook de MercadoPago
  (plata). Recomendado: función que vuelva a correr el mismo handler idempotente por `id_externo`.
- **Cambiar quién es el dueño:** el anterior queda como encargado (no pierde el acceso). Decidido por defecto.

#### Carril B, segunda tanda (migración 20261109020200)

- **Roles de BRIK (SA-10): aplicados solo a lo nuevo.** `privado.exigir_brik(roles)` manda en entrar como soporte, buscar,
  lista, tablero, pausa, baja, demos, exportar, borrar y registro. Las 31 funciones `admin_*` viejas (abono, novedades, alta,
  equipo, claves, dominios) siguen aceptando a cualquier admin: un "solo lectura" todavía podría llamarlas. Recomendado:
  que el principal les ponga `exigir_brik` una por una (es permisos, no lo toqué). Todos los admins existentes quedan `principal`.
- **Segundo factor (SA-10):** `privado.soy_admin_plataforma()` ahora exige `aal2` cuando `plataforma_ajustes.exigir_2fa` es
  true. Por defecto está apagado (nada cambia hoy). Mateo lo prende desde `/admin/seguridad` después de activar y confirmar
  su código; la base no deja prenderlo si quien lo prende no confirmó. Cambia una función central de permisos: revisar.
  No hice "aviso por equipo o lugar nuevo" ni "cerrar todas las sesiones de un gimnasio" (necesita la API de admin de Supabase).
- **Pausa:** pausar = `suspension_manual_*` y `privado.solo_lectura` devuelve true (panel en solo lectura; puerta y app siguen).
  El mensaje del trigger sigue hablando del abono vencido: cambiar el texto toca `frenar_si_solo_lectura` (otro carril/permisos).
  "Muestra: pausado, hablá con BRIK" en la pantalla no está: lo mostraría el layout del panel (carril A).
- **Baja:** deja el gimnasio pausado y "para borrar" 30 días, restaurable, con exportación primero (zip de CSV en
  `/admin/[id]/exportar`). **El borrado definitivo NO está hecho**: los hechos (pagos, ingresos) no se pueden borrar por
  diseño y falta un procedimiento revisado. Decidir si "borrar" es anonimizar todo (como con un socio) o un purge manual.
- **Papelera (socio, plan o clase quitados por error):** sin hacer.
- **Clonar la configuración de otro gimnasio:** sin hacer (los planes tienen historial de precios: hay que decidir qué se copia).
- **Demo para reunión:** crea el gimnasio `[demo]` con la plantilla elegida y vence a los 7 días (se calcula); no carga socios
  ficticios (los pone `scripts/` del seed, fuera de la base). "Deja de abrirse" al vencer: no está aplicado (tocaría `gimnasio_por_slug`
  y el proxy, carril A); hoy aparece como "demo vencida" y "Borrar demos vencidas" la pone en baja.
- **Errores (SA-9):** tabla `errores_app` y `registrar_error_app(gimnasio, pantalla, mensaje)`. **Falta llamarla** desde las
  pantallas `error.tsx` de los paneles (`src/app/panel/error.tsx`, carril D/A) y de `/app`. Hasta entonces el tablero muestra 0 errores.
- **Campana del dueño:** "BRIK entró a ayudarte (como X)" + motivo, por 7 días. Envuelvo `privado.avisos_moderacion` (el
  original queda como `avisos_moderacion_base`). Si otro carril redefine `avisos_moderacion`, pierde el aviso: usar la base.
- **Marco de color de soporte:** ya existía (`BannerSoporte` en `src/app/panel/layout.tsx`, carril A). No dice con qué rol entró:
  pedirle al principal que lo muestre con `estado_soporte`.
- **Datos personales (SA-11):** borrar a un socio deja el nombre en "Socio borrado" y borra DNI, mail, teléfono, foto, emergencia
  y notas; pagos y coberturas quedan. Convive con los pedidos de datos del socio (carril D), que resuelve el dueño.
  Estado de las copias de seguridad (D51): depende del plan de Supabase, sin hacer.
#### Fase 9 (F9.1, F9.4, F9.5, F9.6) · plantillas, escala y monitoreo

- **Pedido al principal (ESC-02), cambio exacto en `src/proxy.ts`.** Hoy el proxy ya NO consulta la autenticación en las páginas públicas
  (solo en `/panel`, `/app`, `/admin` y `/ingresar`). Quedan dos mejoras, las dos en `src/proxy.ts` / rutas públicas (carril A):
  1. **`/ingresar` sin cookie de sesión no necesita `getClaims()`.** En `conSesion`, justo antes de crear el cliente de Supabase:
     ```ts
     const hayCookieDeSesion = req.cookies.getAll().some((c) => c.name.startsWith("sb-"));
     if (!esProtegida(ruta) && !hayCookieDeSesion) return respuesta;   // la landing y el ingreso de alguien sin sesión no verifican nada
     ```
     (ahorra un `getClaims()` por cada visita anónima al ingreso, que con claves simétricas es un viaje a Auth).
  2. **HTML público desde la caché de la red.** `Cache-Control` desde el proxy no alcanza: Next lo pisa con `private, no-store` en cualquier página
     que lee `headers()`. Para cachear la landing hay que sacarla de lo dinámico: en el proxy, para un host de gimnasio y las rutas `/` y
     `/hacete-socio` SIN cookies, hacer `NextResponse.rewrite` a `/sitio/<host>` y `/sitio/<host>/hacete-socio`, rutas con
     `export const revalidate = 300` y `generateStaticParams` vacío (ISR a pedido), que usan los mismos `traerLanding(host)` (ya con `unstable_cache`
     y `revalidateTag`, que se invalida al editar). Con cookies (o sesión) sigue como hoy. Es una decisión de arquitectura del carril A: no la toqué.
- **Asesores de Supabase que no puedo ver (Mateo, copiá acá lo que digan):** Security Advisor y Performance Advisor del proyecto real. No tengo acceso
  (el Supabase conectado a esta sesión tiene otros proyectos). Esperados: "RLS enabled no policy" en tablas cerradas a propósito (info);
  "unindexed foreign keys" (arreglados los calientes en la migración 020700; el resto lo cubren índices de otra forma); "auth RLS initplan" (resuelto).
  También: "Leaked password protection" y "MFA" (Auth → Providers/Policies, son interruptores del panel de Supabase).
- **F9.1 plantillas:** el tipo de gimnasio no existía como dato: se agregó `gimnasios.tipo_plantilla` (lo llena el alta con plantilla; los gimnasios
  anteriores quedan sin tipo y solo reciben la plantilla de la plataforma). Cubre hoy los textos de la web (botón, mensaje de WhatsApp y bajada);
  los títulos de sección y los mensajes del dueño a socios viven en código (`landing-defaults.ts`, carril C) o por gimnasio: para sumarlos hay
  que agregar una fila a `privado.textos_plantilla()` y que el dueño los guarde en una columna. "No editó" = tiene exactamente lo que le daba la
  plantilla anterior (o el valor de creación de la bajada, o está vacío): si el dueño escribió algo idéntico a la plantilla, igual lo recibe.
- **F9.5 carga:** escrita (`scripts/medir/carga.mjs`, `.github/workflows/carga.yml`), **sin resultados todavía**: sembrar 1.000 gimnasios tarda ~30 min
  (cada gimnasio dispara sus triggers) y 500 usuarios necesitan memoria que acá no hay. Se corre en Actions: `gh workflow run carga.yml`.
- **F9.6:** límites por plan guardados y mostrados pero **no aplicados** (ver `ESCALA.md`; bloquear altas sería decidir quién puede qué). Sentry ⛔
  (sin cuenta ni DSN). El chequeo de salud se prende con la variable `SALUD_URL` en GitHub.

#### P2 (PLAT-04), P3 (PLAT-06) y P9 (PLAT-05)

- **P2: helper único `src/lib/urls.ts`** (`urlPlataforma`, `urlGimnasio`, `urlPanel`, `urlIngreso`, `urlDeHost`, `rutaGimnasio`, `hostGimnasio`),
  con prueba (`urls.test.ts`) y el test `urls-sin-hardcode.test.ts` que falla si en `src` aparece `vercel.app`, un host literal, `/g/<slug>`
  armado a mano o un link absoluto con el host interpolado. Reemplacé todo lo de `src/app/admin` y `src/lib/admin`; el test exige que esas
  carpetas queden sin excepciones. **Lo que queda fuera (para otros carriles; está en `EXCEPCIONES` del test y solo puede achicarse):**
  `lib/panel/direccion-pagina.ts` (A/D), `app/elegir/page.tsx` (C), `proxy.ts` (A, es una ruta reescrita, no un link), `app/app/Referir.tsx` y
  `app/app/acciones.ts` y `lib/google.ts` (C), `app/panel/socios/acciones.ts` (D), `app/kiosco/activar/route.ts` y `app/tv/activar/route.ts` (A/D).
  También quedan `window.location.origin` en `panel/clases/tv/Tvs.tsx` y `panel/configuracion/Tablets.tsx` (el navegador conoce su propio
  origen: no es una dirección escrita, pero conviene pasarlo por el helper). El test no ve los links relativos del panel (`"/panel/…"`): esos
  son rutas internas, no direcciones.
- **P3: la lista de variables por entorno** (`src/lib/admin/entorno.ts`, en "Estado de la plataforma"): qué variables faltan (por nombre),
  a qué Supabase apunta el entorno (ref de la URL), si coincide con `SUPABASE_REF_ESPERADO`, y si la clave anon y la de servicio son del mismo
  proyecto y del rol correcto (lee el `ref` y el `role` del JWT; las claves nuevas `sb_secret_…` no los traen: se avisa). Nunca muestra una clave.
  **Mateo tiene que cargar `SUPABASE_REF_ESPERADO` en Production y en Preview** (el ref de su proyecto): sin esa variable la lista solo informa
  a cuál apunta (amarillo) en vez de dar rojo si apunta a otro.
- **P9: dominios por la API de Vercel escrito y probado con un Vercel simulado** (`vercel-dominios.ts`, 12 pruebas). ⛔ en producción hasta
  `VERCEL_TOKEN` y `VERCEL_PROJECT_ID` (y `VERCEL_TEAM_ID` si el proyecto es de un equipo): sin ellos la sección dice qué cargar y no deja
  agregar nada. Solo el principal agrega o verifica (lo comprueba el servidor antes de llamar a Vercel) y queda en el registro de BRIK. **No
  probado contra Vercel real** (sin token). Los registros DNS por defecto son los de Vercel (A 76.76.21.21 y CNAME cname.vercel-dns.com);
  si Vercel responde otros, hay que ajustarlos. No agrega el dominio propio de un gimnasio a su ficha automáticamente: se carga igual en
  "Direcciones" de la ficha.

#### Fase P (P4 a P7) y la contraseña que no se aplicaba

- **Causa probable del login roto de Mateo (hallazgo del coordinador): si el mail ya tenía cuenta, la contraseña escrita se ignoraba
  en silencio.** Corregido: `darAcceso` devuelve `yaExistia` y `contrasenaNoAplicada`; el alta, "Dar acceso" y "Sumar a alguien"
  dicen "Ese mail ya tenía cuenta: la contraseña que escribiste NO se aplicó…" y dejan a la vista el botón "Nueva contraseña"; la tarjeta
  Accesos y el WhatsApp no llevan una contraseña que no se aplicó. e2e en `fase-u1-u2.mjs` (cuenta existente + contraseña elegida: avisa y
  la nueva no entra). Pregunta abierta: ¿un mail existente debería poder "tomar" la contraseña nueva? No lo hago (cambiaría la clave de
  una persona que quizá ya la usa en otro gimnasio); se ofrece "Nueva contraseña" a propósito.
- **Mover de gimnasio (P7):** no se cambia el `gimnasio_id` de la fila (los hechos del historial la referencian con FK compuesta): se
  desactiva la fila en el origen y se suma (o reactiva) otra en el destino con la misma cuenta. Solo el principal. Nunca deja un gimnasio
  sin dueño (tampoco al desactivar ni al cambiar de rol).
- **Probar acceso:** rojo = no puede entrar (sin cuenta, sin confirmar, desactivada, gimnasio dado de baja, sin dueño); amarillo = no lo
  impide (todavía no entró, gimnasio pausado, sin planes). "Arreglar" confirma la cuenta (`admin_confirmar_cuenta`: toca `auth.users`),
  activa a la persona o reanuda el gimnasio.
- **Dirección reservada (P4):** `admin`, `www`, `app`, `api`, `g`, `ingresar`, `dueno`, `recepcion`, `profe`, `socio`… (lista en
  `src/lib/admin/slug.ts`) no se pueden usar como dirección de un gimnasio. Falta el chequeo contra subdominios ya usados en Vercel
  (depende del dominio, P1).
- **Plan de Base en el alta (P4):** opcional; si falla, el gimnasio queda creado y se avisa.
- **Barra "Estás viendo como…" (P7):** ya existía el marco y la barra (VD-40); ahora dice el rol y el gimnasio (`estado_soporte` devuelve
  `rol`; tocó `BannerSoporte` y `panel/layout.tsx` de otros carriles, una línea cada uno).

#### Fase U (U1 y U2) · altas sin mails y errores de la clave de servicio

- **U1 hecho (código), falta que Mateo cargue la clave en Vercel.** `traducirErrorSupabase` (`src/lib/admin/errores-supabase.ts`)
  convierte "Invalid API key", "User not allowed" (clave anon o publicable), JWT de otro proyecto, "fetch failed" y "falta la variable"
  en texto con qué variable cargar y dónde. Se usa en `darAcceso`, `nuevaContrasena`, el alta del socio y el chequeo de la plataforma.
  El alta cortada deja el gimnasio con "Terminar alta: dar acceso al dueño" (ficha, `/admin` y lista), y repetir el alta con la misma
  dirección termina ese gimnasio (no crea otro). El chequeo de Estado crea y borra una cuenta `chequeo-…@ejemplo.invalid` (se repite
  cada 10 minutos si anda; si falla, en cada visita). `supabase-local` ahora soporta borrar usuarios y simular la clave mala con
  `.local/clave-servicio-mala`.
- **U2: verificación de cada ruta de alta.** Ninguna manda mail ni pide confirmar: dueño y equipo (`darAcceso`), socio desde
  recepción y socio online (`prepararLinkContrasenaSocio`) crean la cuenta con `createUser` y `email_confirm: true`. Nuevo: el alta del
  socio desde recepción acepta "Contraseña para su app (opcional)"; con ella la cuenta queda con esa contraseña y la ficha vinculada, y
  entra al toque. Sin ella queda el link actual (el socio elige la suya con un código que él mismo pide).
- **Lo que SÍ manda mail y no toqué (carril C, son logins que pide la propia persona, no altas):** "Entrar con un código al mail"
  (`pedirCodigoMail`, `signInWithOtp` con `shouldCreateUser: true`), el código para vincular con Google y "Olvidé mi contraseña".
  El primero además CREA la cuenta si no existe. Si Mateo quiere cero mails también acá, hay que sacar esos caminos (o dejar solo
  "Olvidé", con `shouldCreateUser: false`). Recomendado: sacar `shouldCreateUser: true` de `pedirCodigoMail` y de la vinculación.
- **Alta online del socio** (`/hacete-socio`) no tiene campo de contraseña (lo llena el propio socio y no hay quien la escriba): crea
  la cuenta con una al azar y el link; no manda mail. Si se quiere contraseña ahí, es otra decisión de carril C.

#### Carril B, tercera tanda (migración 20261109020300)

- **Borrado definitivo = anonimizar (decidido por defecto, opción recomendada).** `admin_borrar_definitivo(gimnasio, nombre)`:
  solo el principal, con la baja de más de 30 días y escribiendo el nombre exacto. Borra los datos personales de los socios
  (nombre, DNI, mail, teléfono, foto, notas), desactiva al equipo y le saca la cuenta, borra las direcciones y despublica la
  página; el gimnasio queda "Gimnasio borrado" (`borrado_en`). Pagos, ventas e ingresos se quedan (plata y hechos no se borran).
  No toca `auth.users` (una cuenta puede estar en otros gimnasios). Si Mateo prefiere un purge físico, es otra migración revisada.
- **Reprocesar webhook: a pedido, idempotente, sin tocar la ruta.** `admin_evento_webhook` (principal y soporte) lee el evento
  fallido y deja registro; la acción del servidor `reprocesarWebhook` lee el pago de la API de MercadoPago con el token del
  gimnasio y llama a `procesarPagoMP` (el mismo camino del webhook, idempotente por pago y estado), y recién ahí cierra el
  evento. Un pago ya acreditado no se duplica. **Sin probar contra MercadoPago real** (la lógica de `procesarPagoMP` ya tiene sus pruebas).
- **SA-8:** novedades por plan, ciudad y módulo (`para_*`), "le llega a N" y "la cerraron N". "Cuántos la vieron" = cuántos la
  cerraron: no hay marca de "vista" (habría que registrarla desde el panel del dueño, carril A/D). "Qué hay de nuevo" del dueño:
  `novedades_historial(gimnasio)` existe; **falta la pantalla** en el panel del dueño. Mantenimiento: `mantenimiento_vigente()`
  (pública) devuelve el aviso de las próximas 48 h; **falta pintar la franja** en los layouts de los paneles (carril A).
- **SA-7:** prueba gratis por gimnasio (`prueba_dias`, 14 por defecto: igual que antes), descuento con motivo y fecha de fin
  (`precio_con_descuento` sale en `estado_abono`), recordatorio por wa.me con monto y link de pago (el link lo carga Mateo en `/admin`).
  Se redefinió `privado.estado_abono` desde su única definición (0110); agrega claves, no cambia las que había.
  **El descuento solo se muestra: no cambia lo que el gimnasio paga ni cobra nada** (BRIK cobra a mano). Confirmar que es lo que se quiere.
  ARCA/factura electrónica sigue en 🔌.
- **SA-9:** estado (migraciones, tamaño de la base, commit y región de Vercel), uso por gimnasio (socios, fotos, entradas 30 días,
  sedes; los límites del plan no existen como datos, así que no hay "se acerca al límite") y funciones a prueba
  (`funcion_prendida(gimnasio, clave)`; nadie la consulta todavía: la usa quien construya la función nueva).
- **Papelera:** socios dados de baja en 30 días y planes archivados, con restaurar. Las clases archivadas no se incluyeron
  (necesitan decidir qué es "archivar" una clase).
- **Clonar configuración:** copia planes activos con su precio de hoy, actividades, modo de clases, qué cobra y módulos apagados, a un
  gimnasio sin planes. No copia horarios, reglas finas ni la página.
- **Carga de socios con Excel:** ya existe en el panel del dueño (`/socios/importar`); BRIK la usa entrando como soporte. No se
  duplicó dentro de `/admin`. Los botones "Abrir como soporte en esta pantalla" de la ficha quedan sin hacer.
- **Parches de otras migraciones:** antes de redefinir `estado_abono`, `novedades_dueno`, `admin_novedades` y
  `admin_publicar_novedad` verifiqué que ninguna otra migración las vuelve a definir. `privado.avisos_moderacion` y
  `privado.soy_admin_plataforma` ya estaban envueltas/redefinidas en la tanda anterior.
- **Sin hacer de la lista:** nada de los 5 puntos quedó sin tocar; lo parcial está arriba.
### Carril C · Socio, página e ingreso (ayudante 2, 09/11) — opción recomendada ya aplicada, avisame si no
- **"Ese mail no tiene cuenta en Gimnasio X" contra VD-33 ("el mismo mensaje exista o no la cuenta").** El pedido (F1.2) manda el error con nombre. Se aplicó **solo desde la dirección de un gimnasio, solo después de una contraseña mala y con el tope de BASE-8 ya aplicado** (8 fallos por mail y 20 por conexión cada 15 min); si el mail tiene ficha de socio o usuario del equipo ahí, el texto sigue siendo "El mail o la contraseña no son correctos". Costo: alguien puede averiguar si un mail es socio de un gimnasio (hasta 8 veces por mail cada 15 min). Si preferís el mensaje único, es borrar la llamada a `mail_para_ingresar` en `src/app/ingresar/acciones.ts`. **`scripts/e2e/vd-33.mjs` línea 58 compara con cuenta y sin cuenta y va a fallar: hay que cambiarla** (es del carril A).
- **Mail y contraseña adelante para el socio (D43).** Cambia lo que se ve primero en `/ingresar?modo=socio`: ya no es el campo de celular. **Todas las pruebas e2e que entran con `entrarSocio` (`scripts/e2e/comun.mjs`) dejan de andar** hasta que `entrarSocio` haga clic en el botón "Celular" antes de llenar `input[name=telefono]` (una línea, del carril A).
- **FA-16, foto que sube el socio:** se guarda en el mismo bucket privado y queda marcada "sin confirmar" (`socios.foto_sin_confirmar_desde`) hasta que la recepción la confirma (`confirmar_foto_subida`) o pone otra. Mientras tanto la Entrada la usa igual (con la marca); si querés que no se use hasta confirmarla, es un cambio de `foto_socio`. Falta la tarjeta "foto nueva, subida por el socio" en la ficha y el interruptor en Configuración (son de `src/app/panel/`, carril D): las funciones ya están (`foto_estado_socio`, `confirmar_foto_subida`, `guardar_foto_socio_permitida`).
- **FA-14, la regla de la recomendación:** "si hace 7 días o más que no entra, lo dice con los días y, si hay clases, suma la próxima de hoy". Una sola regla, sin reglas ocultas. Los 7 días son una constante de la función `resumen_app_socio`.
- **Lighthouse (F1.8):** no se midió (no se levanta la app en este carril). Medirlo con la app compilada: `npx lighthouse http://demo.localhost:3123 --form-factor=mobile --only-categories=performance,seo,accessibility`.
### Carril D (ayudante 3, 09/11) · F1.7, F1.5, F1.4 — decisiones tomadas por defecto

- **Prueba de permisos por rol (`permisos-por-rol.test.mjs`).** Llama cada función de `PERMISOS.md` como dueño, encargado, recepción, profe, dueño de otro gimnasio, socio sin cargo y anónimo. **No encontró ninguna contradicción** (2.093 llamadas, 2.082 concluyentes; las 11 restantes fallan antes de llegar a la regla por un dato inexistente y no prueban nada). Una función con ramas por un booleano (ej. `marcar_no_escribirle`: marcar lo hace la recepción, sacar la marca solo dueño y encargado) se prueba con el booleano en las dos posiciones. Recomendado: dejarla en `db:pruebas` (tarda ~45 s).
- **Anti-robot de "Quiero ser socio" (D49).** El campo trampa `sitio` ya existía en `hacete-socio/acciones.ts`. Se suma el tope en la base: `registrar_envio_publico(formulario, ip, clave)` (10 por hora por conexión, 3 por hora por persona, hash). El helper `src/lib/seguridad/envio-publico.ts` hace las dos cosas. **Falta engancharlo en `src/app/hacete-socio/acciones.ts` (carril C): una línea antes del `rpc("alta_online")`.** Recomendado: `const f = await frenarEnvioPublico(form, "alta_online", datos.dni); if (f.robot) return { listo: true, nombre: datos.nombre }; if (f.error) return { error: f.error, datos };`. El "Olvidé mi contraseña" ya tenía tope por mail y por conexión (`pedirRecuperacion` → `limiteCodigos`, SEG-1).
- **Ley 25.326 (D52).** Migración `20261109040100`: política de privacidad del gimnasio (texto del dueño, pública por `politica_privacidad_publica(host)`; sin texto se muestra un modelo), consentimiento anotado en `socios.consentimiento_datos_en` cuando el socio acepta el reglamento (trigger), y pedidos de ver/corregir/borrar (`pedir_mis_datos` para el socio, `pedidos_datos_panel` y `resolver_pedido_datos` para dueño y encargado). Pantalla del panel: `/panel/datos-personales`. **Falta, en otros carriles:** (C) mostrar la política en `/privacidad` de la página del gimnasio y un link en "Quiero ser socio"; (C) un botón "Pedir mis datos" en la app del socio que llame `pedir_mis_datos`; (A) un link en el menú. "Borrar" no borra a mano ni en automático: los pagos y las entradas se guardan por obligación contable; el dueño anonimiza la ficha y anota qué hizo. Recomendado así hasta que Mateo hable con su abogado. El texto modelo está marcado "revisar con un abogado".
- **Contraseñas demo.** `usuarios-demo.mjs` se niega a correr contra un Supabase que no sea local con `demo-gymos` (o cualquier contraseña de menos de 10 letras o repetida). El workflow ya exigía 10 o más letras.
- **Asistente, paso 6 y 7 (BASE-7).** Se miden en `public.pasos_asistente` (función aparte: `privado.primeros_pasos`, que usa el widget de Inicio, no se tocó). Paso 6 = el dueño cambió una regla de entrada (queda en el historial) o hay una tablet autorizada. Paso 7 = si no hay clases, "no aplica" y cuenta como hecho; con clases, un horario vigente y un profe activo. **Decisión a confirmar:** un gimnasio nuevo arranca con el paso 7 hecho por no dar clases (así "Seguir donde quedé" lo salta solo). Alternativa: pedir una confirmación explícita, pero eso sería guardar "paso hecho".
- **Vista previa del logo.** Elegir un archivo ahora lo muestra y pide "Usar este logo" antes de subirlo. **Esto cambia el flujo de `scripts/e2e/cfg-2.mjs`**: después de cada `setInputFiles` de logo/ícono hay que hacer click en "Usar este logo" / "Usar este ícono" antes de esperar "Logo listo". Lo arregla el principal (carril A es dueño de `scripts/e2e/`).
- **Tema por usuario (BASE-6).** Se guarda en `equipo.preferencias.tema` (`guardar_tema_usuario`, `mi_tema`) y en la cookie `tema` (`claro` | `oscuro`; sin cookie = el del gimnasio). Mi cuenta ya tiene el selector. **Falta del principal:** que el layout lea la cookie y pinte `data-tono` con ese valor en vez del que calcula `propsMarca` (y que `globals.css` tenga los tokens de los dos tonos completos).
- **Chequeo de diseño.** `scripts/diseno-chequeo.mjs` (dentro de `npm run chequeos`): falla si un archivo suma un color hex suelto o un emoji más que su número guardado en `scripts/diseno-base.json`. Hoy quedan 32 colores y ~1.670 emojis por convertir al componente `Icono`; **el chequeo no queda en cero hasta que el principal cree `Icono` y se conviertan** (`node scripts/chequeos.mjs --actualizar-diseno` baja los números a medida que se convierte).
- (09/11, decidido por defecto) Se subió la base de `diseno-base.json` para los emojis y colores que sumaron los carriles B y C: bajan a cero cuando exista `Icono` (F1.4).

### Carril D (ayudante 3, 09/11, segunda tanda) · decisiones tomadas por defecto

- **Detalle #24, pagos parciales.** Hoy una cuota se paga entera (en Vender) o se fía hasta un tope (cuenta corriente). Pagarla en partes cambia plata y qué cubre cada parte: no lo hice. Recomendado: no hacerlo en el P0; el fiado cubre el caso.
- **Detalle #43, matriz de permisos editable.** Toca permisos: no lo hice. Recomendado: dejar los interruptores de hoy (Equipo → Permisos). Una matriz rol × acción editable puede dejar a un rol con algo que la base no le da; hay que decidirlo con Mateo.
- **FA-21, "cajero".** Es quien cierra el turno (quien cuenta responde por el cajón). Alternativa: quien lo abrió. Recomendado: quien cierra.
- **FA-10, "tasa de cobro".** De los socios sin baja cuya cobertura venció dentro del mes (y ya pasó), cuántos tienen hoy cobertura posterior. No cuenta a los que vencen más tarde en el mes. Recomendado así.
- **FA-9, WhatsApp en lote.** No manda solo: arma un chat con el mensaje listo por cada socio y lo manda la persona. Los marcados "no escribirle" se sacan. Recomendado así (un envío automático necesitaría la API de WhatsApp Business).
- **Búsqueda con errores de tipeo.** Umbral 0,6 de similitud de palabra y solo con 4 letras o más: "gonzales" encuentra "González" y "zzzzqq" no trae a nadie. Si en la práctica trae de más o de menos, se ajusta el número en `buscar_socios`.
- **FA-22, umbrales.** "Dos sedes": hasta 20 minutos. "Muchas entradas": 4 o más en un día y al menos el triple de su promedio por día de visita de los 30 días anteriores a la ventana de 14 días. Recomendado así; si avisa de más, se sube a 5 entradas. Solo avisa al dueño y al encargado.
- **FA-24.** El invitado se anota sin teléfono; la recepción escribe su WhatsApp en Socios → Interesados para dejarlo como interesado (origen "referido"). Recomendado: no pedir el teléfono en la puerta para no frenar la entrada.
- **FA-12 y FA-23 sin hacer.** Son de la app del socio y de reservas (carril C) y tocan funciones que otros carriles parchan; se hacen cuando C cierre su parte.
- **FA-13.** La prueba `la tarea ... sin responder hace más de 24 h` falla en la base integrada: `20261109010300_consumidores_cubierto_hasta.sql` redefine `privado.para_hacer_hoy_con` y perdió las tareas de `20261106007403` (mayores de edad) y la de interesados sin responder. Lo arregla quien dueño de esa migración, con una migración nueva que parta de la definición vigente.

### Carril D · Fase U3 (aislamiento entre gimnasios)

- **Prueba de base `aislamiento-gimnasios.test.mjs`.** Arma dos gimnasios con datos (A y B) y cuatro cuentas del A (dueño, recepción, profe y un socio con cuenta). Llama todas las funciones `public.*` que reciben un id (530 funciones, 2.224 llamadas) con ids del B, y otras 195 con el gimnasio y la sede del A pero el socio, la venta, el plan… del B. También lee con la sesión de cada cuenta todas las tablas con `gimnasio_id` filtrando por el B (RLS). Resultado: ninguna fuga salvo dos funciones.
- **Arreglado (bug claro, migración `20261109041100`).** `usa_qr_pared(gimnasio)` y `registra_salida(gimnasio)` le decían a CUALQUIER cuenta con sesión una opción de configuración de otro gimnasio. Ahora responden solo al equipo activo, a los socios con cuenta de ese gimnasio, al super admin y al servidor; a las demás les dan error 42501. La app del socio las llama con `.catch`, así que sigue igual.
- **No son fuga (quedan en la lista `PROPIAS` de la prueba, con el motivo):** `borrar_suscripcion_push`, `estado_soporte`, `registrar_sesion_equipo` y `funcion_prendida` reciben el id del gimnasio pero solo hablan de la propia cuenta de quien llama (o devuelven falso si no es del gimnasio).
- **No se probó con esta prueba:** las funciones sin ningún id real del B para pasarles (tablas vacías en el B); esas dan error de "no existe" y no demuestran nada. Las cubre `permisos-por-rol.test.mjs`.
- **Las 4 vías de entrada (proxy, layout, servidor).** Leí `src/proxy.ts`, `src/app/panel/layout.tsx` y `contextoPanel`: el proxy solo ELIGE el gimnasio (host, `/g/<slug>` o cookie; "la cookie no da permisos") y cada pantalla pide `panel_gimnasio` a la base, que exige `privado.exigir_equipo`; el error de permiso llega al layout, que muestra "No tenés acceso a este gimnasio" y no contenido. No encontré un camino que muestre datos sin pasar por la base. Falta correr `scripts/e2e/fase-u3.mjs` (escrito, sin correr) para confirmarlo con sesión real.
- **El mismo mail en dos gimnasios.** Hoy lo único que lo impide es que nadie lo cree: `guardar_equipo` y "dar acceso" son del dueño de ESE gimnasio, y la prueba confirma que un dueño de A no puede dar de alta a nadie en el B. El super admin sí puede darlo de alta en los dos. Recomendado: dejarlo así.

### Carril D · U0.1 (ingreso)

- No toqué `src/app/ingresar` ni `src/proxy.ts` (los arregla B). Lo mío: la prueba de base `login-dueno-nuevo.test.mjs` (alta de gimnasio con dueño, filas que quedan, mail con mayúsculas y espacios, cuenta sin fila o de otro gimnasio, slug inexistente) y el e2e `scripts/e2e/fase-u0-login.mjs`.
- Pendiente de decidir (de B): `darAcceso` no normaliza el mail adentro; hoy lo hacen los que lo llaman (`admin/acciones.ts`, `panel/equipo/acciones.ts`). Recomendado: normalizar también en `src/lib/cuentas.ts`.

### Carril B · F2 / F9.8 (restricción de plata del soporte y "ver como socio")

- **Toca plata y permisos, por eso lo reporto:** la migración `20261109020800` agrega un trigger en `ventas`, `pagos`, `movimientos_caja` y `turnos_caja` que frena (42501) cualquier escritura hecha por una cuenta de soporte de BRIK (`equipo.es_soporte`) salvo que, al entrar, se haya tildado "El dueño me pidió tocar plata" (`soportes_gimnasio.plata_autorizada`, 60 min, queda en el motivo que ve el dueño). **No cambia quién cobra en el gimnasio**: dueño, recepción y profe quedan igual. Decisión de Mateo: ¿alcanza con la casilla o prefiere que el dueño apruebe desde su panel?
- **"Ver como este socio"** es una pantalla de solo lectura de BRIK (`/admin/ver-socio`, función `admin_ver_socio`): acceso calculado con motivo, cobertura, últimos pagos e ingresos. No entra a la cuenta del socio ni muestra la app real (es del carril C). Queda en el registro de BRIK.
- **Cierre de F2 (migración `20261109020900`):** `landing_publica` quedó envuelta (la original pasó a `landing_publica_base`) para devolver una portada neutral si el gimnasio está dado de baja o es una demo vencida; es función de la landing (otro carril), si la redefinen tiene que partir de `pg_get_functiondef` de la vigente. Pausado, baja y demo vencida cortan el panel con una pantalla (salvo el Soporte BRIK que entró con motivo); la app del socio no se corta, solo lleva la franja de mantenimiento. **Decisión de Mateo:** ¿un socio de un gimnasio pausado sigue usando su app y la puerta? (hoy sí). En `cache-prohibido.test.ts` (de D) sumé `FranjaMantenimiento` y `mantenimiento_vigente` a las excepciones: es información pública e igual para todos. F2.8: "cerrar las demás sesiones" usa `signOut({ scope: "others" })` y depende de que GoTrue lo soporte; el aviso por mail a BRIK ⛔ (no hay mail cargado). F2.7: las copias automáticas de Supabase no se ven desde acá; la ficha muestra la última exportación manual.
- **F7.1 (migraciones `20261109021000` y `20261109021100`) — toca plata y permisos, anotado sin más cambios que lo que dice el ítem:**
  - **Congelar solo:** `pedir_pausa_socio` ahora, si el dueño prendió "El socio pausa su plan y se aprueba solo" (Configuración → Reglas, **apagado por defecto**) y la pausa dura hasta N días (por defecto 14, de 1 a 90), la deja aprobada en el momento y corre la membresía con la misma `privado.congelar` de siempre; las reglas de `validar_pausa` (tope de días por año, fechas, superposición) corren antes. Queda marcada `pedidos_pausa.autoaprobado`. Esto cambia **quién aprueba** una pausa (que mueve el vencimiento y por lo tanto la plata): por eso está apagado y solo lo prende el dueño. Decisión de Mateo: ¿el encargado también debería poder prenderlo?
  - **TV de entradas:** modo por TV (`pantallas_tv.modo`: clases o entradas). En entradas muestra primer nombre e inicial y la hora de las últimas 8 entradas **sin color, plan ni deuda**, más "N personas adentro". Ojo: la TV de clases ya mostraba "nombre + inicial" de los anotados; si Mateo no quiere ningún nombre en pantallas públicas, hay que sacarlo de `privado.clase_tv` y de `tv_estado`.
  - **Ocupación en vivo para el socio:** `ocupacion_en_vivo(gimnasio)`: solo un número (entró en las últimas 3 h y no registró salida; sin salidas registradas cuenta de más). **Apagada por defecto**, la prende el dueño. La tarjeta en `src/app/app/page.tsx` (de C) es una línea; el componente es `src/app/app/OcupacionEnVivo.tsx`.
  - **Tengo que cobrar:** pestaña nueva en Vencen hoy (solo si la persona puede cobrar): cola única de los que vencen hoy y los vencidos, los de más plata primero. No cobra por sí misma: cada fila usa el Cobrar de siempre.
  - **Pase de invitado:** ya estaba (INV-1 y FA-24); no cambié nada.
  - **Kiosco:** sin emojis (Icono), teclas con nombre propio (`borrar`/`entrar`); mismo flujo.
- **VD-26B:** los pedidos de demo sin atender entran a las alertas del super admin (rojo pasado un día) y los planes de BRIK tienen casilla "Se muestra en la web" (`plataforma_planes.publico`, filtra `planes_brik_publicos`). El aviso por mail o WhatsApp a BRIK sigue ⛔ (no hay servicio de mail ni WhatsApp de envío).
- **F6.1, lo que no hice por ser de otro carril o depender de Mateo:** VD-42C (pedir el código TOTP justo después de la contraseña) está en el ingreso (U0); VD-42D (alerta por exportes grandes y PIN, aal2 en exportar_mes/gastos) toca plata y permisos del panel; VD-33E (ofrecer cerrar sesiones al cambiar la contraseña) es de Mi cuenta (shared); VD-43B/C son del panel del dueño.
- **SEG-01 a 07:** SEG-01 ya estaba (`aislamiento-gimnasios.test.mjs`); SEG-02 y SEG-07 ahora tienen guarda en vitest (`src/lib/admin/seguridad-codigo.test.ts`: ningún archivo de navegador toca la clave de servicio, ninguna clave ni `demo-gymos` en `src`); SEG-03/04 (BASE-8), SEG-05 (registro de BRIK) y SEG-06 (exportar/borrar) ya estaban.

## 11/11 · Decisiones de Mateo y por defecto (loop)
- **Aprobado por Mateo:** los permisos de C1 (`cuenta_para_clave_socio`, `registrar_clave_entregada`, tabla `claves_entregadas`).
- **Pedido de Mateo:** el socio ve en su app "Te dieron una clave nueva el <fecha>, por <nombre>" (ayudante `carril/c-aviso-clave`).
- **Regla desde hoy:** lo que toque permisos o plata se decide con la opción más segura y se anota acá como "decidido por defecto"; no se pide revisión. Se publica al cerrar cada fase (prevuelo → aplicar → merge → humo). La publicación de la fase P y lo hecho de la fase C sale apenas C1 pase en Actions.
- **Decidido por defecto (C4):** no hay QR fijo impreso para la pared. El de la tablet cambia cada 30 s y lo firma la base; uno impreso se podría prestar. El cartel de la puerta lleva logo, color y nombre y manda a escanear el QR de la tablet. Si Mateo quiere uno fijo, es una decisión de seguridad aparte.
- (11/11, decidido por defecto) **C6, cierre por inactividad de la compu compartida:** queda **apagado por defecto** (0 = no se cierra), por gimnasio, en Configuración → Entrada (15, 30, 60 o 120 minutos; la base acepta 5 a 480; migración `20261111110000_recepcion_inactividad.sql`). Apagado y no 30 minutos porque prenderlo a todos los gimnasios existentes les cierra la sesión en pleno turno sin avisar. Recomendada para la compu de la recepción: 30 minutos. Cuando está prendido: sin uso, primero suelta a quien atiende (vuelve a pedir el PIN, la sesión del gimnasio sigue) y, pasado el mismo tiempo sin que nadie ponga el PIN, cierra la sesión del gimnasio. Solo quita permisos, nunca los da. Vale para los roles que ven la Entrada (dueño, encargado, recepción); la profe no tiene Entrada y no se cierra sola. Esta compu puede acortar el tiempo (para pruebas, `localStorage gymos.entrada.inactividad-seg`), nunca alargarlo.
- (11/11, decidido por defecto) **C6, cambiar de persona:** ya existía (CAJ-3, PIN de 4 números, barra "Atiende X · Cambiar", `registrado_por` en cada ingreso y cobro). No se agregó "entrar con la contraseña de la persona": eso es otro ingreso (cerrar la sesión del gimnasio y entrar con su cuenta) y es lo que se quiere evitar en la compu compartida. Un PIN nunca da más permisos que la sesión: lo que se puede hacer es lo que pueden los dos a la vez (la sesión y la persona del PIN), y nunca eleva a dueño.
- (11/11, decidido por defecto) **C6, la contraseña del dueño en la compu compartida:** el formulario de ingreso tiene la casilla "Esta compu la usa todo el equipo" (queda en este navegador; también en Configuración → Entrada → En esta compu, y se marca sola cuando la sesión se cierra por falta de uso). Marcada, el campo de la contraseña deja de ser de tipo contraseña (se ve con puntos igual) y lleva autocomplete off, porque los navegadores ignoran autocomplete off en los campos de contraseña y ofrecen guardarlos. Sin marcar, todo igual que antes (el dueño en su compu sigue guardándola).
- (11/11, decidido por defecto) **F1.2, el e2e de "Olvidé" no fallaba por el código del mail sino por "Salir":** `POST /salir` redirigía con `req.nextUrl` (host interno) y el CSP `form-action 'self'` frena un formulario cuya redirección sale de su origen. Ahora la redirección es relativa. Sin SMTP, "Olvidé mi contraseña" sigue mostrando "Pedile una clave nueva a la recepción" y el formulario del código queda disponible (en producción sin SMTP los mails de Supabase salen 2 por hora y pueden no llegar: el aviso es lo que se promete). Las rutas `src/app/admin/entrar`, `admin/salir-gimnasio` y `entrar/[slug]` arman el destino igual con `nextUrl.clone()`: son del carril B, quedan anotadas en LECCIONES.
- (11/11, decidido por defecto) **F1.7, anti-robot (D49) con la opción más segura y sin servicios externos:** los dos formularios públicos ("Quiero ser socio" y "Quiero una demo") llevan el campo trampa `sitio`, un contador de segundos abierto (`CampoAntiRobot`; menos de 3 s o sin contador = error "Mandaste el formulario muy rápido", que no cuenta para el tope) y el tope de la base (`registrar_envio_publico`: 10 por hora por conexión y 3 por hora por DNI/mail/contacto, hash). Con el campo trampa lleno se finge éxito y no se guarda nada. El contador lo mide el navegador (un robot dedicado lo puede falsear: para eso están el tope y Turnstile cuando se prenda `TURNSTILE_*`). "Olvidé mi contraseña" y los códigos ya tenían tope (5 por destino y 20 por conexión por hora, `registrar_pedido_codigo`) más el de ingreso fallido (8 por mail, 20 por conexión cada 15 min). Los e2e que mandan estos formularios esperan los 3 s (`esperarAntiRobot` en `comun.mjs`): `reg-1`, `rev-3`, `vd-26`, `vd-35`. Ojo: corridos varias veces en una hora desde la misma conexión llegan al tope de 10 envíos.
- (11/11, decidido por defecto) **F1.7, Ley 25.326 (D52) en el alta pública:** la casilla del reglamento ahora dice también "y que use mis datos para anotarme y cobrarme" con el link a la política (una sola casilla: si fueran dos, un socio que acepta una y no la otra queda a medias; el servidor ya exige `acepto`, y el consentimiento se anota en `socios.consentimiento_datos_en` por el trigger de la migración `20261109040100`). Debajo del formulario queda el aviso: quién guarda los datos, para qué y cómo pedir verlos, corregirlos o borrarlos. Mi membresía suma el link "Pedir que corrijan o borren mis datos" (lleva a `/app/pedir-datos`, SA-11) y a la política (`/privacidad`).
- (11/11, decidido por defecto) **F1.7, permisos por rol:** `permisos-por-rol.test.mjs` suma la prueba de las funciones "solo el servidor" (27): la base y `PERMISOS.md` coinciden en cuáles son y ningún rol, ni el dueño ni el anónimo, las ejecuta (siempre error 42501). Las funciones sin rol del equipo (403) las cubren `aislamiento-gimnasios.test.mjs` y la lista blanca de `chequeos`. Sin permisos nuevos.
- (11/11, decidido por defecto) **F1.7, contraseñas demo:** `npm run chequeos` falla si `usuarios-demo.mjs` acepta, contra un Supabase que no sea localhost, la contraseña de siempre, una de menos de 10 letras, una repetida o una de lista; o si un workflow que usa los secretos de Supabase nombra `demo-gymos` o escribe la contraseña a mano; o si el workflow deja de exigir 10 letras.
- (11/11, decidido por defecto) **C5, lector USB:** se toma como lectura un tipeo de corrido de 6 o más caracteres con menos de 50 ms entre teclas y Enter dentro de los 100 ms (una persona no pasa de una tecla cada 80 ms). El mismo código leído dos veces en 2 segundos es un solo ingreso. Un código que no existe suena el error, vacía el campo y deja el foco. Quién es el socio y si entra sale solo de `estado_acceso`/`calcular_acceso`.
- (11/11, decidido por defecto) **C9, QR y link para anotarse solo:** el QR del cartel "Anotate acá" y el link de WhatsApp abren `/hacete-socio` del gimnasio (dirección armada con `lib/urls.ts`; el host ya dice qué gimnasio es, no pasa por la landing). **No hay un interruptor nuevo:** el "registro abierto" de siempre (`configuracion_gimnasio.altas_online`) manda: apagado por defecto, no se prende sin reglamento, y un gimnasio que ya lo tenía encendido sigue encendido (la migración no toca su valor). Cerrado, el QR y el link dicen "Hoy no te podés anotar desde acá" y dan el WhatsApp de la página (si no hay, "pasá por el gimnasio"). **El plan sugerido no va dentro del QR** sino en la base (`alta_plan_sugerido_id`): el dueño lo cambia sin reimprimir; se ignora si el plan se dio de baja o se ocultó. Elegir plan no da acceso: el alta es la de siempre (socio sin cobertura, la puerta dice que debe, aviso en Prospectos). Quién cambia qué: el interruptor y el plan sugerido, solo el dueño; el encargado ve el cartel y el link; la recepción no abre los carteles. Mismo anti-robot y mismo tope que el resto del formulario (ya enganchado en `acciones.ts`). El mensaje de WhatsApp es `wa.me/?text=` sin número (el dueño elige a quién se lo manda). Sin QR de pared fijo: sigue valiendo lo decidido en C4 (este QR no abre la puerta, solo anota).
- (11/11, decidido por defecto) **C10, quién carga pagos pasados:** solo dueño y encargado, en la base (`alta_socio_pasado` e `importar_socios` piden esos dos roles) y en la pantalla (la sección "Alta en el pasado" no aparece para la recepción). La recepción no: es plata con fecha distinta a la de hoy, y es la opción más segura. Si Mateo quiere que la recepción también cargue altas viejas, es un cambio de permisos aparte.
- (11/11, decidido por defecto) **C10, efectivo del pasado:** se puede cargar un pago en efectivo con fecha pasada. Nunca toca una caja: queda sin turno (`pagos.turno_caja_id` nulo, y una restricción impide ponerle turno a un pago "cargado después"), así el esperado de la caja de hoy no cambia. Para eso `pagos_check1` ("efectivo necesita turno") se reemplazó por `pagos_efectivo_con_turno`, que lo permite solo si el pago está marcado `cargado_despues_en`. Un pago de hoy no se carga acá: se cobra desde Cobrar.
- (11/11, decidido por defecto) **C10, qué es la "carga inicial":** el primer mes de vida del gimnasio (`gimnasios.creado_en` + 1 mes, medido al cargar). Cada pago cargado en ese lapso queda con `ventas.carga_inicial` y no dispara el aviso de la campana "Cobro cargado con fecha del ..." (VD-10); sigue en Control. Pasado el mes, la misma carga avisa al dueño (si la hace otra persona; la propia no se avisa a sí mismo, como ya era).
- (11/11, decidido por defecto) **C10, un plan por socio y hasta 3 pagos por fila en el Excel:** los pagos pasados son cuotas del plan de su membresía (una cuota por pago, o N cuotas iguales si se indica); no se cargan cambios de plan del pasado. El Excel admite 3 grupos de columnas (fecha, monto, medio); el alta de a uno, hasta 24 pagos. Sin fecha de alta, el alta es el día del primer pago. "Pagó hasta" y los pagos pasados no se mezclan en una fila. El medio es obligatorio (efectivo, transferencia, débito o crédito): no se supone.
- (11/11, decidido por defecto) **C10, deshacer una importación con pagos:** no se puede (la plata no se borra). El mensaje manda a anular esa venta desde la ficha del socio; los socios sin pagos se siguen deshaciendo en 24 horas.

## 11/11 · H7, los [ROTO] de PULIDO (permisos y plata: no se arreglan solos)
- (11/11, decidido por defecto, **sin arreglar**) **El soporte se reconoce por el nombre "Soporte BRIK"** (`app/panel/layout.tsx`: `panel.yo.nombre === "Soporte BRIK"`). Un empleado anotado con ese nombre queda afuera de su propio panel (lo redirige al super admin) y, al revés, quien se ponga ese nombre se hace pasar por soporte. Toca permisos: no se tocó. **Opción más segura:** columna `equipo.es_soporte boolean not null default false`, que la pone solo `entrar_como_soporte` (lista blanca y `PERMISOS.md`), y que el panel lea eso; mientras tanto, que el alta de equipo rechace el nombre "Soporte BRIK". Necesita migración.
- (11/11, decidido por defecto, **sin arreglar**) **Exportar socios ignora los filtros de estado, plan y web** (`exportar_socios(uuid, text, uuid)` solo filtra por texto y etiqueta; `buscar_socios` topa en 100 filas, así que no se puede cruzar en el servidor de la app). **Opción más segura:** nueva versión de `exportar_socios` con `p_estado`, `p_plan`, `p_origen` (misma regla que `buscar_socios`, el estado sale de `calcular_acceso`, la vieja se borra en la misma migración). Mientras tanto el botón dice "Exportar todos los socios" cuando hay un filtro puesto, así nadie cree que bajó solo lo que ve. Necesita migración.
- (11/11, decidido por defecto) **Cambiar un rol pide confirmación siempre** (antes solo para dueño): dice de qué rol a qué rol y si empieza o deja de ver la plata. No cambia quién puede cambiar roles (lo sigue decidiendo la base); es solo la pantalla.
- (11/11, **pregunta abierta**) **Gastos:** "Quitar" un gasto y "Dejar de repetir" un fijo se hacen de un toque y sin Deshacer (`gastos/Formularios.tsx:67-68,80-81`), y `crearPlan` crea el plan y el precio antes de validar la matrícula (`planes/acciones.ts:25-29`). Tocan plata: no se tocaron. **Opción más segura:** confirmar con el monto a la vista y Deshacer por 10 s; validar la matrícula antes de crear.
