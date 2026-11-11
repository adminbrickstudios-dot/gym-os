// C9: el QR y el link para anotarse solo. El interruptor es el de siempre (registro abierto, apagado por defecto); lo nuevo es el plan
// sugerido: solo el dueño lo elige, tiene que ser un plan activo y visible, el público lo recibe solo con el registro abierto, y
// anotarse por ahí nunca da acceso (sin cobertura, la puerta no deja pasar).
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir } from "./_comun.mjs";

let t, u = {}, plan, otroGim, planAjeno;
const HOST = `qr-alta-${Date.now()}.ejemplo.invalid`;
const REGLAMENTO = "1. Traé toalla. 2. Dejá los discos en su lugar. 3. Respetá los horarios de las clases.";
async function persona(rol) {
  const [{ id }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`${rol}${Math.random()}@ejemplo.invalid`]);
  await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,$3,$4)`, [t.g, id, rol, rol]);
  return id;
}
before(async () => {
  t = await abrir("prueba-qr-alta");
  for (const r of ["dueno", "encargado", "recepcion"]) u[r] = await persona(r);
  await t.q(`insert into public.dominios_gimnasio (gimnasio_id, host, tipo) values ($1, $2, 'propio')`, [t.g, HOST]);
  await t.q(`update public.landing_gimnasio set publicada = true, whatsapp = '+5490005551234' where gimnasio_id = $1`, [t.g]);
  [{ id: plan }] = await t.q(`select id from public.planes where gimnasio_id = $1 and tipo = 'membresia' and activo and visible_en_landing
                              and privado.precio_para(id, now(), null, null, false) is not null order by orden limit 1`, [t.g]);
  [{ id: otroGim }] = await t.q(`insert into public.gimnasios (slug, nombre) values ('prueba-qr-alta-2', 'Otro Gimnasio') returning id`);
  [{ id: planAjeno }] = await t.q(`insert into public.planes (gimnasio_id, nombre, tipo, duracion_meses, renovacion) values ($1, 'Plan ajeno', 'membresia', 1, 'continua') returning id`, [otroGim]);
});
after(async () => t && t.cerrar());

const anon = async (fn) => { await t.q(`set local role anon`); try { return await fn(); } finally { await t.q(`reset role`); } };
const publica = () => anon(() => t.q(`select public.alta_publica($1) as a`, [HOST])).then((x) => x[0].a);
const panel = () => t.q(`select public.qr_alta_panel($1) as p`, [t.g]).then((x) => x[0].p);
const guardar = (p) => t.q(`select public.guardar_alta_plan_sugerido($1, $2) as p`, [t.g, p]).then((x) => x[0].p);

test("el panel lo ven el dueño y el encargado; la recepción y los de afuera, con error", async () => {
  await t.comoUsuario(u.dueno, async () => {
    const p = await panel();
    assert.equal(p.abierto, false, "el registro arranca apagado");
    assert.equal(p.plan_sugerido_id, null);
    assert.equal(p.whatsapp, "+5490005551234");
    assert.ok(p.planes.some((x) => x.id === plan));
  });
  await t.comoUsuario(u.encargado, async () => { assert.equal((await panel()).abierto, false); });
  await t.comoUsuario(u.recepcion, async () => t.falla(panel, /Sin permiso/));
  await t.falla(panel, /Sin permiso|iniciar sesión|permission denied/);
});

test("solo el dueño elige el plan sugerido; tiene que ser un plan activo y visible de su gimnasio", async () => {
  await t.comoUsuario(u.encargado, async () => t.falla(() => guardar(plan), /Sin permiso/));
  await t.comoUsuario(u.recepcion, async () => t.falla(() => guardar(plan), /Sin permiso/));
  await t.comoUsuario(u.dueno, async () => {
    await t.falla(() => guardar(planAjeno), /plan activo/);
    await t.falla(() => guardar("00000000-0000-0000-0000-000000000000"), /plan activo/);
    assert.equal((await guardar(plan)).plan_sugerido_id, plan);
    assert.equal((await guardar(null)).plan_sugerido_id, null, "se puede quitar");
    await guardar(plan);
  });
  await t.q(`update public.planes set activo = false where id = $1`, [plan]);
  await t.comoUsuario(u.dueno, async () => { assert.equal((await panel()).plan_sugerido_id, null, "un plan dado de baja ya no se sugiere"); });
  await t.q(`update public.planes set activo = true where id = $1`, [plan]);
});

test("con el registro apagado el público no recibe plan ni formulario; abierto, recibe el plan sugerido", async () => {
  const cerrada = await publica();
  assert.equal(cerrada.abierta, false);
  assert.equal(cerrada.plan_sugerido, undefined);
  assert.equal(cerrada.planes, undefined);
  assert.equal(cerrada.contacto.whatsapp, "+5490005551234", "cerrado, la página puede dar el WhatsApp");
  await t.q(`insert into public.reglamentos (gimnasio_id, version, texto) values ($1, 1, $2)`, [t.g, REGLAMENTO]);
  await t.q(`update public.configuracion_gimnasio set altas_online = true where gimnasio_id = $1`, [t.g]);
  await t.q(`update public.configuracion_gimnasio set alta_plan_sugerido_id = $2 where gimnasio_id = $1`, [t.g, plan]);
  const abierta = await publica();
  assert.equal(abierta.abierta, true);
  assert.equal(abierta.plan_sugerido, plan);
});

test("anotarse por el QR deja al socio sin pagar: sin cobertura y la puerta no lo deja pasar; aparece en Interesados", async () => {
  const r = (await anon(() => t.q(`select public.alta_online($1, $2, $3, 1, 'mostrador') as r`,
    [HOST, plan, { nombre: "Lucía", apellido: "Del Qr", dni: "33444555", telefono: "387 555 4321", email: "lucia.qr@ejemplo.invalid", fecha_nacimiento: "1992-03-04" }])))[0].r;
  assert.equal(r.ya_socio, false);
  const [{ n: cob }] = await t.q(`select count(*)::int n from public.coberturas where socio_id = $1`, [r.socio_id]);
  assert.equal(cob, 0);
  const [e] = await t.q(`select (x).color from (select privado.calcular_acceso($1, now()) as x) y`, [r.socio_id]);
  assert.notEqual(e.color, "verde");
  const [pr] = await t.q(`select estado from public.prospectos where gimnasio_id = $1 and socio_id = $2`, [t.g, r.socio_id]);
  assert.equal(pr.estado, "socio");
});

test("anon no puede ejecutar el panel ni el guardado", async () => {
  await anon(async () => {
    await t.falla(panel, /permission denied|iniciar sesión/);
    await t.falla(() => guardar(plan), /permission denied|iniciar sesión/);
  });
});
