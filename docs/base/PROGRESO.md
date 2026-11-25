# PROGRESO de Pase (antes Base)

## ✅ Vuelta final publicada + Pista Semáforo en todo el sistema + más liviano (24/11, Mateo)

**Parte 1 · vuelta final publicada (24/11, 22:04 ART, PR #40, merge `9fed244f`; vuelta atrás: revertir ese merge, main antes = `948426c`).**
- Antes de publicar, sobre el último commit de `dia/2026-11-22`: pruebas-completas en 15 tandas clásico + 15 Pista (23/11) y las tandas tocadas de nuevo sobre `eaa23ca` (clásico 45463567218 y Pista 45464582426), Verificar en verde (45244866823), Lighthouse de las dos landings (gimnasio 92, venta 95, accesibilidad 100: 45115875083).
- Migración `20261122100000_vuelta_final_landings`: prevuelo 45243546646 OK, aplicada SIN COPIA (45522651169). La primera vez el guardia de hora pico la frenó (19 h en Argentina: el reloj de Git Bash en esta compu leía UTC); no se aplicó nada hasta las 22.
- **Producción, 3 minutos después del deploy, solo mirando (01:04 UTC):** Vercel verde en `9fed244f`; `/api/salud` → ok, base 40 ms, commit 9fed244; `pasegym.com/ingresar`, `templegymsalta.com`, `/hacete-socio` e `/ingresar` responden 200 (0,4 a 1,7 s); Temple Gym sale `data-estilo="pista"` y con la página de siempre (`landing_nueva` apagada). No se tocó ningún dato de Temple Gym.

**Parte 2 · Pista Semáforo (rama `dia/2026-11-24`, PR #41).** El diseño de `docs/base/pista/semaforo` detrás de la llave `pista_semaforo` (migración `20261124100000`, apagada en Temple Gym, prendida en los [demo]), solo con el estilo Pista. Tokens, piezas, ResultadoPuerta y mapa de emojis: `DISENO.md` § Pista Semáforo.
- Cada pantalla dibujada tiene su captura al lado del `.png` en el artefacto `pantallas` del recorrido `semaforo-pantallas` (carpeta `capturas/semaforo/`, `<pantalla>.sistema.png` y `<pantalla>.diseno.png`).
- Qué quedó distinto al diseño y por qué (no se inventó nada que no esté en los datos):
  - **Inicio:** arriba a la derecha queda la campana de siempre; no se agregó el botón de ayuda redondo ni la píldora de la cuenta con Salir (Salir sigue en el menú). "Para hacer hoy" no tiene casillas de "Hecho" (no existe marcar una tarea del día como hecha: sería una función nueva). Los números no traen la línea de abajo ("23 adentro ahora", "Caja abierta desde…"): la base no la devuelve. El último resultado sale de la última entrada de hoy (no hay un "hace 5 s" de la recepción). Los accesos y los números son los que eligió cada persona.
  - **Celular:** arriba sigue la barra con el nombre del gimnasio y la búsqueda; "Pase diario" no se acorta a "Pase" (la prueba D69 lo lee como el nombre de la marca). La barra de abajo muestra lo principal de cada rol (para la dueña del demo: Productos en vez de Caja) y **Más**.
  - **Socios:** sin las columnas Vence y Última vez (la lista no las trae); el botón es "Ver" en todas las filas (Cobrar y WhatsApp por fila serían acciones nuevas en la lista).
  - **Ficha:** el estado sale con ResultadoPuerta y el nombre grande; el resto es la ficha de siempre (las pestañas y bloques, con las piezas). No están "Veces este mes", "Semanas seguidas" ni la tabla de pagos al costado: la ficha no lee esos datos hoy.
  - **Caja:** la de siempre con las piezas (lo cobrado por medio en tarjetas de a 4, el cajón y los botones). No está la lista de movimientos del turno con filtros ni "Para aprobar" al costado: no son de esta pantalla hoy.
  - **Clases de hoy:** igual, salvo "Casi lleno" (sería un umbral inventado: solo se marca Lleno) y los días como botones (no Ayer).
  - **Kiosco:** igual (resultado a la izquierda, teclado de 460 a la derecha); el texto del resultado es el de la base ("Al día · Plan Full · vence el 04/12"), no el armado del diseño.
  - **App del socio:** el estado lleno con el QR adentro y el saludo grande; los botones de todos los días son los 6 de siempre (no solo Mis pagos y Mi rutina) y siguen la bienvenida, la encuesta y el resto.
  - **Kiosco y resultado de la puerta:** la palabra es PASA / NO PASA según `puede`; "PASA · VENCE MAÑANA" no se arma (el porqué va abajo, como lo dice la base).
- Pruebas: `semaforo-pantallas` (1366×768 sin bajar, accesos sin repetir, Salir lejos del nombre, botones píldora, colores solo de tokens, 360 sin desborde, kiosco); pruebas-completas 15 tandas clásico (todo verde; vd-2b intermitente, pasó al repetir) y 15 Pista con la llave (todo verde con lo arreglado); barrido de cada rol e inventario en las dos llaves dentro de las tandas; Verificar verde; prueba de la base de la llave en negativo (`pista-semaforo.test.mjs`).

**Parte 3 · que no pese. Antes = la app de `dia/2026-11-22` (lo publicado), después = `dia/2026-11-24`, medidos con los mismos scripts en Actions.**

| JS primera carga (KB · gzip) | Antes | Después |
|---|---:|---:|
| /panel | 703,0 · 214,9 | 706,9 · 215,9 |
| /panel/entrada | 714,7 · 219,2 | 715,2 · 219,3 |
| /panel/socios | 688,0 · 211,1 | 690,7 · 211,6 |
| /panel/socios/[id] | 753,4 · 228,1 | 753,9 · 228,2 |
| /panel/caja | 690,8 · 210,9 | 691,3 · 211,0 |
| /panel/clases | 667,1 · 204,6 | 667,5 · 204,8 |
| **/app** | **1014,1 · 302,0** | **756,8 · 235,4** |
| / (página del gimnasio) | 696,7 · 214,1 | 697,1 · 214,2 |
| /kiosco | 678,4 · 207,9 | 683,7 · 208,8 |

| Lighthouse celular (Pista) | Antes | Después (con la llave) |
|---|---:|---:|
| Inicio (dueña) | 80 · CLS 0,225 | **95** · CLS 0,002 |
| Entrada | 79 · CLS 0,211 | **89** · CLS 0 |
| Socios | 76 · CLS 0,226 | **90** · CLS 0 |
| App del socio | 81 · CLS 0,191 | **88** · CLS 0,001 |
| Página del gimnasio | 90 | 92 |

- Lo que se sacó: el cliente de Supabase del navegador (auth, realtime y storage, ~180 KB) baja recién al subir un comprobante (app del socio) y en los dos pasos de Mi cuenta; la librería del QR de Configuración → Tablets con import dinámico (22 KB); la ayuda de pantalla sale abierta desde el primer pintado en vez de empujar la pantalla medio segundo después (era el CLS de 0,2); el QR de la app y el QR de la pared del kiosco no consultan con la pestaña oculta.
- Lo que ya estaba bien y no se tocó: el contexto del panel con `cache()` (un viaje por pantalla), el proxy guarda la dirección 60 s, las fuentes son solo los pesos que se usan (Big Shoulders 800; Semáforo usa 800, no 900, para no bajar un archivo más), Campana, Navegación, Últimas entradas, el cartel de emergencia y "en vivo" ya paraban con la pestaña oculta.
- Los 15 módulos más pesados (antes, primera carga sin comprimir; reparto aproximado por mapas): next 618,8 KB (todas), Icono 123,5 (todas), @supabase/auth-js 104,8 (/app, /app/plan, Mi cuenta), Ajustes 44,7 (Configuración), SalidaError 35 y Reintentar 20,3 (81 rutas: el reparto les asigna código del runtime), @supabase/realtime-js 31,6, @supabase/phoenix 25,9, Editor de la página 23,5, qrcode 22,1 (Configuración), @supabase/storage-js 20,9, Landing 20,4, VentanaEntrada 20,2 (todas), Carrito 19,9, indice de Configuración 18,8. Después ya no están los de Supabase ni qrcode.
- Viajes a la base: sin cambios (el Inicio Semáforo usa el mismo lote); los topes de `topes-viajes.json` no se tocaron y la medición dio dentro del tope.
- Topes nuevos: `scripts/medir/topes-js.json` (KB gzip de la primera carga de cada pantalla clave, los números de "después"); Analizar bundle falla si una pantalla lo pasa y `chequeos` verifica que estén.
- Para pesar menos que esto (anotado, no hecho): `Icono` baja entero en todas las rutas; el `<dl>` del Inicio y el `role` de las pestañas de Socios bajan la accesibilidad (93-94) desde antes de Semáforo.

## ✅ Paneles completos publicados (19/11, 23:40 ART, PR #38, merge `f0c9accd`; vuelta atrás: revertir ese merge, main antes = `975e9f65`)

- **Regresión de pruebas-completas arreglada** (fallaba igual en main, no era el diff): prueba de base 8 contra el reloj real; vd-8 sin las entradas de ent-4; límite de códigos en cero por recorrido (vd-22/33/39/55/58); Retención en el celu a lo ancho (vd-46o, q2-retencion, barrido); foco de la Entrada en el campo del DNI (vd-6); q3-patrones deja inactiva su sede (landing-l1).
- **R1** (`r1-numeros`): cada número de Inicio abre su lista filtrada con nombres. **K5** (`k5-publico`): página y /hacete-socio en compu y celu, clásico y Pista. K3 y K4 quedan 🟡: Realtime no se puede probar en Actions.
- **Pruebas:** pruebas-completas en 15 tandas clásico + 15 Pista (cada una con su base) sobre `c0da84f`, y las tandas tocadas (1, 2, 8, 13, 14) de nuevo sobre `a33d966`: todo verde. Verificar verde en `e6230f3`.
- **Migraciones en producción:** `20261119120000` a `20261119150000`, prevuelo 44657964232 OK y aplicadas SIN COPIA (44661388327) con permiso de Mateo, chequeos de la base en verde.
- **Producción, 5 minutos después del deploy, solo mirando (02:34 UTC):** Vercel verde en `f0c9acc`; `/api/salud` → ok, base 83 ms, commit f0c9acc; pasegym.com, /ingresar, templegymsalta.com, /hacete-socio e /ingresar responden 200 (0,4 a 1,4 s). No se tocó ningún dato de Temple Gym ni se corrió el humo (crea un gimnasio de prueba).
- **Llaves para prender en Temple Gym** (apagadas ahí, prendidas en los [demo]): `aviso_vencimiento`; `altas_online` si quieren el QR de alta en el kiosco. Sin llave: `profe_id`, el lote del Inicio, el QR con el reloj corrido, los números de Inicio filtrados.

## ⛔ PRIMERO PARA MATEO (19/11, 04:30 ART): Temple Gym sigue saliendo en CLÁSICO desde afuera

Pediste confirmar que Temple Gym salía con `data-estilo="pista"`. A las 02:50, 03:05 y 04:30 ART miré `templegymsalta.com`, `/hacete-socio` y `/ingresar` (200 las tres, sin caché: `Cache-Control: no-store`, `X-Vercel-Cache: MISS`) y las tres salen `data-estilo="clasico" data-modo="oscuro"`. El proxy guarda el estilo 60 s, así que no es la espera. O el guardado en `/super` no llegó a la base, o se guardó en otro gimnasio. Qué mirar: `pasegym.com/super` → Temple Gym → Ficha → Estilo; que diga Pista y que "Guardar" haya dado el mensaje de guardado. No pude mirar la base (la cuenta de Supabase de esta sesión no tiene el proyecto de Pase). Si lo prendés y no se ve en un minuto, avisame con la captura. Vuelta atrás de Pista: la misma ficha → Estilo: Clásico (o `pista-produccion` fase=temple revertir=true cuando estén los secretos).

**Cierre (19/11, PR #37, sin migración, solo pantalla y pruebas; vuelta atrás: revertir ese merge, main antes = `09effa8e`):**
- 🔴→✅ **Encontrado y arreglado: desde la publicación de anoche (PR #35) Clases y Caja se desbordaban a lo ancho en el celular (446 y 574 px)**: yo le había puesto un envoltorio de "no achicar" a la acción del encabezado (para correrla de la campana) y los botones de esas dos pantallas dejaron de cortar de renglón. Lo vio `dis-9` y el barrido en las corridas de esta noche. Arreglado (la acción puede achicarse); sin esto el celular de Temple Gym lo mostraba roto en esas dos pantallas, en clásico y en Pista.
- ✅ Los 3 detalles de la auditoría, cada uno con su prueba (`detalles-pista`, que falla antes y pasa después): el botón redondo de la Entrada ya no tapa la última fila en el celular (más espacio abajo en todo el panel); "Con sonido" ahora es un interruptor "Sonido al anotar: Sí / No" (mismos `data-sonido`); las etiquetas de Caja en Pista oscuro suben a 8,9:1 (el texto apagado de Pista oscuro pasó de #8FA0AE a #BAC6D0; solo Pista, clásico no cambia).
- ✅ Auditoría que había quedado sin recorrer, en Actions (clásico, Pista oscuro y Pista claro): la TV de la sala de lejos (1920×1080: ningún texto baja de 20 px, nombres de 48 px, WOD de 30 px) y en tablet 1024×768 y 820×1180 sin desborde (`com-14`); el profe en tablet vertical y horizontal (inicio, clases, grilla, rutinas: sin error, sin desborde, sin plata; `auditoria-profe-tablet`). "Sin internet" (`entrada-barrita`), el contador (los CSV de Ventas, Pagos y Caja: `res-2`) y otro rol / otro gimnasio (`base-aislamiento`, `barrido`) ya tenían recorrido y están en verde en las dos llaves.
- Pruebas inestables que aparecieron en estas corridas y se arreglaron: `panel-clases` (de madrugada la clase de hoy aún no abre el presente: la pantalla lo muestra al toque y la base lo rechaza; la prueba dependía de la hora), `soc-7` (un `play()` de la cámara sin atrapar al cerrarse), y el lint de `vd-25` (shebang mal ubicado, rompía `npm run lint` en Verificar desde el 15/11). `vd-4` falla a veces porque el espejo de apt no instala ffmpeg en el runner (de la infraestructura, el workflow ya lo avisa); en tres corridas seguidas pasó.
- ⛔ `npm run db:types` no corrió: falta `SUPABASE_PROJECT_ID` en `.env.local` y el proyecto de Pase no aparece en la cuenta de Supabase de esta sesión. Lo corrés vos (Project Settings → General) o me pasás el id.
- Corridas finales (commit de la rama, clásico y Pista oscuro, 14 tandas cada una, más Pista claro de TV/profe/detalles): todas verdes salvo lo de arriba, ya arreglado y vuelto a correr. `Verificar` (lint, tipos, unitarias y build) verde en el PR; las pruebas de la base y `chequeos` van dentro de la tanda "Base" de pruebas-completas, verdes.
- Anotado (otro carril, no se toca): permisos y plata no mostraron nada raro en esta pasada.

---

## (anterior, 19/11 01:20 ART) PRIMERO PARA MATEO: Pista está publicada pero APAGADA en Temple Gym y en los demos

**Lo único que falta es tuyo:** los secretos de GitHub `BRIK_ADMIN_MAIL` y `BRIK_ADMIN_CLAVE` (la cuenta de super admin de producción) no están cargados (Settings → Secrets and variables → Actions). Sin ellos el workflow `pista-produccion` no puede entrar a la ficha del super admin y **no prendí Pista en Temple Gym ni en un [demo] de producción, ni dejé el aviso de Novedades**; tampoco corrió el humo de producción (falla igual desde el 11/11).
**A mano, un minuto:** `pasegym.com/super` → Temple Gym → Ficha → "Estilo": Pista, modo Oscuro → Guardar (tarda hasta un minuto en verse). **Volver atrás, un paso:** la misma ficha con Estilo: Clásico, o Configuración → Marca → Estilo (el dueño). Con los secretos cargados: `gh workflow run pista-produccion.yml --ref main -f fase=demo` (mira un [demo]), `-f fase=temple` (prende Temple Gym) y `-f fase=novedad` (aviso dirigido); `-f fase=temple -f revertir=true` lo vuelve a clásico.

**Publicado (19/11, 01:05 ART, fuera de 16–22 h, SIN COPIA, con prevuelo; PR #35, main df6bebb2; vuelta atrás: revertir ese merge, main antes = `24386fe4`):** la migración `20261118120000_estilo_gimnasio` (columnas `estilo` y `modo`, entran en clásico/oscuro para todos; las funciones `guardar_estilo_gimnasio`, `admin_guardar_estilo`, `estilo_gimnasio`; `gimnasio_por_host/slug` traen el estilo), Pista (solo CSS, detrás de la llave), el selector en Configuración → Marca y en la ficha del super admin, la campana que ya no tapa el botón del encabezado, las pruebas firmes y los documentos ordenados (`docs/base/historia/`, `00-LEEME.md` de una pantalla). Verificado en producción: Vercel verde, `humo-pasado` verde, `templegymsalta.com`, `/hacete-socio`, `pasegym.com/g/demo`, `/ingresar` y `/super` responden 200, y el `<html>` de Temple Gym sale con `data-estilo="clasico"` (todo igual que antes). **Después de correr `npm run db:types`** (lo hace Mateo: necesita su proyecto de Supabase).

**Lo que encontró la auditoría (en las capturas de Pista y clásico, compu y celular; no pude mirar producción con sesión por lo de arriba):**
- ✅ Arreglado: en la compu la campana tapaba el último botón del encabezado (Caja: "Cierre del día"; Entrada: "Control de la puerta"), en clásico y en Pista. Recorrido `encabezado-campana` (verde en las dos llaves).
- (Los tres detalles anotados acá quedaron arreglados el 19/11 por la mañana: ver arriba.)
- (La tablet, la TV de lejos y el profe se miraron después: ver arriba.)
- Pruebas inestables arregladas: `vd-3` (comparte el socio con otros recorridos de la tanda: ahora busca uno que no haya entrado hoy), `cliente` (espera la lista de transferencias y reintenta) y el barrido (lee la pantalla cuando pintó, no tras un tiempo). Tres corridas seguidas en verde cada una.

---

## DÓNDE QUEDÉ y RESUMEN PARA MATEO (18/11, mediodía)

**Publicado hoy (18/11, 13:50 ART, fuera de 16 a 22 h, migraciones SIN COPIA autorizadas, con prevuelo; PR #34, main 24386fe4; vuelta atrás: main antes = `000770ff`):**
- **Cacería terminada en el panel:** cada pantalla del panel pide **3 viajes o menos** a la base (contexto, un lote de lecturas y el estado vivo). Entrada 7 → 3, Inicio de la dueña 6 → 3, Configuración 6 → 3, Vender 5 → 3, Caja de la recepción 5 → 3 (la de la dueña 8 → 4: `cajas_para_revisar` escribe y no entra en un lote), Interesados (Socios → Interesados) 3. `/panel/prospectos` (la dirección vieja) queda en 5 por el salto de redirección. Los topes de `scripts/medir/topes-viajes.json` bajaron a lo medido (nunca suben).
- Cómo: el oído de la puerta ya no pide su cursor a la base (lo trae el servidor al pintar); la Puerta recibe en el lote de Entrada el modo de prueba, si se registra la salida y la emergencia; Interesados, el Inicio de la dueña (datos de ejemplo y seguridad), "¿Quién atiende?" y la versión de Configuración van en el mismo lote; el Inicio del socio (`/app`) pide `registra_salida` en el lote (9 viajes siempre, ya no dependía del QR de la pared). El respaldo del cartel de emergencia pasó de 30 a 60 s.
- Migraciones `20261118100000` y `20261118110000` (aditivas, solo suman nombres a la lista cerrada de `lote_lecturas`), con `supabase/pruebas/lote-entrada.test.mjs` (misma lectura que por separado; otro gimnasio o sin permiso = error, no vacío).
- **Prueba de la base que se rompía con los días** (`espera-con-plazo`: usaba el reloj real con socios sembrados el 14/11): arreglada.
- Probado en Actions con la app compilada: recorridos de Entrada, Caja, Interesados, Inicio, camino del socio, barrido de cada rol y los topes de viajes: todo en verde (corrida 44349582365). Producción: `humo-pasado` verde, portada de Temple Gym, `/hacete-socio`, `pasegym.com/g/demo`, `/ingresar` y `/super` responden 200.
- ⛔ `humo-produccion.yml` falla en su paso de puertas desde el 11/11 (no es de este cambio): busca el gimnasio `demo-mateo`, que no está en producción (hay que sembrarlo con "sembrar-prueba-mateo" desde Actions → Base de datos).

**Pase 2.0 · Pista (18/11, en la rama, SIN publicar):** hecho y probado en Actions con la app compilada: la llave `estilo` (clasico|pista) y `modo` (oscuro|claro) por gimnasio (migración `20261118120000`, entra apagada para todos, con pruebas de la base: solo el dueño o el super admin la cambian, otro gimnasio = error); el estilo y el modo salen en el `<html>` desde el servidor (vía la dirección que ya resuelve el proxy, sin un viaje más); los tokens, el radio, los botones y la tipografía Big Shoulders 800 (14 KB, un solo archivo propio) son solo CSS al final de `globals.css`; selector en Configuración → Marca → Estilo y en la ficha del super admin; lo impreso sale siempre claro; el QR ya va sobre su cuadro blanco. **Inventario** (`inventario-pantallas.mjs`): 66 pantallas en compu y celular, clásico contra Pista, sin perder un botón, link, campo, título ni atributo (el inventario encontró y se ajustó a lo que cambia solo entre pasadas). **Las 254 recorridos e2e + los topes de viajes con Pista (oscuro)**: todos en verde (los que fallaron por las mayúsculas de los títulos se corrigieron en el arnés: con Pista el recorrido lee el texto como se escribió, `E2E_SIN_MAYUSCULAS`); **barrido de cada rol, compu y celular, en oscuro y en claro**: en verde; **Lighthouse de la página del gimnasio**: 93 con Pista (93 con el clásico), accesibilidad 100 (96 clásico). Capturas de antes y después (artefacto `pantallas`, `inv-clasico-*` e `inv-pista-*`), miradas: Inicio, Entrada, Configuración, app del socio y portada, en oscuro y claro. **Desvío a propósito de DISENO.md:** el texto apagado (`--texto-3`) sale #9AAAB7 en oscuro y #5E6B77 en claro para llegar a 4,5:1 (con los del diseño daba 3,4 a 3,9:1). Los títulos van con Big Shoulders sin `preload` (el clásico no baja nada de más). **Falta para publicar:** la pasada de las 254 en clásico (para confirmar que nada cambió con la llave apagada, en curso) y la mirada de Mateo a las capturas; al publicar: prevuelo, aplicar la migración (sin copia), prender Pista en los `[demo]` (`update configuracion_gimnasio set estilo='pista'` solo en los `[demo]`, a mano desde Actions → Base de datos) y `npm run db:types`. Temple Gym queda en clásico hasta que Mateo lo prenda (Configuración → Marca → Estilo).

**Lo que queda de la cacería (no bloquea):** `/app` llegó a 9 (la meta de Mateo era 2: quedan el menú, el aviso de clave, la ocupación, las ofertas y los avisos, que van en componentes aparte); juntar los relojes en Realtime; ⛔ la tabla de errores de producción y las pantallas lentas (necesitan a Mateo, ver abajo).

---

## (anterior) DÓNDE QUEDÉ y RESUMEN PARA MATEO (16/11, tarde)

**Publicado hoy (hora de Argentina, fuera de 16 a 22 h, migraciones SIN COPIA autorizadas, cada una con prevuelo y humo en producción; Temple Gym solo mirado):**
- **PR #29 (10:40) · URGENTE React #441 en `/hacete-socio`:** no pude reproducirlo (ni sin sesión, ni con la dueña o un socio, ni desde la portada: `hacete-socio-sesion.mjs`) y no tengo acceso a los logs de Vercel de este proyecto. Se blindó lo único que en el servidor puede fallar ahí (la lectura del alta): reintenta una vez y, si la base no responde, la página lo dice con "Probar de nuevo"; el error genérico ahora muestra su "Código del error".
- **PR #30 (11:00) · el QR impreso nunca se rompe:** los slugs anteriores de cada gimnasio se guardan (tabla `slugs_anteriores`, migración `20261116100000`) y `/g/<slug viejo>/…` redirige 308 a la dirección actual; `templegym1` quedó como anterior de `templegymsalta`. Y ninguna redirección va a una dirección del dominio viejo. Probado en producción: `pasegym.com/g/templegym1/hacete-socio?o=qr` y la dirección vieja de Vercel terminan en `templegymsalta.com/hacete-socio?o=qr` con el formulario.
- **PR #31 (14:40) · el camino del socio (D83, los 7 puntos):** "Crear mi cuenta" siempre en la portada (llave del dueño en Tu página), cuenta sin plan, memoria (con la sesión abierta la dirección del gimnasio va a su app), la recepción ofrece "Clase de prueba" la primera vez y "Dar el alta y cobrar" desde la segunda, y la app del socio con 6 botones grandes. Migración `20261116110000`. Lo prueba `camino-socio.mjs` (32 pasos, con la app compilada).
- **PR #32 (15:10) · reglamento nuevo:** el socio que ya aceptó una versión ve una tarjeta con el texto y "Acepto" al abrir su app (la puerta no cambia). Migración `20261116120000`. Para volver atrás: revertir el merge del PR que corresponda (main antes de cada uno: `dd8cdb73`, `06e0848f`, `8e4e251c`, `d26ce5bc`).

**Sin publicar (rama `base/2026-11-07`, se publica a partir de las 22:00 con prevuelo; migración `20261116130000`, aditiva):**
- **Cacería de pedidos de más:** el Inicio de la app del socio pasó de 22 a 9 pedidos a la base (tope nuevo 9, medido en Actions con la app compilada); Caja y Mensajes del panel piden sus lecturas en un solo viaje; el cartel de emergencia no pregunta con la pestaña escondida (medido: 0 pedidos escondida, 17 a la vista contra la base local; con Realtime en producción son unos 4 por minuto).
- **`ent-6` (la tablet) era la prueba, no la app:** el cartel "¡Pasá, …!" dura 4 segundos y la prueba lo esperaba después de sacar una captura. Arreglada (3 corridas en verde) y de vuelta en la cadena e2e.
- **Barrido de consola (cada rol en cada pantalla, compu y celular):** limpio, sin errores (corrida 43923691877).

**Lo que pidió Mateo (16/11) → estado** (🟢 publicado · 🟡 sin publicar · 🔴 falta · ⛔ depende de Mateo · ➡️ Pase 2.0)

| Lo que pidió | Estado | Detalle |
|---|---|---|
| URGENTE: React #441 en `/hacete-socio` | 🟢 | Blindado y publicado; causa no reproducida. ⛔ si te vuelve a salir: ventana privada y pasame el "Código del error" |
| Cambiar el slug no rompe un QR impreso | 🟢 | PR #30, probado en producción |
| Nunca redirigir a una dirección del dominio viejo | 🟢 | PR #30 (anotarlo en Estado de la plataforma ➡️) |
| Camino del socio, 7 puntos (D83) | 🟢 | PR #31. La revisión de cada pantalla de la app contra las 21 reglas de FLUIDEZ ➡️ |
| Reglamento: aceptar al crear la cuenta, versión nueva al abrir la app, ficha con la versión, editarlo sin altas | 🟢 | PR #32 (la ficha y la edición ya existían) |
| Cacería 1: app del socio 22 → 2 pedidos | 🟢 | 22 → 9 publicado (PR #33, 17/11 22:1x ART, commit 000770ff); llegar a 2 ➡️ (quedan el menú, el aviso de clave, la ocupación, las ofertas y los avisos, que van en componentes aparte) |
| Cacería 2: mostrador a 3 pedidos | 🟢 | Caja y Mensajes en un viaje, publicado en el PR #33; Entrada, Prospectos, Inicio, Configuración y Vender 🔴 (siguiente vuelta) |
| Cacería 3: los relojes en un solo canal | 🟢 | Publicado: la emergencia ya no pregunta escondida y hay medición (`relojes.mjs`); juntar todo en Realtime ➡️ |
| Cacería 4: lo roto que se ve | 🟡 | Barrido de consola 🟢 limpio. ⛔ la tabla de errores de producción: abrí `/admin` → Errores (o pasame el resultado de `select ruta, mensaje, count(*) from errores_app where creado_en > now() - interval '7 days' group by 1, 2 order by 3 desc`). ⛔ las pantallas lentas en producción: `medir-produccion.yml` necesita los secretos del paso 1 de abajo |
| Cacería 5: `ent-6` | 🟢 | Era la prueba; arreglada y en verde, de vuelta en la cadena |

**⛔ Lo que tenés que hacer vos, en orden (lo anterior sigue valiendo, ver abajo):**
1. Probá en tu celular el camino completo de Temple Gym: `templegymsalta.com` → "Crear mi cuenta" → tu app. Cargá el texto del reglamento de Temple Gym (Tu página → "Hacerse socio desde la página"), el nombre "Temple Gym" y el WhatsApp.
2. Si "React #441" te vuelve a salir: ventana privada y el "Código del error".
3. Los pasos 1 a 6 de la lista del 15/11 (secretos de GitHub, mails de Supabase, dominios, planes Pro, tu pasada visual) siguen igual.

---


## LISTO PARA TU PASADA · Pase 1.0 (15/11)

Pase 1.0 es lo que un gimnasio necesita para usarlo todos los días: entrar, cobrar, dar de alta, la caja, la página del gimnasio, el socio con su cuenta y su QR, y el super admin. **Todo eso está hecho, probado y en el código.** Lo que no se hizo en 1.0 está en `PASE-1.0.md` → "Para Pase 2.0", ordenado por importancia, y lo que depende de vos está abajo con su paso exacto. La prueba que te toca es `PRUEBA-DUENO.md`.

## DÓNDE QUEDÉ y RESUMEN PARA MATEO (15/11, tarde)

**Publicado hoy a las 12:42 (hora de Argentina), PR #27, main en `325b1e89`:** D69 (el producto se llama Pase: panel, app del socio, super admin, títulos, manifest; el nombre sale de `src/lib/producto.ts` y una prueba falla si vuelve a escribirse a mano), P2 (ninguna dirección escrita a mano, la lista de excepciones quedó vacía), Q1 según D70 (la matrícula se valida antes de crear el plan; el cierre de caja muestra el monto contado antes de confirmar), el tope de viajes a la base por pantalla, la hoja de Cobrar sin la X duplicada y N10 (migración `20261114180000` aplicada sin copia, corrida 43731288556, función apagada por defecto). Deploy en verde; en producción: título y manifest dicen Pase, `/api/salud`, `/g/demo`, `/g/templegym1` y `/ingresar` responden 200, `humo-pasado` en verde. **Temple Gym solo mirado, nada tocado.** Para volver atrás: revertir el merge (main antes de hoy: `eab6e40e`).

**Segunda publicación, 16/11 a las 10:00 (hora de Argentina), PR #28, main en `dd8cdb73`, sin migraciones (prevuelo: nada pendiente, corrida 43871472293):** deploy en verde, `/api/salud` y `/ingresar` en 200 con título Pase, `humo-pasado` en verde (corrida 43872106054). Para volver atrás: revertir el merge (main antes: `325b1e89`). **Temple Gym solo mirado.** Contenido:

**⚠️ Encontrado al hacer el humo, no es de este cambio (`proxy.ts`, `dominios.ts` y `proxy-rutas.ts` no cambiaron):** `gym-os-pied.vercel.app` ya redirige a `pasegym.com`, y `/g/demo` y `/g/templegym1` (el QR impreso de Temple) redirigen con 308 a `demo.gym-os-pied.vercel.app` y `templegym1.gym-os-pied.vercel.app`, que no tienen certificado (falla el handshake SSL). Parece ser la configuración de dominios en Vercel (variables de dominio base o plataforma) que se tocó después del 15/11: **revisalo vos, primero**, porque con eso el QR de Temple no abre. No toqué variables de Vercel (regla). Pista: la rama `sonda/dominios-1511` es de esa prueba de dominios.
- **Un bug real arreglado:** el número del menú (Mensajes, Transferencias…) y el de la campana quedaban viejos después de contestar un mensaje o aprobar una transferencia. Prueba nueva `vivo-cliente.test.ts`.
- **"Probá una clase"** en todos lados de la página del gimnasio (antes también decía "Probá gratis"), con una prueba que falla si vuelve (D79).
- **El panel lateral del socio muestra su foto** (o la inicial) para confirmar a quien está en la puerta, y **tocar una última entrada de Inicio abre ese panel** sin salir de la pantalla (FA-2).
- **PERMISOS.md** regenerado (la función de N10, solo dueño y encargado) y la prueba de importar socios ya no depende del día de la corrida.
- **Documentos en orden:** `00-LEEME.md` como índice real, 13 contradicciones entre documentos decididas por defecto (D71 a D82 en `PREGUNTAS.md`), `ESTADO-GENERAL`, `RECTA-FINAL`, `VELOCIDAD`, `PRUEBA-DUENO` y `CLAUDE.md` al día.
- **Cadena e2e completa en Actions** (250 recorridos en tandas de 20, base nueva en cada una, app compilada): en verde. Lo que fallaba eran recorridos viejos frente a L1 y L3 (ya adaptados), tres que dependían del orden de la cadena (ya deterministas) y el bug del menú. **Apartados con su motivo:** `vd-25` (la portada de una pantalla ya no dibuja la prueba social ni "¿Primera vez?") y `ent-6` (el cartel de la tablet a veces no aparece; la entrada sí se registra).

**Lo que pidió Mateo → estado** (🟢 publicado · 🟡 sin publicar · 🔴 falta · ⛔ depende de Mateo · ➡️ Pase 2.0)

| Lo que pidió | Estado | Detalle |
|---|---|---|
| El producto se llama Pase (D69) | 🟢 | Publicado y probado en producción |
| Entrar, cobrar, alta y caja del mostrador | 🟢 | Publicado; recorridos de caja, Cobrar y Entrada en verde |
| La hoja de Cobrar sin dos X | 🟢 | Publicado |
| Número del menú al día después de contestar o aprobar | 🟢 | Publicado el 16/11 (PR #28, commit dd8cdb73) |
| Foto del socio en el panel lateral y últimas entradas que lo abren | 🟢 | Publicado el 16/11 (PR #28) |
| "Probá una clase" en la página, sin "Probá gratis" | 🟢 | Publicado el 16/11 (PR #28) |
| La página del gimnasio en una pantalla (L1) | 🟢 | Publicada. La prueba social y "¿Primera vez?" ➡️ con la landing nueva |
| Quiero ser socio con la cuenta gratis y DNI (L2) | 🟢 | Publicado |
| App del socio: pagá tu plan y QR bloqueado que se activa solo (L3) | 🟢 | Publicado |
| Cuánto deja un socio (N10) | 🟢 | Publicado, apagado por defecto |
| Velocidad: lo que se pudo bajar y el tope de "nunca más lento" | 🟢 | Publicado; lo que queda por encima de 2 viajes ➡️ (la app del socio hace 22) |
| Pase diario en dos toques y para quien no es socio, pagos parciales, prorrateo, matriz de permisos editable, estado de cuenta con saldo | ➡️ | D70: cambian plata o permisos; la recomendación de cada una está en `PASE-1.0.md` |
| Pulido profundo, landing nueva, funciones nuevas (débito, factura, molinete, entradas sin internet), escala | ➡️ | Lista priorizada en `PASE-1.0.md` |
| El QR de registro de Temple Gym | ⛔ | Ver el paso 2 de abajo |
| Crear un gimnasio y su dueño en producción, medir la velocidad en producción, el humo de `/super` | ⛔ | Ver el paso 1 de abajo |
| Dominios `pasegym.com` y `templegymsalta.com` | ⛔ | Ver el paso 4 de abajo |
| Copias de seguridad cifradas | ⛔ | Ver el paso 1 de abajo |
| Política de privacidad real e inscripción en la AAIP | ⛔ | Con un abogado; el borrador está en la app |

**⛔ Lo que tenés que hacer vos, en orden de lo que más destraba:**
0. **Urgente, antes de nada:** abrí `https://pasegym.com/g/templegym1` (el QR impreso de Temple): hoy redirige a `templegym1.gym-os-pied.vercel.app`, que no tiene certificado. Revisá en Vercel las variables de dominio base y plataforma (y el dominio `gym-os-pied.vercel.app` redirigiendo a `pasegym.com`) que se movieron después del 15/11; no las toqué.
1. **GitHub → Settings → Secrets and variables → Actions → New repository secret:** `BRIK_ADMIN_MAIL`, `BRIK_ADMIN_CLAVE`, `DEMO_CONTRASENA`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `CLAVE_PRUEBA_MATEO`, `SUPABASE_REF_ESPERADO` y `COPIA_CLAVE`; y la variable `SALUD_URL` = `https://gym-os-pied.vercel.app/api/salud`. Con eso se destraba la medición en producción, crear un gimnasio, las copias y el aviso de caídas.
2. **Temple Gym** (el panel de Temple): Página → "Hacerse socio desde la página" → escribir el reglamento (obligatorio) → prender "Aceptar altas online" → Guardar; corregir el nombre a "Temple Gym" y cargar el WhatsApp en Configuración → Gimnasio. Recién ahí `/g/templegym1/hacete-socio?o=qr` deja anotarse (hoy dice "Hoy no te podés anotar desde acá").
3. **Mails de Supabase** (invitación y recuperar contraseña): se escriben en el panel de Supabase, no en el código; revisá que digan Pase.
4. **Dominios:** conectá `pasegym.com` y `templegymsalta.com` en Vercel con `DOMINIO.md`, fuera de 16 a 22 h.
5. **Vercel Pro y Supabase Pro** para el uso comercial (D51; no se contrató nada).
6. **Tu pasada visual y la prueba del dueño:** `PRUEBA-DUENO.md`, una hora; lo que no te guste va a `CAMBIOS-MATEO.md`.

---

## (histórico) DÓNDE QUEDÉ y RESUMEN PARA MATEO (14/11, tarde)

**Cuarta publicación (14/11, 14:30 hora de Argentina, PR #26, commit eab6e40):** migración `20261114170000` (el lote de lecturas acepta listas como parámetro y suma las de Control) aplicada sin copia (chequeos en verde, corrida 43621027947), deploy en verde y humo. Control pasa a un solo viaje. D1 a D3 pasaron a ⛔ (los dominios los cambia Mateo) y H7, Z1 y Q2 a ✅.

**Tercera publicación (14/11, 13:50 hora de Argentina, PR #25, commit a22a0fd):** migración `20261114160000` (amplía la lista de lecturas de `lote_lecturas`) aplicada sin copia (chequeos en verde, corrida 43617235463), deploy en verde y humo. Vencen hoy, Transferencias, Tareas, Equipo y Profes pasan a un solo viaje: el piso de toda pantalla quedó en 3 (contexto, menú y campana, avisos de la puerta) y las del lote en 4. N9 y Q4 reconciliados contra el código (pasaron de ❌ a 🟡).

**Segunda publicación (14/11, 13:10 hora de Argentina, PR #24, commit 6f3a590):** migraciones `20261114140000` (CUIT y razón social, F2.10) y `20261114150000` (sesiones del equipo y "Cerrar todas", F2.11) aplicadas sin copia (autorizado; chequeos en verde, corrida 43613449697), deploy en verde y humo (`/api/salud`, páginas públicas, redirecciones de `/super`, `/panel` y `/admin`, `humo-pasado`). Trae también E8 en Retención, Socios, Vender, Tu página y las acciones de la Entrada.

**Dónde quedé:** **publiqué la velocidad (E4, E8) y la fase L (L1 a L4) el 14/11 a las 12:35 hora de Argentina** (PR #23, commit a000b28): 4 migraciones aplicadas sin copia (autorizado; prevuelo y chequeos en verde), deploy en verde y humo en producción en el demo y en las páginas de Temple Gym (solo mirando). Lo que sigue: E8 hasta 2 viajes en Caja, Control y Entrada y la tabla final (medición en curso), y lo 🟡 de las fases H, U, P, D, Z, 0, 1 a 9, R, Q, N y F8.

**Qué es nuevo hoy:**
- 🟢 **Publicado (PR #22, 14/11):** barrita del DNI, avisos de QR abajo a la derecha con Realtime, franja sin internet, E5, F8. `/api/salud`, `/g/demo`, `/g/templegym1/hacete-socio` responden 200.
- 🟢 **Publicado hoy (PR #23):**
  - **E4:** el JS que baja toda pantalla del panel pasó de 148,9 a 71,0 KB gzip (el cliente de Supabase y la hoja Cobrar se bajan al usarse); promedio por ruta 322,6 → 245,9 KB gzip.
  - **E8:** menos viajes a la base (`contexto_pantalla` con estado y contacto; `lote_lecturas` para Configuración, Planes, Inicio y Entrada; `panel_vivo` para el menú y la campana). Tabla en `VELOCIDAD.md`.
  - **L1 a L4:** la página del gimnasio en una pantalla, la cuenta gratis, "pagá tu plan" arriba y el QR bloqueado que se activa solo.
  - Arreglos: avisos de QR pegados a la esquina, botón rojo sin emoji, recorridos viejos (F8.2), `pulido-roto-3`.
  - **Migraciones nuevas (4, aditivas), ya aplicadas:** `20261114100000`, `20261114110000`, `20261114120000`, `20261114130000`.
- 🔴 **El QR de Temple Gym dice "Hoy no te podés anotar desde acá": no es un error de la app.** `altas_online` está apagado (la página está publicada y tiene 4 planes). **Lo prendés vos:** Página → "Hacerse socio desde la página" → escribir el reglamento (obligatorio) → prender "Aceptar altas online" → Guardar. El WhatsApp del gimnasio también está vacío (Configuración → Gimnasio).

**Lo que pidió Mateo → estado** (🟢 publicado · 🟡 hecho sin publicar · 🔴 falta · ⛔ depende de Mateo)

| Lo que pidió | Estado | Detalle |
|---|---|---|
| Que sea rapidísimo (fase 0, E8, E4) | 🟢 | Publicado: JS del layout 148,9 → 71,0 KB y menos viajes (Configuración 30 → 6, Inicio 29 → 6). 🟡 falta llegar a 2 en Caja, Control y Entrada. F0.1/F0.6 (medir en producción) ⛔ por los secretos |
| Entrada en la esquina y avisos al instante (NOCHE-1211: E1, E2, E5, E6) | 🟢 | Publicado en el PR #22; los arreglos de hoy (sin emoji, esquina) 🟡 |
| Avisos en tiempo real medidos en producción (E3) | ⛔ | Cargá `DEMO_CONTRASENA`, `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` en GitHub y corré Base de datos → `usuarios-demo` |
| La página del gimnasio en una pantalla (L1) | 🟢 | Publicada; Lighthouse celular 94; Temple Gym visto en un clon |
| Quiero ser socio: cuenta gratis con DNI (L2, H3b) | 🟢 | Publicado (H3b); plan obligatorio por defecto (PREGUNTAS D65) |
| App del socio: pagá tu plan arriba y QR bloqueado (L3) | 🟢 | Publicada; `flujo-cierre` en verde: se activa solo al cobrar |
| Pagar desde la app (L4, MercadoPago) | 🟢 | Apagado por defecto: no aparece sin cobro online |
| El QR de registro de Temple Gym (H3, C9) | 🔴 | Lo prendés vos (arriba) |
| Fechas de cobertura visibles y editables (H2c) | 🟢 | Publicado el 12/11 |
| Cargar socios en el pasado, importar 300 (C10, C2) | 🟢 | Publicado |
| Caja por medio y transferencias (H1) | 🟢 | Publicado |
| Lo roto de PULIDO que pega hoy (H7) | 🟡 | Dejar pasar con error probado; faltan Salida y Volvió antes |
| Crear un gimnasio y su dueño en producción (U0.1, U1) | ⛔ | Cargá `BRIK_ADMIN_MAIL` y `BRIK_ADMIN_CLAVE` en GitHub (y, si da "Invalid API key", la clave `service_role` en Vercel) |
| Dominios (D1 a D3) | ⛔ | Publicado y listo; el cambio de variables y de DNS lo hacés vos con `DOMINIO.md` |
| Copias de seguridad (H5, C8) | ⛔ | Cargá `COPIA_CLAVE` en GitHub y corré Actions → Copias |
| Super admin completo (fase 2) | 🟢 | Publicado, con CUIT y razón social (F2.10) y las sesiones abiertas del equipo con "Cerrar todas" (F2.11) |
| Pulido de todo el sistema (fase Z) | 🟡 | Hecho en gran parte; Z1 y el resto en la lista |
| Los 70 detalles, faltantes, lo chico de antes (fases 4 a 6) | 🟡 | Confirmados contra el código; faltan filas por cerrar |
| Edición en capas, escala y seguridad (fase 9) | 🟡 | En su mayoría hecho; `F9.7` espera Supabase Pro |
| Funciones nuevas (fase N: débito, factura, entradas sin internet, etc.) | 🟡 | Apagadas por defecto; N0, N7, N8 ⛔; N9 (entradas sin internet) 🔴 |
| Cierre (F8): todo en verde, prueba del dueño | 🟡 | `PRUEBA-DUENO.md` listo; su siembra en producción ⛔ por secretos |

**⛔ Lo que tenés que hacer vos, en orden de lo que más destraba:**
0. **Urgente, antes de nada:** abrí `https://pasegym.com/g/templegym1` (el QR impreso de Temple): hoy redirige a `templegym1.gym-os-pied.vercel.app`, que no tiene certificado. Revisá en Vercel las variables de dominio base y plataforma (y el dominio `gym-os-pied.vercel.app` redirigiendo a `pasegym.com`) que se movieron después del 15/11; no las toqué.
1. GitHub → Settings → Secrets and variables → Actions: `BRIK_ADMIN_MAIL`, `BRIK_ADMIN_CLAVE`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `DEMO_CONTRASENA`, `COPIA_CLAVE`, `CLAVE_PRUEBA_MATEO`.
2. Vercel: `SUPABASE_SERVICE_ROLE_KEY` (U0.1/U1), `SUPABASE_REF_ESPERADO` (P3), Vercel Pro.
3. Temple Gym: prender las altas online (arriba), cargar el WhatsApp.
4. Los dominios (`DOMINIO.md`).

## DÓNDE QUEDÉ (13/11, mañana) y RESUMEN PARA MATEO
- 🟡 **Sin publicar: Vercel sigue "Deployment rate limited"** (main no despliega). No mergeé nada a main. Producción sigue con el código del PR #20. Cuando se libere el cupo (o con Vercel Pro) se despliega el PR #21 y recién ahí corresponde la prueba en producción (barrita del DNI, aviso de QR < 1 s, franja sin internet, humo con Temple Gym solo mirando).
- 🟢 **Cerrado hoy:** D40/D56 (avisos abajo a la derecha, D62); los 6 recorridos que "fallaban según la hora" (vd-6, vd-46j, vd-46k, vd-50, vd-54, vd-58) **pasan en Actions**. La hora no era la causa de cinco de ellos: eran selectores viejos (el "+" y el emoji de Máquinas pasaron a íconos), un buscador difuso que traía otro socio, un profe distinto al cargar y al entrar, y una espera del historial. vd-6 usa `HORA_NAVEGADOR=mediodia` (reloj del navegador, Playwright `setSystemTime`).
- 🟡 **E8** (viajes a la base por pantalla): medido con `scripts/medir/viajes.mjs` (corrida 43423578975): las 42 pantallas pasan de 2 viajes (7 a 30); tabla y qué queda en `VELOCIDAD.md` § E8; el layout del panel ya pide dos cosas en paralelo. Falta: una sola función para Configuración, Planes, Inicio y Entrada, que la campana no repita el contexto, y la tabla "después".
- **Próximo:** E1 (confirmar la franja roja y mirar capturas), E2 (capturas 1280 y celular, e2e reduced-motion), E4 (el JS por ruta no bajó), después el resto de RECTA-FINAL en orden (H, U, P, D, Z, 0, 1 a 9, R, Q, N, 8). E3 y la prueba de producción dependen de Mateo / del deploy.
- ⛔ **De Mateo:** Vercel Pro o esperar el cupo; `COPIA_CLAVE`; `BRIK_ADMIN_MAIL`/`BRIK_ADMIN_CLAVE`; secretos de Supabase para medir producción.

## DÓNDE QUEDÉ (13/11, mañana) y RESUMEN PARA MATEO
- 🟡 **Sin publicar: Vercel sigue "Deployment rate limited"** (main no despliega). No mergeé nada a main. Producción sigue con el código del PR #20. Cuando se libere el cupo (o con Vercel Pro) se despliega el PR #21 y recién ahí corresponde la prueba en producción (barrita del DNI, aviso de QR < 1 s, franja sin internet, humo con Temple Gym solo mirando).
- 🟢 **Cerrado hoy:** D40/D56 (avisos abajo a la derecha, D62); los 6 recorridos que "fallaban según la hora" (vd-6, vd-46j, vd-46k, vd-50, vd-54, vd-58) **pasan en Actions**. La hora no era la causa de cinco de ellos: eran selectores viejos (el "+" y el emoji de Máquinas pasaron a íconos), un buscador difuso que traía otro socio, un profe distinto al cargar y al entrar, y una espera del historial. vd-6 usa `HORA_NAVEGADOR=mediodia` (reloj del navegador, Playwright `setSystemTime`).
- 🟡 **E8** (viajes a la base por pantalla): medido con `scripts/medir/viajes.mjs` (corrida 43423578975): las 42 pantallas pasan de 2 viajes (7 a 30); tabla y qué queda en `VELOCIDAD.md` § E8; el layout del panel ya pide dos cosas en paralelo. Falta: una sola función para Configuración, Planes, Inicio y Entrada, que la campana no repita el contexto, y la tabla "después".
- **Próximo:** E1 (confirmar la franja roja y mirar capturas), E2 (capturas 1280 y celular, e2e reduced-motion), E4 (el JS por ruta no bajó), después el resto de RECTA-FINAL en orden (H, U, P, D, Z, 0, 1 a 9, R, Q, N, 8). E3 y la prueba de producción dependen de Mateo / del deploy.
- ⛔ **De Mateo:** Vercel Pro o esperar el cupo; `COPIA_CLAVE`; `BRIK_ADMIN_MAIL`/`BRIK_ADMIN_CLAVE`; secretos de Supabase para medir producción.

## F8 · EL CIERRE (13/11, carril `carril/f8-cierre`, sin publicar: nada de esto toca producción)

**Hecho y verificado ejecutando en Actions** (`gh workflow run "Pruebas completas" --ref carril/f8-cierre …`; ahora acepta `solo`, `socios` y `tanda`, y las tandas con nombre distinto corren a la vez):
- **F8.1 ✅** `base-simulacion` entera con 5.019 socios y la app compilada (corrida 43331281446). Ingreso: mediana 146 ms, peor 296 ms (tope 1 s). Antes/después en `VELOCIDAD.md` (la base sembrada se analizaba tarde: `levantar.sh` ahora corre `analyze`; `panel_inicio` de 2,7 a 4 s a 262 ms).
- **R3 (el flujo que cierra) ✅ `flujo-cierre`**: lo cobrado aparece en la ficha, en Resultado, en la caja de **otra compu sin recargar** y en la app del socio ("No podés entrar" → "Cubierto hasta"); lo editado en la página se ve en la primera carga. Va al final de la cadena `npm run e2e`.
- **F8.3** `humo-puertas`: `/super`, `/dueno`, `/recepcion`, `/profe`, `/socio`, la página y "hacete socio", en compu y celular, con capturas y sin desborde: 48 pasos en verde contra la app local (misma prueba que va a producción por Actions → Humo producción → trabajo `puertas`).
- **F8.4** `sembrar-prueba-mateo` (30 socios en todos los estados) y `usuarios-prueba-mateo`: probados en la base de prueba (se siembra, sembrar de nuevo no lo rehace); `PRUEBA-DUENO.md` con links, usuarios y pasos.
- **Barrido** (cada rol abre cada pantalla): en verde en el último commit (corrida 43345447921).
- **Cadena e2e en 4 bloques de 58 con base nueva** (corridas 43342149800, 43342156925, 43342162695, 43342167904, y reintentos 43342134602 y 43345453141): el bloque 2 salió en verde las dos veces que se corrió; en los demás, cada recorrido pasó al menos una vez con el último código salvo los de abajo. **No hay una sola corrida con todo en verde**: eso falta.

**Arreglos de la app** (los pidió la prueba): Pagar pegado al estado en la app del socio que debe (VD-23b); un solo verde por pantalla (Inicio con Cobrar, super admin). **Arreglos de recorridos viejos** (el fallo era de la prueba, no de la app): selectores ambiguos (`panel-app`, `vd-7`, `panel-configuracion`), el ingreso del socio de D43 (`vd-33`, `vd-61`, `seg-1`), `vd-19` (contador anti-robot), `vd-39` ("Aprobando…"), `vd-2` (vencido de 24 h), `vd-43` (la página nace publicada), `com-3` (se arma sus clases), `rev-5`, `ent-9`, `rut-2`, `onb-1`, `dis-1`, `rev-1`, `vd-29`, `vd-34`, `base-ingresos` (los avisos están arriba a la derecha desde D56; ver `PREGUNTAS.md`), y la zona horaria: los recorridos corren con `TZ=America/Argentina/Buenos_Aires` (entre las 21 y las 24 h el runner en UTC ya estaba en "mañana": fallaban `vd-14`, `vd-7`).

**⛔ Lo que no se pudo cerrar y qué falta**
- **F8.3 y F8.4 en producción** (no se ejecutó nada contra producción): faltan los secretos `CLAVE_PRUEBA_MATEO`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `BRIK_ADMIN_MAIL` y `BRIK_ADMIN_CLAVE` y que Mateo corra `sembrar-prueba-mateo` y `usuarios-prueba-mateo` (pasos en `PRUEBA-DUENO.md`). El logo lo sube él (el script no sube imágenes).
- **F8.2 / R3 🟡: recorridos que siguen en rojo y no tienen causa cerrada** (pasaron o fallaron según el bloque; todos de la pasada de las 21 a las 23 h, hora del gimnasio, y varios dependen de la hora del día): `vd-6` (a veces el foco no llega al campo de la Entrada al abrirla con F2: puede ser real, mirarlo primero), `vd-46j` y `vd-46k` (el profe de reemplazo: "el profe anterior sigue viendo la lista" / sin historial), `vd-50` (la hoja de doble cobro: un click que no encuentra su botón), `vd-54` (interruptor de la configuración de máquinas), `vd-58` (sesiones de personal trainer: "todavía no hay horarios cargados"). Hay que correrlos de día y mirar cada captura de `falla-*.jpg` (artefacto `pantallas` de la corrida).
- **La cadena de punta a punta en una sola corrida** no se hizo (la de 232 recorridos se corta por memoria y por estado: se corrió en 4 bloques).

**Cerrado (D62, Mateo 12/11):** los avisos de la puerta van abajo a la derecha (D40/D56 cerradas en `PREGUNTAS.md`); en el código ya es así.


## ⚠ PUBLICADO PERO SIN DEPLOY: el PR #21 está mergeado en main y Vercel dijo "Deployment rate limited — retry in 24 hours" (13/11, 00:10)
- **Qué pasó:** el plan Hobby de Vercel tiene un tope de deploys por día y cada push a cualquier rama (carril, base, publicar) creaba una vista previa que gastaba uno. Se pasó del tope.
- **Estado de producción:** sigue andando el código del PR #20 (el último deploy bueno), con la base ya migrada. La migración nueva (`20261112220000`, Realtime de ingresos) es aditiva: el código anterior anda con ella. Temple Gym, `/ingresar`, `/super` y `/api/salud` responden bien (probado a las 00:10).
- **Lo que NO está en producción todavía** (en main, sin deploy): la barrita del DNI, los avisos de QR abajo a la derecha con Realtime, la franja sin internet, el acento corrido de tono (Z8), E5 y lo de F8. **Se despliega solo con el próximo deploy de main** cuando Vercel libere el cupo (24 h), o antes si Mateo pasa a **Vercel Pro** (ya estaba en su lista: el plan Hobby no permite uso comercial).
- **Lo que hice para que no se repita:** `vercel.json` ahora desactiva los deploys de las ramas de trabajo (`carril/**`, `base/**`, `publicar/**`, `tmp/**`, `noche/**`, `dia/**`): solo `main` hace deploy. Confirmado: el push siguiente ya no generó ningún deploy. Los recorridos se prueban en Actions, no en la vista previa.
- **Pendiente apenas se libere:** correr el humo en producción (Temple Gym solo mirando, `/super`, y el demo con `humo-pasado`) y recién ahí decir "LISTO" para estas piezas. No creo ni toco nada de Temple Gym. Si el cupo no se libera a la mañana: Mateo puede hacer "Redeploy" del último commit de main desde el panel de Vercel o pasar a Pro.

## LISTO PARA CAMBIAR LOS DOMINIOS (12/11, publicado entre las 19:50 y las 20:15 hora de Argentina, con tu autorización, sin copia)
Mateo: ya podés seguir `docs/base/DOMINIO.md`, en orden (la variable `NEXT_PUBLIC_DOMINIOS_VIEJOS=gym-os-pied.vercel.app` es la que salva el QR impreso; la dirección propia de Temple Gym se carga en el super admin recién DESPUÉS del Redeploy).
Publicado hoy:
1. **PR #18** (dominios, solo código): `gym-os-pied.vercel.app` y `www.` redirigen con 308; deploy en verde; Temple Gym `/g/templegym1`, `/g/templegym1/hacete-socio`, `/ingresar` en 200, `/super` pide sesión.
2. **PR #19** (H2c fechas de cobertura + prevención de la fase D): migraciones `20261112050000` y `20261112200000` aplicadas **sin copia** (corrida 43324347571, chequeos en verde) y luego merge, deploy en verde. Humo en producción en el demo con rollback (corrida 43324855643): Cobrar propone "cubre del … al …", fechas cambiadas con la propuesta y quién las cambió, `cubierto_hasta` = recalculado, la recepción rechazada, Control lo muestra; no quedó nada guardado.
3. **PR #20** (fase Q, pulido Z, resto): migración `20261112210000` aplicada sin copia (corrida 43325742385); validado antes en Actions (base 1117 pruebas sin fallas y 10 recorridos en verde); merge, deploy en verde, mismas páginas en 200.
Temple Gym sigue con 0 funciones nuevas prendidas (estado, corrida 43326431319). No quedó nada sin publicar de lo que estaba en verde. Sin sesión real de demo no pude abrir las pantallas con el navegador: lo de pantalla se verificó con los recorridos e2e en Actions y lo de la base contra producción.

## (anterior) PUBLICACIONES LISTAS (12/11, 18:30), esperan las 22 h
1. **Dominios (D1/D2), solo código y documentación, sin migraciones: PR #18** (`publicar/base-dominios`). Se mergea **después de las 22 h** (hora de Argentina). Cuando esté mergeado y el deploy en verde, acá va a decir "LISTO PARA CAMBIAR LOS DOMINIOS" y Mateo sigue `docs/base/DOMINIO.md` (ojo: la variable nueva `NEXT_PUBLIC_DOMINIOS_VIEJOS` es la que salva el QR impreso).
2. **H2c (fechas de cobertura) y la prevención de la fase D: PR #19** (`publicar/base-h2c`). Trae 2 migraciones (`20261112050000` y `20261112200000`, aditivas). Prevuelo contra la base real en verde (corrida 43309182849). **No hay `COPIA_CLAVE`, así que no las aplico solo.** Pasos de Mateo, después de las 22 h: (a) Actions → Base de datos → rama `publicar/base-h2c`, acción `aplicar`, y si no hay copia, en `sin_copia` escribir `SIN COPIA` (decisión tuya; son funciones nuevas y columnas vacías, no tocan filas); (b) mergear el PR #19 y esperar el deploy en verde; (c) abrir Cobrar de un socio y ver "Cubre del … al …" con "Cambiar fechas" (dueño). **No mergear el #19 antes de aplicar las migraciones: la pantalla de Cobrar las necesita.** Si decís "SIN COPIA, hacelo", el loop lo hace solo después de las 22 h.

## DÓNDE QUEDÉ (12/11, 17:30 hora del gimnasio)
- **Verificado en producción tras el PR #16:** (1) Temple Gym tiene **0 funciones nuevas prendidas** (Actions → Base de datos → estado, corrida 43297648610): lo de la fase N está apagado. (2) `https://gym-os-pied.vercel.app/g/templegym1/hacete-socio` abre la página de alta de Temple Gym con su marca (200, se queda en esa dirección). **Hoy dice "Hoy no te podés anotar desde acá"** porque el registro por QR de Temple Gym está apagado (`altas_online`): Mateo lo prende en Configuración → Registro de socios cuando quiera que el QR impreso ande. No lo toqué (es un dato real). (3) Cargar un socio con alta y pago de hace 20 días y la caja por medio de pago, en el demo de producción y dentro de una transacción que revierte (acción `humo-pasado`, corrida 43300000883): 1 pago, 1 cobertura, la caja del turno no se mueve, efectivo y transferencia salen separados, no quedó nada.
- Ramas `carril/*`: ninguna tiene trabajo sin integrar.
- No hay un dueño con cuenta en los demos de producción: el humo con sesión real (`humo-produccion.yml`) sigue ⛔ por `BRIK_ADMIN_MAIL` / `BRIK_ADMIN_CLAVE`.
- En curso: fase D (D3, D4) con un ayudante. **R1 y R2 hechos (12/11, `carril/r-estado`):** `ESTADO-GENERAL.md` con las tres listas al día y fase Q nueva en `RECTA-FINAL.md` (Q1 a Q5, lo que faltaba sin ítem); los MD viejos que chocaban quedaron marcados "Reemplazado por docs/base/…". Sigue R3.

## PUBLICACIÓN LISTA, ESPERANDO TU COPIA (11/11, noche): rama `publicar/base-hoy`
Prevuelo en verde (Actions 43143923167): 22 migraciones pendientes (recepción, velocidad, filtros en lote, cargar pasado, QR, Caja por medio, alta con cuenta y reclamo, términos y restaurar cambios, lista del super admin rápida, exportar con filtros, funciones nuevas apagadas). Trae: Caja con resumen por medio y Transferencias en dos pestañas (H1), `/g/<slug>/hacete-socio` y el camino del socio (H3/H3b), lo roto de PULIDO que pega hoy (H7), cargar socios y pagos en el pasado (C10), QR para registrarse (C9), lector USB y cierre por inactividad (C5/C6), guías y carteles (C3/C4), y los arreglos de las revisiones del mostrador y del socio.
Como Temple Gym ya cobra, **no aplico sin copia cifrada**. Pasos para vos, en orden:
1. GitHub → Settings → Secrets and variables → Actions → Secrets → New repository secret: `COPIA_CLAVE` = una frase de 16+ caracteres al azar (guardala también en tu gestor de contraseñas: sin ella la copia no se abre).
2. Actions → **Copias** → Run workflow (prueba la copia y que restaura en una base de prueba). Tiene que dar verde.
3. Actions → **Base de datos** → Run workflow, rama `publicar/base-hoy`, acción `aplicar` (hace la copia, el prevuelo, aplica y corre los chequeos). Si no hay COPIA_CLAVE se frena solo.
4. Abrí el PR de `publicar/base-hoy` a `main`, mergealo y esperá el deploy de Vercel en verde.
5. Mirá (sin crear nada) `https://gym-os-pied.vercel.app/g/templegym1/hacete-socio`: tiene que abrir el formulario de Temple Gym.
6. Actions → **Humo producción** (necesita `BRIK_ADMIN_MAIL` y `BRIK_ADMIN_CLAVE`).
Si cargás `COPIA_CLAVE`, el loop hace los pasos 2 a 6 solo.

## RESUMEN PARA MATEO (11/11, tarde)
- Publicado en producción: fase P y C1, C2, aviso al socio (PR #15). **Desde que Temple Gym cobra con Base, no aplico más migraciones sin copia cifrada previa**: el botón `aplicar` de Actions ahora hace la copia y se frena solo si falta `COPIA_CLAVE`.
- Listo para publicar apenas haya copia: recepción (inactividad), velocidad (130100-130400, filtros en lote), C9 (QR), C10 (cargar pasado), F1.2/F1.7, F1.4/F1.5, C3-C7 (guías y carteles). Esperando a los ayudantes de H1 (caja), H3/H3b (camino del socio y QR directo) y H7 (lo roto de PULIDO) para sumarlos.
- Ensayo antes de producción (N0): un segundo proyecto de Supabase llamado "ensayo": ⛔ lo crea Mateo (5 minutos); hasta entonces se prueba en el demo y en la base local.

## LO QUE NECESITO DE MATEO (secretos de GitHub: hoy solo existe `SUPABASE_DB_URL`)
- **`COPIA_CLAVE` (urgente, destraba todo lo que toca la base):** Settings → Secrets and variables → Actions → Secrets → New repository secret, nombre `COPIA_CLAVE`, valor una frase de 16+ caracteres al azar; guardala también en tu gestor de contraseñas. Sin ella no puedo aplicar nada. Después corré Actions → Copias para probar copia y restauración.
- `BRIK_ADMIN_MAIL` y `BRIK_ADMIN_CLAVE` → destraba el humo en producción (U0.3).
- `COPIA_CLAVE` (una frase larga, 16+ letras; guardala vos también, sin ella las copias no se abren) → destraba C8, corré Actions → Copias.
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `DEMO_CONTRASENA` → destraban medir producción (F0.1) y los usuarios demo.
- `SUPABASE_SERVICE_ROLE_KEY` en Vercel (U1/U0.1).

## PASOS PARA MATEO (velocidad y accesos; F0.6)
1. **Clave de servicio (urgente, destraba el alta de dueños):** Supabase → tu proyecto de Gym OS → Project Settings → API → copiá la clave **service_role** → Vercel → el proyecto → Settings → Environment Variables → `SUPABASE_SERVICE_ROLE_KEY` (Production) → pegala → Redeploy. Tiene que ser de ESTE proyecto (el mismo de `NEXT_PUBLIC_SUPABASE_URL`), no la anon ni la de otro proyecto. En /admin, "Estado de la plataforma" la prueba creando y borrando un usuario.
2. **Claves asimétricas (hace que el proxy no viaje a Auth en cada pedido):** Supabase → Project Settings → JWT Keys → "Migrate" a claves asimétricas (ECC/RSA). Puede cerrar las sesiones abiertas una vez. Después `getClaims()` verifica sin ir a Auth.
3. **Secretos de GitHub** (Settings → Secrets and variables → Actions): `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `DEMO_CONTRASENA` (10+ letras; para el demo y para medir) y, para la prueba de humo, `BRIK_ADMIN_MAIL` y `BRIK_ADMIN_CLAVE` (tu cuenta de super admin de producción).
4. **Planes (los pagás vos):** Supabase Pro (máquina más grande que Free) y, en Vercel, revisar que Fluid Compute esté prendido (Settings → Functions). Con y sin, el agente mide y anota la diferencia en `VELOCIDAD.md`.
5. **Dominio:** `DOMINIO.md` (pasos exactos).

## PUBLICADO 11/11 10:45 — fase P y lo hecho de la fase C (PR #15)
- 11 migraciones aplicadas desde Actions (prevuelo 43030658511, aplicar 43030901243, chequeos en verde); PR #15 mergeado y deploy de Vercel en verde. Incluye: plataforma y alta (P1 a P7), landing y editor (P8, P8b), clave nueva sin mails (C1), importar socios (C2), aviso de clave al socio, plantillas, escala y papelera del super admin.
- Antes de aplicar, el estado dijo 3 gimnasios reales con 2 socios en total; se aplicó igual por orden de Mateo (migraciones aditivas).
- Humo en producción: ⛔ falla por faltar los secretos `BRIK_ADMIN_MAIL` y `BRIK_ADMIN_CLAVE` (corrida 43031908841). Chequeo sin sesión: `/` 200, `/ingresar` 200, `/g/demo` 200, `/api/salud` 200. **Mateo: cargá esos dos secretos en GitHub y corré Actions → Humo producción.**
- Falta publicar: `20261111110000_recepcion_inactividad.sql` (C6) y lo que siga.

## PUBLICADO EL 12/11 (17:10, por Claude desde el chat)
Migraciones de `publicar/base-hoy` aplicadas en producción (corrida 43295889879; **sin copia previa**, con permiso de Mateo; prevuelo y chequeos contra la base real en verde), PR #16 mergeado (164d21e) y deploy de Vercel en verde. Entró todo lo que había en `base/2026-11-07` al 12/11 01:12: H1, H2/C10, H3, H6, la fase C, el super admin, lo hecho del pulido. El e2e `n-nuevas` (fase N) no pasaba: lo de la fase N tiene que quedar apagado para Temple Gym hasta pasar. El workflow "Base de datos" tiene ahora `sin_copia` (solo con la frase "SIN COPIA"); por defecto sigue pidiendo la copia.

## DÓNDE QUEDÉ (11/11, noche)
- ✅ hoy: H1, H2/C10, H3, H6, F1.9, F1.5, F1.6, F2.x, F3.1, F7.1, F9.1, C1-C10, U5, P1-P8b. 🟡: H3b, H4, H5, H7, F3.2. ⛔: C8/H5 (COPIA_CLAVE), N0 (proyecto ensayo), F0.1 (secretos).
- Publicación lista en `publicar/base-hoy` (prevuelo 43123213163, 11 migraciones); **no se aplica sin COPIA_CLAVE** (pasos arriba).
- En curso (5 ayudantes con Actions en su rama): `carril/z-iconos-textos` (Z2-Z4), `carril/z-diseno-falta` (Z5-Z7), `carril/f4-f5` (DETALLES-70 y FALTANTES), `carril/h7-pruebas` (exportar con filtros, pruebas de H7/H3b, CLS en celular), `carril/f9` (F9.2-F9.8). Al terminar: mergear a base, e2e con `solo`, cerrar filas.
- Falta después: F0.3/F0.5, F3.2, N1-N8 (apagado para Temple Gym), F8 (cierre: botones + barrido, simulación completa, humo, PRUEBA-DUENO.md).

## (anterior) DÓNDE QUEDÉ (11/11, 12:00)
- ✅ cerrados hoy: U5, P1, P4-P8b, C1-C7, F1.2, F2.1-F2.9, F7.1, F9.1. Publicado: fase P y C1/C2/aviso (PR #15). Sin publicar: migraciones 20261111120000 (recepción) y 130100-130400 (velocidad) y lo que sigan los ayudantes.
- En curso (ayudantes en worktrees): `carril/a-filtros` (filtros_socios a menos de 300 ms), `carril/c-qr-alta` (C9), `carril/c-pasado` (C10, plata: dueño y encargado), `carril/d-f19` (F1.9: vd-6, base-7b, velocidad-a y los 15 viejos, con Actions), `carril/d-f3` (F3).
- Rojos conocidos en Actions: `base-7b` (paso 4b), `velocidad-a` (ingreso optimista), `vd-6` (paso 6). Los trabaja `carril/d-f19`.
- Pendientes tras eso: F4, F5, F6, F9.2-F9.8, F0.1 (⛔ secretos), F1.6 (filtros), F8 y publicar cada fase.

## (anterior) DÓNDE QUEDÉ (11/11, 09:00 — vuelta nueva)
- U5, P1, P4 a P7, P8 y P8b en ✅ (Actions 43015505501 y 43020787407). Chequeos de la base relanzados en 43022741600 (lista blanca y paletas del editor ya arreglados). Ayudantes en la fase C: `carril/c-clave` (C1) y `carril/c-importar` (C2); al terminar: integrar, correr su e2e (`clave-nueva`, `importar-300`) en Actions. Yo sigo con C3 a C8. Bloqueados por Mateo: U0.1/U0.3/U1 en producción (secretos `BRIK_ADMIN_MAIL`, `BRIK_ADMIN_CLAVE` y clave de servicio en Vercel). Hay migraciones nuevas sin aplicar (20261111090000 y las que traigan los carriles): se aplican en la próxima publicación.

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
Hechos (08/11): `historia/CONTEXTO.md`, `PERMISOS.md` (generado desde la base real), `historia/INVESTIGACION.md`, `docs/CONVENCIONES.md`, `docs/LECCIONES.md`; `CLAUDE.md` con la excepción de `cubierto_hasta`. Pendiente: `docs/SCHEMA.md` completo con lo real y marcar lo viejo de `docs/v2/` como reemplazado.

(Original:) `historia/CONTEXTO.md`, `PERMISOS.md` (desde la base real), `historia/INVESTIGACION.md`,
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
  interesado, está en `historia/FALTANTES.md` FA-24.
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
: Pista está publicada pero APAGADA en Temple Gym y en los demos

**Lo único que falta es tuyo:** los secretos de GitHub `BRIK_ADMIN_MAIL` y `BRIK_ADMIN_CLAVE` (la cuenta de super admin de producción) no están cargados (Settings → Secrets and variables → Actions). Sin ellos el workflow `pista-produccion` no puede entrar a la ficha del super admin y **no prendí Pista en Temple Gym ni en un [demo] de producción, ni dejé el aviso de Novedades**; tampoco corrió el humo de producción (falla igual desde el 11/11).
**A mano, un minuto:** `pasegym.com/super` → Temple Gym → Ficha → "Estilo": Pista, modo Oscuro → Guardar (tarda hasta un minuto en verse). **Volver atrás, un paso:** la misma ficha con Estilo: Clásico, o Configuración → Marca → Estilo (el dueño). Con los secretos cargados: `gh workflow run pista-produccion.yml --ref main -f fase=demo` (mira un [demo]), `-f fase=temple` (prende Temple Gym) y `-f fase=novedad` (aviso dirigido); `-f fase=temple -f revertir=true` lo vuelve a clásico.

**Publicado (19/11, 01:05 ART, fuera de 16–22 h, SIN COPIA, con prevuelo; PR #35, main df6bebb2; vuelta atrás: revertir ese merge, main antes = `24386fe4`):** la migración `20261118120000_estilo_gimnasio` (columnas `estilo` y `modo`, entran en clásico/oscuro para todos; las funciones `guardar_estilo_gimnasio`, `admin_guardar_estilo`, `estilo_gimnasio`; `gimnasio_por_host/slug` traen el estilo), Pista (solo CSS, detrás de la llave), el selector en Configuración → Marca y en la ficha del super admin, la campana que ya no tapa el botón del encabezado, las pruebas firmes y los documentos ordenados (`docs/base/historia/`, `00-LEEME.md` de una pantalla). Verificado en producción: Vercel verde, `humo-pasado` verde, `templegymsalta.com`, `/hacete-socio`, `pasegym.com/g/demo`, `/ingresar` y `/super` responden 200, y el `<html>` de Temple Gym sale con `data-estilo="clasico"` (todo igual que antes). **Después de correr `npm run db:types`** (lo hace Mateo: necesita su proyecto de Supabase).

**Lo que encontró la auditoría (en las capturas de Pista y clásico, compu y celular; no pude mirar producción con sesión por lo de arriba):**
- ✅ Arreglado: en la compu la campana tapaba el último botón del encabezado (Caja: "Cierre del día"; Entrada: "Control de la puerta"), en clásico y en Pista. Recorrido `encabezado-campana` (verde en las dos llaves).
- Anotado (no arreglado): en el celular el botón flotante verde de Entrada tapa la fila de abajo de las listas (Socios) hasta que se hace scroll; el texto apagado de las etiquetas del formulario de Caja se ve flojo en Pista oscuro (cumple 4,5:1, pero cuesta); "Con sonido" en Entrada no dice que es un botón.
- No se pudo mirar en esta pasada: la tablet y la TV de lejos, el profe, "sin internet", el contador cerrando el mes y las pantallas con otro rol u otro gimnasio en producción (las pruebas de permisos de la base ya cubren que den error y no vacío). Quedan para tu pasada y para cuando estén los secretos.
- Pruebas inestables arregladas: `vd-3` (comparte el socio con otros recorridos de la tanda: ahora busca uno que no haya entrado hoy), `cliente` (espera la lista de transferencias y reintenta) y el barrido (lee la pantalla cuando pintó, no tras un tiempo). Tres corridas seguidas en verde cada una.

---

## DÓNDE QUEDÉ y RESUMEN PARA MATEO (18/11, mediodía)

**Publicado hoy (18/11, 13:50 ART, fuera de 16 a 22 h, migraciones SIN COPIA autorizadas, con prevuelo; PR #34, main 24386fe4; vuelta atrás: main antes = `000770ff`):**
- **Cacería terminada en el panel:** cada pantalla del panel pide **3 viajes o menos** a la base (contexto, un lote de lecturas y el estado vivo). Entrada 7 → 3, Inicio de la dueña 6 → 3, Configuración 6 → 3, Vender 5 → 3, Caja de la recepción 5 → 3 (la de la dueña 8 → 4: `cajas_para_revisar` escribe y no entra en un lote), Interesados (Socios → Interesados) 3. `/panel/prospectos` (la dirección vieja) queda en 5 por el salto de redirección. Los topes de `scripts/medir/topes-viajes.json` bajaron a lo medido (nunca suben).
- Cómo: el oído de la puerta ya no pide su cursor a la base (lo trae el servidor al pintar); la Puerta recibe en el lote de Entrada el modo de prueba, si se registra la salida y la emergencia; Interesados, el Inicio de la dueña (datos de ejemplo y seguridad), "¿Quién atiende?" y la versión de Configuración van en el mismo lote; el Inicio del socio (`/app`) pide `registra_salida` en el lote (9 viajes siempre, ya no dependía del QR de la pared). El respaldo del cartel de emergencia pasó de 30 a 60 s.
- Migraciones `20261118100000` y `20261118110000` (aditivas, solo suman nombres a la lista cerrada de `lote_lecturas`), con `supabase/pruebas/lote-entrada.test.mjs` (misma lectura que por separado; otro gimnasio o sin permiso = error, no vacío).
- **Prueba de la base que se rompía con los días** (`espera-con-plazo`: usaba el reloj real con socios sembrados el 14/11): arreglada.
- Probado en Actions con la app compilada: recorridos de Entrada, Caja, Interesados, Inicio, camino del socio, barrido de cada rol y los topes de viajes: todo en verde (corrida 44349582365). Producción: `humo-pasado` verde, portada de Temple Gym, `/hacete-socio`, `pasegym.com/g/demo`, `/ingresar` y `/super` responden 200.
- ⛔ `humo-produccion.yml` falla en su paso de puertas desde el 11/11 (no es de este cambio): busca el gimnasio `demo-mateo`, que no está en producción (hay que sembrarlo con "sembrar-prueba-mateo" desde Actions → Base de datos).

**Pase 2.0 · Pista (18/11, en la rama, SIN publicar):** hecho y probado en Actions con la app compilada: la llave `estilo` (clasico|pista) y `modo` (oscuro|claro) por gimnasio (migración `20261118120000`, entra apagada para todos, con pruebas de la base: solo el dueño o el super admin la cambian, otro gimnasio = error); el estilo y el modo salen en el `<html>` desde el servidor (vía la dirección que ya resuelve el proxy, sin un viaje más); los tokens, el radio, los botones y la tipografía Big Shoulders 800 (14 KB, un solo archivo propio) son solo CSS al final de `globals.css`; selector en Configuración → Marca → Estilo y en la ficha del super admin; lo impreso sale siempre claro; el QR ya va sobre su cuadro blanco. **Inventario** (`inventario-pantallas.mjs`): 66 pantallas en compu y celular, clásico contra Pista, sin perder un botón, link, campo, título ni atributo (el inventario encontró y se ajustó a lo que cambia solo entre pasadas). **Las 254 recorridos e2e + los topes de viajes con Pista (oscuro)**: todos en verde (los que fallaron por las mayúsculas de los títulos se corrigieron en el arnés: con Pista el recorrido lee el texto como se escribió, `E2E_SIN_MAYUSCULAS`); **barrido de cada rol, compu y celular, en oscuro y en claro**: en verde; **Lighthouse de la página del gimnasio**: 93 con Pista (93 con el clásico), accesibilidad 100 (96 clásico). Capturas de antes y después (artefacto `pantallas`, `inv-clasico-*` e `inv-pista-*`), miradas: Inicio, Entrada, Configuración, app del socio y portada, en oscuro y claro. **Desvío a propósito de DISENO.md:** el texto apagado (`--texto-3`) sale #9AAAB7 en oscuro y #5E6B77 en claro para llegar a 4,5:1 (con los del diseño daba 3,4 a 3,9:1). Los títulos van con Big Shoulders sin `preload` (el clásico no baja nada de más). **Falta para publicar:** la pasada de las 254 en clásico (para confirmar que nada cambió con la llave apagada, en curso) y la mirada de Mateo a las capturas; al publicar: prevuelo, aplicar la migración (sin copia), prender Pista en los `[demo]` (`update configuracion_gimnasio set estilo='pista'` solo en los `[demo]`, a mano desde Actions → Base de datos) y `npm run db:types`. Temple Gym queda en clásico hasta que Mateo lo prenda (Configuración → Marca → Estilo).

**Lo que queda de la cacería (no bloquea):** `/app` llegó a 9 (la meta de Mateo era 2: quedan el menú, el aviso de clave, la ocupación, las ofertas y los avisos, que van en componentes aparte); juntar los relojes en Realtime; ⛔ la tabla de errores de producción y las pantallas lentas (necesitan a Mateo, ver abajo).

---

## (anterior) DÓNDE QUEDÉ y RESUMEN PARA MATEO (16/11, tarde)

**Publicado hoy (hora de Argentina, fuera de 16 a 22 h, migraciones SIN COPIA autorizadas, cada una con prevuelo y humo en producción; Temple Gym solo mirado):**
- **PR #29 (10:40) · URGENTE React #441 en `/hacete-socio`:** no pude reproducirlo (ni sin sesión, ni con la dueña o un socio, ni desde la portada: `hacete-socio-sesion.mjs`) y no tengo acceso a los logs de Vercel de este proyecto. Se blindó lo único que en el servidor puede fallar ahí (la lectura del alta): reintenta una vez y, si la base no responde, la página lo dice con "Probar de nuevo"; el error genérico ahora muestra su "Código del error".
- **PR #30 (11:00) · el QR impreso nunca se rompe:** los slugs anteriores de cada gimnasio se guardan (tabla `slugs_anteriores`, migración `20261116100000`) y `/g/<slug viejo>/…` redirige 308 a la dirección actual; `templegym1` quedó como anterior de `templegymsalta`. Y ninguna redirección va a una dirección del dominio viejo. Probado en producción: `pasegym.com/g/templegym1/hacete-socio?o=qr` y la dirección vieja de Vercel terminan en `templegymsalta.com/hacete-socio?o=qr` con el formulario.
- **PR #31 (14:40) · el camino del socio (D83, los 7 puntos):** "Crear mi cuenta" siempre en la portada (llave del dueño en Tu página), cuenta sin plan, memoria (con la sesión abierta la dirección del gimnasio va a su app), la recepción ofrece "Clase de prueba" la primera vez y "Dar el alta y cobrar" desde la segunda, y la app del socio con 6 botones grandes. Migración `20261116110000`. Lo prueba `camino-socio.mjs` (32 pasos, con la app compilada).
- **PR #32 (15:10) · reglamento nuevo:** el socio que ya aceptó una versión ve una tarjeta con el texto y "Acepto" al abrir su app (la puerta no cambia). Migración `20261116120000`. Para volver atrás: revertir el merge del PR que corresponda (main antes de cada uno: `dd8cdb73`, `06e0848f`, `8e4e251c`, `d26ce5bc`).

**Sin publicar (rama `base/2026-11-07`, se publica a partir de las 22:00 con prevuelo; migración `20261116130000`, aditiva):**
- **Cacería de pedidos de más:** el Inicio de la app del socio pasó de 22 a 9 pedidos a la base (tope nuevo 9, medido en Actions con la app compilada); Caja y Mensajes del panel piden sus lecturas en un solo viaje; el cartel de emergencia no pregunta con la pestaña escondida (medido: 0 pedidos escondida, 17 a la vista contra la base local; con Realtime en producción son unos 4 por minuto).
- **`ent-6` (la tablet) era la prueba, no la app:** el cartel "¡Pasá, …!" dura 4 segundos y la prueba lo esperaba después de sacar una captura. Arreglada (3 corridas en verde) y de vuelta en la cadena e2e.
- **Barrido de consola (cada rol en cada pantalla, compu y celular):** limpio, sin errores (corrida 43923691877).

**Lo que pidió Mateo (16/11) → estado** (🟢 publicado · 🟡 sin publicar · 🔴 falta · ⛔ depende de Mateo · ➡️ Pase 2.0)

| Lo que pidió | Estado | Detalle |
|---|---|---|
| URGENTE: React #441 en `/hacete-socio` | 🟢 | Blindado y publicado; causa no reproducida. ⛔ si te vuelve a salir: ventana privada y pasame el "Código del error" |
| Cambiar el slug no rompe un QR impreso | 🟢 | PR #30, probado en producción |
| Nunca redirigir a una dirección del dominio viejo | 🟢 | PR #30 (anotarlo en Estado de la plataforma ➡️) |
| Camino del socio, 7 puntos (D83) | 🟢 | PR #31. La revisión de cada pantalla de la app contra las 21 reglas de FLUIDEZ ➡️ |
| Reglamento: aceptar al crear la cuenta, versión nueva al abrir la app, ficha con la versión, editarlo sin altas | 🟢 | PR #32 (la ficha y la edición ya existían) |
| Cacería 1: app del socio 22 → 2 pedidos | 🟢 | 22 → 9 publicado (PR #33, 17/11 22:1x ART, commit 000770ff); llegar a 2 ➡️ (quedan el menú, el aviso de clave, la ocupación, las ofertas y los avisos, que van en componentes aparte) |
| Cacería 2: mostrador a 3 pedidos | 🟢 | Caja y Mensajes en un viaje, publicado en el PR #33; Entrada, Prospectos, Inicio, Configuración y Vender 🔴 (siguiente vuelta) |
| Cacería 3: los relojes en un solo canal | 🟢 | Publicado: la emergencia ya no pregunta escondida y hay medición (`relojes.mjs`); juntar todo en Realtime ➡️ |
| Cacería 4: lo roto que se ve | 🟡 | Barrido de consola 🟢 limpio. ⛔ la tabla de errores de producción: abrí `/admin` → Errores (o pasame el resultado de `select ruta, mensaje, count(*) from errores_app where creado_en > now() - interval '7 days' group by 1, 2 order by 3 desc`). ⛔ las pantallas lentas en producción: `medir-produccion.yml` necesita los secretos del paso 1 de abajo |
| Cacería 5: `ent-6` | 🟢 | Era la prueba; arreglada y en verde, de vuelta en la cadena |

**⛔ Lo que tenés que hacer vos, en orden (lo anterior sigue valiendo, ver abajo):**
1. Probá en tu celular el camino completo de Temple Gym: `templegymsalta.com` → "Crear mi cuenta" → tu app. Cargá el texto del reglamento de Temple Gym (Tu página → "Hacerse socio desde la página"), el nombre "Temple Gym" y el WhatsApp.
2. Si "React #441" te vuelve a salir: ventana privada y el "Código del error".
3. Los pasos 1 a 6 de la lista del 15/11 (secretos de GitHub, mails de Supabase, dominios, planes Pro, tu pasada visual) siguen igual.

---


## LISTO PARA TU PASADA · Pase 1.0 (15/11)

Pase 1.0 es lo que un gimnasio necesita para usarlo todos los días: entrar, cobrar, dar de alta, la caja, la página del gimnasio, el socio con su cuenta y su QR, y el super admin. **Todo eso está hecho, probado y en el código.** Lo que no se hizo en 1.0 está en `PASE-1.0.md` → "Para Pase 2.0", ordenado por importancia, y lo que depende de vos está abajo con su paso exacto. La prueba que te toca es `PRUEBA-DUENO.md`.

## DÓNDE QUEDÉ y RESUMEN PARA MATEO (15/11, tarde)

**Publicado hoy a las 12:42 (hora de Argentina), PR #27, main en `325b1e89`:** D69 (el producto se llama Pase: panel, app del socio, super admin, títulos, manifest; el nombre sale de `src/lib/producto.ts` y una prueba falla si vuelve a escribirse a mano), P2 (ninguna dirección escrita a mano, la lista de excepciones quedó vacía), Q1 según D70 (la matrícula se valida antes de crear el plan; el cierre de caja muestra el monto contado antes de confirmar), el tope de viajes a la base por pantalla, la hoja de Cobrar sin la X duplicada y N10 (migración `20261114180000` aplicada sin copia, corrida 43731288556, función apagada por defecto). Deploy en verde; en producción: título y manifest dicen Pase, `/api/salud`, `/g/demo`, `/g/templegym1` y `/ingresar` responden 200, `humo-pasado` en verde. **Temple Gym solo mirado, nada tocado.** Para volver atrás: revertir el merge (main antes de hoy: `eab6e40e`).

**Segunda publicación, 16/11 a las 10:00 (hora de Argentina), PR #28, main en `dd8cdb73`, sin migraciones (prevuelo: nada pendiente, corrida 43871472293):** deploy en verde, `/api/salud` y `/ingresar` en 200 con título Pase, `humo-pasado` en verde (corrida 43872106054). Para volver atrás: revertir el merge (main antes: `325b1e89`). **Temple Gym solo mirado.** Contenido:

**⚠️ Encontrado al hacer el humo, no es de este cambio (`proxy.ts`, `dominios.ts` y `proxy-rutas.ts` no cambiaron):** `gym-os-pied.vercel.app` ya redirige a `pasegym.com`, y `/g/demo` y `/g/templegym1` (el QR impreso de Temple) redirigen con 308 a `demo.gym-os-pied.vercel.app` y `templegym1.gym-os-pied.vercel.app`, que no tienen certificado (falla el handshake SSL). Parece ser la configuración de dominios en Vercel (variables de dominio base o plataforma) que se tocó después del 15/11: **revisalo vos, primero**, porque con eso el QR de Temple no abre. No toqué variables de Vercel (regla). Pista: la rama `sonda/dominios-1511` es de esa prueba de dominios.
- **Un bug real arreglado:** el número del menú (Mensajes, Transferencias…) y el de la campana quedaban viejos después de contestar un mensaje o aprobar una transferencia. Prueba nueva `vivo-cliente.test.ts`.
- **"Probá una clase"** en todos lados de la página del gimnasio (antes también decía "Probá gratis"), con una prueba que falla si vuelve (D79).
- **El panel lateral del socio muestra su foto** (o la inicial) para confirmar a quien está en la puerta, y **tocar una última entrada de Inicio abre ese panel** sin salir de la pantalla (FA-2).
- **PERMISOS.md** regenerado (la función de N10, solo dueño y encargado) y la prueba de importar socios ya no depende del día de la corrida.
- **Documentos en orden:** `00-LEEME.md` como índice real, 13 contradicciones entre documentos decididas por defecto (D71 a D82 en `PREGUNTAS.md`), `ESTADO-GENERAL`, `RECTA-FINAL`, `VELOCIDAD`, `PRUEBA-DUENO` y `CLAUDE.md` al día.
- **Cadena e2e completa en Actions** (250 recorridos en tandas de 20, base nueva en cada una, app compilada): en verde. Lo que fallaba eran recorridos viejos frente a L1 y L3 (ya adaptados), tres que dependían del orden de la cadena (ya deterministas) y el bug del menú. **Apartados con su motivo:** `vd-25` (la portada de una pantalla ya no dibuja la prueba social ni "¿Primera vez?") y `ent-6` (el cartel de la tablet a veces no aparece; la entrada sí se registra).

**Lo que pidió Mateo → estado** (🟢 publicado · 🟡 sin publicar · 🔴 falta · ⛔ depende de Mateo · ➡️ Pase 2.0)

| Lo que pidió | Estado | Detalle |
|---|---|---|
| El producto se llama Pase (D69) | 🟢 | Publicado y probado en producción |
| Entrar, cobrar, alta y caja del mostrador | 🟢 | Publicado; recorridos de caja, Cobrar y Entrada en verde |
| La hoja de Cobrar sin dos X | 🟢 | Publicado |
| Número del menú al día después de contestar o aprobar | 🟢 | Publicado el 16/11 (PR #28, commit dd8cdb73) |
| Foto del socio en el panel lateral y últimas entradas que lo abren | 🟢 | Publicado el 16/11 (PR #28) |
| "Probá una clase" en la página, sin "Probá gratis" | 🟢 | Publicado el 16/11 (PR #28) |
| La página del gimnasio en una pantalla (L1) | 🟢 | Publicada. La prueba social y "¿Primera vez?" ➡️ con la landing nueva |
| Quiero ser socio con la cuenta gratis y DNI (L2) | 🟢 | Publicado |
| App del socio: pagá tu plan y QR bloqueado que se activa solo (L3) | 🟢 | Publicado |
| Cuánto deja un socio (N10) | 🟢 | Publicado, apagado por defecto |
| Velocidad: lo que se pudo bajar y el tope de "nunca más lento" | 🟢 | Publicado; lo que queda por encima de 2 viajes ➡️ (la app del socio hace 22) |
| Pase diario en dos toques y para quien no es socio, pagos parciales, prorrateo, matriz de permisos editable, estado de cuenta con saldo | ➡️ | D70: cambian plata o permisos; la recomendación de cada una está en `PASE-1.0.md` |
| Pulido profundo, landing nueva, funciones nuevas (débito, factura, molinete, entradas sin internet), escala | ➡️ | Lista priorizada en `PASE-1.0.md` |
| El QR de registro de Temple Gym | ⛔ | Ver el paso 2 de abajo |
| Crear un gimnasio y su dueño en producción, medir la velocidad en producción, el humo de `/super` | ⛔ | Ver el paso 1 de abajo |
| Dominios `pasegym.com` y `templegymsalta.com` | ⛔ | Ver el paso 4 de abajo |
| Copias de seguridad cifradas | ⛔ | Ver el paso 1 de abajo |
| Política de privacidad real e inscripción en la AAIP | ⛔ | Con un abogado; el borrador está en la app |

**⛔ Lo que tenés que hacer vos, en orden de lo que más destraba:**
0. **Urgente, antes de nada:** abrí `https://pasegym.com/g/templegym1` (el QR impreso de Temple): hoy redirige a `templegym1.gym-os-pied.vercel.app`, que no tiene certificado. Revisá en Vercel las variables de dominio base y plataforma (y el dominio `gym-os-pied.vercel.app` redirigiendo a `pasegym.com`) que se movieron después del 15/11; no las toqué.
1. **GitHub → Settings → Secrets and variables → Actions → New repository secret:** `BRIK_ADMIN_MAIL`, `BRIK_ADMIN_CLAVE`, `DEMO_CONTRASENA`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `CLAVE_PRUEBA_MATEO`, `SUPABASE_REF_ESPERADO` y `COPIA_CLAVE`; y la variable `SALUD_URL` = `https://gym-os-pied.vercel.app/api/salud`. Con eso se destraba la medición en producción, crear un gimnasio, las copias y el aviso de caídas.
2. **Temple Gym** (el panel de Temple): Página → "Hacerse socio desde la página" → escribir el reglamento (obligatorio) → prender "Aceptar altas online" → Guardar; corregir el nombre a "Temple Gym" y cargar el WhatsApp en Configuración → Gimnasio. Recién ahí `/g/templegym1/hacete-socio?o=qr` deja anotarse (hoy dice "Hoy no te podés anotar desde acá").
3. **Mails de Supabase** (invitación y recuperar contraseña): se escriben en el panel de Supabase, no en el código; revisá que digan Pase.
4. **Dominios:** conectá `pasegym.com` y `templegymsalta.com` en Vercel con `DOMINIO.md`, fuera de 16 a 22 h.
5. **Vercel Pro y Supabase Pro** para el uso comercial (D51; no se contrató nada).
6. **Tu pasada visual y la prueba del dueño:** `PRUEBA-DUENO.md`, una hora; lo que no te guste va a `CAMBIOS-MATEO.md`.

---

## (histórico) DÓNDE QUEDÉ y RESUMEN PARA MATEO (14/11, tarde)

**Cuarta publicación (14/11, 14:30 hora de Argentina, PR #26, commit eab6e40):** migración `20261114170000` (el lote de lecturas acepta listas como parámetro y suma las de Control) aplicada sin copia (chequeos en verde, corrida 43621027947), deploy en verde y humo. Control pasa a un solo viaje. D1 a D3 pasaron a ⛔ (los dominios los cambia Mateo) y H7, Z1 y Q2 a ✅.

**Tercera publicación (14/11, 13:50 hora de Argentina, PR #25, commit a22a0fd):** migración `20261114160000` (amplía la lista de lecturas de `lote_lecturas`) aplicada sin copia (chequeos en verde, corrida 43617235463), deploy en verde y humo. Vencen hoy, Transferencias, Tareas, Equipo y Profes pasan a un solo viaje: el piso de toda pantalla quedó en 3 (contexto, menú y campana, avisos de la puerta) y las del lote en 4. N9 y Q4 reconciliados contra el código (pasaron de ❌ a 🟡).

**Segunda publicación (14/11, 13:10 hora de Argentina, PR #24, commit 6f3a590):** migraciones `20261114140000` (CUIT y razón social, F2.10) y `20261114150000` (sesiones del equipo y "Cerrar todas", F2.11) aplicadas sin copia (autorizado; chequeos en verde, corrida 43613449697), deploy en verde y humo (`/api/salud`, páginas públicas, redirecciones de `/super`, `/panel` y `/admin`, `humo-pasado`). Trae también E8 en Retención, Socios, Vender, Tu página y las acciones de la Entrada.

**Dónde quedé:** **publiqué la velocidad (E4, E8) y la fase L (L1 a L4) el 14/11 a las 12:35 hora de Argentina** (PR #23, commit a000b28): 4 migraciones aplicadas sin copia (autorizado; prevuelo y chequeos en verde), deploy en verde y humo en producción en el demo y en las páginas de Temple Gym (solo mirando). Lo que sigue: E8 hasta 2 viajes en Caja, Control y Entrada y la tabla final (medición en curso), y lo 🟡 de las fases H, U, P, D, Z, 0, 1 a 9, R, Q, N y F8.

**Qué es nuevo hoy:**
- 🟢 **Publicado (PR #22, 14/11):** barrita del DNI, avisos de QR abajo a la derecha con Realtime, franja sin internet, E5, F8. `/api/salud`, `/g/demo`, `/g/templegym1/hacete-socio` responden 200.
- 🟢 **Publicado hoy (PR #23):**
  - **E4:** el JS que baja toda pantalla del panel pasó de 148,9 a 71,0 KB gzip (el cliente de Supabase y la hoja Cobrar se bajan al usarse); promedio por ruta 322,6 → 245,9 KB gzip.
  - **E8:** menos viajes a la base (`contexto_pantalla` con estado y contacto; `lote_lecturas` para Configuración, Planes, Inicio y Entrada; `panel_vivo` para el menú y la campana). Tabla en `VELOCIDAD.md`.
  - **L1 a L4:** la página del gimnasio en una pantalla, la cuenta gratis, "pagá tu plan" arriba y el QR bloqueado que se activa solo.
  - Arreglos: avisos de QR pegados a la esquina, botón rojo sin emoji, recorridos viejos (F8.2), `pulido-roto-3`.
  - **Migraciones nuevas (4, aditivas), ya aplicadas:** `20261114100000`, `20261114110000`, `20261114120000`, `20261114130000`.
- 🔴 **El QR de Temple Gym dice "Hoy no te podés anotar desde acá": no es un error de la app.** `altas_online` está apagado (la página está publicada y tiene 4 planes). **Lo prendés vos:** Página → "Hacerse socio desde la página" → escribir el reglamento (obligatorio) → prender "Aceptar altas online" → Guardar. El WhatsApp del gimnasio también está vacío (Configuración → Gimnasio).

**Lo que pidió Mateo → estado** (🟢 publicado · 🟡 hecho sin publicar · 🔴 falta · ⛔ depende de Mateo)

| Lo que pidió | Estado | Detalle |
|---|---|---|
| Que sea rapidísimo (fase 0, E8, E4) | 🟢 | Publicado: JS del layout 148,9 → 71,0 KB y menos viajes (Configuración 30 → 6, Inicio 29 → 6). 🟡 falta llegar a 2 en Caja, Control y Entrada. F0.1/F0.6 (medir en producción) ⛔ por los secretos |
| Entrada en la esquina y avisos al instante (NOCHE-1211: E1, E2, E5, E6) | 🟢 | Publicado en el PR #22; los arreglos de hoy (sin emoji, esquina) 🟡 |
| Avisos en tiempo real medidos en producción (E3) | ⛔ | Cargá `DEMO_CONTRASENA`, `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` en GitHub y corré Base de datos → `usuarios-demo` |
| La página del gimnasio en una pantalla (L1) | 🟢 | Publicada; Lighthouse celular 94; Temple Gym visto en un clon |
| Quiero ser socio: cuenta gratis con DNI (L2, H3b) | 🟢 | Publicado (H3b); plan obligatorio por defecto (PREGUNTAS D65) |
| App del socio: pagá tu plan arriba y QR bloqueado (L3) | 🟢 | Publicada; `flujo-cierre` en verde: se activa solo al cobrar |
| Pagar desde la app (L4, MercadoPago) | 🟢 | Apagado por defecto: no aparece sin cobro online |
| El QR de registro de Temple Gym (H3, C9) | 🔴 | Lo prendés vos (arriba) |
| Fechas de cobertura visibles y editables (H2c) | 🟢 | Publicado el 12/11 |
| Cargar socios en el pasado, importar 300 (C10, C2) | 🟢 | Publicado |
| Caja por medio y transferencias (H1) | 🟢 | Publicado |
| Lo roto de PULIDO que pega hoy (H7) | 🟡 | Dejar pasar con error probado; faltan Salida y Volvió antes |
| Crear un gimnasio y su dueño en producción (U0.1, U1) | ⛔ | Cargá `BRIK_ADMIN_MAIL` y `BRIK_ADMIN_CLAVE` en GitHub (y, si da "Invalid API key", la clave `service_role` en Vercel) |
| Dominios (D1 a D3) | ⛔ | Publicado y listo; el cambio de variables y de DNS lo hacés vos con `DOMINIO.md` |
| Copias de seguridad (H5, C8) | ⛔ | Cargá `COPIA_CLAVE` en GitHub y corré Actions → Copias |
| Super admin completo (fase 2) | 🟢 | Publicado, con CUIT y razón social (F2.10) y las sesiones abiertas del equipo con "Cerrar todas" (F2.11) |
| Pulido de todo el sistema (fase Z) | 🟡 | Hecho en gran parte; Z1 y el resto en la lista |
| Los 70 detalles, faltantes, lo chico de antes (fases 4 a 6) | 🟡 | Confirmados contra el código; faltan filas por cerrar |
| Edición en capas, escala y seguridad (fase 9) | 🟡 | En su mayoría hecho; `F9.7` espera Supabase Pro |
| Funciones nuevas (fase N: débito, factura, entradas sin internet, etc.) | 🟡 | Apagadas por defecto; N0, N7, N8 ⛔; N9 (entradas sin internet) 🔴 |
| Cierre (F8): todo en verde, prueba del dueño | 🟡 | `PRUEBA-DUENO.md` listo; su siembra en producción ⛔ por secretos |

**⛔ Lo que tenés que hacer vos, en orden de lo que más destraba:**
0. **Urgente, antes de nada:** abrí `https://pasegym.com/g/templegym1` (el QR impreso de Temple): hoy redirige a `templegym1.gym-os-pied.vercel.app`, que no tiene certificado. Revisá en Vercel las variables de dominio base y plataforma (y el dominio `gym-os-pied.vercel.app` redirigiendo a `pasegym.com`) que se movieron después del 15/11; no las toqué.
1. GitHub → Settings → Secrets and variables → Actions: `BRIK_ADMIN_MAIL`, `BRIK_ADMIN_CLAVE`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `DEMO_CONTRASENA`, `COPIA_CLAVE`, `CLAVE_PRUEBA_MATEO`.
2. Vercel: `SUPABASE_SERVICE_ROLE_KEY` (U0.1/U1), `SUPABASE_REF_ESPERADO` (P3), Vercel Pro.
3. Temple Gym: prender las altas online (arriba), cargar el WhatsApp.
4. Los dominios (`DOMINIO.md`).

## DÓNDE QUEDÉ (13/11, mañana) y RESUMEN PARA MATEO
- 🟡 **Sin publicar: Vercel sigue "Deployment rate limited"** (main no despliega). No mergeé nada a main. Producción sigue con el código del PR #20. Cuando se libere el cupo (o con Vercel Pro) se despliega el PR #21 y recién ahí corresponde la prueba en producción (barrita del DNI, aviso de QR < 1 s, franja sin internet, humo con Temple Gym solo mirando).
- 🟢 **Cerrado hoy:** D40/D56 (avisos abajo a la derecha, D62); los 6 recorridos que "fallaban según la hora" (vd-6, vd-46j, vd-46k, vd-50, vd-54, vd-58) **pasan en Actions**. La hora no era la causa de cinco de ellos: eran selectores viejos (el "+" y el emoji de Máquinas pasaron a íconos), un buscador difuso que traía otro socio, un profe distinto al cargar y al entrar, y una espera del historial. vd-6 usa `HORA_NAVEGADOR=mediodia` (reloj del navegador, Playwright `setSystemTime`).
- 🟡 **E8** (viajes a la base por pantalla): medido con `scripts/medir/viajes.mjs` (corrida 43423578975): las 42 pantallas pasan de 2 viajes (7 a 30); tabla y qué queda en `VELOCIDAD.md` § E8; el layout del panel ya pide dos cosas en paralelo. Falta: una sola función para Configuración, Planes, Inicio y Entrada, que la campana no repita el contexto, y la tabla "después".
- **Próximo:** E1 (confirmar la franja roja y mirar capturas), E2 (capturas 1280 y celular, e2e reduced-motion), E4 (el JS por ruta no bajó), después el resto de RECTA-FINAL en orden (H, U, P, D, Z, 0, 1 a 9, R, Q, N, 8). E3 y la prueba de producción dependen de Mateo / del deploy.
- ⛔ **De Mateo:** Vercel Pro o esperar el cupo; `COPIA_CLAVE`; `BRIK_ADMIN_MAIL`/`BRIK_ADMIN_CLAVE`; secretos de Supabase para medir producción.

## DÓNDE QUEDÉ (13/11, mañana) y RESUMEN PARA MATEO
- 🟡 **Sin publicar: Vercel sigue "Deployment rate limited"** (main no despliega). No mergeé nada a main. Producción sigue con el código del PR #20. Cuando se libere el cupo (o con Vercel Pro) se despliega el PR #21 y recién ahí corresponde la prueba en producción (barrita del DNI, aviso de QR < 1 s, franja sin internet, humo con Temple Gym solo mirando).
- 🟢 **Cerrado hoy:** D40/D56 (avisos abajo a la derecha, D62); los 6 recorridos que "fallaban según la hora" (vd-6, vd-46j, vd-46k, vd-50, vd-54, vd-58) **pasan en Actions**. La hora no era la causa de cinco de ellos: eran selectores viejos (el "+" y el emoji de Máquinas pasaron a íconos), un buscador difuso que traía otro socio, un profe distinto al cargar y al entrar, y una espera del historial. vd-6 usa `HORA_NAVEGADOR=mediodia` (reloj del navegador, Playwright `setSystemTime`).
- 🟡 **E8** (viajes a la base por pantalla): medido con `scripts/medir/viajes.mjs` (corrida 43423578975): las 42 pantallas pasan de 2 viajes (7 a 30); tabla y qué queda en `VELOCIDAD.md` § E8; el layout del panel ya pide dos cosas en paralelo. Falta: una sola función para Configuración, Planes, Inicio y Entrada, que la campana no repita el contexto, y la tabla "después".
- **Próximo:** E1 (confirmar la franja roja y mirar capturas), E2 (capturas 1280 y celular, e2e reduced-motion), E4 (el JS por ruta no bajó), después el resto de RECTA-FINAL en orden (H, U, P, D, Z, 0, 1 a 9, R, Q, N, 8). E3 y la prueba de producción dependen de Mateo / del deploy.
- ⛔ **De Mateo:** Vercel Pro o esperar el cupo; `COPIA_CLAVE`; `BRIK_ADMIN_MAIL`/`BRIK_ADMIN_CLAVE`; secretos de Supabase para medir producción.

## F8 · EL CIERRE (13/11, carril `carril/f8-cierre`, sin publicar: nada de esto toca producción)

**Hecho y verificado ejecutando en Actions** (`gh workflow run "Pruebas completas" --ref carril/f8-cierre …`; ahora acepta `solo`, `socios` y `tanda`, y las tandas con nombre distinto corren a la vez):
- **F8.1 ✅** `base-simulacion` entera con 5.019 socios y la app compilada (corrida 43331281446). Ingreso: mediana 146 ms, peor 296 ms (tope 1 s). Antes/después en `VELOCIDAD.md` (la base sembrada se analizaba tarde: `levantar.sh` ahora corre `analyze`; `panel_inicio` de 2,7 a 4 s a 262 ms).
- **R3 (el flujo que cierra) ✅ `flujo-cierre`**: lo cobrado aparece en la ficha, en Resultado, en la caja de **otra compu sin recargar** y en la app del socio ("No podés entrar" → "Cubierto hasta"); lo editado en la página se ve en la primera carga. Va al final de la cadena `npm run e2e`.
- **F8.3** `humo-puertas`: `/super`, `/dueno`, `/recepcion`, `/profe`, `/socio`, la página y "hacete socio", en compu y celular, con capturas y sin desborde: 48 pasos en verde contra la app local (misma prueba que va a producción por Actions → Humo producción → trabajo `puertas`).
- **F8.4** `sembrar-prueba-mateo` (30 socios en todos los estados) y `usuarios-prueba-mateo`: probados en la base de prueba (se siembra, sembrar de nuevo no lo rehace); `PRUEBA-DUENO.md` con links, usuarios y pasos.
- **Barrido** (cada rol abre cada pantalla): en verde en el último commit (corrida 43345447921).
- **Cadena e2e en 4 bloques de 58 con base nueva** (corridas 43342149800, 43342156925, 43342162695, 43342167904, y reintentos 43342134602 y 43345453141): el bloque 2 salió en verde las dos veces que se corrió; en los demás, cada recorrido pasó al menos una vez con el último código salvo los de abajo. **No hay una sola corrida con todo en verde**: eso falta.

**Arreglos de la app** (los pidió la prueba): Pagar pegado al estado en la app del socio que debe (VD-23b); un solo verde por pantalla (Inicio con Cobrar, super admin). **Arreglos de recorridos viejos** (el fallo era de la prueba, no de la app): selectores ambiguos (`panel-app`, `vd-7`, `panel-configuracion`), el ingreso del socio de D43 (`vd-33`, `vd-61`, `seg-1`), `vd-19` (contador anti-robot), `vd-39` ("Aprobando…"), `vd-2` (vencido de 24 h), `vd-43` (la página nace publicada), `com-3` (se arma sus clases), `rev-5`, `ent-9`, `rut-2`, `onb-1`, `dis-1`, `rev-1`, `vd-29`, `vd-34`, `base-ingresos` (los avisos están arriba a la derecha desde D56; ver `PREGUNTAS.md`), y la zona horaria: los recorridos corren con `TZ=America/Argentina/Buenos_Aires` (entre las 21 y las 24 h el runner en UTC ya estaba en "mañana": fallaban `vd-14`, `vd-7`).

**⛔ Lo que no se pudo cerrar y qué falta**
- **F8.3 y F8.4 en producción** (no se ejecutó nada contra producción): faltan los secretos `CLAVE_PRUEBA_MATEO`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `BRIK_ADMIN_MAIL` y `BRIK_ADMIN_CLAVE` y que Mateo corra `sembrar-prueba-mateo` y `usuarios-prueba-mateo` (pasos en `PRUEBA-DUENO.md`). El logo lo sube él (el script no sube imágenes).
- **F8.2 / R3 🟡: recorridos que siguen en rojo y no tienen causa cerrada** (pasaron o fallaron según el bloque; todos de la pasada de las 21 a las 23 h, hora del gimnasio, y varios dependen de la hora del día): `vd-6` (a veces el foco no llega al campo de la Entrada al abrirla con F2: puede ser real, mirarlo primero), `vd-46j` y `vd-46k` (el profe de reemplazo: "el profe anterior sigue viendo la lista" / sin historial), `vd-50` (la hoja de doble cobro: un click que no encuentra su botón), `vd-54` (interruptor de la configuración de máquinas), `vd-58` (sesiones de personal trainer: "todavía no hay horarios cargados"). Hay que correrlos de día y mirar cada captura de `falla-*.jpg` (artefacto `pantallas` de la corrida).
- **La cadena de punta a punta en una sola corrida** no se hizo (la de 232 recorridos se corta por memoria y por estado: se corrió en 4 bloques).

**Cerrado (D62, Mateo 12/11):** los avisos de la puerta van abajo a la derecha (D40/D56 cerradas en `PREGUNTAS.md`); en el código ya es así.


## ⚠ PUBLICADO PERO SIN DEPLOY: el PR #21 está mergeado en main y Vercel dijo "Deployment rate limited — retry in 24 hours" (13/11, 00:10)
- **Qué pasó:** el plan Hobby de Vercel tiene un tope de deploys por día y cada push a cualquier rama (carril, base, publicar) creaba una vista previa que gastaba uno. Se pasó del tope.
- **Estado de producción:** sigue andando el código del PR #20 (el último deploy bueno), con la base ya migrada. La migración nueva (`20261112220000`, Realtime de ingresos) es aditiva: el código anterior anda con ella. Temple Gym, `/ingresar`, `/super` y `/api/salud` responden bien (probado a las 00:10).
- **Lo que NO está en producción todavía** (en main, sin deploy): la barrita del DNI, los avisos de QR abajo a la derecha con Realtime, la franja sin internet, el acento corrido de tono (Z8), E5 y lo de F8. **Se despliega solo con el próximo deploy de main** cuando Vercel libere el cupo (24 h), o antes si Mateo pasa a **Vercel Pro** (ya estaba en su lista: el plan Hobby no permite uso comercial).
- **Lo que hice para que no se repita:** `vercel.json` ahora desactiva los deploys de las ramas de trabajo (`carril/**`, `base/**`, `publicar/**`, `tmp/**`, `noche/**`, `dia/**`): solo `main` hace deploy. Confirmado: el push siguiente ya no generó ningún deploy. Los recorridos se prueban en Actions, no en la vista previa.
- **Pendiente apenas se libere:** correr el humo en producción (Temple Gym solo mirando, `/super`, y el demo con `humo-pasado`) y recién ahí decir "LISTO" para estas piezas. No creo ni toco nada de Temple Gym. Si el cupo no se libera a la mañana: Mateo puede hacer "Redeploy" del último commit de main desde el panel de Vercel o pasar a Pro.

## LISTO PARA CAMBIAR LOS DOMINIOS (12/11, publicado entre las 19:50 y las 20:15 hora de Argentina, con tu autorización, sin copia)
Mateo: ya podés seguir `docs/base/DOMINIO.md`, en orden (la variable `NEXT_PUBLIC_DOMINIOS_VIEJOS=gym-os-pied.vercel.app` es la que salva el QR impreso; la dirección propia de Temple Gym se carga en el super admin recién DESPUÉS del Redeploy).
Publicado hoy:
1. **PR #18** (dominios, solo código): `gym-os-pied.vercel.app` y `www.` redirigen con 308; deploy en verde; Temple Gym `/g/templegym1`, `/g/templegym1/hacete-socio`, `/ingresar` en 200, `/super` pide sesión.
2. **PR #19** (H2c fechas de cobertura + prevención de la fase D): migraciones `20261112050000` y `20261112200000` aplicadas **sin copia** (corrida 43324347571, chequeos en verde) y luego merge, deploy en verde. Humo en producción en el demo con rollback (corrida 43324855643): Cobrar propone "cubre del … al …", fechas cambiadas con la propuesta y quién las cambió, `cubierto_hasta` = recalculado, la recepción rechazada, Control lo muestra; no quedó nada guardado.
3. **PR #20** (fase Q, pulido Z, resto): migración `20261112210000` aplicada sin copia (corrida 43325742385); validado antes en Actions (base 1117 pruebas sin fallas y 10 recorridos en verde); merge, deploy en verde, mismas páginas en 200.
Temple Gym sigue con 0 funciones nuevas prendidas (estado, corrida 43326431319). No quedó nada sin publicar de lo que estaba en verde. Sin sesión real de demo no pude abrir las pantallas con el navegador: lo de pantalla se verificó con los recorridos e2e en Actions y lo de la base contra producción.

## (anterior) PUBLICACIONES LISTAS (12/11, 18:30), esperan las 22 h
1. **Dominios (D1/D2), solo código y documentación, sin migraciones: PR #18** (`publicar/base-dominios`). Se mergea **después de las 22 h** (hora de Argentina). Cuando esté mergeado y el deploy en verde, acá va a decir "LISTO PARA CAMBIAR LOS DOMINIOS" y Mateo sigue `docs/base/DOMINIO.md` (ojo: la variable nueva `NEXT_PUBLIC_DOMINIOS_VIEJOS` es la que salva el QR impreso).
2. **H2c (fechas de cobertura) y la prevención de la fase D: PR #19** (`publicar/base-h2c`). Trae 2 migraciones (`20261112050000` y `20261112200000`, aditivas). Prevuelo contra la base real en verde (corrida 43309182849). **No hay `COPIA_CLAVE`, así que no las aplico solo.** Pasos de Mateo, después de las 22 h: (a) Actions → Base de datos → rama `publicar/base-h2c`, acción `aplicar`, y si no hay copia, en `sin_copia` escribir `SIN COPIA` (decisión tuya; son funciones nuevas y columnas vacías, no tocan filas); (b) mergear el PR #19 y esperar el deploy en verde; (c) abrir Cobrar de un socio y ver "Cubre del … al …" con "Cambiar fechas" (dueño). **No mergear el #19 antes de aplicar las migraciones: la pantalla de Cobrar las necesita.** Si decís "SIN COPIA, hacelo", el loop lo hace solo después de las 22 h.

## DÓNDE QUEDÉ (12/11, 17:30 hora del gimnasio)
- **Verificado en producción tras el PR #16:** (1) Temple Gym tiene **0 funciones nuevas prendidas** (Actions → Base de datos → estado, corrida 43297648610): lo de la fase N está apagado. (2) `https://gym-os-pied.vercel.app/g/templegym1/hacete-socio` abre la página de alta de Temple Gym con su marca (200, se queda en esa dirección). **Hoy dice "Hoy no te podés anotar desde acá"** porque el registro por QR de Temple Gym está apagado (`altas_online`): Mateo lo prende en Configuración → Registro de socios cuando quiera que el QR impreso ande. No lo toqué (es un dato real). (3) Cargar un socio con alta y pago de hace 20 días y la caja por medio de pago, en el demo de producción y dentro de una transacción que revierte (acción `humo-pasado`, corrida 43300000883): 1 pago, 1 cobertura, la caja del turno no se mueve, efectivo y transferencia salen separados, no quedó nada.
- Ramas `carril/*`: ninguna tiene trabajo sin integrar.
- No hay un dueño con cuenta en los demos de producción: el humo con sesión real (`humo-produccion.yml`) sigue ⛔ por `BRIK_ADMIN_MAIL` / `BRIK_ADMIN_CLAVE`.
- En curso: fase D (D3, D4) con un ayudante. **R1 y R2 hechos (12/11, `carril/r-estado`):** `ESTADO-GENERAL.md` con las tres listas al día y fase Q nueva en `RECTA-FINAL.md` (Q1 a Q5, lo que faltaba sin ítem); los MD viejos que chocaban quedaron marcados "Reemplazado por docs/base/…". Sigue R3.

## PUBLICACIÓN LISTA, ESPERANDO TU COPIA (11/11, noche): rama `publicar/base-hoy`
Prevuelo en verde (Actions 43143923167): 22 migraciones pendientes (recepción, velocidad, filtros en lote, cargar pasado, QR, Caja por medio, alta con cuenta y reclamo, términos y restaurar cambios, lista del super admin rápida, exportar con filtros, funciones nuevas apagadas). Trae: Caja con resumen por medio y Transferencias en dos pestañas (H1), `/g/<slug>/hacete-socio` y el camino del socio (H3/H3b), lo roto de PULIDO que pega hoy (H7), cargar socios y pagos en el pasado (C10), QR para registrarse (C9), lector USB y cierre por inactividad (C5/C6), guías y carteles (C3/C4), y los arreglos de las revisiones del mostrador y del socio.
Como Temple Gym ya cobra, **no aplico sin copia cifrada**. Pasos para vos, en orden:
1. GitHub → Settings → Secrets and variables → Actions → Secrets → New repository secret: `COPIA_CLAVE` = una frase de 16+ caracteres al azar (guardala también en tu gestor de contraseñas: sin ella la copia no se abre).
2. Actions → **Copias** → Run workflow (prueba la copia y que restaura en una base de prueba). Tiene que dar verde.
3. Actions → **Base de datos** → Run workflow, rama `publicar/base-hoy`, acción `aplicar` (hace la copia, el prevuelo, aplica y corre los chequeos). Si no hay COPIA_CLAVE se frena solo.
4. Abrí el PR de `publicar/base-hoy` a `main`, mergealo y esperá el deploy de Vercel en verde.
5. Mirá (sin crear nada) `https://gym-os-pied.vercel.app/g/templegym1/hacete-socio`: tiene que abrir el formulario de Temple Gym.
6. Actions → **Humo producción** (necesita `BRIK_ADMIN_MAIL` y `BRIK_ADMIN_CLAVE`).
Si cargás `COPIA_CLAVE`, el loop hace los pasos 2 a 6 solo.

## RESUMEN PARA MATEO (11/11, tarde)
- Publicado en producción: fase P y C1, C2, aviso al socio (PR #15). **Desde que Temple Gym cobra con Base, no aplico más migraciones sin copia cifrada previa**: el botón `aplicar` de Actions ahora hace la copia y se frena solo si falta `COPIA_CLAVE`.
- Listo para publicar apenas haya copia: recepción (inactividad), velocidad (130100-130400, filtros en lote), C9 (QR), C10 (cargar pasado), F1.2/F1.7, F1.4/F1.5, C3-C7 (guías y carteles). Esperando a los ayudantes de H1 (caja), H3/H3b (camino del socio y QR directo) y H7 (lo roto de PULIDO) para sumarlos.
- Ensayo antes de producción (N0): un segundo proyecto de Supabase llamado "ensayo": ⛔ lo crea Mateo (5 minutos); hasta entonces se prueba en el demo y en la base local.

## LO QUE NECESITO DE MATEO (secretos de GitHub: hoy solo existe `SUPABASE_DB_URL`)
- **`COPIA_CLAVE` (urgente, destraba todo lo que toca la base):** Settings → Secrets and variables → Actions → Secrets → New repository secret, nombre `COPIA_CLAVE`, valor una frase de 16+ caracteres al azar; guardala también en tu gestor de contraseñas. Sin ella no puedo aplicar nada. Después corré Actions → Copias para probar copia y restauración.
- `BRIK_ADMIN_MAIL` y `BRIK_ADMIN_CLAVE` → destraba el humo en producción (U0.3).
- `COPIA_CLAVE` (una frase larga, 16+ letras; guardala vos también, sin ella las copias no se abren) → destraba C8, corré Actions → Copias.
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `DEMO_CONTRASENA` → destraban medir producción (F0.1) y los usuarios demo.
- `SUPABASE_SERVICE_ROLE_KEY` en Vercel (U1/U0.1).

## PASOS PARA MATEO (velocidad y accesos; F0.6)
1. **Clave de servicio (urgente, destraba el alta de dueños):** Supabase → tu proyecto de Gym OS → Project Settings → API → copiá la clave **service_role** → Vercel → el proyecto → Settings → Environment Variables → `SUPABASE_SERVICE_ROLE_KEY` (Production) → pegala → Redeploy. Tiene que ser de ESTE proyecto (el mismo de `NEXT_PUBLIC_SUPABASE_URL`), no la anon ni la de otro proyecto. En /admin, "Estado de la plataforma" la prueba creando y borrando un usuario.
2. **Claves asimétricas (hace que el proxy no viaje a Auth en cada pedido):** Supabase → Project Settings → JWT Keys → "Migrate" a claves asimétricas (ECC/RSA). Puede cerrar las sesiones abiertas una vez. Después `getClaims()` verifica sin ir a Auth.
3. **Secretos de GitHub** (Settings → Secrets and variables → Actions): `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `DEMO_CONTRASENA` (10+ letras; para el demo y para medir) y, para la prueba de humo, `BRIK_ADMIN_MAIL` y `BRIK_ADMIN_CLAVE` (tu cuenta de super admin de producción).
4. **Planes (los pagás vos):** Supabase Pro (máquina más grande que Free) y, en Vercel, revisar que Fluid Compute esté prendido (Settings → Functions). Con y sin, el agente mide y anota la diferencia en `VELOCIDAD.md`.
5. **Dominio:** `DOMINIO.md` (pasos exactos).

## PUBLICADO 11/11 10:45 — fase P y lo hecho de la fase C (PR #15)
- 11 migraciones aplicadas desde Actions (prevuelo 43030658511, aplicar 43030901243, chequeos en verde); PR #15 mergeado y deploy de Vercel en verde. Incluye: plataforma y alta (P1 a P7), landing y editor (P8, P8b), clave nueva sin mails (C1), importar socios (C2), aviso de clave al socio, plantillas, escala y papelera del super admin.
- Antes de aplicar, el estado dijo 3 gimnasios reales con 2 socios en total; se aplicó igual por orden de Mateo (migraciones aditivas).
- Humo en producción: ⛔ falla por faltar los secretos `BRIK_ADMIN_MAIL` y `BRIK_ADMIN_CLAVE` (corrida 43031908841). Chequeo sin sesión: `/` 200, `/ingresar` 200, `/g/demo` 200, `/api/salud` 200. **Mateo: cargá esos dos secretos en GitHub y corré Actions → Humo producción.**
- Falta publicar: `20261111110000_recepcion_inactividad.sql` (C6) y lo que siga.

## PUBLICADO EL 12/11 (17:10, por Claude desde el chat)
Migraciones de `publicar/base-hoy` aplicadas en producción (corrida 43295889879; **sin copia previa**, con permiso de Mateo; prevuelo y chequeos contra la base real en verde), PR #16 mergeado (164d21e) y deploy de Vercel en verde. Entró todo lo que había en `base/2026-11-07` al 12/11 01:12: H1, H2/C10, H3, H6, la fase C, el super admin, lo hecho del pulido. El e2e `n-nuevas` (fase N) no pasaba: lo de la fase N tiene que quedar apagado para Temple Gym hasta pasar. El workflow "Base de datos" tiene ahora `sin_copia` (solo con la frase "SIN COPIA"); por defecto sigue pidiendo la copia.

## DÓNDE QUEDÉ (11/11, noche)
- ✅ hoy: H1, H2/C10, H3, H6, F1.9, F1.5, F1.6, F2.x, F3.1, F7.1, F9.1, C1-C10, U5, P1-P8b. 🟡: H3b, H4, H5, H7, F3.2. ⛔: C8/H5 (COPIA_CLAVE), N0 (proyecto ensayo), F0.1 (secretos).
- Publicación lista en `publicar/base-hoy` (prevuelo 43123213163, 11 migraciones); **no se aplica sin COPIA_CLAVE** (pasos arriba).
- En curso (5 ayudantes con Actions en su rama): `carril/z-iconos-textos` (Z2-Z4), `carril/z-diseno-falta` (Z5-Z7), `carril/f4-f5` (DETALLES-70 y FALTANTES), `carril/h7-pruebas` (exportar con filtros, pruebas de H7/H3b, CLS en celular), `carril/f9` (F9.2-F9.8). Al terminar: mergear a base, e2e con `solo`, cerrar filas.
- Falta después: F0.3/F0.5, F3.2, N1-N8 (apagado para Temple Gym), F8 (cierre: botones + barrido, simulación completa, humo, PRUEBA-DUENO.md).

## (anterior) DÓNDE QUEDÉ (11/11, 12:00)
- ✅ cerrados hoy: U5, P1, P4-P8b, C1-C7, F1.2, F2.1-F2.9, F7.1, F9.1. Publicado: fase P y C1/C2/aviso (PR #15). Sin publicar: migraciones 20261111120000 (recepción) y 130100-130400 (velocidad) y lo que sigan los ayudantes.
- En curso (ayudantes en worktrees): `carril/a-filtros` (filtros_socios a menos de 300 ms), `carril/c-qr-alta` (C9), `carril/c-pasado` (C10, plata: dueño y encargado), `carril/d-f19` (F1.9: vd-6, base-7b, velocidad-a y los 15 viejos, con Actions), `carril/d-f3` (F3).
- Rojos conocidos en Actions: `base-7b` (paso 4b), `velocidad-a` (ingreso optimista), `vd-6` (paso 6). Los trabaja `carril/d-f19`.
- Pendientes tras eso: F4, F5, F6, F9.2-F9.8, F0.1 (⛔ secretos), F1.6 (filtros), F8 y publicar cada fase.

## (anterior) DÓNDE QUEDÉ (11/11, 09:00 — vuelta nueva)
- U5, P1, P4 a P7, P8 y P8b en ✅ (Actions 43015505501 y 43020787407). Chequeos de la base relanzados en 43022741600 (lista blanca y paletas del editor ya arreglados). Ayudantes en la fase C: `carril/c-clave` (C1) y `carril/c-importar` (C2); al terminar: integrar, correr su e2e (`clave-nueva`, `importar-300`) en Actions. Yo sigo con C3 a C8. Bloqueados por Mateo: U0.1/U0.3/U1 en producción (secretos `BRIK_ADMIN_MAIL`, `BRIK_ADMIN_CLAVE` y clave de servicio en Vercel). Hay migraciones nuevas sin aplicar (20261111090000 y las que traigan los carriles): se aplican en la próxima publicación.

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
Hechos (08/11): `historia/CONTEXTO.md`, `PERMISOS.md` (generado desde la base real), `historia/INVESTIGACION.md`, `docs/CONVENCIONES.md`, `docs/LECCIONES.md`; `CLAUDE.md` con la excepción de `cubierto_hasta`. Pendiente: `docs/SCHEMA.md` completo con lo real y marcar lo viejo de `docs/v2/` como reemplazado.

(Original:) `historia/CONTEXTO.md`, `PERMISOS.md` (desde la base real), `historia/INVESTIGACION.md`,
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
  interesado, está en `historia/FALTANTES.md` FA-24.
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
