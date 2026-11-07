# Estado del cierre (memoria del agente)

Rama: `cierre/2026-11-06` (sale de `origin/noche/2026-11-05`). Si se compacta la conversación: releer esto + `CIERRE.md`.

## Máquina (Windows de Mateo, no la nube)
- Postgres 16 portable en `C:\Users\consu\pg-portable` (puerto 54322, UTC, fsync off). **Todo comando**: `source /c/Users/consu/pg-portable/env.sh &&` delante (carga PATH, PG*, DB_PRUEBAS_URL y `npm_config_script_shell` = bash de Git, que los scripts de npm necesitan).
- Chromium de Playwright ya instalado. `gh` logueado como adminbrickstudios-dot.
- Pruebas de base: 746/748. Las 2 que no pasan son del entorno: `importar-socios` 3.000 filas tarda ~32 s en Windows (límite 30 s); `landing` falla si Postgres no está en UTC (ya resuelto con `timezone='UTC'`).

## Fase actual
Fase 0 hecha (base nueva, pruebas de base, chequeos verdes). Sigue Fase 1.

## Verificado
- Fase 0: db:pruebas 746/748 (2 de entorno), chequeos verdes.

## Falta
Fases 1 a 5 de CIERRE.md.

## Agentes lanzados
(ninguno)
