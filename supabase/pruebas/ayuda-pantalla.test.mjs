// VD-31: las ayudas por pantalla se guardan por usuario en la base. marcar_ayuda es idempotente, cada uno
// ve solo lo suyo (RLS y funciones), apagar/reiniciar andan, y sin sesión es un error (no una lista vacía).
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir } from "./_comun.mjs";

let t, uA, uB;
before(async () => {
  t = await abrir("prueba-ayuda");
  [{ id: uA }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`a${Math.random()}@ejemplo.invalid`]);
  [{ id: uB }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`b${Math.random()}@ejemplo.invalid`]);
});
after(async () => t && t.cerrar());

const identidad = (usuario) => t.db.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: usuario, role: "authenticated" })]);

// Varias llamadas con la misma identidad dentro de la transacción de prueba, que se revierte al salir.
async function como(usuario, fn) {
  await t.db.query("savepoint ay");
  try {
    await t.db.query("set local role authenticated");
    await identidad(usuario);
    return await fn();
  } finally { await t.db.query("rollback to savepoint ay"); }
}

test("marcar_ayuda es idempotente: la primera vez dice true, la segunda false, y queda una sola fila", async () => {
  await como(uA, async () => {
    assert.equal((await t.q(`select public.marcar_ayuda('inicio') as r`))[0].r, true);
    assert.equal((await t.q(`select public.marcar_ayuda('inicio') as r`))[0].r, false);
    await t.q(`select public.marcar_ayuda('socios')`);
    const [{ r }] = await t.q(`select public.ayudas_vistas() as r`);
    assert.deepEqual(r.vistas, ["inicio", "socios"]);
    assert.equal(r.apagadas, false);
  });
});

test("cada usuario ve lo suyo: por la función y por la tabla (RLS)", async () => {
  await como(uA, async () => {
    await t.q(`select public.marcar_ayuda('caja')`);
    await identidad(uB);
    const [{ r }] = await t.q(`select public.ayudas_vistas() as r`);
    assert.deepEqual(r.vistas, []);
    assert.equal((await t.q(`select count(*)::int as n from public.ayudas_usuario`))[0].n, 0);
    await identidad(uA);
    assert.equal((await t.q(`select count(*)::int as n from public.ayudas_usuario`))[0].n, 1);
  });
});

test("apagar y volver a prender; reiniciar borra lo visto pero no la preferencia", async () => {
  await como(uA, async () => {
    await t.q(`select public.marcar_ayuda('inicio')`);
    await t.q(`select public.apagar_ayudas(true)`);
    await t.q(`select public.apagar_ayudas(true)`);
    let [{ r }] = await t.q(`select public.ayudas_vistas() as r`);
    assert.equal(r.apagadas, true);
    assert.deepEqual(r.vistas, ["inicio"]);
    assert.equal((await t.q(`select public.reiniciar_ayudas() as n`))[0].n, 1);
    [{ r }] = await t.q(`select public.ayudas_vistas() as r`);
    assert.deepEqual(r.vistas, []);
    assert.equal(r.apagadas, true);
    await t.q(`select public.apagar_ayudas(false)`);
    [{ r }] = await t.q(`select public.ayudas_vistas() as r`);
    assert.equal(r.apagadas, false);
  });
});

test("una clave mal escrita o reservada es un error; no se escribe directo en la tabla", async () => {
  await como(uA, async () => {
    await t.falla(() => t.q(`select public.marcar_ayuda('_apagadas')`), /no es válida/);
    await t.falla(() => t.q(`select public.marcar_ayuda('Con Espacios')`), /no es válida/);
    await t.falla(() => t.q(`select public.marcar_ayuda(null)`), /no es válida/);
    await t.falla(() => t.q(`insert into public.ayudas_usuario (usuario_id, clave) values ($1, 'x')`, [uA]), /permission denied|permiso/i);
  });
});

test("sin sesión es un error, no una lista vacía; y anon no puede llamarlas", async () => {
  await t.db.query("savepoint s0");
  await t.db.query("set local role authenticated");
  await identidad(null);
  for (const sql of [`select public.ayudas_vistas()`, `select public.marcar_ayuda('inicio')`, `select public.apagar_ayudas(true)`, `select public.reiniciar_ayudas()`]) {
    await t.falla(() => t.q(sql), /iniciar sesión/);
  }
  await t.db.query("rollback to savepoint s0");
  await t.db.query("savepoint a");
  await t.db.query("set local role anon");
  await assert.rejects(() => t.db.query(`select public.ayudas_vistas()`), /permission denied|permiso/i);
  await t.db.query("rollback to savepoint a");
});
