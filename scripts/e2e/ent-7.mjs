#!/usr/bin/env node
// ENT-7 · Llavero o tarjeta: la dueña prende la forma y le asigna un llavero a
// un socio desde la ficha (otro no lo puede tener); el lector lo escribe en
// Entrada y Enter: entra directo ("con llavero"); se quita.
//   npm run e2e:ent-7            (con scripts/local/levantar.sh corriendo)
import { COMPU, GIMNASIO, chequear, entrar, falla, navegador, ok, pagina, resultado } from "./comun.mjs";

const G = GIMNASIO();
const b = await navegador();
const CODIGO = `LL${Date.now().toString().slice(-8)}`;
async function reglas(d) {
  await d.goto(`${G}/panel/configuracion?pestana=reglas`);
  await d.locator('fieldset[data-pestana-activa="reglas"]').waitFor({ timeout: 60000 }); await d.waitForTimeout(500);
}
async function guardar(d) {
  const pie = d.locator('[data-pie="reglas"]'); const k = Number(await pie.getAttribute("data-respuestas"));
  await pie.locator('button:has-text("Guardar")').click();
  await d.waitForFunction((k) => Number(document.querySelector('[data-pie="reglas"]')?.getAttribute("data-respuestas")) > k, k, { timeout: 30000 });
}
async function ficha(d, nombre) {
  await d.goto(`${G}/panel/socios?q=${encodeURIComponent(nombre)}`);
  await d.locator('main ul a[href^="/panel/socios/"]').first().click();
  await d.waitForURL(/\/panel\/socios\/[0-9a-f-]{36}$/);
}
try {
  const d = await pagina(b, COMPU);
  await entrar(d, "duena@ejemplo.invalid");
  await reglas(d);
  const sw = d.locator("[data-accesos] label", { hasText: "Llavero o tarjeta" }).locator("input");
  if (!(await sw.isChecked())) { await sw.click(); await guardar(d); }
  await ficha(d, "Testigo Por Vencer");
  await d.locator('button:has-text("Asignar llavero"), [data-llavero] button:has-text("Cambiar")').first().click();
  await d.locator('input[aria-label="Código del llavero"]').fill(CODIGO.toLowerCase());
  await d.locator('[data-llavero] button:has-text("Guardar")').click();
  await d.locator(`[data-llavero="${CODIGO}"]`).waitFor({ timeout: 30000 });
  ok(`la dueña le asigna el llavero ${CODIGO} desde la ficha`);
  await ficha(d, "Testigo Vencida");
  await d.locator('button:has-text("Asignar llavero"), [data-llavero] button:has-text("Cambiar")').first().click();
  await d.locator('input[aria-label="Código del llavero"]').fill(CODIGO);
  await d.locator('[data-llavero] button:has-text("Guardar")').click();
  await d.getByText("ya es de Testigo Por Vencer").waitFor({ timeout: 30000 });
  ok("el mismo llavero no se le puede dar a otro");

  const r = await pagina(b, COMPU);
  await entrar(r, "recepcion@ejemplo.invalid");
  await r.goto(`${G}/panel/entrada`);
  const buscar = r.locator('input[aria-label="Buscar socio"]');
  await buscar.fill(CODIGO); await buscar.press("Enter");                 // el lector escribe el código y Enter
  const hecho = r.locator("[data-hecho]");
  await hecho.waitFor({ timeout: 30000 });
  chequear(/Testigo Por Vencer/.test(await hecho.innerText()), "con el lector entra directo", `dice: ${await hecho.innerText()}`);
  await r.reload(); await r.locator("[data-hoy]").waitFor();
  chequear(/con llavero/.test(await r.locator("[data-hoy]").innerText()), "en “Hoy” dice “con llavero”", "Hoy no dice llavero");
  await r.locator(`button[aria-label="Anular la entrada de Testigo Por Vencer"]`).first().click();
  await r.locator('input[aria-label="Por qué se anula la entrada"]').fill("Prueba del llavero");
  await r.locator('[data-hoy] button:has-text("Anular")').click();
  if (r.errores.length) falla(`recepción: ${r.errores.join(" | ")}`);

  await ficha(d, "Testigo Por Vencer");
  await d.locator('[data-llavero] button:has-text("Quitar")').click();
  await d.locator('[data-llavero=""]').waitFor({ timeout: 30000 });
  ok("y se quita");
  await reglas(d); await sw.click(); await guardar(d);
  if (d.errores.length) falla(`dueña: ${d.errores.join(" | ")}`);
} catch (e) {
  falla(`se cortó: ${process.env.E2E_DEPURAR ? e.message : e.message.split("\n")[0]}`);
}
await b.close();
resultado();
