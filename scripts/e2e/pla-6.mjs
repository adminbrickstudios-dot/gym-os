#!/usr/bin/env node
// PLA-6 · Cambio de plan con días a favor (D6): un socio con la cuota pagada
// cambia de plan desde la ficha; antes de confirmar ve cuántos días pagos le
// quedan y que pasan al plan nuevo sin cobrar nada; después sigue en verde.
//   npm run e2e:pla-6            (con scripts/local/levantar.sh corriendo)
import { COMPU, GIMNASIO, capturar, chequear, entrar, esperarCobro, falla, navegador, ok, pagina, resultado } from "./comun.mjs";
import { elegirPlan, hojaDeAlta, irAVender } from "./alta.mjs";

const G = GIMNASIO();
const b = await navegador();
const s5 = Date.now().toString().slice(-5);
try {
  const d = await pagina(b, COMPU);
  await entrar(d, "duena@ejemplo.invalid");
  await d.goto(`${G}/panel/planes`);
  for (const [n, precio] of [[`Antes${s5}`, "20.000"], [`Despues${s5}`, "26.000"]]) {
    await d.locator('button:has-text("Nuevo plan")').click();
    await d.locator('input[name="nombre"]').fill(n);
    await d.locator('input[name="precio"]').fill(precio);
    await d.locator('button:has-text("Crear")').click();
    await d.locator(`li[data-plan="${n}"]`).waitFor({ timeout: 30000 });
  }
  await d.goto(`${G}/panel/socios/nuevo`);
  await d.locator('input[name="nombre"]').fill(`Cambia${s5}`);
  await elegirPlan(d, `Antes${s5}`);
  await d.locator('button:has-text("Dar de alta y cobrar")').click();
  // VD-5b: "Dar de alta y cobrar" abre la hoja Cobrar sobre el alta; después se sigue en Vender con el socio.
  await irAVender(d, await hojaDeAlta(d));
  const id = new URL(d.url()).searchParams.get("socio");
  await d.getByText(`Cuota Antes${s5}`).first().waitFor({ timeout: 30000 });
  await d.locator('button[aria-pressed]:has-text("Transferencia")').click();
  await d.locator('button:has-text("Cobrar")').click();
  await esperarCobro(d);

  await d.goto(`${G}/panel/socios/${id}`);
  await d.locator('button:has-text("Cambiar plan")').click();
  await d.locator("button", { hasText: `Despues${s5}` }).click();
  const vista = d.locator("[data-cambio-plan]");
  await vista.waitFor({ timeout: 30000 });
  const t = await vista.innerText();
  chequear(/Le quedan \d+ días pagos/.test(t) && /sin cobrar nada/.test(t), "antes de confirmar: “Le quedan N días pagos … pasan al plan nuevo, sin cobrar nada”", t);
  chequear(/\$6\.000 más/.test(t), "y que el nuevo cuesta $6.000 más por mes (la diferencia se cobra en Vender si quiere)", t);
  await capturar(d, "pla6-compu-vista");
  await vista.locator("button", { hasText: `Cambiar a Despues${s5}` }).click();
  await vista.waitFor({ state: "detached", timeout: 30000 });
  await d.getByText(`Despues${s5}`, { exact: true }).first().waitFor({ timeout: 30000 });
  ok("confirmado: la ficha muestra el plan nuevo");
  await d.goto(`${G}/panel/entrada?socio=${id}`);
  await d.locator('[data-veredicto="verde"]').waitFor({ timeout: 30000 });
  ok("y en la Entrada sigue en verde (los días pasaron)");
  if (d.errores.length) falla(`dueña: ${d.errores.join(" | ")}`);
} catch (e) {
  falla(`se cortó: ${process.env.E2E_DEPURAR ? e.message : e.message.split("\n")[0]}`);
}
await b.close();
resultado();
