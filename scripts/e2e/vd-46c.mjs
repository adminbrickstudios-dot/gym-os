#!/usr/bin/env node
// VD-46C · Cortesías y descuentos con motivo de una lista y tope bajo.
// La recepción da 1 día con motivo de la lista; el motivo del descuento en Vender es una lista, no texto libre;
// la dueña ve el total del mes y los topes en Control; el celular no se desborda.
//   node scripts/e2e/vd-46c.mjs     (con scripts/local/levantar.sh corriendo)
import { CELU, COMPU, GIMNASIO, capturar, chequear, entrar, navegador, ok, pagina, resultado } from "./comun.mjs";
import { elegirPlan } from "./alta.mjs";

const G = GIMNASIO();
const b = await navegador();
const s5 = Date.now().toString().slice(-5);
try {
  const d = await pagina(b, COMPU);
  await entrar(d, "duena@ejemplo.invalid");
  await d.goto(`${G}/panel/socios/nuevo`);
  await d.locator('input[name="nombre"]').fill(`Corte${s5}`);
  await elegirPlan(d, 0);
  await d.locator('button:has-text("Solo dar de alta")').click();
  await d.waitForURL(/\/panel\/socios\/[0-9a-f-]{36}/, { timeout: 30000 });
  const id = new URL(d.url()).pathname.split("/").pop();
  ok(`socio con plan creado (${id.slice(0, 8)})`);

  // La recepción: un día por cortesía, con motivo de la lista.
  const r = await pagina(b, COMPU);
  await entrar(r, "recepcion@ejemplo.invalid");
  await r.goto(`${G}/panel/socios/${id}`);
  await r.locator("[data-cortesia-abrir]").click();
  const opciones = await r.locator('select[aria-label="Días de cortesía"] option').count();
  chequear(opciones === 1, "la recepción solo puede dar 1 día (tope bajo)", `ve ${opciones} opciones de días`);
  const boton = r.locator('button:has-text("🎁 Dar la cortesía")');
  chequear(await boton.isDisabled(), "sin motivo no se puede dar", "se puede dar sin motivo");
  await r.locator('select[aria-label="Motivo de la cortesía"]').selectOption({ index: 1 });
  await boton.click();
  await r.locator('[data-cortesia="vigente"]').first().waitFor({ timeout: 30000 });
  ok("la recepción dio 1 día de cortesía con motivo");
  chequear((await r.locator("[data-anular-cortesia], [data-cortesia] button:has-text('Anular')").count()) === 0, "la recepción no ve “Anular”", "la recepción ve “Anular”");

  // Vender: el motivo del descuento es una lista.
  await d.goto(`${G}/panel/vender?socio=${id}&cuota=1`);
  await d.getByText(/^Cuota /).first().waitFor({ timeout: 30000 });
  await d.locator('button:has-text("🏷️ Descuento")').first().click();
  const sel = d.locator("select[data-motivo-descuento]");
  await sel.waitFor({ timeout: 30000 });
  await d.waitForFunction(() => document.querySelectorAll("select[data-motivo-descuento] option").length > 2, null, { timeout: 30000 });
  ok(`el motivo del descuento es una lista de ${(await sel.locator("option").count()) - 1} motivos`);
  chequear((await d.locator('input[aria-label="Motivo del descuento"]').count()) === 0, "ya no hay texto libre para el motivo", "sigue habiendo un campo de texto");

  // Control: total del mes, la cortesía y los topes.
  await d.goto(`${G}/panel/control`);
  await d.locator("[data-beneficios]").waitFor({ timeout: 30000 });
  await d.locator('[data-moderacion-item="cortesia"]').first().waitFor({ timeout: 30000 });
  ok("Control muestra la cortesía y el total del mes");
  await d.locator("[data-topes] summary").click();
  await d.getByText("Motivos de cortesías y descuentos").waitFor();
  await d.getByRole("button", { name: "Guardar topes" }).waitFor();
  ok("la dueña ve y puede cambiar los topes y los motivos");

  const m = await pagina(b, CELU);
  await entrar(m, "duena@ejemplo.invalid");
  await m.goto(`${G}/panel/control`);
  await m.locator("[data-beneficios]").waitFor({ timeout: 30000 });
  await m.locator("[data-topes] summary").click();
  const ancho = await m.evaluate(() => document.documentElement.scrollWidth);
  chequear(ancho <= 391, "celular 390 px sin desborde", `desborda: ${ancho}px`);
  await capturar(m, "vd46c-celu-control", true);
  for (const p of [d, r, m]) chequear(p.errores.length === 0, "sin errores de página", p.errores.join(" | "));
} finally {
  await b.close();
}
resultado();
