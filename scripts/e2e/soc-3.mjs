#!/usr/bin/env node
// SOC-3 · Notas y etiquetas: la recepción pone una etiqueta y escribe una
// nota (con su nombre y la hora); otro socio con la misma etiqueta escrita
// distinto; la lista de Socios y Retención filtran por etiqueta; la dueña
// borra la nota; sacar la etiqueta la saca del filtro.
//   npm run e2e:soc-3            (con scripts/local/levantar.sh corriendo)
import { COMPU, GIMNASIO, chequear, entrar, falla, navegador, ok, pagina, resultado } from "./comun.mjs";

const G = GIMNASIO();
const b = await navegador();
const s = Date.now().toString().slice(-5);
const ETQ = `Turno ${s}`;
const filasSocios = (p) => p.locator('main ul a[href^="/panel/socios/"]');
try {
  const r = await pagina(b, COMPU);
  await entrar(r, "recepcion@ejemplo.invalid");
  await r.goto(`${G}/panel/socios`);
  await filasSocios(r).first().waitFor({ timeout: 30000 });
  const links = await filasSocios(r).evaluateAll((xs) => xs.slice(0, 2).map((x) => x.getAttribute("href")));
  const nombres = [];
  for (const [i, href] of links.entries()) {
    await r.goto(`${G}${href}`);
    await r.locator("h1").waitFor();
    nombres.push((await r.locator("h1").innerText()).trim());
    await r.locator('input[aria-label="Nueva etiqueta"]').fill(i === 0 ? ETQ : ETQ.toUpperCase());
    await r.locator('button:has-text("Poner")').click();
    await r.locator(`[data-etiqueta]`, { hasText: new RegExp(ETQ, "i") }).waitFor({ timeout: 30000 });
  }
  chequear(nombres.length === 2, `etiqueta “${ETQ}” puesta a ${nombres.join(" y ")} (la segunda escrita en mayúsculas)`, "no se pudo poner la etiqueta");
  // Nota
  await r.goto(`${G}${links[0]}?pestana=notas`);
  await r.locator("textarea").fill(`Prefiere el turno ${s}`);
  await r.locator('button:has-text("Guardar nota")').click();
  const nota = r.locator("[data-nota]", { hasText: `Prefiere el turno ${s}` });
  await nota.waitFor({ timeout: 30000 });
  chequear(/Ana · \d+\/\d+\/\d+/.test(await nota.innerText()), `nota con autor y fecha: “${(await nota.innerText()).replace(/\s+/g, " ")}”`, "la nota no dice quién ni cuándo");

  // Filtro en Socios
  await r.goto(`${G}/panel/socios`);
  await r.locator("[data-filtro-etiquetas] a", { hasText: ETQ }).click();
  await r.waitForURL(/etiqueta=/);
  const filtrados = (await filasSocios(r).allInnerTexts()).map((x) => x.replace(/\s+/g, " "));
  chequear(filtrados.length === 2 && nombres.every((n) => filtrados.some((f) => f.includes(n.split(" ")[0]))), `Socios filtrado por “${ETQ}”: ${filtrados.length}`, `filtrados: ${filtrados.join(" | ")}`);
  if (r.errores.length) falla(`recepción: ${r.errores.join(" | ")}`);
  await r.context().close();

  // Dueña: Retención con filtro, borra la nota, saca las etiquetas
  const d = await pagina(b, COMPU);
  await entrar(d, "duena@ejemplo.invalid");
  await d.goto(`${G}/panel/retencion`);
  await d.locator("[data-filtro-etiquetas] a", { hasText: ETQ }).click();
  await d.waitForURL(/etiqueta=/);
  ok("Retención: filtra por etiqueta");
  await d.goto(`${G}${links[0]}?pestana=notas`);
  const n2 = d.locator("[data-nota]", { hasText: `Prefiere el turno ${s}` });
  await n2.locator('button:has-text("Borrar")').click();
  await n2.waitFor({ state: "detached", timeout: 30000 });
  ok("la dueña borra la nota de la recepción");
  for (const href of links) {
    await d.goto(`${G}${href}`);
    await d.locator(`[data-etiqueta] button[aria-label^="Sacar"]`).first().click();
    await d.locator(`[data-etiqueta]`, { hasText: new RegExp(ETQ, "i") }).waitFor({ state: "detached", timeout: 30000 });
  }
  await d.goto(`${G}/panel/socios`);
  chequear(await d.locator("[data-filtro-etiquetas] a", { hasText: ETQ }).count() === 0, "sacada a todos, la etiqueta desaparece del filtro", "la etiqueta sigue en el filtro");
  if (d.errores.length) falla(`dueña: ${d.errores.join(" | ")}`);
  await d.context().close();
} catch (e) {
  falla(`se cortó: ${process.env.E2E_DEPURAR ? e.message : e.message.split("\n")[0]}`);
}
await b.close();
resultado();
