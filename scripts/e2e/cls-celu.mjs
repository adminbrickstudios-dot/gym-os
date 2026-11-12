#!/usr/bin/env node
// H7 · Los saltos de diseño (CLS 0,25 a 0,31) del panel en celular que dejó el robot de botones: ¿qué elemento se mueve y cuándo?
// Mide cada pantalla con el medidor del robot (scripts/e2e/botones.mjs) y, además, anota los elementos que se mueven (LayoutShiftAttribution),
// cuánto y a los cuántos milisegundos de abrir. Con CLS_MAX (por defecto 0,1) falla si alguna pantalla lo pasa.
//   node scripts/e2e/cls-celu.mjs     (con scripts/local/levantar.sh corriendo)
import { CELU, GIMNASIO, chequear, entrar, falla, navegador, pagina, resultado } from "./comun.mjs";

const G = GIMNASIO();
const MAX = Number(process.env.CLS_MAX ?? 0.1);
const RUTAS = ["/panel", "/panel/socios", "/panel/entrada", "/panel/vender", "/panel/caja", "/panel/hoy"];
const medidor = () => {
  window.__cls = 0; window.__saltos = [];
  const nombre = (n) => n ? `${n.nodeName.toLowerCase()}${n.id ? "#" + n.id : ""}${n.className && typeof n.className === "string" ? "." + n.className.trim().split(/\s+/).slice(0, 3).join(".") : ""}` : "?";
  try {
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) {
        if (e.hadRecentInput) continue;
        window.__cls += e.value;
        window.__saltos.push({ valor: Number(e.value.toFixed(3)), ms: Math.round(e.startTime),
          mueve: e.sources.map((s) => `${nombre(s.node)} ${Math.round(s.previousRect.y)}→${Math.round(s.currentRect.y)} (alto ${Math.round(s.previousRect.height)}→${Math.round(s.currentRect.height)})`) });
      }
    }).observe({ type: "layout-shift", buffered: true });
  } catch {}
};

const b = await navegador();
try {
  const p = await pagina(b, CELU);
  p.setDefaultNavigationTimeout(120000);
  await p.addInitScript(medidor);
  await entrar(p, "duena@ejemplo.invalid");
  for (const ruta of RUTAS) {
    await p.goto(`${G}${ruta}`, { waitUntil: "load" });
    await p.locator("main").first().waitFor({ timeout: 60000 });
    await p.waitForTimeout(3500);
    const { cls, saltos } = await p.evaluate(() => ({ cls: window.__cls, saltos: window.__saltos }));
    console.log(`· ${ruta}: CLS ${cls.toFixed(3)}`);
    for (const s of saltos) console.log(`    a los ${s.ms} ms: ${s.valor} — ${s.mueve.join(" | ")}`);
    chequear(cls <= MAX, `${ruta}: CLS ${cls.toFixed(3)} (límite ${MAX})`, `${ruta}: salta al cargar, CLS ${cls.toFixed(3)} (límite ${MAX})`);
  }
} catch (e) {
  falla(`se cortó: ${process.env.E2E_DEPURAR ? e.stack : e.message.split("\n")[0]}`);
}
await b.close();
resultado();
