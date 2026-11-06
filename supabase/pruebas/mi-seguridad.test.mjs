// VD-33b: mi_seguridad devuelve SOLO las sesiones de quien pregunta, marca la actual y dice si tiene contraseña.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir } from "./_comun.mjs";

let t, uA, uB, sesionA1, sesionA2;
before(async () => {
  t = await abrir("prueba-seguridad");
  [{ id: uA }] = await t.q(`insert into auth.users (email, encrypted_password) values ($1, 'hash') returning id`, [`a${Math.random()}@ejemplo.invalid`]);
  [{ id: uB }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`b${Math.random()}@ejemplo.invalid`]);
  [{ id: sesionA1 }] = await t.q(`insert into auth.sessions (user_id, user_agent) values ($1, 'Mozilla/5.0 Chrome/120 Windows') returning id`, [uA]);
  [{ id: sesionA2 }] = await t.q(`insert into auth.sessions (user_id, user_agent, updated_at) values ($1, 'Mozilla/5.0 iPhone Safari/604', now() - interval '1 day') returning id`, [uA]);
  await t.q(`insert into auth.sessions (user_id, user_agent) values ($1, 'ajena')`, [uB]);
  await t.q(`insert into auth.sessions (user_id, user_agent, not_after) values ($1, 'vencida', now() - interval '1 hour')`, [uA]);
});
after(async () => t && t.cerrar());

async function como(usuario, sesion, fn) {
  await t.db.query("savepoint sm");
  try {
    await t.db.query("set local role authenticated");
    await t.db.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: usuario, role: "authenticated", session_id: sesion })]);
    return await fn();
  } finally { await t.db.query("rollback to savepoint sm"); }
}

test("cada uno ve solo sus sesiones vigentes, la actual primero y marcada", async () => {
  const [{ r }] = await como(uA, sesionA2, () => t.q(`select public.mi_seguridad() as r`));
  assert.equal(r.tiene_contrasena, true);
  assert.equal(r.sesiones.length, 2);
  assert.equal(r.sesiones[0].id, sesionA2);
  assert.equal(r.sesiones[0].actual, true);
  assert.equal(r.sesiones[1].id, sesionA1);
  assert.equal(r.sesiones[1].actual, false);
  assert.ok(!r.sesiones.some((s) => /ajena|vencida/.test(s.user_agent)));
});

test("quien entra solo con código no tiene contraseña y no ve las de otro", async () => {
  const [{ r }] = await como(uB, null, () => t.q(`select public.mi_seguridad() as r`));
  assert.equal(r.tiene_contrasena, false);
  assert.equal(r.sesiones.length, 1);
  assert.equal(r.sesiones[0].user_agent, "ajena");
  assert.equal(r.sesiones[0].actual, false);
});

test("sin sesión es un error, no una lista vacía; y anon no puede llamarla", async () => {
  await t.falla(() => como(null, null, () => t.q(`select public.mi_seguridad()`)), /iniciar sesión/);
  await t.db.query("savepoint a");
  await t.db.query("set local role anon");
  await assert.rejects(() => t.db.query(`select public.mi_seguridad()`), /permission denied|permiso/i);
  await t.db.query("rollback to savepoint a");
});
