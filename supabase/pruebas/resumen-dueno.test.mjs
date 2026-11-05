// Resumen del dueño (0074): cobrado por medio y por persona (lo fiado aparte),
// altas, el período anterior para comparar, y solo dueño y encargado.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir } from "./_comun.mjs";

let t, u = {}, rec;
async function persona(rol, nombre) {
  const [{ id }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`${rol}${Math.random()}@ejemplo.invalid`]);
  const [{ id: eid }] = await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,$3,$4) returning id`, [t.g, id, nombre, rol]);
  return { id, eid };
}
async function como(usuario, fn) {
  await t.db.query("set role authenticated");
  await t.q(`select set_config('request.jwt.claims', $1, false)`, [JSON.stringify({ sub: usuario, role: "authenticated" })]);
  try { return await fn(); } finally { await t.db.query("reset role"); await t.q(`select set_config('request.jwt.claims', '', false)`); }
}
async function cobro(medio, monto, cuando, por) {
  const [{ id: socio }] = await t.q(`insert into public.socios (gimnasio_id, nombre, apellido, creado_en) values ($1,'Res','Umen',$2) returning id`, [t.g, cuando]);
  const [{ id: v }] = await t.q(`insert into public.ventas (gimnasio_id, sede_id, socio_id, origen, estado, confirmada_en, creado_en) values ($1,$2,$3,'recepcion','confirmada',$4,$4) returning id`, [t.g, t.sede, socio, cuando]);
  await t.q(`insert into public.pagos (gimnasio_id, venta_id, medio, monto, estado, aprobado_en, creado_por, creado_en) values ($1,$2,$3,$4,'aprobado',$5,$6,$5)`, [t.g, v, medio, monto, cuando, por]);
}
before(async () => {
  t = await abrir("prueba-resumen");
  u.dueno = await persona("dueno", "Sofía");
  rec = await persona("recepcion", "Ana");
  const ayer = await t.en("2026-03-09", "10:00:00");
  const antes = await t.en("2026-03-08", "10:00:00");
  await cobro("transferencia", 20000, ayer, rec.eid);
  await cobro("debito", 5000, ayer, rec.eid);
  await cobro("cuenta_corriente", 3000, ayer, rec.eid);
  await cobro("transferencia", 10000, antes, u.dueno.eid);
});
after(async () => t && t.cerrar());
const resumen = (usuario, desde, dias = 1) => como(usuario, async () => (await t.q(`select public.resumen_dueno($1, $2::date, $3) as r`, [t.g, desde, dias]))[0].r);

test("cobrado por medio y por persona, lo fiado aparte, y el día anterior para comparar", async () => {
  const r = await resumen(u.dueno.id, "2026-03-09");
  assert.equal(Number(r.actual.cobrado), 25000);
  assert.equal(Number(r.actual.fiado), 3000);
  assert.deepEqual(r.actual.por_medio.map((m) => [m.medio, Number(m.total)]), [["transferencia", 20000], ["debito", 5000]]);
  assert.deepEqual(r.actual.por_persona.map((p) => [p.nombre, Number(p.total), p.cobros]), [["Ana", 25000, 2]]);
  assert.equal(r.actual.altas, 3);
  assert.equal(Number(r.anterior.cobrado), 10000);
  assert.equal(r.anterior.altas, 1);
  const s = await resumen(u.dueno.id, "2026-03-08", 2);
  assert.equal(Number(s.actual.cobrado), 35000);
  assert.equal(s.hasta, "2026-03-09");
});

test("solo dueño y encargado; ni días que no pasaron ni más de 31", async () => {
  await como(rec.id, () => t.falla(() => t.q(`select public.resumen_dueno($1)`, [t.g]), /permiso/i));
  await como(u.dueno.id, () => t.falla(() => t.q(`select public.resumen_dueno($1, (now() + interval '3 days')::date)`, [t.g]), /todavía no pasó/));
  await como(u.dueno.id, () => t.falla(() => t.q(`select public.resumen_dueno($1, '2026-01-01', 40)`, [t.g]), /1 a 31/));
});

test("la campana del dueño trae el resumen del día y el de la semana; la recepción no", async () => {
  const d = await como(u.dueno.id, async () => (await t.q(`select public.campana($1) as c`, [t.g]))[0].c);
  assert.ok(d.items.some((i) => i.clave.startsWith("resumen:") && i.href.startsWith("/resumen?dia=")));
  assert.ok(d.items.some((i) => i.clave.startsWith("resumen_semana:")));
  const r = await como(rec.id, async () => (await t.q(`select public.campana($1) as c`, [t.g]))[0].c);
  assert.ok(!r.items.some((i) => i.clave.startsWith("resumen")));
});
