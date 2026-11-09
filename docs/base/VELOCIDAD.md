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
| JS por ruta (`next build`) | | |
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
| Región de las funciones de Vercel | iad1 (Washington) con Supabase en São Paulo | gru1 | `vercel.json` `{"regions":["gru1"]}` (Mateo confirmó São Paulo) |
| Vigencia guardada `socios.cubierto_hasta` + índice `(gimnasio_id, cubierto_hasta)` | — | disponible para las listas | BASE-5, migración `20261108050100` |

## Pendiente de BASE-1 (anotado)
- Usar `cubierto_hasta` dentro de `privado.retencion` (y de ahí `vencen_hoy`, `retencion`, `panel_inicio`, `pendientes_panel`, `para_hacer_hoy`) para no calcular el veredicto completo de los vencidos: bajar de ~440 a menos de 300 ms.
- `filtros_socios` (880 ms): contar con el índice en vez de recorrer.
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
