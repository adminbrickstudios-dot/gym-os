#!/usr/bin/env node
// VEN-3 · Convenios: la dueña crea "Estudiantes" (20%), se lo asigna a un
// socio desde la ficha y Vender lo muestra como línea aparte; se cobra el total
// con el descuento (la base lo calcula igual). Al final lo desactiva.
//   npm run e2e:ven-3            (con scripts/local/levantar.sh corriendo)
import { COMPU, GIMNASIO, capturar, chequear, entrar, esperarCobro, falla, navegador, ok, pagina, resultado } from "./comun.mjs";
import { elegirPlan } from "./alta.mjs";

const G = GIMNASIO();
const b = await navegador();
const s5 = Date.now().toString().slice(-5);
const d = await pagina(b, COMPU);
const nombre = `Estudiantes${s5}`;
try {
  await entrar(d, "duena@ejemplo.invalid");
  await d.goto(`${G}/panel/planes`);
  await d.locator('[data-convenios] button:has-text("Nuevo convenio")').click();
  await d.locator('input[aria-label="Nombre del convenio"]').fill(nombre);
  await d.locator('input[aria-label="Cuánto descuenta"]').fill("20");
  await d.locator('[data-convenios] button:has-text("Guardar")').click();
  await d.locator(`li[data-convenio="${nombre}"]`).waitFor({ timeout: 30000 });
  ok("Planes → 🤝 Convenios: “Estudiantes” −20 %");

  await d.goto(`${G}/panel/socios/nuevo`);
  await d.locator('input[name="nombre"]').fill(`Estu${s5}`);
  await elegirPlan(d, "Plan Full");
  await d.locator('button:has-text("Solo dar de alta")').click();
  await d.waitForURL(/\/panel\/socios\/[0-9a-f-]{36}$/, { timeout: 30000 });
  const id = d.url().split("/").pop();
  await d.locator('button:has-text("Asignar convenio")').click();
  await d.locator('select[aria-label="Convenio"]').selectOption({ label: `${nombre} (−20 %)` });
  await d.locator('[data-convenio-socio] button:has-text("Guardar")').click();
  await d.locator(`[data-convenio-socio="${nombre}"]`).waitFor({ timeout: 30000 });
  ok("ficha: asignado");

  await d.goto(`${G}/panel/vender?socio=${id}&cuota=1`);
  const linea = d.locator("[data-carrito] [data-convenio]");
  await linea.waitFor({ timeout: 30000 });
  await d.locator('button[aria-pressed]:has-text("Transferencia")').click();
  chequear(/Convenio .*−\$5\.000/.test((await linea.innerText()).replace(/\n/g, " ")) && /\$20\.000/.test(await d.locator("[data-carrito]").innerText()),
    "Vender: “🤝 Convenio … −$5.000” como línea aparte y total $20.000 (cuota $25.000)", await d.locator("[data-carrito]").innerText());
  await capturar(d, "ven3-compu-carrito");
  await d.locator('button:has-text("✅ Cobrar")').click();
  await esperarCobro(d);
  chequear(await d.getByText("Cobrado $20.000").count() > 0, "la base cobra lo mismo: “Cobrado $20.000”", "no cobró $20.000");
  if (d.errores.length) falla(`dueña: ${d.errores.join(" | ")}`);
} catch (e) {
  falla(`se cortó: ${process.env.E2E_DEPURAR ? e.message : e.message.split("\n")[0]}`);
} finally {
  try {
    await d.goto(`${G}/panel/planes`);
    await d.locator(`li[data-convenio="${nombre}"] button:has-text("Desactivar")`).click();
    await d.locator(`li[data-convenio="${nombre}"] button:has-text("Activar")`).waitFor({ timeout: 30000 });
  } catch { falla("no pude desactivar el convenio al final"); }
}
await b.close();
resultado();
