// Mateo 16/11 · El reglamento nuevo se acepta al abrir la app (migración 20261116120000).
// Solo ante una versión NUEVA de algo que ya aceptó; la acepta únicamente el propio socio; la puerta no cambia por esto.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir, HOY } from "./_comun.mjs";

let t, u = {}, socio, sinAceptar, otroGim, socioOtro, r1;
const uno = async (sql, p) => (await t.q(sql, p))[0];
async function como(usuario, fn) {
  await t.db.query("set role authenticated");
  await t.q(`select set_config('request.jwt.claims', $1, false)`, [JSON.stringify({ sub: usuario, role: "authenticated" })]);
  try { return await fn(); } finally { await t.db.query("reset role"); await t.q(`select set_config('request.jwt.claims', '', false)`); }
}
const usuario = async () => (await uno(`insert into auth.users (email) values ($1) returning id`, [`u${Math.random()}@ejemplo.invalid`])).id;
before(async () => {
  t = await abrir("prueba-reglamento-nuevo");
  u.socio = await usuario(); u.recep = await usuario(); u.otro = await usuario();
  await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1, $2, 'Recepción', 'recepcion')`, [t.g, u.recep]);
  socio = (await uno(`insert into public.socios (gimnasio_id, nombre, apellido, dni, telefono, usuario_id) values ($1, 'Rita', 'Reglamento', '33111222', '+5490001110001', $2) returning id`, [t.g, u.socio])).id;
  sinAceptar = (await uno(`insert into public.socios (gimnasio_id, nombre, apellido, dni, telefono) values ($1, 'Nico', 'Nunca', '33111223', '+5490001110002') returning id`, [t.g])).id;
  otroGim = (await uno(`insert into public.gimnasios (slug, nombre) values ('prueba-reglamento-otro', 'Otro') returning id`)).id;
  socioOtro = (await uno(`insert into public.socios (gimnasio_id, nombre, apellido, dni, telefono, usuario_id) values ($1, 'Otra', 'Persona', '33111224', '+5490001110003', $2) returning id`, [otroGim, u.otro])).id;
  r1 = (await uno(`insert into public.reglamentos (gimnasio_id, version, texto) values ($1, 1, 'Reglamento uno: traé toalla y respetá los horarios de las clases.') returning id`, [t.g])).id;
  await t.q(`insert into public.aceptaciones_reglamento (gimnasio_id, socio_id, reglamento_id) values ($1, $2, $3)`, [t.g, socio, r1]);
});
after(async () => t && t.cerrar());
const docs = (uid, sid) => como(uid, async () => (await t.q(`select public.documentos_socio($1) d`, [sid]))[0].d);

test("con la misma versión que ya aceptó no se pide nada; con una versión nueva, sí (una sola tarjeta con el texto)", async () => {
  assert.equal((await docs(u.socio, socio)).reglamento_nuevo, null);
  await t.q(`insert into public.reglamentos (gimnasio_id, version, texto) values ($1, 2, 'Reglamento dos: ahora también hay que traer candado propio, gracias.')`, [t.g]);
  const d = await docs(u.socio, socio);
  assert.equal(d.reglamento_nuevo.version, 2);
  assert.equal(d.reglamento_nuevo.anterior, 1);
  assert.match(d.reglamento_nuevo.texto, /candado propio/);
  assert.ok(Array.isArray(d.pendientes), "lo que ya devolvía sigue ahí");
});

test("quien nunca aceptó ninguna versión no recibe la tarjeta (no es una versión nueva de algo que ya aceptó)", async () => {
  const usr = await usuario();
  await t.q(`update public.socios set usuario_id = $2 where id = $1`, [sinAceptar, usr]);
  assert.equal((await docs(usr, sinAceptar)).reglamento_nuevo, null);
});

test("solo el propio socio la acepta; versión equivocada, otra persona y la recepción dan error; al aceptar queda anotada y la tarjeta desaparece", async () => {
  await como(u.recep, () => t.falla(() => t.q(`select public.aceptar_reglamento($1, 2)`, [socio]), /no es tuya/));
  await como(u.otro, () => t.falla(() => t.q(`select public.aceptar_reglamento($1, 2)`, [socio]), /no es tuya/));
  await como(u.socio, () => t.falla(() => t.q(`select public.aceptar_reglamento($1, 1)`, [socio]), /cambió/));
  await t.db.query("set role anon");
  await t.falla(() => t.q(`select public.aceptar_reglamento($1, 2)`, [socio]), /permission denied/);
  await t.db.query("reset role");
  // La recepción no ve la tarjeta del socio (es del propio socio) pero sí lo que ya devolvía.
  assert.equal((await docs(u.recep, socio)).reglamento_nuevo, undefined);
  const antes = (await uno(`select to_jsonb(privado.calcular_acceso($1, $2, $3)) e`, [socio, await t.en(HOY), t.sede])).e;
  await como(u.socio, () => t.q(`select public.aceptar_reglamento($1, 2)`, [socio]));
  await como(u.socio, () => t.q(`select public.aceptar_reglamento($1, 2)`, [socio]));   // repetir no duplica
  assert.equal((await uno(`select count(*)::int n from public.aceptaciones_reglamento a join public.reglamentos r on r.id = a.reglamento_id where a.socio_id = $1 and r.version = 2`, [socio])).n, 1);
  assert.equal((await docs(u.socio, socio)).reglamento_nuevo, null);
  assert.deepEqual((await uno(`select to_jsonb(privado.calcular_acceso($1, $2, $3)) e`, [socio, await t.en(HOY), t.sede])).e, antes, "la puerta no cambió por aceptar");
});

test("un socio de otro gimnasio no ve ni acepta el reglamento de este (error, nunca vacío)", async () => {
  await como(u.otro, () => t.falla(() => t.q(`select public.documentos_socio($1)`, [socio]), /Sin permiso/));
  await como(u.otro, () => t.falla(() => t.q(`select public.aceptar_reglamento($1, 2)`, [socio]), /no es tuya/));
  assert.equal(socioOtro != null, true);
});
