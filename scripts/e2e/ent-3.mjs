#!/usr/bin/env node
// ENT-3 · Tablet en la puerta: la dueña la prende y autoriza una tablet (un
// link que se ve una vez); la tablet, sin sesión de nadie, deja entrar al que
// escribe su DNI y puede, y al que no puede le dice por qué; la recepción lo
// ve en "Hoy"; revocada, la tablet deja de andar.
//   npm run e2e:ent-3            (con scripts/local/levantar.sh corriendo)
import { COMPU, GIMNASIO, capturar, chequear, entrar, falla, navegador, ok, pagina, resultado } from "./comun.mjs";

const G = GIMNASIO();
const TABLET = { width: 820, height: 1180 };
const b = await navegador();
const base = Number(Date.now().toString().slice(-6)) * 10;
const DNI_VERDE = String(40000000 + base % 9000000), DNI_ROJO = String(50000000 + base % 9000000);
async function reglas(d) {
  await d.goto(`${G}/panel/configuracion?pestana=reglas`);
  await d.locator('fieldset[data-pestana-activa="reglas"]').waitFor({ timeout: 60000 }); await d.waitForTimeout(500);
}
async function guardar(d) {
  const pie = d.locator('[data-pie="reglas"]'); const k = Number(await pie.getAttribute("data-respuestas"));
  await pie.locator('button:has-text("Guardar")').click();
  await d.waitForFunction((k) => Number(document.querySelector('[data-pie="reglas"]')?.getAttribute("data-respuestas")) > k, k, { timeout: 30000 });
}
async function ponerDni(d, nombre, dni) {
  await d.goto(`${G}/panel/socios?q=${encodeURIComponent(nombre)}`);
  await d.locator('main ul a[href^="/panel/socios/"]').first().click();
  await d.waitForURL(/\/panel\/socios\/[0-9a-f-]{36}$/);
  await d.locator('a:has-text("Editar")').click();
  await d.locator('input[name="dni"]').fill(dni);
  await d.locator('button:has-text("Guardar cambios")').click();
  await d.waitForURL(/\/panel\/socios\/[0-9a-f-]{36}$/, { timeout: 30000 });
}
try {
  const d = await pagina(b, COMPU);
  await entrar(d, "duena@ejemplo.invalid");
  await ponerDni(d, "Testigo Al Día", DNI_VERDE);
  await ponerDni(d, "Testigo Vencida", DNI_ROJO);
  await reglas(d);
  const sw = d.locator("[data-accesos] label", { hasText: "Tablet en la puerta" }).locator("input");
  if (!(await sw.isChecked())) { await sw.click(); await guardar(d); }
  await d.locator('button:has-text("Autorizar una tablet")').click();
  const link = await d.locator("[data-link-tablet]").getAttribute("data-link-tablet", { timeout: 30000 });
  chequear(/\/kiosco\/activar\?t=[\w-]{32}$/.test(link), "la dueña prende la tablet y la autoriza: un link (y su QR) que se ve una vez", `link: ${link}`);
  await capturar(d, "ent3-compu-autorizar");

  // ── La tablet: sin sesión ──
  const t = await pagina(b, TABLET);
  await t.goto(link);
  await t.locator('[data-kiosco="listo"]').waitFor({ timeout: 60000 });
  chequear(!/t=/.test(t.url()), "abre el link: queda autorizada y el token sale de la dirección", `quedó en ${t.url()}`);
  await capturar(t, "ent3-tablet-inicio");
  for (const n of DNI_VERDE) await t.locator(`[aria-label="Teclado"] button:has-text("${n}")`).first().click();
  await t.locator('button[aria-label="Entrar"]').click();
  const res = t.locator("[data-kiosco-resultado]");
  await res.waitFor({ timeout: 30000 });
  chequear(await res.getAttribute("data-kiosco-resultado") === "entro" && /¡Pasá, Testigo!/.test(await res.innerText()), "con el teclado y su DNI: “¡Pasá, Testigo!”", `dice: ${(await res.innerText()).slice(0, 80)}`);
  await capturar(t, "ent3-tablet-verde");
  await t.locator('[data-kiosco="listo"]').waitFor({ timeout: 15000 });
  ok("vuelve sola al inicio para el que sigue");
  await t.locator('input[aria-label="Tu DNI"]').fill(DNI_ROJO);
  await t.locator('input[aria-label="Tu DNI"]').press("Enter");
  await res.waitFor({ timeout: 30000 });
  const tr = await res.innerText();
  chequear(await res.getAttribute("data-kiosco-resultado") === "no" && /Pasá por recepción/.test(tr), `al que no puede le dice por qué: “${tr.replace(/\s+/g, " ").slice(0, 90)}”`, `dice: ${tr}`);
  await capturar(t, "ent3-tablet-rojo");
  const ancho = await t.evaluate(() => document.documentElement.scrollWidth);
  chequear(ancho <= TABLET.width, `tablet sin desborde (${ancho}px)`, `mide ${ancho}px`);

  // ── La recepción lo ve ──
  const r = await pagina(b, COMPU);
  await entrar(r, "recepcion@ejemplo.invalid");
  await r.goto(`${G}/panel/entrada`);
  await r.locator("[data-hoy]").waitFor();
  chequear(/en la tablet/.test(await r.locator("[data-hoy]").innerText()), "en Entrada, “Hoy” dice “en la tablet”", "Hoy no dice tablet");
  await r.context().close();

  // ── Revocar ──
  await reglas(d);
  await d.locator('[data-tablets] button:has-text("Revocar")').first().click();
  await d.waitForTimeout(1500);
  await t.goto(`${G}/kiosco`);
  await t.locator('[data-kiosco="sin-autorizar"]').waitFor({ timeout: 30000 });
  ok("revocada, la tablet dice que no está autorizada");
  // Dejar las demás como estaban: revocar todas y apagar la tablet.
  await reglas(d);
  while (await d.locator('[data-tablets] button:has-text("Revocar")').count()) { await d.locator('[data-tablets] button:has-text("Revocar")').first().click(); await d.waitForTimeout(800); }
  await sw.click(); await guardar(d);
  for (const [n, p] of [["dueña", d], ["tablet", t]]) if (p.errores.length) falla(`${n}: ${p.errores.join(" | ")}`);
} catch (e) {
  falla(`se cortó: ${process.env.E2E_DEPURAR ? e.message : e.message.split("\n")[0]}`);
}
await b.close();
resultado();
