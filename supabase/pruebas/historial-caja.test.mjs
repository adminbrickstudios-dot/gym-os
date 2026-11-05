// Historial de caja (0068): el encargado ve cada turno con lo esperado, lo
// contado, la diferencia y los movimientos; la recepción no.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir } from "./_comun.mjs";

let t, uRec, uEnc, caja;
before(async () => {
  t = await abrir("prueba-historial-caja");
  [{ id: caja }] = await t.q(`insert into public.cajas (gimnasio_id, sede_id, nombre) values ($1,$2,'Recepción') returning id`, [t.g, t.sede]);
  const crear = async (rol, n) => {
    const [{ id: u }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`${rol}${Math.random()}@ejemplo.invalid`]);
    await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,$3,$4)`, [t.g, u, n, rol]);
    return u;
  };
  uRec = await crear("recepcion", "Ana"); uEnc = await crear("encargado", "Encargado");
});
after(async () => t && t.cerrar());
async function como(u, fn) {
  await t.db.query("set role authenticated");
  await t.q(`select set_config('request.jwt.claims', $1, false)`, [JSON.stringify({ sub: u, role: "authenticated" })]);
  try { return await fn(); } finally { await t.db.query("reset role"); await t.q(`select set_config('request.jwt.claims', '', false)`); }
}

test("cada turno con esperado, contado, diferencia y movimientos", async () => {
  await como(uRec, async () => {
    const [{ id: turno }] = await t.q(`select public.abrir_caja($1, 1000) as id`, [caja]);
    await t.q(`select public.movimiento_caja($1, 'retiro', 300, 'Limpieza')`, [turno]);
    await t.q(`select public.cerrar_caja($1, 600, 'Faltan 100')`, [turno]);
    await t.falla(() => t.q(`select public.historial_caja($1)`, [t.sede]), /Sin permiso/);
  });
  const h = await como(uEnc, async () => (await t.q(`select public.historial_caja($1) as h`, [t.sede]))[0].h);
  const x = h.find((y) => y.caja === "Recepción");
  assert.equal(Number(x.esperado), 700); assert.equal(Number(x.contado), 600); assert.equal(Number(x.diferencia), -100);
  assert.equal(x.abierto_por, "Ana"); assert.equal(x.cerrado_por, "Ana"); assert.equal(x.nota, "Faltan 100");
  assert.deepEqual(x.movimientos.map((m) => [m.tipo, Number(m.monto), m.motivo, m.por]), [["retiro", 300, "Limpieza", "Ana"]]);
});
