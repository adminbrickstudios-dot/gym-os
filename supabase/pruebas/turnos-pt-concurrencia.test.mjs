// VD-58 · Dos reservas SIMULTÁNEAS con dos conexiones reales (no el mismo hilo):
//   1) dos socios, la misma franja: una sola se queda con el horario, la otra ve "ya está reservado".
//   2) un socio con UNA sola sesión de saldo, dos franjas distintas a la vez: se gasta una sola vez, la otra dice que no le quedan.
// Necesita datos CONFIRMADOS: crea un gimnasio "prueba-pt-conc-*" que queda en la base local. Se niega a correr contra Supabase.
import { test } from "node:test";
import assert from "node:assert/strict";
import pg from "pg";
import { sembrarCasos } from "../../scripts/datos/casos-testigo.mjs";

const URL = process.env.DB_PRUEBAS_URL;
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
async function esperarBloqueo(adm, pid) {
  for (let i = 0; i < 150; i++) {
    const { rows: [{ n }] } = await adm.query(`select count(*)::int n from pg_stat_activity where pid = $1 and wait_event_type = 'Lock'`, [pid]);
    if (n === 1) return;
    await dormir(20);
  }
  throw new Error("la segunda conexión nunca quedó esperando el candado");
}

test("dos reservas a la vez: el horario es de uno solo, y la sesión única del saldo se gasta una sola vez", async () => {
  if (!URL || /supabase\.(co|com)/.test(URL)) throw new Error("Falta DB_PRUEBAS_URL local");
  const conectar = async () => { const c = new pg.Client({ connectionString: URL }); await c.connect(); return c; };
  const adm = await conectar();
  const q = async (sql, p) => (await adm.query(sql, p)).rows;
  try {
    const { rows: [{ id: g }] } = await adm.query(`insert into public.gimnasios (slug, nombre) values ($1,'PT concurrente') returning id`, [`prueba-pt-conc-${Date.now()}`]);
    const [{ id: sede }] = await q(`select id from public.sedes where gimnasio_id = $1`, [g]);
    const hoy = (await q(`select (now() at time zone 'America/Argentina/Buenos_Aires')::date::text d`))[0].d;
    const ctx = await sembrarCasos(adm, { gimnasioId: g, sedeId: sede, hoy, telefonoBase: 5490000500000 });
    const S = ctx.socios;
    const [{ id: pt }] = await q(`insert into public.equipo (gimnasio_id, nombre, rol) values ($1,'Pablo','profe') returning id`, [g]);
    const [{ id: pack }] = await q(`insert into public.productos (gimnasio_id, nombre, precio, pt_sesiones) values ($1,'Pack PT',1000,1) returning id`, [g]);
    const darPack = async (socio) => {
      const [{ id: v }] = await q(`insert into public.ventas (gimnasio_id, sede_id, socio_id, estado, origen, creado_por, confirmada_en) values ($1,$2,$3,'confirmada','recepcion',$4, now()) returning id`, [g, sede, socio, pt]);
      await q(`insert into public.venta_items (gimnasio_id, venta_id, tipo, producto_id, descripcion, cantidad, precio_unitario) values ($1,$2,'producto',$3,'Pack PT',1,1000)`, [g, v, pack]);
    };
    const franja = async (horas) => (await q(`insert into public.pt_franjas (gimnasio_id, sede_id, entrenador_id, inicio, fin, creada_por) values ($1,$2,$3, now() + make_interval(hours => $4), now() + make_interval(hours => $4) + interval '1 hour', $3) returning id`, [g, sede, pt, horas]))[0].id;
    await darPack(S.al_dia); await darPack(S.por_vencer);
    const f1 = await franja(48), f2 = await franja(72);

    // 1) La misma franja, dos socios.
    const A = await conectar(), B = await conectar();
    try {
      await A.query("begin"); await B.query("begin");
      await A.query(`select privado.reservar_sesion_pt($1, $2, null)`, [S.al_dia, f1]);
      const segunda = B.query(`select privado.reservar_sesion_pt($1, $2, null)`, [S.por_vencer, f1]).then(() => null, (e) => e);
      await esperarBloqueo(adm, B.processID);
      await A.query("commit");
      const error = await segunda;
      await B.query("rollback");
      assert.ok(error && /ya está reservado/.test(error.message), `la segunda tenía que ver la primera: ${error?.message}`);
      const vivas = await q(`select socio_id from public.sesiones_pt where franja_id = $1 and estado <> 'cancelada'`, [f1]);
      assert.deepEqual(vivas.map((x) => x.socio_id), [S.al_dia], "el horario quedó con el primero, una sola vez");
    } finally { await A.end(); await B.end(); }

    // 2) Un saldo de UNA sesión, dos franjas distintas a la vez.
    const C = await conectar(), D = await conectar();
    try {
      await C.query("begin"); await D.query("begin");
      await C.query(`select privado.reservar_sesion_pt($1, $2, null)`, [S.por_vencer, f2]);
      const f3 = await franja(96);
      const otra = D.query(`select privado.reservar_sesion_pt($1, $2, null)`, [S.por_vencer, f3]).then(() => null, (e) => e);
      await esperarBloqueo(adm, D.processID);
      await C.query("commit");
      const error = await otra;
      await D.query("rollback");
      assert.ok(error && /No le quedan sesiones/.test(error.message), `la sesión única no se gasta dos veces: ${error?.message}`);
      const gastadas = await q(`select count(*)::int n from public.sesiones_pt where socio_id = $1 and estado <> 'cancelada'`, [S.por_vencer]);
      assert.equal(gastadas[0].n, 1);
    } finally { await C.end(); await D.end(); }
  } finally { await adm.end(); }
});
