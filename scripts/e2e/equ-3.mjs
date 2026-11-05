#!/usr/bin/env node
// EQU-3 · Qué hizo cada uno: la dueña lo abre desde Equipo, ve el día (o "nadie
// anotó nada") y va al día anterior; la recepción no tiene acceso.
//   npm run e2e:equ-3            (con scripts/local/levantar.sh corriendo)
import { CELU, COMPU, GIMNASIO, chequear, entrar, falla, navegador, ok, pagina, resultado } from "./comun.mjs";

const G = GIMNASIO();
const b = await navegador();
try {
  const d = await pagina(b, COMPU);
  await entrar(d, "duena@ejemplo.invalid");
  await d.goto(`${G}/panel/equipo`);
  await d.locator("[data-link-actividad]").click();
  await d.waitForURL(/\/panel\/equipo\/actividad/, { timeout: 30000 });
  await d.locator("[data-dia-actividad]").waitFor({ timeout: 60000 });
  const hay = await d.locator("[data-personas-actividad]").count();
  ok(hay ? `hoy: ${await d.locator("[data-personas-actividad] > li").count()} personas con lo que hicieron` : "hoy: “Nadie anotó nada este día”");
  await d.getByRole("link", { name: "← Anterior" }).click();
  await d.waitForURL(/dia=\d{4}-\d{2}-\d{2}/, { timeout: 30000 });
  chequear((await d.locator("[data-dia-actividad]").innerText()) !== "Hoy", "← Anterior va al día de ayer", "sigue en hoy");
  const c = await pagina(b, CELU);
  await entrar(c, "duena@ejemplo.invalid");
  await c.goto(`${G}/panel/equipo/actividad`);
  await c.locator("[data-dia-actividad]").waitFor({ timeout: 60000 });
  const ancho = await c.evaluate(() => document.documentElement.scrollWidth);
  chequear(ancho <= CELU.width, `en el celular sin desborde (${ancho}px)`, `desborda ${ancho}`);
  const r = await pagina(b, COMPU);
  await entrar(r, "recepcion@ejemplo.invalid");
  await r.goto(`${G}/panel/equipo/actividad`);
  await r.getByText(/no tiene acceso|Sin permiso/).first().waitFor({ timeout: 60000 });
  ok("la recepción: “no tiene acceso”");
  for (const p of [d, c]) if (p.errores.length) falla(p.errores.join(" | "));
} catch (e) {
  falla(`se cortó: ${process.env.E2E_DEPURAR ? e.message : e.message.split("\n")[0]}`);
}
await b.close();
resultado();
