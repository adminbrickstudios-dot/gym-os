#!/usr/bin/env node
// RES-1 · Resultado: la plata del mes contra el anterior, de dónde, cómo
// pagaron, día por día y horas pico; se puede ir al mes anterior; la
// recepción no lo ve.
//   npm run e2e:res-1            (con scripts/local/levantar.sh corriendo)
import { CELU, COMPU, GIMNASIO, capturar, chequear, entrar, falla, navegador, pagina, resultado } from "./comun.mjs";

const G = GIMNASIO();
const b = await navegador();
try {
  const d = await pagina(b, COMPU);
  await entrar(d, "duena@ejemplo.invalid");
  await d.goto(`${G}/panel`);
  await d.locator("nav a", { hasText: "Resultado" }).first().click();
  await d.waitForURL(/\/panel\/resultado/, { timeout: 30000 });
  const cobrado = d.locator("[data-resultado-cobrado]");
  await cobrado.waitFor({ timeout: 60000 });
  const t = await d.locator("main").innerText();
  chequear(/\$/.test(await cobrado.innerText()) && /Socios al día/.test(t) && /Recurrente por mes/.test(t) && /Día por día/.test(t) && /Horas pico/.test(t),
    `menú → 📈 Resultado: ${(await cobrado.innerText()).split("\n").join(" · ")}`, t.slice(0, 200));
  const antes = (await d.locator("nav[aria-label=Mes] [aria-current]").innerText()).trim();
  await d.locator("nav[aria-label=Mes] a").first().click();
  await d.waitForURL(/mes=\d{4}-\d{2}/, { timeout: 30000 });
  await d.waitForFunction((a) => document.querySelector("nav[aria-label=Mes] [aria-current]")?.textContent?.trim() !== a, antes, { timeout: 30000 });
  chequear(await d.locator("nav[aria-label=Mes] a", { hasText: "→" }).count() === 1, `el mes anterior (${(await d.locator("nav[aria-label=Mes] [aria-current]").innerText()).trim()}) y la flecha para volver`, "sin flecha");
  if (d.errores.length) falla(`dueña: ${d.errores.join(" | ")}`);

  const c = await pagina(b, CELU);
  await entrar(c, "encargado@ejemplo.invalid");
  await c.goto(`${G}/panel/resultado`);
  await c.locator("[data-resultado-cobrado]").waitFor({ timeout: 60000 });
  const ancho = await c.evaluate(() => document.documentElement.scrollWidth);
  chequear(ancho <= CELU.width, `el encargado en el celular, sin desborde (${ancho}px)`, `desborda: ${ancho}`);
  await capturar(c, "res1-celu", true);

  const r = await pagina(b, COMPU);
  await entrar(r, "recepcion@ejemplo.invalid");
  await r.goto(`${G}/panel/resultado`);
  await r.locator("main").waitFor({ timeout: 60000 });
  chequear(/acceso|permiso/i.test(await r.locator("main").innerText()), "la recepción no lo ve", "la recepción lo ve");
} catch (e) {
  falla(`se cortó: ${process.env.E2E_DEPURAR ? e.message : e.message.split("\n")[0]}`);
}
await b.close();
resultado();
