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
| Vercel (región de las funciones) | | |
| Supabase (región) | | |
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
