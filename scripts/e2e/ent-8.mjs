#!/usr/bin/env node
// ENT-8 · Control de la puerta: la dueña deja pasar a alguien y anula una
// entrada; en "Control de la puerta" ve a quién, quién y por qué, y la cuenta
// por persona; navega de semana; la recepción no lo ve.
//   npm run e2e:ent-8            (con scripts/local/levantar.sh corriendo)
import { COMPU, GIMNASIO, capturar, chequear, entrar, falla, navegador, ok, pagina, resultado } from "./comun.mjs";

const G = GIMNASIO();
const b = await navegador();
const s5 = Date.now().toString().slice(-5);
try {
  const d = await pagina(b, COMPU);
  await entrar(d, "duena@ejemplo.invalid");
  // Uno nuevo sin plan: no puede entrar.
  await d.goto(`${G}/panel/socios/nuevo`);
  await d.locator('input[name="nombre"]').fill(`Control${s5}`);
  await d.locator('button:has-text("Dar de alta")').first().click();
  await d.waitForURL(/\/panel\/socios\/[0-9a-f-]{36}$/, { timeout: 30000 });
  await d.goto(`${G}/panel/entrada`);
  await d.locator('input[aria-label="Buscar socio"]').fill(`Control${s5}`);
  await d.locator("button.fila", { hasText: `Control${s5}` }).first().click();
  await d.locator('[data-veredicto] button:has-text("Dejar pasar igual")').click();
  await d.locator('input[aria-label="Motivo para dejar pasar"]').fill(`Prueba ${s5}`);
  await d.locator('[data-dejar-pasar] button.boton-peligro').click();
  await d.locator('[data-hecho="forzado"]').waitFor({ timeout: 30000 });
  await d.locator('[data-hecho] button:has-text("Deshacer")').click();          // y la anula
  await d.locator("[data-hecho]").waitFor({ state: "detached", timeout: 30000 });
  ok("la dueña deja pasar a alguien y después lo deshace");

  await d.locator('main a:has-text("Control de la puerta")').click();
  await d.waitForURL(/\/panel\/entrada\/control/);
  const forz = d.locator("[data-forzados] li", { hasText: `Control${s5}` });
  await forz.waitFor({ timeout: 30000 });
  chequear(new RegExp(`“Prueba ${s5}”[\\s\\S]*después se anuló`).test(await forz.innerText()), "ve a quién dejaron pasar, el motivo y que se anuló", `dice: ${await forz.innerText()}`);
  chequear(await d.locator("[data-anuladas] li", { hasText: `Control${s5}` }).count() === 1, "y la anulación, con quién y por qué", "no está la anulación");
  chequear(await d.locator("[data-por-persona] li").count() >= 1, "la cuenta por persona del equipo", "no hay cuenta por persona");
  await capturar(d, "ent8-compu-control");
  const semana = await d.locator("[data-semana]").getAttribute("data-semana");
  await d.locator('a:has-text("Anterior")').click();
  await d.waitForFunction((s) => document.querySelector("[data-semana]")?.getAttribute("data-semana") !== s, semana, { timeout: 30000 });
  ok("◀ Anterior muestra la semana de antes");
  if (d.errores.length) falla(`dueña: ${d.errores.join(" | ")}`);

  const r = await pagina(b, COMPU);
  await entrar(r, "recepcion@ejemplo.invalid");
  await r.goto(`${G}/panel/entrada`);
  await r.locator('input[aria-label="Buscar socio"]').waitFor();
  chequear(await r.locator('main a:has-text("Control de la puerta")').count() === 0, "la recepción no ve el botón", "la recepción ve Control");
  await r.goto(`${G}/panel/entrada/control`);
  chequear(await r.getByText("No tenés acceso").count() > 0, "y por la dirección directa: “No tenés acceso”", "la recepción abre el control");
} catch (e) {
  falla(`se cortó: ${process.env.E2E_DEPURAR ? e.message : e.message.split("\n")[0]}`);
}
await b.close();
resultado();
