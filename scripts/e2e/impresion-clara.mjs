#!/usr/bin/env node
// Pase 2.0 · vuelta chica post-clásico (26/11): LO IMPRESO SALE SIEMPRE CLARO, en los dos modos de Pista (oscuro y claro).
// Con la impresión emulada (emulateMedia print), en cada hoja que se imprime (los carteles del QR, la guía, el recibo y el reporte del
// cierre de caja) se mira cada texto que queda a la vista: el fondo que tiene detrás tiene que ser claro (nunca una hoja negra) y el texto tiene que
// leerse (contraste ≥ 4,5:1). El modo se fuerza con la cookie `tema` (la que elige la persona en Mi cuenta), así una sola corrida mira los dos.
//   node scripts/e2e/impresion-clara.mjs      (con scripts/local/levantar.sh corriendo)
import { execSync } from "node:child_process";
import pg from "pg";
import { COMPU, GIMNASIO, capturar, chequear, entrar, falla, navegador, pagina, resultado } from "./comun.mjs";

const G = GIMNASIO();
const url = process.env.DB_PRUEBAS_URL || execSync("scripts/db/local.sh url").toString().trim();
const db = new pg.Client({ connectionString: url }); await db.connect();
const [venta] = (await db.query(`select v.id from public.ventas v join public.gimnasios g on g.id = v.gimnasio_id
  where g.slug = 'demo' and v.estado = 'confirmada' order by v.confirmada_en desc nulls last limit 1`)).rows;
const [turno] = (await db.query(`select t.id from public.turnos_caja t join public.gimnasios g on g.id = t.gimnasio_id
  where g.slug = 'demo' order by t.abierto_en desc limit 1`)).rows;
await db.end();

const HOJAS = ["/panel/ayuda/carteles/puerta", "/panel/ayuda/carteles/app", "/panel/ayuda/carteles/anotate", "/panel/ayuda/guias/dueno",
  ...(venta ? [`/panel/recibo/${venta.id}`] : []), ...(turno ? [`/panel/caja/reporte?turno=${turno.id}`] : [])];
if (!venta) falla("el demo no tiene ninguna venta para mirar el recibo");
if (!turno) falla("el demo no tiene ningún turno de caja para mirar el cierre");

/** Cada texto a la vista al imprimir, con su color y el fondo que tiene detrás (el primer fondo no transparente hacia arriba; si no hay, el de la hoja). */
function medir() {
  const rgb = (c) => { const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return null; const [r, g, b, a = 1] = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return { r, g, b, a }; };
  const lum = ({ r, g, b }) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const contraste = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };
  const fondoDe = (e) => {
    for (let n = e; n; n = n.parentElement) { const c = rgb(getComputedStyle(n).backgroundColor); if (c && c.a > 0.5) return c; }
    return { r: 255, g: 255, b: 255, a: 1 };   // el papel
  };
  const malos = [];
  let textos = 0;
  for (const e of document.querySelectorAll("body *")) {
    const s = getComputedStyle(e);
    if (s.visibility !== "visible" || s.display === "none" || e.closest("[data-no-imprimir]")) continue;
    const propio = [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    if (!propio) continue;
    const r = e.getBoundingClientRect();
    if (!r.width || !r.height) continue;
    textos++;
    const color = rgb(s.color), fondo = fondoDe(e);
    if (!color) continue;
    const k = contraste(color, fondo);
    if (lum(fondo) < 0.5 || k < 4.5) malos.push(`"${e.textContent.trim().slice(0, 30)}" (${s.color} sobre rgb(${fondo.r}, ${fondo.g}, ${fondo.b}), ${k.toFixed(1)}:1)`);
  }
  return { textos, malos };
}

const b = await navegador();
try {
  for (const modo of ["oscuro", "claro"]) {
    const p = await pagina(b, COMPU);
    await entrar(p, "duena@ejemplo.invalid");
    await p.context().addCookies([{ name: "tema", value: modo, url: G }]);
    for (const ruta of HOJAS) {
      await p.goto(`${G}${ruta}`, { waitUntil: "load", timeout: 90000 });
      await p.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
      chequear(await p.evaluate(() => document.documentElement.dataset.modo) === modo, `${ruta} abre en modo ${modo}`, `${ruta} no abrió en modo ${modo}`);
      await p.emulateMedia({ media: "print" });
      const { textos, malos } = await p.evaluate(medir);
      if (!textos) falla(`${ruta} (${modo}): al imprimir no queda ningún texto a la vista`);
      else chequear(!malos.length, `${ruta} (${modo}): se imprime claro y se lee (${textos} textos)`,
        `${ruta} (${modo}): ${malos.length} de ${textos} textos se imprimen oscuros o no se leen: ${malos.slice(0, 4).join(" · ")}`);
      await capturar(p, `impresion-${modo}-${ruta.replace(/[^a-z0-9]+/gi, "_").slice(0, 40)}`, true).catch(() => {});
      await p.emulateMedia({ media: "screen" });
    }
    await p.context().close();
  }
} finally {
  await b.close();
}
resultado();
