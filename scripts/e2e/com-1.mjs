#!/usr/bin/env node
// COM-1 · Riesgo de baja: Retención abre con "🎯 En riesgo" (los que pagan y
// muestran señales de irse) con el nivel, el porqué y el WhatsApp; la ficha
// del socio lo dice arriba; la recepción también lo ve; en el celular entra.
//   npm run e2e:com-1            (con scripts/local/levantar.sh corriendo)
import { CELU, COMPU, GIMNASIO, aparece, capturar, chequear, entrar, falla, navegador, pagina, resultado } from "./comun.mjs";

const G = GIMNASIO();
const b = await navegador();
try {
  const d = await pagina(b, COMPU);
  d.setDefaultNavigationTimeout(120000);
  await entrar(d, "duena@ejemplo.invalid");
  await d.goto(`${G}/panel/retencion?lista=riesgo`);
  await d.locator("main h1").waitFor({ timeout: 60000 });
  const lista = d.locator("[data-riesgo]");
  if (!(await aparece(lista, 15000))) {
    chequear(await aparece(d.getByText("Nadie en riesgo"), 5000), "nadie en riesgo en el demo: “🎉 Nadie en riesgo”", "la lista En riesgo no aparece");
  } else {
    const n = Number(await lista.getAttribute("data-riesgo"));
    const fila = lista.locator("li").first();
    const t = (await fila.innerText()).replace(/\s+/g, " ");
    chequear(/Riesgo (alto|medio)/.test(t) && /Venía|Reservaba|Pidió/.test(t) && await fila.locator('a[href*="wa.me"]').count() > 0,
      `🎯 En riesgo (${n}): “${t.slice(0, 110)}…” con su WhatsApp`, `la fila dice: ${t}`);
    const href = await fila.locator('a[href^="/panel/socios/"]').first().getAttribute("href");
    await d.goto(`${G}${href}`);
    const ficha = d.locator("[data-riesgo-ficha]");
    chequear(await aparece(ficha, 60000), `la ficha lo dice arriba: “${(await ficha.innerText().catch(() => "")).slice(0, 90)}”`, "la ficha no muestra el riesgo");
    await capturar(d, "com1-compu-ficha");
  }
  const r = await pagina(b, CELU);
  r.setDefaultNavigationTimeout(120000);
  await entrar(r, "recepcion@ejemplo.invalid");
  await r.goto(`${G}/panel/retencion`);
  await r.locator("main h1").waitFor({ timeout: 60000 });
  chequear(await r.locator('nav[aria-label="Listas"] a', { hasText: "En riesgo" }).count() === 1, "la recepción también la ve, primera en Retención", "la recepción no ve En riesgo");
  const w = await r.evaluate(() => document.documentElement.scrollWidth);
  chequear(w <= CELU.width + 1, "en el celular no se desborda", `se desborda: ${w}px`);
  await capturar(r, "com1-celu-retencion");
  for (const p of [d, r]) if (p.errores.length) falla(p.errores.join(" | "));
} catch (e) {
  falla(`se cortó: ${process.env.E2E_DEPURAR ? e.message : e.message.split("\n")[0]}`);
}
await b.close();
resultado();
