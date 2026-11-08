#!/usr/bin/env node
// Qué hay en la base de producción, solo en números (el log de Actions es público):
// cuántos gimnasios, cuántos son reales y cuántos socios tienen.
// Lo corre el workflow "Base de datos" → estado.
import pg from "pg";

const url = process.env.SUPABASE_DB_URL;
if (!url) { console.error("Falta SUPABASE_DB_URL"); process.exit(1); }
const db = new pg.Client({ connectionString: url });
await db.connect();
const q = async (sql) => (await db.query(sql)).rows;

const [m] = await q(`select count(*)::int as n from supabase_migrations.schema_migrations`).catch(() => [{ n: "?" }]);
const [a] = await q(`select count(*)::int as n from public.administradores_plataforma`);
console.log(`Migraciones aplicadas: ${m.n} · super admins: ${a.n}`);
// Antes de la migración 0019 no existe equipo.es_soporte: el script sirve antes y después.
const [{ hay }] = await q(`select exists (select 1 from information_schema.columns where table_schema = 'public'
                             and table_name = 'equipo' and column_name = 'es_soporte') as hay`);
const noSoporte = hay ? "not e.es_soporte" : "true";
const gs = await q(`
  select g.slug, g.nombre, g.es_demo,
         array(select d.host from public.dominios_gimnasio d where d.gimnasio_id = g.id order by d.tipo desc, d.host) as hosts,
         (select count(*)::int from public.socios s where s.gimnasio_id = g.id and s.dado_de_baja_en is null) as socios,
         (select count(*)::int from public.equipo e where e.gimnasio_id = g.id and e.activo and ${noSoporte}) as equipo,
         (select count(*)::int from public.equipo e where e.gimnasio_id = g.id and e.activo and e.rol = 'dueno'
             and ${noSoporte} and e.usuario_id is not null) as duenos_con_acceso
    from public.gimnasios g order by g.creado_en`);
// BASE-8a: el repo es público y sus logs también. Solo números: nada de nombres, direcciones ni mails.
const reales = gs.filter((g) => !g.es_demo);
console.log(`Gimnasios: ${gs.length} (reales: ${reales.length}, demo: ${gs.length - reales.length}) · socios en los reales: ${reales.reduce((n, g) => n + g.socios, 0)} · equipo en los reales: ${reales.reduce((n, g) => n + g.equipo, 0)}`);
console.log(reales.length ? "HAY GIMNASIOS REALES: las migraciones las aplica Mateo (crear .claude/BASE_CON_DATOS_REALES)." : "No hay gimnasios reales: el agente puede aplicar migraciones.");
await db.end();
