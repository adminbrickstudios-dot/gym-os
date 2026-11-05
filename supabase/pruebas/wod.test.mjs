// WOD (0085): el profe lo escribe en su clase (no en la de otro), lo ve el
// anotado en su app; vacío lo borra; la recepción no lo escribe.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir } from "./_comun.mjs";

let t, u = {}, socio, clase, ajena;
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
before(async () => {
  t = await abrir("prueba-wod");
  u.profe = await persona("profe", "Diego"); u.otro = await persona("profe", "Otro"); u.rec = await persona("recepcion", "Ana");
  const [{ id }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`socio${Math.random()}@ejemplo.invalid`]);
  u.socio = id;
  [{ id: socio }] = await t.q(`update public.socios set usuario_id = $2 where gimnasio_id = $1 and nombre = 'Testigo' and apellido = 'Al Día' returning id`, [t.g, id]);
  const [{ id: act }] = await t.q(`insert into public.actividades (gimnasio_id, nombre) values ($1, 'Crossfit') returning id`, [t.g]);
  [{ id: clase }] = await t.q(`insert into public.clases (gimnasio_id, sede_id, actividad_id, inicio, fin, profe_id) values ($1,$2,$3, now() + interval '3 hours', now() + interval '4 hours', $4) returning id`, [t.g, t.sede, act, u.profe.eid]);
  [{ id: ajena }] = await t.q(`insert into public.clases (gimnasio_id, sede_id, actividad_id, inicio, fin, profe_id) values ($1,$2,$3, now() + interval '5 hours', now() + interval '6 hours', $4) returning id`, [t.g, t.sede, act, u.otro.eid]);
  await t.q(`insert into public.reservas (gimnasio_id, clase_id, socio_id, estado) values ($1,$2,$3,'confirmada')`, [t.g, clase, socio]);
});
after(async () => t && t.cerrar());

test("el profe escribe el WOD de su clase y lo ve el anotado", async () => {
  await como(u.profe.id, () => t.q(`select public.guardar_wod($1, '  5 rondas: 10 burpees, 15 sentadillas  ')`, [clase]));
  const [{ w }] = await como(u.socio, () => t.q(`select public.wods_socio($1) as w`, [socio]));
  assert.equal(w.length, 1); assert.equal(w[0].wod, "5 rondas: 10 burpees, 15 sentadillas");
  const [{ d }] = await como(u.profe.id, () => t.q(`select public.clase_detalle($1) as d`, [clase]));
  assert.equal(d.wod_por, "Diego");
  await como(u.profe.id, () => t.falla(() => t.q(`select public.guardar_wod($1, 'x')`, [ajena]), /tus clases/));
  await como(u.rec.id, () => t.falla(() => t.q(`select public.guardar_wod($1, 'x')`, [clase]), /permiso/i));
  await como(u.profe.id, () => t.q(`select public.guardar_wod($1, '   ')`, [clase]));
  const [{ w: w2 }] = await como(u.socio, () => t.q(`select public.wods_socio($1) as w`, [socio]));
  assert.equal(w2.length, 0, "vacío lo borra");
});
