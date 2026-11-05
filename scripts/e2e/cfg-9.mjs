#!/usr/bin/env node
// CFG-9 · Aviso de contraste: elegir un color principal que no se lee sobre
// el fondo avisa en el bloque (sin prohibir guardar); uno bueno lo saca.
//   npm run e2e:cfg-9            (con scripts/local/levantar.sh corriendo)
import { CELU, COMPU, GIMNASIO, aparece, capturar, chequear, entrar, falla, navegador, pagina, resultado } from "./comun.mjs";

const G = GIMNASIO();
const b = await navegador();
try {
  const p = await pagina(b, COMPU);
  await entrar(p, "duena@ejemplo.invalid");
  await p.goto(`${G}/panel/configuracion?pestana=marca`);
  await p.locator('fieldset[data-pestana-activa="marca"]').waitFor({ state: "attached", timeout: 30000 });
  await p.locator('[data-pie="marca"]').waitFor({ timeout: 30000 });
  const aviso = p.locator("[data-aviso-contraste]");
  const fondo = (hex) => p.locator(`button[aria-label="${hex}"]`).first();
  const [fondoOrig, acentoOrig] = await p.evaluate(() => [
    document.querySelector('[aria-label="Otro fondo"]')?.value, document.querySelector('[aria-label="Otro color"]')?.value]);

  // Amarillo sobre crema: avisa.
  await fondo("#faf7f0").click();
  await fondo("#f5c518").click();
  chequear(await aparece(aviso), `amarillo sobre crema avisa: “${(await aviso.innerText().catch(() => "")).replace(/\s+/g, " ").slice(0, 70)}…”`, "amarillo sobre crema no avisa");
  await capturar(p, "cfg9-compu-aviso");
  // Violeta sobre crema: se va.
  await fondo("#a78bfa").click();
  const violeta = await aparece(aviso, 1500);
  await p.locator('[aria-label="Otro color"]').fill("#5b21b6");
  chequear(!(await aparece(aviso, 1500)), `violeta oscuro sobre crema no avisa${violeta ? " (el lila claro sí avisaba)" : ""}`, "violeta oscuro sobre crema sigue avisando");
  // "Otro color" gris sobre fondo grafito: avisa.
  await fondo("#14161b").click();
  await p.locator('[aria-label="Otro color"]').fill("#3a3d44");
  chequear(await aparece(aviso), "“Otro color” gris sobre grafito avisa", "gris sobre grafito no avisa");
  // Verde sobre grafito: no avisa.
  await fondo("#2fbf5b").click();
  chequear(!(await aparece(aviso, 1500)), "verde sobre grafito no avisa", "verde sobre grafito avisa");

  // Avisa, pero deja guardar: amarillo sobre crema se guarda y se vuelve al original.
  const pie = p.locator('[data-pie="marca"]');
  const guardar = async () => {
    const n = Number(await pie.getAttribute("data-respuestas"));
    await pie.locator('button:has-text("Guardar")').click();
    await p.waitForFunction((n) => Number(document.querySelector('[data-pie="marca"]')?.getAttribute("data-respuestas")) > n, n, { timeout: 30000 });
    return (await pie.locator(".mensaje").first().innerText()).replace(/\s+/g, " ");
  };
  await fondo("#faf7f0").click(); await fondo("#f5c518").click();
  chequear(/Guardado/.test(await guardar()), "con el aviso, igual se puede guardar", "con el aviso no deja guardar");
  await p.locator('[aria-label="Otro fondo"]').fill(fondoOrig); await p.locator('[aria-label="Otro color"]').fill(acentoOrig);
  await guardar();
  if (p.errores.length) falla(`dueña: ${p.errores.join(" | ")}`);
  await p.context().close();

  // Celular: el aviso entra sin desborde.
  const c = await pagina(b, CELU);
  await entrar(c, "duena@ejemplo.invalid");
  await c.goto(`${G}/panel/configuracion?pestana=marca`);
  await c.locator('[data-pie="marca"]').waitFor({ timeout: 30000 });
  await c.locator('button[aria-label="#faf7f0"]').first().click();
  await c.locator('button[aria-label="#f5c518"]').first().click();
  await c.locator("[data-aviso-contraste]").scrollIntoViewIfNeeded();
  const ancho = await c.evaluate(() => document.documentElement.scrollWidth);
  chequear(ancho <= CELU.width, `celular: el aviso entra sin desborde (${ancho}px)`, `celular: mide ${ancho}px`);
  await capturar(c, "cfg9-celu-aviso");
  await c.context().close();
} catch (e) {
  falla(`se cortó: ${process.env.E2E_DEPURAR ? e.message : e.message.split("\n")[0]}`);
}
await b.close();
resultado();
