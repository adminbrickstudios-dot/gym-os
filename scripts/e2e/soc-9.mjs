#!/usr/bin/env node
// SOC-9 · Pausas (D7): la recepción pide una pausa desde la ficha (no la
// puede dar); el encargado la ve en Inicio, la aprueba y queda programada;
// la dueña la anula con un motivo; el máximo por año está en Configuración.
//   npm run e2e:soc-9            (con scripts/local/levantar.sh corriendo)
import { CELU, COMPU, GIMNASIO, capturar, chequear, entrar, falla, navegador, ok, pagina, resultado } from "./comun.mjs";

const G = GIMNASIO();
const b = await navegador();
// Fechas al azar en 2027 (3 días), así una corrida anterior no choca.
const base = Date.parse("2027-01-05T12:00:00Z") + (Date.now() % 300) * 864e5;
const DESDE = new Date(base).toISOString().slice(0, 10), VUELVE = new Date(base + 3 * 864e5).toISOString().slice(0, 10);
const corto = (d) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;
try {
  // ── Recepción, en el celular: pide ──
  const r = await pagina(b, CELU);
  await entrar(r, "recepcion@ejemplo.invalid");
  await r.goto(`${G}/panel/socios`);
  const filas = r.locator('main ul a[href^="/panel/socios/"]');
  await filas.first().waitFor({ timeout: 30000 });
  const hrefs = await filas.evaluateAll((xs) => xs.map((x) => x.getAttribute("href")));
  let ficha = null;
  for (const h of hrefs.slice(0, 12)) {
    await r.goto(`${G}${h}`); await r.locator("h1").waitFor();
    if (await r.locator('[data-pausas] button:has-text("Pedir una pausa")').count()) { ficha = h; break; }
  }
  if (!ficha) throw new Error("ningún socio de los primeros 12 tiene membresía para pausar");
  const nombre = (await r.locator("h1").innerText()).trim();
  chequear(await r.locator('[data-pausas] button:has-text("Pausar la membresía")').count() === 0, `recepción: en ${nombre} ve “Pedir una pausa”, no “Pausar”`, "recepción ve Pausar");
  await r.locator('[data-pausas] button:has-text("Pedir una pausa")').click();
  await r.locator('input[aria-label="Desde"]').fill(DESDE);
  await r.locator('input[aria-label="Vuelve el"]').fill(VUELVE);
  await r.locator('select[aria-label="Motivo"]').selectOption("estudio");
  await r.locator('input[aria-label="Nota de la pausa"]').fill("Rinde finales");
  chequear(await r.locator("[data-dias-pausa]").getAttribute("data-dias-pausa") === "3", "cuenta los días mientras se eligen (3)", "no cuenta 3 días");
  const opciones = await r.locator('select[aria-label="Motivo"] option').allInnerTexts();
  chequear(!opciones.some((o) => /lesi|salud|m[eé]dic/i.test(o)), `motivos sin salud: ${opciones.join(", ")}`, `motivos: ${opciones.join(", ")}`);
  await r.locator('[data-form-pausa] button[type="submit"]').click();
  await r.locator('[data-pausas] [data-pedido]').first().waitFor({ timeout: 30000 });
  chequear(/Esperando que la apruebe/.test(await r.locator("[data-pedido]").first().innerText()), "el pedido queda esperando aprobación", "el pedido no dice que espera");
  const ancho = await r.evaluate(() => document.documentElement.scrollWidth);
  chequear(ancho <= CELU.width, `celular sin desborde (${ancho}px)`, `mide ${ancho}px`);
  await capturar(r, "soc9-celu-pedido");
  if (r.errores.length) falla(`recepción: ${r.errores.join(" | ")}`);
  await r.context().close();

  // ── Encargado: lo ve en Inicio y lo aprueba ──
  const e = await pagina(b, COMPU);
  await entrar(e, "encargado@ejemplo.invalid");
  await e.goto(`${G}/panel`);
  const pedido = e.locator("[data-pedidos-pausa] a", { hasText: nombre });
  await pedido.first().waitFor({ timeout: 30000 });
  chequear(new RegExp(`Del ${corto(DESDE)}, vuelve el ${corto(VUELVE)}`).test(await pedido.first().innerText()), "Inicio: “Pausas para aprobar” con el socio y las fechas", "Inicio no muestra las fechas");
  await pedido.first().click();
  await e.waitForURL(/\/panel\/socios\//);
  await e.locator('[data-pedido] button:has-text("Aprobar")').first().click();
  await e.locator('[data-pausa="programada"]').first().waitFor({ timeout: 30000 });
  ok("el encargado la aprueba: queda programada");
  if (e.errores.length) falla(`encargado: ${e.errores.join(" | ")}`);
  await e.context().close();

  // ── Dueña: la anula; el máximo está en Configuración ──
  const d = await pagina(b, COMPU);
  await entrar(d, "duena@ejemplo.invalid");
  await d.goto(`${G}${ficha}`);
  const prog = d.locator('[data-pausa="programada"]', { hasText: corto(DESDE) }).first();
  await prog.locator('button:has-text("Anular")').click();
  await d.locator('input[aria-label="Por qué se anula la pausa"]').fill("Prueba automática");
  await d.locator('button:has-text("Anular la pausa")').click();
  await d.locator('[data-pausa="anulada"]', { hasText: corto(DESDE) }).first().waitFor({ timeout: 30000 });
  ok("la dueña la anula con un motivo");
  await d.goto(`${G}/panel/configuracion?pestana=reglas`);
  chequear(await d.getByText("Pausa: máximo de días por año").count() > 0, "Configuración → Reglas: “Pausa: máximo de días por año”", "no está el máximo en Reglas");
  if (d.errores.length) falla(`dueña: ${d.errores.join(" | ")}`);
  await d.context().close();
} catch (e) {
  falla(`se cortó: ${process.env.E2E_DEPURAR ? e.message : e.message.split("\n")[0]}`);
}
await b.close();
resultado();
