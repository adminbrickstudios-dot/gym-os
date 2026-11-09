# Reparto: el agente principal y sus 3 ayudantes (09/11)

Para ir rápido sin pisarse. El **principal** codea su carril y además coordina:
lanza ayudantes (agentes en worktrees), integra lo que hacen, compila, corre
los e2e y publica. Cada ayudante tiene un carril con carpetas propias y nunca
toca las de otro.

## Los carriles

| Carril | Quién | Ítems de `RECTA-FINAL.md` | Carpetas suyas (solo él las toca) |
|---|---|---|---|
| A · Velocidad y recepción | **Principal** | F0, F1.1, F1.3, F1.6, F1.9, F3, F8 | `src/proxy.ts`, `src/lib/panel/`, `src/app/panel/layout.tsx`, `src/app/panel/entrada/`, `src/app/panel/page.tsx`, componentes de la Entrada y del Marco, `src/app/globals.css`, `next.config.*`, `scripts/e2e/` |
| B · Super admin | Ayudante 1 | F2 entera | `src/app/admin/`, `src/lib/admin/` (si se crea) |
| C · Socio, página e ingreso | Ayudante 2 | F1.2, F1.8, FA-14 a FA-18 de la app | `src/app/app/`, `src/app/ingresar/`, `src/app/hacete-socio/`, `src/app/page.tsx` y la página del gimnasio, `src/lib/app/`, `src/lib/landing*` |
| D · Diseño y detalles del panel | Ayudante 3 | F1.4, F1.5, F1.7, F4, F5 y F6 de pantallas del panel que no son la Entrada ni el Inicio | El resto de `src/app/panel/*` (cada pantalla en su carpeta), `src/components/` salvo la Entrada y el Marco |

Cuando una fase de un carril se termina, el principal le asigna al ayudante lo
siguiente de la lista que no choque con otro carril. F7 (propuestas) se reparte
igual.

## Reglas para no pisarse

1. **Cada ayudante en su worktree y su rama**: `carril/b-super`, `carril/c-socio`
   y `carril/d-panel`, salidas de `base/2026-11-07`. Commit y push en su rama.
   El principal mergea a `base/2026-11-07` cuando el carril cierra un ítem.
2. **Lo compartido lo cambia solo el principal**:
   - `globals.css`, los tokens, el componente `Icono` y `Marco`,
   - `package.json` y el lock,
   - `CLAUDE.md` y los docs de `docs/base/` salvo su propia fila de estado.

   Si un ayudante lo necesita, lo pide en su informe y sigue con otra cosa.
3. **Migraciones con número reservado por carril**:
   - A: `202611090100NN`
   - B: `202611090200NN`
   - C: `202611090300NN`
   - D: `202611090400NN`

   Ninguna reemplaza una función que otro carril también cambia. Si dos la
   necesitan, la escribe el principal.
4. **Base de datos propia por ayudante**: cada uno corre `db:pruebas` en su
   propia base local (`DB_PRUEBAS_URL` con otro nombre de base), nunca en la del
   principal.
5. **Memoria de la compu.** Los ayudantes **no levantan la app ni Playwright ni
   `next build`**. Escriben código y pruebas, y corren `typecheck`, `lint`,
   `vitest` y `db:pruebas`. Lo pesado (compilar, e2e, barrido, capturas) lo
   corre solo el principal, al integrar y en tandas de 20. Si la compu anda
   justa de memoria, el principal baja a 2 ayudantes o a 1, y lo anota.
6. **Cada ayudante entrega un informe corto**: qué hizo, qué pruebas pasó y qué
   quedó. El principal lo verifica ejecutando antes de marcar ✅. Lo que dice un
   ayudante no es una prueba.
7. **Plata y permisos**: ningún ayudante cambia quién puede hacer qué ni cómo se
   cobra más allá de su ítem. Lo anota en `PREGUNTAS.md` en su rama.
