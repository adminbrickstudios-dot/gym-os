# Estado del cierre (memoria del agente)

Rama: `cierre/2026-11-06` (sale de `origin/noche/2026-11-05`; PR a `main` al publicar). Si se compacta la conversación: releer esto + `CIERRE.md`.

## Máquina (Windows de Mateo, no la nube)
- Postgres 16 portable en `C:\Users\consu\pg-portable` (puerto 54322, UTC, fsync off). **Todo comando**: `source /c/Users/consu/pg-portable/env.sh &&` delante (carga PATH, PG*, DB_PRUEBAS_URL y `npm_config_script_shell` = bash de Git).
- El hook bloquea borrar bases en línea de comando: para otra base limpia se crea con otro nombre (`gymos_dev`, `gymos_m1`…). `scripts/db/local.sh nueva` sí puede (el SQL va dentro del script).
- Archivos de trabajo en LF (`core.autocrlf=false`); con CRLF los reemplazos de texto fallan.
- App en producción: `APP_MODO=produccion REHACER_BUILD=si scripts/local/levantar.sh nueva` (build ≈ 5 min). Corredor de e2e: `node .local/correr-e2e.mjs [desde] [hasta]` → `.local/e2e-resultados.jsonl`, fallas en `.local/e2e-falla-*.log`. NUNCA correr un e2e a mano mientras el corredor anda (se pisan la configuración).
- Pruebas de base: todas verdes salvo "3.000 filas en menos de 30 segundos" (Windows: ~32 s), que es del entorno.

## Hecho (en la rama, base verde: 794/795 + chequeos + lint + typecheck + vitest)
- Fase 1 (parcial): arreglado el alta de gimnasio (el botón Siguiente se volvía Crear y mandaba el formulario vacío); levantar.sh en Windows; e2e más estables.
- VD-60 (grilla/TV para recepción y profe), VD-52 (liquidación de profes), VD-49 (efectivo sin caja), VD-50 (doble cobro), VD-48 (salida), VD-51 (prueba gratis): código + pruebas de base. **Sus e2e (vd-48, 49, 50, 51, 52, 60) están escritos, sin ejecutar todavía.**

## Pendiente
1. Rebuild con todo lo unido → correr los e2e nuevos de a uno → arreglar.
2. Corrida completa de la cadena e2e (205 + nuevos) y barrido; triage de las fallas. Conocido: error de hidratación #418 intermitente solo en producción (pageerror), no reproducido en dev; se mitigó esperando `networkidle` antes de cada `goto`.
3. Mirar capturas (Inicio, Entrada flotante, Cobrar, Caja, Socios, ficha, app del socio en celular, super admin).
4. Fase 3: `docs/v2/CHE-ME-PASO.md` con 40 consultas; sección por sección de `17`.
5. Fase 4: publicar (ver CIERRE.md). Fase 5: VD-53 a 58 y VD-32 (segunda pasada).
