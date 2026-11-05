#!/usr/bin/env node
// SOC-5 · Grupo familiar: desde la ficha, sumar a otro socio a la familia;
// se ven el uno en la ficha del otro, con su estado; sacarlo la deshace.
//   npm run e2e:soc-5            (con scripts/local/levantar.sh corriendo)
import { CELU, GIMNASIO, chequear, entrar, falla, navegador, pagina, resultado } from "./comun.mjs";

const G = GIMNASIO();
const b = await navegador();
try {
  const p = await pagina(b, CELU);
  await entrar(p, "recepcion@ejemplo.invalid");
  await p.goto(`${G}/panel/socios`);
  const filas = p.locator('main ul a[href^="/panel/socios/"]');
  await filas.first().waitFor({ timeout: 30000 });
  const [h1, h2] = await filas.evaluateAll((xs) => xs.slice(0, 2).map((x) => x.getAttribute("href")));
  await p.goto(`${G}${h2}`); await p.locator("h1").waitFor();
  const nombre2 = (await p.locator("h1").innerText()).trim();
  await p.goto(`${G}${h1}`); await p.locator("[data-familia]").waitFor();
  if (Number(await p.locator("[data-familia]").getAttribute("data-familia")) > 0) {   // de una corrida anterior
    while (await p.locator('[data-familia] button:has-text("Sacar")').count()) {
      await p.locator('[data-familia] button:has-text("Sacar")').first().click(); await p.waitForTimeout(1500);
    }
  }
  await p.locator('input[aria-label="Sumar a la familia"]').fill(nombre2.split(" ")[0] + " " + nombre2.split(" ")[1]);
  await p.locator("[data-familia] button.fila", { hasText: nombre2 }).first().click();
  await p.locator("[data-familia] a", { hasText: nombre2 }).waitFor({ timeout: 30000 });
  chequear(true, `suma a ${nombre2} a la familia`, "");
  await p.goto(`${G}${h2}`);
  await p.locator("[data-familia] a").first().waitFor({ timeout: 30000 });
  chequear(await p.locator("[data-familia] li").count() === 1, "en la ficha del otro aparece el primero, con su estado", "no aparece en la otra ficha");
  const ancho = await p.evaluate(() => document.documentElement.scrollWidth);
  const anchos = ancho > CELU.width ? await p.evaluate(() => [...document.querySelectorAll("main *")].filter((e) => e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).overflowX === "visible").slice(-3).map((e) => `${e.tagName}.${(e.className + "").slice(0, 40)} ${e.scrollWidth}/${e.clientWidth}`).join(" ; ")) : "";
  chequear(ancho <= CELU.width, `celular sin desborde (${ancho}px)`, `mide ${ancho}px: ${anchos}`);
  await p.locator('[data-familia] button:has-text("Sacar")').click();
  await p.locator('[data-familia="0"]').waitFor({ timeout: 30000 });
  chequear(true, "sacarlo deshace la familia (de uno no es familia)", "");
  if (p.errores.length) falla(`recepción: ${p.errores.join(" | ")}`);
} catch (e) {
  falla(`se cortó: ${process.env.E2E_DEPURAR ? e.message : e.message.split("\n")[0]}`);
}
await b.close();
resultado();
