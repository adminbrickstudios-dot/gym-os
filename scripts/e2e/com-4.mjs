#!/usr/bin/env node
// COM-4 · Tareas del equipo: la dueña, desde la ficha de un socio, le anota a
// Ana (recepción) "llamarlo" para hoy → Ana la ve en su Inicio y la marca
// hecha → la dueña la ve en "De todo el equipo", hecha por Ana. En el celular.
//   npm run e2e:com-4            (con scripts/local/levantar.sh corriendo)
import { CELU, COMPU, GIMNASIO, aparece, capturar, chequear, entrar, falla, navegador, ok, pagina, resultado } from "./comun.mjs";

const G = GIMNASIO();
const s = Date.now().toString().slice(-5);
const QUE = `Llamarlo por la pausa ${s}`;
const b = await navegador();
try {
  const d = await pagina(b, COMPU);
  d.setDefaultNavigationTimeout(120000);
  await entrar(d, "duena@ejemplo.invalid");
  await d.goto(`${G}/panel/socios?q=Testigo`);
  const ficha = await d.locator('main a[href^="/panel/socios/"]').filter({ hasText: /Testigo/ }).first().getAttribute("href", { timeout: 60000 });
  await d.goto(`${G}${ficha}`);
  await d.getByRole("link", { name: /Anotar una tarea sobre este socio/ }).click();
  await d.waitForURL(/\/panel\/tareas\?socio=/, { timeout: 60000 });
  const form = d.locator("[data-nueva-tarea]");
  await form.waitFor({ timeout: 60000 });
  await form.locator("input").first().fill(QUE);
  const ana = await form.locator("select option", { hasText: "Ana" }).first().getAttribute("value");
  await form.locator("select").selectOption(ana);
  await form.locator('button[type="submit"]').click();
  await form.getByText("Tarea anotada").waitFor({ timeout: 30000 });
  ok("desde la ficha: “📌 Anotar una tarea” para Ana, hoy, sobre el socio");

  const r = await pagina(b, CELU);
  r.setDefaultNavigationTimeout(120000);
  await entrar(r, "recepcion@ejemplo.invalid");
  await r.locator("h1").first().waitFor({ timeout: 60000 });
  const enInicio = r.locator("[data-tareas-inicio] li", { hasText: QUE });
  chequear(await aparece(enInicio, 30000), "Ana la ve en su Inicio: “📌 Tus tareas de hoy”", "la tarea no aparece en el Inicio de Ana");
  await enInicio.getByRole("button", { name: /Marcar hecha/ }).click();
  await r.locator(`[data-tarea="hecha"]`, { hasText: QUE }).waitFor({ timeout: 30000 });
  const w = await r.evaluate(() => document.documentElement.scrollWidth);
  chequear(w <= CELU.width + 1, "la marca hecha desde el celular (sin desbordes)", `se desborda: ${w}px`);
  await capturar(r, "com4-celu-inicio");

  await d.goto(`${G}/panel/tareas?todas=1`);
  const fila = d.locator("li", { hasText: QUE });
  chequear(await aparece(fila, 60000) && /hecha por Ana/.test(await fila.innerText()), "la dueña la ve en “De todo el equipo”, hecha por Ana", `dice: ${await fila.innerText().catch(() => "nada")}`);
  for (const p of [d, r]) if (p.errores.length) falla(p.errores.join(" | "));
} catch (e) {
  falla(`se cortó: ${process.env.E2E_DEPURAR ? e.message : e.message.split("\n")[0]}`);
}
await b.close();
resultado();
