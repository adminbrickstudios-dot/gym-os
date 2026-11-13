#!/usr/bin/env node
// DIS-1 · Pulido de Inicio: cada rol en el celular, sin desborde, botones
// altos, un solo verde (el primer acceso) y los números de a dos.
//   npm run e2e:dis-1            (con scripts/local/levantar.sh corriendo)
import { CELU, GIMNASIO, capturar, chequear, entrar, falla, navegador, pagina, resultado } from "./comun.mjs";

const G = GIMNASIO();
const medir = (p) => p.evaluate(() => {
  const vis = (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  const nums = [...document.querySelectorAll('section[aria-label="Números de hoy"] dd')].filter(vis).map((e) => Math.round(e.getBoundingClientRect().top));
  return { ancho: document.documentElement.scrollWidth,
    bajos: [...document.querySelectorAll("main .boton")].filter(vis).filter((e) => e.getBoundingClientRect().height < 44).length,
    verdes: [...document.querySelectorAll("main .boton-principal")].filter(vis).length,
    // "De a dos": como mucho dos números por fila (BASE-4 sumó contadores y hoy son ocho: cuatro filas de a dos; la prueba vieja contaba filas).
    filasNumeros: Math.max(0, ...Object.values(nums.reduce((a, n) => { a[n] = (a[n] ?? 0) + 1; return a; }, {}))),
    // Quién se pasa del borde (para saber qué arreglar cuando el ancho no da).
    culpables: document.documentElement.scrollWidth <= window.innerWidth ? [] : [...document.querySelectorAll("body *")].filter((e) => e.getBoundingClientRect().right > window.innerWidth + 1 && getComputedStyle(e).position !== "fixed").slice(0, 6).map((e) => `${e.tagName.toLowerCase()}.${String(e.className).split(" ").slice(0, 4).join(".")}[${Math.round(e.getBoundingClientRect().width)}]`) };
});
const b = await navegador();
try {
  for (const rol of ["duena", "encargado", "recepcion", "profe"]) {
    const p = await pagina(b, CELU);
    await entrar(p, `${rol}@ejemplo.invalid`);
    await p.goto(`${G}/panel`);
    await p.locator("main h1").first().waitFor({ timeout: 60000 });
    await p.waitForLoadState("networkidle").catch(() => {});
    const m = await medir(p);
    chequear(m.ancho <= CELU.width && m.bajos === 0 && m.verdes <= 1 && m.filasNumeros <= 2,
      `${rol}: sin desborde, botones altos, ${m.verdes} verde, números de a ${m.filasNumeros} por fila`, `${rol}: ${JSON.stringify(m)}`);
    await capturar(p, `dis1-celu-${rol}`, true);
    if (p.errores.length) falla(`${rol}: ${p.errores.join(" | ")}`);
    await p.context().close();
  }
} catch (e) {
  falla(`se cortó: ${process.env.E2E_DEPURAR ? e.message : e.message.split("\n")[0]}`);
}
await b.close();
resultado();
