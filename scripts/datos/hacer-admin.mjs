#!/usr/bin/env node
// Da permiso de super admin de BRIK a una cuenta que ya existe (creada en
// Supabase → Authentication → Add user). Lo corre el workflow "Base de datos"
// de GitHub o vos en tu compu:
//   node scripts/datos/hacer-admin.mjs --email vos@tumail.com   (usa SUPABASE_DB_URL)
import pg from "pg";

const arg = (n) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] : undefined; };
const email = (arg("email") ?? "").trim().toLowerCase();
const url = arg("url") ?? process.env.SUPABASE_DB_URL;
if (!email || !url) { console.error("Uso: --email <mail> (y SUPABASE_DB_URL o --url)"); process.exit(1); }

const db = new pg.Client({ connectionString: url });
await db.connect();
const { rows } = await db.query(`select id from auth.users where lower(email) = $1`, [email]);
if (!rows.length) {
  console.error(`No hay ninguna cuenta con el mail ${email}. Creala primero en Supabase → Authentication → Add user.`);
  process.exit(1);
}
const r = await db.query(`insert into public.administradores_plataforma (usuario_id) values ($1) on conflict do nothing`, [rows[0].id]);
console.log(r.rowCount ? `✓ ${email} ahora es super admin.` : `✓ ${email} ya era super admin.`);
await db.end();
