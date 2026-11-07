#!/usr/bin/env node
// VD-36 · App del socio en 4 pestañas (Inicio · Clases · Rutina · Yo), limpia:
// las pestañas salen de la base; Yo junta plan, pagos, novedades y membresía;
// cada pantalla vieja sigue accesible y sin desborde en celular.
//   node scripts/e2e/vd-36.mjs     (con scripts/local/levantar.sh corriendo)
import { CELU, GIMNASIO, capturar, chequear, entrar, falla, navegador, pagina, resultado } from "./comun.mjs";

const G = GIMNASIO();
const b = await navegador();
const sinDesborde = async (p, donde) => {
  const ancho = await p.evaluate(() => document.documentElement.scrollWidth);
  chequear(ancho <= CELU.width, `${donde}: sin desborde (${ancho}px)`, `${donde} desborda: ${ancho}px`);
};
try {
  const s = await pagina(b, CELU);
  await entrar(s, "socio@ejemplo.invalid");
  await s.goto(`${G}/app`);
  const nav = s.locator("[data-nav-socio]");
  await nav.waitFor({ timeout: 60000 });
  const claves = (await nav.getAttribute("data-nav-socio")).split(",");
  chequear(claves[0] === "inicio" && claves.at(-1) === "yo" && claves.length >= 2 && claves.length <= 4, `pestañas: ${claves.join(" · ")}`, `pestañas raras: ${claves}`);
  chequear(await nav.locator("a[aria-current=page]").getAttribute("data-pestana") === "inicio", "en el inicio, la pestaña activa es Inicio", "no marca Inicio");
  await sinDesborde(s, "inicio");
  await capturar(s, "vd36-celu-inicio");

  // Cada pestaña que hay abre su pantalla; la que no hay (gimnasio sin esa sección) no está.
  for (const [clave, ruta] of [["clases", /\/app\/clases/], ["rutina", /\/app\/rutina/], ["yo", /\/app\/yo/]]) {
    if (!claves.includes(clave)) { chequear(await nav.locator(`[data-pestana=${clave}]`).count() === 0, `sin “${clave}” en el gimnasio: la pestaña no está`, `hay pestaña ${clave}`); continue; }
    await nav.locator(`[data-pestana=${clave}]`).click();
    await s.waitForURL(ruta, { timeout: 30000 });
    await s.locator("main h1").first().waitFor({ timeout: 60000 });
    chequear(await s.locator("[data-nav-socio] a[aria-current=page]").getAttribute("data-pestana") === clave, `pestaña ${clave}: queda marcada`, `no marca ${clave}`);
    await sinDesborde(s, clave);
    if (clave === "yo") await capturar(s, "vd36-celu-yo");
  }

  // Yo: el plan y las pantallas de antes, todas accesibles.
  await s.goto(`${G}/app/yo`);
  await s.locator("[data-mi-plan]").waitFor({ timeout: 60000 });
  for (const [fila, destino] of [["historial", /\/app\/historial/], ["novedades", /\/app\/novedades/], ["cuenta", /\/app\/cuenta/]]) {
    await s.locator(`[data-yo-fila=${fila}]`).click();
    await s.waitForURL(destino, { timeout: 30000 });
    await s.locator("main h1").waitFor({ timeout: 60000 });
    chequear(await s.locator("[data-nav-socio] a[aria-current=page]").getAttribute("data-pestana") === "yo", `Yo → ${fila}: la pestaña sigue en Yo`, `${fila} no marca Yo`);
    await sinDesborde(s, `Yo → ${fila}`);
    await s.goto(`${G}/app/yo`);
    await s.locator("[data-mi-plan]").waitFor({ timeout: 60000 });
  }
  chequear(await s.locator("[data-yo-mas]").count() === 1, "Yo tiene la sección “Más”", "falta “Más”");
  chequear(await s.locator('a[download][href^="/app/mis-datos"]').count() === 1, "Yo → Más: descargar mis datos", "falta descargar mis datos");

  // El inicio ya no carga con el plan ni con los enlaces de cuenta.
  await s.goto(`${G}/app`);
  await s.locator("main").waitFor({ timeout: 60000 });
  chequear(await s.locator("[data-link-historial], [data-link-cuenta]").count() === 0, "el inicio no repite los enlaces de cuenta", "el inicio repite enlaces de cuenta");
  if (s.errores.length) falla(`socio: ${s.errores.join(" | ")}`);
} catch (e) {
  falla(`se cortó: ${process.env.E2E_DEPURAR ? e.message : e.message.split("\n")[0]}`);
}
await b.close();
resultado();
