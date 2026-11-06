#!/usr/bin/env node
// Diagnóstico (no es un recorrido de la tanda): ¿después de una acción del servidor la pantalla se refresca sola?
// 1) etiqueta en dos fichas (la segunda en mayúsculas, como SOC-3) y 2) plan nuevo en Planes (como PLA-1).
import { COMPU, GIMNASIO, entrar, navegador, pagina } from "./comun.mjs";
const G = GIMNASIO();
const b = await navegador();
const p = await pagina(b, COMPU);
await entrar(p, "recepcion@ejemplo.invalid");
await p.goto(`${G}/panel/socios`);
const links = await p.locator('main ul a[href^="/panel/socios/"]').evaluateAll((xs) => xs.slice(0, 2).map((x) => x.getAttribute("href")));
const ETQ = `Diag ${Date.now().toString().slice(-5)}`;
const mira = async (cual, ms) => {
  await p.waitForTimeout(ms);
  console.log(`[${cual} +${ms}ms] etiquetas: ${await p.locator("[data-etiqueta]").allInnerTexts().then((t) => JSON.stringify(t))} | error: ${await p.locator('main [role="alert"], main .texto-rojo').allInnerTexts().then((t) => JSON.stringify(t))}`);
};
for (const [i, href] of links.entries()) {
  await p.goto(`${G}${href}`);
  await p.locator('input[aria-label="Nueva etiqueta"]').fill(i === 0 ? ETQ : ETQ.toUpperCase());
  await p.locator('button:has-text("Poner")').click();
  await mira(`ficha ${i}`, 1500);
  await mira(`ficha ${i}`, 4000);
  await p.reload();
  await mira(`ficha ${i} recargada`, 0);
}
await b.close();

const b2 = await navegador();
const d = await pagina(b2, COMPU);
await entrar(d, "duena@ejemplo.invalid");
await d.goto(`${G}/panel/planes`);
const NOM = `Dg${Date.now().toString().slice(-5)}`;
await d.locator('button:has-text("Nuevo plan")').click();
await d.locator('input[name="nombre"]').fill(NOM);
await d.locator('input[name="precio"]').fill("1000");
await d.locator('button:has-text("Crear")').click();
for (const ms of [1500, 4000]) {
  await d.waitForTimeout(ms);
  console.log(`[plan +${ms}ms] en la lista: ${await d.locator(`li[data-plan="${NOM}"]`).count()} | formulario abierto: ${await d.locator('input[name="nombre"]').count()}`);
}
await d.reload();
console.log(`[plan recargado] en la lista: ${await d.locator(`li[data-plan="${NOM}"]`).count()}`);
await b2.close();
