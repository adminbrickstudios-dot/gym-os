#!/usr/bin/env node
// E4 · Qué pesa en el JS compartido del panel (después de `next build`).
// Toma los chunks que piden TODAS las rutas del panel (lo del layout, que viaja a cada pantalla), los ordena por peso y
// busca en cada uno las firmas de las librerías conocidas. Sirve para decidir qué sacar del layout (import dinámico).
//   node scripts/medir/chunks-panel.mjs
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { gzipSync } from "node:zlib";

const RAIZ = join(process.cwd(), process.env.NEXT_DIST_DIR || ".next");
const APP = join(RAIZ, "server", "app");
if (!existsSync(APP)) { console.error("No hay .next/server/app: corré `next build` antes."); process.exit(1); }

const FIRMAS = {
  "supabase realtime": /RealtimeClient|phoenix|realtime-js|RealtimeChannel/,
  "supabase auth (gotrue)": /GoTrueClient|gotrue/,
  "supabase postgrest": /PostgrestClient|PostgrestBuilder/,
  "supabase storage": /StorageClient|storage-js/,
  "qrcode": /qrcode|QRCode/i,
  "lector de QR/cámara": /BarcodeDetector|getUserMedia|jsqr|zxing/i,
  "gráficos": /recharts|d3-|victory|chart\.js/i,
  "fechas": /date-fns|dayjs|moment/i,
  "zod": /ZodError|\bz\.object/,
  "dnd": /dnd-kit|react-dnd|sortablejs/i,
  "excel/csv": /xlsx|papaparse|exceljs/i,
  "react-dom": /react-dom|scheduler/,
  "next router/cliente": /next\/dist\/client|app-router|__next_/,
  "buscador (Ctrl+K)": /Buscar socio|data-buscador/,
  "ventana de entrada": /data-ventana-|Sin internet: anotá en papel|data-barrita/,
  "cobrar": /data-cobrar/,
  "íconos": /M\d+(\.\d+)? \d+(\.\d+)?[a-zA-Z]/,
};

const por = new Map();   // ruta -> Set(chunks)
(function recorrer(dir) {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) recorrer(p);
    else if (n === "page_client-reference-manifest.js") {
      const t = readFileSync(p, "utf8");
      const m0 = /__RSC_MANIFEST\[[^\]]*\]\s*=\s*/.exec(t);
      try {
        const j = JSON.parse(t.slice(m0.index + m0[0].length).trim().replace(/;\s*$/, ""));
        const s = new Set();
        for (const l of Object.values(j.entryJSFiles ?? {})) for (const f of l) s.add(f);
        por.set("/" + relative(APP, p).split(sep).slice(0, -1).join("/"), s);
      } catch { /* manifiesto raro */ }
    }
  }
})(APP);

const rutas = [...por.keys()].filter((r) => r.includes("/panel"));
if (!rutas.length) { console.error("No se encontraron rutas del panel"); process.exit(1); }
let comunes = new Set(por.get(rutas[0]));
for (const r of rutas) comunes = new Set([...comunes].filter((f) => por.get(r).has(f)));
const todos = new Set(); for (const r of rutas) for (const f of por.get(r)) todos.add(f);

const filas = [...comunes].map((f) => {
  const b = readFileSync(join(RAIZ, f)); const t = b.toString("utf8");
  const firmas = Object.entries(FIRMAS).filter(([, re]) => re.test(t)).map(([k]) => k);
  return { f, crudo: b.length, gz: gzipSync(b).length, firmas };
}).sort((a, b) => b.gz - a.gz);

const kb = (n) => (n / 1024).toFixed(1);
const sumaGz = filas.reduce((s, x) => s + x.gz, 0);
console.log(`Rutas del panel: ${rutas.length} · chunks distintos: ${todos.size} · chunks en TODAS (lo del layout): ${comunes.size} = ${kb(sumaGz)} KB gzip\n`);
console.log("| Chunk | KB | KB gzip | Firmas |\n|---|---|---|---|");
for (const x of filas.slice(0, 25)) console.log(`| ${x.f.replace(/^static\//, "")} | ${kb(x.crudo)} | ${kb(x.gz)} | ${x.firmas.join(", ") || "—"} |`);
// Un chunk que solo pide UNA ruta es de esa pantalla; lo que pesa en el layout es lo común. Cuánto pesa lo propio de cada ruta, de mayor a menor:
const propios = rutas.map((r) => { let gz = 0; for (const f of por.get(r)) if (!comunes.has(f)) gz += gzipSync(readFileSync(join(RAIZ, f))).length; return { r, gz }; }).sort((a, b) => b.gz - a.gz);
console.log("\nLo propio de cada ruta (KB gzip, sin lo común), las 10 más pesadas:");
for (const x of propios.slice(0, 10)) console.log(`- ${x.r}: ${kb(x.gz)}`);
