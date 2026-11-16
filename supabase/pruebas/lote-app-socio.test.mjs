// Cacería 16/11 · El Inicio del socio pide sus lecturas en UN viaje (lote_lecturas, migración 20261116130000).
// Cada lectura sigue verificando que la ficha sea del propio socio: la de otra persona, de otro gimnasio o sin sesión da error, nunca una lista vacía.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir } from "./_comun.mjs";

let t, u = {}, socio, otro;
const uno = async (sql, p) => (await t.q(sql, p))[0];
async function como(usuario, fn) {
  await t.db.query("set role authenticated");
  await t.q(`select set_config('request.jwt.claims', $1, false)`, [JSON.stringify({ sub: usuario, role: "authenticated" })]);
  try { return await fn(); } finally { await t.db.query("reset role"); await t.q(`select set_config('request.jwt.claims', '', false)`); }
}
const usuario = async () => (await uno(`insert into auth.users (email) values ($1) returning id`, [`u${Math.random()}@ejemplo.invalid`])).id;
const LECTURAS = (s, g) => [
  { f: "mi_qr", a: { p_gimnasio_id: g, p_socio_id: s }, t: true }, { f: "usa_qr_pared", a: { p_gimnasio_id: g }, t: true },
  { f: "campana_socio", a: { p_gimnasio_id: g, p_socio_id: s }, t: true }, { f: "progreso_inicio", a: { p_socio_id: s }, t: true },
  { f: "novedades_socio", a: { p_socio_id: s }, t: true }, { f: "documentos_socio", a: { p_socio_id: s } }, { f: "eventos_socio", a: { p_socio_id: s } },
  { f: "encuesta_socio", a: { p_socio_id: s } }, { f: "grados_socio", a: { p_socio_id: s } }, { f: "mi_dni", a: { p_socio_id: s }, t: true },
];
before(async () => {
  t = await abrir("prueba-lote-socio");
  u.socio = await usuario(); u.otro = await usuario();
  socio = (await uno(`insert into public.socios (gimnasio_id, nombre, apellido, dni, telefono, usuario_id) values ($1, 'Lola', 'Lote', '34111222', '+5490001120001', $2) returning id`, [t.g, u.socio])).id;
  const g2 = (await uno(`insert into public.gimnasios (slug, nombre) values ('prueba-lote-otro', 'Otro') returning id`)).id;
  otro = (await uno(`insert into public.socios (gimnasio_id, nombre, apellido, dni, telefono, usuario_id) values ($1, 'Otro', 'Socio', '34111223', '+5490001120002', $2) returning id`, [g2, u.otro])).id;
});
after(async () => t && t.cerrar());

test("el propio socio recibe las lecturas del Inicio en un viaje, en orden, y coinciden con pedirlas por separado", async () => {
  const lote = await como(u.socio, async () => (await t.q(`select public.lote_lecturas($1::jsonb) r`, [JSON.stringify(LECTURAS(socio, t.g))]))[0].r);
  assert.equal(lote.length, 10);
  const dni = await como(u.socio, async () => (await t.q(`select public.mi_dni($1) d`, [socio]))[0].d);
  assert.equal(lote[9], dni, "mi_dni por el lote es el mismo que por separado");
  const docs = await como(u.socio, async () => (await t.q(`select public.documentos_socio($1) d`, [socio]))[0].d);
  assert.deepEqual(lote[5], docs);
});

test("la ficha de otra persona o de otro gimnasio da error en el lote (las no tolerantes cortan; las tolerantes dan null), y sin sesión no se ejecuta", async () => {
  await como(u.otro, () => t.falla(() => t.q(`select public.lote_lecturas($1::jsonb)`, [JSON.stringify([{ f: "documentos_socio", a: { p_socio_id: socio } }])]), /Sin permiso|no es tuya/));
  const tolerante = await como(u.otro, async () => (await t.q(`select public.lote_lecturas($1::jsonb) r`, [JSON.stringify([{ f: "mi_dni", a: { p_socio_id: socio }, t: true }])]))[0].r);
  assert.deepEqual(tolerante, [null], "una lectura tolerante ajena no devuelve el DNI de otro");
  await t.db.query("set role anon");
  await t.falla(() => t.q(`select public.lote_lecturas($1::jsonb)`, [JSON.stringify(LECTURAS(socio, t.g))]), /permission denied/);
  await t.db.query("reset role");
  assert.ok(otro);
});

test("lo que no está en la lista cerrada sigue sin poder pedirse en lote", async () => {
  await como(u.socio, () => t.falla(() => t.q(`select public.lote_lecturas($1::jsonb)`, [JSON.stringify([{ f: "mi_socio", a: { p_gimnasio_id: t.g, p_socio_id: socio } }])]), /no se puede pedir en lote/));
  await como(u.socio, () => t.falla(() => t.q(`select public.lote_lecturas($1::jsonb)`, [JSON.stringify([{ f: "borrar_todo", a: {} }])]), /no se puede pedir en lote/));
});
