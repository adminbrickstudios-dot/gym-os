#!/usr/bin/env node
// Pase 2.0 · antes de borrar el clásico (Mateo, 26/11): los 2 gimnasios no demo que seguían en estilo clásico son de prueba.
// Los marca es_demo = true. Guardas: exactamente esos 2 (no demo, estilo distinto de pista o sin fila), nunca Temple Gym,
// y se verifican las filas afectadas. Todo en una transacción. Solo números en el log (el log de Actions es público).
// Lo corre el workflow "Base de datos" → marcar-demo.
import pg from "pg";

const url = process.env.SUPABASE_DB_URL;
if (!url) { console.error("Falta SUPABASE_DB_URL"); process.exit(1); }
const ESPERADOS = 2;
const db = new pg.Client({ connectionString: url });
await db.connect();
try {
  await db.query("begin");
  const { rows } = await db.query(`
    select g.id from public.gimnasios g left join public.configuracion_gimnasio c on c.gimnasio_id = g.id
     where not g.es_demo and coalesce(c.estilo, 'clasico') <> 'pista'
       and not exists (select 1 from public.dominios_gimnasio d where d.gimnasio_id = g.id and d.host = 'templegymsalta.com')
     for update of g`);
  if (rows.length !== ESPERADOS) throw new Error(`se esperaban ${ESPERADOS} gimnasios no demo en clásico y hay ${rows.length}: no se toca nada`);
  const r = await db.query(`update public.gimnasios set es_demo = true where id = any($1::uuid[]) and not es_demo`, [rows.map((x) => x.id)]);
  if (r.rowCount !== ESPERADOS) throw new Error(`se marcaron ${r.rowCount} filas y se esperaban ${ESPERADOS}: se revierte`);
  const { rows: [t] } = await db.query(`select g.es_demo from public.gimnasios g where exists (select 1 from public.dominios_gimnasio d where d.gimnasio_id = g.id and d.host = 'templegymsalta.com')`);
  if (!t || t.es_demo) throw new Error("Temple Gym no está o quedó como demo: se revierte");
  await db.query("commit");
  console.log(`Marcados como demo: ${r.rowCount}. Temple Gym sigue real.`);
} catch (e) {
  await db.query("rollback").catch(() => {});
  console.error(`::error::${e.message}`);
  process.exitCode = 1;
} finally { await db.end(); }
