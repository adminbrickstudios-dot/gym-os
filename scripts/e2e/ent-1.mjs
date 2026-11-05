#!/usr/bin/env node
// ENT-1 · Veredicto a pantalla completa, sonido y teclado: el color ocupa la
// pantalla; Enter anota si puede entrar (y si no, no hace nada); Esc vuelve a
// buscar con foco; escribir con el veredicto abierto arranca otra búsqueda
// (el lector de DNI sigue andando); suena distinto por color y se apaga.
//   npm run e2e:ent-1            (con scripts/local/levantar.sh corriendo)
import { CELU, COMPU, GIMNASIO, capturar, chequear, entrar, falla, navegador, ok, pagina, resultado } from "./comun.mjs";

const G = GIMNASIO();
const b = await navegador();
async function primero(p, estado) {
  await p.goto(`${G}/panel/socios?estado=${estado}`);
  const a = p.locator('main ul a[href^="/panel/socios/"]').first();
  await a.waitFor({ timeout: 30000 });
  return (await a.locator(".font-semibold").first().innerText()).replace(/#\d+/, "").trim();
}
try {
  const r = await pagina(b, COMPU);
  // Cuenta los sonidos (AudioContext) sin parlantes.
  await r.addInitScript(() => {
    window.__sonidos = [];
    const Orig = window.AudioContext;
    window.AudioContext = class extends Orig { createOscillator() { const o = super.createOscillator(); const st = o.start.bind(o); o.start = (t) => { window.__sonidos.push(o.frequency.value); return st(t); }; return o; } };
  });
  await entrar(r, "recepcion@ejemplo.invalid");
  const verde = await primero(r, "al_dia"), rojo = await primero(r, "vencidos");
  await r.goto(`${G}/panel/entrada`);
  const buscar = r.locator('input[aria-label="Buscar socio"]');
  await buscar.waitFor({ timeout: 30000 });
  if ((await r.locator("[data-sonido]").getAttribute("data-sonido")) === "no") await r.locator("[data-sonido]").click();

  // Rojo: pantalla completa, Enter no anota, Esc vuelve.
  await buscar.fill(rojo);
  await r.locator("button.fila", { hasText: rojo }).first().waitFor({ timeout: 15000 });
  await buscar.press("Enter");
  const ver = r.locator("[data-veredicto]");
  await ver.waitFor({ timeout: 30000 });
  const caja = await ver.boundingBox();
  chequear(caja.width >= COMPU.width - 20 && caja.height >= COMPU.height - 20, `el color ocupa la pantalla (${Math.round(caja.width)}×${Math.round(caja.height)})`, `mide ${caja.width}×${caja.height}`);
  await capturar(r, "ent1-compu-rojo");
  await r.waitForTimeout(400);
  const sonRojo = await r.evaluate(() => window.__sonidos.slice());
  chequear(sonRojo.length === 2 && sonRojo[0] < 300, `rojo suena grave y doble (${sonRojo.join(", ")} Hz)`, `sonó ${sonRojo.join(", ")}`);
  await r.keyboard.press("Enter");
  await r.waitForTimeout(800);
  chequear(await r.locator('[data-hecho]').count() === 0, "rojo: Enter no anota nada", "Enter anotó a un rojo");
  await r.keyboard.press("Escape");
  await ver.waitFor({ state: "detached", timeout: 10000 });
  chequear(await buscar.evaluate((e) => e === document.activeElement && e.value === ""), "Esc vuelve a buscar, con foco", "Esc no volvió al buscador");

  // Verde: Enter anota.
  await buscar.fill(verde);
  await r.locator("button.fila", { hasText: verde }).first().waitFor({ timeout: 15000 });
  await buscar.press("Enter");
  await r.locator('[data-veredicto="verde"]').waitFor({ timeout: 30000 });
  await r.waitForTimeout(400);
  const sonVerde = (await r.evaluate(() => window.__sonidos.slice())).slice(sonRojo.length);
  chequear(sonVerde.length === 1 && sonVerde[0] > 800, `verde suena agudo y corto (${sonVerde.join(", ")} Hz)`, `sonó ${sonVerde.join(", ")}`);
  await r.keyboard.press("Enter");
  await r.locator("[data-hecho]").waitFor({ timeout: 30000 });
  chequear(await buscar.evaluate((e) => e === document.activeElement), `verde: Enter anota (“Entró ${verde}”) y el foco vuelve al buscador`, "el foco no volvió");
  await r.locator('[data-hecho] button:has-text("Deshacer")').click();     // no dejar la prueba anotada

  // Escribir con el veredicto abierto arranca otra búsqueda.
  await buscar.fill(rojo);
  await r.locator("button.fila", { hasText: rojo }).first().click();
  await ver.waitFor({ timeout: 30000 });
  await r.locator('[data-veredicto] button:has-text("Dejar pasar igual")').focus();   // el foco en otro lado, como después de un clic
  await r.keyboard.type(verde.slice(0, 4));
  await ver.waitFor({ state: "detached", timeout: 10000 });
  chequear(await buscar.inputValue() === verde.slice(0, 4), `escribir con el veredicto abierto busca de nuevo (“${verde.slice(0, 4)}”)`, `quedó “${await buscar.inputValue()}”`);

  // Sin sonido, y queda así al volver.
  await r.locator("[data-sonido]").click();
  await r.reload();
  await r.locator('[data-sonido="no"]').waitFor({ timeout: 30000 });
  const antes = await r.evaluate(() => window.__sonidos.length);
  await buscar.fill(rojo);
  await r.locator("button.fila", { hasText: rojo }).first().click();
  await ver.waitFor({ timeout: 30000 });
  await r.waitForTimeout(400);
  chequear(await r.evaluate(() => window.__sonidos.length) === antes, "🔇 se apaga y queda apagado en esta compu", "sonó igual");
  await r.keyboard.press("Escape");
  await r.locator("[data-sonido]").click();
  if (r.errores.length) falla(`compu: ${r.errores.join(" | ")}`);
  await r.context().close();

  const c = await pagina(b, CELU);
  await entrar(c, "recepcion@ejemplo.invalid");
  await c.goto(`${G}/panel/entrada`);
  await c.locator('input[aria-label="Buscar socio"]').fill(rojo);
  await c.locator("button.fila", { hasText: rojo }).first().click();
  await c.locator("[data-veredicto]").waitFor({ timeout: 30000 });
  const ancho = await c.evaluate(() => document.documentElement.scrollWidth);
  const botones = await c.locator('[data-veredicto] a:has-text("Cobrar")').isVisible();
  chequear(ancho <= CELU.width && botones, `celular: pantalla completa sin desborde y con “Cobrar” a mano (${ancho}px)`, `ancho ${ancho}, cobrar ${botones}`);
  await capturar(c, "ent1-celu-rojo");
  ok("listo");
} catch (e) {
  falla(`se cortó: ${process.env.E2E_DEPURAR ? e.message : e.message.split("\n")[0]}`);
}
await b.close();
resultado();
