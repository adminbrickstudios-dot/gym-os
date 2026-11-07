> **06/11: reemplazado por `CIERRE.md`** (el cierre corre en Claude Code en la nube). Esto queda como historia de la noche del 05/11.

# La noche desde Windows (Claude Code en la compu de Mateo)

Sos el agente de Gym OS trabajando toda la noche desde la compu de Mateo
(Windows, Claude Code con Git Bash). Nadie va a contestar preguntas. No
parás hasta que `node scripts/noche/pendientes.mjs --siguiente` diga `NADA`.

## Antes de empezar (una sola vez por noche)

1. Leé completos: `CLAUDE.md`, todo `docs/v2/` (empezando por
   `00-LEEME.md` y `08-PLAN.md`), `docs/HOJA-DE-RUTA.md`
   (reglas, decisiones y el bloque 20), `docs/DISENO.md`, la primera entrada
   de `docs/LOG.md`, y `scripts/noche/PROMPT.md` (las reglas de una vuelta:
   valen todas salvo lo que este archivo cambia para Windows).
2. Rama: `git fetch origin` y `git switch -c noche/<fecha de hoy>
   origin/dia/2026-11-05` (si ya existe: `git switch noche/<fecha>` y
   `git pull`). **Nunca** `main`.
3. Abrí un PR borrador de esa rama contra `main` con `gh pr create --draft`
   (título "Noche <fecha>: Gym OS v2"), si no existe.
4. Creá `docs/v2/ESTADO-NOCHE.md`: qué ítem está haciendo cada agente,
   qué número de migración tiene reservado, qué terminó. Es tu memoria si
   se compacta la conversación: **releelo cada vez que retomes**.

## Lo que cambia en Windows

- **No hay Postgres en esta compu.** La base de prueba, sus pruebas, los
  chequeos contra la base, el demo y las pantallas (e2e + barrido) corren en
  GitHub: workflow **Pruebas completas** (`.github/workflows/pruebas-completas.yml`).
  - Cada push a `noche/**` corre la base (migraciones nuevas aplicadas en
    una base limpia, `npm run db:pruebas`, `npm run chequeos`, siembra del
    demo): ~5 min.
  - Un commit cuyo mensaje tenga `[pantallas]` corre además las pantallas
    (cada recorrido e2e + barrido, 2 a 4 h). Usalo **cuando se cerró una
    tanda** (ver `08-PLAN.md`), no en cada ítem. Mientras corre, seguí con
    la tanda siguiente.
  - Mirar: `gh run list --branch <rama> --workflow pruebas-completas.yml -L 3`
    y `gh run watch <id> --exit-status`; el detalle de una falla:
    `gh run view <id> --log-failed`. Capturas y logs: `gh run download <id>`.
- **Acá corrés**: `npm ci` (si cambió package-lock), `npm run lint`,
  `npm run typecheck`, `npm test`, y el build con las variables de prueba:
  `NEXT_PUBLIC_SUPABASE_URL=https://ejemplo.supabase.co NEXT_PUBLIC_SUPABASE_ANON_KEY=clave-de-build NEXT_PUBLIC_DOMINIO_BASE=ejemplo.com NEXT_PUBLIC_DOMINIO_PLATAFORMA=app.ejemplo.com npm run build`
- `gh` se usa **solo** para: crear/editar PRs, mirar y bajar corridas de
  Pruebas completas, y **publicar una tanda** (abajo). **Nunca**: tocar
  Secrets, `vercel`, ni Supabase directo (solo a través del workflow Base de
  datos), ni `aplicar` sin `prevuelo` en verde antes, ni mergear algo que no
  pasó por la publicación de abajo.
- Un ítem **no** está `[x]` hasta que su corrida de base en GitHub está en
  verde. Las pantallas (e2e) de un ítem se dan por verificadas cuando pasa
  la corrida `[pantallas]` de su tanda; mientras tanto el ítem queda `[x]`
  con "e2e: en la corrida de la tanda" y, si esa corrida falla, se arregla
  antes de publicar.

## Publicar una tanda en producción (D25)

Mateo decidió que los cambios salgan durante la noche, por tanda. **Solo si
no existe `.claude/BASE_CON_DATOS_REALES`** (si existe: no publicás, dejás
todo para la mañana y lo decís en el LOG).

1. La tanda entera está `[x]` y la corrida `[pantallas]` del commit que
   cierra la tanda está en verde (base + e2e + barrido). Si el e2e de algo
   viejo falla porque la pantalla cambió a propósito, se actualiza la
   prueba (no se borra) y se vuelve a correr.
2. Rama de publicación en ese commit exacto (no en lo que siguió después):
   `git branch publicar/<fecha>-tanda-<n> <commit>` y push.
3. `gh workflow run base-de-datos.yml --ref publicar/<fecha>-tanda-<n> -f accion=prevuelo`
   → esperar y leer: tiene que terminar en "Pre-vuelo OK".
4. Mismo comando con `-f accion=aplicar` → esperar → "Todo en verde".
5. PR de `publicar/<fecha>-tanda-<n>` a `main` (`gh pr create --fill`),
   `gh pr merge --merge` cuando Verificar esté en verde. Vercel publica solo.
6. A los 3 minutos, probar producción: `curl -s -o /dev/null -w "%{http_code}"`
   a `https://gym-os-pied.vercel.app/ingresar`, `/g/demo` y `/admin` (200
   o redirección, nunca 500). Si algo da 500: `gh pr revert` no existe;
   revertir con un PR de `git revert -m 1 <merge>` a main y avisar en el LOG
   (las migraciones son aditivas: la versión anterior anda con la base
   nueva).
7. Entrada en el LOG: "Publicada la tanda N" con las migraciones aplicadas.
8. La rama de la noche sigue con la tanda siguiente (traé `main` si hace
   falta: `git merge origin/main`).

## Orquestar: varios agentes sin pisarse

Vos sos el orquestador. Podés lanzar **hasta 3 agentes a la vez** (Agent
con `isolation: "worktree"`), cada uno con **un ítem** VD-* y su propia rama
`noche/<fecha>-<id>` salida de la rama de la noche. Reglas:

1. Solo en paralelo ítems que **no tocan los mismos archivos**. Antes de
   lanzarlos, listá los archivos que cada uno va a tocar; si se cruzan
   (ej: dos que cambian `src/app/panel/layout.tsx`, `secciones.ts`,
   `globals.css`, `scripts/chequeos.mjs` o `package.json`), van en serie.
   En la tanda 1, VD-34 y VD-27 van primero y solos (cambian componentes
   que usa todo); después VD-1, VD-5 y VD-6 van en serie entre ellos (tocan
   la Entrada y Cobrar); VD-33, VD-36/VD-23 y VD-12 pueden ir en paralelo.
2. **Migraciones con número reservado**: cada ítem usa
   `2026110600NN00_<nombre>.sql` con NN = número del ítem (VD-3 →
   `20261106000300_reingreso.sql`; VD-13 → `20261106001300_...`). Anotalo en
   `ESTADO-NOCHE.md` al lanzar. Si un ítem necesita dos, usa `NN01`, `NN02`.
3. Cada agente recibe en su prompt: el ítem, sus archivos, su número de
   migración, "leé CLAUDE.md, docs/v2/ y scripts/noche/PROMPT.md; hacé el
   ítem completo con su LISTO SI; corré lint, typecheck, test y build;
   commit y push de tu rama; esperá la corrida de base de Pruebas completas
   en GitHub y dejala en verde; respondé con lo que hiciste, lo que no pudo
   verificar y los archivos tocados". Los agentes **no** tocan la hoja de
   ruta, el LOG ni `ESTADO-NOCHE.md`: eso lo hacés vos.
4. Cuando vuelve un agente: `git merge --no-ff` de su rama en la de la
   noche, resolvé conflictos, lint + typecheck + test + build, push, esperá
   la base en verde, marcá el ítem en la COLA, entrada en el LOG (formato
   de `CLAUDE.md`), y recién ahí lanzás el siguiente.
5. Si dos agentes fallan seguido o la compu se pone lenta, bajá a 1.

## Cada ítem, completo

Lo de `scripts/noche/PROMPT.md` (leer el código antes, no rehacer lo que
existe, base primero con todas las reglas de migraciones, pruebas de base
con sesión del rol, pantalla con los componentes del diseño, e2e del
recorrido, capturas de compu y celular), más:

- **Anticiparse**: antes de cerrar un ítem, recorrelo como el dueño, como la
  recepción con 10 personas en la fila y como el socio en el celular.
  ¿Hay una pantalla sin salida? ¿Un botón que no hace nada? ¿Algo que el
  dueño va a preguntar "y por qué no puedo…"? Arreglalo o sumalo como
  ítem nuevo al bloque 20 (`VD-<n>X`, con su LISTO SI).
- **No sacar nada**: si una pantalla cambia de lugar, la ruta vieja
  redirige y los e2e viejos siguen pasando.
- **Permisos y plata**: lo que dicen las decisiones D1-D24 y nada más. Si
  algo de permisos o plata no está decidido, lo más prudente y anotado en
  "Decisiones que tomó el agente".

## Al final de la noche

1. La última tanda terminada, publicada; lo que quedó a medias, en la rama
   con su corrida, sin publicar.
2. `docs/v2/ESTADO-NOCHE.md` cerrado y una entrada final en el LOG con el
   formato de reporte de `CLAUDE.md`. En **QUÉ CORRÉS VOS**: solo lo que no se
   pudo publicar (con sus comandos), y en **QUÉ CONFIGURÁS VOS** los 🔌.
3. Actualizá el cuerpo del PR borrador de la noche con lo hecho, lo
   publicado, las migraciones y lo que espera a Mateo. Ese PR (la rama de
   la noche entera) no se mergea: lo publicado ya entró por las ramas
   `publicar/…`.
