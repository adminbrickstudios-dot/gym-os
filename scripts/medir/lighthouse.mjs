#!/usr/bin/env node
// F1.8 / F0 · Lighthouse en modo CELULAR (4G simulado, el de siempre de Lighthouse) contra las pantallas públicas de un gimnasio.
//   node scripts/medir/lighthouse.mjs [--base http://demo.localhost:3123] [--veces 3] [--salida .local/lighthouse] [--umbral 90]
// Para cada dirección corre Lighthouse `veces` veces y se queda con la corrida MEDIANA por puntaje de performance (una sola corrida varía
// mucho). Escribe la tabla en markdown (puntajes, LCP, CLS, TBT, FCP) en `salida/tabla.md`, en $GITHUB_STEP_SUMMARY si existe, y deja los
// JSON de Lighthouse. Si el performance de la landing queda por debajo del umbral lo dice (::warning::) pero NO corta: la tabla es lo que se compara.
// Requiere Chrome (CHROME_PATH) y la app corriendo. Versión de Lighthouse fija (LIGHTHOUSE_VERSION).
import { spawnSync } from "node:child_process";
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

const errores = [];   // las últimas líneas de lo que dijo Lighthouse cuando falló, para el resumen
function correr(url, archivo) {
  const r = spawnSync("npx", ["--yes", `lighthouse@${VERSION}`, url, "--quiet", "--output=json", `--output-path=${archivo}`,
    "--only-categories=performance,accessibility,best-practices,seo", "--form-factor=mobile", "--screenEmulation.mobile=true",
    "--chrome-flags=--headless=new --no-sandbox --disable-gpu --disable-dev-shm-usage"], { encoding: "utf8", timeout: 240000, maxBuffer: 64 * 1024 * 1024 });
  if (r.status !== 0) {
    const cola = `${r.stderr ?? ""}\n${r.stdout ?? ""}`.split("\n").map((l) => l.trimEnd()).filter(Boolean).slice(-15).join("\n");
    errores.push(`### ${url}\n\`\`\`\n${cola || (r.error ? String(r.error.message) : "sin salida")}\n\`\`\``);
    throw new Error(`código ${r.status ?? "?"}`);
  }
  return JSON.parse(readFileSync(archivo, "utf8"));
}
/** "LCP element: <selector> <url del recurso si es una imagen>" y de dónde sale el tiempo (si Lighthouse lo informa). */
function lcpElemento(r) {
  try {
    const nodo = r.audits["largest-contentful-paint-element"]?.details?.items?.[0]?.items?.[0]?.node;
    const snippet = String(nodo?.snippet ?? "");
    const url = snippet.match(/\bsrc="([^"]+)"/)?.[1]
      ?? r.audits["lcp-discovery-insight"]?.details?.items?.find?.((i) => i.url)?.url
      ?? r.audits["lcp-breakdown-insight"]?.details?.items?.find?.((i) => i.url)?.url ?? "";
    const partes = r.audits["lcp-breakdown-insight"]?.details?.items ?? r.audits["largest-contentful-paint-element"]?.details?.items?.[1]?.items ?? [];
    const desglose = (Array.isArray(partes) ? partes : []).filter((p) => p.subpart || p.phase).map((p) => `${p.subpart ?? p.phase}: ${Math.round(p.duration ?? p.timing ?? 0)} ms`).join(", ");
    return `LCP element: \`${nodo?.selector ?? "?"}\`${url ? ` ${url}` : " (texto, sin recurso)"}${desglose ? ` — ${desglose}` : ""}`.replace(/\|/g, "\\|");
  } catch { return "LCP element: no se pudo leer"; }
}
/** Qué bloquea el primer pintado: recursos que bloquean el render, cadena de pedidos críticos y el JavaScript que más trabaja (evidencia para el LCP de texto). */
function quePinta(r) {
  const partes = [];
  try {
    const bloq = r.audits["render-blocking-resources"]?.details?.items ?? [];
    if (bloq.length) partes.push(`bloquean el render: ${bloq.slice(0, 6).map((i) => `${String(i.url).split("/").slice(-1)[0].slice(0, 40)} (${Math.round(i.wastedMs ?? 0)} ms, ${Math.round((i.totalBytes ?? 0) / 1024)} KB)`).join(", ")}`);
    const cad = r.audits["critical-request-chains"]?.details;
    if (cad?.longestChain) partes.push(`cadena crítica más larga: ${cad.longestChain.count} pedidos, ${Math.round(cad.longestChain.duration)} ms`);
    const js = (r.audits["bootup-time"]?.details?.items ?? []).slice(0, 4).map((i) => `${String(i.url).split("/").slice(-1)[0].slice(0, 34)} (${Math.round(i.total)} ms)`);
    if (js.length) partes.push(`JavaScript que más trabaja: ${js.join(", ")}`);
    const fuentes = r.audits["font-display"]?.details?.items ?? [];
    if (fuentes.length) partes.push(`fuentes sin font-display: ${fuentes.length}`);
    const css = (r.audits["network-requests"]?.details?.items ?? []).filter((i) => /\.css(\?|$)/.test(i.url)).map((i) => `${String(i.url).split("/").slice(-1)[0].slice(0, 30)} ${Math.round((i.transferSize ?? 0) / 1024)} KB`);
    if (css.length) partes.push(`CSS: ${css.join(", ")}`);
    const html = (r.audits["network-requests"]?.details?.items ?? [])[0];
    if (html) partes.push(`HTML: ${Math.round((html.transferSize ?? 0) / 1024)} KB`);
  } catch { /* sin detalle */ }
  return partes.length ? partes.join(" · ").replace(/\|/g, "\\|") : "sin detalle";
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
  filas.push(`| ↳ ${nombre}: elemento LCP | | ${lcpElemento(r)} | | | | | | |`);
  filas.push(`| ↳ ${nombre}: qué bloquea el pintado | | ${quePinta(r)} | | | | | | |`);
  if (principal && perf < UMBRAL) { avisos++; console.log(`::warning::Lighthouse móvil: la landing saca ${perf} de performance (objetivo ${UMBRAL}).`); }
  const malas = Object.values(r.audits).filter((a) => a.score !== null && a.score < 0.9 && a.details?.type !== "debugdata" && (a.scoreDisplayMode === "numeric" || a.scoreDisplayMode === "binary" || a.scoreDisplayMode === "metricSavings"))
    .sort((a, b) => a.score - b.score).slice(0, 8).map((a) => `${a.title} (${Math.round(a.score * 100)})`);
  if (malas.length) filas.push(`| ↳ ${nombre}: lo que más baja | | ${malas.join(" · ")} | | | | | | |`);
}
const tabla = [
  `## Lighthouse móvil · ${BASE} · Lighthouse ${VERSION} · mediana de ${VECES} corridas`, "",
  "| Pantalla | Ruta | Performance | Accesibilidad | Buenas prácticas | SEO | LCP | CLS | TBT |", "|---|---|---:|---:|---:|---:|---:|---:|---:|", ...filas, "",
  ...(errores.length ? ["## Lo que dijo Lighthouse cuando falló (últimas 15 líneas)", "", ...errores, ""] : []),
  `Objetivo F1.8: performance ≥ ${UMBRAL} en celular; objetivo de la fase 0: 95 y LCP < 1,5 s.${avisos ? ` **La landing quedó por debajo de ${UMBRAL}.**` : ""}`, "",
].join("\n");
writeFileSync(join(SALIDA, "tabla.md"), tabla);
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${tabla}\n`);
console.log(tabla);
