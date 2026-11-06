#!/usr/bin/env node
// VEN-6 · Anular una venta: la recepción vende un agua, se equivoca y pide
// anularla; la dueña la ve en Inicio y la anula; después, desde la ficha de un
// socio, la dueña anula una cuota con motivo y el socio vuelve a deber.
//   npm run e2e:ven-6            (con scripts/local/levantar.sh corriendo)
import { COMPU, GIMNASIO, capturar, chequear, entrar, esperarCobro, falla, navegador, ok, pagina, resultado } from "./comun.mjs";
import { elegirPlan, hojaDeAlta, irAVender } from "./alta.mjs";

const G = GIMNASIO();
const b = await navegador();
const s5 = Date.now().toString().slice(-5);
try {
  const r = await pagina(b, COMPU);
  await entrar(r, "recepcion@ejemplo.invalid");
  await r.goto(`${G}/panel/vender`);
  await r.locator('button:has-text("Otra cosa")').click();
  await r.locator('input[placeholder^="Qué es"]').fill(`Toalla${s5}`);
  await r.locator('input[placeholder="Precio"]').fill("1.500");
  await r.locator('form:has(input[placeholder^="Qué es"]) button:has-text("Agregar")').click();
  await r.locator("[data-carrito]", { hasText: `Toalla${s5}` }).waitFor({ timeout: 30000 });
  chequear(/\$1\.500/.test(await r.locator("[data-carrito]").innerText()), "“1.500” en Otra cosa es $1.500 (antes se leía $1,50)", await r.locator("[data-carrito]").innerText());
  await r.locator('button[aria-pressed]:has-text("Transferencia")').click();
  await r.locator('button:has-text("✅ Cobrar")').click();
  await esperarCobro(r);
  await r.locator('button:has-text("pedir que la anulen")').click();
  await r.locator('input[aria-label="Motivo de la anulación"]').fill(`Cobré de más ${s5}`);
  await r.locator('button:has-text("Pedir")').click();
  await r.locator("[data-deshacer-hecho]").waitFor({ timeout: 30000 });
  ok("la recepción, en el mismo momento, pide que la anulen (con motivo)");

  const d = await pagina(b, COMPU);
  await entrar(d, "duena@ejemplo.invalid");
  await d.goto(`${G}/panel`);
  const fila = d.locator("[data-pedidos-anulacion] li", { hasText: `Cobré de más ${s5}` });
  await fila.waitFor({ timeout: 30000 });
  chequear(/Ana pidió anularla/.test(await fila.innerText()), "Inicio de la dueña: “↩️ Ventas para anular”, quién y por qué", await fila.innerText());
  await capturar(d, "ven6-compu-inicio");
  await fila.locator('button:has-text("Anular")').click();
  await fila.waitFor({ state: "detached", timeout: 30000 });
  ok("Anular: sale de la lista");

  // Ficha: anular una cuota.
  await d.goto(`${G}/panel/socios/nuevo`);
  await d.locator('input[name="nombre"]').fill(`Anula${s5}`);
  await elegirPlan(d, 0);
  await d.locator('button:has-text("Dar de alta y cobrar")').click();
  // VD-5b: "Dar de alta y cobrar" abre la hoja Cobrar sobre el alta; después se sigue en Vender con el socio.
  await irAVender(d, await hojaDeAlta(d));
  const id = new URL(d.url()).searchParams.get("socio");
  await d.getByText(/^Cuota /).first().waitFor({ timeout: 30000 });
  await d.locator('button[aria-pressed]:has-text("Transferencia")').click();
  await d.locator('button:has-text("✅ Cobrar")').click();
  await esperarCobro(d);
  await d.goto(`${G}/panel/socios/${id}?pestana=pagos`);
  const venta = d.locator("[data-ventas] li").first();
  await venta.waitFor({ timeout: 30000 });
  await venta.locator('button:has-text("Anular")').click();
  await venta.locator('input[aria-label="Motivo de la anulación"]').fill("Prueba de anulación");
  await venta.locator('button:has-text("Anular venta")').click();
  await d.locator('[data-ventas] li[data-estado="anulada"]').waitFor({ timeout: 30000 });
  chequear(/Anulada por Sofía: “Prueba de anulación”/.test(await d.locator('[data-ventas] li[data-estado="anulada"]').innerText()), "ficha → Pagos: la cuota queda anulada, con quién y por qué", await d.locator("[data-ventas]").innerText());
  await d.goto(`${G}/panel/entrada?socio=${id}`);
  await d.locator('[data-veredicto="rojo"]').waitFor({ timeout: 30000 });
  ok("y el socio vuelve a deber (rojo en la Entrada)");
  if (d.errores.length) falla(`dueña: ${d.errores.join(" | ")}`);
} catch (e) {
  falla(`se cortó: ${process.env.E2E_DEPURAR ? e.message : e.message.split("\n")[0]}`);
}
await b.close();
resultado();
