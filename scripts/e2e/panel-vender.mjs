#!/usr/bin/env node
// AUD-6 · Vender, Caja y Transferencias botón por botón (recepción y dueña,
// compu y celular). Montos escritos como se escriben en Argentina; caja con
// arqueo ciego para la recepción; tope de descuento; pago con dos medios.
//   npm run e2e:vender            (con scripts/local/levantar.sh corriendo)
import { CELU, COMPU, GIMNASIO, capturar, chequear, entrar, esperarCobro, falla, navegador, ok, pagina, resultado } from "./comun.mjs";

const G = GIMNASIO();
const b = await navegador();
const carrito = (p) => p.locator("[data-carrito]");
try {
  const r = await pagina(b, COMPU);
  await entrar(r, "recepcion@ejemplo.invalid");

  // ── Caja: si quedó abierta de otra prueba, se cierra primero.
  await r.goto(`${G}/panel/caja`);
  await r.locator("main h1").waitFor();
  if (await r.locator('button:has-text("Cerrar caja")').count()) {
    await r.locator('button:has-text("Cerrar caja")').first().click();
    await r.locator('input[placeholder="$ contado"]').fill("0");
    await r.locator('button:has-text("Cerrar con este monto")').click();
    await r.locator('button:has-text("Listo")').click();
  }
  // Sin caja abierta, Vender no arranca en efectivo.
  await r.goto(`${G}/panel/vender`);
  await r.locator('button[aria-pressed="true"]').first().waitFor({ timeout: 30000 });
  chequear(!/Efectivo/.test(await r.locator('button[aria-pressed="true"]').first().innerText()), "sin caja abierta, Vender no arranca en efectivo", "arranca en efectivo");
  await r.locator("main button", { hasText: "Agua 500 ml" }).click();
  await r.locator('button[aria-pressed]:has-text("Efectivo")').click();
  chequear(await carrito(r).getByText(/abrí tu turno|necesitás tu turno/).first().waitFor({ timeout: 20000 }).then(() => true, () => false), "elegir efectivo sin caja: “Para cobrar en efectivo abrí tu turno”", "no avisa");

  await r.goto(`${G}/panel/caja`);
  await r.locator('input[placeholder="$ 0"]').first().fill("1.000");
  await r.locator('button:has-text("Abrir caja")').first().click();
  await r.locator('button:has-text("Entra plata")').waitFor({ timeout: 30000 });
  chequear(await r.getByText("Tiene que haber").count() === 0, "caja abierta: la recepción no ve cuánto tiene que haber (arqueo ciego)", "la recepción ve lo esperado");
  await r.locator('button:has-text("Entra plata")').click();
  await r.locator('input[placeholder="$"]').fill("500,50");
  await r.locator('input[placeholder^="Motivo"]').fill("Cambio");
  await r.locator('button:has-text("Anotar")').click();
  await r.locator('button:has-text("Sale plata")').first().waitFor({ timeout: 30000 });
  await r.locator('button:has-text("Sale plata")').first().click();
  await r.locator('input[placeholder="$"]').fill("200");
  await r.locator('input[placeholder^="Motivo"]').fill("Artículos de limpieza");
  await r.locator('button:has-text("Anotar")').click();
  await r.locator('button:has-text("Entra plata")').waitFor({ timeout: 30000 });
  ok("abrir con $1.000, entra $500,50 y sale $200");

  // ── Vender en efectivo dos aguas.
  await r.goto(`${G}/panel/vender`);
  await r.locator("main button", { hasText: "Agua 500 ml" }).click();
  await carrito(r).locator('button[aria-label="Uno más"]').click();
  await r.locator('button[aria-pressed]:has-text("Efectivo")').click();
  chequear(/\$3\.000/.test(await carrito(r).innerText()), "dos aguas: $3.000", await carrito(r).innerText());
  // Descuento más alto que el tope de la recepción (10%): lo frena la base.
  await carrito(r).locator('button:has-text("Descuento")').click();
  await carrito(r).locator('input[aria-label="Monto del descuento"]').fill("1.000");
  // VD-46C: el motivo del descuento sale de la lista del gimnasio.
  await r.waitForFunction(() => document.querySelectorAll("select[data-motivo-descuento] option").length > 2, null, { timeout: 30000 });
  await carrito(r).locator("select[data-motivo-descuento]").first().selectOption({ index: 1 });
  await r.locator('button:has-text("Cobrar")').click();
  await carrito(r).locator('[role="alert"]:has-text("descuento máximo")').waitFor({ timeout: 30000 });
  ok("descuento de $1.000 sobre $3.000: “Tu descuento máximo es 10 %”");
  await carrito(r).locator('input[aria-label="Monto del descuento"]').fill("300");
  await r.locator('button:has-text("Cobrar")').click();
  await carrito(r).locator('[role="alert"]').waitFor({ state: "detached", timeout: 30000 });
  await esperarCobro(r);
  chequear(await r.getByText("Cobrado $2.700").count() > 0, "con $300 de descuento (10%) cobra $2.700", "no cobró $2.700");

  // ── Dos medios: avisa lo que falta.
  await r.locator('button:has-text("Nueva venta")').click();
  await r.locator("main button", { hasText: "Candado para locker" }).click();
  await r.locator('button:has-text("Paga con dos medios")').click();
  const montos = carrito(r).locator('input[placeholder="$"]');
  await montos.nth(0).fill("4.000");
  chequear(await carrito(r).getByText("Faltan $2.500").count() > 0, "dos medios: “Faltan $2.500”", await carrito(r).innerText());
  await r.locator('button:has-text("Un solo medio")').click();

  // ── Cierre ciego: 1.000 + 500,50 − 200 + 2.700 = 4.000,50
  await r.goto(`${G}/panel/caja`);
  await r.locator('button:has-text("Cerrar caja")').click();
  await r.locator('input[placeholder="$ contado"]').fill("4.000,50");
  await r.locator('button:has-text("Cerrar con este monto")').click();
  await r.getByText("Caja justa").waitFor({ timeout: 30000 });
  chequear(/\$4\.000,50/.test(await r.locator("main").innerText()), "cierre: contó $4.000,50 y tenía que haber $4.000,50 → “Caja justa”", await r.locator("main").innerText());
  await capturar(r, "aud6-compu-cierre");
  await r.locator('button:has-text("Listo")').click();
  if (r.errores.length) falla(`recepción: ${r.errores.join(" | ")}`);

  // ── Dueña: ve lo esperado con la caja abierta; Transferencias abre.
  const d = await pagina(b, CELU);
  await entrar(d, "duena@ejemplo.invalid");
  await d.goto(`${G}/panel/caja`);
  await d.locator('input[placeholder="$ 0"]').first().fill("0");
  await d.locator('button:has-text("Abrir caja")').first().click();
  await d.getByText("Tiene que haber").waitFor({ timeout: 30000 });
  ok("la dueña sí ve “Tiene que haber” con la caja abierta");
  await d.locator('button:has-text("Cerrar caja")').click();
  await d.locator('input[placeholder="$ contado"]').fill("0");
  await d.locator('button:has-text("Cerrar con este monto")').click();
  await d.getByText("Caja justa").waitFor({ timeout: 30000 });
  await d.goto(`${G}/panel/transferencias`);
  await d.locator("main h1").waitFor();
  const t = await d.locator("main").innerText();
  chequear(/Nada para revisar|Aprobar/.test(t), "Transferencias: la lista o “Nada para revisar”", t.slice(0, 200));
  const ancho = await d.evaluate(() => document.documentElement.scrollWidth);
  chequear(ancho <= CELU.width, `celular sin desborde (${ancho}px)`, `desborda: ${ancho}`);
} catch (e) {
  falla(`se cortó: ${process.env.E2E_DEPURAR ? e.message : e.message.split("\n")[0]}`);
}
await b.close();
resultado();
