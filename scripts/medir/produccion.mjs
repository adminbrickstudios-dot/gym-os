#!/usr/bin/env node
// F0.1 · Medir en producción (Playwright contra el demo publicado, desde Actions).
//   BASE_URL=https://gym-os-pied.vercel.app DEMO_CONTRASENA=… node scripts/medir/produccion.mjs [--md salida.md] [--reps 10]
// Cada pantalla clave se abre N veces (la primera, en frío, se anota aparte). Dos clases de número:
//   · datos: desde pedir la dirección hasta ver contenido (p50, p75, p95);
//   · toque: desde tocar un link del menú hasta el primer cambio en pantalla (esqueleto o contenido).
// Con red 4G emulada (CDP) en el modo celular. La contraseña nunca se imprime.
import { chromium } from "playwright";
import { writeFileSync } from "node:fs";

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] : d; };
const BASE = (process.env.BASE_URL ?? "https://gym-os-pied.vercel.app").replace(/\/$/, "");
const SLUG = process.env.DEMO_SLUG ?? "demo";
const CLAVE = process.env.DEMO_CONTRASENA;
const REPS = Number(arg("reps", "10"));
if (!CLAVE) { console.error("Falta DEMO_CONTRASENA (secreto del repositorio)."); process.exit(2); }

const PANTALLAS = ["/panel", "/panel/entrada", "/panel/socios", "/panel/vencen-hoy", "/panel/caja", "/panel/vender", "/panel/clases", "/panel/retencion"];
const ROLES = [["dueno", "duena@ejemplo.invalid"], ["recepcion", "recepcion@ejemplo.invalid"]];
const TAMANOS = { compu: { width: 1440, height: 900 }, celu: { width: 390, height: 844 } };
const pct = (xs, q) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.min(s.length - 1, Math.floor(q * s.length))] : 0; };

async function sesion(b, viewport, celu, mail) {
  const ctx = await b.newContext({ viewport, isMobile: celu, hasTouch: celu });
  const p = await ctx.newPage();
  if (celu) { // 4G: ~9 Mbps, 170 ms de latencia
    const c = await ctx.newCDPSession(p);
    await c.send("Network.enable");
    await c.send("Network.emulateNetworkConditions", { offline: false, latency: 170, downloadThroughput: 9e6 / 8, uploadThroughput: 9e6 / 8 });
  }
  await p.goto(`${BASE}/g/${SLUG}`, { waitUntil: "domcontentloaded" });   // deja elegido el gimnasio (cookie)
  await p.goto(`${BASE}/ingresar`, { waitUntil: "domcontentloaded" });
  await p.fill("input[type=email]", mail);
  await p.fill("input[type=password]", CLAVE);
  await p.click("button[type=submit]");
  await p.waitForURL((u) => !u.pathname.startsWith("/ingresar"), { timeout: 60000 });
  return { ctx, p };
}

const conContenido = (p) => p.waitForFunction(() => {
  const m = document.querySelector("main") ?? document.body;
  return m && !m.querySelector('[aria-busy="true"]') && (m.innerText ?? "").trim().length > 20;
}, null, { timeout: 30000 }).catch(() => {});

async function datos(p, ruta) {
  const t0 = performance.now();
  const r = await p.goto(`${BASE}${ruta}`, { waitUntil: "commit", timeout: 60000 }).catch(() => null);
  const ttfb = performance.now() - t0;
  await conContenido(p);
  return { ms: Math.round(performance.now() - t0), ttfb: Math.round(ttfb), estado: r?.status() ?? 0 };
}

/** Toque en un link del menú: hasta el primer cambio en <main> (esqueleto o contenido). */
async function toque(p, ruta) {
  const link = p.locator(`a[href="${ruta}"]:visible`).first();
  if (!(await link.count())) return null;
  await p.evaluate(() => {
    window.__t = performance.now(); window.__cambio = null;
    document.addEventListener("pointerdown", () => { window.__t = performance.now(); }, { once: true, capture: true });
    new MutationObserver((_, o) => { window.__cambio = performance.now(); o.disconnect(); })
      .observe(document.querySelector("main") ?? document.body, { childList: true, subtree: true, attributes: true });
  });
  await link.click();
  await p.waitForFunction(() => window.__cambio !== null, null, { timeout: 15000 }).catch(() => {});
  const ms = await p.evaluate(() => (window.__cambio ?? performance.now()) - window.__t);
  await conContenido(p);
  return Math.round(ms);
}

const filas = [];
const b = await chromium.launch();
try {
  for (const [tam, vp] of Object.entries(TAMANOS)) {
    for (const [rol, mail] of ROLES) {
      let s;
      try { s = await sesion(b, vp, tam === "celu", mail); } catch (e) { console.log(`(${rol} · ${tam}: ${String(e.message).split("\n")[0]})`); continue; }
      for (const ruta of PANTALLAS) {
        const frio = await datos(s.p, ruta);
        const ms = [], ttfb = []; let estado = frio.estado;
        for (let i = 0; i < REPS; i++) { const r = await datos(s.p, ruta); ms.push(r.ms); ttfb.push(r.ttfb); estado = r.estado; }
        const toques = [];
        for (let i = 0; i < Math.min(REPS, 5); i++) {
          await datos(s.p, "/panel/tareas");
          const t = await toque(s.p, ruta).catch(() => null);
          if (t != null) toques.push(t);
        }
        filas.push({ rol, tam, ruta, frio: frio.ms, p50: pct(ms, 0.5), p75: pct(ms, 0.75), p95: pct(ms, 0.95), ttfb: pct(ttfb, 0.5), toque: toques.length ? pct(toques, 0.5) : null, estado });
      }
      await s.ctx.close();
    }
  }
} finally { await b.close(); }

const L = ["| Rol | Tamaño | Pantalla | En frío | p50 | p75 | p95 | TTFB p50 | Toque (ms) | Estado | p75 ≤ 500 |", "|---|---|---|---:|---:|---:|---:|---:|---:|---:|---|"];
for (const f of filas) L.push(`| ${f.rol} | ${f.tam} | ${f.ruta} | ${f.frio} | ${f.p50} | ${f.p75} | ${f.p95} | ${f.ttfb} | ${f.toque ?? "-"} | ${f.estado} | ${f.p75 <= 500 ? "ok" : "PASADO"} |`);
const pasadas = filas.filter((f) => f.p75 > 500).length;
L.push("", `Medido ${new Date().toISOString()} contra ${BASE} (${REPS} repeticiones; celu = 4G emulado). ${pasadas} de ${filas.length} pantallas pasan de 500 ms p75.`);
const md = L.join("\n");
console.log(md);
const salida = arg("md");
if (salida) writeFileSync(salida, md + "\n");
