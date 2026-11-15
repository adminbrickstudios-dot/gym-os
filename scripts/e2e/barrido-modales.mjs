#!/usr/bin/env node
// BASE-6 / F1.4 · Barrido de modales: cada hoja abierta en CLARO y OSCURO, en compu y en celular (390), con captura.
// Falla si: no abre, no entra en la pantalla, no tiene la X visible y tocable (≥ 36 px), el fondo no corresponde al tema o Esc no la cierra.
//   node scripts/e2e/barrido-modales.mjs     (con scripts/local/levantar.sh corriendo; en GitHub Actions)
import { CELU, COMPU, GIMNASIO, aparece, capturar, entrar, falla, navegador, ok, pagina, resultado } from "./comun.mjs";

const MODALES = [
  { nombre: "atajos", ruta: "/panel", abrir: async (p) => { await p.evaluate(() => window.dispatchEvent(new Event("gymos:atajos"))); } },
  { // OJO: este es el buscador (Ctrl+K), no la cámara de QR: la cámara pide permiso del navegador y no se abre acá.
  nombre: "buscador", ruta: "/panel/entrada", abrir: async (p) => { await p.getByRole("button", { name: /Buscar/i }).first().click({ timeout: 8000 }); } },
  // F1.4 (Pase 1.0): la hoja de Cobrar, que el barrido nunca había abierto. Se abre con el mismo evento que usan Vencen, la ficha y la Entrada.
  { nombre: "cobrar", ruta: "/panel/socios", abrir: async (p) => {
      await p.locator("main ul a[href^=\"/panel/socios/\"]").first().waitFor({ timeout: 30000 });
      await p.waitForFunction(() => document.documentElement.dataset.cobrarHoja === "si", null, { timeout: 30000 });
      const href = await p.locator("main ul a[href^=\"/panel/socios/\"]").first().getAttribute("href");
      await p.evaluate((socioId) => window.dispatchEvent(new CustomEvent("gymos:cobrar", { detail: { socioId, origen: "otro" } })), href.split("/").pop());
      await p.locator("[data-cobrar]").waitFor({ timeout: 30000 });
    } },
];
const medir = () => {
  const d = document.querySelector('[role="dialog"][aria-modal="true"]');
  if (!d) return null;
  const c = d.getBoundingClientRect();
  const x = d.querySelector("[data-cerrar-hoja], button[aria-label='Cerrar']");
  const cx = x?.getBoundingClientRect();
  const lienzo = document.createElement("canvas").getContext("2d", { willReadFrequently: true });
  lienzo.canvas.width = lienzo.canvas.height = 1;
  let fondo = [0, 0, 0, 0];
  for (let e = d; e; e = e.parentElement) {
    lienzo.clearRect(0, 0, 1, 1); lienzo.fillStyle = "#000"; lienzo.fillStyle = getComputedStyle(e).backgroundColor; lienzo.fillRect(0, 0, 1, 1);
    const [r, g, b, a] = lienzo.getImageData(0, 0, 1, 1).data;
    if (a > 200) { fondo = [r, g, b, a]; break; }
  }
  const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  return {
    cabe: c.left >= -1 && c.top >= -1 && c.right <= innerWidth + 1 && c.bottom <= innerHeight + 1,
    cerrar: cx ? { ancho: cx.width, alto: cx.height, visible: cx.width > 0 && cx.bottom > 0 && cx.right <= innerWidth + 1 } : null,
    luz: 0.2126 * f(fondo[0]) + 0.7152 * f(fondo[1]) + 0.0722 * f(fondo[2]),
  };
};

let b = await navegador();
for (const tema of ["claro", "oscuro"]) {
  for (const [tam, viewport] of [["compu", COMPU], ["celu", CELU]]) {
    let p;
    try {
      if (!b.isConnected()) b = await navegador();
      p = await pagina(b, viewport);
      await entrar(p, "duena@ejemplo.invalid");
      await p.context().addCookies([{ name: "tema", value: tema, url: GIMNASIO(), sameSite: "Lax" }]);
    } catch (e) { falla(`${tema} · ${tam}: no pudo entrar (${e.message.split("\n")[0]})`); continue; }
    for (const m of MODALES.filter((x) => !process.env.SOLO_MODAL || x.nombre === process.env.SOLO_MODAL)) {
      const donde = `${m.nombre} · ${tema} · ${tam}`;
      try {
        // net::ERR_ABORTED: la navegación se pisa con otra del panel (redirección o precarga); se reintenta hasta 3 veces.
        for (let t = 1; ; t++) { try { await p.goto(`${GIMNASIO()}${m.ruta}`, { timeout: 120000 }); break; } catch (e) { if (t >= 3 || !/ERR_ABORTED/.test(String(e.message))) throw e; await p.waitForTimeout(500); } }
        await p.waitForLoadState("networkidle").catch(() => {});
        await m.abrir(p);
        if (!(await aparece(p.locator('[role="dialog"][aria-modal="true"]'), 8000))) { falla(`${donde}: no abrió`); continue; }
        await p.waitForTimeout(400);
        const r = await p.evaluate(medir);
        const problemas = [];
        if (!r.cabe) problemas.push("no entra en la pantalla");
        if (!r.cerrar) problemas.push("no tiene la X de cerrar");
        else if (!r.cerrar.visible || r.cerrar.ancho < 36 || r.cerrar.alto < 36) problemas.push(`la X es chica o no se ve (${Math.round(r.cerrar.ancho)}×${Math.round(r.cerrar.alto)})`);
        if ((tema === "claro") !== (r.luz > 0.5)) problemas.push(`el fondo no es ${tema} (luminancia ${r.luz.toFixed(2)})`);
        await capturar(p, `modal-${m.nombre}-${tema}-${tam}`).catch(() => {});
        await p.keyboard.press("Escape");
        if (await p.locator('[role="dialog"][aria-modal="true"]').first().isVisible().catch(() => false)) problemas.push("Esc no la cierra");
        problemas.length ? falla(`${donde}: ${problemas.join("; ")}`) : ok(`${donde}: abre, entra, X tocable, fondo ${tema}, Esc cierra`);
      } catch (e) { await capturar(p, `falla-modal-${m.nombre}-${tema}-${tam}`).catch(() => {}); falla(`${donde}: ${e.message.split("\n")[0]}`); }
    }
    await p.close().catch(() => {});
  }
}
await b.close().catch(() => {});
resultado();
