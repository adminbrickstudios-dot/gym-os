// Cacería 18/11 · La Entrada pide el modo de prueba gratis y la config de visita en el mismo viaje que el resto (lote_lecturas, migración 20261118100000).
// Mismos permisos que pedirlas por separado: el equipo del gimnasio las lee igual; alguien de otro gimnasio o sin equipo recibe error, nunca un vacío.
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
const LECTURAS = (g) => [{ f: "config_prueba_gratis", a: { p_gimnasio_id: g }, t: true }, { f: "config_visita", a: { p_gimnasio_id: g }, t: true }];
before(async () => {
  t = await abrir("prueba-lote-entrada");
  for (const k of ["recepcion", "ajeno"]) u[k] = await usuario();
  await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,'Recep','recepcion')`, [t.g, u.recepcion]);
  g2 = (await uno(`insert into public.gimnasios (slug, nombre) values ('prueba-lote-entrada-otro', 'Otro') returning id`)).id;
  await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,'Ajeno','recepcion')`, [g2, u.ajeno]);
});
after(async () => t && t.cerrar());

test("la recepción recibe las dos lecturas en el lote y coinciden con pedirlas por separado", async () => {
  const lote = await como(u.recepcion, async () => (await t.q(`select public.lote_lecturas($1::jsonb) r`, [JSON.stringify(LECTURAS(t.g))]))[0].r);
  assert.equal(lote.length, 2);
  const solas = await como(u.recepcion, async () => [
    (await t.q(`select public.config_prueba_gratis($1) r`, [t.g]))[0].r, (await t.q(`select public.config_visita($1) r`, [t.g]))[0].r]);
  assert.deepEqual(lote, solas);
});

test("alguien de otro gimnasio no las lee: error, no un vacío (en lote y por separado)", async () => {
  await como(u.ajeno, () => t.falla(() => t.q(`select public.config_prueba_gratis($1)`, [t.g]), /permiso|acceso|equipo/i));
  const lote = await como(u.ajeno, async () => (await t.q(`select public.lote_lecturas($1::jsonb) r`, [JSON.stringify(LECTURAS(t.g))]))[0].r);
  assert.deepEqual(lote, [null, null], "tolerante: null, nunca los datos del otro gimnasio");
  await como(u.ajeno, () => t.falla(() => t.q(`select public.lote_lecturas($1::jsonb)`, [JSON.stringify([{ f: "config_visita", a: { p_gimnasio_id: t.g } }])]), /permiso|acceso|equipo/i));
});

test("Interesados (migración 20261118110000): la recepción las pide en el lote; el de otro gimnasio recibe error, no un vacío", async () => {
  const L = [{ f: "prospectos_panel", a: { p_gimnasio_id: t.g } }, { f: "invitados_sin_seguimiento", a: { p_gimnasio_id: t.g }, t: true }, { f: "funciones_nuevas_activas", a: { p_gimnasio_id: t.g } }];
  const lote = await como(u.recepcion, async () => (await t.q(`select public.lote_lecturas($1::jsonb) r`, [JSON.stringify(L)]))[0].r);
  assert.equal(lote.length, 3);
  await como(u.ajeno, () => t.falla(() => t.q(`select public.lote_lecturas($1::jsonb)`, [JSON.stringify(L)]), /permiso|acceso|equipo/i));
});

test("Inicio del dueño: datos_ejemplo y seguridad_dueno en el lote; la recepción y el de otro gimnasio reciben error (como por separado)", async () => {
  const dueno = await usuario();
  await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,'Dueno','dueno')`, [t.g, dueno]);
  const L = [{ f: "datos_ejemplo", a: { p_gimnasio_id: t.g }, t: true }, { f: "seguridad_dueno", a: { p_gimnasio_id: t.g }, t: true }];
  const lote = await como(dueno, async () => (await t.q(`select public.lote_lecturas($1::jsonb) r`, [JSON.stringify(L)]))[0].r);
  assert.equal(lote.length, 2);
  assert.ok(lote[0] && lote[1], "el dueño las recibe completas");
  const NO = L.map((x) => ({ ...x, t: false }));
  await como(u.recepcion, () => t.falla(() => t.q(`select public.lote_lecturas($1::jsonb)`, [JSON.stringify(NO)]), /permiso|acceso|dueño|equipo/i));
  await como(u.ajeno, () => t.falla(() => t.q(`select public.lote_lecturas($1::jsonb)`, [JSON.stringify(NO)]), /permiso|acceso|dueño|equipo/i));
});

test("operador_actual en el lote (Vender y Caja): la recepción lo recibe igual que por separado; el de otro gimnasio, error", async () => {
  const L = [{ f: "operador_actual", a: { p_gimnasio_id: t.g } }];
  const lote = await como(u.recepcion, async () => (await t.q(`select public.lote_lecturas($1::jsonb) r`, [JSON.stringify(L)]))[0].r);
  const sola = await como(u.recepcion, async () => (await t.q(`select public.operador_actual($1) r`, [t.g]))[0].r);
  assert.deepEqual(lote, [sola]);
  await como(u.ajeno, () => t.falla(() => t.q(`select public.lote_lecturas($1::jsonb)`, [JSON.stringify(L)]), /permiso|acceso|equipo/i));
});

test("version_registro en el lote (Configuración): el dueño la recibe igual que por separado; la recepción y el de otro gimnasio, error", async () => {
  const dueno = await usuario();
  await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,'Dueno2','dueno')`, [t.g, dueno]);
  const L = [{ f: "version_registro", a: { p_gimnasio_id: t.g, p_tabla: "configuracion", p_id: t.g } }];
  const lote = await como(dueno, async () => (await t.q(`select public.lote_lecturas($1::jsonb) r`, [JSON.stringify(L)]))[0].r);
  const sola = await como(dueno, async () => (await t.q(`select public.version_registro($1, 'configuracion', $1) r`, [t.g]))[0].r);
  assert.deepEqual(lote, [sola]);
  await como(u.ajeno, () => t.falla(() => t.q(`select public.lote_lecturas($1::jsonb)`, [JSON.stringify(L)]), /permiso|acceso|equipo/i));
});
