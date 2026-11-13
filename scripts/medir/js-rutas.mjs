#!/usr/bin/env node
// E4 · Cuánto JavaScript baja cada ruta del panel (después de `next build`).
// Next 16 con Turbopack ya no imprime "First Load JS": se suma a mano desde los manifiestos de cada ruta
// (`entryJSFiles` de page_client-reference-manifest.js = los chunks que se piden al abrir la ruta) más los del arranque
// (`rootMainFiles` de build-manifest.json). Lo que se carga con import dinámico al usarlo NO está en esta suma: justamente eso es lo que se mide.
//   node scripts/medir/js-rutas.mjs [--json salida.json]
import { readFileSync, readdirSync, statSync, writeFileSync, existsSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { gzipSync } from "node:zlib";

const RAIZ = join(process.cwd(), process.env.NEXT_DIST_DIR || ".next");
const APP = join(RAIZ, "server", "app");
if (!existsSync(APP)) { console.error("No hay .next/server/app: corré `next build` antes."); process.exit(1); }

const tam = new Map();
function pesoDe(archivo) {
  if (tam.has(archivo)) return tam.get(archivo);
  let r = { crudo: 0, gz: 0 };
  try { const b = readFileSync(join(RAIZ, archivo)); r = { crudo: b.length, gz: gzipSync(b).length }; } catch { /* chunk que no está */ }
  tam.set(archivo, r);
  return r;
}

const manifiestos = [];
(function recorrer(dir) {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) recorrer(p);
    else if (n === "page_client-reference-manifest.js") manifiestos.push(p);
  }
})(APP);

let arranque = [];
try {
  const bm = JSON.parse(readFileSync(join(RAIZ, "build-manifest.json"), "utf8"));
  arranque = [...(bm.rootMainFiles ?? []), ...(bm.polyfillFiles ?? [])];
} catch { /* sin build-manifest: solo los de la ruta */ }

const filas = [];
for (const m of manifiestos) {
  const texto = readFileSync(m, "utf8");
  // globalThis.__RSC_MANIFEST["/panel/page"]={...}  (sin espacios): se toma desde la primera llave después del "=".
  const m0 = /__RSC_MANIFEST\[[^\]]*\]\s*=\s*/.exec(texto);
  let json;
  try { json = JSON.parse(texto.slice(m0.index + m0[0].length).trim().replace(/;\s*$/, "")); } catch { console.error(`(no se pudo leer ${m})`); continue; }
  const archivos = new Set(arranque);
  for (const lista of Object.values(json.entryJSFiles ?? {})) for (const f of lista) archivos.add(f);
  let crudo = 0, gz = 0;
  for (const f of archivos) { const x = pesoDe(f); crudo += x.crudo; gz += x.gz; }
  const ruta = "/" + relative(APP, m).split(sep).slice(0, -1).join("/");
  filas.push({ ruta, archivos: archivos.size, crudoKB: +(crudo / 1024).toFixed(1), gzKB: +(gz / 1024).toFixed(1) });
}
filas.sort((a, b) => a.ruta.localeCompare(b.ruta));

const panel = filas.filter((f) => f.ruta.includes("/panel"));
const resumen = (l) => ({ rutas: l.length, gzKB: +l.reduce((s, f) => s + f.gzKB, 0).toFixed(1), crudoKB: +l.reduce((s, f) => s + f.crudoKB, 0).toFixed(1) });
console.log("| Ruta | Chunks | JS (KB) | JS gzip (KB) |\n|---|---|---|---|");
for (const f of panel) console.log(`| ${f.ruta} | ${f.archivos} | ${f.crudoKB} | ${f.gzKB} |`);
const r = resumen(panel);
console.log(`\nRutas del panel: ${r.rutas} · suma ${r.crudoKB} KB (${r.gzKB} KB gzip) · promedio por ruta ${(r.gzKB / Math.max(1, r.rutas)).toFixed(1)} KB gzip`);
const j = process.argv.indexOf("--json");
if (j > 0) writeFileSync(process.argv[j + 1], JSON.stringify({ filas, panel: r }, null, 2));
