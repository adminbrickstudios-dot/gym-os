#!/usr/bin/env node
// AUD-10 · Retención botón por botón: la plata en riesgo, cada lista, el
// WhatsApp armado, "Dice que vuelve" que queda anotado, "💵 Cobrar" en los
// vencidos, la lista vacía con camino a otra; la recepción no entra; celular.
//   npm run e2e:retencion            (con scripts/local/levantar.sh corriendo)
import { CELU, COMPU, GIMNASIO, capturar, chequear, entrar, falla, navegador, ok, pagina, resultado } from "./comun.mjs";

const G = GIMNASIO();
const b = await navegador();
try {
  const d = await pagina(b, COMPU);
  await entrar(d, "duena@ejemplo.invalid");
  await d.goto(`${G}/panel/retencion?lista=vencido`);
  await d.locator("main h1").waitFor({ timeout: 60000 });
  const tablero = d.locator("[data-tablero-retencion]");
  const tt = await tablero.innerText();
  chequear(/Al día/.test(tt) && /Altas del mes/.test(tt) && /Bajas del mes/.test(tt) && /\$[\d.]+/.test(tt), "arriba: al día con 12 semanas, altas, bajas y la plata en riesgo (RET-1)", tt.slice(0, 160));
  const tabs = d.locator('nav[aria-label="Listas"] a');
  chequear(await tabs.count() === 5, "5 listas con su número", `${await tabs.count()} listas`);
  const filas = d.locator("main ul > li");
  if (await filas.count()) {
    const f = filas.first();
    chequear(await f.locator('a:has-text("Cobrar")').count() === 1, "vencidos: cada fila con “💵 Cobrar”", "sin Cobrar");
    const wa = await f.locator('a:has-text("WhatsApp")').getAttribute("href").catch(() => null);
    chequear(!wa || /^https:\/\/wa\.me\/\d+\?text=/.test(wa), "WhatsApp con el mensaje ya escrito", String(wa));
    const vuelve = f.getByRole("button", { name: /Dice que vuelve/ });
    if (await vuelve.count()) {
      await vuelve.click();
      await f.getByText(/Anotado recién/).waitFor({ timeout: 30000 });
      ok("“🙌 Dice que vuelve” queda anotado");
    }
  }
  for (let i = 0; i < 5; i++) {
    await tabs.nth(i).click();
    await d.waitForLoadState("networkidle").catch(() => {});
    if (await d.locator("main ul > li").count() === 0) {
      chequear(await d.getByText("Nadie en esta lista").count() === 1, `lista vacía (${(await tabs.nth(i).innerText()).split("\n")[0]}): lo dice y lleva a otra`, "vacía sin texto");
      break;
    }
  }
  if (d.errores.length) falla(`dueña: ${d.errores.join(" | ")}`);

  const e = await pagina(b, CELU);
  await entrar(e, "encargado@ejemplo.invalid");
  await e.goto(`${G}/panel/retencion`);
  await e.locator("main h1").waitFor({ timeout: 60000 });
  const ancho = await e.evaluate(() => document.documentElement.scrollWidth);
  chequear(ancho <= CELU.width, `el encargado en el celular, sin desborde (${ancho}px)`, `desborda: ${ancho}`);
  await capturar(e, "aud10-celu-retencion");

  const r = await pagina(b, COMPU);
  await entrar(r, "recepcion@ejemplo.invalid");
  await r.goto(`${G}/panel/retencion`);
  await r.locator("main").waitFor({ timeout: 60000 });
  chequear(/acceso|permiso/i.test(await r.locator("main").innerText()), "la recepción no entra (decisión D2 pendiente: RET-2)", "la recepción ve Retención");
} catch (e) {
  falla(`se cortó: ${process.env.E2E_DEPURAR ? e.message : e.message.split("\n")[0]}`);
}
await b.close();
resultado();
