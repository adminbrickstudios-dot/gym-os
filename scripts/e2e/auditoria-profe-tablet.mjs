#!/usr/bin/env node
// Auditoría 18/11 · El profe (Diego) en tablet vertical y horizontal: clases, grilla, rutinas y su inicio abren sin error,
// sin desborde a lo ancho, sin textos de menos de 11 px, y sin plata. Vale para clásico y para Pista (claro y oscuro en CI).
import { GIMNASIO, PANTALLA_ROTA, capturar, chequear, entrar, falla, navegador, pagina, resultado } from "./comun.mjs";

const b = await navegador();
try {
  for (const [w, h, nombre] of [[820, 1180, "vertical"], [1180, 820, "horizontal"]]) {
    const p = await pagina(b, { width: w, height: h });
    await entrar(p, "profe@ejemplo.invalid");
    for (const ruta of ["/panel", "/panel/clases", "/panel/clases/grilla", "/panel/rutinas"]) {
      await p.goto(`${GIMNASIO()}${ruta}`, { waitUntil: "load" });
      await p.locator("h1").first().waitFor({ timeout: 60000 });
      const r = await p.evaluate(() => {
        const px = (e) => parseFloat(getComputedStyle(e).fontSize);
        const chicos = [...document.querySelectorAll("main *")].filter((e) => [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()) && e.getBoundingClientRect().width > 0 && px(e) < 11).map((e) => e.textContent.trim().slice(0, 20));
        return { desborda: document.documentElement.scrollWidth - innerWidth, chicos, texto: document.body.innerText };
      });
      const malo = [r.desborda > 0 && `desborda ${r.desborda}px`, r.chicos.length && `texto chico: ${r.chicos.slice(0, 3).join(", ")}`, PANTALLA_ROTA.test(r.texto) && "pantalla rota", /\$\s?\d/.test(r.texto) && "muestra plata"].filter(Boolean);
      chequear(malo.length === 0, `profe · tablet ${nombre} · ${ruta}: bien`, `profe · tablet ${nombre} · ${ruta}: ${malo.join(" | ")}`);
      if (ruta === "/panel/clases") await capturar(p, `aud-profe-${nombre}-clases`);
    }
    if (p.errores.length) falla(`profe tablet ${nombre}: ${p.errores.join(" | ")}`);
    await p.context().close();
  }
} catch (e) { falla(`se cortó: ${String(e.message).split("\n")[0]}`); }
finally { await b.close(); }
resultado();
