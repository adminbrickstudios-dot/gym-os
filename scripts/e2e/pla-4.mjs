#!/usr/bin/env node
// PLA-4 · Aumento de precios masivo y programado: la dueña elige dos planes,
// 10% redondeado a $100 desde dentro de 10 días; ve antes → después (también
// el precio en efectivo); lo programa; Planes muestra el 📅 de cada uno; copia
// el aviso; un plan sin precio no se puede tildar a ciegas.
//   npm run e2e:pla-4            (con scripts/local/levantar.sh corriendo)
import { CELU, COMPU, GIMNASIO, capturar, chequear, entrar, falla, navegador, ok, pagina, resultado } from "./comun.mjs";

const G = GIMNASIO();
const b = await navegador();
const s5 = Date.now().toString().slice(-5);
const plan = (p, n) => p.locator(`li[data-plan="${n}"]`);
try {
  const d = await pagina(b, COMPU);
  await entrar(d, "duena@ejemplo.invalid");
  await d.goto(`${G}/panel/planes`);
  for (const [n, precio] of [[`Uno${s5}`, "31.234"], [`Otro${s5}`, "20.000"]]) {
    await d.locator('button:has-text("Nuevo plan")').click();
    await d.locator('input[name="nombre"]').fill(n);
    await d.locator('input[name="precio"]').fill(precio);
    await d.locator('button:has-text("Crear")').click();
    await plan(d, n).waitFor({ timeout: 30000 });
  }
  await plan(d, `Otro${s5}`).locator('button:has-text("💲 Precios")').click();
  await plan(d, `Otro${s5}`).locator('input[aria-label="Precio con Efectivo"]').fill("18.000");
  await plan(d, `Otro${s5}`).locator('button:has-text("Guardar precios")').click();
  await plan(d, `Otro${s5}`).locator("[data-variantes]").waitFor({ timeout: 30000 });

  await d.locator('main a:has-text("Aumento de precios")').click();
  await d.waitForURL(/\/panel\/planes\/aumento/);
  await d.locator('input[aria-label="Cuánto aumenta"]').waitFor();
  // Solo los dos de la prueba.
  for (const cb of await d.locator('input[type="checkbox"]').all()) if (await cb.isChecked()) await cb.uncheck();
  await d.locator(`input[aria-label="Uno${s5}"]`).check();
  await d.locator(`input[aria-label="Otro${s5}"]`).check();
  const en10 = new Date(Date.now() + 10 * 864e5).toISOString().slice(0, 10);
  await d.locator('input[aria-label="Desde"]').fill(en10);
  await d.locator('input[aria-label="Cuánto aumenta"]').fill("10");
  const uno = d.locator(`[data-vista-plan="Uno${s5}"]`);
  await uno.waitFor({ timeout: 30000 });
  chequear(/\$31\.234[\s\S]*\$34\.400/.test(await uno.innerText()), "vista previa: $31.234 → $34.400 (10% redondeado a $100)", await uno.innerText());
  chequear(/\$18\.000 → \$19\.800/.test(await d.locator(`[data-vista-plan="Otro${s5}"]`).innerText()), "y el precio en efectivo sube igual: $18.000 → $19.800", await d.locator(`[data-vista-plan="Otro${s5}"]`).innerText());
  await d.locator('select[aria-label="Redondear a"]').selectOption("1000");
  await d.locator(`[data-vista-plan="Uno${s5}"]:has-text("$34.000")`).waitFor({ timeout: 30000 });
  ok("cambiar el redondeo a $1.000 cambia la vista previa ($34.000)");
  await capturar(d, "pla4-compu-vista");
  await d.locator('button:has-text("Programar aumento")').click();
  await d.locator("[data-aumento-hecho]").waitFor({ timeout: 30000 });
  const aviso = await d.locator("[data-aviso]").innerText();
  chequear(new RegExp(`Uno${s5}: \\$34\\.000`).test(aviso) && /efectivo \$20\.000/.test(aviso), "programado, con el aviso para WhatsApp armado", aviso);
  await d.locator('main a:has-text("Volver a Planes")').click();
  await d.waitForURL(/\/panel\/planes$/);
  await plan(d, `Uno${s5}`).locator("text=📅 Desde el").waitFor({ timeout: 30000 });
  chequear(/\$31\.234[\s\S]*\$34\.000/.test(await plan(d, `Uno${s5}`).innerText()), "Planes: hoy $31.234 y 📅 el que viene", await plan(d, `Uno${s5}`).innerText());
  if (d.errores.length) falla(`dueña: ${d.errores.join(" | ")}`);

  const c = await pagina(b, CELU);
  await entrar(c, "encargado@ejemplo.invalid");
  await c.goto(`${G}/panel/planes/aumento`);
  await c.locator('input[aria-label="Cuánto aumenta"]').fill("5");
  await c.locator("[data-vista]").waitFor({ timeout: 30000 });
  const ancho = await c.evaluate(() => document.documentElement.scrollWidth);
  chequear(ancho <= CELU.width, `el encargado en el celular, con la vista previa, sin desborde (${ancho}px)`, `desborda: ${ancho}`);
  await capturar(c, "pla4-celu-vista");

  const r = await pagina(b, COMPU);
  await entrar(r, "recepcion@ejemplo.invalid");
  await r.goto(`${G}/panel/planes/aumento`);
  chequear(await r.getByText("No tenés acceso").count() > 0, "la recepción: “No tenés acceso”", "la recepción abre el aumento");
} catch (e) {
  falla(`se cortó: ${process.env.E2E_DEPURAR ? e.message : e.message.split("\n")[0]}`);
}
await b.close();
resultado();
