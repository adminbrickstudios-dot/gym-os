#!/usr/bin/env node
// BASE-6 · Barrido de tema: las pantallas del panel en CLARO y en OSCURO (la cookie `tema` que pone Mi cuenta), en compu y en celular (390),
// con capturas. Falla si: una pantalla da error, el celular se desborda a lo ancho, hay texto ilegible por contraste
// (menos de 3:1 contra su fondo real) o el tema pedido no se aplicó (el fondo no es claro / no es oscuro).
// Los emojis que todavía salgan de datos de la base (no del código) se cuentan y se avisan, no fallan.
//   node scripts/e2e/barrido-tema.mjs [--rol=duena|recepcion|profe]     (con scripts/local/levantar.sh corriendo; en GitHub Actions)
import { CELU, COMPU, GIMNASIO, PANTALLA_ROTA, capturar, entrar, falla, navegador, ok, pagina, resultado } from "./comun.mjs";

const RUTAS = ["/panel", "/panel/entrada", "/panel/socios", "/panel/socios/nuevo", "/panel/vencen-hoy", "/panel/retencion", "/panel/vender", "/panel/caja",
  "/panel/caja/historial", "/panel/planes", "/panel/clases", "/panel/clases/grilla", "/panel/equipo", "/panel/configuracion", "/panel/configuracion?pestana=reglas",
  "/panel/cuenta", "/panel/pagina", "/panel/prospectos", "/panel/avisos", "/panel/campana", "/panel/resultado", "/panel/rutinas", "/panel/control",
  "/panel/datos-personales", "/panel/asistente", "/panel/ayuda"];
const POR_ROL = {
  duena: RUTAS,
  recepcion: ["/panel", "/panel/entrada", "/panel/socios", "/panel/socios/nuevo", "/panel/vencen-hoy", "/panel/vender", "/panel/caja", "/panel/clases", "/panel/cuenta", "/panel/avisos", "/panel/campana"],
  profe: ["/panel", "/panel/clases", "/panel/rutinas", "/panel/cuenta", "/panel/campana"],
};
const SIN_PERMISO = /No tenés acceso|Tu rol no tiene acceso|Sin permiso|no tiene acceso|sección está apagada/i;
const soloRol = process.argv.find((a) => a.startsWith("--rol="))?.slice(6);
const EMOJI = /\p{Extended_Pictographic}/gu;

/** Se ejecuta en la página: los textos visibles con menos de 3:1 de contraste contra su fondo real, y el tono del fondo. */
function medirEnPagina() {
  const lienzo = document.createElement("canvas").getContext("2d", { willReadFrequently: true });
  lienzo.canvas.width = lienzo.canvas.height = 1;
  const rgba = (css) => {
    lienzo.clearRect(0, 0, 1, 1);
    lienzo.fillStyle = "#000"; lienzo.fillStyle = css;
    lienzo.fillRect(0, 0, 1, 1);
    const [r, g, b, a] = lienzo.getImageData(0, 0, 1, 1).data;
    return [r, g, b, a / 255];
  };
  const luminancia = ([r, g, b]) => { const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const mezclar = (sobre, fondo) => [0, 1, 2].map((i) => sobre[i] * sobre[3] + fondo[i] * (1 - sobre[3])).concat(1);
  const fondoReal = (el) => {
    const capas = [];
    for (let x = el; x; x = x.parentElement) {
      const c = rgba(getComputedStyle(x).backgroundColor);
      if (c[3] > 0) capas.push(c);
      if (c[3] >= 1) break;
    }
    let base = [255, 255, 255, 1];
    for (const c of capas.reverse()) base = mezclar(c, base);
    return base;
  };
  const malos = [];
  let revisados = 0;
  const cursor = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const vistos = new Set();
  for (let n = cursor.nextNode(); n; n = cursor.nextNode()) {
    const texto = n.textContent.trim();
    const el = n.parentElement;
    if (!texto || !el || vistos.has(el)) continue;
    vistos.add(el);
    const estilo = getComputedStyle(el);
    if (estilo.visibility === "hidden" || estilo.display === "none" || Number(estilo.opacity) < 0.1 || el.closest("[disabled], [aria-hidden='true'], script, style, [inert]")) continue;
    const caja = el.getBoundingClientRect();
    if (caja.width < 2 || caja.height < 2) continue;
    revisados++;
    const fondo = fondoReal(el);
    const letra = rgba(estilo.color);
    const sobreFondo = mezclar([letra[0], letra[1], letra[2], letra[3] * Number(estilo.opacity)], fondo);
    const [l1, l2] = [luminancia(sobreFondo), luminancia(fondo)];
    const razon = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
    if (razon < 3) malos.push(`${el.tagName.toLowerCase()}${el.className && typeof el.className === "string" ? "." + el.className.trim().split(/\s+/)[0] : ""} “${texto.slice(0, 40)}” ${razon.toFixed(2)}:1`);
  }
  const fondoPagina = fondoReal(document.querySelector("main") ?? document.body);
  return { malos: malos.slice(0, 8), cantidad: malos.length, revisados, luminanciaFondo: luminancia(fondoPagina), ancho: document.documentElement.scrollWidth };
}

let b = await navegador();
let emojisDeDatos = 0;
for (const rol of Object.keys(POR_ROL)) {
  if (soloRol && rol !== soloRol) continue;
  for (const tema of ["claro", "oscuro"]) {
    for (const [tam, viewport] of [["compu", COMPU], ["celu", CELU]]) {
      let p;
      try {
        if (!b.isConnected()) b = await navegador();
        p = await pagina(b, viewport);
        await entrar(p, `${rol}@ejemplo.invalid`);
        await p.context().addCookies([{ name: "tema", value: tema, url: GIMNASIO(), sameSite: "Lax" }]);
      } catch (e) { falla(`${rol} · ${tema} · ${tam}: no pudo entrar (${e.message.split("\n")[0]})`); continue; }
      let pasadas = 0;
      for (const ruta of POR_ROL[rol]) {
        const antes = p.errores.length;
        let r;
        try { r = await p.goto(`${GIMNASIO()}${ruta}`, { timeout: 120000 }); }
        catch (e) { falla(`${rol} · ${tema} · ${tam} · ${ruta}: no cargó (${e.message.split("\n")[0]})`); continue; }
        await p.waitForLoadState("networkidle").catch(() => {});
        const texto = await p.locator("body").innerText().catch(() => "");
        const nombre = `tema-${rol}-${tema}-${tam}${ruta.replace(/[/?=]/g, "-")}`;
        if (SIN_PERMISO.test(texto) && !/\/(cuenta|campana)/.test(ruta) && rol !== "duena") { pasadas++; continue; }   // un rol sin esa pantalla ve el aviso: no se mide
        const problemas = [...p.errores.slice(antes).filter((e) => !/\/foto\?v=/.test(e))];
        if (r && r.status() >= 500) problemas.push(`HTTP ${r.status()}`);
        if (PANTALLA_ROTA.test(texto)) problemas.push("pantalla de error");
        const m = await p.evaluate(medirEnPagina).catch((e) => ({ error: e.message }));
        if (m.error) problemas.push(`no se pudo medir: ${m.error.split("\n")[0]}`);
        else {
          const claro = m.luminanciaFondo > 0.5;
          if ((tema === "claro") !== claro) problemas.push(`el tema ${tema} no se aplicó (fondo de luminancia ${m.luminanciaFondo.toFixed(2)})`);
          if (m.cantidad > 0) problemas.push(`${m.cantidad} texto(s) ilegible(s) por contraste: ${m.malos.join(" | ")}`);
          if (tam === "celu" && m.ancho > 391) problemas.push(`se desborda en el celular (${m.ancho} px)`);
        }
        emojisDeDatos += (texto.match(EMOJI) ?? []).length;
        if (problemas.length) { falla(`${rol} · ${tema} · ${tam} · ${ruta}: ${problemas.join("; ")}`); await capturar(p, `falla-${nombre}`).catch(() => {}); }
        else pasadas++;
        if (ruta === "/panel" || ruta === "/panel/socios" || ruta === "/panel/entrada") await capturar(p, nombre).catch(() => {});
      }
      ok(`${rol} · ${tema} · ${tam}: ${pasadas} de ${POR_ROL[rol].length} pantallas sin problemas`);
      await p.close().catch(() => {});
    }
  }
}
if (emojisDeDatos) console.log(`⚠ ${emojisDeDatos} emoji(s) todavía salen de datos de la base (íconos de Primeros pasos, Campana, Guía de entrada…): se pasan a nombres de ícono en una migración aparte.`);
await b.close().catch(() => {});
resultado();
