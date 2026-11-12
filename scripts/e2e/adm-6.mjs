#!/usr/bin/env node
// ADM-6 · Novedades de Gym OS: el admin publica una novedad; la dueña del demo
// la ve arriba en su Inicio, la cierra ("Entendido") y no vuelve; el admin la
// retira.
//   npm run e2e:adm-6            (con scripts/local/levantar.sh corriendo)
import { COMPU, GIMNASIO, PLATAFORMA as B, chequear, entrar, falla, navegador, ok, pagina, resultado } from "./comun.mjs";

const G = GIMNASIO();
const TITULO = `Novedad e2e ${Date.now() % 100000}`;
const b = await navegador();
try {
  const a = await pagina(b, COMPU);
  await entrar(a, "admin@ejemplo.invalid", undefined, B);
  const caja = a.locator("[data-novedades-admin]");
  await caja.waitFor({ timeout: 60000 });
  await caja.getByPlaceholder("Ya podés cobrar con MercadoPago").fill(TITULO);
  await caja.locator("textarea").fill("Texto de prueba para todos los dueños");
  await caja.getByRole("button", { name: /Publicar/ }).click();
  await caja.locator("li", { hasText: TITULO }).waitFor({ timeout: 30000 });
  ok("el admin publica la novedad");

  const d = await pagina(b, COMPU);
  await entrar(d, "duena@ejemplo.invalid");
  await d.goto(`${G}/panel`);
  const nov = d.locator("[data-novedades-gymos] > div", { hasText: TITULO });
  await nov.waitFor({ timeout: 60000 });
  ok("la dueña la ve arriba en Inicio");
  await nov.getByRole("button", { name: "Entendido" }).click();
  await nov.waitFor({ state: "detached", timeout: 10000 });
  await d.waitForTimeout(1500);
  await d.reload();
  await d.locator("main h1").first().waitFor({ timeout: 60000 });
  chequear(await d.locator("[data-novedades-gymos] > div", { hasText: TITULO }).count() === 0, "“Entendido”: no vuelve a aparecer", "volvió a aparecer");

  await a.reload();
  await caja.locator("li", { hasText: TITULO }).getByRole("button", { name: "Retirar" }).click();
  await caja.locator("li", { hasText: TITULO }).waitFor({ state: "detached", timeout: 30000 });
  ok("el admin la retira");
  for (const x of [a, d]) if (x.errores.length) falla(x.errores.join(" | "));
} catch (e) {
  falla(`se cortó: ${process.env.E2E_DEPURAR ? e.message : e.message.split("\n")[0]}`);
}
await b.close();
resultado();
