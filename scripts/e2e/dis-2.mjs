#!/usr/bin/env node
// DIS-2 · Pulido de la Entrada: la pantalla abre con la forma real (loading),
// el sonido es un botón alto que se puede tocar con el dedo, y ni la puerta
// ni el control desbordan o tienen botones bajos en el celular.
//   npm run e2e:dis-2            (con scripts/local/levantar.sh corriendo)
import { CELU, COMPU, GIMNASIO, chequear, entrar, falla, navegador, pagina, resultado } from "./comun.mjs";

const G = GIMNASIO();
const b = await navegador();
const medir = (p) => p.evaluate(() => {
  const vis = (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  return {
    ancho: document.documentElement.scrollWidth,
    bajos: [...document.querySelectorAll("main .boton, main button")].filter(vis).filter((e) => e.getBoundingClientRect().height < 44).map((e) => e.innerText.trim().slice(0, 20)),
    verdes: [...document.querySelectorAll("main .boton-principal")].filter(vis).length,
  };
});
try {
  const c = await pagina(b, CELU);
  await entrar(c, "duena@ejemplo.invalid");
  for (const ruta of ["/panel/entrada", "/panel/entrada/control"]) {
    await c.goto(`${G}${ruta}`); await c.locator("main h1").first().waitFor({ timeout: 60000 });
    const m = await medir(c);
    chequear(m.ancho <= CELU.width && m.bajos.length === 0 && m.verdes <= 1, `celular ${ruta}: sin desborde, botones altos, ${m.verdes} verde(s)`, `${ruta}: ${JSON.stringify(m)}`);
  }
  await c.goto(`${G}/panel/entrada`);
  const sonido = c.locator("[data-sonido]");
  const antes = await sonido.getAttribute("data-sonido");
  const alto = await sonido.evaluate((e) => e.getBoundingClientRect().height);
  await sonido.click();
  await c.waitForFunction((a) => document.querySelector("[data-sonido]")?.getAttribute("data-sonido") !== a, antes);
  chequear(alto >= 44, `el botón de sonido mide ${Math.round(alto)}px y cambia al tocarlo`, `mide ${alto}px`);
  await sonido.click();
  if (c.errores.length) falla(`celular: ${c.errores.join(" | ")}`);
  const p = await pagina(b, COMPU);
  await entrar(p, "recepcion@ejemplo.invalid");
  await p.goto(`${G}/panel/entrada`);
  const foco = await p.evaluate(() => document.activeElement?.getAttribute("aria-label"));
  chequear(foco === "Buscar socio", "compu: el buscador arranca con el foco", `foco en ${foco}`);
  await p.keyboard.press("Tab");
  const anillo = await p.evaluate(() => { const s = getComputedStyle(document.activeElement); return s.outlineStyle !== "none" || s.boxShadow !== "none"; });
  chequear(anillo, "Tab lleva al siguiente control con foco visible", "el foco no se ve");
} catch (e) {
  falla(`se cortó: ${process.env.E2E_DEPURAR ? e.message : e.message.split("\n")[0]}`);
}
await b.close();
resultado();
