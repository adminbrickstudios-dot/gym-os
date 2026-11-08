#!/usr/bin/env node
// Escribe docs/base/PERMISOS.md SACADO DE LA BASE REAL: por cada función pública que ejecuta un usuario con sesión, qué roles del
// equipo pasan `privado.exigir_equipo(...)` (se lee del cuerpo de la función en pg_proc). Lo que no pide rol del equipo se lista aparte
// (lo decide la propia función: el socio, la sesión, o el servidor).
//   node scripts/datos/permisos-md.mjs [--url postgres://...]
import { writeFileSync } from "node:fs";
import pg from "pg";

const i = process.argv.indexOf("--url");
const url = i >= 0 ? process.argv[i + 1] : process.env.DB_PRUEBAS_URL;
if (!url) { console.error("Falta --url o DB_PRUEBAS_URL"); process.exit(1); }
const db = new pg.Client({ connectionString: url }); await db.connect();
const { rows } = await db.query(`
  select p.proname as nombre, pg_get_function_identity_arguments(p.oid) as args, p.prosrc as cuerpo,
         has_function_privilege('authenticated', p.oid, 'execute') as auth, has_function_privilege('anon', p.oid, 'execute') as anon
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' order by p.proname`);
const ROLES = ["dueno", "encargado", "recepcion", "profe"];
const filas = [], sinRol = [], soloServidor = [];
for (const f of rows) {
  if (f.anon) { sinRol.push(`${f.nombre} (también anónimo)`); continue; }
  if (!f.auth) { soloServidor.push(f.nombre); continue; }
  const roles = new Set();
  for (const m of f.cuerpo.matchAll(/exigir_equipo\s*\([^;]*?array\s*\[([^\]]*)\]/gi)) for (const r of m[1].matchAll(/'([a-z_]+)'/g)) roles.add(r[1]);
  if (roles.size === 0) sinRol.push(f.nombre); else filas.push([f.nombre, roles]);
}
const md = [
  "# Permisos por rol (sacado de la base real)",
  "",
  `Generado con \`node scripts/datos/permisos-md.mjs\` leyendo el cuerpo de cada función en la base (\`pg_proc\`). ${filas.length} funciones piden un rol del equipo con \`privado.exigir_equipo\`; ${sinRol.length} no (las decide la propia función con la sesión, el socio o RLS); ${soloServidor.length} son solo del servidor.`,
  "**Un permiso denegado es un error, nunca una lista vacía.** Lo prueba `supabase/pruebas/permisos-equipo.test.mjs` y el chequeo de RLS de `npm run chequeos`.",
  "",
  "| Función | " + ROLES.join(" | ") + " |", "|---|" + ROLES.map(() => ":-:").join("|") + "|",
  ...filas.map(([n, r]) => `| \`${n}\` | ${ROLES.map((x) => (r.has(x) ? "✓" : "—")).join(" | ")} |`),
  "",
  "## Sin rol del equipo en la función (lo decide otra regla)",
  sinRol.map((x) => `- \`${x}\``).join("\n") || "(ninguna)",
  "",
  "## Solo el servidor (`service_role`)",
  soloServidor.map((x) => `- \`${x}\``).join("\n") || "(ninguna)",
  "",
].join("\n");
writeFileSync("docs/base/PERMISOS.md", md);
console.log(`PERMISOS.md: ${filas.length} funciones con rol, ${sinRol.length} sin rol del equipo, ${soloServidor.length} del servidor`);
await db.end();
