#!/usr/bin/env node
// DIS-7 · Pulido de Vencen hoy (y lo que nació con ella: Avisos de hoy,
// Novedades y Resumen): en el celular sin desborde, botones altos y un solo
// verde por pantalla (en Vencen hoy, "Avisar a todos"; WhatsApp de cada fila
// ya no es verde).
//   npm run e2e:dis-7            (con scripts/local/levantar.sh corriendo)
import { CELU, GIMNASIO, capturar, chequear, entrar, falla, navegador, pagina, resultado } from "./comun.mjs";

const G = GIMNASIO();
const b = await navegador();
try {
  for (const [quien, rutas] of [["recepcion", ["/panel/vencen-hoy", "/panel/avisos", "/panel/campana"]], ["duena", ["/panel/vencen-hoy", "/panel/resumen"]]]) {
    const p = await pagina(b, CELU);
    await entrar(p, `${quien}@ejemplo.invalid`);
    for (const ruta of rutas) {
      await p.goto(`${G}${ruta}`); await p.locator("main h1").first().waitFor({ timeout: 60000 });
      const m = await p.evaluate(() => {
        const vis = (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
        return { ancho: document.documentElement.scrollWidth,
          bajos: [...document.querySelectorAll("main .boton")].filter(vis).filter((e) => e.getBoundingClientRect().height < 44).length,
          verdes: [...document.querySelectorAll("main .boton-principal")].filter(vis).length };
      });
      chequear(m.ancho <= CELU.width && m.bajos === 0 && m.verdes <= 1, `${quien} ${ruta}: sin desborde, botones altos, ${m.verdes} verde(s)`, `${ruta}: ${JSON.stringify(m)}`);
      await capturar(p, `dis7-celu-${quien}-${ruta.split("/").pop()}`, true);
    }
    if (p.errores.length) falla(`${quien}: ${p.errores.join(" | ")}`);
  }
} catch (e) {
  falla(`se cortó: ${process.env.E2E_DEPURAR ? e.message : e.message.split("\n")[0]}`);
}
await b.close();
resultado();
