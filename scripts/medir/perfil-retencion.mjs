#!/usr/bin/env node
// F1.6 · Por dentro de la Retención: tiempos de la función de antes (privado.retencion_referencia) contra las nuevas, y el plan de
// explain analyze de privado.retencion_pendientes con las cuentas reales del gimnasio demo.
//   node scripts/medir/perfil-retencion.mjs --url postgres://… [--gimnasio demo] [--plan]
import pg from "pg";

const arg = (n) => { const i = process.argv.indexOf(`--${n}`); return i > -1 ? process.argv[i + 1] : undefined; };
const url = arg("url") ?? process.env.DB_PRUEBAS_URL;
if (!url) { console.error("Falta --url"); process.exit(1); }
if (/supabase\.(co|com)/.test(url)) { console.error("No corre contra Supabase real"); process.exit(1); }
const db = new pg.Client({ connectionString: url });
await db.connect();
const { rows: [g] } = await db.query("select id from public.gimnasios where slug = $1", [arg("gimnasio") ?? "demo"]);
const n = (await db.query("select count(*)::int n from public.socios where gimnasio_id = $1", [g.id])).rows[0].n;
const cub = (await db.query("select count(*)::int n from public.socios where gimnasio_id = $1 and cubierto_hasta > now()", [g.id])).rows[0].n;
const ing = (await db.query("select count(*)::int n from public.ingresos where gimnasio_id = $1", [g.id])).rows[0].n;
console.log(`Gimnasio ${arg("gimnasio") ?? "demo"}: ${n} socios, ${cub} con cobertura vigente o futura, ${ing} ingresos\n`);

const casos = {
  "completa · ANTES  (retencion_referencia)": `select count(*) from privado.retencion_referencia('${g.id}', now(), null, false)`,
  "completa · AHORA  (retencion_con)": `select count(*) from privado.retencion_con('${g.id}', now(), null, false)`,
  "3 listas liviana · ANTES (referencia)": `select count(*) from privado.retencion_referencia('${g.id}', now(), null, true) where lista in ('por_vencer','no_viene','nuevo')`,
  "3 listas liviana · AHORA (retencion_listas)": `select count(*) from privado.retencion_listas('${g.id}', now(), array['por_vencer','no_viene','nuevo'], true)`,
  "Pendientes · AHORA (retencion_pendientes)": `select count(*) from privado.retencion_pendientes('${g.id}', now())`,
  "solo por_vencer · ANTES (referencia)": `select count(*) from privado.retencion_referencia('${g.id}', now(), null, false) where lista = 'por_vencer'`,
  "solo por_vencer · AHORA (retencion_listas)": `select count(*) from privado.retencion_listas('${g.id}', now(), array['por_vencer'], false)`,
};
for (const [nombre, sql] of Object.entries(casos)) {
  const t = [];
  for (let i = 0; i < 5; i++) { const a = performance.now(); await db.query(sql); t.push(performance.now() - a); }
  t.sort((x, y) => x - y);
  console.log(`${nombre.padEnd(48)} mejor ${t[0].toFixed(0).padStart(5)} ms · mediana ${t[2].toFixed(0).padStart(5)} ms`);
}

if (process.argv.includes("--plan")) {
  for (const f of ["privado.retencion_pendientes(uuid, timestamptz)"]) {
    const { rows: [{ prosrc }] } = await db.query("select prosrc from pg_proc where oid = $1::regprocedure", [f]);
    const cuerpo = prosrc.replaceAll("p_gimnasio_id", `'${g.id}'::uuid`).replaceAll("p_momento", "now()");
    const { rows } = await db.query(`explain (analyze, buffers, timing on) ${cuerpo}`);
    console.log(`\nPlan de ${f}:\n` + rows.map((r) => r["QUERY PLAN"]).join("\n"));
  }
}
await db.end();
