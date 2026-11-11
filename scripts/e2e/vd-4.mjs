#!/usr/bin/env node
// VD-4 · Entradas en vivo: dos navegadores. La recepción está en Socios (no en Entrada); el socio entra
// escaneando el QR de la tablet y a la recepción le aparece el aviso verde en menos de 6 s (y se va solo);
// otro socio intenta entrar en la tablet sin poder: el aviso rojo se queda con el botón Cobrar; la lista
// "Hoy" de la pantalla Entrada se actualiza sola.
//   node scripts/e2e/vd-4.mjs     (con scripts/local/levantar.sh corriendo)
import { execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import QRCode from "qrcode";
import { CELU, COMPU, GIMNASIO, capturar, chequear, entrar, falla, navegador, ok, pagina, resultado } from "./comun.mjs";

const G = GIMNASIO();
const TABLET = { width: 820, height: 1180 };
const b = await navegador();
const base = Number(Date.now().toString().slice(-6)) * 10;
const DNI_ROJO = String(50000000 + base % 9000000);
async function reglas(d) {
  await d.goto(`${G}/panel/configuracion?pestana=reglas`);
  await d.locator('fieldset[data-pestana-activa="reglas"]').waitFor({ timeout: 60000 }); await d.waitForTimeout(500);
}
async function guardar(d) {
  const pie = d.locator('[data-pie="reglas"]'); const k = Number(await pie.getAttribute("data-respuestas"));
  await pie.locator('button:has-text("Guardar")').click();
  await d.waitForFunction((k) => Number(document.querySelector('[data-pie="reglas"]')?.getAttribute("data-respuestas")) > k, k, { timeout: 30000 });
}
const llave = (d, texto) => d.locator("[data-accesos] label", { hasText: texto }).locator("input");
async function ponerDni(d, nombre, dni) {
  await d.goto(`${G}/panel/socios?q=${encodeURIComponent(nombre)}`);
  // La fila exacta: "Testigo Pack Vencido" también aparece al buscar "Testigo Vencida" y sale primero por orden de nombre.
  await d.locator('main ul a[href^="/panel/socios/"]').filter({ hasText: new RegExp(`${nombre}(?!\\p{L})`, "u") }).first().click();
  await d.waitForURL(/\/panel\/socios\/[0-9a-f-]{36}$/);
  await d.locator('a:has-text("Editar")').click();
  await d.locator('input[name="dni"]').fill(dni);
  await d.locator('button:has-text("Guardar cambios")').click();
  await d.waitForURL(/\/panel\/socios\/[0-9a-f-]{36}$/, { timeout: 30000 });
}
/** Anula las entradas de hoy de un socio, para que su próxima pasada sea una entrada nueva (una visita dura 5 h). */
async function limpiarHoy(d, nombre) {
  await d.goto(`${G}/panel/entrada`);
  await d.locator("[data-hoy]").waitFor({ timeout: 30000 });
  for (let i = 0; i < 10; i++) {
    const fila = d.locator("[data-hoy] li", { hasText: nombre }).first();
    if (!(await fila.count())) break;
    await fila.locator(`button[aria-label^="Anular la entrada"]`).click();
    await fila.locator('input[aria-label="Por qué se anula la entrada"]').fill("Prueba automática");
    await fila.locator('button:has-text("Anular")').click();
    await d.waitForTimeout(1500);
  }
}
let b2;
try {
  // ── Preparación: la dueña prende la tablet con QR y autoriza una ──
  const d = await pagina(b, COMPU);
  await entrar(d, "duena@ejemplo.invalid");
  await ponerDni(d, "Testigo Vencida", DNI_ROJO);
  await limpiarHoy(d, "Testigo Al Día");
  await reglas(d);
  if (!(await llave(d, "Tablet en la puerta").isChecked())) await llave(d, "Tablet en la puerta").click();
  if (!(await llave(d, "QR en la tablet").isChecked())) await llave(d, "QR en la tablet").click();
  await guardar(d);
  await d.locator('button:has-text("Autorizar una tablet")').click();
  const link = await d.locator("[data-link-tablet]").getAttribute("data-link-tablet", { timeout: 30000 });
  const t = await pagina(b, TABLET);
  await t.goto(link);
  await t.waitForFunction(() => /^GYMOSP1\./.test(document.querySelector("[data-qr-pared]")?.getAttribute("data-qr-pared") ?? ""), null, { timeout: 60000 });
  const codigo = await t.locator("[data-qr-pared]").getAttribute("data-qr-pared");
  ok("la tablet está lista con su QR");

  // ── La recepción, en Socios (no en Entrada), mirando ──
  const r = await pagina(b, COMPU);
  await entrar(r, "recepcion@ejemplo.invalid");
  await r.goto(`${G}/panel/socios`);
  await r.locator("main").waitFor({ timeout: 30000 });
  await r.waitForTimeout(5500);   // el primer pedido fija desde cuándo mirar
  chequear(await r.locator("[data-avisos-entrada]").count() === 0, "sin entradas nuevas no hay avisos", "hay avisos sin que entre nadie");

  // ── El socio entra por el QR de la tablet ──
  const dir = mkdtempSync(join(tmpdir(), "gymos-qrp-"));
  await QRCode.toFile(join(dir, "qr.png"), codigo, { width: 480, margin: 4 });
  execFileSync("ffmpeg", ["-loglevel", "error", "-y", "-loop", "1", "-i", join(dir, "qr.png"), "-t", "3", "-r", "10", "-vf", "pad=640:480:(ow-iw)/2:(oh-ih)/2:white", "-pix_fmt", "yuv420p", join(dir, "qr.y4m")]);
  b2 = await navegador({ video: join(dir, "qr.y4m") });
  const s = await pagina(b2, CELU);
  await entrar(s, "socio@ejemplo.invalid");
  await s.goto(`${G}/app`);
  await s.locator('button:has-text("Escanear el QR de la entrada")').click();
  const res = s.locator("[data-resultado-escaneo]");
  await res.waitFor({ timeout: 45000 });
  const entroEn = Date.now();
  chequear(await res.getAttribute("data-resultado-escaneo") === "entro", "el socio escanea el QR de la tablet y entra", `dice: ${await res.innerText()}`);

  const verde = r.locator('[data-aviso-entrada="verde"]', { hasText: "Testigo" });
  await verde.first().waitFor({ timeout: 9000 });
  const tarde = Date.now() - entroEn;
  chequear(tarde < 6000, `a la recepción, en Socios, le aparece el aviso en ${(tarde / 1000).toFixed(1)} s`, `tardó ${(tarde / 1000).toFixed(1)} s (el límite es 6)`);
  chequear(/entró/.test(await verde.first().innerText()), `el aviso dice: “${(await verde.first().innerText()).replace(/\s+/g, " ").slice(0, 70)}”`, "el aviso no dice que entró");
  await capturar(r, "vd4-compu-aviso-verde");
  await verde.first().waitFor({ state: "detached", timeout: 12000 });
  ok("el aviso verde se va solo");

  // ── Un rechazo en la tablet: el aviso queda con Cobrar ──
  await t.goto(`${G}/kiosco`);
  await t.locator('[data-kiosco="listo"]').waitFor({ timeout: 60000 });
  await t.locator('input[aria-label="Tu DNI"]').fill(DNI_ROJO);
  await t.locator('input[aria-label="Tu DNI"]').press("Enter");
  const rojo = r.locator('[data-aviso-entrada="rojo"]', { hasText: "Vencida" });
  await rojo.first().waitFor({ timeout: 12000 }).catch(async (e) => {
    // Para saber de qué lado se cortó: qué dijo la tablet y qué avisos tiene la recepción.
    const tab = await t.locator("main, body").first().innerText().then((x) => x.replace(/\s+/g, " ").slice(0, 300)).catch(() => "(sin tablet)");
    const rec = await r.locator("[data-avisos-entrada]").evaluateAll((l) => l.map((x) => x.innerText.replace(/\s+/g, " ").slice(0, 200))).catch(() => []);
    throw new Error(`${e.message.split("\n")[0]} | tablet: ${tab} | avisos de la recepción: ${rec.join(" || ") || "(ninguno)"}`);
  });
  ok(`un rechazo en la tablet aparece en la recepción: “${(await rojo.first().innerText()).replace(/\s+/g, " ").slice(0, 80)}”`);
  await r.waitForTimeout(14000);
  chequear(await rojo.count() > 0, "el aviso rojo se queda (no se va solo)", "el aviso rojo desapareció");
  chequear(await rojo.first().locator("[data-aviso-cobrar]").count() === 1, "el rojo trae el botón Cobrar", "el rojo no tiene Cobrar");
  await capturar(r, "vd4-compu-aviso-rojo");

  // ── "Hoy" en la pantalla Entrada se actualiza sola ──
  await r.goto(`${G}/panel/entrada`);
  const hoy = r.locator("[data-hoy]");
  await hoy.waitFor({ timeout: 30000 });
  await r.waitForTimeout(5500);
  const antes = Number(await hoy.getAttribute("data-hoy"));
  await t.locator('[data-kiosco="listo"]').waitFor({ timeout: 30000 });
  await t.locator('input[aria-label="Tu DNI"]').fill(DNI_ROJO);
  await t.locator('input[aria-label="Tu DNI"]').press("Enter");
  await r.waitForFunction((n) => Number(document.querySelector("[data-hoy]")?.getAttribute("data-hoy")) > n, antes, { timeout: 12000 });
  ok("“Hoy” se actualiza solo cuando alguien intenta entrar por la tablet");

  // ── El celular ──
  const c = await pagina(b, CELU);
  await entrar(c, "recepcion@ejemplo.invalid");
  await c.goto(`${G}/panel/socios`);
  await c.locator("main").waitFor({ timeout: 30000 });
  await c.waitForTimeout(5500);
  await t.locator('[data-kiosco="listo"]').waitFor({ timeout: 30000 });
  await t.locator('input[aria-label="Tu DNI"]').fill(DNI_ROJO);
  await t.locator('input[aria-label="Tu DNI"]').press("Enter");
  await c.locator("[data-aviso-entrada]").first().waitFor({ timeout: 12000 });
  const desborde = await c.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  chequear(desborde <= 0, "celular 390 px: el aviso no desborda", `desborda ${desborde} px`);
  await capturar(c, "vd4-celu-aviso");

  // Dejar todo como estaba.
  await reglas(d);
  while (await d.locator('[data-tablets] button:has-text("Revocar")').count()) { await d.locator('[data-tablets] button:has-text("Revocar")').first().click(); await d.waitForTimeout(800); }
  await llave(d, "Tablet en la puerta").click(); await guardar(d);
  for (const [n, p] of [["dueña", d], ["recepción", r], ["tablet", t], ["socio", s]]) if (p.errores.length) falla(`${n}: ${p.errores.join(" | ")}`);
} catch (e) {
  falla(`se cortó: ${process.env.E2E_DEPURAR ? e.message : e.message.split("\n")[0]}`);
}
await b2?.close();
await b.close();
resultado();
