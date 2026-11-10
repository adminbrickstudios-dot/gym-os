#!/usr/bin/env node
// VEN-5 · Cuenta corriente (D5): la dueña prende "fiar" con tope; se le cobra
// la cuota "A cuenta" a un socio nuevo; la Entrada lo deja pasar en amarillo
// con "Debe $… a cuenta"; paga la deuda en Vender y vuelve a verde. Al final
// apaga el fiado.
//   npm run e2e:ven-5            (con scripts/local/levantar.sh corriendo)
import { COMPU, GIMNASIO, capturar, chequear, entrar, esperarCobro, falla, navegador, ok, pagina, resultado } from "./comun.mjs";
import { elegirPlan, hojaDeAlta, irAVender } from "./alta.mjs";

const G = GIMNASIO();
const b = await navegador();
const s5 = Date.now().toString().slice(-5);
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
const fiar = d.locator("label", { hasText: "Se puede cobrar a cuenta" }).locator("input");
try {
  await entrar(d, "duena@ejemplo.invalid");
  await cobros();
  if (!(await fiar.isChecked())) await fiar.click();
  await d.locator('input[aria-label="Tope para fiar"]').fill("30000");
  chequear(/Guardado|guardad/i.test(await guardar()), "Configuración → Cobros: fiar prendido, tope $30.000", "no guardó");

  await d.goto(`${G}/panel/socios/nuevo`);
  await d.locator('input[name="nombre"]').fill(`Fiado${s5}`);
  await elegirPlan(d, "Plan Full");
  await d.locator('button:has-text("Dar de alta y cobrar")').click();
  // VD-5b: "Dar de alta y cobrar" abre la hoja Cobrar sobre el alta; después se sigue en Vender con el socio.
  await irAVender(d, await hojaDeAlta(d));
  const id = new URL(d.url()).searchParams.get("socio");
  await d.getByText(/^Cuota /).first().waitFor({ timeout: 30000 });
  await d.locator('button[aria-pressed]:has-text("A cuenta")').click();
  await d.locator("[data-fiado]").waitFor();
  chequear(/hasta \$30\.000 más/.test(await d.locator("[data-fiado]").innerText()), "Vender: “A cuenta”, se le puede fiar hasta $30.000", await d.locator("[data-fiado]").innerText());
  await d.locator('button:has-text("Cobrar")').click();
  await esperarCobro(d);
  ok("cuota cobrada a cuenta");

  await d.goto(`${G}/panel/entrada?socio=${id}`);
  const am = d.locator('[data-veredicto="amarillo"]');
  await am.waitFor({ timeout: 30000 });
  chequear(/Debe \$25\.000 a cuenta/.test(await am.innerText()), "la Entrada lo deja pasar en amarillo: “Debe $25.000 a cuenta”", await am.innerText());
  await capturar(d, "ven5-compu-entrada");

  await d.goto(`${G}/panel/vender?socio=${id}`);
  await d.locator("main button", { hasText: "Pagar lo que debe" }).click();
  await d.locator('button[aria-pressed]:has-text("Transferencia")').click();
  await d.locator('button:has-text("Cobrar")').click();
  await esperarCobro(d);
  await d.goto(`${G}/panel/entrada?socio=${id}`);
  await d.locator('[data-veredicto="verde"]').waitFor({ timeout: 30000 });
  ok("pagó la deuda en Vender: vuelve a verde");
  if (d.errores.length) falla(`dueña: ${d.errores.join(" | ")}`);
} catch (e) {
  falla(`se cortó: ${process.env.E2E_DEPURAR ? e.message : e.message.split("\n")[0]}`);
} finally {
  try { await cobros(); if (await fiar.isChecked()) { await fiar.click(); await guardar(); } } catch { falla("no pude apagar el fiado al final"); }
}
await b.close();
resultado();
