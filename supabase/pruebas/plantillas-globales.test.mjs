// Carril B · F9.1 (EDIT-S07): plantillas de textos en capas (gimnasio → tipo → plataforma → fábrica), con propagación y "Restaurar por defecto".
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir } from "./_comun.mjs";

let t, admin, uVentas, uLectura, g2, g3;
async function como(usuario, fn) {
  await t.db.query("set role authenticated");
  await t.q(`select set_config('request.jwt.claims', $1, false)`, [JSON.stringify({ sub: usuario, role: "authenticated" })]);
  try { return await fn(); } catch (e) { console.log("INTERNO", e.message); throw e; } finally { await t.db.query("reset role"); await t.q(`select set_config('request.jwt.claims', '', false)`); }
}
const uno = async (sql, p) => (await t.q(sql, p))[0];
const boton = async (g) => (await uno(`select boton_texto b from public.landing_gimnasio where gimnasio_id = $1`, [g])).b;
const mk = async (pref) => (await uno(`insert into auth.users (email) values ($1) returning id, email`, [`${pref}${Math.random().toString().slice(2)}@ejemplo.invalid`]));
const CLAVE = "landing.boton_texto";

before(async () => {
  t = await abrir("prueba-plantillas");
  admin = (await mk("principal")).id;
  await t.q(`insert into public.administradores_plataforma (usuario_id) values ($1)`, [admin]);
  const v = await mk("ventas"), l = await mk("lectura"); uVentas = v.id; uLectura = l.id;
  for (const [u, rol] of [[v, "ventas"], [l, "lectura"]]) await como(admin, () => t.q(`select public.admin_dar_rol_brik($1, $2)`, [u.email, rol]));
  g2 = (await uno(`insert into public.gimnasios (slug, nombre) values ('plantillas-2', 'Dos') returning id`)).id;
  g3 = (await uno(`insert into public.gimnasios (slug, nombre) values ('plantillas-3', 'Tres') returning id`)).id;
  // t.g y g2 son boxes; g3 no tiene tipo.
  await como(admin, async () => {
    await t.q(`select public.admin_guardar_tipo_gimnasio($1, 'box')`, [t.g]);
    await t.q(`select public.admin_guardar_tipo_gimnasio($1, 'box')`, [g2]);
  });
});
after(async () => t && t.cerrar());

test("de fábrica: la web nace con 'Quiero empezar' y el registro dice qué textos tienen plantilla", async () => {
  assert.equal(await boton(g3), "Quiero empezar");
  const p = await como(uLectura, async () => (await uno(`select public.admin_plantillas_texto() x`)).x);
  assert.ok(p.tipos.includes("box")); assert.equal(p.textos.length, 3);
  const b = p.textos.find((x) => x.clave === CLAVE);
  assert.equal(b.fabrica, "Quiero empezar"); assert.equal(b.plataforma, null); assert.deepEqual(b.por_tipo, {});
});

test("plantilla de la plataforma: la reciben los que no editaron; el que escribió su texto lo conserva", async () => {
  await como(uLectura, () => t.falla(() => t.q(`select public.admin_guardar_plantilla_texto($1, null, 'Probá gratis')`, [CLAVE]), /no puede hacer esto/));
  await t.q(`update public.landing_gimnasio set boton_texto = 'Anotate ya' where gimnasio_id = $1`, [t.g]);   // el dueño de t.g escribió el suyo
  const n = await como(uVentas, async () => (await uno(`select public.admin_guardar_plantilla_texto($1, null, 'Probá gratis') n`, [CLAVE])).n);
  assert.ok(n >= 2, "al menos g2 y g3");
  assert.equal(await boton(g2), "Probá gratis"); assert.equal(await boton(g3), "Probá gratis");
  assert.equal(await boton(t.g), "Anotate ya", "lo que escribió el dueño manda");
});

test("plantilla del tipo: pisa a la de la plataforma solo en ese tipo", async () => {
  const n = await como(admin, async () => (await uno(`select public.admin_guardar_plantilla_texto($1, 'box', 'Sumate al box') n`, [CLAVE])).n);
  assert.equal(n, 1, "solo g2 (t.g editó el suyo)");
  assert.equal(await boton(g2), "Sumate al box"); assert.equal(await boton(g3), "Probá gratis", "sin tipo: la de la plataforma");
  assert.equal(await boton(t.g), "Anotate ya");
  // Cambiar la de la plataforma ya no toca a los boxes que tienen la suya
  await como(admin, () => t.q(`select public.admin_guardar_plantilla_texto($1, null, 'Empezá hoy')`, [CLAVE]));
  assert.equal(await boton(g3), "Empezá hoy"); assert.equal(await boton(g2), "Sumate al box");
});

test("restaurar por defecto: un gimnasio vuelve a su plantilla; una plantilla vuelve a la de arriba y arrastra a los que no editaron", async () => {
  const v = await como(admin, async () => (await uno(`select public.admin_restaurar_texto_gimnasio($1, $2) v`, [t.g, CLAVE])).v);
  assert.equal(v, "Sumate al box"); assert.equal(await boton(t.g), "Sumate al box");
  const n = await como(admin, async () => (await uno(`select public.admin_restaurar_plantilla_texto($1, 'box') n`, [CLAVE])).n);
  assert.equal(n, 2, "t.g y g2");
  assert.equal(await boton(g2), "Empezá hoy"); assert.equal(await boton(t.g), "Empezá hoy");
  await como(admin, () => t.falla(() => t.q(`select public.admin_restaurar_plantilla_texto($1, 'box')`, [CLAVE]), /ya está por defecto/));
  const p = await como(admin, async () => (await uno(`select public.admin_plantillas_texto() x`)).x);
  assert.deepEqual(p.textos.find((x) => x.clave === CLAVE).por_tipo, {});
});

test("validaciones: largo, tipo y clave; y la bajada vacía recibe la plantilla", async () => {
  // El dueño dejó la bajada vacía (lo escribe el dueño, no BRIK: se hace como la base)
  await t.q(`update public.landing_gimnasio set bajada = null where gimnasio_id = $1`, [g3]);
  await como(admin, async () => {
    await t.falla(() => t.q(`select public.admin_guardar_plantilla_texto($1, null, $2)`, [CLAVE, "x".repeat(41)]), /de 1 a 40/);
    await t.falla(() => t.q(`select public.admin_guardar_plantilla_texto($1, 'inventado', 'ok')`, [CLAVE]), /Tipo de gimnasio/);
    await t.falla(() => t.q(`select public.admin_guardar_plantilla_texto('landing.otra', null, 'ok')`), /no tiene plantilla/);
    await t.q(`select public.admin_guardar_plantilla_texto('landing.bajada', null, 'Entrená con nosotros en serio')`);
  });
  assert.equal((await uno(`select bajada b from public.landing_gimnasio where gimnasio_id = $1`, [g3])).b, "Entrená con nosotros en serio");
});

test("todo queda en el registro de BRIK", async () => {
  const r = await t.q(`select accion from public.registro_brik where accion in ('guardar_plantilla_texto','restaurar_plantilla_texto','restaurar_texto_gimnasio')`);
  assert.ok(r.length >= 5);
});
