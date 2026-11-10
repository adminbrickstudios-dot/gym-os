#!/usr/bin/env node
// VD-46N · "No escribirle" por socio.
// La recepción marca con motivo; la ficha muestra la marca; la recepción no puede sacarla (la saca la dueña con motivo);
// el celular no se desborda.
//   node scripts/e2e/vd-46n.mjs     (con scripts/local/levantar.sh corriendo)
import { CELU, COMPU, GIMNASIO, capturar, chequear, entrar, navegador, ok, pagina, resultado } from "./comun.mjs";
import { elegirPlan } from "./alta.mjs";

const G = GIMNASIO();
const b = await navegador();
const s5 = Date.now().toString().slice(-5);
try {
  const d = await pagina(b, COMPU);
  await entrar(d, "duena@ejemplo.invalid");
  await d.goto(`${G}/panel/socios/nuevo`);
  await d.locator('input[name="nombre"]').fill(`NoEscr${s5}`);
  await elegirPlan(d, 0);
  await d.locator('button:has-text("Solo dar de alta")').click();
  await d.waitForURL(/\/panel\/socios\/[0-9a-f-]{36}/, { timeout: 30000 });
  const id = new URL(d.url()).pathname.split("/").pop();
  ok(`socio de prueba creado (${id.slice(0, 8)})`);

  // La recepción marca, con motivo.
  const r = await pagina(b, COMPU);
  await entrar(r, "recepcion@ejemplo.invalid");
  await r.goto(`${G}/panel/socios/${id}`);
  await r.locator("[data-no-escribirle-abrir]").click();
  chequear(await r.locator('button:has-text("No escribirle")').last().isDisabled(), "no se marca sin motivo", "se puede marcar sin motivo");
  await r.locator('input[placeholder^="Ej.: lo pidió"]').fill("Lo pidió en la recepción");
  await r.locator('button:has-text("No escribirle")').last().click();
  await r.locator("[data-no-escribirle-marca]").waitFor({ timeout: 30000 });
  ok("la recepción marcó “No escribirle” con motivo y la ficha muestra la marca");
  chequear((await r.locator("[data-no-escribirle-abrir]").count()) === 0, "la recepción no puede sacar la marca", "la recepción ve “Volver a escribirle”");

  // La dueña la saca con motivo.
  await d.goto(`${G}/panel/socios/${id}`);
  await d.locator("[data-no-escribirle-marca]").waitFor({ timeout: 30000 });
  await d.locator("[data-no-escribirle-abrir]").click();
  await d.locator('input[placeholder^="Ej.: pidió"]').fill("Pidió volver a recibir mensajes");
  await d.locator('button:has-text("Volver a escribirle")').last().click();
  await d.locator("[data-no-escribirle-marca]").waitFor({ state: "detached", timeout: 30000 });
  ok("la dueña sacó la marca con motivo");

  // Celular: la ficha marcada no se desborda.
  await d.locator("[data-no-escribirle-abrir]").click();
  await d.locator('input[placeholder^="Ej.: lo pidió"]').fill("Prueba de celular");
  await d.locator('button:has-text("No escribirle")').last().click();
  await d.locator("[data-no-escribirle-marca]").waitFor({ timeout: 30000 });
  const m = await pagina(b, CELU);
  await entrar(m, "duena@ejemplo.invalid");
  await m.goto(`${G}/panel/socios/${id}`);
  await m.locator("[data-no-escribirle-marca]").waitFor({ timeout: 30000 });
  const ancho = await m.evaluate(() => document.documentElement.scrollWidth);
  chequear(ancho <= 391, "celular 390 px sin desborde", `desborda: ${ancho}px`);
  await capturar(m, "vd46n-celu-ficha");
  for (const p of [d, r, m]) chequear(p.errores.length === 0, "sin errores de página", p.errores.join(" | "));
} finally {
  await b.close();
}
resultado();
