#!/usr/bin/env node
// VD-46M · Modo emergencia de la puerta: arranca apagado; la dueña lo prende y activa una emergencia con motivo;
// la recepción ve el cartel rojo y anota a un socio que no podía entrar (queda marcado); la dueña cierra y ve la lista
// de quiénes entraron; con la emergencia cerrada la puerta vuelve a rechazar. Al final todo vuelve a como estaba.
//   node scripts/e2e/vd-46m.mjs     (con scripts/local/levantar.sh corriendo)
import { execSync } from "node:child_process";
import pg from "pg";
import { CELU, COMPU, GIMNASIO, capturar, chequear, entrar, falla, navegador, ok, pagina, resultado } from "./comun.mjs";

const G = GIMNASIO();
const b = await navegador();
const db = new pg.Client({ connectionString: process.env.DB_PRUEBAS_URL || execSync("scripts/db/local.sh url").toString().trim() });
await db.connect();
const s5 = Date.now().toString().slice(-5);
const NOMBRE = `Emerg${s5}`;
const [{ id: gimnasio }] = (await db.query(`select id from public.gimnasios where slug = 'demo'`)).rows;
// Un socio nuevo y sin plan: no puede entrar (rojo) y nadie lo anotó antes en la visita.
await db.query(`insert into public.socios (gimnasio_id, nombre, apellido) values ($1, $2, 'Prueba')`, [gimnasio, NOMBRE]);

async function abrir(p) {
  await p.goto(`${G}/panel/entrada`);
  await p.locator('input[aria-label="Buscar socio"]').fill(NOMBRE);
  await p.locator("button.fila", { hasText: NOMBRE }).first().click();
  await p.locator("[data-veredicto]").waitFor({ timeout: 30000 });
}
const panelDe = (p) => p.locator("[data-panel-emergencia]");

try {
  const d = await pagina(b, COMPU);
  await entrar(d, "duena@ejemplo.invalid");
  await d.goto(`${G}/panel/entrada`);
  await panelDe(d).waitFor({ timeout: 60000 });
  // Si una corrida anterior lo dejó prendido, se apaga para arrancar de cero.
  if (await panelDe(d).getAttribute("data-panel-emergencia") !== "apagada") {
    if (await panelDe(d).getAttribute("data-panel-emergencia") === "activa") await d.locator("[data-emergencia-cerrar]").click();
    await d.locator("[data-emergencia-apagar]").click();
    await d.locator('[data-panel-emergencia="apagada"]').waitFor({ timeout: 30000 });
  }
  chequear(await d.locator("[data-emergencia-activa]").count() === 0, "arranca apagado y sin cartel", "había un cartel de emergencia");

  // La recepción no ve el panel de emergencia (solo el cartel si la hay).
  const r = await pagina(b, COMPU);
  await entrar(r, "recepcion@ejemplo.invalid");
  await r.goto(`${G}/panel/entrada`);
  await r.locator('input[aria-label="Buscar socio"]').waitFor({ timeout: 60000 });
  chequear(await r.locator("[data-panel-emergencia]").count() === 0, "la recepción no ve los controles de la emergencia", "la recepción ve el panel");

  // Con el modo apagado, el socio sin plan no pasa.
  await abrir(r);
  chequear(await r.locator("[data-anotar-emergencia]").count() === 0, "sin emergencia no hay botón de anotar igual", "hay botón de emergencia sin emergencia");
  await r.keyboard.press("Escape");

  // La dueña lo prende y activa una emergencia.
  await d.locator("[data-emergencia-prender]").click();
  await d.locator('[data-panel-emergencia="lista"]').waitFor({ timeout: 30000 });
  ok("la dueña prende el modo emergencia (queda listo, sin activar)");
  await d.locator("[data-emergencia-abrir]").click();
  await d.locator("[data-emergencia-activar]").waitFor();
  chequear(await d.locator("[data-emergencia-activar]").isDisabled(), "sin motivo no se puede activar", "deja activar sin motivo");
  await d.locator('input[aria-label="Motivo de la emergencia"]').fill("Molinete trabado (prueba)");
  await d.locator("[data-emergencia-activar]").click();
  await d.locator('[data-panel-emergencia="activa"]').waitFor({ timeout: 30000 });
  await d.locator("[data-emergencia-activa]").first().waitFor({ timeout: 30000 });
  ok("la dueña activa la emergencia con motivo: cartel rojo en su Entrada");
  await capturar(d, "vd46m-compu-activa");

  // La recepción ve el cartel y anota al que no podía entrar.
  await r.goto(`${G}/panel/entrada`);
  await r.locator("[data-emergencia-activa]").first().waitFor({ timeout: 60000 });
  ok("la recepción ve el cartel rojo “EMERGENCIA activa”");
  await abrir(r);
  const boton = r.locator("[data-anotar-emergencia]");
  await boton.waitFor({ timeout: 30000 });
  ok("al socio sin plan se lo puede anotar igual: “Anotar entrada (emergencia)”");
  await boton.click();
  await r.locator("[data-hecho]").waitFor({ timeout: 30000 });
  const texto = await r.locator("[data-hecho]").innerText();
  chequear(/emergencia/i.test(texto) && !/no pudo entrar/.test(texto), `entró y quedó marcado: “${texto.trim()}”`, `texto inesperado: ${texto}`);

  // Celular: sin desborde.
  const c = await pagina(b, CELU);
  await entrar(c, "recepcion@ejemplo.invalid");
  await c.goto(`${G}/panel/entrada`);
  await c.locator("[data-emergencia-activa]").first().waitFor({ timeout: 60000 });
  const ancho = await c.evaluate(() => document.documentElement.scrollWidth);
  chequear(ancho <= CELU.width, `celular 390 px: sin desborde (${ancho}px)`, `desborda: ${ancho}px`);
  await capturar(c, "vd46m-celu-cartel");

  // La dueña cierra y ve quiénes entraron.
  await d.goto(`${G}/panel/entrada`);
  await d.locator("[data-emergencia-cerrar]").click();
  const cerrada = d.locator("[data-emergencia-cerrada]");
  await cerrada.waitFor({ timeout: 30000 });
  chequear((await cerrada.innerText()).includes(NOMBRE), `al cerrar se lista quién entró: ${NOMBRE}`, "la lista no tiene al socio");
  chequear((await cerrada.innerText()).includes("no estaba al día"), "y se ve que no estaba al día", "no marca que no estaba al día");
  await capturar(d, "vd46m-compu-cerrada");

  // Cerrada: la recepción ya no ve el cartel ni el botón.
  await r.goto(`${G}/panel/entrada`);
  await r.locator('input[aria-label="Buscar socio"]').waitFor({ timeout: 60000 });
  chequear(await r.locator("[data-emergencia-activa]").count() === 0, "cerrada la emergencia, el cartel se va", "el cartel quedó");

  // Queda en el historial de la dueña.
  await d.goto(`${G}/panel/entrada`);
  await d.locator("[data-emergencia-historial] summary").click();
  chequear(await d.locator("[data-emergencia-historial]").getByText("Molinete trabado (prueba)").count() > 0, "queda en el historial con su motivo", "no está en el historial");

  // Todo vuelve a como estaba: modo apagado.
  await d.locator("[data-emergencia-apagar]").click();
  await d.locator('[data-panel-emergencia="apagada"]').waitFor({ timeout: 30000 });
  ok("el modo vuelve a apagado");
  if (d.errores?.length) falla(`dueña: ${d.errores.join(" | ")}`);
} catch (e) {
  falla(`se cortó: ${process.env.E2E_DEPURAR ? e.message : e.message.split("\n")[0]}`);
}
await db.end();
await b.close();
resultado();
