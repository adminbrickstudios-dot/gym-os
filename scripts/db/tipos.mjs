#!/usr/bin/env node
// npm run db:types — genera src/tipos/base.ts (los tipos del schema public) desde la base.
// De dónde los lee, en este orden:
//   1. SUPABASE_DB_URL (la conexión directa: es lo que usa el workflow "Tipos de la base" con el secreto que ya existe) → --db-url
//   2. el proyecto: SUPABASE_PROJECT_ID, o el ref que sale de NEXT_PUBLIC_SUPABASE_URL (https://<ref>.supabase.co) → --project-id
//      (este camino necesita `npx supabase login` en la compu)
//   --verificar  no escribe: falla si lo generado no es igual a lo commiteado (que db:types quede sin diferencias)
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
if (existsSync(join(raiz, ".env.local"))) process.loadEnvFile(join(raiz, ".env.local"));

export function refDeUrl(url) {
  const m = /^https:\/\/([a-z0-9]{20})\.supabase\.co\/?$/.exec(String(url ?? "").trim());
  return m ? m[1] : null;
}

function origen() {
  if (process.env.SUPABASE_DB_URL) return ["--db-url", process.env.SUPABASE_DB_URL];
  const id = process.env.SUPABASE_PROJECT_ID || refDeUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);
  if (id) return ["--project-id", id];
  console.error("No sé de qué base sacar los tipos: falta SUPABASE_DB_URL, SUPABASE_PROJECT_ID o NEXT_PUBLIC_SUPABASE_URL (https://<ref>.supabase.co).");
  console.error("En Actions: workflow \"Tipos de la base\" (usa el secreto SUPABASE_DB_URL y commitea el diff en la rama).");
  process.exit(1);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const salida = execFileSync("npx", ["--yes", "supabase@2", "gen", "types", "typescript", ...origen(), "--schema", "public"],
    { cwd: raiz, encoding: "utf8", stdio: ["ignore", "pipe", "inherit"], maxBuffer: 64 * 1024 * 1024 });
  const archivo = join(raiz, "src", "tipos", "base.ts");
  if (process.argv.includes("--verificar")) {
    const actual = existsSync(archivo) ? readFileSync(archivo, "utf8") : "";
    if (actual !== salida) { console.error("✗ src/tipos/base.ts no está al día con la base: npm run db:types (o el workflow \"Tipos de la base\")"); process.exit(1); }
    console.log("✓ src/tipos/base.ts al día con la base");
  } else {
    mkdirSync(join(raiz, "src", "tipos"), { recursive: true });
    writeFileSync(archivo, salida);
    console.log("✓ src/tipos/base.ts actualizado");
  }
}
