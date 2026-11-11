#!/usr/bin/env node
// F9.5 · ESC-04 · Prueba de carga: 1.000 gimnasios y 500 usuarios simultáneos. SOLO local o Actions, NUNCA contra producción.
//
//   node scripts/datos/cargar-gimnasios.mjs --url "$URL" --gimnasios 1000      (siembra primero)
//   node scripts/medir/carga.mjs --url "$URL" [--usuarios 500] [--conexiones 50] [--segundos 60] [--app http://localhost:3123] [--md salida.md] [--json salida.json]
//
// Qué hace:
//  1. Deja un dueño con cuenta en los primeros N gimnasios de carga (idempotente).
//  2. Lanza `usuarios` usuarios virtuales a la vez. Cada uno, durante `segundos`, hace lo que hace un dueño en el panel (pendientes, inicio,
//     buscar socios, últimas entradas, vencen hoy) como rol `authenticated` con sus claims, con pausas de 0,2 a 0,8 s entre pantallas.
//     Las conexiones salen de un pool de `conexiones` (como el pooler de transacciones de Supabase): 500 usuarios comparten pocas conexiones.
//  3. Con --app, además 500 visitantes piden la web pública de distintos gimnasios (por Host) a la app levantada.
//  4. Muestra p50 / p95 / p99 / máximo por pantalla, errores y pedidos por segundo. Con --estricto (por defecto) sale con 1 si algún p95 pasa
//     el presupuesto (300 ms) o hay errores.
// Se niega contra Supabase y contra cualquier base que no sea de la compu o de Actions.
import { writeFileSync } from "node:fs";
import http from "node:http";
import pg from "pg";

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] : d; };
const url = arg("url", process.env.DB_PRUEBAS_URL);
const usuarios = Number(arg("usuarios", "500"));
const conexiones = Number(arg("conexiones", "50"));
const segundos = Number(arg("segundos", "60"));
const app = arg("app", "");
const estricto = !process.argv.includes("--sin-estricto");
const PRESUPUESTO_P95 = Number(arg("presupuesto", "300"));
if (!url) { console.error("Falta --url o DB_PRUEBAS_URL"); process.exit(1); }
{
  // Solo una base de esta compu o del runner de Actions (localhost / 127.0.0.1 / socket): cualquier otro host, incluido Supabase, se rechaza.
  let host = "";
  try { host = new URL(url).hostname || new URL(url).searchParams.get("host") || ""; } catch { host = ""; }
  if (!["localhost", "127.0.0.1", "[::1]", "::1"].includes(host) && !host.startsWith("/")) {
    console.error("La prueba de carga corre solo contra una base local o de Actions: nunca contra producción."); process.exit(1);
  }
}
if (app && !/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/?$/.test(app)) { console.error("--app tiene que ser la app local (http://localhost:PUERTO)."); process.exit(1); }
if (!(usuarios > 0 && conexiones > 0 && segundos > 0)) { console.error("--usuarios, --conexiones y --segundos tienen que ser positivos"); process.exit(1); }

const pool = new pg.Pool({ connectionString: url, max: conexiones });
const pausa = (ms) => new Promise((r) => setTimeout(r, ms));
const azar = (a, b) => a + Math.random() * (b - a);
const percentil = (v, p) => { if (!v.length) return 0; const s = [...v].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.ceil((p / 100) * s.length) - 1)]; };

// ── 1. Preparación: un dueño con cuenta en cada gimnasio que va a usar un usuario virtual ──
const { rows: gimnasios } = await pool.query(`select id, slug from public.gimnasios where slug like 'carga-%' order by slug limit $1`, [usuarios]);
if (gimnasios.length < usuarios) { console.error(`Hay ${gimnasios.length} gimnasios de carga y se piden ${usuarios} usuarios: sembrá más (cargar-gimnasios.mjs --gimnasios ${usuarios}).`); await pool.end(); process.exit(1); }
const { rows: [{ total: totalGim }] } = await pool.query(`select count(*)::int total from public.gimnasios`);
const virtuales = [];
{
  const c = await pool.connect();
  try {
    await c.query("begin");
    for (const g of gimnasios) {
      const mail = `carga-dueno-${g.slug}@ejemplo.invalid`;
      let u = (await c.query(`select id from auth.users where email = $1`, [mail])).rows[0]?.id;
      if (!u) u = (await c.query(`insert into auth.users (email, email_confirmed_at) values ($1, now()) returning id`, [mail])).rows[0].id;
      const e = await c.query(`select 1 from public.equipo where gimnasio_id = $1 and usuario_id = $2`, [g.id, u]);
      if (!e.rowCount) await c.query(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1, $2, 'Dueño de carga', 'dueno')`, [g.id, u]);
      virtuales.push({ gimnasio: g.id, usuario: u });
    }
    await c.query("commit");
  } catch (e) { await c.query("rollback"); throw e; } finally { c.release(); }
}
await pool.query("analyze");

// ── 2. Usuarios simultáneos ──
const PANTALLAS = [
  ["pendientes_panel", "select public.pendientes_panel($1)"],
  ["panel_inicio", "select public.panel_inicio($1)"],
  ["buscar_socios", "select * from public.buscar_socios($1, '', 60)"],
  ["ultimas_entradas", "select public.ultimas_entradas($1)"],
  ["vencen_hoy", "select * from public.vencen_hoy($1)"],
];
const medidas = Object.fromEntries(PANTALLAS.map(([n]) => [n, []]));
const errores = Object.fromEntries(PANTALLAS.map(([n]) => [n, 0]));
const mensajes = new Map();
let pedidos = 0;
const fin = Date.now() + segundos * 1000;

async function usuarioVirtual(v) {
  await pausa(azar(0, 2000));   // entran escalonados, no todos en el mismo milisegundo
  while (Date.now() < fin) {
    const [nombre, sql] = PANTALLAS[Math.floor(Math.random() * PANTALLAS.length)];
    const t0 = performance.now();
    let c;
    try {
      c = await pool.connect();
      await c.query("begin");
      await c.query("set local role authenticated");
      await c.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: v.usuario, role: "authenticated" })]);
      await c.query(sql, [v.gimnasio]);
      await c.query("commit");
      medidas[nombre].push(performance.now() - t0);
    } catch (e) {
      errores[nombre]++; mensajes.set(e.message.slice(0, 120), (mensajes.get(e.message.slice(0, 120)) ?? 0) + 1);
      try { await c?.query("rollback"); } catch { /* la conexión ya estaba rota */ }
    } finally { c?.release(); pedidos++; }
    await pausa(azar(200, 800));
  }
}

// ── 3. (opcional) visitantes a la web pública, por Host ──
const web = { ms: [], errores: 0, pedidos: 0 };
async function visitante() {
  if (!app) return;
  const agente = new http.Agent({ keepAlive: true });
  const u = new URL(app);
  await pausa(azar(0, 2000));
  while (Date.now() < fin) {
    const g = gimnasios[Math.floor(Math.random() * gimnasios.length)];
    const t0 = performance.now();
    await new Promise((resolver) => {
      const r = http.request({ host: u.hostname, port: u.port || 80, path: "/", agent: agente, headers: { host: `${g.slug}.localhost${u.port ? `:${u.port}` : ""}` }, timeout: 20000 }, (res) => {
        res.resume(); res.on("end", () => { (res.statusCode < 500 ? web.ms.push(performance.now() - t0) : web.errores++); web.pedidos++; resolver(); });
      });
      r.on("timeout", () => { r.destroy(); web.errores++; web.pedidos++; resolver(); });
      r.on("error", () => { web.errores++; web.pedidos++; resolver(); });
      r.end();
    });
    await pausa(azar(300, 1200));
  }
  agente.destroy();
}

const inicio = Date.now();
await Promise.all([...virtuales.map(usuarioVirtual), ...(app ? Array.from({ length: usuarios }, visitante) : [])]);
const dur = (Date.now() - inicio) / 1000;
await pool.end();

// ── 4. Resultados ──
const filas = PANTALLAS.map(([n]) => ({ pantalla: n, pedidos: medidas[n].length + errores[n], errores: errores[n], p50: percentil(medidas[n], 50), p95: percentil(medidas[n], 95), p99: percentil(medidas[n], 99), max: Math.max(0, ...medidas[n]) }));
if (app) filas.push({ pantalla: "web pública (/ por Host)", pedidos: web.pedidos, errores: web.errores, p50: percentil(web.ms, 50), p95: percentil(web.ms, 95), p99: percentil(web.ms, 99), max: Math.max(0, ...web.ms) });
const f = (x) => x.toFixed(0).padStart(5);
const md = [
  `## Carga: ${usuarios} usuarios simultáneos, ${totalGim} gimnasios, ${conexiones} conexiones, ${segundos} s${app ? ", con web pública" : ""}`, "",
  "| Pantalla | Pedidos | Errores | p50 ms | p95 ms | p99 ms | Máx ms |", "|---|---:|---:|---:|---:|---:|---:|",
  ...filas.map((r) => `| ${r.pantalla} | ${r.pedidos} | ${r.errores} | ${f(r.p50)} | ${f(r.p95)}${r.p95 > PRESUPUESTO_P95 ? " ⚠" : ""} | ${f(r.p99)} | ${f(r.max)} |`),
  "", `Pedidos por segundo: ${(filas.reduce((s, r) => s + r.pedidos, 0) / dur).toFixed(1)} · presupuesto de p95: ${PRESUPUESTO_P95} ms`,
  ...(mensajes.size ? ["", "Errores distintos:", ...[...mensajes].map(([m, n]) => `- ${n} × ${m}`)] : []),
].join("\n");
console.log(md);
if (arg("md")) writeFileSync(arg("md"), md + "\n");
if (arg("json")) writeFileSync(arg("json"), JSON.stringify({ usuarios, gimnasios: totalGim, conexiones, segundos, filas }, null, 2));
const pasan = filas.filter((r) => r.errores > 0 || r.p95 > PRESUPUESTO_P95);
if (estricto && pasan.length) { console.error(`\nNo cumple: ${pasan.map((r) => r.pantalla).join(", ")}`); process.exit(1); }
