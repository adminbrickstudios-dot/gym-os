# Velocidad: diagnóstico con números

Lo llena el agente en BASE-1. **Primero se mide, después se toca.** Cada
arreglo tiene su número antes y después en la misma fila.

Cómo se mide:
- App compilada (`APP_MODO=produccion`), demo con 5.000 socios y 100.000
  ingresos (`npm run sembrar:demo -- --socios 5000 --ingresos 100000`; si
  `--ingresos` no existe, se suma).
- "Tiempo" = desde el toque hasta que se ve el dato (Playwright con
  `performance.now()`), mediana de 10, en compu y en celular emulado con red
  4G. Además, la función de base sola (`scripts/medir/explain.mjs`).
- En producción, lo mismo contra el demo publicado, para ver el efecto de la
  región (sin datos reales).

## Dónde corre cada cosa

| Qué | Dónde está | Cómo se vio |
|---|---|---|
| Vercel (región de las funciones) | Las funciones corren en **iad1 (Washington, EE.UU.)**; el borde que atiende es gru1 (São Paulo) | Cabecera `x-vercel-id: gru1::iad1::…` de `https://gym-os-pied.vercel.app/ingresar` (08/11). No hay `vercel.json`: la región es la de por defecto. |
| Supabase (región) | **Sin confirmar**: el proyecto de Gym OS no aparece en la cuenta conectada por MCP (los dos proyectos visibles están en sa-east-1 pero no tienen las tablas de Gym OS) | Mateo: Supabase → proyecto de Gym OS → Settings → General → Region |
| Plan de Vercel | | |
| Plan de Supabase | | |

## Tiempos

| Pantalla o acción | Objetivo | Antes (local) | Antes (producción) | Después (local) | Después (producción) | Qué se cambió |
|---|---|---|---|---|---|---|
| Ingreso (login) | < 2 s | | | | | |
| Inicio del dueño | < 2 s | | | | | |
| Recepción | < 2 s | | | | | |
| Buscar un socio | < 1 s | | | | | |
| Registrar un ingreso (Enter → aviso) | < 1 s | | | | | |
| Ficha / panel lateral | < 2 s | | | | | |
| Página del gimnasio | < 2 s | | | | | |
| App del socio | < 2 s | | | | | |
| Vencen hoy | < 2 s | | | | | |
| Socios (lista) | < 2 s | | | | | |

## Lo que se revisó

| Revisión | Resultado | Acción |
|---|---|---|
| ¿El proxy/middleware va a la base en cada pedido? ¿Cuánto tarda? | | |
| Funciones de pantalla con `EXPLAIN ANALYZE` (> 300 ms) | | |
| RLS con `auth.uid()` evaluado fila por fila | | |
| Consultas N+1 (una por fila) | | |
| Índices que faltan (gimnasio, DNI, nombre con `unaccent`, fechas) | | |
| Vigencia calculada al leer en listas (→ `cubierto_hasta`, BASE-5) | | |
| JS por ruta (`next build`) | E4 (13/11): promedio de 57 rutas del panel, 252,0 KB gzip antes y 255,8 KB después; `/panel` 826,1 → 837,1 KB sin comprimir | Partir `VentanaEntrada` con carga diferida no alcanzó: lo que salió del primer JS (alta rápida, prueba gratis, dejar pasar, comprobante) es poco frente a lo que se sumó (barrita, franja sin internet). Lo que pesa de verdad es el resto del layout (~250 KB gzip por ruta). Siguiente paso: un análisis de paquetes del layout del panel (E8) |
| Imágenes | | |
| Re-renders que se notan | | |


## Hallazgo 1 (08/11): región de las funciones
Si Supabase está en **sa-east-1 (São Paulo)**, cada consulta de una pantalla cruza el continente dos veces (Washington ↔ São Paulo, ~120-140 ms de ida y vuelta) y una pantalla con 6 a 10 consultas en serie suma casi un segundo solo en viajes. El arreglo es de una línea: `vercel.json` con `{"regions": ["gru1"]}`. **No se aplica sin saber la región de Supabase** (si estuviera en EE.UU. empeoraría). Paso para Mateo: confirmar la región y decirlo; el agente deja listo el commit.

## Medición con 5.000 socios y 200 gimnasios (Actions, 08/11, corrida 42495312345, rama base/2026-11-07)
Función de base sola (`explain analyze`, con el rol correcto). Presupuesto: 300 ms; `pendientes_panel` 50 ms.

| Función | Rol | ms | Presupuesto | |
|---|---|---:|---:|---|
| estado_acceso (calcular_acceso) | recepción | 0,6 | 300 | ok |
| registrar_ingreso | recepción | 1,2 | 300 | ok |
| ingresos_del_dia / ultimas_entradas | recepción | 0,4 / 0,3 | 300 | ok |
| buscar_socios (sin filtro / texto / al día / nuevos / bajas) | dueño | 12,8 / 25,0 / 36,9 / 15,3 / 7,8 | 300 | ok |
| ficha_socio | dueño | 1,2 | 300 | ok |
| panel_gimnasio | dueño | 0,3 | 300 | ok |
| resumen_dueño / resultado_mes / ganancia_mes / linea_de_control / campana_panel | dueño | 9,6 / 25,1 / 0,9 / 7,3 / 8,5 | 300 | ok |
| retencion_periodo (mes) / retencion_numeros / tablero_retencion | dueño | 34,9 / 78,3 / 235,4 | 300 | ok |
| **numeros_inicio** | dueño | **1796,3** | 300 | PASADO → arreglado abajo |
| filtros_socios | dueño | 882,0 | 300 | PASADO |
| exportar_socios | dueño | 1051,8 | 300 | PASADO (es una descarga, no una pantalla) |
| vencen_hoy / vencen_pestanas | dueño | 438,9 / 452,6 | 300 | PASADO |
| retencion / retencion_resumen | dueño | 441,4 / 441,5 | 300 | PASADO |
| panel_inicio | dueño | 446,3 | 300 | PASADO |
| pendientes_panel (dueño / recepción) | | 385,5 / 306,6 | 50 | PASADO |
| para_hacer_hoy | dueño | 308,2 | 300 | PASADO |

**Lo que dice la tabla.** La puerta (buscar, ver el veredicto, registrar un ingreso) tarda **menos de 40 ms** con 5.000 socios: el objetivo de "buscar y registrar en menos de 1 s" se cumple con mucho margen y no hace falta tocar `calcular_acceso`. Lo lento son las listas que recorren a todos los socios: la causa común es `privado.retencion` (~440 ms), que calcula el veredicto completo de cada socio vencido.

**Las pantallas medidas en Actions (`tiempos.mjs`) corren en modo desarrollo** (compila al abrir): ~1,5 s hasta la pantalla más simple, así que no sirven para el objetivo de 2 s; esa medida se hace con la app compilada (pendiente, en la compu de Mateo o con un runner que haga `next build`).

## Arreglos y su antes/después
| Qué | Antes | Después | Cómo |
|---|---|---|---|
| `numeros_inicio` (regresión de BASE-4: 4 recorridos de Retención) | 1796 ms | **465 ms** (corrida 42496822825, misma base de 5.000 socios) | migración `20261108050200_numeros_inicio_una_pasada` |
| **Retención con `cubierto_hasta` (F1.6 / F0.3, carril C, 10/11).** Escala: **5.019 socios, 134.500 ingresos y 200 gimnasios chicos** en Actions (mismo runner, misma base). Los "antes" son la copia de la cuenta vieja (`privado.retencion_referencia`) corrida en esa misma base; migraciones `20261109010100` a `010300` | | | |
| · Pendientes: `retencion_liviana` filtrada a 3 listas → `retencion_pendientes` (consulta por socio con índices) | 295 ms | **49 ms** | arranca de los socios con `cubierto_hasta > ahora`; sin uniones entre listas grandes |
| · 3 listas livianas (`numeros_inicio`) → `retencion_listas` | 295 ms | **185 ms** | los socios vencidos no se recorren |
| · solo `por_vencer` (`vencen_hoy`, `panel_inicio`) → `retencion_listas` | 431 ms | **166 ms** | pide solo esa lista |
| · Retención completa (`retencion`, `retencion_resumen`, `vencen_pestanas`) | 434 ms | 433 ms | **igual**: lo caro es `via_membresia` por cada vencido (deuda y texto); no se tocó para no mover ningún veredicto |
| Región de las funciones de Vercel | iad1 (Washington) con Supabase en São Paulo | gru1 | `vercel.json` `{"regions":["gru1"]}` (Mateo confirmó São Paulo) |
| Vigencia guardada `socios.cubierto_hasta` + índice `(gimnasio_id, cubierto_hasta)` | — | disponible para las listas | BASE-5, migración `20261108050100` |

**Cómo se garantiza que ningún veredicto cambió.** `privado.retencion_referencia` es una copia de la función de antes (solo la usa la prueba). `supabase/pruebas/retencion-cubierto.test.mjs` compara, con 18 momentos fijos (de 45 días antes a 45 días después de HOY, a las 00:00 y a las 19:00), los casos testigo más 16 socios armados a propósito (huecos, coberturas futuras, encimadas, anuladas, bajas, sin pagos, nuevos, que dejaron de venir): `retencion_con` completa y liviana, `retencion_listas` en 8 combinaciones de listas, y `retencion_pendientes` (columnas, filas y orden) contra la de antes. Falla si difiere una sola fila. Además `pendientes_panel` se compara con la cuenta vieja de "vencen hoy". Pasa 7/7.


**Las pantallas, medidas con `medir-escala.yml` (corrida 42732049862, 5.019 socios, 134.500 ingresos, 200 gimnasios; el runner varió hasta 1,5×: la misma `retencion` dio 434 ms en otra corrida y 665 ms en esta).** Contra la medición del 08/11 (corrida 42495312345, antes de estas migraciones):

| Función (dueño) | 08/11 | Ahora | Presupuesto |
|---|---:|---:|---:|
| `pendientes_panel` | 385,5 ms | **89,6 ms** | 50 (todavía no) |
| `para_hacer_hoy` | 308,2 ms | **78,0 ms** | 300 ok |
| `panel_inicio` | 446,3 ms | **238,9 ms** | 300 ok |
| `vencen_hoy` | 438,9 ms | **233,8 ms** | 300 ok |
| `numeros_inicio` | 465 ms | 389,0 ms | 300 (todavía no; en runner más lento) |
| `vencen_pestanas` / `retencion` / `retencion_resumen` | 452,6 / 441,4 / 441,5 ms | 538,3 / 665,2 / 650,8 ms | 300 (sin cambio de código: es el runner y `via_membresia`) |
| `filtros_socios` | 882 ms | 1.323,9 ms | 300 (no se tocó; ver abajo) |

Ninguna función que se tocó empeoró respecto de producción; las que no se tocaron (`retencion` completa, `filtros_socios`) se ven más lentas solo por el runner. **Quedan sin cumplir:** `pendientes_panel` (90 ms: 49 son la consulta; el resto son las demás cuentas del menú) y `numeros_inicio` (389 ms; usa tres listas más `via` de `numeros` y sus propias cuentas). Siguiente paso posible para `pendientes_panel`: contar `vencen_hoy`/`vencen_pronto` desde las coberturas que terminan hoy, sin recorrer a nadie (no se hizo).

**F0.3, segunda pasada (corrida 42739155563, misma escala: 5.000 socios, 200 gimnasios).** `retencion_pendientes` ya no busca por socio quién tiene una cuota adelantada ni quién vino hace poco (una pasada cada una) y mira congelado/suspendido solo para quien cayó en una lista. Misma prueba viejo-vs-nuevo (7/7).

| Función | 08/11 | 1.ª pasada | 2.ª pasada | Presupuesto |
|---|---:|---:|---:|---:|
| `pendientes_panel` (dueño) | 385,5 ms | 89,6 ms | **52,9 ms** | 50 (por 3 ms) |
| `pendientes_panel` (recepción) | 306,6 ms | 75,6 ms | **45,3 ms** | 50 ok |
| `numeros_inicio` | 465 ms | 389,0 ms | **208,6 ms** | 300 ok |
| `panel_inicio` | 446,3 ms | 238,9 ms | **135,3 ms** | 300 ok |
| `vencen_hoy` | 438,9 ms | 233,8 ms | **134,6 ms** | 300 ok |
| `para_hacer_hoy` | 308,2 ms | 78,0 ms | **44,7 ms** | 300 ok |
| `retencion` (completa, sin tocar) | 441,4 ms | 665,2 ms | 316,8 ms | 300 (varía con el runner) |

## Lighthouse móvil de la página pública (F1.8 / F0; corrida 42991229889, app compilada, Lighthouse 12.6.1, mediana de 3)

| Pantalla | Performance | Accesibilidad | Buenas prácticas | SEO | LCP | CLS | TBT |
|---|---:|---:|---:|---:|---:|---:|---:|
| Landing `/` — **antes** | 91 | 100 | 100 | 100 | 3,37 s | 0 | 139 ms |
| `/hacete-socio` — **antes** | 93 | 100 | 100 | 91 (sin meta description) | 3,19 s | — | — |
| `/ingresar` (equipo y socio) — **antes** | no midió: falló las 3 corridas ("Command failed"); el script ahora imprime las últimas 15 líneas del error | | | | | | |

Lo que más bajaba: el elemento LCP, JavaScript sin usar, JavaScript "legacy" para navegadores modernos y bfcache bloqueado.
**Cambios de esta pasada (carril C):** meta description en `/hacete-socio` (SEO); se quitó la animación de entrada del contenido de la portada (un elemento que arranca en opacidad 0 retrasa el LCP); íconos de sección con `Icono`. **Pedidos al principal (archivos compartidos):** (1) `browserslist` moderno en `package.json` (o `experimental.browsersListForSwc`) para sacar el JavaScript "legacy"; (2) bfcache: las páginas dinámicas salen con `Cache-Control: no-store`, que bloquea el bfcache; probar en `next.config` `headers()` para `/`, `/hacete-socio` e `/ingresar` un `Cache-Control: private, no-cache` (si Next lo respeta) o en `src/proxy.ts`; (3) revisar qué elemento es el LCP en el informe JSON del artefacto (`.local/lighthouse/*.json`, auditoría `largest-contentful-paint-element`). **Después:** a completar con la próxima corrida de `lighthouse.yml`.

## Pendiente de BASE-1 (anotado)
- `retencion`, `retencion_resumen` y `vencen_pestanas` (completas): el costo es `via_membresia` por cada vencido; bajarlo exige cambiar cómo se calcula la deuda, y no se tocó en esta pasada para no arriesgar ningún veredicto.
- `filtros_socios` (880 ms con 5.000; ~2 s en la compu local con 1.500): el grupo de cada socio sale del veredicto completo (`calcular_acceso`: membresía, pases, packs, pausas); `cubierto_hasta` solo no alcanza para probar el resultado. Queda para una pasada propia con su prueba viejo-vs-nuevo.
- Medir las pantallas con la app compilada y 5.000 socios.
- No hace falta tocar: RLS con `(select auth.uid())`, índices de búsqueda y paginación (la búsqueda ya tarda menos de 40 ms).

## Hallazgo 2 (09/11): por qué se siente lento en producción, aunque la base sea rápida

En la base, cada función tarda poco: la puerta, menos de 40 ms con 5.000
socios. Lo lento está **alrededor**: cada pantalla del panel hace **6 a 8 viajes
a Supabase, uno detrás del otro**, antes de mostrar nada (leído en el código):

1. `proxy.ts`: `getClaims()`. Si el proyecto de Supabase todavía firma con la
   clave vieja (simétrica, HS256), la librería cae a `getUser()`: es un viaje a
   Auth en **cada pedido**. Más `gimnasio_por_host`, que está en caché solo
   dentro de la misma función de Vercel.
2. `contextoPanel()`: `getClaims()` otra vez, después `panel_gimnasio`, después
   `ver_mensajes_equipo` (recepción) y después `config_fichaje`. Son **tres
   viajes en fila**.
3. `panel/layout.tsx`: `estado_abono_panel` y las ayudas (en paralelo), y
   después `config_entrada` y `formas_de_entrada` (otro viaje).
4. La pantalla: sus propias funciones.
5. El menú: `pendientes_panel`, que tarda **300 a 385 ms** con 5.000 socios
   (presupuesto: 50 ms), en cada pantalla.

Además, Supabase Free corre en la máquina más chica y compartida, y Vercel
Hobby arranca en frío las funciones que no se usaron hace un rato.

Viajes de 40 a 80 ms, por 7 en fila, más los arranques en frío y el menú: uno
a dos segundos por toque.

## Plan de la fase 0 (`RECTA-FINAL.md` F0): que tocar y ver sea instantáneo

Objetivos (Mateo, 09/11: "rapidísimo, toco y al toque ya está, por debajo del
promedio"), **medidos en producción**, en celular con 4G:
- Primer cambio en pantalla al tocar: **menos de 50 ms**, siempre (estado
  apretado, esqueleto o cambio optimista).
- Datos de una pantalla del panel: **menos de 500 ms p75** y menos de 800 ms
  p95.
- Registrar un ingreso, de Enter al aviso: **menos de 300 ms p75**.
- Buscar un socio mientras se tipea: **menos de 150 ms** por tecla.
- Volver a una pantalla ya vista: **instantáneo**, sin viajes.
- Página del gimnasio y app del socio: LCP **menos de 1,5 s** en 4G y
  Lighthouse celular **95 o más**.
- Nada salta al cargar: CLS menor a 0,05.

1. **Medir de verdad, primero.**
   - `Server-Timing` en cada respuesta (proxy, auth y cada RPC con su nombre),
     y un log por pedido en Vercel.
   - Un workflow de Actions `medir-produccion.yml`: Playwright contra
     producción, con los usuarios del demo. Toca cada pantalla clave 10 veces y
     deja la tabla en el resumen de la corrida. Los runners de GitHub sí llegan
     a vercel.app.
   - Los usuarios del demo en producción se crean con el workflow
     `usuarios-demo`, con la contraseña como secreto `DEMO_CONTRASENA`, que
     nunca se imprime. Si el secreto no está, ⛔ con el paso para Mateo.
2. **Un solo viaje para el contexto.**
   - Una función `contexto_pantalla(p_gimnasio_id)` que devuelve de una vez:
     - lo que hoy da `panel_gimnasio`,
     - mensajes y fichaje,
     - abono,
     - config de entrada y formas,
     - las ayudas vistas.
   - Lo que no cambia (marca, secciones, config) va en caché por gimnasio, con
     etiqueta, y se invalida al guardar la configuración.
   - El proxy deja de llamar a Auth si no hace falta.
3. **El menú no frena la pantalla.**
   - `pendientes_panel` llega después de pintar (Suspense o pedido del lado del
     cliente) y baja a menos de 50 ms con `cubierto_hasta` y conteos con
     índice.
4. **Navegación del cliente.**
   - `staleTimes` (dinámico 30 s) para que volver sea instantáneo.
   - `prefetch` en los links del menú y de Inicio.
   - `useOptimistic` en las acciones de todos los días: ingreso, cobrar,
     asistencia, tareas, reservas.
5. **Claves de Supabase.**
   - Si el proyecto firma con la clave vieja: pasar a claves asimétricas
     (Supabase → Settings → JWT Keys → migrar).
   - Así `getClaims()` verifica sin viajar a Auth.
   - Lo hace **Mateo**, desde el panel de Supabase; el agente deja los pasos
     exactos. Puede cerrar las sesiones abiertas una vez.
6. **Lo demás que suma**, cada cosa medida antes y después:
   - Imágenes con `next/image`, tamaño justo y AVIF/WebP.
   - Fuentes con `next/font` y sin bloquear.
   - JS por ruta lo más chico posible: lo pesado con carga diferida y
     componentes de servidor.
   - Búsqueda con `pg_trgm` y debounce corto.
   - Realtime solo donde hace falta.
   - Ningún re-render que se note.
   - Índices que falten según `EXPLAIN`.
7. **Planes** (D51, los paga Mateo):
   - Supabase Pro trae una máquina más grande que la de Free.
   - En Vercel, revisar que esté prendido Fluid Compute, que reduce los
     arranques en frío.
   - El agente mide con y sin, si Mateo los activa, y anota la diferencia.

**LISTO SI:** la tabla de `medir-produccion.yml` muestra, antes y después, cada
objetivo de arriba cumplido en producción.
Volver a una pantalla vista no hace ningún viaje. Con la red lenta simulada,
siempre hay respuesta en menos de 100 ms.


## F0.3 y F0.5 · pasada del 12/11 (carril f32-f05)

### `pendientes_panel` del dueño bajo los 50 ms (F0.3)

Migración `20261112031732_pendientes_menos_subconsultas.sql`. **Ningún resultado cambia**: `supabase/pruebas/pendientes-vieja-vs-nueva.test.mjs` arma en la transacción de la prueba una copia de las funciones de antes (leídas de las migraciones que las definieron) y las compara con las nuevas en 18 momentos fijos (mismas filas, mismas columnas, mismo orden), con más de 20 socios armados a propósito (huecos, cadenas, coberturas futuras, anuladas, bajas, nuevos, los que dejaron de venir, dos suscripciones, cortesías repetidas dadas por dos personas). Además `retencion-cubierto.test.mjs` (contra `retencion_referencia`) y las demás de retención siguen en verde (46 de 46 en la base local). Con 5.000 socios, `retencion_pendientes` vieja y nueva devuelven lo mismo en 4 momentos (588, 192, 3.514 y 0 filas, mismo orden).

Qué se cambió, solo cómo se calcula:

- `retencion_pendientes` (es el 85 % de lo que tarda `pendientes_panel`): "quién vino hace poco" y "quién tiene cuota adelantada" ahora se unen una vez (`left join`) en vez de preguntarse con una subconsulta por cada uso (eran unas 20 tablas hash de 4.500 filas armadas en cada llamada y un plan de 40 subplanes que también tardaba en planificarse); la membresía vigente de cada socio sale de una sola pasada por las suscripciones del gimnasio (antes, una búsqueda con orden por cada socio candidato); el primer inicio solo se busca para quien lo necesita (quien ya es "por vencer" no lo usa); desaparece la lista intermedia de candidatos.
- `avisos_moderacion_base` (lo que `campana_control` suma al menú del dueño): el aviso de cortesías repetidas agrupa primero por socio y busca los nombres de quienes las dieron solo para los pocos que pasan el umbral (antes cruzaba con el equipo cada cobertura de los últimos 60 días: 4.500 cruces en la siembra de la prueba). `calcular_devolucion_baja` no se tocó: en la siembra no corre (sin bajas con períodos pagados por adelantado) y con 17 bajas de 30 días mide menos de 1 ms.

Medido en Actions con la prueba `escala-5000` (5.000 socios, mediana de 5 vueltas; el runner varía hasta 1,6×, por eso van tres corridas):

| Corrida | Rama | `pendientes_panel` dueño | recepción | `buscar_socios` (texto), de control |
|---|---|---:|---:|---:|
| 43147288581 (runner lento) | base 07/11 (antes) | **59,7 ms** | 44,9 ms | 28,5 ms |
| 43146695444 (runner lento, el mismo tipo) | esta rama | **49,3 ms** | 35,0 ms | 29,0 ms |
| 43145325761 (runner normal) | esta rama | **31,2 ms** | 22,0 ms | 23,2 ms |

Con la misma carga de runner (control igual), el dueño pasa de 59,7 a 49,3 ms (−17 %) y la recepción de 44,9 a 35,0 ms (−22 %). En el runner normal queda en 31,2 ms. **Presupuesto de 50 ms cumplido en las dos corridas de esta rama, pero en el runner lento con apenas 0,7 ms de margen.** Lo que queda del dueño: `reciente` (la lista de quién vino en la última semana: 18.000 ingresos de la siembra, unos 20 ms en una compu cargada) y una búsqueda por socio candidato (`suscripciones` y `ingresos`). Un índice que cubra `ingresos (gimnasio_id, momento) include (socio_id)` solo ayuda con la tabla ya aspirada (no en la siembra de la prueba): no se agregó.

### Imágenes y JS por ruta (F0.5)

- `LogoImagen` (nuevo, `src/components/ui/`): el logo del panel (Navegación), el de la landing y los flyers de eventos de la landing (ahora con su lugar reservado, 4:3) pasan por `next/image` cuando salen del bucket público de Supabase del despliegue; en la base local (http) siguen siendo `<img>`. Las fotos de socios y del equipo salen de rutas con sesión (`/panel/socios/:id/foto`, `/foto-equipo/:id`): no pasan por el optimizador y no se tocaron. La foto de fondo de `/ingresar` queda como estaba (es de otro carril y esa pantalla tiene el problema de `NO_FCP`).
- `qrcode` se baja aparte (`import()` dentro del efecto) en `MiQR` (Inicio del socio), el kiosco y la ficha de admin: sale del primer JS de esas rutas. `jsqr` (cámara de la Puerta) y `read-excel-file` (importar socios) ya eran dinámicos. No hay otras librerías pesadas del lado del cliente (`fflate` va en una ruta de servidor). Sin `next build` acá, **no se midió el JS por ruta**.

Lighthouse móvil, app compilada, mediana de 3, contra el demo local (donde las imágenes son `<img>` comunes, así que lo de `next/image` no se ve en esta medición):

| Pantalla | Antes (corrida 43148052355, base 07/11) | Después (corrida 43148807813, esta rama) |
|---|---|---|
| Landing `/` | 91 · LCP 3,44 s · TBT 75 ms | 93 · LCP 3,18 s · TBT 96 ms |
| `/hacete-socio` | 96 · LCP 2,72 s · TBT 54 ms | 93 · LCP 3,18 s · TBT 100 ms |
| `/ingresar` (equipo y socio) | sin medir (falla; ver F1.8) | sin medir |

**No se llegó a 95 ni a LCP < 1,5 s, y la diferencia entre las dos corridas (±3 puntos, ±0,5 s) es ruido del runner**: nada de lo cambiado toca esas dos pantallas en la base local. El elemento LCP es **un texto** (el `h1` de la landing y un párrafo de `/hacete-socio`, "sin recurso"), con 2,3 a 3 s de "render delay" después de un TTFB de 0,46 s: no es una imagen. Lo que el informe señala es el JavaScript que corre antes del primer pintado (451 ms "unattributable" más dos chunks de 230 y 220 ms, con la CPU 4× más lenta) y el CSS de 15 KB que bloquea el render. Para bajar de ahí hace falta **medir el JS por ruta con un `next build` completo** (el análisis de paquetes de Turbopack) y probar sacar del primer render lo que no hace falta (`Hidratado`, los formularios de más abajo), y eso es del principal (build y `next.config`). Queda 🟡.

<<<<<<< HEAD

## F8.1 · La simulación de terminado con 5.000 socios y la app compilada (12/11, carril f8-cierre)

`scripts/e2e/base-simulacion.mjs` entera, en Actions, con el demo sembrado con **5.019 socios** (30.094 cuotas y 134.490 ingresos) y la app
compilada (`next build` + `next start`, `app_modo=produccion`): corrida **43331281446**, los 10 pasos en verde ("✓ La simulación de terminado pasó entera").
La entrada ahora se prueba con 5.000 socios porque "Pruebas completas" acepta `socios` (y `tanda`, para correr varias tandas a la vez).

**Lo que pasó el tope de 1 s** (`base-ingresos`, 20 ingresos con F2 → DNI → Enter, de Enter al aviso, corrida 43329594913): mediana **146 ms**,
peor **296 ms** (tope 1.000 ms). Los 20: 130 132 133 141 143 143 145 145 146 146 146 149 149 151 155 161 167 210 294 296 ms.

**Lo que se arregló (antes / después).** En la primera medición con 5.000 socios (corrida 43326880490) las pantallas de Inicio tardaban segundos:

| RPC (Inicio, 5.019 socios, app compilada) | Antes (43326880490) | Después (43329594913 y 43331281446) |
|---|---:|---:|
| `panel_inicio` | 2.753 a 4.015 ms | **262 a 280 ms** |
| `numeros_inicio` | 3.439 a 4.369 ms | **341 a 430 ms** |
| `pendientes_panel` | n/d | 100 a 221 ms |

La causa **no era la función ni la app**: la base se sembró y se usó sin `ANALYZE`, y sin estadísticas el planificador elige planes de tabla vacía (autovacuum
tarda minutos en pasar; en producción lo hace solo). `scripts/local/levantar.sh` ahora corre `analyze` después de sembrar. No cambió ninguna función ni migración.
Las pantallas siguen sin pasar el presupuesto de 300 ms en `numeros_inicio` (341 a 430 ms) en el runner de Actions con la app, el build y el navegador corriendo
a la vez; en la base sola, con `explain analyze`, está por debajo (F0.3). Queda anotado, no bloquea el tope de 1 s.

**Un recorrido viejo, no la app:** `base-ingresos` pedía los avisos "abajo a la derecha" (D40) y la app los tiene arriba a la derecha desde D56 / el pulido
(a la izquierda del panel de últimas entradas, para no tapar el botón de Entrada). Se cambió la prueba a "a la derecha y dentro de la pantalla" y quedó en `PREGUNTAS.md`.
=======
### E4 · JS por ruta del panel, medido con `next build` en Actions (13/11)
Se mide con `scripts/medir/js-rutas.mjs` (suma los chunks que cada ruta pide al abrir, de los manifiestos de Turbopack; Next 16 ya no imprime "First Load JS"). Se corre como recorrido de Pruebas completas: `solo=medir-js` con `app_modo=produccion` (corridas 43337908940 antes y 43346132148 después, misma rama).

| | Rutas | Suma | Promedio por ruta | `/panel` | `/panel/vender` |
|---|---|---|---|---|---|
| Antes (VentanaEntrada de 1.051 líneas, entera en el layout) | 57 | 14.361,8 KB gzip | 252,0 KB gzip | 826,1 KB (256,5 gzip) | 811,5 KB (253,1 gzip) |
| Después (11 piezas, 5 con carga diferida, más la barrita y la franja sin internet) | 57 | 14.583,1 KB gzip | 255,8 KB gzip | ~837 KB (260 gzip) | ~823 KB (257 gzip) |

Conclusión sin adornar: el objetivo "el JS baja" **no se cumplió**. La partición deja el archivo mantenible y saca del primer JS el alta, la prueba, "dejar pasar" y el comprobante, pero la barrita (E1) y E6 suman más de lo que sale. Una segunda prueba que cargaba aparte también los pasos de la ventana grande dio 252,0 KB (igual que antes) y rompió recorridos que abren la ventana: se deshizo.
>>>>>>> origin/carril/e-barrita
