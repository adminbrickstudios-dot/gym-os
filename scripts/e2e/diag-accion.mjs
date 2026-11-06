#!/usr/bin/env node
// Diagnóstico (no es un recorrido de la tanda): ¿después de una acción del servidor la pantalla se refresca sola?
// Pone una etiqueta en una ficha y mira, con el tiempo, si aparece; después recarga y mira de nuevo.
import { COMPU, GIMNASIO, entrar, navegador, pagina } from "./comun.mjs";
const G = GIMNASIO();
const b = await navegador();
const p = await pagina(b, COMPU);
await entrar(p, "recepcion@ejemplo.invalid");
await p.goto(`${G}/panel/socios`);
const href = await p.locator('main ul a[href^="/panel/socios/"]').first().getAttribute("href");
await p.goto(`${G}${href}`);
const ETQ = `Diag${Date.now().toString().slice(-5)}`;
p.on("response", async (r) => {
  if (r.request().method() === "POST" && r.url().includes("/panel/socios/")) {
    const t = await r.text().catch(() => "?");
    console.log(`[accion] ${r.status()} ${r.headers()["content-type"]} cache=${r.headers()["cache-control"]} largo=${t.length} tieneEtiqueta=${t.includes(ETQ)} ${t.slice(0, 160).replace(/\s+/g, " ")}`);
  }
});
await p.locator('input[aria-label="Nueva etiqueta"]').fill(ETQ);
await p.locator('button:has-text("Poner")').click();
for (const ms of [500, 2000, 5000]) {
  await p.waitForTimeout(ms);
  console.log(`[+${ms}ms] etiqueta en pantalla: ${await p.locator("[data-etiqueta]", { hasText: ETQ }).count()}`);
}
await p.reload();
console.log(`[recarga] etiqueta en pantalla: ${await p.locator("[data-etiqueta]", { hasText: ETQ }).count()}`);
await b.close();
