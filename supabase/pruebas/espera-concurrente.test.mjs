// VD-24 · Dos cancelaciones SIMULTÁNEAS en una clase llena con lista de espera, con dos conexiones reales:
// cada persona de la espera queda confirmada una sola vez (la segunda cancelación espera el candado de la
// clase y sube a la que sigue, no a la que ya subió). Necesita datos CONFIRMADOS: crea un gimnasio
// "prueba-espera-conc-*" que queda en la base local. Se niega a correr contra Supabase.
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
  throw new Error("la segunda conexión nunca quedó esperando el candado de la clase");
}

test("dos cancelaciones a la vez suben a dos personas distintas de la espera, cada una una sola vez", async () => {
  if (!URL || /supabase\.(co|com)/.test(URL)) throw new Error("Falta DB_PRUEBAS_URL local");
  const conectar = async () => { const c = new pg.Client({ connectionString: URL }); await c.connect(); return c; };
  const adm = await conectar();
  const q = async (sql, p) => (await adm.query(sql, p)).rows;
  const { rows: [{ id: g }] } = await adm.query(`insert into public.gimnasios (slug, nombre) values ($1,'Espera concurrente') returning id`, [`prueba-espera-conc-${Date.now()}`]);
  const [{ id: sede }] = await q(`select id from public.sedes where gimnasio_id = $1`, [g]);
  const hoy = (await q(`select (now() at time zone 'America/Argentina/Buenos_Aires')::date::text d`))[0].d;
  const ctx = await sembrarCasos(adm, { gimnasioId: g, sedeId: sede, hoy, telefonoBase: 5490000300000 });
  await q(`update public.configuracion_gimnasio set modo_clases = 'reserva' where gimnasio_id = $1`, [g]);
  const [{ id: act }] = await q(`insert into public.actividades (gimnasio_id, nombre) values ($1,'Funcional') returning id`, [g]);
  const [{ id: clase }] = await q(`insert into public.clases (gimnasio_id, sede_id, actividad_id, inicio, fin, cupo)
    values ($1,$2,$3, now() + interval '3 hours', now() + interval '4 hours', 2) returning id`, [g, sede, act]);
  const S = ctx.socios;
  const poner = async (socio, estado, orden) => (await q(`insert into public.reservas (gimnasio_id, clase_id, socio_id, estado, creado_en)
    values ($1,$2,$3,$4, now() - $5::interval) returning id`, [g, clase, socio, estado, `${orden} minutes`]))[0].id;
  const resA = await poner(S.al_dia, "confirmada", 10), resB = await poner(S.por_vencer, "confirmada", 9);
  const resC = await poner(S.pack_con_clases, "espera", 8), resD = await poner(S.cumple, "espera", 7);

  const A = await conectar(), B = await conectar();
  try {
    await A.query("begin"); await B.query("begin");
    // A cancela y todavía no confirma: tiene el candado de la clase y ya subió a C.
    const subioA = (await A.query(`select privado.cancelar_reserva($1, 'equipo', true, now()) r`, [resA])).rows[0].r;
    // B cancela al mismo tiempo: queda esperando el candado.
    const cancelaB = B.query(`select privado.cancelar_reserva($1, 'equipo', true, now()) r`, [resB]).then((x) => x.rows[0].r);
    await esperarBloqueo(adm, B.processID);
    await A.query("commit");
    const subioB = await cancelaB;
    await B.query("commit");

    assert.equal(subioA, resC, "la primera cancelación sube al primero de la espera");
    assert.equal(subioB, resD, "la segunda sube al que sigue, no repite a quien ya subió");
    const confirmadas = await q(`select id from public.reservas where clase_id = $1 and estado = 'confirmada'`, [clase]);
    assert.deepEqual(confirmadas.map((x) => x.id).sort(), [resC, resD].sort(), "cupo 2: cada persona de la espera, una sola vez");
    const avisos = await q(`select socio_id from public.avisos_pendientes where clase_id = $1 and tipo = 'lugar_liberado' order by socio_id`, [clase]);
    assert.deepEqual(avisos.map((x) => x.socio_id).sort(), [S.pack_con_clases, S.cumple].sort(), "un aviso por persona, sin dobles");
  } finally { await A.end(); await B.end(); await adm.end(); }
});
