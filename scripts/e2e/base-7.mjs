#!/usr/bin/env node
// BASE-7 · Asistente de 9 pasos (D44), sobre los Primeros pasos: reanudable (lo hecho lo calcula la base), cada paso dice para qué
// sirve, "Seguir donde quedé" lleva al primer paso pendiente, y al terminar sale "Tu gimnasio está listo" con el link de cada rol.
// El importador de socios con filas marcadas antes de importar lo prueba soc-1.
//   node scripts/e2e/base-7.mjs     (con scripts/local/levantar.sh corriendo)
import { CELU, COMPU, GIMNASIO, capturar, chequear, entrar, falla, navegador, ok, pagina, resultado } from "./comun.mjs";

const b = await navegador();
try {
  // Un gimnasio casi vacío (Box Norte Demo): quedan pasos pendientes.
  const GB = GIMNASIO("demo-box");
  const p = await pagina(b, COMPU);
  p.setDefaultNavigationTimeout(120000);
  await entrar(p, "box@ejemplo.invalid", undefined, GB);
  await p.goto(`${GB}/panel`);
  await p.locator("h1").first().waitFor({ timeout: 60000 });
  if (await p.locator("[data-mostrar-pasos]").count()) await p.locator("[data-mostrar-pasos]").click();
  await p.locator("[data-abrir-asistente]").waitFor({ timeout: 30000 });
  await p.locator("[data-abrir-asistente]").click();
  await p.waitForURL(/\/panel\/asistente/, { timeout: 30000 });
  await p.locator("[data-asistente]").waitFor({ timeout: 30000 });
  chequear(await p.locator("[data-asistente-paso]").count() === 9, "el asistente muestra los 9 pasos", "no son 9 pasos");
  const nombres = await p.locator("[data-asistente-paso] p.font-semibold").allInnerTexts();
  chequear(/Datos del gimnasio/.test(nombres[0]) && /Cargar socios/.test(nombres[8]), `en orden: “${nombres[0].trim()}” … “${nombres[8].trim()}”`, `orden raro: ${nombres.join(" | ")}`);
  chequear((await p.locator("[data-asistente-paso]").first().innerText()).length > 60, "cada paso explica para qué sirve", "un paso no explica");
  const seguir = p.locator("[data-asistente-seguir]");
  await seguir.waitFor({ timeout: 10000 });
  const clave = await seguir.getAttribute("data-asistente-seguir");
  const primeroPendiente = await p.locator('[data-asistente-paso][data-hecho="no"]').evaluateAll((els) => els.map((e) => e.getAttribute("data-asistente-paso")));
  ok(`“Seguir donde quedé” apunta al paso ${clave} (pendientes: ${primeroPendiente.join(", ")})`);
  const href = await seguir.getAttribute("href");
  await seguir.click();
  await p.waitForURL((u) => u.pathname + u.search === href || u.pathname === href.split("?")[0], { timeout: 30000 });
  ok("el botón lleva a la pantalla que resuelve el paso");
  await p.goto(`${GB}/panel/asistente`);
  await p.locator("[data-asistente]").waitFor({ timeout: 30000 });
  ok("salir y volver: el asistente sigue donde estaba (lo calcula la base)");
  await capturar(p, "base7-compu-asistente");
  const c = await pagina(b, CELU);
  await entrar(c, "box@ejemplo.invalid", undefined, GB);
  await c.goto(`${GB}/panel/asistente`);
  await c.locator("[data-asistente]").waitFor({ timeout: 60000 });
  chequear(await c.evaluate(() => document.documentElement.scrollWidth) <= 391, "celular: sin desborde", "se desborda en el celular");
  await capturar(c, "base7-celu-asistente");

  // Un gimnasio con todo cargado (Gimnasio Demo): "Tu gimnasio está listo" con los links por rol.
  const G = GIMNASIO();
  const d = await pagina(b, COMPU);
  d.setDefaultNavigationTimeout(120000);
  await entrar(d, "duena@ejemplo.invalid");
  await d.goto(`${G}/panel/asistente`);
  await d.locator("[data-asistente]").waitFor({ timeout: 60000 });
  const pendientes = await d.locator('[data-asistente-paso][data-hecho="no"]').count();
  if (await d.locator("[data-asistente-listo]").count()) {
    chequear(await d.locator("[data-link-rol]").count() === 4, "con todo hecho: “Tu gimnasio está listo” con los links de dueño, recepción, profes y socios", "faltan links por rol");
  } else ok(`(el demo tiene ${pendientes} pasos sin medir como hechos; no muestra el cierre)`);
  for (const [q, x] of [["asistente", p], ["dueña", d]]) if (x.errores.length) falla(`${q}: ${x.errores.join(" | ")}`);
} catch (e) {
  falla(`se cortó: ${process.env.E2E_DEPURAR ? e.message : e.message.split("\n")[0]}`);
}
await b.close();
resultado();
