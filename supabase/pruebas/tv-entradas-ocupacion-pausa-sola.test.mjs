// Carril B · F7.1: TV en modo entradas con ocupación, ocupación en vivo para el socio (apagada por defecto) y pausa que se aprueba sola.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir } from "./_comun.mjs";

let t, uDueno, uRec, uSocio, socio, otro;
async function como(usuario, fn) {
  await t.db.query("set role authenticated");
  await t.q(`select set_config('request.jwt.claims', $1, false)`, [JSON.stringify({ sub: usuario, role: "authenticated" })]);
  try { return await fn(); } finally { await t.db.query("reset role"); await t.q(`select set_config('request.jwt.claims', '', false)`); }
}
async function comoAnon(fn) { await t.db.query("set role anon"); try { return await fn(); } finally { await t.db.query("reset role"); } }
const uno = async (sql, p) => (await t.q(sql, p))[0];
async function persona(rol) {
  const [{ id }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`${rol}${Math.random()}@ejemplo.invalid`]);
  await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,$3,$4)`, [t.g, id, rol, rol]);
  return id;
}
const ingreso = (s, minutos, resultado = "entro") => t.q(`insert into public.ingresos (gimnasio_id, sede_id, socio_id, momento, via_acceso, resultado, color, motivo, texto)
  values ($1, $2, $3, now() - ($4 || ' minutes')::interval, 'recepcion', $5, 'rojo', 'vencida', 'Debe la cuota') returning id`, [t.g, t.sede, s, String(minutos), resultado]).then((r) => r[0].id);

before(async () => {
  t = await abrir("prueba-f71");
  uDueno = await persona("dueno"); uRec = await persona("recepcion");
  [{ id: uSocio }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`s${Math.random()}@ejemplo.invalid`]);
  [{ id: socio }] = await t.q(`insert into public.socios (gimnasio_id, nombre, apellido, usuario_id) values ($1,'Lucía','Gómez',$2) returning id`, [t.g, uSocio]);
  [{ id: otro }] = await t.q(`insert into public.socios (gimnasio_id, nombre, apellido) values ($1,'Pedro','Ruiz') returning id`, [t.g]);
  await t.q(`insert into public.suscripciones (gimnasio_id, socio_id, plan_id, inicio) values ($1,$2,$3,'2026-01-01T03:00:00Z')`, [t.g, socio, t.ctx.planes.full]);
});
after(async () => t && t.cerrar());

test("TV en modo entradas: últimas entradas con primer nombre e inicial, sin nada de plata, y la ocupación como número", async () => {
  const tv = await como(uRec, async () => (await uno(`select public.crear_tv($1, $2, 'Puerta', 'entradas') r`, [t.g, t.sede])).r);
  await como(uRec, () => t.falla(() => t.q(`select public.crear_tv($1, $2, 'Mala', 'otra')`, [t.g, t.sede]), /clases o las entradas/));
  const lista = await como(uRec, async () => (await uno(`select public.tvs_panel($1) l`, [t.g])).l);
  assert.equal(lista[0].modo, "entradas");
  const base = (await uno(`select privado.ocupacion_ahora($1, $2) n`, [t.g, t.sede])).n;
  const in1 = await ingreso(socio, 40); await ingreso(otro, 5);
  await ingreso(otro, 2, "rechazado");
  const e = await comoAnon(async () => (await uno(`select public.tv_estado($1) e`, [tv.token])).e);
  assert.equal(e.modo, "entradas");
  assert.equal(e.entradas.filter((x) => x.nombre === "Pedro R.").length, 1, "el rechazado no aparece");
  assert.ok(e.entradas.some((x) => x.nombre === "Pedro R."));
  assert.ok(e.entradas.some((x) => x.nombre === "Lucía G."));
  assert.ok(!JSON.stringify(e).match(/vencida|Debe|rojo/), "ni el color ni la deuda salen en la TV");
  assert.equal(e.ocupacion, base + 2);
  // una salida baja la ocupación
  await t.q(`insert into public.salidas (gimnasio_id, sede_id, ingreso_id, socio_id, momento, via_acceso) values ($1,$2,$3,$4,now(),'recepcion')`, [t.g, t.sede, in1, socio]);
  assert.equal((await comoAnon(async () => (await uno(`select public.tv_estado($1) e`, [tv.token])).e)).ocupacion, base + 1);
  // una TV de clases no lista entradas
  const tv2 = await como(uRec, async () => (await uno(`select public.crear_tv($1, $2, 'Sala') r`, [t.g, t.sede])).r);
  assert.deepEqual((await comoAnon(async () => (await uno(`select public.tv_estado($1) e`, [tv2.token])).e)).entradas, []);
});

test("ocupación en vivo para el socio: apagada por defecto; la prende solo el dueño; el equipo siempre la ve", async () => {
  assert.deepEqual(await como(uSocio, async () => (await uno(`select public.ocupacion_en_vivo($1) r`, [t.g])).r), { visible: false });
  const eq = await como(uRec, async () => (await uno(`select public.ocupacion_en_vivo($1) r`, [t.g])).r);
  assert.equal(eq.visible, true); assert.equal(typeof eq.personas, "number");
  await como(uRec, () => t.falla(() => t.q(`select public.guardar_autonomia_socios($1, false, 14, true)`, [t.g]), /permiso|rol|acceso/i));
  await como(uDueno, () => t.falla(() => t.q(`select public.guardar_autonomia_socios($1, false, 0, true)`, [t.g]), /de 1 a 90/));
  await como(uDueno, () => t.q(`select public.guardar_autonomia_socios($1, false, 14, true)`, [t.g]));
  const v = await como(uSocio, async () => (await uno(`select public.ocupacion_en_vivo($1) r`, [t.g])).r);
  assert.equal(v.visible, true); assert.equal(v.personas, (await uno(`select privado.ocupacion_ahora($1, null) n`, [t.g])).n);
  const intruso = (await uno(`insert into auth.users (email) values ($1) returning id`, [`x${Math.random()}@ejemplo.invalid`])).id;
  await como(intruso, () => t.falla(() => t.q(`select public.ocupacion_en_vivo($1)`, [t.g]), /Sin permiso/));
});

test("congelar solo: apagado queda pendiente; prendido y dentro del tope se aprueba y corre la cuota; pasado el tope vuelve a pendiente", async () => {
  await como(uSocio, async () => { await t.q(`select public.pedir_pausa_socio($1, '2027-03-01', '2027-03-08', 'viaje')`, [socio]); });
  let p = await uno(`select estado, autoaprobado from public.pedidos_pausa where socio_id = $1 order by pedido_en desc limit 1`, [socio]);
  assert.deepEqual([p.estado, p.autoaprobado], ["pendiente", false]);
  await como(uDueno, async () => { await t.q(`select public.resolver_pedido_pausa((select id from public.pedidos_pausa where socio_id = $1 and estado = 'pendiente'), false)`, [socio]); });
  await como(uDueno, () => t.q(`select public.guardar_autonomia_socios($1, true, 10, true)`, [t.g]));
  await como(uSocio, async () => { await t.q(`select public.pedir_pausa_socio($1, '2027-04-01', '2027-04-09', 'trabajo')`, [socio]); });
  p = await uno(`select estado, autoaprobado, congelamiento_id from public.pedidos_pausa where socio_id = $1 and desde::date >= '2027-03-31' order by pedido_en desc limit 1`, [socio]);
  assert.deepEqual([p.estado, p.autoaprobado], ["aprobado", true]);
  assert.ok(p.congelamiento_id, "se creó el congelamiento");
  await como(uSocio, async () => { await t.q(`select public.pedir_pausa_socio($1, '2027-06-01', '2027-06-20', 'viaje')`, [socio]); });
  p = await uno(`select estado, autoaprobado from public.pedidos_pausa where socio_id = $1 and desde::date >= '2027-05-31' order by pedido_en desc limit 1`, [socio]);
  assert.deepEqual([p.estado, p.autoaprobado], ["pendiente", false]);
});
