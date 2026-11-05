#!/usr/bin/env node
// DIS-8 · Pulido de Retención: cada lista, en el celular, sin
// desborde, botones altos y a lo sumo un verde (el WhatsApp de cada fila ya
// no es verde), para la dueña y la recepción.
//   npm run e2e:dis-8            (con scripts/local/levantar.sh corriendo)
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
  for (const quien of ["duena", "recepcion"]) {
    const p = await pagina(b, CELU);
    await entrar(p, `${quien}@ejemplo.invalid`);
    for (const lista of ["vencido", "por_vencer", "no_viene"]) {
      await p.goto(`${G}/panel/retencion?lista=${lista}`); await p.locator("main h1").first().waitFor({ timeout: 60000 });
      const m = await medir(p);
      chequear(m.ancho <= CELU.width && m.bajos === 0 && m.verdes <= 1, `${quien} ${lista}: sin desborde, botones altos, ${m.verdes} verde(s)`, `${lista}: ${JSON.stringify(m)}`);
      await capturar(p, `dis8-celu-${quien}-${lista}`, true);
    }
    if (p.errores.length) falla(`${quien}: ${p.errores.join(" | ")}`);
  }
} catch (e) {
  falla(`se cortó: ${process.env.E2E_DEPURAR ? e.message : e.message.split("\n")[0]}`);
}
await b.close();
resultado();
