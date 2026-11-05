#!/usr/bin/env node
// DIS-11 · Pulido de Equipo y Mi cuenta: en el celular, sin desborde, botones
// altos y a lo sumo un verde (Mi cuenta tenía dos: contraseña y PIN).
//   npm run e2e:dis-11            (con scripts/local/levantar.sh corriendo)
import { CELU, GIMNASIO, capturar, chequear, entrar, falla, navegador, pagina, resultado } from "./comun.mjs";

const G = GIMNASIO();
const medir = (p) => p.evaluate(() => {
  const vis = (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  return { ancho: document.documentElement.scrollWidth,
    bajos: [...document.querySelectorAll("main .boton")].filter(vis).filter((e) => e.getBoundingClientRect().height < 44).length,
    verdes: [...document.querySelectorAll("main .boton-principal")].filter(vis).length };
});
const b = await navegador();
try {
  const p = await pagina(b, CELU);
  await entrar(p, "duena@ejemplo.invalid");
  for (const ruta of ["/panel/equipo", "/panel/equipo/actividad", "/panel/cuenta"]) {
    await p.goto(`${G}${ruta}`);
    await p.locator("main h1").first().waitFor({ timeout: 60000 });
    const m = await medir(p);
    chequear(m.ancho <= CELU.width && m.bajos === 0 && m.verdes <= 1, `${ruta}: sin desborde, botones altos, ${m.verdes} verde(s)`, `${ruta}: ${JSON.stringify(m)}`);
    await capturar(p, `dis11-celu${ruta.replaceAll("/", "-")}`, true);
  }
  if (p.errores.length) falla(`dueña: ${p.errores.join(" | ")}`);
} catch (e) {
  falla(`se cortó: ${process.env.E2E_DEPURAR ? e.message : e.message.split("\n")[0]}`);
}
await b.close();
resultado();
