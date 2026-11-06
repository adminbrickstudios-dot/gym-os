#!/usr/bin/env node
// APP-8 · Pedir pausa o baja desde la app: el socio pide una pausa (queda
// pendiente) y la baja con su motivo; la dueña lo ve en la campana, abre la
// ficha y lo resuelve ("Se queda", así el demo queda como estaba).
//   npm run e2e:app-8            (con scripts/local/levantar.sh corriendo)
import { CELU, COMPU, GIMNASIO, chequear, entrar, falla, navegador, pagina, resultado } from "./comun.mjs";

const G = GIMNASIO();
const b = await navegador();
const dia = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
try {
  const s = await pagina(b, CELU);
  await entrar(s, "socio@ejemplo.invalid");
  await s.goto(`${G}/app`);
  await s.goto(`${G}/app/yo`);
  await s.locator("[data-yo-fila=cuenta]").click();
  await s.waitForURL(/\/app\/cuenta/, { timeout: 30000 });
  const pausa = s.locator("[data-pedir-pausa]");
  await pausa.waitFor({ timeout: 60000 });
  await pausa.locator('input[type="date"]').nth(0).fill(dia(90));
  await pausa.locator('input[type="date"]').nth(1).fill(dia(100));
  await pausa.getByText("Trabajo").click();
  await pausa.getByRole("button", { name: "Pedir la pausa" }).click();
  const r = await pausa.locator('[role="status"], [role="alert"]').first().textContent({ timeout: 30000 });
  chequear(/el gimnasio lo va a ver|Ya pediste una pausa/.test(r), `pausa: “${r.trim()}”`, r);

  await s.getByRole("button", { name: /Quiero darme de baja/ }).click();
  const baja = s.locator("[data-pedir-baja]");
  await baja.getByText("El precio").click();
  await baja.locator("input:not([type=radio])").fill("Prueba e2e");
  await baja.getByRole("button", { name: "Pedir la baja" }).click();
  // Al guardar, la página se refresca y el formulario pasa a "Pediste la baja" (puede ganarle al mensaje).
  await s.locator("[data-pedido-baja-ok], [data-baja-pendiente]").first().waitFor({ timeout: 30000 });
  chequear(true, "baja pedida: “el gimnasio te va a contactar”");
  await s.reload();
  chequear(await s.locator("[data-baja-pendiente]").isVisible(), "al volver: “Pediste la baja”, sin el formulario");
  const ancho = await s.evaluate(() => document.documentElement.scrollWidth);
  chequear(ancho <= CELU.width, `celular sin desborde (${ancho}px)`, `desborda: ${ancho}`);
  if (s.errores.length) falla(`socio: ${s.errores.join(" | ")}`);

  const d = await pagina(b, COMPU);
  await entrar(d, "duena@ejemplo.invalid");
  await d.goto(`${G}/panel/campana`);
  const item = d.getByRole("link", { name: /pidió la baja/ }).first();
  await item.waitFor({ timeout: 60000 });
  chequear(true, "la dueña: en la campana “… pidió la baja”");
  await item.click();
  const banner = d.locator("[data-pedido-baja]");
  await banner.waitFor({ timeout: 60000 });
  chequear(/Precio/.test(await banner.innerText()) && /Prueba e2e/.test(await banner.innerText()), "en la ficha: el motivo y lo que escribió");
  await banner.getByRole("button", { name: /Se queda/ }).click();
  await banner.waitFor({ state: "detached", timeout: 30000 });
  chequear(true, "“Se queda”: el aviso se va y sigue siendo socio");
  if (d.errores.length) falla(`dueña: ${d.errores.join(" | ")}`);
} catch (e) {
  falla(`se cortó: ${process.env.E2E_DEPURAR ? e.message : e.message.split("\n")[0]}`);
}
await b.close();
resultado();
