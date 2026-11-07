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

## Agentes (lanzados 07/11 ~01:30)
- A = ad78d945cad09cf0f: VD-48 (salida) → VD-51 (prueba gratis). Migr 20261107004800/005100. Rama cierre/agente-a-vd48 / vd51. Base propia gymos_a1.
- B = a9979d063f4c9478b: VD-49 (efectivo sin caja) → VD-50 (doble cobro). Migr 20261107004900/005000. Rama cierre/agente-b-vd49 / vd50. Base propia gymos_b1.
- Yo: corrida e2e completa en background (.local/correr-e2e.mjs → .local/e2e-resultados.jsonl, fallas en .local/e2e-falla-*.log); VD-60 y VD-52.
- Pendiente en la 1ª corrida: error de hidratación #418 en /panel/retencion (solo producción; no se ve en dev).
