#!/usr/bin/env node
// VD-5 · Cobrar: un solo flujo en todos lados. La hoja flotante se abre desde la Entrada (C),
// la ficha y Ctrl+K; la recepción no ve "cobré otro día" y la dueña sí; el total de la hoja es el
// que guarda la base; frena el doble cobro (VD-50: lo prueba vd-50); el celular no desborda.
//   node scripts/e2e/vd-5.mjs     (con scripts/local/levantar.sh corriendo)
import { CELU, COMPU, GIMNASIO, aparece, capturar, chequear, entrar, falla, navegador, ok, pagina, resultado } from "./comun.mjs";
import { elegirPlan } from "./alta.mjs";

const G = GIMNASIO();
const b = await navegador();
const s5 = Date.now().toString().slice(-5);
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");

/** Una persona nueva con plan y sin pagar (el "vencido" de siempre). */
async function moroso(p, nombre) {
  await p.goto(`${G}/panel/socios/nuevo`);
  await p.locator('input[name="nombre"]').fill(nombre);
  await elegirPlan(p, 0);
  await p.locator('button:has-text("Solo dar de alta")').click();
  await p.waitForURL(/\/panel\/socios\/[0-9a-f-]{36}$/, { timeout: 30000 });
  return new URL(p.url()).pathname.split("/").pop();
}
const hoja = (p) => p.locator("[data-cobrar]");
const abierta = async (p) => { await hoja(p).locator("[data-cobrar-confirmar]").waitFor({ timeout: 30000 }); };
const enfocadoEnCobrar = (p) => p.waitForFunction(() => document.activeElement?.hasAttribute("data-cobrar-confirmar"), null, { timeout: 10000 });
const plata = (n) => Number(n).toLocaleString("es-AR");

try {
  // ── Recepción: vencido en la Entrada → C → Enter → Enter → verde y entró ──
  const r = await pagina(b, COMPU);
  await entrar(r, "recepcion@ejemplo.invalid");
  const nombre1 = `Moroso${s5}`;
  await moroso(r, nombre1);
  await r.goto(`${G}/panel/socios`);
  await r.locator('main ul a[href^="/panel/socios/"]').first().waitFor({ timeout: 30000 });
  await r.keyboard.press("F2");
  await r.locator("[data-ventana-campo]").fill(nombre1);
  await r.locator("button.fila", { hasText: nombre1 }).first().click();
  const ver = r.locator("[data-ventana-veredicto]");
  await ver.waitFor({ timeout: 30000 });
  chequear(await ver.getAttribute("data-ventana-veredicto") !== "verde", `sin pagar no entra (${nombre1})`, "el moroso entra sin pagar");
  await r.locator("[data-ventana-cobrar]").waitFor({ timeout: 30000 });
  await r.keyboard.press("c");
  await abierta(r);
  chequear(await r.locator("[data-ventana-entrada]").count() === 0, "al abrir Cobrar la Entrada se esconde (un solo diálogo a la vez)", "se ven los dos");
  chequear(await r.locator("[data-cobrar-linea=cuota]").count() === 1, "la hoja trae la cuota de su plan ya elegida", "no trae la cuota");
  chequear(await r.locator('[data-cobrar-medio][aria-pressed="true"]').count() === 1, "un medio de pago ya elegido (el de siempre del gimnasio)", "sin medio elegido");
  chequear(await r.locator("[data-cobrar-otro-dia]").count() === 0, "la recepción NO ve “Cobré otro día”", "la recepción ve “otro día”");
  await capturar(r, "vd5-compu-hoja-entrada");
  await enfocadoEnCobrar(r);
  await r.keyboard.press("Enter");                                   // cobra
  await r.locator('[data-ventana-veredicto="verde"]').waitFor({ timeout: 30000 });
  chequear(await r.locator("[data-ventana-cobrado]").count() === 1, "vuelve a la Entrada con “Cobrado $…” y el veredicto en verde", "no volvió con el cobro");
  chequear(await aparece(r.locator("[data-comprobante]"), 20000), "y el recibo por WhatsApp a mano", "sin recibo");   // el comprobante se arma al terminar de cobrar: se espera
  await r.waitForFunction(() => document.activeElement?.hasAttribute("data-ventana-anotar"), null, { timeout: 10000 });
  await r.keyboard.press("Enter");                                   // anota
  await r.locator('[data-ventana-hecho="entro"]').waitFor({ timeout: 30000 });
  ok("C → Enter → Enter: el vencido pagó y entró");
  await capturar(r, "vd5-compu-entro");
  await r.keyboard.press("Escape");

  // ── Ctrl+K "cobrar …" abre la hoja; con la recién cobrada avisa del doble cobro (VD-50: frena y pide motivo) ──
  await r.goto(`${G}/panel/socios`);
  await r.locator('main ul a[href^="/panel/socios/"]').first().waitFor({ timeout: 30000 });
  await r.keyboard.press("Control+k");
  await r.locator('input[placeholder*="cobrar"]').fill(`cobrar ${nombre1}`);
  await r.locator("[data-buscador-cobrar]").first().waitFor({ timeout: 30000 });
  await r.keyboard.press("Enter");
  await abierta(r);
  chequear(await r.locator("[data-cobrar-doble]").count() === 1, "Ctrl+K “cobrar …”: avisa que se cobró hace un momento", "no avisó el doble cobro");
  chequear(await r.locator("[data-cobrar-confirmar]").isDisabled(), "VD-50: el doble cobro frena (Cobrar queda apagado hasta “Cobrar igual” con motivo)", "el aviso no frena");
  await r.keyboard.press("Escape");
  chequear(await hoja(r).count() === 0, "Esc cierra la hoja", "Esc no cerró");

  // ── La dueña, desde la ficha: transferencia + comprobante; el total es el que guarda la base ──
  const d = await pagina(b, COMPU);
  await entrar(d, "duena@ejemplo.invalid");
  const nombre2 = `Ficha${s5}`;
  const id2 = await moroso(d, nombre2);
  await d.locator('main a:has-text("Cobrar")').first().click();
  await abierta(d);
  chequear(d.url().includes(`/panel/socios/${id2}`), "Cobrar desde la ficha abre la hoja sin salir de la ficha", `salió a ${d.url()}`);
  chequear(await d.locator("[data-cobrar-otro-dia]").count() === 1, "la dueña SÍ ve “Cobré otro día”", "la dueña no ve “otro día”");
  await d.locator('[data-cobrar-medio="transferencia"]').click();
  await d.locator("[data-cobrar-comprobante] input[type=file]").setInputFiles({ name: "comprobante.png", mimeType: "image/png", buffer: PNG });
  await d.locator("[data-cobrar-archivo]").waitFor({ timeout: 10000 });
  const total = await d.locator("[data-cobrar-total]").getAttribute("data-cobrar-total");
  chequear(Number(total) > 0, `la hoja muestra el total ($${plata(total)})`, "total vacío");
  await capturar(d, "vd5-compu-hoja-ficha");
  await d.locator("[data-cobrar-confirmar]").click();
  const hecho = d.locator("[data-cobrar-hecho]");
  const error = d.locator('[data-cobrar] [role="alert"]');
  await Promise.race([hecho.waitFor({ timeout: 30000 }), error.waitFor({ timeout: 30000 }).then(async () => { throw new Error(`al cobrar: ${await error.innerText()}`); })]);
  chequear(await hecho.getAttribute("data-total") === total, "lo cobrado es el total que mostraba la hoja", `mostraba ${total} y cobró ${await hecho.getAttribute("data-total")}`);
  chequear(await aparece(d.locator("[data-comprobante]"), 20000), "recibo por WhatsApp", "sin recibo");
  await capturar(d, "vd5-compu-cobrado");
  await d.locator("[data-cobrar-volver]").click();
  await d.goto(`${G}/panel/socios/${id2}?pestana=pagos`);
  await d.locator("[data-ventas] li").first().waitFor({ timeout: 30000 });
  const guardado = await d.locator("[data-ventas] li").first().innerText();
  chequear(guardado.includes(plata(total)), `la base guardó el mismo total (${plata(total)})`, `la ficha dice: ${guardado.replace(/\s+/g, " ")}`);

  // ── Cobré otro día (solo dueña/encargado): pide motivo y no deja efectivo ──
  const nombre3 = `OtroDia${s5}`;
  const id3 = await moroso(d, nombre3);
  await d.locator('main a:has-text("Cobrar")').first().click();
  await abierta(d);
  await d.locator("[data-cobrar-otro-dia]").click();
  await d.locator("[data-cobrar-otro-dia-campos]").waitFor({ timeout: 10000 });
  chequear(await d.locator('[data-cobrar-medio="efectivo"]').isDisabled(), "con otro día, efectivo queda apagado (el efectivo de hoy es el de la caja de hoy)", "efectivo habilitado");
  chequear(await d.locator("[data-cobrar-confirmar]").isDisabled(), "sin motivo no se puede cobrar", "cobra sin motivo");
  await d.locator('input[aria-label="Motivo del cobro con otra fecha"]').fill("Pagó ayer y no se anotó");
  await d.locator('[data-cobrar-medio="transferencia"]').click();
  await d.locator("[data-cobrar-confirmar]").click();
  await Promise.race([d.locator("[data-cobrar-hecho]").waitFor({ timeout: 30000 }), error.waitFor({ timeout: 30000 }).then(async () => { throw new Error(`al cobrar otro día: ${await error.innerText()}`); })]);
  ok("cobro de otro día con motivo (transferencia): quedó cobrado");
  await d.locator("[data-cobrar-volver]").click();
  await d.goto(`${G}/panel/socios/${id3}?pestana=pagos`);
  await d.locator("[data-ventas] li").first().waitFor({ timeout: 30000 });

  // ── La recepción desde la ficha: sin "otro día"; y en el celular no desborda ──
  const c = await pagina(b, CELU);
  await entrar(c, "recepcion@ejemplo.invalid");
  const id4 = await moroso(c, `Celu${s5}`);
  await c.locator('main a:has-text("Cobrar")').first().click();
  await abierta(c);
  chequear(await c.locator("[data-cobrar-otro-dia]").count() === 0, "recepción en la ficha: tampoco ve “otro día”", "la recepción ve “otro día”");
  const ancho = await c.evaluate(() => document.documentElement.scrollWidth);
  const anchoHoja = await c.evaluate(() => document.querySelector("[data-cobrar]").scrollWidth <= document.querySelector("[data-cobrar]").clientWidth + 1);
  chequear(ancho <= CELU.width && anchoHoja, `celular: la hoja entra en 390 px sin desborde (${ancho}px)`, `desborda: ${ancho}, hoja ${anchoHoja}`);
  await capturar(c, "vd5-celu-hoja");
  await c.keyboard.press("Escape");
  void id4;

  for (const [quien, p] of [["recepción", r], ["dueña", d], ["celular", c]]) if (p.errores.length) falla(`${quien}: ${p.errores.join(" | ")}`);
} catch (e) {
  falla(`se cortó: ${process.env.E2E_DEPURAR ? e.message : e.message.split("\n")[0]}`);
}
await b.close();
resultado();
