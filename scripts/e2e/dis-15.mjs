#!/usr/bin/env node
// DIS-15 · Pulido del super admin: la lista y el detalle de un gimnasio, en
// compu y celular, sin desborde, botones altos y a lo sumo un verde (antes
// cada gimnasio tenía su "Entrar al panel" verde y el detalle tenía tres).
//   npm run e2e:dis-15            (con scripts/local/levantar.sh corriendo)
import { CELU, COMPU, PLATAFORMA as B, capturar, chequear, entrar, falla, navegador, pagina, resultado } from "./comun.mjs";

const medir = (p) => p.evaluate(() => {
  const vis = (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  return { ancho: document.documentElement.scrollWidth,
    bajos: [...document.querySelectorAll("main .boton")].filter(vis).filter((e) => e.getBoundingClientRect().height < 44).length,
    verdes: [...document.querySelectorAll("main .boton-principal")].filter(vis).length };
});
const b = await navegador();
try {
  for (const [tam, vp] of [["compu", COMPU], ["celu", CELU]]) {
    const p = await pagina(b, vp);
    await entrar(p, "admin@ejemplo.invalid", undefined, B);
    await p.locator("main h1").first().waitFor({ timeout: 60000 });
    const href = await p.getByRole("link", { name: /Equipo, claves y direcciones/ }).first().getAttribute("href");
    for (const ruta of ["/admin", href]) {
      await p.goto(`${B}${ruta}`);
      await p.locator("main h1").first().waitFor({ timeout: 60000 });
      const m = await medir(p);
      chequear(m.ancho <= vp.width && m.bajos === 0 && m.verdes <= 1, `${tam} ${ruta.replace(/[0-9a-f-]{36}/, "<id>")}: sin desborde, botones altos, ${m.verdes} verde(s)`, `${tam} ${ruta}: ${JSON.stringify(m)}`);
      await capturar(p, `dis15-${tam}${ruta.replace(/[0-9a-f-]{36}/, "id").replaceAll("/", "-")}`, true);
    }
    if (p.errores.length) falla(p.errores.join(" | "));
    await p.context().close();
  }
} catch (e) {
  falla(`se cortó: ${process.env.E2E_DEPURAR ? e.message : e.message.split("\n")[0]}`);
}
await b.close();
resultado();
