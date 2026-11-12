#!/usr/bin/env node
// Z-resto · Vuelto en efectivo en la hoja Cobrar: apagado por defecto (la hoja no cambia); la dueña lo prende en
// Configuración → Cobros; prendido, "Paga con" calcula el vuelto sin cambiar el total; se vuelve a apagar (deja todo como estaba).
//   node scripts/e2e/vuelto-cobrar.mjs     (con scripts/local/levantar.sh corriendo; solo el gimnasio demo)
import { COMPU, GIMNASIO, aparece, chequear, entrar, falla, navegador, ok, pagina, resultado } from "./comun.mjs";
import { elegirPlan } from "./alta.mjs";

const G = GIMNASIO();
const b = await navegador();
const s5 = Date.now().toString().slice(-5);
const hoja = (p) => p.locator("[data-cobrar]");
let d = null;

async function interruptor(p, prendido) {
  await p.goto(`${G}/panel/configuracion?pestana=cobros`);
  const sw = p.locator("[data-vuelto-interruptor]");
  await sw.waitFor({ timeout: 30000 });
  if ((await sw.isChecked()) !== prendido) {
    await sw.click({ force: true });
    await p.locator("[data-vuelto-config]").getByText("Guardado.").waitFor({ timeout: 30000 });
  }
  await p.reload();
  await p.locator("[data-vuelto-interruptor]").waitFor({ timeout: 30000 });
  chequear((await p.locator("[data-vuelto-interruptor]").isChecked()) === prendido, `el interruptor quedó ${prendido ? "prendido" : "apagado"} al volver a abrir`, "el interruptor no quedó guardado");
}
async function abrirCobrar(p, id) {
  await p.goto(`${G}/panel/socios/${id}`);
  await p.locator('main a:has-text("Cobrar")').first().click();
  await hoja(p).locator("[data-cobrar-confirmar]").waitFor({ timeout: 30000 });
}

try {
  d = await pagina(b, COMPU);
  await entrar(d, "duena@ejemplo.invalid");
  await d.goto(`${G}/panel/socios/nuevo`);
  await d.locator('input[name="nombre"]').fill(`Vuelto${s5}`);
  await elegirPlan(d, 0);
  await d.locator('button:has-text("Solo dar de alta")').click();
  await d.waitForURL(/\/panel\/socios\/[0-9a-f-]{36}$/, { timeout: 30000 });
  const id = new URL(d.url()).pathname.split("/").pop();

  await interruptor(d, false);   // parte de apagado (y lo deja así si ya lo estaba)
  await abrirCobrar(d, id);
  await d.locator('[data-cobrar-medio="efectivo"]').click();
  chequear(await d.locator("[data-cobrar-vuelto]").count() === 0, "apagado: la hoja Cobrar en efectivo no muestra nada de vuelto", "con el vuelto apagado la hoja lo muestra");
  await d.keyboard.press("Escape");

  await interruptor(d, true);
  await abrirCobrar(d, id);
  chequear(await d.locator("[data-cobrar-vuelto]").count() === 0, "con otro medio elegido no aparece el vuelto", "aparece el vuelto sin efectivo");
  await d.locator('[data-cobrar-medio="efectivo"]').click();
  // El total depende del medio (descuento o recargo por efectivo): se lee ya con efectivo elegido.
  const total = Number(await d.locator("[data-cobrar-total]").getAttribute("data-cobrar-total"));
  chequear(total > 0, `la hoja trae un total en efectivo (${total})`, "total vacío");
  chequear(await aparece(d.locator("[data-cobrar-vuelto]"), 10000), "prendido y en efectivo: aparece “Paga con”", "no aparece el vuelto");
  await d.locator("[data-cobrar-paga-con]").fill(String(total + 500));
  chequear(await aparece(d.locator("[data-cobrar-vuelto-monto]"), 10000) && /Vuelto/.test(await d.locator("[data-cobrar-vuelto-monto]").innerText()), "paga con $500 de más: muestra el vuelto", "no calcula el vuelto");
  await d.locator("[data-cobrar-paga-con]").fill(String(Math.max(total - 100, 0)));
  chequear(await aparece(d.locator("[data-cobrar-falta]"), 10000), "paga con menos: avisa cuánto falta", "no avisa lo que falta");
  chequear(Number(await d.locator("[data-cobrar-total]").getAttribute("data-cobrar-total")) === total, "el total de la hoja no cambió", "el total cambió con el vuelto");
  await d.keyboard.press("Escape");
  await interruptor(d, false);   // lo deja apagado
  ok("vuelto: apagado por defecto, prendido calcula, el total no cambia");
  if (d.errores.length) falla(`errores en la página: ${d.errores.join(" | ")}`);
} catch (e) {
  falla(`se cortó: ${process.env.E2E_DEPURAR ? e.message : e.message.split("\n")[0]}`);
  if (d) await interruptor(d, false).catch(() => {});
}
await b.close();
resultado();
