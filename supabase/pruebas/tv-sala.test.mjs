// COM-14 (0134): la TV de la sala. El dueño la crea (el token se ve una vez);
// sin sesión, la TV ve la clase de ahora con los anotados (inicial del
// apellido), su WOD y la próxima; un anotado nuevo aparece; revocada, no ve nada.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir } from "./_comun.mjs";

let t, u = {}, act, ahora, prox;
async function como(usuario, fn) {
  await t.db.query("set role authenticated");
  await t.q(`select set_config('request.jwt.claims', $1, false)`, [JSON.stringify({ sub: usuario, role: "authenticated" })]);
  try { return await fn(); } finally { await t.db.query("reset role"); await t.q(`select set_config('request.jwt.claims', '', false)`); }
}
async function comoAnon(fn) { await t.db.query("set role anon"); try { return await fn(); } finally { await t.db.query("reset role"); } }
before(async () => {
  t = await abrir("prueba-tv");
  for (const rol of ["dueno", "recepcion"]) {
    const [{ id }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`${rol}${Math.random()}@ejemplo.invalid`]);
    await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,$3,$4)`, [t.g, id, rol, rol]);
    u[rol] = id;
  }
  [{ id: act }] = await t.q(`insert into public.actividades (gimnasio_id, nombre, emoji) values ($1, 'Crossfit', '🏋️') returning id`, [t.g]);
  [{ id: ahora }] = await t.q(`insert into public.clases (gimnasio_id, sede_id, actividad_id, inicio, fin, cupo, wod)
    values ($1,$2,$3, now() - interval '10 minutes', now() + interval '50 minutes', 12, '21-15-9 thrusters') returning id`, [t.g, t.sede, act]);
  [{ id: prox }] = await t.q(`insert into public.clases (gimnasio_id, sede_id, actividad_id, inicio, fin, wod)
    values ($1,$2,$3, now() + interval '2 hours', now() + interval '3 hours', 'secreto') returning id`, [t.g, t.sede, act]);
  const [{ id: s1 }] = await t.q(`insert into public.socios (gimnasio_id, nombre, apellido) values ($1,'Ana','Pérez') returning id`, [t.g]);
  await t.q(`insert into public.reservas (gimnasio_id, clase_id, socio_id, estado) values ($1,$2,$3,'confirmada')`, [t.g, ahora, s1]);
});
after(async () => t && t.cerrar());

test("crear, ver la clase de ahora y la próxima, aparece un anotado nuevo, revocar", async () => {
  await como(u.recepcion, () => t.falla(() => t.q(`select public.crear_tv($1, $2, 'Sala')`, [t.g, t.sede]), /permiso|rol|acceso/i));
  const { id, token } = await como(u.dueno, async () => {
    await t.falla(() => t.q(`select public.crear_tv($1, $2, '  ')`, [t.g, t.sede]), /Ponele un nombre/);
    const [{ r }] = await t.q(`select public.crear_tv($1, $2, 'Sala grande') r`, [t.g, t.sede]);
    const [{ l }] = await t.q(`select public.tvs_panel($1) l`, [t.g]);
    assert.equal(l.length, 1); assert.equal(l[0].nombre, "Sala grande"); assert.equal(l[0].token, undefined);
    await t.falla(() => t.q(`select token_hash from public.pantallas_tv`), /permission|permiso/i);
    return r;
  });
  const e = await comoAnon(async () => (await t.q(`select public.tv_estado($1) e`, [token]))[0].e);
  assert.equal(e.ahora.clase_id, ahora);
  assert.equal(e.ahora.wod, "21-15-9 thrusters");
  assert.deepEqual(e.ahora.anotados.map((a) => a.nombre), ["Ana P."]);
  assert.equal(e.proxima.clase_id, prox);
  assert.equal(e.proxima.wod, undefined, "el WOD de la próxima no se adelanta");
  // Uno que vino sin reservar aparece, ya presente.
  const [{ id: s2 }] = await t.q(`insert into public.socios (gimnasio_id, nombre, apellido) values ($1,'Beto','') returning id`, [t.g]);
  await t.q(`insert into public.asistencias (gimnasio_id, clase_id, socio_id) values ($1,$2,$3)`, [t.g, ahora, s2]);
  const e2 = await comoAnon(async () => (await t.q(`select public.tv_estado($1) e`, [token]))[0].e);
  // (en la prueba todo pasa en una transacción: el orden por hora no se puede comparar)
  assert.deepEqual(e2.ahora.anotados.map((a) => [a.nombre, a.presente]).sort(), [["Ana P.", false], ["Beto", true]]);
  await comoAnon(() => t.falla(() => t.q(`select public.tv_estado('cualquiera')`), /no está autorizada/));
  // El token de la TV no sirve como tablet de entrada.
  await comoAnon(() => t.falla(() => t.q(`select public.kiosco_estado($1)`, [token]), /no está autorizada|apagada/));
  await como(u.dueno, () => t.q(`select public.revocar_tv($1)`, [id]));
  await comoAnon(() => t.falla(() => t.q(`select public.tv_estado($1)`, [token]), /no está autorizada/));
});
