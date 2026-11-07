#!/usr/bin/env node
// VD-46H · Detector de datos de salud: en una nota de la ficha, "operado de rodilla" avisa y no deja
// guardar; "operación de caja" guarda. Lo mismo en la nota del alta y en una tarea.
//   node scripts/e2e/vd-46h.mjs     (con scripts/local/levantar.sh corriendo)
import { COMPU, GIMNASIO, chequear, entrar, falla, navegador, pagina, resultado } from "./comun.mjs";

const G = GIMNASIO();
const b = await navegador();
try {
  const p = await pagina(b, COMPU);
  await entrar(p, "duena@ejemplo.invalid");
  await p.goto(`${G}/panel/socios`);
  const fila = p.locator('main a[href^="/panel/socios/"]', { hasText: "Al día" }).first();
  await fila.waitFor({ timeout: 30000 });
  const ficha = new URL(await fila.getAttribute("href"), G).toString();
  await p.goto(`${ficha}?pestana=notas`);
  await p.locator("[data-notas]").waitFor({ timeout: 30000 });
  const area = p.locator("[data-notas] textarea");
  const guardar = p.locator('[data-notas] button:has-text("Guardar nota")');
  await area.fill("operado de rodilla");
  chequear(await p.locator("[data-notas] [data-aviso-salud-detectado]").isVisible(), "la nota con “operado de rodilla” muestra el aviso", "sin aviso");
  chequear(await guardar.isDisabled(), "y no deja guardar", "dejó guardar un dato de salud");
  await area.fill("tiene diabetes");
  chequear(await guardar.isDisabled(), "“tiene diabetes” tampoco", "dejó guardar diabetes");
  await area.fill(`operación de caja ${Date.now().toString().slice(-5)}`);
  chequear(!(await guardar.isDisabled()) && (await p.locator("[data-notas] [data-aviso-salud-detectado]").count()) === 0, "“operación de caja” no avisa", "falso positivo");
  await guardar.click();
  await p.locator("[data-nota]", { hasText: "operación de caja" }).first().waitFor({ timeout: 30000 });
  chequear(true, "la nota limpia se guarda", "");

  await p.goto(`${G}/panel/socios/nuevo`);
  await p.locator('textarea[name="notas"]').fill("lesionado del hombro");
  chequear(await p.locator("[data-aviso-salud-detectado]").first().isVisible(), "el alta avisa en las notas", "el alta no avisa");

  if (p.errores.length) falla(`errores: ${p.errores.join(" | ")}`);
} finally {
  await b.close();
}
resultado();
