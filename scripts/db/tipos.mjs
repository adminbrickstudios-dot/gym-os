#!/usr/bin/env node
// npm run db:types — genera src/tipos/base.ts desde el proyecto de Supabase.
// Lee SUPABASE_PROJECT_ID de .env.local. La primera vez: npx supabase login.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
if (existsSync(join(raiz, ".env.local"))) process.loadEnvFile(join(raiz, ".env.local"));
const id = process.env.SUPABASE_PROJECT_ID;
if (!id) {
  console.error("Falta SUPABASE_PROJECT_ID en .env.local (Supabase → Project Settings → General).");
  process.exit(1);
}
const salida = execFileSync("npx", ["--yes", "supabase", "gen", "types", "typescript", "--project-id", id, "--schema", "public"],
  { cwd: raiz, encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] });
mkdirSync(join(raiz, "src", "tipos"), { recursive: true });
writeFileSync(join(raiz, "src", "tipos", "base.ts"), salida);
console.log("✓ src/tipos/base.ts actualizado");
