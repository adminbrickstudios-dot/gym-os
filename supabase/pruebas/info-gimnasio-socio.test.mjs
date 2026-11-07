// VD-63 · info_gimnasio_socio: el socio relee el reglamento vigente de su gimnasio (aunque ya lo firmó);
// ni otro socio, ni el equipo, ni nadie sin sesión lo piden por esta vía.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir } from "./_comun.mjs";

let t, u = {}, socio;
async function como(usuario, fn) {
  await t.db.query("set role authenticated");
  await t.q(`select set_config('request.jwt.claims', $1, false)`, [JSON.stringify({ sub: usuario, role: "authenticated" })]);
  try { return await fn(); } finally { await t.db.query("reset role"); await t.q(`select set_config('request.jwt.claims', '', false)`); }
}
before(async () => {
  t = await abrir("prueba-info-socio");
  const [{ id: ud }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`dueno${Math.random()}@ejemplo.invalid`]);
  await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,'Dueña','dueno')`, [t.g, ud]);
  u.dueno = ud;
  for (const n of ["a", "b"]) {
    const [{ id }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`${n}${Math.random()}@ejemplo.invalid`]);
    u[n] = id;
  }
  [{ id: socio }] = await t.q(`insert into public.socios (gimnasio_id, nombre, apellido, usuario_id) values ($1,'Info','Uno',$2) returning id`, [t.g, u.a]);
  await t.q(`insert into public.socios (gimnasio_id, nombre, apellido, usuario_id) values ($1,'Info','Dos',$2)`, [t.g, u.b]);
});
after(async () => t && t.cerrar());

test("sin reglamento cargado devuelve null en ese campo (no un error)", async () => {
  await como(u.a, async () => {
    const [{ r }] = await t.q(`select public.info_gimnasio_socio($1) r`, [socio]);
    assert.equal(r.reglamento, null);
  });
});

test("el socio relee el reglamento vigente, también después de firmarlo, y ve la versión nueva", async () => {
  const TEXTO = "1. Traé toalla. 2. Dejá los discos en su lugar. 3. Respetá los horarios.";
  const v1 = await como(u.dueno, async () => (await t.q(`select public.guardar_documento($1, 'reglamento', 'Reglamento', $2) id`, [t.g, TEXTO]))[0].id);
  await como(u.a, async () => {
    await t.q(`select public.firmar_documento($1, $2, 'Info Uno')`, [v1, socio]);
    const [{ r }] = await t.q(`select public.info_gimnasio_socio($1) r`, [socio]);
    assert.equal(r.reglamento.texto, TEXTO);
    assert.equal(r.reglamento.version, 1);
  });
  await como(u.dueno, () => t.q(`select public.guardar_documento($1, 'reglamento', 'Reglamento', $2)`, [t.g, TEXTO + " 4. Nuevo punto."]));
  await como(u.a, async () => {
    const [{ r }] = await t.q(`select public.info_gimnasio_socio($1) r`, [socio]);
    assert.equal(r.reglamento.version, 2);
    assert.match(r.reglamento.texto, /Nuevo punto/);
  });
});

test("otro socio, el equipo y quien no tiene sesión reciben un error de permiso, no un resultado vacío", async () => {
  await como(u.b, () => t.falla(() => t.q(`select public.info_gimnasio_socio($1)`, [socio]), /permiso/i));
  await como(u.dueno, () => t.falla(() => t.q(`select public.info_gimnasio_socio($1)`, [socio]), /permiso/i));
  await t.db.query("set role anon");
  try { await t.falla(() => t.q(`select public.info_gimnasio_socio($1)`, [socio]), /permission denied|permiso/i); }
  finally { await t.db.query("reset role"); }
});
