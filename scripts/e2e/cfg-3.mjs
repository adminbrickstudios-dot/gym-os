#!/usr/bin/env node
// CFG-3 · Medios de pago: lo que el dueño prende es lo único que ofrecen
// Vender y la app del socio; los datos de transferencia (con banco) en la app.
//   npm run e2e:cfg-3            (con scripts/local/levantar.sh corriendo)
import { CELU, COMPU, GIMNASIO, capturar, chequear, entrar, entrarSocio, falla, navegador, ok, pagina, resultado } from "./comun.mjs";

const G = GIMNASIO();
const b = await navegador();
try {
  const p = await pagina(b, COMPU);
  await entrar(p, "duena@ejemplo.invalid");
  const cont = p.locator("fieldset[data-pestana-activa]");
  const pie = (k) => p.locator(`[data-pie="${k}"]`);
  const guardar = async (k) => {
    const antes = Number(await pie(k).getAttribute("data-respuestas"));
    await pie(k).locator('button:has-text("Guardar")').click();
    await p.waitForFunction(([sel, n]) => Number(document.querySelector(sel)?.getAttribute("data-respuestas")) > n, [`[data-pie="${k}"]`, antes], { timeout: 30000 });
    return (await pie(k).locator(".mensaje").first().innerText()).replace(/\s+/g, " ").trim();
  };
  const medio = (t) => cont.locator("label", { hasText: t }).locator('input[role="switch"]');
  const abrirCobros = async () => { await p.goto(`${G}/panel/configuracion?pestana=cobros`); await p.locator('fieldset[data-pestana-activa="cobros"]').waitFor({ timeout: 30000 }); };
  const mediosEnVender = async () => {
    await p.goto(`${G}/panel/vender`);
    await p.locator("text=¿Cómo paga?").waitFor({ timeout: 30000 });
    return p.locator('aside button[aria-pressed]').evaluateAll((xs) => xs.map((x) => x.textContent.replace(/[^A-Za-zéáíóú ]/g, "").trim()));
  };

  // ── Los cuatro, y Mercado Pago apagado hasta conectar ──
  await abrirCobros();
  let todos = true;
  for (const t of ["Efectivo", "Transferencia", "Débito", "Crédito"]) if (!(await medio(t).isChecked())) todos = false;
  chequear(todos, "por defecto se aceptan efectivo, transferencia, débito y crédito", "falta algún medio prendido por defecto");
  chequear(await medio("Mercado Pago").isDisabled() && !(await medio("Mercado Pago").isChecked()), "Mercado Pago aparece apagado y no se puede prender todavía", "Mercado Pago se puede tocar");
  await capturar(p, "cfg3-compu-cobros", true);

  // ── Sin tarjetas: Vender ofrece efectivo y transferencia ──
  await medio("Débito").uncheck(); await medio("Crédito").uncheck();
  let m = await guardar("cobros");
  chequear(/Guardado/.test(m), "apagar débito y crédito se guarda", `apagar tarjetas dio “${m}”`);
  let enVender = await mediosEnVender();
  chequear(enVender.length === 2 && enVender.some((x) => /Efectivo/.test(x)) && enVender.some((x) => /Transferencia/.test(x)),
    "Vender ofrece solo efectivo y transferencia", `Vender ofrece: ${enVender.join(", ")}`);
  await capturar(p, "cfg3-compu-vender-sin-tarjetas");

  // ── No se puede apagar todo ──
  await abrirCobros();
  for (const t of ["Efectivo", "Transferencia"]) await medio(t).uncheck();
  m = await guardar("cobros");
  chequear(/al menos un medio de pago/.test(m), `apagar todos → “${m}”`, `apagar todos dio “${m}”`);

  // ── Solo efectivo y apagar Caja: no deja ──
  await medio("Efectivo").check();
  m = await guardar("cobros");
  chequear(/Guardado/.test(m), "solo efectivo se guarda (con Caja prendida)", `solo efectivo dio “${m}”`);
  enVender = await mediosEnVender();
  chequear(enVender.length === 1 && !(await p.locator('button:has-text("Paga con dos medios")').count()),
    "con un solo medio, Vender no ofrece pagar con dos", `Vender con un medio: ${enVender.join(", ")}`);
  await p.goto(`${G}/panel/configuracion?pestana=secciones`);
  await p.locator('fieldset[data-pestana-activa="secciones"]').waitFor({ timeout: 30000 });
  await cont.locator("label", { hasText: "Caja" }).locator('input[role="switch"]').uncheck();
  m = await guardar("secciones");
  chequear(/Sin Caja no se cobra en efectivo/.test(m), `apagar Caja con solo efectivo → “${m}”`, `apagar Caja con solo efectivo dio “${m}”`);

  // ── Transferencia: banco en la app; apagada, la app no la ofrece ──
  await abrirCobros();
  await medio("Transferencia").check();
  await cont.locator("label", { hasText: "Banco o billetera" }).locator("input").fill("Banco Ficticio");
  m = await guardar("cobros");
  chequear(/Guardado/.test(m), "transferencia con banco se guarda", `banco dio “${m}”`);
  const c = await pagina(b, CELU);
  await entrarSocio(c, "+5490000100002");
  await c.locator("text=Pagar por transferencia").waitFor({ timeout: 30000 });
  chequear(await c.locator("text=Banco Ficticio").count() > 0, "la app del socio muestra el banco junto al alias", "la app no muestra el banco");
  await capturar(c, "cfg3-celu-app-transferencia");
  await medio("Transferencia").uncheck();
  m = await guardar("cobros");
  await c.reload();
  await c.locator("text=/Podés entrar|No podés entrar/").first().waitFor({ timeout: 30000 });
  chequear(await c.locator("text=Pagar por transferencia").count() === 0, "sin transferencias, la app no ofrece pagar por transferencia", "la app sigue ofreciendo transferencia");
  if (c.errores.length) falla(`app: ${c.errores.join(" | ")}`);
  await c.context().close();

  // ── Dejar todo como estaba ──
  for (const t of ["Efectivo", "Transferencia", "Débito", "Crédito"]) await medio(t).check();
  await cont.locator("label", { hasText: "Banco o billetera" }).locator("input").fill("");
  m = await guardar("cobros");
  enVender = await mediosEnVender();
  chequear(enVender.length === 4, "con los cuatro prendidos, Vender vuelve a ofrecer los cuatro", `Vender ofrece ${enVender.length}`);
  if (p.errores.length) falla(`dueña: ${p.errores.join(" | ")}`);
  ok("medios de pago recorridos");
} catch (e) {
  falla(`se cortó: ${e.message.split("\n")[0]}`);
}
await b.close();
resultado();
