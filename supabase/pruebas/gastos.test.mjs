// Gastos (0078): el dueño carga los del mes, ve la ganancia (cobrado menos
// gastos), los quita (quedan anulados) y repite los del mes anterior; el
// encargado y la recepción no ven los gastos (hay sueldos).
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir } from "./_comun.mjs";

let t, u = {};
async function persona(rol) {
  const [{ id }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`${rol}${Math.random()}@ejemplo.invalid`]);
  await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,$3,$4)`, [t.g, id, `P ${rol}`, rol]);
  return id;
}
async function como(usuario, fn) {
  await t.db.query("set role authenticated");
  await t.q(`select set_config('request.jwt.claims', $1, false)`, [JSON.stringify({ sub: usuario, role: "authenticated" })]);
  try { return await fn(); } finally { await t.db.query("reset role"); await t.q(`select set_config('request.jwt.claims', '', false)`); }
}
before(async () => {
  t = await abrir("prueba-gastos");
  u.dueno = await persona("dueno"); u.encargado = await persona("encargado");
  const cuando = await t.en("2026-03-10", "10:00:00");
  const [{ id: v }] = await t.q(`insert into public.ventas (gimnasio_id, sede_id, origen, estado, confirmada_en, creado_en) values ($1,$2,'recepcion','confirmada',$3,$3) returning id`, [t.g, t.sede, cuando]);
  await t.q(`insert into public.pagos (gimnasio_id, venta_id, medio, monto, estado, aprobado_en, creado_en) values ($1,$2,'transferencia',500000,'aprobado',$3,$3)`, [t.g, v, cuando]);
});
after(async () => t && t.cerrar());
const mes = (m) => como(u.dueno, async () => (await t.q(`select public.gastos_mes($1, $2::date) as r`, [t.g, m]))[0].r);

test("cargar, ver la ganancia, quitar y repetir el mes siguiente", async () => {
  await como(u.dueno, async () => {
    await t.q(`select public.guardar_gasto($1, '2026-03-15', 'alquiler', 'Local', 200000)`, [t.g]);
    await t.q(`select public.guardar_gasto($1, '2026-03-01', 'sueldos', 'Ana', 150000.50)`, [t.g]);
    await t.falla(() => t.q(`select public.guardar_gasto($1, '2026-03-01', 'viajes', null, 10)`, [t.g]), /alquiler, sueldos/);
    await t.falla(() => t.q(`select public.guardar_gasto($1, '2026-03-01', 'otros', null, 0)`, [t.g]), /mayor a cero/);
  });
  let r = await mes("2026-03-20");
  assert.equal(Number(r.cobrado), 500000);
  assert.equal(Number(r.total), 350000.5);
  assert.equal(Number(r.ganancia), 149999.5);
  assert.equal(r.gastos.length, 2);
  const sueldo = r.gastos.find((g) => g.categoria === "sueldos");
  await como(u.dueno, () => t.q(`select public.quitar_gasto($1)`, [sueldo.gasto_id]));
  await como(u.dueno, () => t.falla(() => t.q(`select public.quitar_gasto($1)`, [sueldo.gasto_id]), /ya se había quitado/));
  r = await mes("2026-03-01");
  assert.equal(Number(r.total), 200000);
  const [{ n }] = await t.q(`select count(*)::int n from public.gastos where id = $1 and anulado_en is not null`, [sueldo.gasto_id]);
  assert.equal(n, 1, "quitado queda anulado, no se borra");
  const abril = await mes("2026-04-01");
  assert.equal(abril.mes_anterior_tiene, true);
  const [{ c }] = await como(u.dueno, () => t.q(`select public.repetir_gastos($1, '2026-04-01') as c`, [t.g]));
  assert.equal(c, 1);
  await como(u.dueno, () => t.falla(() => t.q(`select public.repetir_gastos($1, '2026-04-01')`, [t.g]), /ya tiene gastos/));
  assert.equal(Number((await mes("2026-04-01")).total), 200000);
});

test("el encargado no ve ni carga gastos", async () => {
  await como(u.encargado, () => t.falla(() => t.q(`select public.gastos_mes($1)`, [t.g]), /permiso/i));
  await como(u.encargado, () => t.falla(() => t.q(`select public.guardar_gasto($1, '2026-03-01', 'otros', null, 10)`, [t.g]), /permiso/i));
});
