#!/usr/bin/env node
// SOC-11 · Apto físico (D9): apagado no aparece; la dueña lo prende en
// Reglas; la recepción carga "vale hasta" en la ficha y lo quita; apagado
// otra vez, desaparece.
//   npm run e2e:soc-11           (con scripts/local/levantar.sh corriendo)
import { COMPU, GIMNASIO, chequear, entrar, falla, navegador, ok, pagina, resultado } from "./comun.mjs";

const G = GIMNASIO();
const b = await navegador();
const vence = `${new Date().getFullYear() + 1}-04-30`;
async function prenderApto(p, prender) {
  await p.goto(`${G}/panel/configuracion?pestana=reglas`);
  await p.locator('fieldset[data-pestana-activa="reglas"]').waitFor({ timeout: 60000 });
  await p.waitForTimeout(800);
  const sw = p.locator('fieldset[data-pestana-activa] label', { hasText: "Pedir apto físico" }).locator("input");
  if (await sw.isChecked() === prender) return;
  await sw.click();
  const pie = p.locator('[data-pie="reglas"]');
  const antes = Number(await pie.getAttribute("data-respuestas"));
  await pie.locator('button:has-text("Guardar")').click();
  await p.waitForFunction((n) => Number(document.querySelector('[data-pie="reglas"]')?.getAttribute("data-respuestas")) > n, antes, { timeout: 30000 });
}
try {
  const d = await pagina(b, COMPU);
  await entrar(d, "duena@ejemplo.invalid");
  await prenderApto(d, false);
  const r = await pagina(b, COMPU);
  await entrar(r, "recepcion@ejemplo.invalid");
  await r.goto(`${G}/panel/socios`);
  const href = await r.locator('main ul a[href^="/panel/socios/"]').first().getAttribute("href");
  await r.goto(`${G}${href}`); await r.locator("h1").waitFor();
  chequear(await r.locator("[data-apto]").count() === 0, "apagado: la ficha no habla de apto", "apagado igual aparece");

  await prenderApto(d, true);
  ok("la dueña prende “Pedir apto físico” en Reglas");
  await r.reload(); await r.locator("[data-apto]").waitFor({ timeout: 30000 });
  if (await r.locator('[data-apto] button:has-text("Fue un error")').count()) {   // de una corrida anterior
    await r.locator('[data-apto] button:has-text("Fue un error")').click(); await r.locator('[data-apto="no"]').waitFor({ timeout: 30000 });
  }
  chequear(/Sin apto físico/.test(await r.locator("[data-apto]").innerText()), "prendido: “Sin apto físico”", "no dice sin apto");
  await r.locator('[data-apto] button:has-text("Cargar apto")').click();
  await r.locator('input[aria-label="El apto vale hasta"]').fill(vence);
  await r.locator('[data-apto] button:has-text("Guardar")').click();
  await r.locator('[data-apto="vigente"]').waitFor({ timeout: 30000 });
  const txt = await r.locator("[data-apto]").innerText();
  chequear(new RegExp(`Apto hasta el ${vence.slice(8, 10)}/${vence.slice(5, 7)}`).test(txt), `la recepción lo carga: “${txt.split("\n")[0]}”`, `dice: ${txt}`);
  await r.locator('[data-apto] button:has-text("Fue un error")').click();
  await r.locator('[data-apto="no"]').waitFor({ timeout: 30000 });
  ok("y lo quita si fue un error");
  await prenderApto(d, false);
  await r.reload(); await r.locator("h1").waitFor();
  chequear(await r.locator("[data-apto]").count() === 0, "apagado otra vez, desaparece", "sigue apareciendo");
  for (const [n, p] of [["dueña", d], ["recepción", r]]) if (p.errores.length) falla(`${n}: ${p.errores.join(" | ")}`);
} catch (e) {
  falla(`se cortó: ${process.env.E2E_DEPURAR ? e.message : e.message.split("\n")[0]}`);
}
await b.close();
resultado();
