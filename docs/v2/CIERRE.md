# Cierre de Gym OS v2 (Claude Code en la nube)

Sos el agente que termina Gym OS v2. Trabajás en **Claude Code en la nube**
(claude.ai/code, repo `adminbrickstudios-dot/gym-os`): tenés Postgres, la
imitación de Supabase y Chromium acá mismo, así que **todo se prueba en esta
máquina, con sesión real**. Nadie va a contestar preguntas. No parás hasta
terminar las fases.

## Dónde quedó (06/11)

- La noche del 05/11 hizo **todo el bloque 20** en código en la rama
  `noche/2026-11-05` (PR #2), con más de 60 migraciones
  (`20261106000100` … `20261106007804`). Leé la entrada de cierre de
  `docs/LOG.md` y `docs/v2/ESTADO-NOCHE.md`.
- **No se publicó nada**: producción tiene la versión del 05/11. Las pruebas
  de pantallas nunca dieron verde (al final quedaban 2 recorridos rotos en la
  tanda 1 y 37 sin confirmar en total, VD-TRI1), y después GitHub Actions se
  bloqueó por facturación. Mateo decidió hacer el repo público (Actions
  gratis); si sigue bloqueado cuando llegues a publicar, lo decís y seguís.
- Decisiones nuevas de Mateo (D29 a D35) en la hoja de ruta. Ítems nuevos en
  el **bloque 21** de la COLA.

## Fase 0 · Preparar (una vez)

1. `git fetch origin` y `git switch -c cierre/2026-11-06 origin/noche/2026-11-05`
   (si ya existe: `git switch cierre/2026-11-06 && git pull`).
2. Leé completos: `CLAUDE.md`, `docs/v2/` entero (en este orden: `00-LEEME`,
   este archivo, `17-SECCION-POR-SECCION`, `20-LO-QUE-FALTA`, `08-PLAN`, el
   resto), la hoja de ruta (reglas, decisiones D1-D35, "Decisiones que tomó el
   agente", bloques 20 y 21) y `scripts/noche/PROMPT.md` (reglas de cada ítem:
   valen todas).
3. `source scripts/local/entorno.sh >/dev/null && npm ci && scripts/db/local.sh nueva && npm run db:pruebas && DB_PRUEBAS_URL="$(scripts/db/local.sh url)" npm run chequeos`.
   Todo comando de base, pruebas o app va con `source scripts/local/entorno.sh >/dev/null &&` delante.
4. Creá `docs/v2/ESTADO-CIERRE.md`: fase actual, qué está verificado, qué
   falta, agentes lanzados. Es tu memoria: releelo cada vez que retomes.

## Fase 1 · Ver con sesión real todo lo que se hizo y arreglar lo roto

Nada de lo de la noche se vio con sesión real. Esto va primero.

1. Levantá la app **en modo producción** (`next build` + `next start`, como lo
   dejó el triaje en `pruebas-completas.yml`/`levantar.sh`) con
   `scripts/local/levantar.sh`.
2. Corré los e2e **de a grupos de ~15**, uno después del otro (nunca dos
   tandas ni dos apps a la vez: la máquina se ahoga y aparecen fallas falsas).
   Primero los de la tanda 1 y la Entrada/Cobrar/Caja, después el resto,
   después `scripts/e2e/barrido.mjs` (cada rol × cada pantalla, compu y
   celular).
3. Cada falla: ¿la pantalla cambió a propósito? → se actualiza la prueba (no
   se borra). ¿Está roto? → se arregla, con su prueba. VD-TRI1 lista lo
   conocido.
4. Mirá las capturas de Inicio, Entrada (flotante abierta), Cobrar, Caja,
   Socios, ficha, app del socio (celular) y super admin. Si algo se ve mal,
   se arregla.
5. Marcá en la COLA "— verificado: e2e X N pasos" cada ítem VD que quedó con
   "e2e en la corrida de la tanda".

**Trampas conocidas de esta máquina**: nunca `pkill -f next-server` dentro de
un comando cuyo texto contenga esa palabra (se mata a sí mismo); si aparece
"multipart" en Storage, es la imitación local (ya lo soporta); un `role="alert"`
vacío de Next no es un error de la app.

## Fase 2 · Lo que decidió Mateo hoy (bloque 21: VD-48 a VD-52 y VD-60)

En el orden de la COLA, cada uno completo con su LISTO SI (`08-PLAN.md` §F).

## Fase 3 · Sección por sección (`17-SECCION-POR-SECCION.md`) y "che, me pasó esto" (VD-59)

Recorré cada sección con su rol, en compu y celular, tildando cada línea de
`17`. Cada "che, me pasó esto" se reproduce: si el sistema lo resuelve, se
anota cómo; si no, se arregla o es un ítem nuevo del bloque 21. Escribí 40
consultas reales (las de `17` más las que se te ocurran como dueño, como
recepcionista con fila y como socio) y dejá la tabla en
`docs/v2/CHE-ME-PASO.md` con la respuesta de cada una.

## Fase 4 · Publicar todo

Cuando las fases 1 a 3 están en verde (base + todos los e2e + barrido en esta
máquina):

1. **Si existe `.claude/BASE_CON_DATOS_REALES`**: no publicás; dejás los
   comandos en el LOG para Mateo y seguís con la fase 5.
2. `git branch publicar/2026-11-06 <commit verde>` y push.
3. `gh workflow run base-de-datos.yml --ref publicar/2026-11-06 -f accion=prevuelo`
   → `gh run watch` → tiene que decir "Pre-vuelo OK". Si Actions sigue
   bloqueado (los jobs terminan en 2 s por "payments have failed"): lo decís
   en una línea, dejás todo listo y seguís con la fase 5.
4. Mismo comando con `-f accion=aplicar` → "Todo en verde".
5. PR de `publicar/2026-11-06` a `main` (`gh pr create --fill`) y
   `gh pr merge --merge`. Vercel publica solo.
6. A los 3 minutos: `curl` a `https://gym-os-pied.vercel.app/ingresar`,
   `/g/demo`, `/admin` y `/g/demo/app` (o la ruta de la app): 200 o
   redirección, nunca 500. Si algo da 500: PR con `git revert -m 1 <merge>` a
   main y avisar (las migraciones son aditivas: lo anterior anda con la base
   nueva).
7. Entrada en el LOG "Publicado" con las migraciones aplicadas.

## Fase 5 · Lo que sigue en la COLA

Primero el bloque 22 (VD-61 ingreso, VD-62 páginas, VD-63 información y ayuda: `21-PEDIDOS-07-11.md`). Después los seguimientos B/C/D del bloque 20, VD-53 a VD-58 del bloque 21, y VD-32
(segunda pasada de punta a punta). Al terminar una tanda de ítems en verde,
volvés a publicar igual que en la fase 4 (rama `publicar/<fecha>-<n>`).

## Reglas de trabajo en esta máquina

- Podés lanzar **hasta 2 agentes** en worktrees para escribir código de
  ítems que no tocan los mismos archivos, cada uno con su número de
  migración reservado (`2026110700NN00`, NN = número del ítem; los B/C/D usan
  `NN01`, `NN02`…). Pero **las pruebas con app y navegador las corrés vos, de
  a una**.
- Antes de lanzar, listá los archivos de cada uno; si se cruzan
  (`layout.tsx`, `secciones.ts`, `globals.css`, `chequeos.mjs`,
  `package.json`, `vender`, `calcular_acceso`, `registrar_ingreso`,
  `para_hacer_hoy`), van en serie. Una función que varias migraciones
  reemplazan se copia **siempre** de la versión más nueva (la lista está en
  la entrada de cierre del LOG).
- Commit y push al cerrar cada ítem; el mensaje dice qué cambió y por qué.
- `gh` solo para: PRs, mirar corridas, y publicar (fase 4). Nunca Secrets,
  Vercel ni Supabase directo.
- Antes de dar algo por terminado: recorrelo como el dueño, como la
  recepcionista con 10 personas en la fila y como el socio en el celular.
- No sacar ninguna función. Simple, limpio, rápido.

## Al final

Entrada en `docs/LOG.md` con el formato de reporte de `CLAUDE.md`: qué se
verificó (con los números de pasos), qué se publicó, qué quedó, QUÉ CORRÉS
VOS y QUÉ CONFIGURÁS VOS (dominio `18`, región, SMTP, Google, Turnstile,
VAPID, Sentry), y LO QUE NO PUDE VERIFICAR. PR actualizado.
