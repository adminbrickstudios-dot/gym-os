#!/usr/bin/env node
// Parte 3 (24/11) · Los módulos que más pesan en el JS que baja el navegador, y en qué rutas caen.
// Next 16 compila con Turbopack (no hay @next/bundle-analyzer): se compila con mapas (MAPAS_JS=1 next build), se reparte cada byte
// de cada chunk entre los archivos fuente que lo generaron (los mapas) y se cruza con la primera carga de cada ruta que escribe Next
// en .next/diagnostics/route-bundle-stats.json.
//   MAPAS_JS=1 npx next build && node scripts/medir/modulos-pesados.mjs [--top 15] [--json salida.json]
import { readFileSync, existsSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { SourceMapConsumer } from "source-map-js";

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] : d; };
const TOP = Number(arg("top", "15"));
const RAIZ = process.env.NEXT_DIST_DIR || ".next";
const stats = JSON.parse(readFileSync(join(RAIZ, "diagnostics", "route-bundle-stats.json"), "utf8"));
const norm = (p) => p.replaceAll("\\", "/");

// Un nombre corto para cada fuente: el paquete de node_modules, o la ruta dentro de src/.
function modulo(fuente) {
  const f = norm(fuente).replace(/^turbopack:\/\/\/?/, "").replace(/^\[project\]\//, "");
  const nm = f.lastIndexOf("node_modules/");
  if (nm >= 0) {
    const resto = f.slice(nm + 13).split("/");
    return resto[0].startsWith("@") ? `${resto[0]}/${resto[1]}` : resto[0];
  }
  const src = f.indexOf("src/");
  return src >= 0 ? f.slice(src) : f;
}

// Bytes de cada chunk repartidos por fuente.
const porChunk = new Map();
function repartir(chunk) {
  if (porChunk.has(chunk)) return porChunk.get(chunk);
  const reparto = new Map();
  const codigo = existsSync(chunk) ? readFileSync(chunk, "utf8") : "";
  // El mapa de cada chunk: el que nombra su sourceMappingURL (Turbopack no siempre lo llama <chunk>.map).
  const url = codigo.match(/\/\/# sourceMappingURL=(\S+)\s*$/)?.[1];
  const mapa = url && !url.startsWith("data:") ? join(dirname(chunk), decodeURIComponent(url)) : `${chunk}.map`;
  if (!existsSync(mapa)) { reparto.set("(sin mapa)", Buffer.byteLength(codigo)); porChunk.set(chunk, reparto); return reparto; }
  const crudo = JSON.parse(readFileSync(mapa, "utf8"));
  const secciones = crudo.sections ? crudo.sections.map((s) => ({ ...s.map, offset: s.offset })) : [{ ...crudo, offset: { line: 0, column: 0 } }];
  const lineas = codigo.split("\n");
  const segmentos = [];   // [línea, columna, fuente]
  for (const s of secciones) {
    const c = new SourceMapConsumer(s);
    c.eachMapping((m) => segmentos.push([m.generatedLine - 1 + s.offset.line, m.generatedColumn + (m.generatedLine === 1 ? s.offset.column : 0), m.source ? modulo(m.source) : "(sin fuente)"]));
  }
  segmentos.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  for (let i = 0; i < segmentos.length; i++) {
    const [l, col, f] = segmentos[i];
    const sig = segmentos[i + 1];
    const fin = sig && sig[0] === l ? sig[1] : (lineas[l] ?? "").length;
    reparto.set(f, (reparto.get(f) ?? 0) + Math.max(0, fin - col));
  }
  porChunk.set(chunk, reparto);
  return reparto;
}

const total = new Map();    // módulo → bytes (cada chunk se cuenta una vez)
const rutas = new Map();    // módulo → rutas donde cae en la primera carga
const vistos = new Set();
for (const r of stats) {
  for (const c of r.firstLoadChunkPaths.map(norm)) {
    const reparto = repartir(c);
    for (const [m, b] of reparto) {
      if (!vistos.has(c)) total.set(m, (total.get(m) ?? 0) + b);
      if (!rutas.has(m)) rutas.set(m, new Set());
      rutas.get(m).add(r.route);
    }
    vistos.add(c);
  }
}
const n = stats.length;
const filas = [...total].sort((a, b) => b[1] - a[1]).slice(0, TOP).map(([m, b]) => {
  const rs = [...rutas.get(m)];
  const donde = rs.length === n ? `todas (${n})` : rs.length > 6 ? `${rs.length} de ${n}: ${rs.slice(0, 4).join(", ")}…` : rs.join(", ");
  return { modulo: m, kb: +(b / 1024).toFixed(1), rutas: rs.length, donde };
});
console.log(`## Los ${TOP} módulos más pesados de la primera carga (sin comprimir)\n`);
console.log("| # | Módulo | KB | Rutas |");
console.log("|---:|---|---:|---|");
filas.forEach((f, i) => console.log(`| ${i + 1} | \`${f.modulo}\` | ${f.kb} | ${f.donde} |`));
// La primera carga de las pantallas que se miden (lo que dice Next, sin comprimir, y comprimido con gzip).
import("node:zlib").then(({ gzipSync }) => {
  const CLAVE = ["/panel", "/panel/entrada", "/panel/socios", "/panel/socios/[id]", "/panel/caja", "/panel/clases", "/app", "/", "/kiosco", "/hacete-socio"];
  console.log("\n## Primera carga de JS por pantalla\n");
  console.log("| Ruta | JS (KB) | JS gzip (KB) | Chunks |");
  console.log("|---|---:|---:|---:|");
  for (const ruta of CLAVE) {
    const r = stats.find((x) => x.route === ruta);
    if (!r) { console.log(`| ${ruta} | — | — | — |`); continue; }
    const gz = r.firstLoadChunkPaths.map(norm).reduce((a, c) => a + (existsSync(c) ? gzipSync(readFileSync(c)).length : 0), 0);
    console.log(`| ${ruta} | ${(r.firstLoadUncompressedJsBytes / 1024).toFixed(1)} | ${(gz / 1024).toFixed(1)} | ${r.firstLoadChunkPaths.length} |`);
  }
});
const j = arg("json");
if (j) writeFileSync(j, JSON.stringify(filas, null, 2));
