// Push (0075): cada dispositivo se suscribe a lo que su rol puede recibir; la
// base decide a quién va cada hecho, una sola vez; solo la clave de servicio
// ve los destinos.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir } from "./_comun.mjs";

let t, u = {}, socio, pago;
const EP = (x) => `https://push.ejemplo.invalid/${x}`;
const K = { p: "B".repeat(87), a: "A".repeat(22) };
async function persona(rol, nombre) {
  const [{ id }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`${rol}${Math.random()}@ejemplo.invalid`]);
  await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,$3,$4)`, [t.g, id, nombre, rol]);
  return id;
}
async function como(usuario, fn, rol = "authenticated") {
  await t.db.query(`set role ${rol}`);
  await t.q(`select set_config('request.jwt.claims', $1, false)`, [JSON.stringify({ sub: usuario, role: rol })]);
  try { return await fn(); } finally { await t.db.query("reset role"); await t.q(`select set_config('request.jwt.claims', '', false)`); }
}
const suscribir = (usuario, ep, tipos = null) => como(usuario, () => t.q(`select public.guardar_suscripcion_push($1,$2,$3,$4,$5)`, [t.g, EP(ep), K.p, K.a, tipos]));
const destinos = (evento, id) => como(null, async () => (await t.q(`select public.destinos_push($1, $2) as d`, [evento, id]))[0].d, "service_role");

before(async () => {
  t = await abrir("prueba-push");
  u.dueno = await persona("dueno", "Sofía");
  u.recepcion = await persona("recepcion", "Ana");
  u.profe = await persona("profe", "Diego");
  const [{ id }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`socio${Math.random()}@ejemplo.invalid`]);
  u.socio = id;
  [{ id: socio }] = await t.q(`insert into public.socios (gimnasio_id, nombre, apellido, usuario_id) values ($1,'Pablo','Push',$2) returning id`, [t.g, id]);
  const [{ id: v }] = await t.q(`insert into public.ventas (gimnasio_id, sede_id, socio_id, origen) values ($1,$2,$3,'app') returning id`, [t.g, t.sede, socio]);
  [{ id: pago }] = await t.q(`insert into public.pagos (gimnasio_id, venta_id, medio, monto, estado, comprobante_path) values ($1,$2,'transferencia',18000,'pendiente','x/1.jpg') returning id`, [t.g, v]);
});
after(async () => t && t.cerrar());

test("cada uno elige dentro de lo suyo; el profe y un desconocido no se suscriben", async () => {
  await suscribir(u.recepcion, "rec");
  await suscribir(u.dueno, "duena", ["caja", "pagos"]);   // "pagos" no es suyo: se ignora
  await suscribir(u.socio, "socio");
  const [{ s }] = await como(u.dueno, () => t.q(`select public.suscripcion_push($1, $2) as s`, [t.g, EP("duena")]));
  assert.deepEqual(s.tipos, ["caja"]);
  assert.deepEqual([...s.puede].sort(), ["caja", "comprobantes", "pedidos"]);
  await como(u.profe, () => t.falla(() => t.q(`select public.guardar_suscripcion_push($1,$2,$3,$4,null)`, [t.g, EP("profe"), K.p, K.a]), /Sin permiso/));
  await como(u.recepcion, () => t.falla(() => t.q(`select public.guardar_suscripcion_push($1,'http://inseguro',$2,$3,null)`, [t.g, K.p, K.a]), /inválida/));
  await como(u.recepcion, () => t.falla(() => t.q(`select public.destinos_push('comprobante', $1)`, [pago]), /permission denied/));
});

test("el comprobante va a quien lo revisa y lo eligió, una sola vez", async () => {
  const d = await destinos("comprobante", pago);
  assert.equal(d.titulo, "🏦 Pablo Push mandó un comprobante");
  assert.equal(d.cuerpo, "$18.000 para revisar");
  assert.deepEqual(d.destinos.map((x) => x.endpoint), [EP("rec")], "la dueña eligió solo caja");
  assert.equal(await destinos("comprobante", pago), null, "repetido no se manda");
});

test("el pago resuelto va al socio; baja_push borra el dispositivo", async () => {
  await t.q(`update public.pagos set estado = 'rechazado', rechazado_en = now(), rechazado_motivo = 'No se lee el monto' where id = $1`, [pago]);
  const d = await destinos("pago_resuelto", pago);
  assert.equal(d.titulo, "🧾 No pudimos aprobar tu comprobante");
  assert.equal(d.cuerpo, "No se lee el monto");
  assert.deepEqual(d.destinos.map((x) => x.endpoint), [EP("socio")]);
  await como(null, () => t.q(`select public.baja_push($1)`, [EP("socio")]), "service_role");
  const [{ n }] = await t.q(`select count(*)::int n from public.suscripciones_push where endpoint = $1`, [EP("socio")]);
  assert.equal(n, 0);
});
