#!/usr/bin/env node
// SOC-13 · Alta en un paso: datos + plan + "Dar de alta y cobrar" lleva a
// Vender con el socio y la primera cuota en el carrito; "Solo dar de alta"
// deja el plan asignado; sin plan, el botón es el de siempre.
//   npm run e2e:soc-13           (con scripts/local/levantar.sh corriendo)
import { CELU, COMPU, GIMNASIO, capturar, chequear, entrar, falla, navegador, pagina, resultado } from "./comun.mjs";

const G = GIMNASIO();
const b = await navegador();
const s = Date.now().toString().slice(-5);
try {
  const p = await pagina(b, CELU);
  await entrar(p, "recepcion@ejemplo.invalid");
  await p.goto(`${G}/panel/socios/nuevo`);
  await p.locator('input[name="nombre"]').fill(`Alta${s}`);
  chequear(await p.locator('button:has-text("Dar de alta y cobrar")').count() === 0, "sin plan elegido: solo “Dar de alta”", "aparece cobrar sin plan");
  const opciones = await p.locator('select[aria-label="Plan"] option').allInnerTexts();
  await p.locator('select[aria-label="Plan"]').selectOption({ index: 1 });
  const plan = opciones[1].split(" · ")[0];
  await p.locator('button:has-text("Dar de alta y cobrar")').waitFor();
  await capturar(p, "soc13-celu-alta");
  await p.locator('button:has-text("Dar de alta y cobrar")').click();
  await p.waitForURL(/\/panel\/vender\?socio=.*cuota=1/, { timeout: 30000 });
  await p.getByText(`Cuota ${plan}`).first().waitFor({ timeout: 30000 });
  chequear(await p.getByText(`Alta${s}`).count() > 0, `Vender: con Alta${s} y la “Cuota ${plan}” ya en el carrito`, "no está el socio en Vender");
  const ancho = await p.evaluate(() => document.documentElement.scrollWidth);
  chequear(ancho <= CELU.width, `celular sin desborde en Vender (${ancho}px)`, `mide ${ancho}px`);
  if (p.errores.length) falla(`recepción: ${p.errores.join(" | ")}`);
  await p.context().close();

  const d = await pagina(b, COMPU);
  await entrar(d, "recepcion@ejemplo.invalid");
  await d.goto(`${G}/panel/socios/nuevo`);
  await d.locator('input[name="nombre"]').fill(`Solo${s}`);
  await d.locator('select[aria-label="Plan"]').selectOption({ index: 1 });
  await d.locator('button:has-text("Solo dar de alta")').click();
  await d.waitForURL(/\/panel\/socios\/[0-9a-f-]{36}$/, { timeout: 30000 });
  await d.locator("h1").waitFor();
  chequear(await d.getByText(plan, { exact: true }).count() > 0, `“Solo dar de alta”: la ficha ya tiene el ${plan}`, "la ficha no tiene el plan");
  if (d.errores.length) falla(`recepción compu: ${d.errores.join(" | ")}`);
} catch (e) {
  falla(`se cortó: ${process.env.E2E_DEPURAR ? e.message : e.message.split("\n")[0]}`);
}
await b.close();
resultado();
