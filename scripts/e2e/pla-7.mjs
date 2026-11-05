#!/usr/bin/env node
// PLA-7 · Recargo por pagar tarde (D8): apagado, Vender no suma nada; la dueña
// lo prende en Configuración → Cobros (10% con más de 10 días); Vender le suma
// a Testigo Vencida (20 días) una línea "Recargo por pagar tarde" que no se
// puede sacar, solo descontar. Al final lo vuelve a apagar.
//   npm run e2e:pla-7            (con scripts/local/levantar.sh corriendo)
import { COMPU, GIMNASIO, capturar, chequear, entrar, falla, navegador, ok, pagina, resultado } from "./comun.mjs";

const G = GIMNASIO();
const b = await navegador();
const d = await pagina(b, COMPU);
const pie = d.locator('[data-pie="cobros"]');
async function cobros() {
  await d.goto(`${G}/panel/configuracion?pestana=cobros`);
  await d.locator('fieldset[data-pestana-activa="cobros"]').waitFor({ timeout: 30000 });
  await d.waitForTimeout(800);
}
async function guardar() {
  if (await pie.locator('button:has-text("Guardar")').isDisabled()) return "";
  const antes = Number(await pie.getAttribute("data-respuestas"));
  await pie.locator('button:has-text("Guardar")').click();
  await d.waitForFunction((n) => Number(document.querySelector('[data-pie="cobros"]')?.getAttribute("data-respuestas")) > n, antes, { timeout: 30000 });
  return (await pie.locator(".mensaje").first().innerText()).replace(/\s+/g, " ").trim();
}
async function vencida() {
  await d.goto(`${G}/panel/socios?q=${encodeURIComponent("Testigo Vencida")}`);
  const id = (await d.locator('main ul a[href^="/panel/socios/"]').first().getAttribute("href")).split("/").pop();
  await d.goto(`${G}/panel/vender?socio=${id}&cuota=1`);
  await d.getByText(/^Cuota /).first().waitFor({ timeout: 30000 });
}
try {
  await entrar(d, "duena@ejemplo.invalid");
  await cobros();
  await d.locator('label:has-text("Sin recargo")').click();
  await guardar();
  await vencida();
  chequear(await d.getByText(/Recargo por pagar tarde/).count() === 0, "apagado (como viene): Vender no suma recargo", "suma recargo apagado");

  await cobros();
  await d.locator('label:has-text("% de la cuota")').click();
  await d.locator('input[aria-label="Valor del recargo"]').fill("10");
  await d.locator("label", { hasText: "Con más de cuántos días de atraso" }).locator("input").fill("10");
  const m = await guardar();
  chequear(/Guardado|guardad/i.test(m), "la dueña lo prende: 10% con más de 10 días de atraso", m);

  await vencida();
  const linea = d.locator("aside li", { hasText: "Recargo por pagar tarde" });
  await linea.waitFor({ timeout: 30000 });
  chequear(/\(\d+ días\)/.test(await linea.innerText()), "Vender suma “Recargo por pagar tarde (N días)” con la cuota, antes de cobrar", await linea.innerText());
  chequear(await linea.locator('button[aria-label="Uno menos"]').isDisabled(), "no se puede sacar (solo descontar, con motivo)", "se puede sacar");
  await capturar(d, "pla7-compu-carrito");
  ok("visible antes de cobrar");
} catch (e) {
  falla(`se cortó: ${process.env.E2E_DEPURAR ? e.message : e.message.split("\n")[0]}`);
} finally {
  try { await cobros(); await d.locator('label:has-text("Sin recargo")').click(); await guardar(); } catch { falla("no pude volver a apagar el recargo"); }
}
await b.close();
resultado();
