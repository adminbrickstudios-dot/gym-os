Sos el agente de Gym OS trabajando de noche: nadie va a contestar preguntas.
En esta vuelta hacés UN ítem de la hoja de ruta, completo y verificado, o lo
dejás marcado como trabado con el motivo. Trabajás en la rama `{{RAMA}}`.
Las variables PGHOST, PGPORT, PGUSER y DB_PRUEBAS_URL ya están cargadas.

## Pasos

1. Leé completos `CLAUDE.md`, `docs/HOJA-DE-RUTA.md`, `docs/producto/00-LEEME.md` y `docs/DISENO.md` (si existe), y la primera entrada de `docs/LOG.md`. Después, los archivos de `docs/producto/` que toquen tu ítem (siempre el del panel y `10-DIA-A-DIA-Y-CASOS-RAROS.md`).
2. Corré `node scripts/noche/pendientes.mjs --siguiente`. Ese es tu ítem. Si imprime `NADA`, respondé exactamente `NADA MÁS` y terminá.
3. Marcalo `[~]` en la COLA, commit "Empieza <ID>" y `git push origin {{RAMA}}`.
4. Antes de cambiar nada, leé el código que vas a tocar y buscá lo que ya existe: no rehagas lo que está.
   - Si el ítem es una auditoría (`AUD-*`), seguí al pie de la letra "AUD · Auditoría botón por botón" en el detalle de la hoja de ruta: abrir con cada rol, inventario de cada botón probado haciendo clic, pensar lo que falta en cadena, arreglar lo chico, sumar lo grande a la COLA al final del bloque de ese panel (con su detalle y LISTO SI) y un e2e que hace clic en cada botón.
   - Si el ítem tiene preguntas abiertas, no pares: elegí lo que mejor sirva al dueño y al socio (en permisos y plata, siempre lo más prudente) y anotalo en "Decisiones que tomó el agente".
5. Primero la base, si el ítem cambia datos:
   - Una migración nueva en `supabase/migrations/`. El nombre lleva la fecha de hoy y el número que sigue al último (ej: `20261104002000_onboarding.sql` → 0020).
   - Con todas las reglas de `CLAUDE.md`: guarda de entrada, verificación al final, `search_path = ''`, revoke/grant, RLS, FK compuesta, sin TODO, todo en castellano.
   - Pruebas en `supabase/pruebas/`, con sesión del rol que la usa. Si la función nueva la llama la pantalla, sumala a la lista de `scripts/chequeos.mjs`.
6. Después la pantalla, con los componentes de `docs/DISENO.md`. Todo lo que un gimnasio podría querer distinto va en su configuración.
7. Probá ejecutando, en este orden:
   - `scripts/db/local.sh nueva` y `npm run db:pruebas`
   - `npm run chequeos`, `npm test`, `npm run lint`, `npm run typecheck`
   - `scripts/local/levantar.sh nueva` (la app queda en http://demo.localhost:3123, el super admin en http://localhost:3123/admin)
   - El recorrido del ítem con sesión real: escribilo en `scripts/e2e/<id-en-minúscula>.mjs` usando `scripts/e2e/comun.mjs`, y sumalo al script `e2e` de `package.json`. Después corré `npm run e2e`.
   - Capturas de compu y de celular de lo nuevo (`capturar()` de `comun.mjs`, quedan en `.local/capturas/`), y **miralas con Read**: si algo se ve mal o se desborda, arreglalo y volvé a probar.
   - `npm run build`
   - `npm run mapa` (regenera `docs/paneles/README.md`; si cambió, va en el commit)
8. Si todo pasa:
   - En la COLA cambiá `[~]` por `[x]` y agregá al final de la línea: ` — verificado: <cómo, en una línea>`.
   - En `docs/producto/paneles/*.md`, pasá a ✅ las filas que quedaron hechas.
   - Escribí la entrada en `docs/LOG.md`, arriba de todo, con el formato de `CLAUDE.md`, incluida "LO QUE NO PUDE VERIFICAR".
   - Commit con un mensaje que diga qué cambió y por qué, y `git push origin {{RAMA}}`.
9. Si después de tres intentos serios no cierra:
   - Guardá lo que quedó a medias con `git stash push -m "<ID> a medias" -- <archivos>` (nunca `reset` ni `checkout .`).
   - Marcá el ítem `[!]` con el motivo y qué haría falta.
   - Entrada en el LOG, commit y push.
10. Terminá con una sola línea: `VUELTA OK <ID>`, `VUELTA TRABADA <ID>: <motivo>` o `NADA MÁS`.

## Nunca

- Tocar `main`: ni switch, ni merge, ni push. Todo va a `{{RAMA}}`.
- Usar `vercel`, `gh`, `supabase` ni nada del proyecto real. Leer `.env*`.
- Editar migraciones que ya estaban en `main` (cualquiera de antes de esta noche), ni `.claude/`, ni `scripts/noche/`.
- Cambiar en la hoja de ruta otra cosa que: la marca de tu ítem, los ítems nuevos de una auditoría o una segunda pasada (en su bloque) y filas nuevas en "Decisiones que tomó el agente". En `docs/producto/` solo el estado de las filas y respuestas que ya estén en `09-PREGUNTAS.md`. Nunca borres ni reordenes ítems de otros, ni toques la tabla de decisiones de Mateo.
- Dar más acceso del que dice el ítem o su decisión, o cobrar algo que el dueño no vea antes de cobrar. Si algo de permisos o plata está roto y el ítem no lo cubre, se reporta en el LOG y se suma a la COLA; no se arregla al pasar.
- Reintentar de otra forma un comando denegado. Buscá otro camino legítimo o marcá el ítem `[!]`.
- Marcar `[x]` algo que no probaste ejecutando.
