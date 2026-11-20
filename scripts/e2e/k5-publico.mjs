#!/usr/bin/env node
// K5 (paneles completos, 19/11) · Pasada de capturas de lo que ve el visitante: la página del gimnasio y /hacete-socio,
// en compu y en celular (el estilo lo pone la corrida: estilo=clasico o estilo=pista en pruebas-completas).
// En cada una: abre sin romperse, sin errores de página, sin desborde a lo ancho, con lo principal a la vista
// (el nombre, entrar, crear la cuenta; en el alta, los pasos con nombre) y deja la captura entera para mirarla.
//   node scripts/e2e/k5-publico.mjs     (con scripts/local/levantar.sh corriendo)
import { CELU, COMPU, GIMNASIO, PANTALLA_ROTA, capturar, chequear, falla, navegador, ok, pagina, resultado } from "./comun.mjs";

const G = GIMNASIO();
const b = await navegador();
const estilo = process.env.E2E_SIN_MAYUSCULAS === "1" ? "pista" : "clasico";

try {
  for (const [tam, vista] of [["compu", COMPU], ["celu", CELU]]) {
    const p = await pagina(b, vista);

    // ── La página del gimnasio ──
    await p.goto(`${G}/`);
    await p.locator("[data-nombre-gimnasio]").waitFor({ timeout: 60000 });
    chequear(!PANTALLA_ROTA.test(await p.locator("body").innerText()), `${tam} · la página abre sin romperse`, `${tam} · la página muestra un error`);
    chequear(await p.locator("[data-ya-soy-socio]").count() >= 1, `${tam} · la página ofrece “Ya soy socio, entrar”`, `${tam} · la página no ofrece entrar`);
    let ancho = await p.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
    chequear(ancho[0] <= ancho[1], `${tam} · la página sin desborde a lo ancho`, `${tam} · la página desborda: ${ancho[0]} > ${ancho[1]}`);
    await capturar(p, `k5-${estilo}-${tam}-pagina`, true);

    // ── /hacete-socio ──
    await p.goto(`${G}/hacete-socio`);
    await p.locator("main").first().waitFor({ timeout: 60000 });
    await p.locator("[data-form-alta], [data-altas-cerradas], h1").first().waitFor({ timeout: 60000 });
    const texto = await p.locator("body").innerText();
    chequear(!PANTALLA_ROTA.test(texto), `${tam} · /hacete-socio abre sin romperse`, `${tam} · /hacete-socio muestra un error`);
    if (await p.locator("[data-form-alta]").count()) {
      const pasos = await p.locator("[data-pasos-alta] a").allInnerTexts();
      chequear(pasos.length >= 1 && pasos.every((x) => /\d\.\s*\S/.test(x)), `${tam} · /hacete-socio con los pasos con nombre (${pasos.join(" / ")})`, `${tam} · /hacete-socio sin pasos: ${pasos.join("|")}`);
    } else ok(`${tam} · /hacete-socio con las altas apagadas: dice cómo anotarse (${texto.replace(/\s+/g, " ").slice(0, 80)})`);
    ancho = await p.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
    chequear(ancho[0] <= ancho[1], `${tam} · /hacete-socio sin desborde a lo ancho`, `${tam} · /hacete-socio desborda: ${ancho[0]} > ${ancho[1]}`);
    await capturar(p, `k5-${estilo}-${tam}-hacete-socio`, true);

    if (p.errores.length) falla(`${tam}: ${p.errores.join(" | ")}`);
    else ok(`${tam} · sin errores de página`);
    await p.context().close();
  }
} catch (e) {
  falla(`se cortó: ${e.message.split("\n")[0]}`);
}
await b.close();
resultado();
