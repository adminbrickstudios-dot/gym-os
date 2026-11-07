# Estado del cierre (memoria del agente)

Rama de trabajo: `cierre/2026-11-06` (sale de `origin/noche/2026-11-05`). Si se compacta la conversación: releer esto + `CIERRE.md`.

## Máquina (Windows de Mateo, no la nube)
- Postgres 16 portable en `C:\Users\consu\pg-portable` (puerto 54322, UTC, fsync off). **Todo comando**: `source /c/Users/consu/pg-portable/env.sh &&` delante (PATH, PG*, `DB_PRUEBAS_URL` y `npm_config_script_shell` = bash de Git).
- El hook bloquea borrar bases y `rm -rf` fuera de lo regenerable: para otra base limpia se crea con otro nombre (`gymos_m1`…). `scripts/local/levantar.sh nueva` sí puede (el SQL va dentro del script).
- Archivos en LF (`core.autocrlf=false`). En Windows `psql` no admite opciones después de la URL (`psql -c "..." "$URL"`).
- App en modo producción: `APP_MODO=produccion REHACER_BUILD=si scripts/local/levantar.sh nueva` (build ≈ 5 min; antes hay que apagar lo que escucha en 3123/54321/54331, ya lo hace el script con PowerShell).
- Corredor de e2e: `node .local/correr-e2e.mjs [desde] [hasta] [salida.jsonl]` (env `SOLO=a,b,c`), reintenta hasta 3 veces por espera agotada y resetea medios y secciones del demo (`.local/reset-config.sh`) antes de cada intento. NUNCA correr un e2e a mano mientras el corredor anda.
- Pruebas de base: todas verdes salvo "3.000 filas en menos de 30 segundos" (Windows: ~32 s, del entorno).

## Hallazgo fuerte (07/11): acciones del servidor colgadas en la app compilada de esta compu
Una acción del servidor con `revalidatePath` se queda "pendiente" en el navegador ~35-70 % de las veces (botón "Sumando…"; la respuesta llegó completa: medido con CDP). Pasa también con el código de `main` del 05/11, con y sin distDir propio, con y sin compresión, con Chrome, Edge y Chromium; NO pasa en `next dev` (que acá se ahoga: 4-7 GB de RAM y se cae); el login (acción sin revalidación) en Vercel real anda bien. Causa no aislada. Hay que mirar en Vercel un botón con revalidación (p. ej. "Sumar una dirección" en el super admin) para saber si pasa en producción.
También: error de hidratación #418 + "parentNode" intermitente solo en la app compilada (el recorrido lo cuenta como aviso, no como falla).

## Hecho
- Base: 794/795 en la rama de la tanda 1 y 818/819 con todo unido (la que falla es la lenta de Windows); chequeos, lint, typecheck, vitest en verde.
- Arreglos de la fase 1: alta de gimnasio (el botón Siguiente enviaba el formulario vacío), ficha sin botón Entrada con la sección apagada, hoja Cobrar por encima del veredicto de la Entrada (z-index), app del socio con un solo botón verde, regla de pago de profes desde el primer día del mes, levantar.sh en Windows, e2e actualizados (onb-1 con 9 pasos, selectores precisos).
- Tanda 1 (en la rama): VD-48 salida, VD-49 efectivo sin caja, VD-50 doble cobro, VD-51 prueba gratis, VD-52 liquidación de profes, VD-60 grilla/TV. Sus e2e (vd-48..52, vd-60) corrieron en verde solos.
- Fase 5 escrita por agentes (rama `cierre/union-fase5` = C + D + E + F unidas, base 818/819 + chequeos + lint + typecheck + vitest en verde; **sus e2e NO se ejecutaron todavía**): VD-61 ingreso, VD-62 páginas, VD-63 ayuda, VD-53 fichaje, VD-56 recibo, VD-57 día cerrado, VD-54 máquinas, VD-55 lockers, VD-58 PT.

## Publicación (fase 4)
`publicar/2026-11-06` empujada (tanda 1). GitHub Actions sigue bloqueado por facturación (el repo sigue privado; el job termina en 5 s con "recent account payments have failed"): prevuelo y aplicar NO se pudieron correr. NO mergear a `main` antes de aplicar las migraciones nuevas (Vercel publicaría código que espera tablas que no están).

## Estado final de la tanda 2 (fase 5)
En verde con la app real: vd-53, 54, 55, 56, 57, 58, 61. Sin pasar: vd-62 (video de portada queda tras borrar el link; puede ser la caché de la landing), vd-63 (Ctrl+K → ayuda). Rama: `publicar/2026-11-06-2` (incluye todo).

## Pendiente
1. Cadena de e2e en curso (5.ª; `.local/e2e-resultados.jsonl`).
2. Tanda 2: unir `cierre/union-fase5`, correr sus e2e (vd-53, 54, 55, 56, 57, 58, 61, 62, 63) y los de la tanda 1 de nuevo, `publicar/2026-11-06-2`.
3. `docs/v2/CHE-ME-PASO.md` (se genera con los resultados reales), LOG, COLA marcada, PR.
4. El resto de la COLA (seguimientos B/C/D) y VD-32 quedan sin hacer.
