#!/usr/bin/env node
// VD-41 · Gastos y presupuesto: la dueña carga un gasto con foto del comprobante y un
// gasto fijo, la ganancia del mes baja lo mismo (y es la misma en Resultado), un
// presupuesto muestra el desvío, todo se deshace; en el celular (390 px) no hay
// desborde; el encargado y la recepción no ven los gastos (error, no una lista vacía).
//   node scripts/e2e/vd-41.mjs     (con scripts/local/levantar.sh corriendo)
import { CELU, COMPU, GIMNASIO, chequear, entrar, falla, navegador, pagina, resultado } from "./comun.mjs";

const G = GIMNASIO();
const pesos = (t) => Number(t.replace(/[^\d,−-]/g, "").replace(",", ".").replace("−", "-"));
// Un PNG de 1x1: alcanza para probar la subida del comprobante.
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
const b = await navegador();
try {
  const d = await pagina(b, COMPU);
  await entrar(d, "duena@ejemplo.invalid");
  await d.goto(`${G}/panel/gastos`);
  const gan = d.locator("[data-ganancia-gastos]");
  await gan.waitFor({ timeout: 60000 });
  const leer = async () => { const t = await gan.innerText(); return (/pérdida/.test(t) ? -1 : 1) * Math.abs(pesos(t.split(" de ")[0])); };
  const esperarCambio = async (previo) => { let v = await leer(); for (let i = 0; i < 40 && Math.abs(v - previo) < 0.001; i++) { await d.waitForTimeout(500); v = await leer(); } return v; };
  const inicial = await leer();

  // Un gasto con foto del comprobante.
  const detalle = `Luz e2e ${Date.now() % 100000}`;
  const formulario = d.locator("[data-cargar-gasto]");
  await formulario.locator('select[name="categoria"]').selectOption("servicios");
  await formulario.locator('input[name="detalle"]').fill(detalle);
  await formulario.locator('input[name="monto"]').fill("1.234,50");
  await formulario.locator('input[name="comprobante"]').setInputFiles({ name: "luz.png", mimeType: "image/png", buffer: PNG });
  await formulario.locator('button[type="submit"]').click();
  const fila = d.locator("[data-gasto]", { hasText: detalle });
  await fila.waitFor({ timeout: 30000 });
  const tras = await esperarCambio(inicial);
  chequear(Math.abs((inicial - tras) - 1234.5) < 0.01, `gasto “${detalle}” de $1.234,50: la ganancia baja lo mismo`, `${inicial} → ${tras}`);
  chequear(await fila.getByRole("button", { name: /Ver el comprobante/ }).count() === 1, "el gasto muestra su comprobante", "no se subió el comprobante");

  // Un gasto fijo: cuenta en el mes y se repite en los siguientes (lo prueba la base).
  const fijo = d.locator("[data-nuevo-fijo]");
  await fijo.locator("select").selectOption("alquiler");
  await fijo.getByLabel("Detalle (opcional)").fill("Alquiler e2e");
  await fijo.getByLabel("Monto por mes").fill("10.000");
  await fijo.locator('button[type="submit"]').click();
  const filaFijo = d.locator("[data-fijo]", { hasText: "Alquiler e2e" });
  await filaFijo.waitFor({ timeout: 30000 });
  const conFijo = await esperarCambio(tras);
  chequear(Math.abs((tras - conFijo) - 10000) < 0.01, "el gasto fijo baja la ganancia del mes", `${tras} → ${conFijo}`);

  // Presupuesto de servicios: 1.000, ya gastó 1.234,50 → se pasó.
  const cat = d.locator('[data-presupuesto] [data-categoria="servicios"]');
  await cat.getByLabel(/Presupuesto mensual de/).fill("1.000");
  await cat.getByRole("button", { name: "Guardar" }).click();
  await cat.getByText(/de más/).waitFor({ timeout: 30000 });
  ok1("el presupuesto muestra cuánto se pasó");

  // Resultado muestra la misma ganancia.
  await d.goto(`${G}/panel/resultado`);
  const gr = d.locator("[data-gastos] [data-ganancia]");
  await gr.waitFor({ timeout: 60000 });
  const txt = await gr.innerText();
  const enResultado = (/pérdida/.test(txt) ? -1 : 1) * Math.abs(pesos(txt.split(" de ")[0]));
  chequear(Math.abs(enResultado - conFijo) < 0.01, "Resultado muestra la misma ganancia (ingresos − gastos)", `${enResultado} vs ${conFijo}`);
  chequear(await d.locator("[data-gastos] [data-desvio]").count() === 1, "Resultado muestra el desvío contra el presupuesto", "sin desvío en Resultado");

  // CSV del contador.
  await d.goto(`${G}/panel/gastos`);
  const csv = await d.evaluate(async () => (await fetch("/panel/gastos/exportar?mes=" + new Date().toISOString().slice(0, 7))).text());
  chequear(csv.includes("Alquiler e2e") && csv.includes("Fijo"), "el CSV del contador trae los gastos y los fijos", "el CSV no trae lo cargado");

  // Se deshace todo: la ganancia vuelve a la de antes.
  const g2 = d.locator("[data-gasto]", { hasText: detalle });
  await g2.getByRole("button", { name: /Quitar/ }).click();
  await g2.waitFor({ state: "detached", timeout: 30000 });
  await d.locator("[data-fijo]", { hasText: "Alquiler e2e" }).getByRole("button", { name: /Dejar de repetir/ }).click();
  await d.locator("[data-fijo]", { hasText: "Alquiler e2e" }).waitFor({ state: "detached", timeout: 30000 });
  const c2 = d.locator('[data-presupuesto] [data-categoria="servicios"]');
  await c2.getByLabel(/Presupuesto mensual de/).fill("");
  await c2.getByRole("button", { name: "Guardar" }).click();
  let vuelta = await leer();
  for (let i = 0; i < 40 && Math.abs(vuelta - inicial) >= 0.01; i++) { await d.waitForTimeout(500); vuelta = await leer(); }
  chequear(Math.abs(vuelta - inicial) < 0.01, "quitar el gasto y dejar de repetir el fijo devuelve la ganancia de antes", `${inicial} → ${vuelta}`);
  if (d.errores.length) falla(`dueña: ${d.errores.join(" | ")}`);

  // Celular: sin desborde.
  const c = await pagina(b, CELU);
  await entrar(c, "duena@ejemplo.invalid");
  await c.goto(`${G}/panel/gastos`);
  await c.locator("[data-ganancia-gastos]").waitFor({ timeout: 60000 });
  const ancho = await c.evaluate(() => document.documentElement.scrollWidth);
  chequear(ancho <= 391, "en el celular (390 px) Gastos no se desborda", `ancho ${ancho}`);
  if (c.errores.length) falla(`celular: ${c.errores.join(" | ")}`);

  // El encargado (sin el permiso) y la recepción: error, no una lista vacía.
  for (const [mail, quien] of [["encargado@ejemplo.invalid", "el encargado sin permiso"], ["recepcion@ejemplo.invalid", "la recepción"]]) {
    const e = await pagina(b, CELU);
    await entrar(e, mail);
    await e.goto(`${G}/panel/gastos`);
    await e.getByText(/acceso|permiso/i).first().waitFor({ timeout: 30000 }).catch(() => {});
    const ve = await e.locator("[data-ganancia-gastos], [data-lista-gastos]").count();
    const dice = await e.getByText(/acceso|permiso/i).count();
    chequear(ve === 0 && dice > 0, `${quien} no ve los gastos y la pantalla lo dice`, `${quien}: datos ${ve}, aviso ${dice}`);
  }
} catch (e) {
  falla(`se cortó: ${process.env.E2E_DEPURAR ? e.message : e.message.split("\n")[0]}`);
}
await b.close();
resultado();

function ok1(m) { chequear(true, m, m); }
