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
Corrida [pantallas] temprana: 42157094181 (estado actual de la rama, sin VD-6/5b/1b/2b). Mirar con gh run view; arreglar e2e rotos.
(VD-6, 5b, 1b, 2b mergeados; sumados VD-6b/c, VD-2c). Tanda 1 completa salvo VD-5c, VD-33d/e/f, VD-47Y (movidos). Siguiente: corrida [pantallas] final y publicar.

## TANDA 1 CERRADA en el commit 2e0be05 (rama noche/2026-11-05)
Corrida [pantallas]: 42158575189. Cuando dé verde: git branch publicar/2026-11-06-tanda-1 2e0be05 → push → base-de-datos.yml prevuelo → aplicar → PR a main → merge → probar producción (NOCHE-WINDOWS.md). Si hay e2e rotos: arreglar en la rama de la noche y volver a correr [pantallas]; el commit a publicar es el que quede verde.
Tanda 2 en paralelo: A = VD-7→VD-8 (migr 004000/004001, DUEÑO DE `vender`/Cobros), B = VD-9 caja (004100; NO redefine vender: trigger), C = VD-3→VD-4 (004200/004201, DUEÑA de registrar_ingreso). Luego VD-10 y VD-41.
Agentes tanda 2: A=VD-7→8 af348dbb159d73e89 (rama noche/2026-11-05-vd7); B=VD-9 a78a9f148a4280757 (vd9); C=VD-3→4 ac7165214cdd8c393 (vd3).
(VD-3, VD-4 mergeados; sumados VD-3b, VD-4b)
VD-3/4 mergeados. Lanzado VD-41 a5fdf294283752045 (rama noche/2026-11-05-vd41, migr 004150). Falta tanda 2: VD-10 (esperar a VD-8/9 mergeados).
TANDA 1: corrida de pantallas en la rama publicar/2026-11-06-tanda-1 (commit 2e0be05), run 42162017854 (dispatch pantallas=true; en la rama de la noche cada push cancela la base y con ella las pantallas: NO usar [pantallas] allí mientras haya pushes). VD-7/8 mergeados.
(VD-9 mergeado; VD-10 a lanzar)
VD-10 lanzado: a4a70fd6c35d2969b (rama noche/2026-11-05-vd10, migr 004300). En curso además VD-41 (a5fdf294283752045).
(VD-41 mergeado; OJO: redefine secciones_validas() en 4150: otra migración que la redefina debe copiar la de 4150)
Tanda 3 lanzada: VD-14→16 abda8c33632111e12 (vd14, migr 4400/4600), VD-17→18 adf8116a26608df5d (vd17, migr 4700/4800, dueña de vender/precios_venta). En curso: VD-10 a4a70fd6c35d2969b. Siguen: VD-11 (menú, tras VD-10), VD-37, VD-13, VD-15, VD-38, VD-44.
(VD-10 mergeado → tanda 2 completa salvo e2e. Siguiente: VD-11 menú.)
