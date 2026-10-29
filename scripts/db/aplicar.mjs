#!/usr/bin/env node
// Aplica las migraciones de supabase/migrations en orden.
//
//   npm run db:aplicar              pre-vuelo + aplicar lo pendiente
//   npm run db:prevuelo             solo pre-vuelo (todo en transacción que revierte)
//   node scripts/db/aplicar.mjs --url postgres://...   otra base (p. ej. la local)
//
// Por cada migración pendiente:
//   1. pre-vuelo: BEGIN → migración → ROLLBACK. Si falla, no se toca nada.
//   2. real:      BEGIN → migración → registro → COMMIT.
// Registra en supabase_migrations.schema_migrations, la misma tabla que
// usa la CLI de Supabase, así las dos herramientas ven lo mismo.
// Las migraciones NO abren transacción propia: la abre este script.

import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const args = process.argv.slice(2);
const soloPrevuelo = args.includes("--prevuelo");
const iUrl = args.indexOf("--url");

if (existsSync(join(raiz, ".env.local"))) process.loadEnvFile(join(raiz, ".env.local"));
const url = iUrl >= 0 ? args[iUrl + 1] : process.env.SUPABASE_DB_URL;
if (!url) {
  console.error("Falta SUPABASE_DB_URL (en .env.local) o --url.");
  process.exit(1);
}

const carpeta = join(raiz, "supabase", "migrations");
const archivos = readdirSync(carpeta).filter((f) => /^\d{14}_[a-z0-9_]+\.sql$/.test(f)).sort();

const cliente = new pg.Client({ connectionString: url });
await cliente.connect();

await cliente.query(`
  create schema if not exists supabase_migrations;
  create table if not exists supabase_migrations.schema_migrations (
    version text primary key, statements text[], name text
  );
`);
const { rows } = await cliente.query("select version from supabase_migrations.schema_migrations");
const aplicadas = new Set(rows.map((r) => r.version));
const pendientes = archivos.filter((f) => !aplicadas.has(f.slice(0, 14)));

if (pendientes.length === 0) {
  console.log("Nada pendiente.");
  await cliente.end();
  process.exit(0);
}

let fallo = false;
for (const archivo of pendientes) {
  const version = archivo.slice(0, 14);
  const nombre = archivo.slice(15, -4);
  const sql = readFileSync(join(carpeta, archivo), "utf8");

  if (/\b(begin|commit)\s*;/i.test(sql.replace(/\$\$[\s\S]*?\$\$/g, ""))) {
    console.error(`✗ ${archivo}: tiene BEGIN/COMMIT propio. El aplicador ya abre la transacción.`);
    fallo = true;
    break;
  }

  try {
    await cliente.query("begin");
    await cliente.query(sql);
    await cliente.query("rollback");
    console.log(`✓ pre-vuelo ${archivo}`);
  } catch (e) {
    await cliente.query("rollback").catch(() => {});
    console.error(`✗ pre-vuelo ${archivo}\n  ${e.message}${e.where ? `\n  ${e.where}` : ""}`);
    fallo = true;
    break;
  }

  if (soloPrevuelo) continue;

  try {
    await cliente.query("begin");
    await cliente.query(sql);
    await cliente.query(
      "insert into supabase_migrations.schema_migrations (version, name, statements) values ($1, $2, $3)",
      [version, nombre, [sql]]
    );
    await cliente.query("commit");
    console.log(`✓ aplicada  ${archivo}`);
  } catch (e) {
    await cliente.query("rollback").catch(() => {});
    console.error(`✗ ${archivo}\n  ${e.message}`);
    fallo = true;
    break;
  }
}

await cliente.end();
if (fallo) process.exit(1);
if (!soloPrevuelo) console.log("Ahora: npm run db:types");
