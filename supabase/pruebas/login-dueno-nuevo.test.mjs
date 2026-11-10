// U0.1 · "Entro con el mail y la contraseña que creé y dice incorrectos". Lo que se puede reproducir en la base: el alta de un gimnasio con su dueño
// deja las filas correctas (gimnasio, dirección, equipo del dueño sin cuenta) y, al darle acceso, la cuenta queda vinculada y el dueño ve su gimnasio
// con el rol "dueno". El ingreso en sí (GoTrue) lo prueba scripts/e2e/fase-u0-login.mjs.
// Causas de URG-02 que esta prueba descarta o reproduce:
//   b) la cuenta existe pero no tiene fila en equipo (o apunta a otro gimnasio) → mi_sesion no trae ese gimnasio
//   e) mail con mayúsculas o espacios → usuario_por_mail lo encuentra igual (la cuenta se busca normalizada)
//   c) /g/<slug> resuelve el gimnasio por su slug, nunca cae a otro
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir } from "./_comun.mjs";

let t, admin;
before(async () => {
  t = await abrir("prueba-login-dueno");
  [{ id: admin }] = await t.q(`insert into auth.users (email) values ('admin-u0@ejemplo.invalid') returning id`);
  await t.q(`insert into public.administradores_plataforma (usuario_id) values ($1)`, [admin]);
});
after(async () => t && t.cerrar());
const comoServidor = async (fn) => {
  await t.db.query("savepoint srv");
  await t.db.query("set local role service_role");
  await t.q(`select set_config('request.jwt.claims', '{"role":"service_role"}', true)`);
  try { return await fn(); } finally { await t.db.query("reset role"); await t.db.query("release savepoint srv"); }
};
// Como la persona y lo que escribe QUEDA.
async function como(usuario, sql, params) {
  await t.q(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: usuario, role: "authenticated" })]);
  await t.q(`set local role authenticated`);
  try { return await t.q(sql, params); } finally { await t.q(`reset role`); await t.q(`select set_config('request.jwt.claims', '', true)`); }
}

test("el alta deja gimnasio + equipo del dueño sin cuenta; al darle acceso el dueño ve su gimnasio con el rol dueño", async () => {
  const [{ r }] = await como(admin, `select public.admin_crear_gimnasio('template-gym-u0', 'Template Gym', 'localhost', 'Mateo Dueño') r`);
  const g = r.gimnasio_id, equipoId = r.equipo_id;
  assert.ok(g && equipoId);
  const [e] = await t.q(`select rol, activo, usuario_id, es_soporte from public.equipo where id = $1 and gimnasio_id = $2`, [equipoId, g]);
  assert.deepEqual([e.rol, e.activo, e.usuario_id, e.es_soporte], ["dueno", true, null, false], "el dueño queda en el equipo, activo y todavía sin cuenta");
  const lista = await como(admin, `select duenos_sin_cuenta from public.admin_gimnasios() where gimnasio_id = $1`, [g]);
  assert.equal(lista[0].duenos_sin_cuenta, 1, "la lista de gimnasios lo marca como alta pendiente (U1)");

  // La cuenta (GoTrue) se crea con el mail normalizado; acá se simula la fila de auth.users.
  const [{ id: mateo }] = await t.q(`insert into auth.users (email) values ('mateo@ejemplo.invalid') returning id`);
  // Sin vincular: la cuenta existe pero no tiene acceso a ningún gimnasio (causa b).
  const [{ s: sinFila }] = await como(mateo, `select public.mi_sesion() s`);
  assert.deepEqual(sinFila.equipo, [], "cuenta sin fila en equipo: mi_sesion no trae ningún gimnasio");
  // El mail se encuentra aunque venga con mayúsculas o espacios (causa e).
  await comoServidor(async () => {
    for (const escrito of ["mateo@ejemplo.invalid", "  Mateo@Ejemplo.Invalid ", "MATEO@EJEMPLO.INVALID"]) {
      const [{ u }] = await t.q(`select public.usuario_por_mail($1) u`, [escrito]);
      assert.equal(u, mateo, `“${escrito}” tiene que encontrar la cuenta`);
    }
    await t.q(`select public.vincular_usuario_equipo($1, $2)`, [equipoId, mateo]);
  });
  const [{ s }] = await como(mateo, `select public.mi_sesion() s`);
  assert.equal(s.equipo.length, 1);
  assert.deepEqual([s.equipo[0].slug, s.equipo[0].rol, s.equipo[0].gimnasio_id], ["template-gym-u0", "dueno", g], "con acceso, el dueño ve SU gimnasio con el rol dueño");
  const fin = await como(admin, `select duenos_sin_cuenta from public.admin_gimnasios() where gimnasio_id = $1`, [g]);
  assert.equal(fin[0].duenos_sin_cuenta, 0);
  // Y entra al panel de ese gimnasio (la base lo deja).
  const [{ p }] = await como(mateo, `select public.panel_gimnasio($1) p`, [g]);
  assert.equal(p.yo.rol, "dueno");
});

test("/g/<slug> resuelve el gimnasio de esa dirección y un slug que no existe no cae a otro (PLAT-03)", async () => {
  await t.db.query("savepoint anon"); await t.db.query("set local role anon");
  try {
    const a = (await t.db.query(`select * from public.gimnasio_por_slug('template-gym-u0')`)).rows;
    assert.deepEqual(a.map((x) => x.slug), ["template-gym-u0"], "el slug del gimnasio nuevo resuelve a ESE gimnasio");
    const todos = (await t.db.query(`select * from public.gimnasio_por_slug('no-existe-nunca')`)).rows;
    assert.equal(todos.length, 0, "un slug inexistente no cae a un gimnasio por defecto ni al demo");
  } finally { await t.db.query("rollback to savepoint anon"); }
});

test("una cuenta con acceso a OTRO gimnasio no ve este (causa b: la fila apunta a otro gimnasio)", async () => {
  const [{ id: otro }] = await t.q(`insert into public.gimnasios (slug, nombre) values ('otro-u0', 'Otro') returning id`);
  const [{ id: u }] = await t.q(`insert into auth.users (email) values ('dueno-otro@ejemplo.invalid') returning id`);
  await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,'Dueño Otro','dueno')`, [otro, u]);
  const [{ s }] = await como(u, `select public.mi_sesion() s`);
  assert.deepEqual(s.equipo.map((x) => x.slug), ["otro-u0"]);
  await t.db.query("savepoint x");
  await t.db.query("set local role authenticated");
  await t.q(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: u, role: "authenticated" })]);
  let mensaje = null;
  try { await t.db.query(`select public.panel_gimnasio($1)`, [t.g]); } catch (e) { mensaje = e.message; }
  await t.db.query("rollback to savepoint x");
  assert.match(mensaje ?? "", /Sin permiso/, "el dueño de otro gimnasio no tiene que ver el panel de este");
});
