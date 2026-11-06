#!/usr/bin/env node
// VD-47X · explain analyze de las funciones de las pantallas principales contra el demo.
//   node scripts/medir/explain.mjs --url postgres://... [--gimnasio demo] [--plan]
// Corre cada función como el dueño del gimnasio (rol authenticated, claims con su usuario), dentro de una
// transacción que se revierte, y muestra el tiempo de ejecución. Con --plan imprime también el plan completo.
// No corta: avisa las que pasan de 300 ms y sale con 0 (lo usan las Pruebas completas más adelante para
// comparar antes / después; contra una base con 3.000 socios es donde dice algo).
import pg from "pg";

const arg = (n) => { const i = process.argv.indexOf(`--${n}`); return i > -1 ? process.argv[i + 1] : undefined; };
const url = arg("url") ?? process.env.DB_PRUEBAS_URL ?? process.env.SUPABASE_DB_URL;
const slug = arg("gimnasio") ?? "demo";
const verPlan = process.argv.includes("--plan");
if (!url) { console.error("Falta --url o DB_PRUEBAS_URL"); process.exit(1); }
if (/supabase\.(co|com)/.test(url)) { console.error("explain.mjs no corre contra Supabase real"); process.exit(1); }

const db = new pg.Client({ connectionString: url });
await db.connect();
const filas = [];
let cuantosSocios = 0;
try {
  const { rows: [g] } = await db.query("select id from public.gimnasios where slug = $1", [slug]);
  if (!g) throw new Error(`No hay gimnasio "${slug}" (sembrar el demo: npm run sembrar:demo)`);
  const { rows: [d] } = await db.query("select usuario_id from public.equipo where gimnasio_id = $1 and rol = 'dueno' and usuario_id is not null limit 1", [g.id]);
  if (!d) throw new Error("El gimnasio no tiene dueño con usuario");
  const { rows: [{ n }] } = await db.query("select count(*)::int n from public.socios where gimnasio_id = $1", [g.id]); cuantosSocios = n;

  const LLAMADAS = [
    ["buscar_socios (sin filtro)", "select * from public.buscar_socios($1, '', 60)"],
    ["buscar_socios (texto)", "select * from public.buscar_socios($1, 'mar', 60)"],
    ["buscar_socios (al día)", "select * from public.buscar_socios($1, '', 60, null, 'al_dia')"],
    ["buscar_socios (nuevos)", "select * from public.buscar_socios($1, '', 60, null, 'nuevos')"],
    ["buscar_socios (bajas)", "select * from public.buscar_socios($1, '', 60, null, 'bajas')"],
    ["filtros_socios", "select public.filtros_socios($1)"],
    ["vencen_hoy", "select * from public.vencen_hoy($1)"],
    ["retencion", "select * from public.retencion($1)"],
    ["retencion_resumen", "select public.retencion_resumen($1)"],
    ["numeros_inicio", "select public.numeros_inicio($1)"],
  ];
  for (const [nombre, sql] of LLAMADAS) {
    await db.query("begin");
    try {
      await db.query("set local role authenticated");
      await db.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: d.usuario_id, role: "authenticated" })]);
      // auto_explain no ve adentro de las funciones: se mide la llamada entera, que es lo que paga la pantalla.
      const { rows } = await db.query(`explain (analyze, buffers, format text) ${sql}`, [g.id]);
      const texto = rows.map((r) => r["QUERY PLAN"]).join("\n");
      const ms = Number(/Execution Time: ([\d.]+) ms/.exec(texto)?.[1] ?? NaN);
      filas.push({ nombre, ms });
      if (verPlan) console.log(`\n── ${nombre}\n${texto}`);
    } catch (e) {
      filas.push({ nombre, ms: NaN, error: String(e.message).split("\n")[0] });
    } finally {
      await db.query("rollback");
    }
  }
} finally {
  await db.end();
}

console.log(`\nexplain analyze · gimnasio "${slug}" (${cuantosSocios} socios)\n`);
console.log("| función | ms |\n|---|---|");
for (const f of filas) console.log(`| ${f.nombre} | ${f.error ? `error: ${f.error}` : f.ms.toFixed(1)} |`);
const lentas = filas.filter((f) => f.ms > 300);
if (lentas.length) console.log(`\nPasan de 300 ms: ${lentas.map((f) => f.nombre).join(", ")}`);
