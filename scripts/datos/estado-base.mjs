#!/usr/bin/env node
// Qué hay en la base de producción, sin datos personales ni claves:
// gimnasios, sus direcciones, cuántos socios y si el dueño tiene acceso.
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
const gs = await q(`
  select g.slug, g.nombre, g.es_demo,
         array(select d.host from public.dominios_gimnasio d where d.gimnasio_id = g.id order by d.tipo desc, d.host) as hosts,
         (select count(*)::int from public.socios s where s.gimnasio_id = g.id and s.dado_de_baja_en is null) as socios,
         (select count(*)::int from public.equipo e where e.gimnasio_id = g.id and e.activo and not coalesce(e.es_soporte, false)) as equipo,
         (select count(*)::int from public.equipo e where e.gimnasio_id = g.id and e.activo and e.rol = 'dueno'
             and not coalesce(e.es_soporte, false) and e.usuario_id is not null) as duenos_con_acceso
    from public.gimnasios g order by g.creado_en`);
if (!gs.length) console.log("No hay ningún gimnasio todavía.");
for (const g of gs) {
  console.log(`• ${g.nombre} (${g.slug})${g.es_demo ? " [demo]" : ""} · ${g.socios} socios · ${g.equipo} en el equipo · dueños con acceso: ${g.duenos_con_acceso}`);
  console.log(`    ${g.hosts.join(", ")}`);
}
await db.end();
