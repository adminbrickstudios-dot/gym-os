#!/usr/bin/env node
// Cierre para vender (Mateo, 25/11) · DEMO PARA UN PROSPECTO: en /super, el nombre del gimnasio del prospecto y su color arman un
// gimnasio [demo] con los datos de ejemplo, su dirección propia, en Pista Semáforo, que vence a los 14 días; queda en la lista de prospectos.
//   node scripts/e2e/demo-prospecto.mjs      (con scripts/local/levantar.sh corriendo)
import { COMPU, GIMNASIO, PLATAFORMA as B, aparece, capturar, chequear, entrar, falla, navegador, ok, pagina, resultado } from "./comun.mjs";
import { entrarSoporte } from "./alta-gimnasio.mjs";

const s = Date.now().toString().slice(-5);
const NOMBRE = `Olimpo Prospecto ${s}`;
const b = await navegador();
try {
  const a = await pagina(b, COMPU);
  await entrar(a, "admin@ejemplo.invalid", undefined, B);
  await a.goto(`${B}/admin#demos`);
  const form = a.locator("[data-demo-prospecto]");
  await form.waitFor({ timeout: 60000 });
  await form.locator('input[name="nombre"]').fill(NOMBRE);
  await form.locator('input[type="color"]').evaluate((el) => { const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set; set.call(el, "#e11d48"); el.dispatchEvent(new Event("input", { bubbles: true })); el.dispatchEvent(new Event("change", { bubbles: true })); });
  await form.locator("[data-crear-demo]").click();
  const res = a.locator("[data-demo-resultado]");
  await res.waitFor({ timeout: 90000 });
  const texto = await res.innerText();
  chequear((await res.getAttribute("role")) === "status" && /Vence en 14 días/.test(texto), `la demo se crea: “${texto.slice(0, 120)}”`, `no se creó: ${texto}`);
  const fila = a.locator("[data-demo-prospecto-fila]", { hasText: NOMBRE });
  chequear(await aparece(fila, 30000), "queda en la lista de prospectos de /super", "no aparece en la lista de prospectos");
  chequear(/Vence en 1[34] días/.test(await fila.innerText()), `con su vencimiento calculado (${(await fila.innerText()).replace(/\s+/g, " ").slice(0, 80)})`, "sin vencimiento");
  await capturar(a, "demo-prospecto-super", true);
  const host = (await fila.locator("a").first().innerText()).trim();
  const slug = host.split(".")[0];
  chequear(/^demo-olimpo-prospecto-/.test(slug), `con su dirección propia (${host})`, `la dirección es ${host}`);

  // La página de la demo, con el nombre del prospecto, en Pista Semáforo.
  const w = await pagina(b, COMPU);
  await w.goto(GIMNASIO(slug));
  await w.locator("body").waitFor();
  const html = w.locator("html");
  chequear(new RegExp(NOMBRE).test(await w.locator("body").innerText()), "la página de la demo dice el nombre del gimnasio del prospecto", "la página no dice el nombre");
  chequear(await html.getAttribute("data-estilo") === null && ["oscuro", "claro"].includes(await html.getAttribute("data-modo")), "la página sale en Pista (el único estilo)", `la página sale con data-estilo=${await html.getAttribute("data-estilo")} data-modo=${await html.getAttribute("data-modo")}`);
  await capturar(w, "demo-prospecto-pagina", true);
  await w.context().close();

  // Por dentro: los socios de ejemplo, ficticios, en Pista Semáforo.
  await a.goto(`${B}/admin?q=${encodeURIComponent(NOMBRE)}`);
  await entrarSoporte(a.locator("li[data-gimnasio-color]", { hasText: NOMBRE }).first(), "e2e: mirar la demo del prospecto");
  await a.waitForURL(/\/panel/, { timeout: 60000 });
  chequear(await a.locator("html").getAttribute("data-semaforo") === "si", "el panel de la demo sale en Pista Semáforo", "el panel de la demo no tiene Semáforo");
  await a.goto(`${new URL(a.url()).origin}/panel/socios`);
  await a.locator("[data-lista-socios]").waitFor({ timeout: 60000 });
  const lista = await a.locator("[data-lista-socios]").innerText();
  chequear(/Ejemplo 1/.test(lista), "tiene los socios de ejemplo", "no tiene socios de ejemplo");
  await capturar(a, "demo-prospecto-socios", true);
  if (a.errores.length) falla(`super: ${a.errores.join(" | ")}`);
  ok("demo para un prospecto: lista");
} catch (e) {
  falla(`se cortó: ${e.message}`);
} finally {
  await b.close();
}
resultado();
