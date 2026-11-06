# Estado de la noche (memoria del agente)

Rama: `noche/2026-11-05` (sale de `origin/dia/2026-11-05`). PR borrador #2.
Si se compacta la conversación: releer esto, `NOCHE-WINDOWS.md` y correr `node scripts/noche/pendientes.mjs --siguiente`.
Ayudantes del orquestador (fuera del repo): scratchpad/marcar.mjs (marca la COLA), log.mjs (entrada en el LOG), brief.txt (brief común de agentes).
Flujo por agente: rama `noche/2026-11-05-<id>` → push → base verde → yo hago `git merge --no-ff origin/<rama>`, agrego su e2e a package.json (`e2e:<id>` y la cadena `e2e`, antes de barrido), marco COLA, LOG, push.

## Ahora (lanzados)

| Ítem | Agente | Rama | Migración | Estado |
|---|---|---|---|---|
| (VD-33 mergeado) | | | | |
| VD-36 → VD-23 | a629f942bc5071cce | noche/2026-11-05-vd36 | 3600 / 2300 | en curso |
| (VD-12 mergeado) | | | | |

Lanzados (3 agentes): VD-1→VD-2 (a4b58e1f880b3b4ce, rama noche/2026-11-05-vd1, migr 0100/0200); VD-47X (a37bb70833aeb1eb0, rama noche/2026-11-05-vd47x, migr 004701); VD-12b→12c→12d→23b→23c (a01f26a4fc33c1e10, rama noche/2026-11-05-vd12b, migr 001201). Después: VD-5, VD-6 (serie, tras VD-1/2), VD-33b/c; luego cerrar tanda 1 con commit [pantallas] y publicar. Al mergear: regenerar docs/paneles con npm run mapa y unir listas de chequeos.mjs (conflictan siempre).

## Terminados

- VD-34 (base verde; e2e en la corrida de la tanda)
- VD-47 (parcial, resto en VD-47X; base verde)
- VD-27 (base verde; e2e y capturas en la corrida de la tanda)
- VD-12 (base verde; sumados VD-12b/c/d)
- VD-33 (base verde; sumados VD-33b/c)
- VD-36, VD-23 (base verde; sumados VD-23b/c)
(VD-36/VD-23 mergeados)
(VD-1/VD-2 mergeados; VD-1b, VD-2b sumados)

## Publicadas

(ninguna todavía)

## Decisiones que tomó el agente

- VD-34: la versión de registros avisa y el segundo Guardar guarda igual (no hay botón aparte).
- VD-47: no se agregó vercel.json (no consta la región de Supabase).
VD-5 lanzado: a815b6bb188be1ede, rama noche/2026-11-05-vd5, migr 000500. Siguen en curso: VD-47X (a37bb70833aeb1eb0), VD-12b..23c (a01f26a4fc33c1e10). Luego VD-6, VD-1b, VD-2b, VD-33b/c.
(VD-47X, VD-12b/c/d, VD-23b/c mergeados; base verde. Sumados VD-47Y, VD-12e)
Lanzado: VD-33b→33c→12e (a5c3a07448104c617, rama noche/2026-11-05-vd33b, migr 003301). VD-5 mergeado (migr 003450; sumados VD-5b/c). Pendiente tanda 1: VD-6, VD-1b, VD-2b, VD-5b, VD-5c; VD-47Y pasa a VD-30.
Lanzado: VD-6→5b→1b→2b (adc1883401ca19abd, rama noche/2026-11-05-vd6, migr 3800+). Tras él y VD-33b/c/12e: cerrar tanda 1 ([pantallas] + publicar).
(VD-33b/c, VD-12e mergeados; sumados VD-33d/e/f)
