// Carreras de la segunda revisión, con dos conexiones reales. Necesita datos
// CONFIRMADOS: crea un gimnasio "prueba-carrera-*" que queda en la base local.
// Se niega a correr contra Supabase.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import pg from "pg";

const URL = process.env.DB_PRUEBAS_URL;
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
const conectar = async () => { const c = new pg.Client({ connectionString: URL }); await c.connect(); return c; };
const q = async (c, s, p) => (await c.query(s, p)).rows;
const comoUsuario = async (c, u) => {
  await c.query("set role authenticated");
  await q(c, `select set_config('request.jwt.claims', $1, false)`, [JSON.stringify({ sub: u, role: "authenticated" })]);
};
// Espera a que la otra conexión quede bloqueada por un lock (no por tiempo fijo).
async function esperarBloqueo(adm, pid) {
  for (let i = 0; i < 100; i++) {
    const [{ n }] = await q(adm, `select count(*)::int n from pg_stat_activity where pid = $1 and wait_event_type = 'Lock'`, [pid]);
    if (n === 1) return;
    await dormir(20);
  }
  throw new Error("la segunda conexión nunca quedó esperando el lock");
}

let adm, g, sede, caja, u, prod;
before(async () => {
  if (!URL || /supabase\.(co|com)/.test(URL)) throw new Error("Falta DB_PRUEBAS_URL local");
  adm = await conectar();
  [{ id: g }] = await q(adm, `insert into public.gimnasios (slug, nombre) values ($1,'Carreras') returning id`, [`prueba-carrera-${Date.now()}`]);
  [{ id: sede }] = await q(adm, `select id from public.sedes where gimnasio_id = $1`, [g]);
  [{ id: caja }] = await q(adm, `insert into public.cajas (gimnasio_id, sede_id, nombre) values ($1,$2,'Recepción') returning id`, [g, sede]);
  [{ id: u }] = await q(adm, `insert into auth.users (email) values ($1) returning id`, [`carrera${Date.now()}@ejemplo.invalid`]);
  await q(adm, `insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,'Recepción','recepcion')`, [g, u]);
  [{ id: prod }] = await q(adm, `insert into public.productos (gimnasio_id, nombre, precio) values ($1,'Agua',1500) returning id`, [g]);
});
after(async () => adm && adm.end());

test("una venta en efectivo que llega mientras se cierra la caja espera y se rechaza: nada entra a un turno ya contado", async () => {
  const A = await conectar(), B = await conectar();
  try {
    await comoUsuario(A, u); await comoUsuario(B, u);
    const [{ id: turno }] = await q(A, `select public.abrir_caja($1, 1000) as id`, [caja]);
    await A.query("begin");
    await q(A, `select public.cerrar_caja($1, 1000)`, [turno]);
    const pidB = B.processID;
    const venta = q(B, `select public.vender($1,$2,$3,null,$4) as r`, [sede, JSON.stringify([{ tipo: "producto", producto_id: prod }]),
      JSON.stringify([{ medio: "efectivo", monto: 1500 }]), turno]).then(() => null, (e) => e);
    await esperarBloqueo(adm, pidB);
    await A.query("commit");
    const error = await venta;
    assert.ok(error, "la venta tenía que fallar");
    assert.match(error.message, /no está abierta/);
    const [t] = await q(adm, `select monto_esperado, monto_contado from public.turnos_caja where id = $1`, [turno]);
    assert.equal(Number(t.monto_esperado), 1000);
    const [{ n }] = await q(adm, `select count(*)::int n from public.pagos where turno_caja_id = $1`, [turno]);
    assert.equal(n, 0);
  } finally { await A.end(); await B.end(); }
});

test("dos presentes a la vez con un pack de 1 clase: uno pasa, el otro se rechaza, un solo consumo", async () => {
  await q(adm, `update public.configuracion_gimnasio set modo_clases = 'reserva' where gimnasio_id = $1`, [g]);
  const [{ id: act }] = await q(adm, `insert into public.actividades (gimnasio_id, nombre) values ($1,'Funcional') returning id`, [g]);
  const [{ id: pl }] = await q(adm, `insert into public.planes (gimnasio_id, tipo, nombre, cantidad_clases, consume_en)
      values ($1,'pack','Pack 1',1,'asistencia') returning id`, [g]);
  const [{ id: s }] = await q(adm, `insert into public.socios (gimnasio_id, nombre) values ($1,'Uno') returning id`, [g]);
  await q(adm, `insert into public.packs (gimnasio_id, socio_id, plan_id, cantidad, desde) values ($1,$2,$3,1,now() - interval '1 day')`, [g, s, pl]);
  const clase = async (min) => (await q(adm, `insert into public.clases (gimnasio_id, sede_id, actividad_id, inicio, fin)
      values ($1,$2,$3, now() + make_interval(mins => $4), now() + make_interval(mins => $4 + 50)) returning id`, [g, sede, act, min]))[0].id;
  const c1 = await clase(20), c2 = await clase(40);
  const A = await conectar(), B = await conectar();
  try {
    await comoUsuario(A, u); await comoUsuario(B, u);
    await A.query("begin"); await B.query("begin");
    const [{ r: ra }] = await q(A, `select public.tomar_asistencia($1,$2) as r`, [c1, s]);
    const pidB = B.processID;
    const segunda = q(B, `select public.tomar_asistencia($1,$2) as r`, [c2, s]).then(() => null, (e) => e);
    await esperarBloqueo(adm, pidB);
    await A.query("commit");
    const error = await segunda;
    await B.query("rollback");
    assert.equal(ra["descontó_pack"], true);
    assert.ok(error, "el segundo presente tenía que fallar");
    assert.match(error.message, /No puede tomar la clase/);
    const [{ n }] = await q(adm, `select count(*)::int n from public.consumos_pack where socio_id = $1 and anulado_en is null`, [s]);
    assert.equal(n, 1);
  } finally { await A.end(); await B.end(); }
});
