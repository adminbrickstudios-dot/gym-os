// VD-6 (0138): planes_para_alta da el primer pago (cuota + matrícula) calculado por la base,
// y prospecto_por_telefono ofrece al Interesado con ese celular (sin error si el celular está a medio escribir).
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir } from "./_comun.mjs";

let t, recepcion, profe;
async function persona(rol) {
  const [{ id }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`${rol}${Math.random()}@ejemplo.invalid`]);
  await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,$3,$4)`, [t.g, id, rol, rol]);
  return id;
}
async function como(usuario, fn) {
  await t.db.query("set role authenticated");
  await t.q(`select set_config('request.jwt.claims', $1, false)`, [JSON.stringify({ sub: usuario, role: "authenticated" })]);
  try { return await fn(); } finally { await t.db.query("reset role"); await t.q(`select set_config('request.jwt.claims', '', false)`); }
}
before(async () => {
  t = await abrir("prueba-alta-rapida");
  recepcion = await persona("recepcion"); profe = await persona("profe");
});
after(async () => t && t.cerrar());

test("planes_para_alta: cada membresía activa con su cuota, matrícula y total", async () => {
  const [{ id: plan }] = await t.q(`select id from public.planes where gimnasio_id = $1 and tipo = 'membresia' and activo order by orden, nombre limit 1`, [t.g]);
  await t.q(`update public.planes set matricula = 5000 where id = $1`, [plan]);
  const lista = await como(recepcion, async () => (await t.q(`select public.planes_para_alta($1) r`, [t.sede]))[0].r);
  assert.ok(lista.length >= 1);
  const p = lista.find((x) => x.plan_id === plan);
  assert.ok(p, "el plan aparece");
  assert.equal(Number(p.matricula), 5000);
  assert.equal(Number(p.total_lista), Number(p.lista) + 5000, "el total lo suma la base");
  const n = await t.q(`select count(*)::int n from public.planes where gimnasio_id = $1 and tipo = 'membresia' and activo`, [t.g]);
  assert.equal(lista.length, n[0].n, "solo membresías activas");
});

test("planes_para_alta: la profe no la pide", async () => {
  await como(profe, () => t.falla(() => t.q(`select public.planes_para_alta($1)`, [t.sede]), /permiso/i));
});

test("prospecto_por_telefono: lo ofrece por celular, no si ya es socio, y un celular roto da vacío", async () => {
  await t.q(`insert into public.prospectos (gimnasio_id, nombre, telefono) values ($1, 'Juan Pérez', '+5490005550001')`, [t.g]);
  const r = await como(recepcion, async () => (await t.q(`select public.prospecto_por_telefono($1, '000 555 0001') r`, [t.g]))[0].r);
  assert.equal(r.nombre, "Juan Pérez");
  const roto = await como(recepcion, async () => (await t.q(`select public.prospecto_por_telefono($1, '12') r`, [t.g]))[0].r);
  assert.equal(roto, null);
  const otro = await como(recepcion, async () => (await t.q(`select public.prospecto_por_telefono($1, '000 555 0009') r`, [t.g]))[0].r);
  assert.equal(otro, null);
  const [{ id: socio }] = await t.q(`select id from public.socios where gimnasio_id = $1 limit 1`, [t.g]);
  await t.q(`update public.prospectos set estado = 'socio', socio_id = $2 where gimnasio_id = $1 and telefono = '+5490005550001'`, [t.g, socio]);
  const ya = await como(recepcion, async () => (await t.q(`select public.prospecto_por_telefono($1, '000 555 0001') r`, [t.g]))[0].r);
  assert.equal(ya, null, "si ya es socio no se ofrece");
});

test("prospecto_por_telefono: la profe no la pide", async () => {
  await como(profe, () => t.falla(() => t.q(`select public.prospecto_por_telefono($1, '000 555 0001')`, [t.g]), /permiso|equipo|acceso/i));
});
