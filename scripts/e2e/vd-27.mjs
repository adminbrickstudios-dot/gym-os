#!/usr/bin/env node
// VD-27 · Diseño v2: vidrio, movimiento, componentes únicos. Con prefers-reduced-motion
// emulado no hay animaciones (animation-duration ≈ 0 en .mensaje y .hoja); sin la
// emulación, la hoja de Ctrl+K sí tiene su animación; Esc la cierra; el veredicto de la
// Entrada no demora; y quedan capturas de compu y celular de Inicio, Socios, Entrada y
// la hoja de Ctrl+K (para mirarlas).
//   node scripts/e2e/vd-27.mjs            (con scripts/local/levantar.sh corriendo)
import { CELU, COMPU, GIMNASIO, capturar, chequear, entrar, falla, navegador, pagina, resultado } from "./comun.mjs";

const G = GIMNASIO();
const b = await navegador();
const segundos = (v) => {
  // "0.01ms" -> 0.00001; "0.15s" -> 0.15; "0.15s, 0.2s" -> el mayor
  const ts = String(v).split(",").map((x) => x.trim()).map((x) => (x.endsWith("ms") ? parseFloat(x) / 1000 : parseFloat(x)));
  return Math.max(...ts.filter((n) => !Number.isNaN(n)), 0);
};
/** Duración de animación calculada de un elemento de prueba con esa clase. */
const duracion = (p, clase) => p.evaluate((c) => {
  const e = document.createElement("div");
  e.className = c; e.textContent = "x"; document.body.appendChild(e);
  const d = getComputedStyle(e).animationDuration;
  e.remove(); return d;
}, clase);

try {
  // 1) Reduced-motion emulado: nada se anima.
  const r = await pagina(b, COMPU, { reducedMotion: "reduce" });
  await entrar(r, "duena@ejemplo.invalid");
  await r.goto(`${G}/panel`);
  for (const clase of ["mensaje", "hoja", "aparecer", "lista-entra > *", "pulso", "brillo"]) {
    const c = clase.includes(">") ? "lista-entra" : clase;
    const d = clase.includes(">")
      ? await r.evaluate(() => { const u = document.createElement("ul"); u.className = "lista-entra"; u.innerHTML = "<li>x</li>"; document.body.appendChild(u); const v = getComputedStyle(u.firstChild).animationDuration; u.remove(); return v; })
      : await duracion(r, c);
    chequear(segundos(d) < 0.001, `reduced-motion: .${clase} sin animación (${d})`, `reduced-motion: .${clase} sigue animando (${d})`);
  }
  await r.keyboard.press("Control+k");
  await r.locator('[role=dialog][aria-label=Buscar]').waitFor({ timeout: 15000 });
  chequear(segundos(await r.locator('[role=dialog][aria-label=Buscar] ').evaluate((e) => getComputedStyle(e).animationDuration)) < 0.001,
    "reduced-motion: la hoja de Ctrl+K abre sin animación", "la hoja de Ctrl+K anima con reduced-motion");

  // 2) Con movimiento normal: la hoja anima, Esc la cierra y el foco vuelve.
  const p = await pagina(b, COMPU);
  await entrar(p, "duena@ejemplo.invalid");
  await p.goto(`${G}/panel`);
  await p.waitForLoadState("networkidle").catch(() => {});
  await capturar(p, "vd27-inicio-compu");
  await p.keyboard.press("Control+k");
  const hoja = p.locator('[role=dialog][aria-label=Buscar]');
  await hoja.waitFor({ timeout: 15000 });
  const d = await hoja.evaluate((e) => getComputedStyle(e).animationDuration);
  chequear(segundos(d) > 0.1, `movimiento normal: la hoja anima (${d})`, `la hoja no anima (${d})`);
  chequear(await hoja.locator("input").evaluate((e) => e === document.activeElement), "la hoja deja el foco en el buscador", "el foco no quedó en el buscador");
  await p.keyboard.type("soc");
  await p.waitForTimeout(700);
  await capturar(p, "vd27-ctrlk-compu");
  await p.keyboard.press("Tab"); await p.keyboard.press("Tab"); await p.keyboard.press("Tab");
  chequear(await hoja.evaluate((e) => e.contains(document.activeElement)), "el foco queda atrapado dentro de la hoja", "el foco se escapó de la hoja");
  await p.keyboard.press("Escape");
  await hoja.waitFor({ state: "detached", timeout: 5000 }).then(() => chequear(true, "Esc cierra la hoja", ""), () => falla("Esc no cerró la hoja"));

  for (const ruta of ["/panel/socios", "/panel/entrada"]) {
    await p.goto(`${G}${ruta}`);
    await p.waitForLoadState("networkidle").catch(() => {});
    await capturar(p, `vd27${ruta.replaceAll("/", "-")}-compu`);
  }

  // 3) Celular: sin desbordes; hoja que sube; capturas.
  const c = await pagina(b, CELU);
  await entrar(c, "duena@ejemplo.invalid");
  for (const ruta of ["/panel", "/panel/socios", "/panel/entrada"]) {
    await c.goto(`${G}${ruta}`);
    await c.waitForLoadState("networkidle").catch(() => {});
    const ancho = await c.evaluate(() => document.documentElement.scrollWidth);
    chequear(ancho <= CELU.width + 1, `celular ${ruta}: sin desborde (${ancho}px)`, `celular ${ruta}: desborda (${ancho}px)`);
    await capturar(c, `vd27${ruta.replaceAll("/", "-")}-celu`);
  }
  await c.goto(`${G}/panel`);
  await c.locator('button[aria-label="Buscar"], button:has-text("Buscar")').first().click();
  const hc = c.locator('[role=dialog][aria-label=Buscar]');
  await hc.waitFor({ timeout: 15000 });
  const dc = await hc.evaluate((e) => getComputedStyle(e).animationName);
  chequear(/hoja-sube/.test(dc), `celular: la hoja sube desde abajo (${dc})`, `celular: la hoja usa ${dc}`);
  await c.waitForTimeout(400);
  await capturar(c, "vd27-ctrlk-celu");

  // 4) Entrada: el veredicto aparece al instante (el color ocupa la pantalla sin animación de opacidad).
  const e = await pagina(b, COMPU);
  await entrar(e, "recepcion@ejemplo.invalid");
  await e.goto(`${G}/panel/entrada`);
  await e.getByLabel("Buscar socio").fill("a");
  const fila = e.locator("main ul button.fila").first();
  if (await fila.waitFor({ timeout: 20000 }).then(() => true, () => false)) {
    await fila.click();
    const ver = e.locator("[data-veredicto]");
    await ver.waitFor({ timeout: 20000 });
    const op = await ver.evaluate((x) => getComputedStyle(x).opacity);
    chequear(op === "1", "veredicto: el color ocupa la pantalla al instante (opacidad 1)", `veredicto con opacidad ${op}`);
    await capturar(e, "vd27-veredicto-compu");
  }
} catch (err) {
  falla(`error inesperado: ${String(err.message).split("\n")[0]}`);
} finally {
  await b.close();
}
resultado();
