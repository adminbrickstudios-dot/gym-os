// Pase 2.0 · la llave "estilo" por gimnasio (migración 20261118120000): entra apagada, la cambia solo el dueño (y el super admin por su puerta),
// y viaja con la dirección que resuelve el proxy. Permiso denegado = error, nunca un vacío.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir } from "./_comun.mjs";

let t, u = {}, g2;
const uno = async (sql, p) => (await t.q(sql, p))[0];
async function como(usuario, fn) {
  await t.db.query("set role authenticated");
  await t.q(`select set_config('request.jwt.claims', $1, false)`, [JSON.stringify({ sub: usuario, role: "authenticated" })]);
  try { return await fn(); } finally { await t.db.query("reset role"); await t.q(`select set_config('request.jwt.claims', '', false)`); }
}
const usuario = async () => (await uno(`insert into auth.users (email) values ($1) returning id`, [`u${Math.random()}@ejemplo.invalid`])).id;
before(async () => {
  t = await abrir("prueba-estilo");
  for (const k of ["dueno", "recepcion", "ajeno"]) u[k] = await usuario();
  await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,'Dueno','dueno'), ($1,$3,'Recep','recepcion')`, [t.g, u.dueno, u.recepcion]);
  g2 = (await uno(`insert into public.gimnasios (slug, nombre) values ('prueba-estilo-otro', 'Otro') returning id`)).id;
  await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,'Ajeno','dueno')`, [g2, u.ajeno]);
});
after(async () => t && t.cerrar());

test("un gimnasio nuevo entra en el estilo clásico", async () => {
  assert.equal((await uno(`select estilo from public.configuracion_gimnasio where gimnasio_id = $1`, [t.g])).estilo, "clasico");
  assert.deepEqual(await como(u.recepcion, async () => (await uno(`select public.estilo_gimnasio($1) e`, [t.g])).e), { estilo: "clasico", modo: "oscuro" });
});

test("el dueño lo cambia y lo vuelve atrás (y elige el modo); un valor raro es un error", async () => {
  assert.equal(await como(u.dueno, async () => (await uno(`select public.guardar_estilo_gimnasio($1, 'pista', 'claro') e`, [t.g])).e), "pista");
  assert.equal((await uno(`select modo from public.configuracion_gimnasio where gimnasio_id = $1`, [t.g])).modo, "claro");
  await como(u.dueno, () => t.falla(() => t.q(`select public.guardar_estilo_gimnasio($1, 'pista', 'violeta')`, [t.g]), /claro u oscuro/));
  await t.q(`update public.configuracion_gimnasio set modo = 'oscuro' where gimnasio_id = $1`, [t.g]);
  assert.equal(await como(u.dueno, async () => (await uno(`select public.guardar_estilo_gimnasio($1, 'pista') e`, [t.g])).e), "pista");
  assert.equal((await uno(`select estilo from public.configuracion_gimnasio where gimnasio_id = $1`, [t.g])).estilo, "pista");
  await como(u.dueno, () => t.falla(() => t.q(`select public.guardar_estilo_gimnasio($1, 'neon')`, [t.g]), /clásico o Pista/));
  assert.equal(await como(u.dueno, async () => (await uno(`select public.guardar_estilo_gimnasio($1, 'clasico') e`, [t.g])).e), "clasico");
});

test("la recepción, el dueño de otro gimnasio y quien no es del equipo reciben error, no un vacío", async () => {
  await como(u.recepcion, () => t.falla(() => t.q(`select public.guardar_estilo_gimnasio($1, 'pista')`, [t.g]), /permiso|acceso|rol|dueñ/i));
  await como(u.ajeno, () => t.falla(() => t.q(`select public.guardar_estilo_gimnasio($1, 'pista')`, [t.g]), /permiso|acceso|rol|equipo/i));
  await como(u.ajeno, () => t.falla(() => t.q(`select public.estilo_gimnasio($1)`, [t.g]), /permiso|acceso|equipo/i));
  await como(u.dueno, () => t.falla(() => t.q(`select public.admin_guardar_estilo($1, 'pista')`, [t.g]), /administradores/));
  assert.equal((await uno(`select estilo from public.configuracion_gimnasio where gimnasio_id = $1`, [t.g])).estilo, "clasico", "nada cambió");
  await t.db.query("set role anon");
  await t.falla(() => t.q(`select public.guardar_estilo_gimnasio($1, 'pista')`, [t.g]), /permission denied/);
  await t.db.query("reset role");
});

test("el proxy (anon) resuelve la dirección y recibe el estilo", async () => {
  await t.q(`update public.configuracion_gimnasio set estilo = 'pista' where gimnasio_id = $1`, [t.g]);
  const slug = (await uno(`select slug from public.gimnasios where id = $1`, [t.g])).slug;
  await t.db.query("set role anon");
  const r = await uno(`select estilo from public.gimnasio_por_slug($1)`, [slug]);
  await t.db.query("reset role");
  assert.equal(r.estilo, "pista");
});

test("estilo_gimnasio en el lote (Configuración): el dueño la recibe igual que por separado; el de otro gimnasio, error", async () => {
  const L = [{ f: "estilo_gimnasio", a: { p_gimnasio_id: t.g } }];
  const lote = await como(u.dueno, async () => (await uno(`select public.lote_lecturas($1::jsonb) r`, [JSON.stringify(L)])).r);
  const sola = await como(u.dueno, async () => (await uno(`select public.estilo_gimnasio($1) r`, [t.g])).r);
  assert.deepEqual(lote, [sola]);
  await como(u.ajeno, () => t.falla(() => t.q(`select public.lote_lecturas($1::jsonb)`, [JSON.stringify(L)]), /permiso|acceso|equipo/i));
});
