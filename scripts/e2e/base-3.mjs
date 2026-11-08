#!/usr/bin/env node
// BASE-3 · Panel lateral con la ficha rápida (se abre al tocar un aviso de la puerta, D40).
// Un socio al día: estado en verde, plan, vigencia, último pago, sin botón de cobrar. Un socio que debe: estado en rojo,
// cuánto debe y COBRAR AHORA, que abre la hoja Cobrar con el monto. Esc y la ✕ lo cierran. Sin sesión de profe: no cobra.
//   node scripts/e2e/base-3.mjs     (con scripts/local/levantar.sh corriendo)
import { execSync } from "node:child_process";
import pg from "pg";
import { CELU, COMPU, GIMNASIO, capturar, chequear, entrar, falla, navegador, ok, pagina, resultado } from "./comun.mjs";

const G = GIMNASIO();
const url = process.env.DB_PRUEBAS_URL || execSync("scripts/db/local.sh url").toString().trim();
const db = new pg.Client({ connectionString: url }); await db.connect();
const id = async (nombre) => (await db.query(`select s.id from public.socios s join public.gimnasios g on g.id = s.gimnasio_id where g.slug = 'demo' and (s.nombre || ' ' || s.apellido) = $1`, [nombre])).rows[0]?.id;
const alDia = await id("Testigo Al Día"), debe = await id("Testigo Sin Pago");
const b = await navegador();
try {
  if (!alDia || !debe) throw new Error("faltan los testigos del demo");
  const r = await pagina(b, COMPU);
  r.setDefaultNavigationTimeout(120000);
  await entrar(r, "recepcion@ejemplo.invalid");
  await r.goto(`${G}/panel`);
  await r.waitForFunction(() => document.documentElement.dataset.entradaLista === "si", null, { timeout: 60000 });
  const abrir = (socioId) => r.evaluate((i) => window.dispatchEvent(new CustomEvent("gymos:abrir-panel-socio", { detail: { socioId: i } })), socioId);
  const panel = r.locator("[data-panel-socio-lateral]");

  // ── 1 · Al día: verde, sin cobrar ──
  await abrir(alDia);
  await panel.locator("[data-panel-socio-estado]").waitFor({ timeout: 30000 });
  chequear((await panel.locator("[data-panel-socio-estado]").getAttribute("data-panel-socio-estado")) === "verde", "al día: el estado va en verde (lo dice la base)", "el color no es verde");
  chequear(/quedan \d+ d/.test(await panel.innerText()) || /vigente hasta/.test(await panel.innerText()), "dice hasta cuándo está vigente", "no dice la vigencia");
  chequear(await panel.locator("[data-panel-socio-cobrar]").count() === 0, "al día: no ofrece COBRAR AHORA", "ofrece cobrar a quien está al día");
  await capturar(r, "base3-compu-al-dia");
  await r.keyboard.press("Escape");
  await panel.waitFor({ state: "detached", timeout: 10000 });
  ok("Esc cierra el panel");

  // ── 2 · Debe: rojo, cuánto debe y COBRAR AHORA ──
  await abrir(debe);
  await panel.locator("[data-panel-socio-estado]").waitFor({ timeout: 30000 });
  chequear((await panel.locator("[data-panel-socio-estado]").getAttribute("data-panel-socio-estado")) !== "verde", "el que debe no va en verde", "va en verde");
  const boton = panel.locator("[data-panel-socio-cobrar]");
  await boton.waitFor({ timeout: 10000 });
  chequear(/COBRAR AHORA/.test(await boton.innerText()), `COBRAR AHORA grande: “${(await boton.innerText()).trim()}”`, "no está el botón");
  const alto = (await boton.boundingBox())?.height ?? 0;
  chequear(alto >= 48, `el botón mide ${Math.round(alto)} px (mínimo 48)`, `botón de ${Math.round(alto)} px`);
  await capturar(r, "base3-compu-debe");
  await boton.click();
  await r.locator("[data-cobrar]").first().waitFor({ timeout: 30000 });
  ok("COBRAR AHORA abre la hoja Cobrar");
  await r.keyboard.press("Escape");

  // ── 3 · La ✕ cierra, en celular el panel ocupa el ancho ──
  const c = await pagina(b, CELU);
  c.setDefaultNavigationTimeout(120000);
  await entrar(c, "recepcion@ejemplo.invalid");
  await c.goto(`${G}/panel`);
  await c.waitForFunction(() => document.documentElement.dataset.entradaLista === "si", null, { timeout: 60000 });
  await c.evaluate((i) => window.dispatchEvent(new CustomEvent("gymos:abrir-panel-socio", { detail: { socioId: i } })), debe);
  const pc = c.locator("[data-panel-socio-lateral] aside");
  await pc.waitFor({ timeout: 30000 });
  const ancho = (await pc.boundingBox())?.width ?? 0;
  chequear(ancho >= 380 && ancho <= 391, `en el celular el panel ocupa el ancho (${Math.round(ancho)} px)`, `ancho ${Math.round(ancho)}`);
  chequear(await c.evaluate(() => document.documentElement.scrollWidth) <= 391, "sin desborde horizontal", "se desborda");
  await capturar(c, "base3-celu-debe");
  await c.locator('[data-panel-socio-lateral] button[aria-label="Cerrar"]').click();
  await c.locator("[data-panel-socio-lateral]").waitFor({ state: "detached", timeout: 10000 });
  ok("la ✕ cierra el panel");

  for (const [q, x] of [["compu", r], ["celular", c]]) if (x.errores.length) falla(`${q}: ${x.errores.join(" | ")}`);
} catch (e) {
  falla(`se cortó: ${process.env.E2E_DEPURAR ? e.message : e.message.split("\n")[0]}`);
}
await db.end();
await b.close();
resultado();
