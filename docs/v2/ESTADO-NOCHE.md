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
VD-11 lanzado: a8252a126ffc5dd91 (vd11). En curso: VD-14→16 (abda8c33632111e12), VD-17→18 (adf8116a26608df5d). Falta tanda 3: VD-37, VD-13, VD-15, VD-38, VD-44 (tras VD-11).
(VD-14, VD-16 mergeados)
VD-13 lanzado: aa10ecfaee648c08c (vd13, migr 5000, dueña de para_hacer_hoy). En curso: VD-17→18 (adf8116a26608df5d), VD-11 (a8252a126ffc5dd91). Pendientes tanda 3: VD-37, VD-15, VD-38, VD-44.
(VD-17, VD-18 mergeados)
VD-15 lanzado: a5008692e3fdd727b (vd15, migr 5100; incluye VD-6b). En curso: VD-11 (a8252a126ffc5dd91), VD-13 (aa10ecfaee648c08c). Pendientes tanda 3: VD-37, VD-38, VD-44.
(VD-11 mergeado; panel_gimnasio redefinida en 4900: otra migración que la redefina debe copiar la de 4900)
VD-37 lanzado: a436c36190c2d6fe1 (vd37, migr 5200). En curso: VD-13 (aa10ecfaee648c08c), VD-15 (a5008692e3fdd727b). Pendientes tanda 3: VD-38, VD-44.
(VD-15, VD-6b mergeados)
VD-38 lanzado: af583325233c07c8f (vd38, migr 5300). En curso: VD-13 (aa10ecfaee648c08c), VD-37 (a436c36190c2d6fe1). Falta tanda 3: VD-44. Luego tanda 4: VD-35, 39, 22, 24, 25, 19, 20.
(VD-13 mergeado)
VD-13 mergeado. VD-44 lanzado: a003fa0a390b234fc (vd44, migr 5400). En curso: VD-37 (a436c36190c2d6fe1), VD-38 (af583325233c07c8f). Tanda 3 casi completa; luego tanda 4.
(VD-37 mergeado; falta tanda 3: VD-38 y VD-44 en curso)
VD-37 mergeado. Tanda 4 empezó: VD-35→39 a96aa2ce17a63697c (vd35, migr 5500/5600). En curso: VD-38 (af583325233c07c8f), VD-44 (a003fa0a390b234fc). Faltan tanda 4: VD-22, 24, 25, 19, 20.
(VD-38 mergeado; sumados VD-38b/c)
VD-38 mergeado. Lanzado VD-24→38b a5ab496be69ce81a2 (vd24, migr 5700/5800). En curso: VD-44 (a003fa0a390b234fc), VD-35→39 (a96aa2ce17a63697c). Faltan tanda 4: VD-22, 25, 19, 20.
AVISO DISCO: C: se llenó (worktrees de agentes de ~400-900 MB c/u). Regla: borrar el worktree de cada agente al mergearlo (cmd /c rmdir de node_modules si es junction; luego rmdir /s /q del worktree; git worktree prune). Hecho el 2026-11-06 madrugada: quedan 3 activos (a003fa, a96aa2, a5ab49).
(VD-35, VD-39 mergeados; sumado VD-39b)
VD-35/39 mergeados (worktree borrado). Lanzado VD-19→20 a949a9204dfd8a9b6 (vd19, migr 5900/6000). En curso: VD-44 (a003fa0a390b234fc), VD-24→38b (a5ab496be69ce81a2). Faltan tanda 4: VD-22, VD-25.
(VD-24, VD-38b mergeados)
VD-24/38b mergeados. Lanzado VD-25 a844ff15db8200a08 (vd25, migr 6100). En curso: VD-44 (a003fa0a390b234fc), VD-19→20 (a949a9204dfd8a9b6). Falta tanda 4: VD-22. Luego tanda 5.
(VD-25 mergeado; OJO landing_completa redefinida en 6100: al mergear VD-44 (5400) verificar que no pierda sus cambios a landing/agenda)
VD-25 mergeado. Lanzado VD-22 a0d497e08d20e949d (vd22, migr 6200). En curso: VD-44 (a003fa0a390b234fc), VD-19→20 (a949a9204dfd8a9b6). Tanda 4 completa con eso. Siguen tanda 5 (VD-40, 42, 43, 21) y 6/7.
(VD-19, VD-20 mergeados)
VD-19/20 mergeados. Lanzado VD-40 ae1c369e385efd2a4 (vd40, migr 6300). En curso: VD-44 (a003fa0a390b234fc), VD-22 (a0d497e08d20e949d). Siguen tanda 5: VD-42, VD-43, VD-21; tanda 6/7.
(VD-22 mergeado; tanda 4 completa)
VD-22 mergeado. Lanzado VD-42→43 a495eedbb541876c4 (vd42, migr 6400/6500). En curso: VD-44 (a003fa0a390b234fc), VD-40 (ae1c369e385efd2a4). Falta tanda 5: VD-21; luego tandas 6/7.
