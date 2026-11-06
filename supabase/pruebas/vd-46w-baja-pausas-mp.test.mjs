// VD-46W (7804): al dar de baja se rechazan los pedidos de pausa pendientes, y un "approved" tardío de MercadoPago sobre un pago
// que ya se rechazó (la baja lo cerró) no acredita nada pero deja escrito el cobro y avisa al dueño.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir } from "./_comun.mjs";

let t, u = {}, socio, otro;
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
const servicio = async (sql, args) => (await como(null, () => t.q(sql, args), "service_role"))[0];
const acreditar = async (pago, idMp, estado) =>
  (await servicio(`select public.acreditar_pago_mp($1, $2, $3, $4, null, null) as r`, [pago.pago_id, idMp, pago.monto, estado])).r;
const vigentes = async () => Number((await t.q(`select count(*) n from public.coberturas where socio_id = $1 and anulada_en is null`, [socio]))[0].n);

before(async () => {
  t = await abrir("prueba-vd46w");
  u.dueno = await persona("dueno");
  const [{ id }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`socio${Math.random()}@ejemplo.invalid`]);
  u.socio = id;
  [{ id: socio }] = await t.q(`update public.socios set usuario_id = $2 where gimnasio_id = $1 and nombre = 'Testigo' and apellido = 'Al Día' returning id`, [t.g, id]);
  [{ id: otro }] = await t.q(`select socio_id as id from public.suscripciones where gimnasio_id = $1 and socio_id <> $2 and baja_en is null limit 1`, [t.g, socio]);
  await como(u.dueno, () => t.q(`select public.guardar_mercadopago($1, $2, $3, 'prueba')`, [t.g, TOKEN, "s".repeat(32)]));
});
after(async () => t && t.cerrar());

test("dar de baja rechaza los pedidos de pausa pendientes (y deja constancia en el resultado)", async () => {
  const [{ id: su }] = await t.q(`select id from public.suscripciones where socio_id = $1 and baja_en is null limit 1`, [otro]);
  await t.q(`insert into public.pedidos_pausa (gimnasio_id, socio_id, suscripcion_id, desde, hasta, categoria)
             values ($1,$2,$3, now() + interval '1 day', now() + interval '10 days', 'viaje')`, [t.g, otro, su]);
  const r = await como(u.dueno, async () => (await t.q(`select public.dar_de_baja($1, 'mudanza') as r`, [otro]))[0].r);
  assert.equal(Number(r.pausas_rechazadas), 1);
  const [p] = await t.q(`select estado, resuelto_en from public.pedidos_pausa where socio_id = $1`, [otro]);
  assert.equal(p.estado, "rechazado"); assert.ok(p.resuelto_en);
});

test("un approved tardío sobre un pago cerrado por la baja no acredita nada: queda escrito y avisa al dueño", async () => {
  const antes = await vigentes();
  const p = (await como(u.socio, () => t.q(`select public.iniciar_pago_online($1) as p`, [socio])))[0].p;
  await como(u.dueno, () => t.q(`select public.dar_de_baja($1, 'precio')`, [socio]));
  const [cerrado] = await t.q(`select estado, rechazado_motivo from public.pagos where id = $1`, [p.pago_id]);
  assert.equal(cerrado.estado, "rechazado"); assert.match(cerrado.rechazado_motivo, /Baja del socio/);
  assert.equal(await acreditar(p, "990001", "approved"), "cobro_tarde");
  assert.equal(await acreditar(p, "990001", "approved"), "cobro_tarde", "repetirlo no cambia nada");
  const [d] = await t.q(`select estado, cobro_tarde_en, cobro_tarde_mp_id from public.pagos where id = $1`, [p.pago_id]);
  assert.equal(d.estado, "rechazado", "no se aprobó");
  assert.ok(d.cobro_tarde_en); assert.equal(d.cobro_tarde_mp_id, "990001");
  assert.equal(await vigentes(), antes, "no se habilitó nada");
  const av = await como(u.dueno, async () => (await t.q(`select public.avisos_pagos_mp($1) as r`, [t.g]))[0].r);
  assert.ok(av.items.some((i) => i.clave === `pago_mp:${p.pago_id}:cobro_tarde`), JSON.stringify(av.items.map((i) => i.clave)));
});

test("acreditar_pago_mp sigue siendo solo de la clave de servicio", async () => {
  await como(u.dueno, () => t.falla(() => t.q(`select public.acreditar_pago_mp(gen_random_uuid(), 'x', 1, 'approved', null, null)`), /permission denied/));
});
