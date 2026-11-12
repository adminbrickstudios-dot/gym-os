#!/usr/bin/env node
// Q2 · Retención: "Avisar a todos" (uno tras otro, con tope, deja el contacto anotado), exportar la lista
// en CSV, y que Al día / Altas / Bajas / Plata en riesgo lleven a su lista. Compu y celular.
//   node scripts/e2e/q2-retencion.mjs     (con scripts/local/levantar.sh corriendo)
import { CELU, COMPU, GIMNASIO, capturar, chequear, entrar, falla, navegador, ok, pagina, resultado } from "./comun.mjs";
process.on("unhandledRejection", (e) => { console.log(`✗ se cortó (sin atrapar): ${String(e?.message ?? e).split("\n").slice(0, 3).join(" | ")}`); process.exit(1); });

const G = GIMNASIO();
const b = await navegador();
try {
  const d = await pagina(b, COMPU);
  d.setDefaultNavigationTimeout(120000);
  // WhatsApp no se abre de verdad: el toque solo tiene que anotar el contacto.
  await d.context().route(/wa\.me|whatsapp\.com/, (r) => r.fulfill({ status: 200, contentType: "text/html", body: "ok" }));
  await entrar(d, "duena@ejemplo.invalid");

  // 1) Los números de arriba llevan a su lista.
  await d.goto(`${G}/panel/retencion`);
  await d.locator("[data-tablero-retencion]").waitFor({ timeout: 60000 });
  for (const [clave, patron] of [["al_dia", /\/panel\/socios\?estado=al_dia/], ["altas", /\/panel\/socios\?estado=nuevos/], ["bajas", /\/panel\/socios\?estado=bajas/], ["riesgo", /\/panel\/retencion\?lista=riesgo/]]) {
    const a = d.locator(`[data-tablero-link="${clave}"]`);
    const href = await a.getAttribute("href", { timeout: 30000 });
    chequear(patron.test(href ?? ""), `el número de “${clave}” lleva a su lista (${href})`, `el número de ${clave} no lleva a su lista: ${href}`);
  }
  await d.locator('[data-tablero-link="bajas"]').click();
  await d.waitForURL(/\/panel\/socios\?estado=bajas/, { timeout: 60000 });
  await d.locator("main h1").waitFor({ timeout: 60000 });
  ok("tocar Bajas abre Socios filtrado por “Dados de baja”");

  // 2) "Avisar a todos": busca una lista con al menos dos para avisar.
  let lista = null;
  for (const l of ["vencido", "por_vencer", "no_viene", "nuevo", "riesgo"]) {
    await d.goto(`${G}/panel/retencion?lista=${l}`);
    await d.locator("[data-lista]").waitFor({ timeout: 60000 });
    if (await d.locator("[data-tanda]").count()) { lista = l; break; }
  }
  if (!lista) { falla("ninguna lista tiene dos socios con teléfono sin contactar: no se pudo probar “Avisar a todos”"); }
  else {
    const boton = d.locator("[data-tanda]").first();
    const n = Number(/\((\d+)\)/.exec(await boton.innerText())?.[1]);
    chequear(n >= 2 && n <= 30, `“Avisar a todos (${n})” en ${lista}, con tope de 30 por tanda`, `el botón dice ${n}`);
    await d.locator("[data-exportar-lista]").waitFor({ timeout: 30000 });
    await boton.click();
    const caja = d.locator("[data-tanda-abierta]");
    await caja.waitFor({ timeout: 30000 });
    const primero = (await caja.locator("p.font-semibold").first().innerText()).trim();
    chequear(new RegExp(`1 de ${n}`).test(await caja.innerText()), `la tanda arranca en “1 de ${n}” con ${primero}`, "la tanda no dice 1 de N");
    await caja.getByRole("link", { name: /Abrir WhatsApp/ }).click();
    await caja.getByText(new RegExp(`2 de ${n}|Listo`)).first().waitFor({ timeout: 30000 });
    ok("“Abrir WhatsApp y seguir” pasa al siguiente");
    await caja.getByRole("button", { name: /Saltear|Terminar|Cerrar/ }).first().click().catch(() => {});
    await d.reload();
    await d.locator("[data-lista]").waitFor({ timeout: 60000 });
    const fila = d.locator("[data-lista-retencion] > li", { hasText: primero }).first();
    await fila.waitFor({ timeout: 60000 });
    chequear(/Le escribió|Dijo que vuelve|Anotado/.test(await fila.innerText()), `el contacto de ${primero} quedó anotado (quién y cuándo)`, `${primero} sigue sin contacto anotado: ${(await fila.innerText()).replace(/\n/g, " | ")}`);
    const nuevo = d.locator("[data-tanda]");
    const quedan = (await nuevo.count()) ? Number(/\((\d+)\)/.exec(await nuevo.first().innerText())?.[1]) : 0;
    chequear(quedan < n, `la próxima tanda ya no incluye a quien se avisó (${n} → ${quedan})`, `siguen ${quedan} para avisar (eran ${n})`);

    // 3) Exportar la lista: un CSV con encabezado, no un archivo vacío.
    const href = await d.locator("[data-exportar-lista]").getAttribute("href");
    const r = await d.context().request.get(`${G}${href}`);
    const cuerpo = await r.text();
    chequear(r.status() === 200 && /text\/csv/.test(r.headers()["content-type"] ?? "") && cuerpo.split("\n").length >= 2 && /^﻿?"?Nombre/.test(cuerpo), `exportar la lista baja un CSV con ${cuerpo.trim().split("\n").length - 1} fila(s)`, `la exportación dio ${r.status()}: ${cuerpo.slice(0, 80)}`);
  }

  // 4) Celular: sin desbordes y con la tanda a mano.
  const c = await pagina(b, CELU);
  c.setDefaultNavigationTimeout(120000);
  await entrar(c, "duena@ejemplo.invalid");
  await c.goto(`${G}/panel/retencion${lista ? `?lista=${lista}` : ""}`);
  await c.locator("[data-lista]").waitFor({ timeout: 60000 });
  const w = await c.evaluate(() => document.documentElement.scrollWidth);
  chequear(w <= CELU.width + 1, "celular: Retención sin desbordes", `se desborda: ${w}px`);
  if (lista) chequear(await c.locator("[data-exportar-lista]").isVisible(), "celular: “Exportar esta lista” a la vista", "no se ve Exportar");
  await capturar(c, "q2-retencion-celu");
  for (const p of [d, c]) if (p.errores.length) falla(p.errores.join(" | "));
} catch (e) {
  falla(`se cortó: ${process.env.E2E_DEPURAR ? e.message : e.message.split("\n")[0]}`);
}
await b.close();
resultado();
