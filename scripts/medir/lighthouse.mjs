#!/usr/bin/env node
// F1.8 / F0 · Lighthouse en modo CELULAR (4G simulado, el de siempre de Lighthouse) contra las pantallas públicas de un gimnasio.
//   node scripts/medir/lighthouse.mjs [--base http://demo.localhost:3123] [--veces 3] [--salida .local/lighthouse] [--umbral 90]
// Para cada dirección corre Lighthouse `veces` veces y se queda con la corrida MEDIANA por puntaje de performance (una sola corrida varía
// mucho). Escribe la tabla en markdown (puntajes, LCP, CLS, TBT, FCP) en `salida/tabla.md`, en $GITHUB_STEP_SUMMARY si existe, y deja los
// JSON de Lighthouse. Si el performance de la landing queda por debajo del umbral lo dice (::warning::) pero NO corta: la tabla es lo que se compara.
// Requiere Chrome (CHROME_PATH) y la app corriendo. Versión de Lighthouse fija (LIGHTHOUSE_VERSION).
import { execFileSync } from "node:child_process";
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] : d; };
const BASE = arg("base", `http://demo.localhost:${process.env.PUERTO_APP ?? "3123"}`).replace(/\/$/, "");
const VECES = Number(arg("veces", "3"));
const SALIDA = arg("salida", ".local/lighthouse");
const UMBRAL = Number(arg("umbral", "90"));
const VERSION = process.env.LIGHTHOUSE_VERSION ?? "12.6.1";
const PAGINAS = [
  ["Landing del gimnasio", "/", true],
  ["Ingresar (equipo)", "/ingresar", false],
  ["Ingresar (socio)", "/ingresar?modo=socio", false],
  ["Quiero ser socio", "/hacete-socio", false],
];
mkdirSync(SALIDA, { recursive: true });

function correr(url, archivo) {
  execFileSync("npx", ["--yes", `lighthouse@${VERSION}`, url, "--quiet", "--output=json", `--output-path=${archivo}`,
    "--only-categories=performance,accessibility,best-practices,seo", "--form-factor=mobile", "--screenEmulation.mobile=true",
    "--chrome-flags=--headless=new --no-sandbox --disable-gpu --disable-dev-shm-usage"], { stdio: ["ignore", "inherit", "inherit"], timeout: 240000 });
  return JSON.parse(readFileSync(archivo, "utf8"));
}
const pct = (r, k) => Math.round((r.categories[k]?.score ?? 0) * 100);
const num = (r, k) => r.audits[k]?.numericValue;

const filas = [];
let avisos = 0;
for (const [nombre, ruta, principal] of PAGINAS) {
  const url = `${BASE}${ruta}`;
  const corridas = [];
  for (let i = 0; i < VECES; i++) {
    try { corridas.push(correr(url, join(SALIDA, `${nombre.replace(/\W+/g, "-").toLowerCase()}-${i + 1}.json`))); }
    catch (e) { console.error(`Lighthouse falló en ${url} (corrida ${i + 1}): ${String(e.message).split("\n")[0]}`); }
  }
  if (!corridas.length) { filas.push(`| ${nombre} | \`${ruta}\` | sin medir | | | | | | |`); continue; }
  corridas.sort((a, b) => pct(a, "performance") - pct(b, "performance"));
  const r = corridas[Math.floor(corridas.length / 2)];
  const perf = pct(r, "performance");
  filas.push(`| ${nombre} | \`${ruta}\` | **${perf}** | ${pct(r, "accessibility")} | ${pct(r, "best-practices")} | ${pct(r, "seo")} | ${(num(r, "largest-contentful-paint") / 1000).toFixed(2)} s | ${num(r, "cumulative-layout-shift").toFixed(3)} | ${Math.round(num(r, "total-blocking-time"))} ms |`);
  if (principal && perf < UMBRAL) { avisos++; console.log(`::warning::Lighthouse móvil: la landing saca ${perf} de performance (objetivo ${UMBRAL}).`); }
  const malas = Object.values(r.audits).filter((a) => a.score !== null && a.score < 0.9 && a.details?.type !== "debugdata" && (a.scoreDisplayMode === "numeric" || a.scoreDisplayMode === "binary" || a.scoreDisplayMode === "metricSavings"))
    .sort((a, b) => a.score - b.score).slice(0, 8).map((a) => `${a.title} (${Math.round(a.score * 100)})`);
  if (malas.length) filas.push(`| ↳ ${nombre}: lo que más baja | | ${malas.join(" · ")} | | | | | | |`);
}
const tabla = [
  `## Lighthouse móvil · ${BASE} · Lighthouse ${VERSION} · mediana de ${VECES} corridas`, "",
  "| Pantalla | Ruta | Performance | Accesibilidad | Buenas prácticas | SEO | LCP | CLS | TBT |", "|---|---|---:|---:|---:|---:|---:|---:|---:|", ...filas, "",
  `Objetivo F1.8: performance ≥ ${UMBRAL} en celular; objetivo de la fase 0: 95 y LCP < 1,5 s.${avisos ? ` **La landing quedó por debajo de ${UMBRAL}.**` : ""}`, "",
].join("\n");
writeFileSync(join(SALIDA, "tabla.md"), tabla);
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${tabla}\n`);
console.log(tabla);
