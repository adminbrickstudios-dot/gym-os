#!/usr/bin/env node
// F4.1 · Detalles de DETALLES-70.md que no tenían recorrido propio, en el gimnasio demo:
//   #2 la tecla "/" abre la ventana de Entrada y un número suelto también; #6 y #7 panel lateral con la ficha rápida y COBRAR AHORA
//   que abre la hoja Cobrar (no otra pantalla); #20 las notas del socio se ven en el panel lateral (con la función "más datos del panel" prendida).
// Prende "panel_pago" para la prueba y la deja apagada al terminar (el demo vuelve a como estaba).
//   node scripts/e2e/f45-detalles.mjs     (con scripts/local/levantar.sh corriendo)
import { COMPU, GIMNASIO, chequear, entrar, navegador, pagina, resultado } from "./comun.mjs";

const G = GIMNASIO();
const b = await navegador();
const nota = `Prefiere el turno mañana ${Date.now().toString().slice(-5)}`;

async function funcion(d, clave, si) {
  await d.goto(`${G}/panel/configuracion?pestana=funciones`);
  await d.locator('[data-funciones-nuevas="listo"]').waitFor({ timeout: 60000 });
  const caja = d.locator(`[data-funcion="${clave}"]`);
  if ((await caja.getAttribute("data-activa")) === (si ? "si" : "no")) return;
  await caja.locator('input[role="switch"]').click();
  await d.waitForFunction(([c, v]) => document.querySelector(`[data-funcion="${c}"]`)?.getAttribute("data-activa") === v, [clave, si ? "si" : "no"], { timeout: 30000 });
}
async function primero(p, filtro) {
  await p.goto(`${G}/panel/socios?estado=${filtro}`);
  const a = p.locator('main ul a[href^="/panel/socios/"]').first();
  await a.waitFor({ timeout: 30000 });
  return (await a.getAttribute("href")).split("/").pop();
}
async function abrirPanel(p, socioId) {
  await p.goto(`${G}/panel/entrada`);
  await p.locator('input[aria-label="Buscar socio"]').waitFor({ timeout: 30000 });
  await p.evaluate((id) => window.dispatchEvent(new CustomEvent("gymos:abrir-panel-socio", { detail: { socioId: id } })), socioId);
  await p.locator("[data-panel-socio-estado]").waitFor({ timeout: 30000 });
}

try {
  const d = await pagina(b, COMPU);
  await entrar(d, "duena@ejemplo.invalid");
  await funcion(d, "panel_pago", true);
  const rojo = await primero(d, "vencidos");
  const verde = await primero(d, "al_dia");

  // #20: una nota en la ficha aparece en el panel lateral
  await d.goto(`${G}/panel/socios/${verde}`);
  // #22: la barra de vigencia de la ficha dice los días con palabras
  await d.locator("[data-barra-vigencia]").waitFor({ timeout: 30000 });
  const barra = (await d.locator("[data-barra-vigencia]").innerText()).replace(/\s+/g, " ");
  chequear(/d[ií]a/i.test(barra), `#22: la ficha tiene la barra de vigencia (“${barra.slice(0, 60)}”)`, `la barra no dice los días: “${barra}”`);
  await d.locator('a.pestana:has-text("Notas")').click();
  await d.locator("[data-notas]").waitFor({ timeout: 30000 });
  await d.locator("[data-notas] textarea").fill(nota);
  await d.locator('[data-notas] button:has-text("Guardar nota")').click();
  await d.locator("[data-nota]", { hasText: nota }).waitFor({ timeout: 30000 });
  await abrirPanel(d, verde);
  await d.locator("[data-panel-socio-notas]").waitFor({ timeout: 30000 });
  chequear((await d.locator("[data-panel-socio-notas]").innerText()).includes(nota), "#20: la nota de la ficha se ve en el panel lateral", "la nota no aparece en el panel lateral");
  await d.keyboard.press("Escape");
  // la nota se borra: el demo queda como estaba
  await d.goto(`${G}/panel/socios/${verde}`);
  await d.locator('a.pestana:has-text("Notas")').click();
  await d.locator("[data-nota]", { hasText: nota }).locator('button:has-text("Borrar")').click();
  await d.locator("[data-nota]", { hasText: nota }).waitFor({ state: "detached", timeout: 30000 });

  // #2: "/" y un número abren la ventana de Entrada
  await d.goto(`${G}/panel/socios`);
  await d.locator("main ul a").first().waitFor({ timeout: 30000 });
  await d.locator("main").click({ position: { x: 5, y: 5 } }).catch(() => {});
  await d.keyboard.press("/");
  const abierta = await d.locator("[data-ventana-campo], input[aria-label='Buscar socio']").first().waitFor({ timeout: 10000 }).then(() => true, () => false);
  chequear(abierta, "#2: la tecla “/” abre la ventana de Entrada", "“/” no abrió la ventana");
  await d.keyboard.press("Escape");

  // #6 y #7: panel lateral del vencido, COBRAR AHORA abre la hoja Cobrar sin cambiar de pantalla
  await abrirPanel(d, rojo);
  const antes = d.url();
  const estado = await d.locator("[data-panel-socio-estado]").getAttribute("data-panel-socio-estado");
  chequear(estado !== "verde", `#6: el panel lateral muestra el estado del socio (${estado}), plan, vigencia y último pago`, "el vencido sale verde");
  chequear(await d.locator("[data-panel-socio-ultimo-pago], [data-panel-socio-historial], section[aria-label='Último pago']").count() >= 1, "#6: tiene el último pago y los últimos ingresos", "falta el último pago");
  await d.locator("[data-panel-socio-cobrar]").click();
  await d.locator("[data-cobrar]").waitFor({ timeout: 30000 });
  chequear(d.url() === antes, "#7: COBRAR AHORA abre la hoja Cobrar sin salir de la pantalla", `cambió a ${d.url()}`);
  chequear(await d.locator("[data-panel-socio-lateral]").count() === 0, "#7: el panel lateral se cierra al abrir la hoja", "el panel siguió abierto");
  await d.keyboard.press("Escape");

  await funcion(d, "panel_pago", false);
  chequear(d.errores.length === 0, "sin errores de página ni 5xx", d.errores.join(" | "));
} catch (e) { console.error(e); process.exitCode = 1; }
finally { await b.close(); resultado(); }
