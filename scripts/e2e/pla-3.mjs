#!/usr/bin/env node
// PLA-3 · Matrícula: la dueña crea un plan con matrícula; "Dar de alta y
// cobrar" lleva a Vender con la cuota y la matrícula; se cobra; la próxima
// vez Vender ya no la ofrece.
//   npm run e2e:pla-3            (con scripts/local/levantar.sh corriendo)
import { COMPU, GIMNASIO, capturar, chequear, entrar, esperarCobro, falla, navegador, ok, pagina, resultado } from "./comun.mjs";
import { elegirPlan, hojaDeAlta, irAVender } from "./alta.mjs";

const G = GIMNASIO();
const b = await navegador();
const s5 = Date.now().toString().slice(-5);
try {
  const d = await pagina(b, COMPU);
  await entrar(d, "duena@ejemplo.invalid");
  await d.goto(`${G}/panel/planes`);
  await d.locator('button:has-text("Nuevo plan")').click();
  await d.locator('input[name="nombre"]').fill(`Mat${s5}`);
  await d.locator('input[name="precio"]').fill("20.000");
  await d.locator('input[name="matricula"]').fill("8.000");
  await d.locator('button:has-text("Crear")').click();
  const fila = d.locator(`li[data-plan="Mat${s5}"]`);
  await fila.waitFor({ timeout: 30000 });
  chequear(/matrícula \$8\.000 al entrar/.test(await fila.innerText()), "la lista: “matrícula $8.000 al entrar”", await fila.innerText());

  await d.goto(`${G}/panel/socios/nuevo`);
  await d.locator('input[name="nombre"]').fill(`Inscripto${s5}`);
  await elegirPlan(d, `Mat${s5}`);
  chequear(/28\.000/.test(await d.locator("[data-primer-pago]").innerText()), "el alta muestra el primer pago: cuota + matrícula = $28.000", await d.locator("[data-primer-pago]").innerText());
  await d.locator('button:has-text("Dar de alta y cobrar")').click();
  // VD-5b: "Dar de alta y cobrar" abre la hoja Cobrar sobre el alta; después se sigue en Vender con el socio.
  await irAVender(d, await hojaDeAlta(d));
  await d.getByText(`Matrícula Mat${s5}`).first().waitFor({ timeout: 30000 });
  ok("Dar de alta y cobrar: la cuota y la matrícula ya en el carrito");
  chequear(/\$28\.000/.test(await d.locator("[data-carrito]").innerText()), "total $28.000 (20.000 + 8.000)", await d.locator("[data-carrito]").innerText());
  await capturar(d, "pla3-compu-carrito");
  const id = new URL(d.url()).searchParams.get("socio");
  await d.locator('button[aria-pressed]:has-text("Transferencia")').click();
  await d.locator('button:has-text("✅ Cobrar")').click();
  await esperarCobro(d);
  ok("cobrada");
  await d.goto(`${G}/panel/vender?socio=${id}`);
  await d.getByText(`Cuota Mat${s5}`).first().waitFor({ timeout: 30000 });
  chequear(await d.getByText(`Matrícula Mat${s5}`).count() === 0, "la próxima vez Vender ya no ofrece la matrícula", "la sigue ofreciendo");

  // Editar: sacarla.
  await d.goto(`${G}/panel/planes`);
  await fila.locator('button:has-text("Editar")').click();
  await fila.locator('input[aria-label="Matrícula"]').fill("");
  await fila.locator('button:has-text("Guardar")').click();
  await fila.locator('button:has-text("Editar")').waitFor({ timeout: 30000 });
  await d.waitForFunction((n) => !document.querySelector(`li[data-plan="${n}"]`)?.textContent?.includes("matrícula"), `Mat${s5}`, { timeout: 15000 }).catch(() => {});
  const tf = await fila.innerText();
  chequear(!/matrícula/.test(tf), "✏️ Editar con la matrícula vacía: el plan queda sin matrícula", tf.replace(/\n/g, " | "));
  if (d.errores.length) falla(`dueña: ${d.errores.join(" | ")}`);
} catch (e) {
  falla(`se cortó: ${process.env.E2E_DEPURAR ? e.message : e.message.split("\n")[0]}`);
}
await b.close();
resultado();
