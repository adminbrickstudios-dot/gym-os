#!/usr/bin/env node
// Vuelta final (22/11) · QA · el gimnasio casi vacío (Box Norte Demo: sin socios). El dueño abre CADA pantalla de su menú, en la compu y en un
// celular chico (360), y en ninguna:
//   - aparece la pantalla de error ni el texto genérico de Next ("Application error", "server-side exception");
//   - queda la página en blanco (siempre hay un título y algo que hacer);
//   - se lee un texto técnico o de relleno (undefined, null, NaN, [object Object], Lorem, "Error:" crudo);
//   - algo se sale a lo ancho;
//   - hay errores de React #418 / #441 en la consola.
// Después, la página pública del Box y su 404, con salida.
//   node scripts/e2e/gimnasio-vacio.mjs     (con scripts/local/levantar.sh corriendo)
import { COMPU, GIMNASIO, chequear, entrar, navegador, pagina, resultado } from "./comun.mjs";

const BOX = GIMNASIO("demo-box");
const CHICO = { width: 360, height: 740 };
const TECNICO = /\bundefined\b|\bNaN\b|\[object Object\]|lorem ipsum|Application error|server-side exception|^Error:/im;
const b = await navegador();
try {
  for (const [tam, vp] of [["compu", COMPU], ["celular", CHICO]]) {
    const p = await pagina(b, vp);
    const consola = [];
    p.on("console", (m) => { if (m.type() === "error" && /Minified React error #(418|441)/.test(m.text())) consola.push(m.text().slice(0, 120)); });
    await entrar(p, "box@ejemplo.invalid", undefined, BOX);
    await p.goto(`${BOX}/panel`);
    const rutas = [...new Set(await p.locator('a[href^="/panel"]').evaluateAll((l) => l.map((a) => new URL(a.href).pathname)))].filter((r) => !/salir|\/pin/.test(r)).slice(0, 40);
    chequear(rutas.length >= 5, `${tam}: el menú del dueño tiene ${rutas.length} pantallas`, `${tam}: el menú tiene ${rutas.length} pantallas`);
    const mal = [];
    for (const r of rutas) {
      const resp = await p.goto(`${BOX}${r}`, { waitUntil: "domcontentloaded" });
      await p.waitForLoadState("networkidle", { timeout: 20000 }).catch(() => {});
      const error = await p.locator("[data-pantalla-error], [data-error-raiz]").count();
      const texto = (await p.locator("main").first().innerText().catch(() => "")).trim();
      const ancho = await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
      const tecnico = TECNICO.exec(texto)?.[0];
      if ((resp?.status() ?? 200) >= 500 || error || texto.length < 20 || tecnico || !ancho) {
        mal.push(`${r} (${[resp?.status() >= 500 && `HTTP ${resp.status()}`, error && "pantalla de error", texto.length < 20 && "en blanco", tecnico && `«${tecnico}»`, !ancho && "se sale a lo ancho"].filter(Boolean).join(", ")})`);
      }
    }
    chequear(mal.length === 0, `${tam}: las ${rutas.length} pantallas del Box abren con contenido, sin errores ni textos técnicos`, `${tam}: ${mal.join(" · ")}`);
    chequear(consola.length === 0, `${tam}: sin React #418/#441 en la consola`, `${tam}: ${consola.join(" | ")}`);
  }
  const v = await pagina(b, CHICO);
  const r = await v.goto(`${BOX}/`);
  chequear((r?.status() ?? 0) < 500 && (await v.locator("h1").count()) > 0, "La página pública del Box abre con su título", `la página pública del Box: HTTP ${r?.status()}`);
  const n = await v.goto(`${BOX}/no-existe-esta-pagina`);
  chequear(n?.status() === 404 && (await v.locator('a[href="/"]').count()) > 0, "La 404 del Box dice que no existe y tiene salida a su página", `la 404: HTTP ${n?.status()}`);
} finally {
  await b.close();
  resultado();
}
