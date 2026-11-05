#!/usr/bin/env node
// DIS-14 · Pulido de Ingresar, Elegir gimnasio y Gimnasio no encontrado: en el
// celular, sin desborde, botones altos y a lo sumo un verde.
//   npm run e2e:dis-14            (con scripts/local/levantar.sh corriendo)
import { CELU, GIMNASIO, PLATAFORMA as B, PUERTO, capturar, chequear, entrar, falla, navegador, pagina, resultado } from "./comun.mjs";

const medir = (p) => p.evaluate(() => {
  const vis = (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  return { ancho: document.documentElement.scrollWidth,
    bajos: [...document.querySelectorAll("main .boton")].filter(vis).filter((e) => e.getBoundingClientRect().height < 44).length,
    verdes: [...document.querySelectorAll("main .boton-principal")].filter(vis).length };
});
const b = await navegador();
try {
  const p = await pagina(b, CELU);
  for (const [nombre, url] of [["ingresar-gimnasio", `${GIMNASIO()}/ingresar`], ["ingresar-socio", `${GIMNASIO()}/ingresar?modo=socio`],
                               ["ingresar-plataforma", `${B}/ingresar`], ["no-encontrado", `http://no-existe-dis.localhost:${PUERTO}/`]]) {
    await p.goto(url);
    await p.locator("main h1").first().waitFor({ timeout: 60000 });
    const m = await medir(p);
    chequear(m.ancho <= CELU.width && m.bajos === 0 && m.verdes <= 1, `${nombre}: sin desborde, botones altos, ${m.verdes} verde(s)`, `${nombre}: ${JSON.stringify(m)}`);
    await capturar(p, `dis14-celu-${nombre}`, true);
  }
  await entrar(p, "admin@ejemplo.invalid", undefined, B);
  await p.goto(`${B}/elegir`);
  await p.locator("main h1").first().waitFor({ timeout: 60000 });
  const m = await medir(p);
  chequear(m.ancho <= CELU.width && m.bajos === 0 && m.verdes <= 1, `elegir: sin desborde, botones altos, ${m.verdes} verde(s)`, `elegir: ${JSON.stringify(m)}`);
  if (p.errores.length) falla(p.errores.join(" | "));
} catch (e) {
  falla(`se cortó: ${process.env.E2E_DEPURAR ? e.message : e.message.split("\n")[0]}`);
}
await b.close();
resultado();
