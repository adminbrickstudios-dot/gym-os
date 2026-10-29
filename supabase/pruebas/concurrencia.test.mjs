// Dos lectores de QR casi simultáneos sobre el mismo socio, con dos
// conexiones reales. Necesita datos CONFIRMADOS (no puede correr dentro de
// una transacción que se revierte): crea un gimnasio "prueba-conc-*" que
// queda en la base local. Se niega a correr contra Supabase.
import { test } from "node:test";
import assert from "node:assert/strict";
import pg from "pg";
import { sembrarCasos } from "../../scripts/datos/casos-testigo.mjs";

const URL = process.env.DB_PRUEBAS_URL;

for (const reingresoConsume of [true, false]) {
  test(`dos lecturas casi simultáneas descuentan una sola clase (reingreso_mismo_dia_consume=${reingresoConsume})`, async () => {
    if (!URL || /supabase\.(co|com)/.test(URL)) throw new Error("Falta DB_PRUEBAS_URL local");
    const conectar = async () => { const c = new pg.Client({ connectionString: URL }); await c.connect(); return c; };
    const setup = await conectar();
    const slug = `prueba-conc-${Date.now()}-${reingresoConsume}`;
    const { rows: [{ id: g }] } = await setup.query(`insert into public.gimnasios (slug, nombre) values ($1,'Concurrencia') returning id`, [slug]);
    const { rows: [{ id: sede }] } = await setup.query(`select id from public.sedes where gimnasio_id = $1`, [g]);
    const hoy = (await setup.query(`select (now() at time zone 'America/Argentina/Buenos_Aires')::date::text d`)).rows[0].d;
    const ctx = await sembrarCasos(setup, { gimnasioId: g, sedeId: sede, hoy });
    await setup.query(`update public.configuracion_gimnasio set reingreso_mismo_dia_consume = $2 where gimnasio_id = $1`, [g, reingresoConsume]);
    const socio = ctx.socios.pack_con_clases;
    const consumos = async () => (await setup.query(
      `select count(*)::int n from public.consumos_pack where socio_id = $1 and anulado_en is null`, [socio])).rows[0].n;
    const antes = await consumos();

    const A = await conectar(), B = await conectar();
    const preparar = async (c) => {
      await c.query("begin");
      await c.query("set local role service_role");
      await c.query(`select set_config('request.jwt.claims', '{"role":"service_role"}', true)`);
    };
    try {
      await preparar(A);                                   // A empieza primero
      await new Promise((r) => setTimeout(r, 30));
      await preparar(B);                                   // B empieza después pero toma el lock primero
      const rB = (await B.query(`select public.registrar_ingreso($1,$2,'qr_socio') r`, [socio, sede])).rows[0].r;
      await B.query("commit");
      const rA = (await A.query(`select public.registrar_ingreso($1,$2,'qr_socio') r`, [socio, sede])).rows[0].r;
      await A.query("commit");

      assert.equal(rB.resultado, "entro");
      assert.equal(rA.repetido, true, "la segunda lectura devuelve el mismo ingreso");
      assert.equal(rA.ingreso_id, rB.ingreso_id);
      assert.equal(await consumos(), antes + 1);
      const { rows: [{ n }] } = await setup.query(
        `select count(*)::int n from public.ingresos where socio_id = $1 and resultado = 'entro' and momento > now() - interval '1 hour'`, [socio]);
      assert.equal(n, 1, "un solo ingreso registrado");
    } finally {
      for (const c of [A, B, setup]) await c.end();
    }
  });
}
