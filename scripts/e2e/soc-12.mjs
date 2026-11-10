#!/usr/bin/env node
// SOC-12 · Filtros de Socios: píldoras por estado (con su cuenta, que es la
// de la lista) y por plan; se combinan; tocar de nuevo saca el filtro; en
// el celular la fila se desliza sin mover la página.
//   npm run e2e:soc-12           (con scripts/local/levantar.sh corriendo)
import { CELU, COMPU, GIMNASIO, capturar, chequear, entrar, falla, navegador, pagina, resultado } from "./comun.mjs";

const G = GIMNASIO();
const b = await navegador();
const filas = (p) => p.locator('main ul a[href^="/panel/socios/"]');
const cuenta = async (l) => Number((await l.locator(".texto-tenue").innerText()).trim());
try {
  const p = await pagina(b, COMPU);
  await entrar(p, "recepcion@ejemplo.invalid");
  await p.goto(`${G}/panel/socios`);
  const estados = p.locator("[data-filtro-estados] a[data-estado]");
  await estados.first().waitFor({ timeout: 60000 });
  const claves = await estados.evaluateAll((xs) => xs.map((x) => x.getAttribute("data-estado")));
  chequear(claves.includes("al_dia") && claves.length >= 3, `píldoras de estado: ${claves.join(", ")}`, `píldoras: ${claves.join(", ")}`);
  for (const k of ["vencidos", "por_vencer", "al_dia"].filter((x) => claves.includes(x))) {
    const pild = p.locator(`[data-filtro-estados] a[data-estado="${k}"]`);
    const n = await cuenta(pild);
    await pild.click();
    await p.waitForURL(new RegExp(`estado=${k}`));
    await filas(p).first().waitFor({ timeout: 30000 });
    const m = await filas(p).count();
    chequear(m === Math.min(n, 60), `${k}: la píldora dice ${n} y la lista muestra ${m}`, `${k}: píldora ${n}, lista ${m}`);
    if (k === "al_dia") {
      const textos = (await filas(p).allInnerTexts()).join(" | ");
      chequear(!/Venci|no pag|Congelada/i.test(textos), "al día: nadie vencido ni en pausa", `al día con: ${textos.slice(0, 120)}`);
    }
  }
  // Plan + estado combinados
  const planes = p.locator("[data-filtro-etiquetas] a[data-plan]");
  if (await planes.count()) {
    const nombre = (await planes.first().innerText()).replace(/^\s*/, "").replace(/\s*\d+$/, "").trim();
    await planes.first().click();
    await p.waitForURL(/plan=.*estado=al_dia|estado=al_dia.*plan=/);
    await p.locator("main").waitFor();
    const pl = await filas(p).locator(".pildora").allInnerTexts();
    chequear(pl.length > 0 && pl.every((x) => x.trim() === nombre), `al día + plan “${nombre}”: ${pl.length} socios, todos de ese plan`, `planes: ${[...new Set(pl)].join(", ")}`);
    await p.locator('[data-filtro-estados] a[data-estado="al_dia"]').click();      // tocar de nuevo lo saca
    await p.waitForURL((u) => !/estado=/.test(u.search) && /plan=/.test(u.search));
    chequear(true, "tocar la píldora activa la saca (queda solo el plan)", "");
  }
  await capturar(p, "soc12-compu-filtros");
  if (p.errores.length) falla(`compu: ${p.errores.join(" | ")}`);
  await p.context().close();

  const c = await pagina(b, CELU);
  await entrar(c, "recepcion@ejemplo.invalid");
  await c.goto(`${G}/panel/socios`);
  await c.locator("[data-filtro-estados]").waitFor({ timeout: 30000 });
  const ancho = await c.evaluate(() => document.documentElement.scrollWidth);
  chequear(ancho <= CELU.width, `celular: las píldoras se deslizan sin mover la página (${ancho}px)`, `mide ${ancho}px`);
  if (c.errores.length) falla(`celular: ${c.errores.join(" | ")}`);
} catch (e) {
  falla(`se cortó: ${process.env.E2E_DEPURAR ? e.message : e.message.split("\n")[0]}`);
}
await b.close();
resultado();
