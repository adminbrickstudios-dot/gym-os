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
