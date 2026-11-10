#!/usr/bin/env node
// VEN-4 · Productos con stock: la dueña prende el stock de la bebida contando
// 3, entra mercadería (5), cuenta 2 y queda "por reponer" en Inicio; Vender
// muestra cuántos quedan y "Sin stock" con lo del carrito, sin frenar. Al
// final deja de llevar stock (para no tocar otras pruebas).
//   npm run e2e:ven-4            (con scripts/local/levantar.sh corriendo)
import { COMPU, GIMNASIO, capturar, chequear, entrar, esperarCobro, falla, navegador, ok, pagina, resultado } from "./comun.mjs";

const G = GIMNASIO();
const b = await navegador();
const d = await pagina(b, COMPU);
const fila = d.locator('li[data-producto="Bebida isotónica"]');
const quedan = async (n) => d.locator(`li[data-producto="Bebida isotónica"] [data-stock="${n}"]`).waitFor({ timeout: 30000 });
try {
  await entrar(d, "duena@ejemplo.invalid");
  await d.goto(`${G}/panel/planes`);
  await fila.locator('button:has-text("Stock")').click();
  await fila.locator('input[aria-label="Cuántos hay ahora"]').fill("3");
  await fila.locator('input[aria-label="Avisar cuando queden"]').fill("2");
  await fila.locator('button:has-text("Llevar stock")').click();
  await quedan(3);
  ok("📦 Llevar stock contando 3: “Quedan 3”");
  await fila.locator('button:has-text("Stock")').click();
  await fila.locator('input[aria-label="Cuántos entraron"]').fill("5");
  await fila.locator('button:has-text("Entró mercadería")').click();
  await quedan(8);
  await fila.locator('input[aria-label="Cuántos contaste"]').fill("2");
  await fila.locator('button:has-text("Conté")').click();
  await quedan(2);
  ok("entraron 5 (quedan 8) y al contar 2 ajusta (quedan 2)");
  await d.goto(`${G}/panel`);
  const rep = d.locator("[data-reponer] li", { hasText: "Bebida isotónica" });
  await rep.waitFor({ timeout: 30000 });
  chequear(/quedan 2/.test(await rep.innerText()), "Inicio: “Por reponer · Bebida isotónica: quedan 2”", await rep.innerText());

  await d.goto(`${G}/panel/vender`);
  const tile = d.locator("main button", { hasText: "Bebida isotónica" });
  await tile.locator("[data-quedan]").waitFor({ timeout: 30000 });
  chequear(/Quedan 2/.test(await tile.innerText()), "Vender: “Quedan 2” en el botón", await tile.innerText());
  await tile.click(); await tile.click();
  chequear(/Sin stock/.test(await tile.innerText()), "con 2 en el carrito: “Sin stock” (avisa, no frena)", await tile.innerText());
  await d.locator('button[aria-pressed]:has-text("Transferencia")').click();
  await d.locator('button:has-text("Cobrar")').click();
  await esperarCobro(d);
  await capturar(d, "ven4-compu-vender");
  await d.goto(`${G}/panel/planes`);
  await quedan(0);
  ok("vendidas las 2, Planes dice “Sin stock”");
  if (d.errores.length) falla(`dueña: ${d.errores.join(" | ")}`);
} catch (e) {
  falla(`se cortó: ${process.env.E2E_DEPURAR ? e.message : e.message.split("\n")[0]}`);
} finally {
  try {
    await d.goto(`${G}/panel/planes`);
    await fila.locator('button:has-text("Stock")').click();
    await fila.locator('button:has-text("Dejar de llevar stock")').click();
    await fila.locator("[data-stock]").waitFor({ state: "detached", timeout: 30000 });
  } catch { falla("no pude apagar el stock al final"); }
}
await b.close();
resultado();
