// Pagos online (0079): el dueño conecta MercadoPago (secretos en Vault), el
// socio inicia el pago al precio de ese medio, y solo el servidor (clave de
// servicio) acredita: una vez, con el monto exacto; repetido no acredita dos veces.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir } from "./_comun.mjs";

let t, u = {}, socio, pago;
const TOKEN = "TEST-1234567890123456-abcdefABCDEF-1234567890";
async function persona(rol) {
  const [{ id }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`${rol}${Math.random()}@ejemplo.invalid`]);
  await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,$3,$4)`, [t.g, id, `P ${rol}`, rol]);
  return id;
}
async function como(usuario, fn, rol = "authenticated") {
  await t.db.query(`set role ${rol}`);
  await t.q(`select set_config('request.jwt.claims', $1, false)`, [JSON.stringify({ sub: usuario, role: rol })]);
  try { return await fn(); } finally { await t.db.query("reset role"); await t.q(`select set_config('request.jwt.claims', '', false)`); }
}
const servicio = (sql, args) => como(null, async () => (await t.q(sql, args))[0], "service_role");
before(async () => {
  t = await abrir("prueba-pagos-online");
  u.dueno = await persona("dueno"); u.encargado = await persona("encargado");
  const [{ id }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`socio${Math.random()}@ejemplo.invalid`]);
  u.socio = id;
  [{ id: socio }] = await t.q(`update public.socios set usuario_id = $2 where gimnasio_id = $1 and nombre = 'Testigo' and apellido = 'Al Día' returning id`, [t.g, id]);
});
after(async () => t && t.cerrar());

test("conectar: solo el dueño, token con forma de token, sin secretos a la vista", async () => {
  await como(u.socio, () => t.falla(() => t.q(`select public.pago_online_disponible($1)`, [socio]).then(([r]) => {
    if (!r.pago_online_disponible.disponible) throw new Error(r.pago_online_disponible.motivo);
  }), /no tiene pagos online/));
  await como(u.encargado, () => t.falla(() => t.q(`select public.guardar_mercadopago($1, $2, $3, 'prueba')`, [t.g, TOKEN, "x".repeat(32)]), /permiso/i));
  await como(u.dueno, () => t.falla(() => t.q(`select public.guardar_mercadopago($1, 'mi-clave', $2, 'prueba')`, [t.g, "x".repeat(32)]), /APP_USR-/));
  await como(u.dueno, () => t.q(`select public.guardar_mercadopago($1, $2, $3, 'prueba')`, [t.g, TOKEN, "s".repeat(32)]));
  const [{ e }] = await como(u.encargado, () => t.q(`select public.estado_pagos_online($1) as e`, [t.g]));
  assert.equal(e.conectado, true); assert.equal(e.modo, "prueba"); assert.equal(e.token, undefined);
  await como(u.dueno, () => t.falla(() => t.q(`select public.credenciales_mp($1)`, [t.g]), /permission denied/));
  const { c } = await servicio(`select public.credenciales_mp($1) as c`, [t.g]);
  assert.equal(c.token, TOKEN);
  assert.equal(c.webhook_secreto, "s".repeat(32));
  const [{ n }] = await t.q(`select count(*)::int n from public.proveedores_pago where gimnasio_id = $1 and token_secreto_id is not null`, [t.g]);
  assert.equal(n, 1, "la tabla guarda el id del secreto, no el token");
});

test("el socio inicia el pago (se reusa si vuelve a tocar) y solo él lo ve", async () => {
  const [{ d }] = await como(u.socio, () => t.q(`select public.pago_online_disponible($1) as d`, [socio]));
  assert.equal(d.disponible, true); assert.ok(Number(d.monto) > 0);
  const [{ p }] = await como(u.socio, () => t.q(`select public.iniciar_pago_online($1) as p`, [socio]));
  const [{ p: otra }] = await como(u.socio, () => t.q(`select public.iniciar_pago_online($1) as p`, [socio]));
  assert.equal(otra.pago_id, p.pago_id, "no se apilan pagos pendientes");
  assert.equal(Number(p.monto), Number(d.monto));
  pago = p;
  const [{ e }] = await como(u.socio, () => t.q(`select public.pago_online($1) as e`, [p.pago_id]));
  assert.equal(e.estado, "pendiente");
  await como(u.encargado, () => t.falla(() => t.q(`select public.pago_online($1)`, [p.pago_id]), /Sin permiso/));
  // La recepción no lo puede aprobar a mano: lo confirma el webhook.
  await como(u.dueno, () => t.falla(() => t.q(`select public.aprobar_pago($1)`, [p.pago_id]), /webhook/));
});

test("acreditar: monto exacto, una sola vez; el evento repetido se reconoce", async () => {
  const ev1 = await servicio(`select public.registrar_evento_webhook('mp_cobros', 'payment', '999001', $1, '{}') as r`, [t.g]);
  assert.equal(ev1.r.nuevo, true);
  const ev2 = await servicio(`select public.registrar_evento_webhook('mp_cobros', 'payment', '999001', $1, '{}') as r`, [t.g]);
  assert.equal(ev2.r.nuevo, false);
  await como(null, () => t.falla(() => t.q(`select public.acreditar_pago_mp($1, '999001', $2, 'approved')`, [pago.pago_id, Number(pago.monto) - 1]), /no se acredita/), "service_role");
  const antes = Number((await t.q(`select count(*) n from public.coberturas where socio_id = $1`, [socio]))[0].n);
  const r1 = await servicio(`select public.acreditar_pago_mp($1, '999001', $2, 'approved') as r`, [pago.pago_id, pago.monto]);
  assert.equal(r1.r, "acreditado");
  const r2 = await servicio(`select public.acreditar_pago_mp($1, '999001', $2, 'approved') as r`, [pago.pago_id, pago.monto]);
  assert.equal(r2.r, "ya_acreditado");
  const despues = Number((await t.q(`select count(*) n from public.coberturas where socio_id = $1`, [socio]))[0].n);
  assert.equal(despues, antes + 1, "una cobertura nueva, no dos");
  await servicio(`select public.cerrar_evento_webhook($1)`, [ev1.r.evento_id]);
  const ev3 = await servicio(`select public.registrar_evento_webhook('mp_cobros', 'payment', '999001', $1, '{}') as r`, [t.g]);
  assert.equal(ev3.r.procesado, true);
  await como(u.dueno, () => t.falla(() => t.q(`select public.acreditar_pago_mp($1, 'x', 1, 'approved')`, [pago.pago_id]), /permission denied/));
});
