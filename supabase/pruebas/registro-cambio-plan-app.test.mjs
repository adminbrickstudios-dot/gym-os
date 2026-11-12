// VD-35 (5500) y VD-39 (5600): el registro por cuenta propia y el cambio de plan / compra de pases desde la app.
//  · registro: lo abre solo el dueño (y no sin reglamento); apagado no hay alta; la fecha de nacimiento es obligatoria
//    y un menor no se anota solo; el que se anota queda socio sin pagar y la entrada lo frena hasta que paga.
//  · pagos de la app con clave de operación: el mismo envío dos veces es un solo pago.
//  · cambio de plan: los días a favor los calcula la base; el plan NO cambia hasta que el pago se acredita
//    (aprobación del equipo o aviso de MercadoPago); un pase se compra igual; el dueño puede apagar las compras.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir } from "./_comun.mjs";

let t, u = {}, viejo, nuevo, pase, pack, socio, socio2;
const HOST = `reg-app-${Date.now()}.ejemplo.invalid`;
const REGLAMENTO = "1. Traé toalla. 2. Dejá los discos en su lugar. 3. Respetá los horarios de las clases.";
const TOKEN = "TEST-1234567890123456-abcdefABCDEF-1234567890";
const C1 = "aaaaaaaa-0000-4000-8000-000000000001", C2 = "aaaaaaaa-0000-4000-8000-000000000002", C3 = "aaaaaaaa-0000-4000-8000-000000000003";

async function como(usuario, fn, rol = "authenticated") {
  // Con savepoint: si fn falla, el error de verdad llega (no el de "transacción abortada" del reset).
  await t.db.query("savepoint como");
  await t.db.query(`set role ${rol}`);
  await t.q(`select set_config('request.jwt.claims', $1, false)`, [JSON.stringify({ sub: usuario, role: rol })]);
  try {
    const r = await fn();
    await t.db.query("reset role"); await t.q(`select set_config('request.jwt.claims', '', false)`);
    await t.db.query("release savepoint como");
    return r;
  } catch (e) {
    await t.db.query("rollback to savepoint como"); await t.db.query("reset role"); await t.q(`select set_config('request.jwt.claims', '', false)`);
    throw e;
  }
}
const usuario = async (email) => (await t.q(`insert into auth.users (email) values ($1) returning id`, [`${email}${Math.random()}@ejemplo.invalid`]))[0].id;
async function persona(rol) {
  const id = await usuario(rol);
  await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,$3,$4)`, [t.g, id, `P ${rol}`, rol]);
  return id;
}
async function plan(nombre, tipo, monto) {
  const [{ id }] = await t.q(
    `insert into public.planes (gimnasio_id, tipo, nombre, duracion_meses, renovacion, cantidad_clases, consume_en)
     values ($1,$2,$3, case when $2 = 'membresia' then 1 end, case when $2 = 'membresia' then 'continua' end,
             case when $2 = 'pack' then 8 end, case when $2 = 'pack' then 'ingreso' end) returning id`, [t.g, tipo, nombre]);
  await t.q(`insert into public.precios_plan (gimnasio_id, plan_id, monto, vigente_desde) values ($1,$2,$3,'2020-01-01')`, [t.g, id, monto]);
  return id;
}
/** Un socio con su usuario, en el plan viejo y pago hasta dentro de 10 días. */
async function socioConPlan(nombre) {
  const uid = await usuario("socio");
  const [{ id }] = await t.q(`insert into public.socios (gimnasio_id, nombre, apellido, usuario_id) values ($1,$2,'App',$3) returning id`, [t.g, nombre, uid]);
  const [{ id: su }] = await t.q(`insert into public.suscripciones (gimnasio_id, socio_id, plan_id, inicio) values ($1,$2,$3, now() - interval '20 days') returning id`, [t.g, id, viejo]);
  await t.q(`insert into public.coberturas (gimnasio_id, suscripcion_id, socio_id, desde, hasta, origen, motivo)
             values ($1,$2,$3, privado.medianoche(privado.dia_local(now(), $4) - 20, $4), privado.medianoche(privado.dia_local(now(), $4) + 10, $4), 'cortesia', 'prueba')`,
    [t.g, su, id, t.ctx.zona]);
  return { id, uid, su };
}
const planActivo = async (s) => (await t.q(`select pl.nombre from public.suscripciones su join public.planes pl on pl.id = su.plan_id where su.socio_id = $1 and su.baja_en is null`, [s]))[0]?.nombre;

before(async () => {
  t = await abrir("prueba-registro-cambio-plan");
  u.dueno = await persona("dueno"); u.encargado = await persona("encargado"); u.rec = await persona("recepcion");
  await t.q(`insert into public.dominios_gimnasio (gimnasio_id, host, tipo) values ($1, $2, 'propio')`, [t.g, HOST]);
  await t.q(`update public.landing_gimnasio set publicada = true where gimnasio_id = $1`, [t.g]);
  await t.q(`update public.configuracion_gimnasio set alias_transferencia = 'gym.prueba.app' where gimnasio_id = $1`, [t.g]);
  viejo = await plan("Musculación", "membresia", 20000);
  nuevo = await plan("Pase libre", "membresia", 30000);
  pase = await plan("Pase del día", "pase_diario", 3000);
  pack = await plan("Pack 8", "pack", 15000);
  ({ id: socio } = await socioConPlan("Cambia"));
  socio2 = await socioConPlan("Online");
  u.socio = (await t.q(`select usuario_id from public.socios where id = $1`, [socio]))[0].usuario_id;
});
after(async () => t && t.cerrar());

const alta = (datos, planId) => t.q(`select public.alta_online($1, $2, $3, 1, 'mostrador') as r`, [HOST, planId, datos]).then((x) => x[0].r);
// Si fn falla, t.falla vuelve al savepoint y con él al rol de antes: no se resetea en un finally (la transacción está abortada).
const anon = async (fn) => { await t.db.query("set role anon"); const r = await fn(); await t.db.query("reset role"); return r; };
const DATOS = { nombre: "Nueva", apellido: "Persona", dni: "33444555", telefono: "387 555 4040", email: "n@ejemplo.invalid", fecha_nacimiento: "1995-03-02" };

// ── VD-35 · Registro ─────────────────────────────────────────────────
test("registro: solo el dueño lo abre, y no sin reglamento; cerrado, nadie se anota", async () => {
  await como(u.encargado, () => t.falla(() => t.q(`select public.guardar_registro_socios($1, true)`, [t.g]), /Sin permiso/));
  await como(u.dueno, () => t.falla(() => t.q(`select public.guardar_registro_socios($1, true)`, [t.g]), /reglamento antes/));
  await como(u.encargado, async () => assert.equal((await t.q(`select public.registro_socios_panel($1) as p`, [t.g]))[0].p.abierto, false));
  await t.q(`insert into public.reglamentos (gimnasio_id, version, texto) values ($1, 1, $2)`, [t.g, REGLAMENTO]);
  await t.falla(() => anon(() => alta(DATOS, viejo)), /no está aceptando altas online/);
  const p = await como(u.dueno, async () => (await t.q(`select public.guardar_registro_socios($1, true) as p`, [t.g]))[0].p);
  assert.equal(p.abierto, true);
  assert.equal((await anon(() => t.q(`select public.alta_publica($1) as a`, [HOST])))[0].a.abierta, true);
});

test("registro: sin fecha de nacimiento o siendo menor no se anota; el que se anota queda sin pagar y no entra", async () => {
  await t.falla(() => anon(() => alta({ ...DATOS, fecha_nacimiento: "" }, viejo)), /fecha de nacimiento/);
  const sinFecha = { ...DATOS }; delete sinFecha.fecha_nacimiento;
  await t.falla(() => anon(() => alta(sinFecha, viejo)), /fecha de nacimiento/);
  const menor = new Date(); menor.setFullYear(menor.getFullYear() - 15);
  await t.falla(() => anon(() => alta({ ...DATOS, fecha_nacimiento: menor.toISOString().slice(0, 10) }, viejo)), /menor de 18/);
  assert.equal((await t.q(`select count(*)::int n from public.socios where gimnasio_id = $1 and dni = '33444555'`, [t.g]))[0].n, 0, "ni el menor ni el que no puso fecha quedaron anotados");
  const r = await anon(() => alta(DATOS, viejo));
  assert.equal(r.ya_socio, false);
  assert.equal(await planActivo(r.socio_id), "Musculación", "queda con el plan que eligió");
  assert.equal((await t.q(`select count(*)::int n from public.coberturas where socio_id = $1`, [r.socio_id]))[0].n, 0);
  const [e] = await t.q(`select (privado.calcular_acceso($1, now())).color as color`, [r.socio_id]);
  assert.notEqual(e.color, "verde", "no entra hasta pagar");
  const [s] = await t.q(`select origen from public.socios where id = $1`, [r.socio_id]);
  assert.equal(s.origen, "alta_web", "en el panel se marca con 🌐");
  const lista = await como(u.rec, async () => await t.q(`select autoalta, puede from public.buscar_socios($1, 'Nueva')`, [t.g]));
  assert.equal(lista[0].autoalta, true); assert.equal(lista[0].puede, false);
});

test("registro: el dueño lo cierra y la página deja de ofrecerlo", async () => {
  const p = await como(u.dueno, async () => (await t.q(`select public.guardar_registro_socios($1, false) as p`, [t.g]))[0].p);
  assert.equal(p.abierto, false);
  assert.equal((await anon(() => t.q(`select public.alta_publica($1) as a`, [HOST])))[0].a.abierta, false);
  await t.falla(() => anon(() => alta({ ...DATOS, dni: "33444999", telefono: "387 555 4041" }, viejo)), /no está aceptando altas online/);
});

// ── VD-34 en la app · clave de operación ─────────────────────────────
test("transferencia informada con la misma clave: un solo pago, la repetida devuelve el ya hecho", async () => {
  const s = socio2.id;
  const ruta = `${t.g}/${s}/cuota.jpg`;
  const a = await como(socio2.uid, async () => (await t.q(`select public.informar_transferencia($1, $2, 1, $3) as r`, [s, ruta, C1]))[0].r);
  const b = await como(socio2.uid, async () => (await t.q(`select public.informar_transferencia($1, $2, 1, $3) as r`, [s, ruta, C1]))[0].r);
  assert.equal(b.pago_id, a.pago_id); assert.equal(b.repetida, true); assert.ok(!a.repetida);
  assert.equal((await t.q(`select count(*)::int n from public.ventas where socio_id = $1 and clave_operacion = $2`, [s, C1]))[0].n, 1);
  assert.equal((await t.q(`select count(*)::int n from public.pagos p join public.ventas v on v.id = p.venta_id where v.socio_id = $1`, [s]))[0].n, 1);
  // La recepción lo rechaza para dejar al socio sin pendientes.
  await como(u.rec, () => t.q(`select public.rechazar_pago($1, 'prueba')`, [a.pago_id]));
});

test("MercadoPago con la misma clave: el mismo pago; otro socio no puede usar la clave", async () => {
  await como(u.dueno, () => t.q(`select public.guardar_mercadopago($1, $2, $3, 'prueba')`, [t.g, TOKEN, "s".repeat(32)]));
  const s = socio2.id;
  const a = await como(socio2.uid, async () => (await t.q(`select public.iniciar_pago_online($1, $2) as p`, [s, C2]))[0].p);
  const b = await como(socio2.uid, async () => (await t.q(`select public.iniciar_pago_online($1, $2) as p`, [s, C2]))[0].p);
  assert.equal(b.pago_id, a.pago_id); assert.equal(b.repetida, true);
  assert.equal((await t.q(`select count(*)::int n from public.ventas where gimnasio_id = $1 and clave_operacion = $2`, [t.g, C2]))[0].n, 1);
  await como(u.socio, () => t.falla(() => t.q(`select public.iniciar_pago_online($1, $2)`, [socio, C2]), /ya se usó/));
});

// ── VD-39 · Cambio de plan y pases desde la app ──────────────────────
test("el socio ve sus opciones y los días a favor los calcula la base", async () => {
  const o = await como(u.socio, async () => (await t.q(`select public.opciones_compra_app($1) as o`, [socio]))[0].o);
  assert.equal(o.habilitado, true);
  assert.equal(o.plan_actual.nombre, "Musculación");
  const nombres = o.planes.map((p) => p.nombre);
  assert.ok(nombres.includes("Pase libre") && nombres.includes("Pase del día") && nombres.includes("Pack 8"));
  assert.ok(!nombres.includes("Musculación"), "no ofrece el plan que ya tiene");
  assert.equal(nombres[0], "Pase libre", "las membresías primero");
  const v = await como(u.socio, async () => (await t.q(`select public.vista_compra_app($1, $2) as v`, [socio, nuevo]))[0].v);
  assert.equal(v.dias_a_favor, 10); assert.equal(v.cambia_plan, true); assert.equal(v.plan_viejo, "Musculación");
  assert.equal(Number(v.precio_transferencia), 30000);
  await como(u.socio, () => t.falla(() => t.q(`select public.vista_compra_app($1, $2)`, [socio, viejo]), /Ya estás en ese plan/));
  await como(socio2.uid, () => t.falla(() => t.q(`select public.vista_compra_app($1, $2)`, [socio, nuevo]), /Sin permiso/));
  // La del equipo da lo mismo (misma cuenta).
  const e = await como(u.rec, async () => (await t.q(`select public.vista_cambio_plan($1, $2) as v`, [socio, nuevo]))[0].v);
  assert.equal(e.dias_a_favor, v.dias_a_favor);
});

test("pedir el cambio no cambia nada; al aprobar el comprobante el plan cambia con los días a favor", async () => {
  const ruta = `${t.g}/${socio}/plan.jpg`;
  const a = await como(u.socio, async () => (await t.q(`select public.informar_compra_app($1, $2, $3, $4) as r`, [socio, nuevo, ruta, C3]))[0].r);
  assert.equal(Number(a.monto), 30000);
  const b = await como(u.socio, async () => (await t.q(`select public.informar_compra_app($1, $2, $3, $4) as r`, [socio, nuevo, ruta, C3]))[0].r);
  assert.equal(b.pago_id, a.pago_id); assert.equal(b.repetida, true);
  assert.equal((await t.q(`select count(*)::int n from public.ventas where socio_id = $1 and clave_operacion = $2`, [socio, C3]))[0].n, 1);
  assert.equal(await planActivo(socio), "Musculación", "mientras no se aprueba, el plan no cambia");
  const o = await como(u.socio, async () => (await t.q(`select public.opciones_compra_app($1) as o`, [socio]))[0].o);
  assert.match(o.pendiente.descripcion, /Cambio a Pase libre/);
  await como(u.socio, () => t.falla(() => t.q(`select public.informar_compra_app($1, $2, $3, null)`, [socio, pase, `${t.g}/${socio}/otro.jpg`]), /esperando aprobación/));
  const lista = await como(u.rec, async () => await t.q(`select * from public.pagos_por_aprobar($1)`, [t.g]));
  assert.ok(lista.some((p) => p.pago_id === a.pago_id && /Cambio a Pase libre/.test(p.descripcion)), "la recepción lo ve con qué es");
  await como(u.socio, () => t.falla(() => t.q(`select public.aprobar_pago($1)`, [a.pago_id]), /Sin permiso/));
  const r = await como(u.rec, async () => (await t.q(`select public.aprobar_pago($1) as r`, [a.pago_id]))[0].r);
  assert.equal(r.veredicto.color, "verde");
  assert.equal(await planActivo(socio), "Pase libre");
  const cob = await t.q(`select origen, privado.dia_local(hasta, $2) - privado.dia_local(now(), $2) as dias from public.coberturas where socio_id = $1 and anulada_en is null order by hasta`, [socio, t.ctx.zona]);
  assert.ok(cob.some((c) => c.origen === "traspaso" && c.dias === 10), "los 10 días a favor pasan al plan nuevo");
  assert.ok(cob.some((c) => c.origen === "pago" && c.dias > 10), "y se suma el período que pagó");
  const [it] = await t.q(`select tipo, descripcion from public.venta_items where venta_id = $1`, [a.venta_id]);
  assert.equal(it.tipo, "cuota"); assert.equal(it.descripcion, "Cuota Pase libre");
  assert.notEqual((await t.q(`select aplicado_en from public.cambios_plan_app where venta_id = $1`, [a.venta_id]))[0].aplicado_en, null);
});

test("MercadoPago: el plan cambia cuando llega el aviso, no antes; un rechazo no cambia nada", async () => {
  const s = socio2.id;
  const rechazado = await como(socio2.uid, async () => (await t.q(`select public.iniciar_compra_online($1, $2, null) as r`, [s, nuevo]))[0].r);
  assert.equal(await planActivo(s), "Musculación");
  await como(null, async () => (await t.q(`select public.acreditar_pago_mp($1, '777001', $2, 'rejected')`, [rechazado.pago_id, rechazado.monto])), "service_role");
  assert.equal(await planActivo(s), "Musculación", "rechazado: sigue igual");
  const p = await como(socio2.uid, async () => (await t.q(`select public.iniciar_compra_online($1, $2, null) as r`, [s, nuevo]))[0].r);
  assert.notEqual(p.pago_id, rechazado.pago_id);
  const mismo = await como(socio2.uid, async () => (await t.q(`select public.iniciar_compra_online($1, $2, null) as r`, [s, nuevo]))[0].r);
  assert.equal(mismo.pago_id, p.pago_id, "no se apilan pagos sin terminar");
  assert.equal(await planActivo(s), "Musculación", "mientras no llega el aviso, no cambia");
  const ok = await como(null, async () => (await t.q(`select public.acreditar_pago_mp($1, '777002', $2, 'approved') as r`, [p.pago_id, p.monto]))[0].r, "service_role");
  assert.equal(ok, "acreditado");
  assert.equal(await planActivo(s), "Pase libre");
  // El pago de la cuota vieja que había abierto y no terminó (clave C2) se cerró solo, sin trabar el cambio.
  const [{ estado }] = await t.q(`select p.estado from public.pagos p join public.ventas v on v.id = p.venta_id where v.gimnasio_id = $1 and v.clave_operacion = $2`, [t.g, C2]);
  assert.equal(estado, "rechazado");
  const [{ e }] = await t.q(`select (privado.calcular_acceso($1, now())).color as e`, [s]);
  assert.equal(e, "verde");
});

test("un pase diario se compra sin cambiar el plan", async () => {
  const ruta = `${t.g}/${socio}/pase.jpg`;
  const a = await como(u.socio, async () => (await t.q(`select public.informar_compra_app($1, $2, $3, null) as r`, [socio, pase, ruta]))[0].r);
  assert.equal(Number(a.monto), 3000);
  await como(u.rec, () => t.q(`select public.aprobar_pago($1)`, [a.pago_id]));
  assert.equal((await t.q(`select count(*)::int n from public.pases_diarios where socio_id = $1`, [socio]))[0].n, 1);
  assert.equal(await planActivo(socio), "Pase libre");
});

test("el dueño apaga las compras desde la app y la base lo hace cumplir", async () => {
  await como(u.encargado, () => t.falla(() => t.q(`select public.guardar_compras_app($1, false)`, [t.g]), /Sin permiso/));
  const p = await como(u.dueno, async () => (await t.q(`select public.guardar_compras_app($1, false) as p`, [t.g]))[0].p);
  assert.equal(p.compras_app, false);
  const o = await como(u.socio, async () => (await t.q(`select public.opciones_compra_app($1) as o`, [socio]))[0].o);
  assert.equal(o.habilitado, false);
  await como(u.socio, () => t.falla(() => t.q(`select public.informar_compra_app($1, $2, $3, null)`, [socio, pack, `${t.g}/${socio}/pack.jpg`]), /no vende planes ni pases desde la app/));
  await como(u.dueno, () => t.q(`select public.guardar_compras_app($1, true)`, [t.g]));
});
