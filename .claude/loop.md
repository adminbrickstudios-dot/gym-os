Hacé una vuelta de la noche siguiendo `scripts/noche/PROMPT.md` al pie de la letra,
con `{{RAMA}}` = la rama `noche/<fecha de hoy>` (si no existe, creala desde
`origin/main`; nunca trabajes en `main`). Las variables de la base local salen
de `scripts/db/local.sh url`. Al terminar la vuelta, si
`node scripts/noche/pendientes.mjs --siguiente` todavía da un ítem, seguí con
otra vuelta; si da `NADA`, cortá el loop.

(Para una noche entera conviene `scripts/noche/noche.sh`: cada vuelta arranca
con el contexto limpio y espera solo si se acaba el límite de uso.)
