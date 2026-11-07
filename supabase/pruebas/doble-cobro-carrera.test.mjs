// VD-50 · Dos personas cobran la misma cuota a la vez (dos conexiones reales, claves de operación distintas):
// la segunda espera a la primera y después ve su cobro → ya_cobrada. Una sola cobertura, nunca dos meses por error.
// Necesita datos CONFIRMADOS: crea un gimnasio "prueba-carrera-doble-*" que queda en la base local.
// Se niega a correr contra Supabase.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import pg from "pg";
import { sembrarCasos } from "../../scripts/datos/casos-testigo.mjs";
import { HOY } from "./_comun.mjs";

const URL = process.env.DB_PRUEBAS_URL;
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
const conectar = async () => { const c = new pg.Client({ connectionString: URL }); await c.connect(); return c; };
const q = async (c, s, p) => (await c.query(s, p)).rows;
const comoUsuario = async (c, u) => {
  await c.query("set role authenticated");
  await q(c, `select set_config('request.jwt.claims', $1, false)`, [JSON.stringify({ sub: u, role: "authenticated" })]);
};
async function esperarBloqueo(adm, pid) {
  for (let i = 0; i < 150; i++) {
    const [{ n }] = await q(adm, `select count(*)::int n from pg_stat_activity where pid = $1 and wait_event_type = 'Lock'`, [pid]);
    if (n === 1) return;
    await dormir(20);
  }
  throw new Error("la segunda conexión nunca quedó esperando el candado del socio");
}

let adm, g, sede, uSofi, uPedro, socio;
before(async () => {
  if (!URL || /supabase\.(co|com)/.test(URL)) throw new Error("Falta DB_PRUEBAS_URL local");
  adm = await conectar();
  [{ id: g }] = await q(adm, `insert into public.gimnasios (slug, nombre) values ($1,'Carrera doble cobro') returning id`, [`prueba-carrera-doble-${Date.now()}`]);
  [{ id: sede }] = await q(adm, `select id from public.sedes where gimnasio_id = $1`, [g]);
  const ctx = await sembrarCasos(adm, { gimnasioId: g, sedeId: sede, hoy: HOY });
  socio = ctx.socios.sin_pago;
  for (const [n, nombre] of [[1, "Sofi"], [2, "Pedro"]]) {
    const [{ id: u }] = await q(adm, `insert into auth.users (email) values ($1) returning id`, [`carrera${n}${Date.now()}@ejemplo.invalid`]);
    await q(adm, `insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,$3,'recepcion')`, [g, u, nombre]);
    if (n === 1) uSofi = u; else uPedro = u;
  }
});
after(async () => adm && adm.end());

test("dos cobros de la misma cuota a la vez: se turnan, el segundo ve el primero y frena", async () => {
  const A = await conectar(), B = await conectar();
  try {
    await comoUsuario(A, uSofi); await comoUsuario(B, uPedro);
    const cobrar = (c) => q(c, `select public.vender($1, $2, $3, $4, null, $5) as r`, [sede, JSON.stringify([{ tipo: "cuota" }]),
      JSON.stringify([{ medio: "transferencia", monto: 25000 }]), socio, crypto.randomUUID()]);
    await A.query("begin");
    const [{ r: a }] = await cobrar(A);                       // Sofi cobra y todavía no confirmó la transacción
    assert.equal(Number(a.total), 25000);
    const segundo = cobrar(B).then(() => null, (e) => e);     // Pedro, desde otra compu, la misma cuota
    await esperarBloqueo(adm, B.processID);
    await A.query("commit");
    const error = await segundo;
    assert.ok(error, "el segundo cobro tenía que frenar");
    assert.match(error.message, /^ya_cobrada: Sofi ya cobró esta cuota hace/);
    assert.equal(error.code, "DC001");
    const [{ n }] = await q(adm, `select count(*)::int n from public.coberturas where socio_id = $1 and anulada_en is null and origen = 'pago'`, [socio]);
    assert.equal(n, 1, "una sola cobertura");
    const [{ v }] = await q(adm, `select count(*)::int v from public.ventas where socio_id = $1 and estado = 'confirmada'`, [socio]);
    assert.equal(v, 1, "una sola venta");
  } finally { await A.end(); await B.end(); }
});
