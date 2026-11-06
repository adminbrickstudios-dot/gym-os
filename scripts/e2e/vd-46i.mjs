#!/usr/bin/env node
// VD-46I · Incidentes de la sala: se anota sin diagnóstico (un dato de salud avisa y no deja guardar),
// la recepción ve solo los suyos y la dueña ve todos; celular sin desborde.
//   node scripts/e2e/vd-46i.mjs     (con scripts/local/levantar.sh corriendo)
import { CELU, COMPU, GIMNASIO, capturar, chequear, entrar, falla, navegador, pagina, resultado } from "./comun.mjs";

const G = GIMNASIO();
const b = await navegador();
const s5 = Date.now().toString().slice(-5);

async function anotar(p, donde, paso) {
  await p.locator("[data-nuevo-incidente]").click();
  await p.locator("[data-inc-donde]").fill(donde);
  await p.locator("[data-inc-paso]").fill(paso);
  await p.locator("[data-inc-hizo]").fill("Se despejó la zona y se avisó al encargado");
}

try {
  const d = await pagina(b, COMPU);
  await entrar(d, "duena@ejemplo.invalid");
  await d.goto(`${G}/panel/incidentes`);
  await d.locator("[data-incidentes]").waitFor({ timeout: 30000 });

  await anotar(d, `Sala de pesas ${s5}`, "Está operado de rodilla y se cayó");
  chequear(await d.locator("[data-aviso-salud-detectado]").first().isVisible(), "un dato de salud avisa", "no avisó");
  chequear(await d.locator("[data-guardar-incidente]").isDisabled(), "y no deja guardar", "dejó guardar un dato de salud");
  await d.locator("[data-inc-paso]").fill(`Se cayó una mancuerna de la barra ${s5}`);
  chequear(!(await d.locator("[data-guardar-incidente]").isDisabled()), "sin el dato de salud, se puede guardar", "sigue bloqueado");
  await d.locator("[data-guardar-incidente]").click();
  await d.locator(`[data-incidente]:has-text("barra ${s5}")`).waitFor({ timeout: 30000 });
  chequear(true, "el incidente queda en la lista, corregible dentro de las 24 h", "");
  chequear(await d.locator(`[data-incidente]:has-text("barra ${s5}") [data-corregir-incidente]`).count() === 1, "tiene el botón Corregir", "sin Corregir");

  // La recepción: anota uno y ve solo el suyo.
  const r = await pagina(b, COMPU);
  await entrar(r, "recepcion@ejemplo.invalid");
  await r.goto(`${G}/panel/incidentes`);
  await r.locator("[data-incidentes]").waitFor({ timeout: 30000 });
  chequear((await r.locator(`[data-incidente]:has-text("barra ${s5}")`).count()) === 0, "la recepción no ve el incidente de la dueña", "la recepción ve incidentes ajenos");
  await anotar(r, `Vestuario ${s5}`, `Se resbaló un piso mojado ${s5}`);
  await r.locator("[data-guardar-incidente]").click();
  await r.locator(`[data-incidente]:has-text("mojado ${s5}")`).waitFor({ timeout: 30000 });
  ok2();
  await d.reload();
  chequear(await d.locator(`[data-incidente]:has-text("mojado ${s5}")`).count() === 1, "la dueña ve el de la recepción", "la dueña no ve el de la recepción");

  // Celular.
  const c = await pagina(b, CELU);
  await entrar(c, "duena@ejemplo.invalid");
  await c.goto(`${G}/panel/incidentes`);
  await c.locator("[data-incidentes]").waitFor({ timeout: 30000 });
  const ancho = await c.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  chequear(ancho <= 1, "celular: sin desborde horizontal", `desborda ${ancho}px`);
  await capturar(c, "vd46i-celu");
  if (d.errores.length) falla(`errores: ${d.errores.join(" | ")}`);
} finally {
  await b.close();
}
function ok2() { chequear(true, "la recepción anota el suyo y lo ve", ""); }
resultado();
