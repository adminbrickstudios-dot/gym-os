// Resultado (0076): el mes contra el anterior, por medio, por concepto y por
// día; lo fiado aparte; un mes que no empezó da error; solo dueño y encargado.
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
async function venta(cuando, medio, monto, item) {
  const [{ id: v }] = await t.q(`insert into public.ventas (gimnasio_id, sede_id, origen, estado, confirmada_en, creado_en) values ($1,$2,'recepcion','confirmada',$3,$3) returning id`, [t.g, t.sede, cuando]);
  await t.q(`insert into public.venta_items (gimnasio_id, venta_id, tipo, plan_id, descripcion, cantidad, precio_unitario) values ($1,$2,$3,$4,'x',1,$5)`, [t.g, v, item.tipo, item.plan ?? null, monto]);
  await t.q(`insert into public.pagos (gimnasio_id, venta_id, medio, monto, estado, aprobado_en, creado_en) values ($1,$2,$3,$4,'aprobado',$5,$5)`, [t.g, v, medio, monto, cuando]);
}
before(async () => {
  t = await abrir("prueba-resultado");
  u.dueno = await persona("dueno");
  u.recepcion = await persona("recepcion");
  const [{ id: pase, nombre }] = await t.q(`insert into public.planes (gimnasio_id, tipo, nombre, validez_dias) values ($1,'pase_diario','Pase prueba',1) returning id, nombre`, [t.g]);
  u.pase = { pase, nombre };
  await venta(await t.en("2026-03-02", "10:00:00"), "transferencia", 20000, { tipo: "pase", plan: pase });
  await venta(await t.en("2026-03-15", "18:00:00"), "debito", 5000, { tipo: "otro" });
  await venta(await t.en("2026-03-15", "19:00:00"), "cuenta_corriente", 3000, { tipo: "otro" });
  await venta(await t.en("2026-02-10", "10:00:00"), "transferencia", 10000, { tipo: "otro" });
});
after(async () => t && t.cerrar());
const resultado = (usuario, mes) => como(usuario, async () => (await t.q(`select public.resultado_mes($1, $2::date) as r`, [t.g, mes]))[0].r);

test("marzo: cobrado sin lo fiado, por medio, por concepto, por día y contra febrero", async () => {
  const r = await resultado(u.dueno, "2026-03-20");
  assert.equal(r.mes, "2026-03-01");
  assert.equal(r.en_curso, false);
  assert.equal(Number(r.cobrado), 25000);
  assert.equal(Number(r.fiado), 3000);
  assert.equal(Number(r.anterior_total), 10000);
  assert.deepEqual(r.por_medio.map((m) => [m.medio, Number(m.total)]), [["transferencia", 20000], ["debito", 5000]]);
  assert.deepEqual(r.por_concepto.map((c) => [c.concepto, Number(c.total)]), [[u.pase.nombre, 20000], ["Otros", 8000]]);
  assert.equal(r.por_dia.length, 31);
  assert.equal(Number(r.por_dia.find((d) => d.dia === "2026-03-15").total), 5000);
  assert.equal(r.horas.length, 24);
});

test("un mes que no empezó da error; la recepción no lo ve", async () => {
  await como(u.dueno, () => t.falla(() => t.q(`select public.resultado_mes($1, (now() + interval '2 months')::date)`, [t.g]), /todavía no empezó/));
  await como(u.recepcion, () => t.falla(() => t.q(`select public.resultado_mes($1)`, [t.g]), /permiso/i));
  const r = await resultado(u.dueno, null);
  assert.equal(r.en_curso, true);
  assert.ok(Number.isFinite(Number(r.recurrente)));
});

test("exportar el mes para el contador: ventas y pagos, fila por fila; la recepción no", async () => {
  const exp = (que) => como(u.dueno, async () => (await t.q(`select public.exportar_mes($1, '2026-03-01', $2) as r`, [t.g, que]))[0].r);
  const ventas = await exp("ventas");
  assert.equal(ventas.length, 3);
  assert.equal(ventas[0].fecha, "02/03/2026 10:00");
  assert.equal(Number(ventas[0].total), 20000);
  const pagos = await exp("pagos");
  assert.deepEqual(pagos.map((p) => p.medio), ["transferencia", "debito", "cuenta_corriente"]);
  assert.deepEqual(await exp("caja"), []);
  await como(u.dueno, () => t.falla(() => t.q(`select public.exportar_mes($1, null, 'socios')`, [t.g]), /ventas, pagos o caja/));
  await como(u.recepcion, () => t.falla(() => t.q(`select public.exportar_mes($1, null, 'ventas')`, [t.g]), /permiso/i));
});
