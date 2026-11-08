#!/usr/bin/env node
// VD-8 · Dejar pasar sin pagar en tres modos (D19): la dueña elige "la recepción hasta 3 días";
// la recepción deja pasar con "promete pagar mañana" sin PIN, pero con 7 días pide el PIN del dueño
// (uno equivocado no autoriza, el bueno sí y queda anotado quién lo pidió y quién lo autorizó);
// lo prometido aparece en Inicio y en Vencen hoy; con "siempre con PIN" lo pide siempre. Al final todo
// vuelve a como estaba.
//   node scripts/e2e/vd-8.mjs     (con scripts/local/levantar.sh corriendo)
import { execSync } from "node:child_process";
import pg from "pg";
import { CELU, COMPU, GIMNASIO, capturar, chequear, entrar, falla, navegador, ok, pagina, resultado } from "./comun.mjs";

const G = GIMNASIO();
const b = await navegador();
const PIN = "7391";
// Cada corrida prueba un PIN equivocado: se borran los intentos de corridas anteriores (si no, a la sexta bloquea 10 minutos).
const db = new pg.Client({ connectionString: process.env.DB_PRUEBAS_URL || execSync("scripts/db/local.sh url").toString().trim() });
await db.connect(); await db.query("delete from privado.intentos_pin"); await db.end();

async function tope(d, n) {
  await d.goto(`${G}/panel/configuracion?pestana=reglas`);
  await d.locator('fieldset[data-pestana-activa="reglas"]').waitFor({ timeout: 60000 }); await d.waitForTimeout(500);
  const campo = d.locator("fieldset[data-pestana-activa] label", { hasText: "Dejar pasar: tope" }).locator("input");
  await campo.fill(String(n));
  const pie = d.locator('[data-pie="reglas"]'); const k = Number(await pie.getAttribute("data-respuestas"));
  if (await pie.locator('button:has-text("Guardar")').isDisabled()) return;
  await pie.locator('button:has-text("Guardar")').click();
  await d.waitForFunction((k) => Number(document.querySelector('[data-pie="reglas"]')?.getAttribute("data-respuestas")) > k, k, { timeout: 30000 });
}
async function modo(d, indice, dias) {
  await d.goto(`${G}/panel/configuracion?pestana=cobros`);
  const card = d.locator("[data-dejar-pasar-config]");
  await card.waitFor({ timeout: 60000 });
  await card.locator('input[name="modo-dejar-pasar"]').nth(indice).check();
  if (dias != null) await card.locator('input[type=number]').fill(String(dias));
  await card.locator('button:has-text("💾 Guardar")').click();
  await card.getByText("Guardado. Vale desde ahora").waitFor({ timeout: 30000 });
}
async function abrirDejarPasar(r, nombre) {
  await r.goto(`${G}/panel/entrada`);
  await r.locator('input[aria-label="Buscar socio"]').fill(nombre);
  await r.locator("button.fila", { hasText: nombre }).first().click();
  await r.locator("[data-veredicto]").waitFor({ timeout: 30000 });
  await r.locator('[data-veredicto] button:has-text("Dejar pasar igual")').click();
  await r.locator("[data-dejar-pasar]").waitFor({ timeout: 15000 });
}
const form = (r) => r.locator("[data-dejar-pasar]");
const boton = (r) => form(r).locator("button.boton-peligro");

try {
  const d = await pagina(b, COMPU);
  await entrar(d, "duena@ejemplo.invalid");
  await tope(d, 50);

  // La dueña tiene un PIN (Mi cuenta).
  await d.goto(`${G}/panel/cuenta`);
  await d.locator('input[aria-label="PIN nuevo"]').fill(PIN);
  await d.locator('[data-mi-pin] button:has-text("Guardar PIN")').click();
  await d.locator('[data-mi-pin] [role="status"]').waitFor({ timeout: 30000 });
  ok("la dueña elige su PIN en Mi cuenta");

  // ── Modo 1: la recepción hasta 3 días ──
  await modo(d, 0, 3);
  ok("la dueña elige “La recepción hasta N días” con N = 3 y se guarda");
  await capturar(d, "vd8-compu-config");

  const r = await pagina(b, COMPU);
  await entrar(r, "recepcion@ejemplo.invalid");
  await abrirDejarPasar(r, "Testigo Vencida");
  chequear(await form(r).locator("[data-promete-pagar]").count() === 1, "la recepción ve “Promete pagar el…” para quien debe", "no pide el día que promete pagar");
  await form(r).locator('button:has-text("Paga mañana")').click();
  chequear(await boton(r).isDisabled(), "con motivo pero sin elegir el día no se puede dejar pasar (el modo 1 lo pide)", "deja pasar sin día");
  await form(r).locator('[data-promete-pagar] button:has-text("Mañana")').click();
  chequear(await form(r).locator("[data-pin-dueno]").count() === 0 && !(await boton(r).isDisabled()), "mañana (dentro de 3 días): lo decide sola, sin PIN", "pide PIN para mañana");
  await form(r).locator('[data-promete-pagar] button:has-text("En una semana")').click();
  await form(r).locator("[data-pin-dueno]").waitFor({ timeout: 10000 });
  chequear(/PIN/.test(await form(r).locator("[data-promesa-tope]").innerText()) && await boton(r).isDisabled(), "en 7 días (más de 3): pide el PIN del dueño o el encargado", "no pide PIN para 7 días");
  await capturar(r, "vd8-compu-pide-pin");
  await form(r).locator('[data-promete-pagar] button:has-text("Mañana")').click();
  await boton(r).click();
  await r.locator('[data-hecho="forzado"]').waitFor({ timeout: 30000 });
  ok("Testigo Vencida: promete pagar mañana y la recepción lo deja pasar sola");

  // Con 7 días: un PIN equivocado no autoriza; el de la dueña sí.
  await abrirDejarPasar(r, "Testigo Sin Pago");
  await form(r).locator('button:has-text("Paga mañana")').click();
  await form(r).locator('[data-promete-pagar] button:has-text("En una semana")').click();
  await form(r).locator('input[aria-label="PIN del dueño o del encargado"]').fill("0000");
  await boton(r).click();
  const alerta = r.locator('[role="alert"], [role="status"]').filter({ hasText: /PIN|intento/i }).first();
  await alerta.waitFor({ timeout: 30000 });
  chequear(/PIN|intento/i.test(await alerta.innerText()), `un PIN equivocado no autoriza: “${(await alerta.innerText()).slice(0, 70)}”`, "el PIN equivocado no avisó");
  await form(r).locator('input[aria-label="PIN del dueño o del encargado"]').fill(PIN);
  await boton(r).click();
  await r.locator('[data-hecho="forzado"]').waitFor({ timeout: 30000 });
  ok("con el PIN de la dueña la recepción deja pasar a 7 días");
  chequear(await r.locator("[data-atiende]").count() === 0, "el PIN valió solo para esa entrada: la compu no quedó atendiendo la dueña", "quedó la dueña atendiendo");
  if (r.errores.length) falla(`recepción: ${r.errores.join(" | ")}`);

  // ── Lo prometido aparece en Inicio y en Vencen hoy ──
  await d.goto(`${G}/panel`);
  const lista = d.locator("[data-dejados-pasar]");
  await lista.waitFor({ timeout: 30000 });
  const t = await lista.innerText();
  chequear(/Testigo Sin Pago[\s\S]*Ana[\s\S]*autorizó[\s\S]*promete pagar el \d\d\/\d\d/.test(t), "Inicio: quién lo pidió, quién lo autorizó y “promete pagar el …”", `Inicio dice: ${t.slice(0, 200)}`);
  await d.goto(`${G}/panel/vencen-hoy`);
  const pro = d.locator("[data-prometieron]");
  await pro.waitFor({ timeout: 30000 });
  chequear(/Prometió pagar el \d\d\/\d\d/.test(await pro.innerText()), "Vencen hoy → “Le prometieron pagar” muestra el día prometido", `Vencen hoy dice: ${(await pro.innerText()).slice(0, 160)}`);

  // ── Modo 2: siempre con PIN ──
  await modo(d, 1);
  await abrirDejarPasar(r, "Testigo Vencida");
  await form(r).locator('[data-promete-pagar] button:has-text("Hoy")').click();
  chequear(await form(r).locator("[data-pin-dueno]").count() === 1, "modo “Siempre con PIN”: pide el PIN aunque pague hoy", "no pidió PIN en el modo 2");

  // ── Celular: sin desbordes con el formulario abierto ──
  const c = await pagina(b, CELU);
  await entrar(c, "recepcion@ejemplo.invalid");
  await abrirDejarPasar(c, "Testigo Vencida");
  const ancho = await c.evaluate(() => document.documentElement.scrollWidth);
  chequear(ancho <= 392, `celular: el formulario de dejar pasar no desborda (${ancho}px)`, `celular: desborda (${ancho}px)`);
  await capturar(c, "vd8-celu-dejar-pasar");
  if (c.errores.length) falla(`celular: ${c.errores.join(" | ")}`);

  // ── Todo vuelve a como estaba ──
  await modo(d, 2);
  await tope(d, 5);
  ok("el modo vuelve a “Libre, con registro” y el tope a 5");
  if (d.errores.length) falla(`dueña: ${d.errores.join(" | ")}`);
} catch (e) {
  falla(`se cortó: ${process.env.E2E_DEPURAR ? e.message : e.message.split("\n")[0]}`);
}
await b.close();
resultado();
