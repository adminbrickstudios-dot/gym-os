#!/usr/bin/env node
// AVI-5 · La campana: el 🔔 con lo nuevo, la lista con el link a resolver, y
// al volver lo visto ya no cuenta. El socio tiene la suya en la app.
//   npm run e2e:avi-5            (con scripts/local/levantar.sh corriendo)
import { CELU, COMPU, GIMNASIO, capturar, chequear, entrar, falla, navegador, ok, pagina, resultado } from "./comun.mjs";

const G = GIMNASIO();
const b = await navegador();
try {
  const d = await pagina(b, COMPU);
  await entrar(d, "duena@ejemplo.invalid");
  await d.goto(`${G}/panel`);
  const campana = d.locator("a[data-campana]");
  await d.waitForFunction(() => document.querySelector("a[data-campana]")?.getAttribute("data-campana") !== "", null, { timeout: 30000 });
  const n = Number(await campana.getAttribute("data-campana"));
  ok(`el 🔔 en Inicio dice ${n} sin ver (se pide después de pintar)`);
  await campana.click();
  await d.waitForURL(/\/panel\/campana$/, { timeout: 30000 });
  await d.locator("main h1").waitFor({ timeout: 60000 });
  const nuevas = await d.locator('[data-novedad="nueva"]').count();
  chequear(nuevas === n, `la lista tiene las ${n} nuevas, cada una con su link`, `lista ${nuevas} · campana ${n}`);
  if (nuevas) {
    const href = await d.locator('[data-novedad="nueva"] a').first().getAttribute("href");
    chequear(/^\/panel/.test(href), `lleva a resolverla (${href})`, href);
  }
  await d.waitForTimeout(1500);   // lo nuevo pasa a visto al abrir
  await d.reload();
  await d.locator("main h1").waitFor({ timeout: 60000 });
  chequear(await d.locator('[data-novedad="nueva"]').count() === 0, "al volver, lo de antes está en “Ya visto”", `quedan ${await d.locator('[data-novedad="nueva"]').count()} nuevas`);
  await d.waitForFunction(() => document.querySelector("a[data-campana]")?.getAttribute("data-campana") === "0", null, { timeout: 30000 });
  ok("el 🔔 vuelve a cero");
  if (d.errores.length) falla(`dueña: ${d.errores.join(" | ")}`);

  const p = await pagina(b, CELU);
  await entrar(p, "profe@ejemplo.invalid");
  await p.goto(`${G}/panel/campana`);
  await p.locator("main h1").waitFor({ timeout: 60000 });
  chequear(!/\$/.test(await p.locator("main").innerText()), "el profe no ve nada de plata", "ve montos");
  const ancho = await p.evaluate(() => document.documentElement.scrollWidth);
  chequear(ancho <= CELU.width, `celular sin desborde (${ancho}px)`, `desborda: ${ancho}`);
  await capturar(p, "avi5-celu-profe");

  const s = await pagina(b, CELU);
  await entrar(s, "socio@ejemplo.invalid");
  await s.goto(`${G}/app`);
  const bs = s.locator("a[data-campana]");
  await bs.waitFor({ timeout: 60000 });
  const sinVer = await bs.getAttribute("data-campana");
  await bs.click();
  await s.waitForURL(/\/app\/novedades/, { timeout: 30000 });
  await s.getByRole("heading", { name: /Novedades/ }).waitFor({ timeout: 30000 });
  ok(`el socio tiene su 🔔 (${sinVer} sin ver) y sus novedades`);
  await capturar(s, "avi5-celu-socio");
  if (s.errores.length) falla(`socio: ${s.errores.join(" | ")}`);
} catch (e) {
  falla(`se cortó: ${process.env.E2E_DEPURAR ? e.message : e.message.split("\n")[0]}`);
}
await b.close();
resultado();
