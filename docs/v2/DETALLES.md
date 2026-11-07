# Los detalles (07/11): terminar lo chico antes de los cambios de Mateo

Todo Gym OS v2 está **publicado** (PR #4, 07/11 20:24, 79 migraciones
aplicadas). Esto es lo que quedó chico: ~75 ítems abiertos de la COLA,
ordenados en 9 grupos. Ninguno cambia lo que decidió Mateo (D1-D35); si un
detalle toca permisos o plata más allá de una decisión, lo más prudente y
anotado en "Decisiones que tomó el agente".

Rama: `detalles/2026-11-07` (= lo publicado + 2 arreglos del cierre que no
entraron: la hoja Cobrar encima del veredicto, y otro). Se publica por grupo
(abajo).

## Antes de todo: lo que se encontró el 07/11

- **El "Guardando…/Sumando…" que se queda colgado** en la app compilada no es
  de Windows: pasa también en Linux (1 de cada 8 en "Sumar una dirección").
  La causa: Next 15.5 trae adentro React `19.2.0-canary-0bdb9206-20250818`,
  con un bug conocido (la acción termina, el `isPending` nunca vuelve). Lo
  arreglaron en React canary desde 2026-01-17 (PR #35518). **Ningún Next
  15.5.x lo trae** (15.5.29 tiene la misma); **Next 16.4.5 trae
  `19.3.0-canary-278794d7-20261002`**. Fuente:
  https://beyond-it-blog.vercel.app/blogs/react-19-fibre-deadlock-inside-nextjs-server-actions
- Verificación completa en Linux (modo producción) del 07/11: de los primeros
  93 recorridos fallaron 7 — `super-admin` (el cuelgue), `ent-6`, `pla-4`,
  `panel-vender`, `caj-4`, `caj-5`, `cla-2`. Los 2 que fallaban en Windows
  (`cfg-7`, `panel-socios`) pasan. Muchos ❌ de `CHE-ME-PASO.md` son recorridos
  que se colgaban, no funciones que falten: se vuelven a correr después del
  grupo 1.

## Grupo 1 · Que nada se cuelgue ni falle (primero, y solo)

- **VD-64 · Pasar a Next 16.4** (`npx @next/codemod@latest upgrade`, leer la
  guía de migración 15→16: `middleware` → `proxy`, `next lint` ya no existe,
  APIs async, caché). React del proyecto a la 19.2 estable. Nada de cambiar
  comportamiento: misma app, otra versión.
  LISTO SI: `scripts/diag/accion-colgada.mjs` (copiar de abajo) suma 50
  direcciones seguidas sin ningún cuelgue con la app compilada; build, lint,
  typecheck, vitest, base y toda la cadena e2e como antes o mejor.
- **VD-TRI1** · correr la cadena entera + barrido con la app compilada y
  dejar en verde lo que falle (empezando por los 7 de arriba). Cada falla: ¿la
  pantalla cambió a propósito? se actualiza la prueba; ¿está roto? se arregla.
- **VD-59** · volver a correr cada ❌ de `CHE-ME-PASO.md` y actualizar la tabla:
  lo que falte de verdad es un ítem.

`scripts/diag/accion-colgada.mjs` (entra como super admin, abre el primer
gimnasio y suma N direcciones; cuenta las que quedan en "Sumando…"):

```js
import { PLATAFORMA as B, entrar, navegador, pagina, COMPU } from "../e2e/comun.mjs";
const N = Number(process.argv[2] ?? 50);
const b = await navegador(); const p = await pagina(b, COMPU);
await entrar(p, "admin@ejemplo.invalid", undefined, B);
await p.goto(`${B}/admin`);
await p.locator('a:has-text("Equipo, claves")').first().click();
let colgadas = 0;
for (let i = 0; i < N; i++) {
  const d = `diag-${Date.now()}-${i}.vercel.app`;
  await p.fill("input[name=host]", d);
  await p.click('form:has-text("Sumar una dirección") button:has-text("Sumar")');
  try { await p.locator("li", { hasText: d }).waitFor({ timeout: 15000 }); }
  catch { colgadas++; await p.reload(); }
}
console.log(`colgadas ${colgadas} de ${N}`);
await b.close();
process.exit(colgadas ? 1 : 0);
```

## Grupo 2 · Plata y caja
VD-6C · VD-7B · VD-7C · VD-7D · VD-8B · VD-9B · VD-9C · VD-9D · VD-9E ·
VD-41B · VD-41C · VD-41D · VD-10B · VD-18B · VD-46S · VD-46W2

## Grupo 3 · Entrada y socios
VD-3B · VD-4B · VD-5C · VD-15B · VD-46V · VD-46X · VD-46G2 · VD-46G3 · VD-46G4

## Grupo 4 · Avisos y Para hacer hoy
VD-13B · VD-13C · VD-13D · VD-37B · VD-37C · VD-37D · VD-38C · VD-46N2 ·
VD-46O2 · VD-46Z

## Grupo 5 · Clases, eventos, rutinas y equipo
VD-24B · VD-25B · VD-19B · VD-20B · VD-46Y · VD-44B · VD-44C

## Grupo 6 · App del socio
VD-39B · VD-22C · VD-22D · VD-31B

## Grupo 7 · Seguridad, onboarding y super admin
VD-33D · VD-33E · VD-33F · VD-42B · VD-42C · VD-42D · VD-40B · VD-26B ·
VD-43B · VD-43C

## Grupo 8 · Navegación, configuración, números y velocidad
VD-21B · VD-21C · VD-28B · VD-28C · VD-28D · VD-29B · VD-29C · VD-29D ·
VD-30B · VD-16C · VD-25D

## Grupo 9 · Cierre
VD-32 (segunda pasada de punta a punta: un día del dueño, de la recepción y
un mes del socio, con capturas mirándolas) y una corrida final completa.

## No se tocan (esperan a Mateo)
REF-2 · REV-1d · COM-6b · COM-8b · COM-9b (decisiones 🟡), ADM-5 (trabado),
los 🔌 (cuentas externas). Los cambios que Mateo va a mandar van después.

## Cómo se trabaja

- Mismas reglas de siempre (`CLAUDE.md`, `scripts/noche/PROMPT.md`): cada
  ítem completo con su LISTO SI de la COLA, prueba de base si toca la base,
  e2e del recorrido, capturas en compu y celular; commit y push al cerrar
  cada ítem.
- Grupo 1 primero y solo. Desde el grupo 2, hasta 2 agentes en worktrees con
  ítems que no tocan los mismos archivos; migraciones con número reservado
  `2026110800NN00` (NN = orden del ítem en este archivo, 01 a 75).
- **Publicar al terminar cada grupo en verde** (base + e2e del grupo +
  barrido): rama `publicar/2026-11-08-g<N>` en ese commit → Actions → Base de
  datos → `prevuelo` → `aplicar` → PR a `main` → merge → esperar el deploy de
  Vercel → probar `/ingresar`, `/admin`, `/g/demo`. **Solo si no existe
  `.claude/BASE_CON_DATOS_REALES`**; si existe, se deja el PR listo y los
  comandos en el LOG para Mateo.
- Memoria: `docs/v2/ESTADO-DETALLES.md` (qué grupo, qué ítem, qué agentes).
- Al final: entrada en `docs/LOG.md` con el formato de reporte de
  `CLAUDE.md`.
