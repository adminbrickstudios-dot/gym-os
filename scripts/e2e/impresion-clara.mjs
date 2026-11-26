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
// Un cierre de caja ya contado (el demo arranca sin turnos): el de la recepción, de hace un rato.
const [d] = (await db.query(`select g.id g, (select id from public.sedes where gimnasio_id = g.id and es_principal) sede,
  (select id from public.equipo where gimnasio_id = g.id and rol = 'recepcion' and activo limit 1) rec from public.gimnasios g where g.slug = 'demo'`)).rows;
let [caja] = (await db.query(`select id from public.cajas where gimnasio_id = $1 and sede_id = $2 limit 1`, [d.g, d.sede])).rows;
if (!caja) caja = (await db.query(`insert into public.cajas (gimnasio_id, sede_id, nombre) values ($1,$2,'Caja') returning id`, [d.g, d.sede])).rows[0];
const [turno] = (await db.query(`insert into public.turnos_caja (gimnasio_id, caja_id, abierto_por, abierto_en, monto_inicial, cerrado_en, cerrado_por, monto_contado, monto_esperado)
  values ($1,$2,$3, now() - interval '6 hours', 0, now() - interval '2 hours', $3, 1000, 1000) returning id`, [d.g, caja.id, d.rec])).rows;
await db.end();

const HOJAS = ["/panel/ayuda/carteles/puerta", "/panel/ayuda/carteles/app", "/panel/ayuda/carteles/anotate", "/panel/ayuda/guias/dueno",
  ...(venta ? [`/panel/recibo/${venta.id}`] : []), ...(turno ? [`/panel/caja/reporte?turno=${turno.id}`] : [])];
if (!venta) falla("el demo no tiene ninguna venta para mirar el recibo");
if (!turno) falla("el demo no tiene ningún turno de caja para mirar el cierre");

/** La hoja que sale (lo que queda a la vista al imprimir es .recibo-hoja) tiene que ser clara, y cada texto suyo tiene que leerse contra el fondo que tiene
 *  detrás (el primer fondo no transparente hacia arriba; si no hay, el papel). Las franjas de color del gimnasio (el cartel) valen si se leen. */
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
  for (const h of document.querySelectorAll(".recibo-hoja")) {
    const f = rgb(getComputedStyle(h).backgroundColor);
    if (f && f.a > 0.5 && lum(f) < 0.8) malos.push(`la hoja sale con fondo ${getComputedStyle(h).backgroundColor}`);
  }
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
    if (k < 4.5) malos.push(`"${e.textContent.trim().slice(0, 30)}" (${s.color} sobre rgb(${fondo.r}, ${fondo.g}, ${fondo.b}), ${k.toFixed(1)}:1)`);
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
