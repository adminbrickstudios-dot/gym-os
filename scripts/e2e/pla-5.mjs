#!/usr/bin/env node
// PLA-5 · Precio por medio de pago y por día, desde la pantalla: la dueña arma
// la lista de un pase (general, efectivo más barato) y de una membresía (más
// barato pagando hasta el 10); lo más caro que el general avisa; un aumento
// programado se anula; Vender cobra el de efectivo.
//   npm run e2e:pla-5            (con scripts/local/levantar.sh corriendo)
import { CELU, COMPU, GIMNASIO, capturar, chequear, entrar, falla, navegador, ok, pagina, resultado } from "./comun.mjs";

const G = GIMNASIO();
const b = await navegador();
const s5 = Date.now().toString().slice(-5);
const plan = (p, n) => p.locator(`li[data-plan="${n}"]`);
async function nuevo(p, tipo, nombre, precio) {
  await p.locator('button:has-text("Nuevo plan")').click();
  if (tipo) await p.locator(`label:has-text("${tipo}")`).click();
  await p.locator('input[name="nombre"]').fill(nombre);
  await p.locator('input[name="precio"]').fill(precio);
  await p.locator('button:has-text("Crear")').click();
  await plan(p, nombre).waitFor({ timeout: 30000 });
}
try {
  const d = await pagina(b, COMPU);
  await entrar(d, "duena@ejemplo.invalid");
  await d.goto(`${G}/panel/planes`);
  await d.locator('main h2:has-text("Membresías")').waitFor({ timeout: 60000 });

  await nuevo(d, "Pase", `Pase${s5}`, "5.000");
  const pase = plan(d, `Pase${s5}`);
  await pase.locator('button:has-text("Precios")').click();
  chequear(await pase.locator('input[aria-label="Hasta el día"]').count() === 0 && await pase.locator('button:has-text("Precio por pagar antes")').count() === 0,
    "un pase no ofrece “pagando antes del día” (eso es de la cuota)", "el pase ofrece precio por día");
  await pase.locator('input[aria-label="Precio con Efectivo"]').fill("5.500");
  await pase.locator('button:has-text("Guardar precios")').click();
  await pase.locator('[role="alert"]:has-text("menor que el general")').waitFor({ timeout: 30000 });
  ok("más caro que el general: avisa que se cobra siempre el más barato");
  await pase.locator('input[aria-label="Precio con Efectivo"]').fill("4.500");
  await pase.locator('button:has-text("Guardar precios")').click();
  await pase.locator("[data-variantes]").waitFor({ timeout: 30000 });
  chequear(/Efectivo: \$4\.500/.test(await pase.locator("[data-variantes]").innerText()), "el pase dice “Efectivo: $4.500” debajo del general", await pase.innerText());

  await nuevo(d, null, `Cuota${s5}`, "30.000");
  const cuota = plan(d, `Cuota${s5}`);
  await cuota.locator('button:has-text("Precios")').click();
  await cuota.locator('button:has-text("Precio por pagar antes")').click();
  await cuota.locator('input[aria-label="Precio hasta ese día"]').fill("27.000");
  await cuota.locator('button:has-text("Guardar precios")').click();
  await cuota.locator("[data-variantes]").waitFor({ timeout: 30000 });
  chequear(/hasta el día 10: \$27\.000/.test(await cuota.locator("[data-variantes]").innerText()), "la cuota: “hasta el día 10: $27.000”", await cuota.innerText());

  // Aumento programado, que conserva el precio por día, y se anula.
  const en10 = new Date(Date.now() + 10 * 864e5).toISOString().slice(0, 10);
  await cuota.locator('button:has-text("Precios")').click();
  chequear(await cuota.locator('input[aria-label="Precio hasta ese día"]').inputValue() === "27.000", "al abrir trae la lista de hoy (el precio por día no se pierde al aumentar)", "no trae el precio por día");
  await cuota.locator('input[aria-label="Precio general"]').fill("33.000");
  await cuota.locator('input[aria-label="Precio hasta ese día"]').fill("30.000");
  await cuota.locator('input[type="date"]').fill(en10);
  await cuota.locator('button:has-text("Guardar precios")').click();
  await cuota.locator("text=Desde el").waitFor({ timeout: 30000 });
  chequear(/\$33\.000 \(hasta el día 10: \$30\.000\)/.test(await cuota.innerText()), "el aumento programado se ve con su precio por día", await cuota.innerText());
  await cuota.locator('button:has-text("Precios")').click();
  await cuota.locator('button:has-text("Anular ese aumento")').click();
  await d.waitForFunction((n) => !document.querySelector(`li[data-plan="${n}"]`)?.textContent?.includes("Desde el"), `Cuota${s5}`, { timeout: 30000 });
  ok("✕ Anular ese aumento: vuelve a regir solo el de hoy");
  await capturar(d, "pla5-compu-planes");

  // Vender: el pase cuesta $4.500 en efectivo y $5.000 por transferencia.
  await d.goto(`${G}/panel/socios?q=${encodeURIComponent("Testigo Al Día")}`);
  const sid = (await d.locator('main ul a[href^="/panel/socios/"]').first().getAttribute("href")).split("/").pop();
  await d.goto(`${G}/panel/vender?socio=${sid}`);
  const boton = d.locator("main button", { hasText: `Pase${s5}` }).first();
  await boton.waitFor({ timeout: 30000 });
  await d.locator('button[aria-pressed]:has-text("Efectivo")').click();
  await d.waitForFunction((n) => [...document.querySelectorAll("main button")].some((b) => b.textContent.includes(n) && b.textContent.includes("$4.500")), `Pase${s5}`, { timeout: 30000 });
  await d.locator('button[aria-pressed]:has-text("Transferencia")').click();
  await d.waitForFunction((n) => [...document.querySelectorAll("main button")].some((b) => b.textContent.includes(n) && b.textContent.includes("$5.000")), `Pase${s5}`, { timeout: 30000 });
  ok("Vender: el pase sale $4.500 en efectivo y $5.000 por transferencia");
  if (d.errores.length) falla(`dueña: ${d.errores.join(" | ")}`);

  const c = await pagina(b, CELU);
  await entrar(c, "encargado@ejemplo.invalid");
  await c.goto(`${G}/panel/planes`);
  await plan(c, `Cuota${s5}`).locator('button:has-text("Precios")').click();
  const ancho = await c.evaluate(() => document.documentElement.scrollWidth);
  chequear(ancho <= CELU.width, `celular con los precios abiertos, sin desborde (${ancho}px)`, `desborda: ${ancho}`);
  await capturar(c, "pla5-celu-precios");
} catch (e) {
  falla(`se cortó: ${process.env.E2E_DEPURAR ? e.message : e.message.split("\n")[0]}`);
}
await b.close();
resultado();
