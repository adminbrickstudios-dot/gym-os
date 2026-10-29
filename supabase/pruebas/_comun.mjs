// Helpers compartidos por las pruebas de la base.
import assert from "node:assert/strict";
import pg from "pg";
import { sembrarCasos } from "../../scripts/datos/casos-testigo.mjs";

export const HOY = "2026-11-14"; // sábado

export async function abrir(slug) {
  const URL = process.env.DB_PRUEBAS_URL;
  if (!URL) throw new Error("Falta DB_PRUEBAS_URL (ver scripts/db/local.sh url)");
  if (/supabase\.(co|com)/.test(URL)) throw new Error("Las pruebas no corren contra Supabase");
  const db = new pg.Client({ connectionString: URL });
  await db.connect();
  await db.query("begin");
  const q = async (sql, params) => (await db.query(sql, params)).rows;
  const [{ id: g }] = await q(`insert into public.gimnasios (slug, nombre) values ($1, 'Gimnasio de Prueba') returning id`, [slug]);
  const [{ id: sede }] = await q(`select id from public.sedes where gimnasio_id = $1`, [g]);
  const ctx = await sembrarCasos(db, { gimnasioId: g, sedeId: sede, hoy: HOY });
  const en = async (dia, hora = "19:00:00") =>
    (await q(`select privado.medianoche($1::date, $2) + $3::interval as t`, [dia, ctx.zona, hora]))[0].t;

  async function falla(fn, patron) {
    await db.query("savepoint s");
    try {
      await fn();
    } catch (e) {
      await db.query("rollback to savepoint s");
      if (patron) assert.match(e.message, patron);
      return e;
    }
    await db.query("rollback to savepoint s");
    assert.fail("se esperaba un error");
  }

  async function comoUsuario(usuarioId, fn) {
    await db.query("savepoint u");
    try {
      await db.query(`set local role authenticated`);
      await db.query(`select set_config('request.jwt.claims', $1, true)`,
        [JSON.stringify({ sub: usuarioId, role: "authenticated" })]);
      return await fn();
    } finally {
      await db.query("rollback to savepoint u");
    }
  }

  async function cerrar() {
    await db.query("rollback");
    await db.end();
  }

  return { db, q, g, sede, ctx, en, falla, comoUsuario, cerrar };
}
