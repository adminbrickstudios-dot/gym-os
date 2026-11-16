// D83 (Mateo, 16/11) · "Crear mi cuenta" siempre, aunque las altas online (elegir y pagar un plan) estén apagadas.
// Migración 20261116110000: crear la cuenta no depende de altas_online; el dueño puede ocultar el botón (crear_cuenta_visible);
// la cuenta queda socio SIN PAGAR y la puerta lo dice (D26); la llave solo la mueve el dueño.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir, HOY } from "./_comun.mjs";

let t, u = {}, plan, otro;
const HOST = `cuenta-${Date.now()}.ejemplo.invalid`;
async function persona(rol, gimnasio = t.g) {
  const [{ id }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`${rol}${Math.random()}@ejemplo.invalid`]);
  await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,$3,$4)`, [gimnasio, id, rol, rol]);
  return id;
}
before(async () => {
  t = await abrir("prueba-cuenta-siempre");
  for (const r of ["dueno", "encargado", "recepcion"]) u[r] = await persona(r);
  otro = (await t.q(`insert into public.gimnasios (slug, nombre) values ('prueba-cuenta-otro', 'Otro') returning id`))[0].id;
  u.duenoOtro = await persona("dueno", otro);
  await t.q(`insert into public.dominios_gimnasio (gimnasio_id, host, tipo) values ($1, $2, 'propio')`, [t.g, HOST]);
  await t.q(`update public.landing_gimnasio set publicada = true where gimnasio_id = $1`, [t.g]);
  [{ id: plan }] = await t.q(`select id from public.planes where gimnasio_id = $1 and tipo = 'membresia' and activo and visible_en_landing
                              and privado.precio_para(id, now(), null, null, false) is not null order by orden limit 1`, [t.g]);
});
after(async () => t && t.cerrar());
// Como el usuario, pero lo escrito se conserva (comoUsuario deshace al salir).
async function como(usuario, fn) {
  await t.db.query("set role authenticated");
  await t.q(`select set_config('request.jwt.claims', $1, false)`, [JSON.stringify({ sub: usuario, role: "authenticated" })]);
  try { return await fn(); } finally { await t.db.query("reset role"); await t.q(`select set_config('request.jwt.claims', '', false)`); }
}

const anon = async (fn) => { await t.q(`set local role anon`); const r = await fn(); await t.q(`reset role`); return r; };
const DATOS = { nombre: "Cora", apellido: "Cuenta", dni: "31222333", telefono: "387 555 3131", email: "cora@ejemplo.invalid", fecha_nacimiento: "1992-03-04" };
const alta = (datos, planId = null, medio = null) =>
  t.q(`select public.alta_online($1, $2, $3, 0, $4) as r`, [HOST, planId, datos, medio]).then((x) => x[0].r);

test("con las altas online apagadas (como Temple Gym) la página ofrece crear la cuenta, sin plan", async () => {
  const [{ a }] = await anon(() => t.q(`select public.alta_publica($1) as a`, [HOST]));
  assert.equal(a.abierta, true);
  assert.equal(a.con_plan, false, "elegir y pagar un plan online sigue apagado");
  assert.deepEqual(a.planes, []);
  assert.equal(a.transferencia, null);
  const [{ l }] = await anon(() => t.q(`select public.landing_publica($1) as l`, [HOST]));
  assert.equal(l.crear_cuenta, true, "la portada trae la clave nueva, prendida por defecto");
  assert.equal(l.publicada, true, "y conserva lo que ya devolvía");
});

test("la cuenta sin plan: queda socio sin pagar, la puerta no lo deja pasar y el gimnasio lo ve en Prospectos", async () => {
  await t.falla(() => anon(() => alta(DATOS, plan, "mostrador")), /no está aceptando altas online con plan/);
  const r = await anon(() => alta(DATOS));
  assert.equal(r.ya_socio, false);
  assert.equal(r.plan, null);
  const [s] = await t.q(`select id, origen, cubierto_hasta from public.socios where id = $1`, [r.socio_id]);
  assert.equal(s.origen, "alta_web");
  assert.equal(s.cubierto_hasta, null);
  const [{ e }] = await t.q(`select to_jsonb(privado.calcular_acceso($1, $2, $3)) e`, [r.socio_id, await t.en(HOY), t.sede]);
  assert.notEqual(e.color, "verde", "sin pagar la puerta no lo deja entrar gratis");
  const [p] = await t.q(`select estado, interes from public.prospectos where gimnasio_id = $1 and socio_id = $2`, [t.g, r.socio_id]);
  assert.equal(p.estado, "socio");
  assert.match(p.interes, /sin plan/);
  // El mismo DNI no se duplica.
  assert.equal((await anon(() => alta(DATOS))).ya_socio, true);
});

test("el dueño oculta el botón: se cierra la creación de cuentas y la portada lo dice; la recepción y el dueño de otro gimnasio, con error", async () => {
  await t.comoUsuario(u.recepcion, () => t.falla(() => t.q(`select public.guardar_crear_cuenta($1, false)`, [t.g]), /Sin permiso/));
  await t.comoUsuario(u.encargado, () => t.falla(() => t.q(`select public.guardar_crear_cuenta($1, false)`, [t.g]), /Sin permiso/));
  await t.comoUsuario(u.duenoOtro, () => t.falla(() => t.q(`select public.guardar_crear_cuenta($1, false)`, [t.g]), /Sin permiso/));
  await t.comoUsuario(u.recepcion, () => t.falla(() => t.q(`select public.crear_cuenta_panel($1)`, [t.g]), /Sin permiso/));
  await t.comoUsuario(u.duenoOtro, () => t.falla(() => t.q(`select public.crear_cuenta_panel($1)`, [t.g]), /Sin permiso/));
  await t.falla(() => anon(() => t.q(`select public.guardar_crear_cuenta($1, false)`, [t.g])), /permission denied/);
  await como(u.dueno, async () => {
    await t.falla(() => t.q(`select public.guardar_crear_cuenta($1, null)`, [t.g]), /Elegí/);
    assert.equal((await t.q(`select public.guardar_crear_cuenta($1, false) v`, [t.g]))[0].v, false);
    assert.equal((await t.q(`select public.crear_cuenta_panel($1) v`, [t.g]))[0].v, false);
  });
  assert.equal((await t.q(`select crear_cuenta_visible v from public.configuracion_gimnasio where gimnasio_id = $1`, [t.g]))[0].v, false);
  assert.equal((await anon(() => t.q(`select public.alta_publica($1) as a`, [HOST])))[0].a.abierta, false);
  assert.equal((await anon(() => t.q(`select public.landing_publica($1) as l`, [HOST])))[0].l.crear_cuenta, false);
  await t.falla(() => anon(() => alta({ ...DATOS, dni: "31222444", telefono: "387 555 4444" })), /no está aceptando altas online/);
  // Con las altas con plan prendidas, el alta sigue abierta aunque el botón esté oculto (es otra llave).
  await t.q(`insert into public.reglamentos (gimnasio_id, version, texto) values ($1, 1, 'Reglamento de prueba de más de veinte caracteres')`, [t.g]);
  await t.q(`update public.configuracion_gimnasio set altas_online = true where gimnasio_id = $1`, [t.g]);
  const ok = await t.q(`select public.alta_online($1, $2, $3, 1, 'mostrador') as r`, [HOST, plan, { ...DATOS, dni: "31222555", telefono: "387 555 5555", email: "otra@ejemplo.invalid" }]).then((x) => x[0].r);
  assert.equal(ok.ya_socio, false);
  assert.ok(ok.plan, "con plan, igual que antes");
});

test("la llave se lee en el mismo viaje que Tu página (lote_lecturas) y solo la ve el dueño o el encargado", async () => {
  await como(u.encargado, async () => {
    const [{ r }] = await t.q(`select public.lote_lecturas($1::jsonb) r`, [JSON.stringify([{ f: "crear_cuenta_panel", a: { p_gimnasio_id: t.g } }])]);
    assert.equal(typeof r[0], "boolean");
  });
  await como(u.recepcion, () => t.falla(() => t.q(`select public.lote_lecturas($1::jsonb) r`, [JSON.stringify([{ f: "crear_cuenta_panel", a: { p_gimnasio_id: t.g } }])]), /Sin permiso/));
  await como(u.duenoOtro, () => t.falla(() => t.q(`select public.lote_lecturas($1::jsonb) r`, [JSON.stringify([{ f: "crear_cuenta_panel", a: { p_gimnasio_id: t.g } }])]), /Sin permiso/));
});
