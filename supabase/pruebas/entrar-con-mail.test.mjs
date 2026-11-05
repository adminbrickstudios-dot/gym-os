// APP-9 (0098): el socio entra con su mail y un código; el servidor lo
// vincula a los socios del gimnasio con ese mail (no a los menores, no a
// otro gimnasio). Si ya entraba con el celular, se dice.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir } from "./_comun.mjs";

let t;
before(async () => { t = await abrir("prueba-entrar-mail"); });
after(async () => t && t.cerrar());
async function comoServidor(fn) {
  await t.db.query("savepoint v");
  await t.db.query("set local role service_role");
  await t.q(`select set_config('request.jwt.claims', '{"role":"service_role"}', true)`);
  try { return await fn(); } finally { await t.db.query("reset role"); await t.db.query("release savepoint v"); }
}

test("vincula por mail verificado; menores y no verificados no; un usuario no se vincula solo", async () => {
  const [{ id: s }] = await t.q(`insert into public.socios (gimnasio_id, nombre, apellido, email) values ($1,'Mail','Adulto','Ana@Ejemplo.invalid') returning id`, [t.g]);
  const [{ id: menor }] = await t.q(`insert into public.socios (gimnasio_id, nombre, apellido, email, fecha_nacimiento) values ($1,'Mail','Menor','ana@ejemplo.invalid', now()::date - 3650) returning id`, [t.g]);
  const [{ id: u }] = await t.q(`insert into auth.users (email, email_confirmed_at) values ('ana@ejemplo.invalid', now()) returning id`);
  const [{ id: sinVerificar }] = await t.q(`insert into auth.users (email) values ('beto@ejemplo.invalid') returning id`);
  await t.comoUsuario(u, () => t.falla(() => t.q(`select public.vincular_socios_por_email($1, $2)`, [t.g, u]), /permission denied|servidor/));
  const r = await comoServidor(async () => (await t.q(`select public.vincular_socios_por_email($1, $2) r`, [t.g, u]))[0].r);
  assert.deepEqual(r, { vinculados: 1, ya_vinculado: false });
  const filas = await t.q(`select id, usuario_id from public.socios where id = any($1)`, [[s, menor]]);
  assert.equal(filas.find((f) => f.id === s).usuario_id, u);
  assert.equal(filas.find((f) => f.id === menor).usuario_id, null, "el menor no se vincula por mail");
  await comoServidor(() => t.falla(() => t.q(`select public.vincular_socios_por_email($1, $2)`, [t.g, sinVerificar]), /no está verificado/));
});

test("si el socio ya entra con otra cuenta (el celular), lo dice", async () => {
  const [{ id: viejo }] = await t.q(`insert into auth.users (phone, phone_confirmed_at) values ('+5490000777099', now()) returning id`);
  await t.q(`insert into public.socios (gimnasio_id, nombre, apellido, email, usuario_id) values ($1,'Ya','Vinculado','caro@ejemplo.invalid',$2)`, [t.g, viejo]);
  const [{ id: u }] = await t.q(`insert into auth.users (email, email_confirmed_at) values ('caro@ejemplo.invalid', now()) returning id`);
  const r = await comoServidor(async () => (await t.q(`select public.vincular_socios_por_email($1, $2) r`, [t.g, u]))[0].r);
  assert.deepEqual(r, { vinculados: 0, ya_vinculado: true });
});
