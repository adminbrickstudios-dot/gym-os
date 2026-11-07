#!/usr/bin/env node
// REG-1 · Hacete socio online: la dueña escribe el reglamento y prende las
// altas → un visitante elige un plan desde la página y se anota pagando por
// transferencia (ve el alias); otro en el mostrador; el mismo DNI no duplica →
// la recepción lo encuentra en Entrada sin poder pasar hasta pagar, con su
// motivo, y lo ve en Prospectos → al apagar las altas la página manda a WhatsApp.
//   npm run e2e:reg-1            (con scripts/local/levantar.sh corriendo)
import { CELU, COMPU, GIMNASIO, aparece, capturar, chequear, entrar, falla, navegador, ok, pagina, resultado } from "./comun.mjs";

const G = GIMNASIO();
const b = await navegador();
const s = Date.now().toString().slice(-6);
const DNI1 = `40${s}`, DNI2 = `41${s}`;
const TEL1 = `000 ${s}1`, TEL2 = `000 ${s}2`;   // 10 números con característica 000: ficticios
const REGLAMENTO = "1. Traé toalla.\n2. Dejá los discos en su lugar.\n3. La cuota se paga del 1 al 10 de cada mes.";
try {
  // ── Dueña: reglamento y altas ──
  const d = await pagina(b, COMPU);
  await entrar(d, "duena@ejemplo.invalid");
  await d.goto(`${G}/panel/pagina`);
  const altas = d.locator("[data-altas]");
  await altas.waitFor({ timeout: 60000 });
  const guardar = async () => {
    const n = Number(await altas.getAttribute("data-respuestas"));
    await altas.locator('button:has-text("Guardar")').click();
    await d.waitForFunction((n) => Number(document.querySelector("[data-altas]")?.getAttribute("data-respuestas")) > n, n, { timeout: 30000 });
    return (await altas.locator(".mensaje").first().innerText()).replace(/\s+/g, " ");
  };
  const llave = altas.locator('input[role="switch"]');
  if (await llave.isChecked()) { await llave.uncheck(); await guardar(); }
  if (!(await altas.locator("textarea").inputValue()).trim()) {
    await llave.check();
    const m = await guardar();
    chequear(/Escribí el reglamento antes/.test(m), `sin reglamento no se prende: “${m}”`, `sin reglamento dio “${m}”`);
  }
  await altas.locator("textarea").fill(REGLAMENTO);
  await llave.check();
  let m = await guardar();
  chequear(/ya se puede anotar/.test(m), "con reglamento, las altas online quedan prendidas", `al prender dio “${m}”`);
  await capturar(d, "reg1-compu-altas");

  // ── Visitante 1: desde un plan, por transferencia ──
  const v = await pagina(b, CELU);
  await v.goto(`${G}/`);
  await v.locator("h1").first().waitFor({ timeout: 30000 });
  chequear(await v.locator('a[href="/hacete-socio"]').count() > 0, "la página muestra “Hacete socio”", "no aparece “Hacete socio”");
  const elegir = v.locator('a:has-text("Elegir este")').first();
  const planElegido = (await elegir.locator("xpath=ancestor::li[1]").locator(".titulo").first().innerText()).trim();
  await elegir.click();
  await v.waitForURL(/\/hacete-socio\?plan=/, { timeout: 30000 });
  const form = v.locator("[data-form-alta]");
  await form.waitFor({ timeout: 30000 });
  chequear(await form.locator(`[data-plan="${planElegido}"] input`).isChecked(), `“Elegir este” llega con ${planElegido} elegido`, "el plan no viene elegido");
  chequear((await v.locator("[data-reglamento]").innerText()).includes("Traé toalla"), "muestra el reglamento del gimnasio", "no muestra el reglamento");
  const llenar = async (f, dni, tel) => {
    await f.locator('input[name="nombre"]').fill("Martina");
    await f.locator('input[name="apellido"]').fill(`Online${s}`);
    await f.locator('input[name="dni"]').fill(dni);
    await f.locator('input[name="telefono"]').fill(tel);
    await f.locator('input[name="fecha_nacimiento"]').fill("1990-05-01");
  };
  await llenar(form, DNI1, TEL1);
  await form.locator('button[type="submit"]').click();
  // Sin aceptar el reglamento, el navegador no deja mandar (required).
  chequear(await form.locator('input[name="acepto"]').evaluate((x) => !x.checkValidity()), "sin aceptar el reglamento no se manda", "se pudo mandar sin aceptar");
  await form.locator('input[name="acepto"]').check();
  await form.locator('label:has-text("Transferencia")').click();
  await form.locator('button[type="submit"]').click();
  const listo = v.locator('[data-alta-lista="transferencia"]');
  await listo.waitFor({ timeout: 30000 });
  const tl = (await listo.innerText()).replace(/\s+/g, " ");
  chequear(/Bienvenido\/a a .+, Martina/.test(tl) && /Alias/.test(tl) && /comprobante desde la app/.test(tl), `transferencia: “${tl.slice(0, 110)}…”`, `la pantalla final dice: ${tl}`);
  await capturar(v, "reg1-celu-transferencia", true);
  await v.context().close();

  // ── Visitante 2: el mismo DNI → ya es socio ──
  const v2 = await pagina(b, CELU);
  await v2.goto(`${G}/hacete-socio`);
  const f2 = v2.locator("[data-form-alta]");
  await f2.waitFor({ timeout: 30000 });
  await f2.locator("[data-plan]").first().click();
  await llenar(f2, DNI1, TEL2);
  await f2.locator('input[name="acepto"]').check();
  await f2.locator('button[type="submit"]').click();
  await v2.locator("[data-alta-ya-socio]").waitFor({ timeout: 30000 });
  ok("el mismo DNI no se anota dos veces: “¡Ya sos socio!”");
  // ── Visitante 3: en el mostrador ──
  await v2.goto(`${G}/hacete-socio`);
  const f3 = v2.locator("[data-form-alta]");
  await f3.waitFor({ timeout: 30000 });
  await f3.locator("[data-plan]").first().click();
  await llenar(f3, DNI2, TEL2);
  await f3.locator('input[name="nombre"]').fill("Bruno");
  await f3.locator('input[name="acepto"]').check();
  await f3.locator('label:has(input[value="mostrador"])').click();
  await f3.locator('button[type="submit"]').click();
  await v2.locator('[data-alta-lista="mostrador"]').waitFor({ timeout: 30000 });
  chequear(/Pasá por recepción/.test(await v2.locator('[data-alta-lista="mostrador"]').innerText()), "en el mostrador: “Pasá por recepción y pagá tu plan”", "no dice que pague en recepción");
  if (v2.errores.length) falla(`visitante: ${v2.errores.join(" | ")}`);
  await v2.context().close();

  // ── Recepción: Entrada y Prospectos ──
  const r = await pagina(b, COMPU);
  await entrar(r, "recepcion@ejemplo.invalid");
  await r.goto(`${G}/panel/entrada`);
  await r.locator('input[aria-label="Buscar socio"]').fill(DNI1);
  const fila = r.locator("button.fila", { hasText: "Martina" }).first();
  await fila.waitFor({ timeout: 30000 });
  await fila.click();
  const veredicto = r.locator("section[aria-live]");
  await veredicto.waitFor({ timeout: 30000 });
  const tv = (await veredicto.innerText()).replace(/\s+/g, " ");
  chequear(!/Anotar entrada/.test(tv), `Entrada: no pasa sin pagar, con su motivo (“${tv.slice(0, 90)}…”)`, `Entrada lo deja pasar: ${tv}`);
  await capturar(r, "reg1-compu-entrada");
  await r.goto(`${G}/panel/prospectos`);
  await r.locator('[data-filtro="socio"]').click();
  const enProspectos = r.locator("[data-prospecto]", { hasText: `Online${s}` });
  await enProspectos.first().waitFor({ timeout: 30000 });
  const tp = (await enProspectos.allInnerTexts()).join(" | ");
  chequear(await enProspectos.count() === 2 && /transferencia/.test(tp) && /mostrador/.test(tp), "Prospectos → “Se hicieron socios”: los dos, con cómo pagan", `en Prospectos: ${tp}`);
  await r.context().close();

  // ── Apagar las altas ──
  await d.goto(`${G}/panel/pagina`);
  await altas.waitFor({ timeout: 60000 });
  await llave.uncheck();
  m = await guardar();
  const c = await pagina(b, CELU);
  await c.goto(`${G}/hacete-socio`);
  chequear(await aparece(c.locator("[data-alta-cerrada]"), 15000) && await c.locator('a:has-text("WhatsApp")').count() > 0, "apagadas: “Consultanos por WhatsApp”", "con las altas apagadas el formulario sigue");
  await c.goto(`${G}/`);
  await c.locator("h1").first().waitFor();
  chequear(await c.locator('a[href="/hacete-socio"]').count() === 0, "apagadas: la página no muestra “Hacete socio”", "la página sigue mostrando “Hacete socio”");
  await c.context().close();
  if (d.errores.length) falla(`dueña: ${d.errores.join(" | ")}`);
  await d.context().close();
} catch (e) {
  falla(`se cortó: ${process.env.E2E_DEPURAR ? e.message : e.message.split("\n")[0]}`);
}
await b.close();
resultado();
