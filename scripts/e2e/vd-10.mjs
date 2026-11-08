#!/usr/bin/env node
// VD-10 · Control: todo queda escrito, con alertas al dueño.
// El encargado cobra una cuota con un descuento grande y anula una venta; la dueña los ve como alertas en
// la campana y en la línea de tiempo de /panel/control, filtra por tipo (y la pantalla se acuerda del filtro),
// exporta a Excel y en el celular no desborda. La recepción no la ve (error, no lista vacía).
//   node scripts/e2e/vd-10.mjs     (con scripts/local/levantar.sh corriendo)
import { readFileSync } from "node:fs";
import { CELU, COMPU, GIMNASIO, capturar, chequear, entrar, esperarCobro, falla, navegador, ok, pagina, resultado } from "./comun.mjs";
import { elegirPlan } from "./alta.mjs";

const G = GIMNASIO();
const b = await navegador();
const s5 = Date.now().toString().slice(-5);
try {
  // El encargado: alta, cuota con un descuento de $5.000, una toalla que después anula.
  const m = await pagina(b, COMPU);
  await entrar(m, "encargado@ejemplo.invalid");
  await m.goto(`${G}/panel/socios/nuevo`);
  await m.locator('input[name="nombre"]').fill(`Control${s5}`);
  await elegirPlan(m, "Plan Full");
  await m.locator('button:has-text("Solo dar de alta")').click();
  await m.waitForURL(/\/panel\/socios\/[0-9a-f-]{36}$/, { timeout: 30000 });
  const id = m.url().split("/").pop();

  await m.goto(`${G}/panel/vender?socio=${id}&cuota=1`);
  await m.locator("[data-carrito]").getByText(/^Cuota /).first().waitFor({ timeout: 30000 });
  await m.locator('[data-carrito] button:has-text("Descuento")').first().click();
  await m.locator('[data-carrito] input[aria-label="Monto del descuento"]').first().fill("5.000");
  // VD-46C: el motivo del descuento sale de la lista del gimnasio (ya no es texto libre).
  await m.waitForFunction(() => document.querySelectorAll("select[data-motivo-descuento] option").length > 2, null, { timeout: 30000 });
  await m.locator("[data-carrito] select[data-motivo-descuento]").first().selectOption({ index: 1 });
  await m.locator('button[aria-pressed]:has-text("Transferencia")').click();
  await m.locator('button:has-text("✅ Cobrar")').click();
  await esperarCobro(m);
  ok("el encargado cobra la cuota con $5.000 de descuento");

  await m.goto(`${G}/panel/vender?socio=${id}`);
  await m.locator('button:has-text("Otra cosa")').click();
  await m.locator('input[placeholder^="Qué es"]').fill(`Toalla${s5}`);
  await m.locator('input[placeholder="Precio"]').fill("1.500");
  await m.locator('form:has(input[placeholder^="Qué es"]) button:has-text("Agregar")').click();
  await m.locator("[data-carrito]", { hasText: `Toalla${s5}` }).waitFor({ timeout: 30000 });
  await m.locator('button[aria-pressed]:has-text("Transferencia")').click();
  await m.locator('button:has-text("✅ Cobrar")').click();
  await esperarCobro(m);
  await m.goto(`${G}/panel/socios/${id}?pestana=pagos`);
  const venta = m.locator("[data-ventas] li").first();
  await venta.waitFor({ timeout: 30000 });
  await venta.locator('button:has-text("Anular")').click();
  await venta.locator('input[aria-label="Motivo de la anulación"]').fill(`Se equivocó ${s5}`);
  await venta.locator('button:has-text("Anular venta")').click();
  await m.locator('[data-ventas] li[data-estado="anulada"]').waitFor({ timeout: 30000 });
  ok("y anula la toalla");

  // La dueña: las dos alertas en la campana.
  const d = await pagina(b, COMPU);
  await entrar(d, "duena@ejemplo.invalid");
  await d.goto(`${G}/panel/campana`);
  await d.locator("main h1").waitFor();
  const anul = d.locator("[data-novedad]", { hasText: "Se anuló una venta de $1.500" });
  const desc = d.locator("[data-novedad]", { hasText: "Descuento de $5.000" });
  await anul.first().waitFor({ timeout: 30000 });
  chequear(await anul.count() > 0 && await desc.count() > 0, "campana de la dueña: “Se anuló una venta de $1.500” y “Descuento de $5.000”", `anulación ${await anul.count()}, descuento ${await desc.count()}`);
  await capturar(d, "vd10-compu-campana");

  // La línea de tiempo.
  await d.goto(`${G}/panel/control`);
  await d.locator("[data-filtros-control]").waitFor({ timeout: 60000 });
  const filaAnul = d.locator('[data-control-item="anulacion"]', { hasText: "Martín" });
  const filaDesc = d.locator('[data-control-item="descuento"]', { hasText: "Martín" });
  await filaAnul.first().waitFor({ timeout: 30000 });
  chequear(await filaDesc.count() > 0 && /Se equivocó/.test(await filaAnul.first().innerText()), "Control: la anulación (con motivo) y el descuento, con quién", await d.locator("[data-linea-control]").innerText());
  chequear(await d.locator('[data-control-item="cobro"]').count() > 0, "y los cobros", "no hay cobros");
  await capturar(d, "vd10-compu-control");

  // Filtro por tipo, y la pantalla se acuerda.
  await d.locator('label:has(input[data-tipo-filtro="anulacion"])').click();
  await d.locator('button:has-text("Filtrar")').click();
  await d.waitForURL(/tipos=anulacion/, { timeout: 30000 });
  await d.locator('[data-control-item="anulacion"]').first().waitFor({ timeout: 30000 });
  chequear(await d.locator('[data-control-item]:not([data-control-item="anulacion"])').count() === 0, "filtro por tipo: solo anulaciones", "se coló otro tipo");
  await d.goto(`${G}/panel/control`);
  await d.waitForURL(/tipos=anulacion/, { timeout: 30000 });
  ok("al volver, la pantalla se acuerda del filtro");
  await d.locator('button:has-text("Limpiar filtros")').click();
  await d.waitForURL((u) => !u.search, { timeout: 30000 });

  // Exportar.
  const [descarga] = await Promise.all([d.waitForEvent("download", { timeout: 60000 }), d.locator("[data-exportar-control]").click()]);
  const csv = readFileSync(await descarga.path(), "utf8");
  chequear(/Anulaciones/.test(csv) && /Martín/.test(csv) && /Descuentos/.test(csv), `exportar a Excel: ${descarga.suggestedFilename()} con anulaciones y descuentos`, csv.slice(0, 200));

  // Celular.
  const c = await pagina(b, CELU);
  await entrar(c, "duena@ejemplo.invalid");
  await c.goto(`${G}/panel/control`);
  await c.locator("[data-filtros-control]").waitFor({ timeout: 60000 });
  await c.locator("[data-control-item]").first().waitFor({ timeout: 30000 });
  const ancho = await c.evaluate(() => document.documentElement.scrollWidth);
  chequear(ancho <= CELU.width, `celular 390: sin desborde (${ancho}px)`, `desborda ${ancho}`);
  await capturar(c, "vd10-celu-control");

  // La recepción no lo ve: error, no una lista vacía.
  const r = await pagina(b, COMPU);
  await entrar(r, "recepcion@ejemplo.invalid");
  await r.goto(`${G}/panel/control`);
  await r.getByText(/no tiene acceso|Sin permiso|No tenés acceso/).first().waitFor({ timeout: 60000 });
  chequear(await r.locator("[data-linea-control]").count() === 0, "la recepción: “no tiene acceso” (no una lista vacía)", "la recepción ve la línea");
  const exportar = await r.goto(`${G}/panel/control/exportar`);
  chequear(exportar?.status() === 403, "y no puede exportar (403)", `estado ${exportar?.status()}`);

  for (const p of [m, d, c, r]) if (p.errores.length) falla(p.errores.join(" | "));
} catch (e) {
  falla(`se cortó: ${process.env.E2E_DEPURAR ? e.message : e.message.split("\n")[0]}`);
}
await b.close();
resultado();
