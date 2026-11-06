// Regresión de la segunda revisión independiente (30/10/2026): caja, retención y clases.
// Cada prueba es un error que se encontró ejecutando, y exige el comportamiento correcto.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir, HOY } from "./_comun.mjs";
import { sumarDias } from "../../scripts/datos/casos-testigo.mjs";

let t, momento, sedeB, caja, cajaB, uDue, uEnc, uRec, uRecB, uSocio, spinning, yoga, profe, uProfe;
const D = (n) => sumarDias(HOY, n);
const sp = (n) => t.db.query(`savepoint ${n}`);
const rb = (n) => t.db.query(`rollback to savepoint ${n}`);

async function crearUsuario(rol, sede = null) {
  const [{ id: u }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`${rol}${Math.random()}@ejemplo.invalid`]);
  const [{ id: e }] = await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol, sede_id) values ($1,$2,$3,$4,$5) returning id`,
    [t.g, u, rol, rol, sede]);
  return { u, e };
}
async function como(u, fn) {
  await t.db.query("set role authenticated");
  await t.q(`select set_config('request.jwt.claims', $1, false)`, [JSON.stringify({ sub: u, role: "authenticated" })]);
  try { return await fn(); } finally { await t.db.query("reset role"); await t.q(`select set_config('request.jwt.claims', '', false)`); }
}
async function socio(apellido, planId, cobs = [], inicio = -200) {
  const [{ id: s }] = await t.q(`insert into public.socios (gimnasio_id, nombre, apellido) values ($1,'Rev',$2) returning id`, [t.g, apellido]);
  if (!planId) return { s };
  const [{ id: su }] = await t.q(`insert into public.suscripciones (gimnasio_id, socio_id, plan_id, inicio)
      values ($1,$2,$3,privado.medianoche($4::date,$5)) returning id`, [t.g, s, planId, D(inicio), t.ctx.zona]);
  for (const [d, h] of cobs)
    await t.q(`insert into public.coberturas (gimnasio_id, suscripcion_id, socio_id, desde, hasta, origen, motivo)
               values ($1,$2,$3,privado.medianoche($4::date,$6),privado.medianoche($5::date,$6),'cortesia','rev')`,
      [t.g, su, s, D(d), D(h), t.ctx.zona]);
  return { s, su };
}
async function clase(actividad, dia, hora = "19:00:00", cupo = 10, profeId = null) {
  const [{ id }] = await t.q(`insert into public.clases (gimnasio_id, sede_id, actividad_id, inicio, fin, cupo, profe_id)
      values ($1,$2,$3,$4,$4::timestamptz + interval '50 minutes',$5,$6) returning id`,
    [t.g, t.sede, actividad, await t.en(dia, hora), cupo, profeId]);
  return id;
}
async function plan(nombre, extra) {
  const cols = Object.keys(extra), vals = Object.values(extra);
  const [{ id }] = await t.q(`insert into public.planes (gimnasio_id, nombre, ${cols.join(",")}) values ($1,$2,${cols.map((_, i) => `$${i + 3}`).join(",")}) returning id`,
    [t.g, nombre, ...vals]);
  return id;
}
async function pack(s, planId, cantidad, desde = -1) {
  const [{ id }] = await t.q(`insert into public.packs (gimnasio_id, socio_id, plan_id, cantidad, desde, vence_en)
      values ($1,$2,$3,$4,privado.medianoche($5::date,$6), privado.medianoche($5::date,$6) + interval '60 days') returning id`,
    [t.g, s, planId, cantidad, D(desde), t.ctx.zona]);
  return id;
}
const reservar = async (s, c, m = momento) => (await t.q(`select privado.reservar($1, $2, $3) as r`, [c, s, m]))[0].r;
const asistencia = async (c, s, m) => (await t.q(`select privado.tomar_asistencia($1, $2, $3, $4, false) as r`, [c, s, profe, m]))[0].r;

before(async () => {
  t = await abrir("prueba-revision2");
  momento = await t.en(HOY, "12:00:00");
  await t.q(`update public.configuracion_gimnasio set modo_clases = 'reserva' where gimnasio_id = $1`, [t.g]);
  [{ id: sedeB }] = await t.q(`insert into public.sedes (gimnasio_id, nombre) values ($1,'Sede B') returning id`, [t.g]);
  [{ id: caja }] = await t.q(`insert into public.cajas (gimnasio_id, sede_id, nombre) values ($1,$2,'Recepción') returning id`, [t.g, t.sede]);
  [{ id: cajaB }] = await t.q(`insert into public.cajas (gimnasio_id, sede_id, nombre) values ($1,$2,'Recepción B') returning id`, [t.g, sedeB]);
  ({ u: uDue } = await crearUsuario("dueno"));
  ({ u: uEnc } = await crearUsuario("encargado"));
  ({ u: uRec } = await crearUsuario("recepcion"));
  ({ u: uRecB } = await crearUsuario("recepcion", sedeB));
  ({ u: uProfe, e: profe } = await crearUsuario("profe"));
  [{ id: uSocio }] = await t.q(`insert into auth.users (phone) values ('+5490000123987') returning id`);
  [{ id: spinning }] = await t.q(`insert into public.actividades (gimnasio_id, nombre) values ($1,'Spinning') returning id`, [t.g]);
  [{ id: yoga }] = await t.q(`insert into public.actividades (gimnasio_id, nombre) values ($1,'Yoga') returning id`, [t.g]);
  await t.q(`insert into public.productos (gimnasio_id, nombre, precio) values ($1,'Agua',1500)`, [t.g]);
});
after(async () => t && t.cerrar());

// ── Caja ─────────────────────────────────────────────────────────────
test("5: anular efectivo de una caja cerrada exige caja abierta, registra la devolución y no cambia el cierre", async () => {
  const turno1 = await como(uRec, async () => (await t.q(`select public.abrir_caja($1, 10000) as id`, [caja]))[0].id);
  const [{ id: prod }] = await t.q(`select id from public.productos where gimnasio_id = $1`, [t.g]);
  const v = await como(uRec, async () => (await t.q(`select public.vender($1,$2,$3,null,$4) as r`,
    [t.sede, JSON.stringify([{ tipo: "producto", producto_id: prod, cantidad: 4 }]), JSON.stringify([{ medio: "efectivo", monto: 6000 }]), turno1]))[0].r);
  await como(uRec, () => t.q(`select public.cerrar_caja($1, 16000)`, [turno1]));
  await como(uDue, () => t.falla(() => t.q(`select public.anular_venta($1, 'Error')`, [v.venta_id]), /indicá la caja abierta/));
  const turno2 = await como(uRec, async () => (await t.q(`select public.abrir_caja($1, 0) as id`, [caja]))[0].id);
  await como(uDue, () => t.q(`select public.anular_venta($1, 'Error', $2)`, [v.venta_id, turno2]));
  const r1 = await como(uDue, async () => (await t.q(`select public.resumen_caja($1) as r`, [turno1]))[0].r);
  const r2 = await como(uDue, async () => (await t.q(`select public.resumen_caja($1) as r`, [turno2]))[0].r);
  assert.equal(Number(r1.esperado), 16000, "el cierre conserva su foto");
  assert.equal(Number(r1.diferencia), 0);
  assert.equal(Number(r2.retiros), 6000, "la devolución sale de la caja abierta");
  await como(uRec, () => t.q(`select public.cerrar_caja($1, 0)`, [turno2])).catch(() => {});
});

test("14: un turno de otra sede o cerrado no se usa ni sin efectivo", async () => {
  const turnoB = await como(uDue, async () => (await t.q(`select public.abrir_caja($1, 0) as id`, [cajaB]))[0].id);
  const [{ id: prod }] = await t.q(`select id from public.productos where gimnasio_id = $1`, [t.g]);
  await como(uRec, () => t.falla(() => t.q(`select public.vender($1,$2,$3,null,$4)`,
    [t.sede, JSON.stringify([{ tipo: "producto", producto_id: prod }]), JSON.stringify([{ medio: "debito", monto: 1500 }]), turnoB]), /no es de esta sede/));
});

test("15: la recepción no puede reconstruir lo esperado (no lee pagos, ítems, turnos ni movimientos)", async () => {
  await como(uRec, async () => {
    for (const tabla of ["pagos", "venta_items", "turnos_caja", "movimientos_caja"]) {
      const filas = await t.q(`select * from public.${tabla}`);
      assert.equal(filas.length, 0, tabla);
    }
    const abiertas = await t.q(`select * from public.cajas_sede($1)`, [t.sede]);
    assert.ok(Array.isArray(abiertas));
  });
});

test("22a/b: un 100% de descuento se registra sin pagos; el carrito no acepta 13 cuotas", async () => {
  const [{ id: prod }] = await t.q(`select id from public.productos where gimnasio_id = $1`, [t.g]);
  const r = await como(uEnc, async () => (await t.q(`select public.vender($1,$2,$3) as r`,
    [t.sede, JSON.stringify([{ tipo: "producto", producto_id: prod, descuento: 1500, descuento_motivo: "Amigo o familiar del gimnasio" }]), "[]"]))[0].r);
  assert.equal(Number(r.total), 0);
  await como(uRec, () => t.falla(() => t.q(`select public.vender($1,$2,$3,$4)`,
    [t.sede, JSON.stringify([{ tipo: "cuota", cantidad: 13 }]), JSON.stringify([{ medio: "transferencia", monto: 325000 }]), t.ctx.socios.sin_pago]), /Cantidad inválida/));
});

// ── Transferencias ───────────────────────────────────────────────────
test("12: cambiar de plan rechaza solo el comprobante pendiente y deja informar de nuevo", async () => {
  const s = t.ctx.socios.por_vencer;
  await t.q(`update public.socios set usuario_id = $2 where id = $1`, [s, uSocio]);
  const r = await como(uSocio, async () => (await t.q(`select public.informar_transferencia($1,$2) as r`, [s, `${t.g}/${s}/a.jpg`]))[0].r);
  await t.q(`select privado.cambiar_plan($1, $2, now(), null)`, [s, t.ctx.planes.tres]);
  const [{ estado, rechazado_motivo }] = await t.q(`select estado, rechazado_motivo from public.pagos where id = $1`, [r.pago_id]);
  assert.equal(estado, "rechazado");
  assert.match(rechazado_motivo, /La membresía se cerró/);
  const r2 = await como(uSocio, async () => (await t.q(`select public.informar_transferencia($1,$2) as r`, [s, `${t.g}/${s}/b.jpg`]))[0].r);
  assert.equal(Number(r2.monto), 20000);
});

test("nadie aprueba su propio pago, aunque sea del equipo", async () => {
  const s = t.ctx.socios.vence_hoy;
  await t.q(`update public.socios set usuario_id = $2 where id = $1`, [s, uRec]);
  const r = await como(uRec, async () => (await t.q(`select public.informar_transferencia($1,$2) as r`, [s, `${t.g}/${s}/c.jpg`]))[0].r);
  await como(uRec, () => t.falla(() => t.q(`select public.aprobar_pago($1)`, [r.pago_id]), /pago tuyo/));
  await t.q(`update public.socios set usuario_id = null where id = $1`, [s]);
});

test("22d: la recepción de otra sede no ve comprobantes que no puede aprobar", async () => {
  const lista = await como(uRecB, async () => await t.q(`select * from public.pagos_por_aprobar($1)`, [t.g]));
  assert.equal(lista.length, 0);
  const todos = await como(uDue, async () => await t.q(`select * from public.pagos_por_aprobar($1)`, [t.g]));
  assert.ok(todos.length > 0);
});

// ── Retención ────────────────────────────────────────────────────────
const retencion = async () => await t.q(`select * from privado.retencion($1, $2)`, [t.g, momento]);

test("6a: el que se anotó y nunca pagó aparece como vencido, con lo mismo que dice la puerta", async () => {
  const { s } = await socio("Nunca Pago", t.ctx.planes.full, [], -10);
  const f = (await retencion()).find((x) => x.socio_id === s);
  assert.equal(f.lista, "vencido");
  assert.equal(f.texto, "Todavía no pagó Plan Full · son $25.000");
  assert.equal(Number(f.debe), 25000);
});

test("6b/11: un vencido que cambia de plan sigue en la lista; un socio viejo que cambia de plan no es 'nuevo'", async () => {
  const { s: venc } = await socio("Vencido Cambia", t.ctx.planes.full, [[-40, -10]]);
  await t.q(`select privado.cambiar_plan($1, $2, $3, null)`, [venc, t.ctx.planes.tres, await t.en(D(-1))]);
  const { s: viejo } = await socio("Viejo Cambia", t.ctx.planes.full, [[-20, 20]]);
  await t.q(`select privado.cambiar_plan($1, $2, $3, null)`, [viejo, t.ctx.planes.tres, await t.en(D(-10))]);
  const filas = await retencion();
  assert.equal(filas.find((x) => x.socio_id === venc)?.lista, "vencido");
  assert.notEqual(filas.find((x) => x.socio_id === viejo)?.lista, "nuevo");
});

test("10: con un plan de 3 meses, la deuda de la retención es la de la puerta", async () => {
  const p = await plan("Trimestral", { tipo: "membresia", duracion_meses: 3, renovacion: "continua" });
  await t.q(`insert into public.precios_plan (gimnasio_id, plan_id, monto, vigente_desde) values ($1,$2,100000,'2020-01-01')`, [t.g, p]);
  const { s } = await socio("Trimestral", p, [[-100, -10]]);
  const f = (await retencion()).find((x) => x.socio_id === s);
  const [{ v }] = await t.q(`select (privado.calcular_acceso($1, $2)).para_regularizar as v`, [s, momento]);
  assert.equal(Number(f.debe), Number(v));
  assert.equal(Number(f.debe), 100000);
});

test("22f: sin precio cargado, el mensaje no queda con un hueco", async () => {
  const p = await plan("Sin precio", { tipo: "membresia", duracion_meses: 1, renovacion: "continua" });
  const { s } = await socio("Sin Precio", p, [[-40, -10]]);
  const f = (await retencion()).find((x) => x.socio_id === s);
  assert.match(f.mensaje, /son la cuota\./);
});

// ── Clases ───────────────────────────────────────────────────────────
test("3: si la membresía cubre la clase, el pack no se toca", async () => {
  const pl = await plan("Pack spinning A", { tipo: "pack", cantidad_clases: 8, consume_en: "asistencia" });
  await pack(t.ctx.socios.al_dia, pl, 8);
  const c = await clase(spinning, D(1));
  const r = await asistencia(c, t.ctx.socios.al_dia, await t.en(D(1), "19:05:00"));
  assert.equal(r.via, "membresia");
  assert.equal(r["descontó_pack"], false);
});

test("7: el pack respeta sus actividades, y la membresía que no incluye la actividad deja pasar al pack", async () => {
  const soloYoga = await plan("Solo yoga", { tipo: "membresia", duracion_meses: 1, renovacion: "continua" });
  await t.q(`insert into public.plan_actividades (gimnasio_id, plan_id, actividad_id) values ($1,$2,$3)`, [t.g, soloYoga, yoga]);
  const packSpin = await plan("Pack spinning B", { tipo: "pack", cantidad_clases: 8, consume_en: "asistencia" });
  await t.q(`insert into public.plan_actividades (gimnasio_id, plan_id, actividad_id) values ($1,$2,$3)`, [t.g, packSpin, spinning]);
  const { s } = await socio("Yoga Y Pack", soloYoga, [[-5, 25]]);
  await pack(s, packSpin, 8);
  const cSpin = await clase(spinning, D(2)), cYoga = await clase(yoga, D(2), "20:00:00");
  assert.equal((await reservar(s, cSpin)).via, "pack");
  assert.equal((await reservar(s, cYoga)).via, "membresia");
  const { s: soloPack } = await socio("Solo Pack Spinning", null);
  await pack(soloPack, packSpin, 8);
  await t.falla(() => reservar(soloPack, cYoga), /no incluye Yoga/);
});

test("9: con 1 clase en el pack no se reservan 2 clases", async () => {
  const pl = await plan("Pack 1", { tipo: "pack", cantidad_clases: 1, consume_en: "asistencia" });
  const { s } = await socio("Una Clase", null);
  await pack(s, pl, 1);
  const c1 = await clase(spinning, D(3)), c2 = await clase(spinning, D(4));
  await reservar(s, c1);
  await t.falla(() => reservar(s, c2), /ya tiene todas sus clases reservadas/);
});

test("4: el profe no cancela una clase que ya pasó; el dueño sí", async () => {
  // cancelar_clase compara con now() (la hora real del servidor), así que la clase va en el pasado real.
  const [{ id: c }] = await t.q(`insert into public.clases (gimnasio_id, sede_id, actividad_id, inicio, fin, cupo, profe_id)
      values ($1,$2,$3, now() - interval '1 day', now() - interval '1 day' + interval '50 minutes', 10, $4) returning id`,
    [t.g, t.sede, spinning, profe]);
  await sp("c4");
  try {
    await como(uProfe, () => t.falla(() => t.q(`select public.cancelar_clase($1, 'me olvidé')`, [c]), /ya empezó/));
  } finally { await rb("c4"); }
  await como(uDue, () => t.q(`select public.cancelar_clase($1, 'Corrección')`, [c]));
  const [{ cancelada_motivo }] = await t.q(`select cancelada_motivo from public.clases where id = $1`, [c]);
  assert.equal(cancelada_motivo, "Corrección");
});

test("8: un cierre cargado después cancela las clases ya creadas; anularlo las devuelve", async () => {
  const c = await clase(spinning, D(5));
  await reservar(t.ctx.socios.al_dia, c);
  // El cierre tiene que ser futuro respecto de now(): la prueba usa fechas de 2026-11.
  const [{ id: ci }] = await t.q(`insert into public.cierres (gimnasio_id, desde, hasta, motivo) values ($1,$2,$3,'Pintura') returning id`,
    [t.g, await t.en(D(5), "00:00:00"), await t.en(D(6), "00:00:00")]);
  let [k] = await t.q(`select cancelada_motivo, cierre_id from public.clases where id = $1`, [c]);
  assert.equal(k.cancelada_motivo, "Gimnasio cerrado: Pintura");
  const [{ n }] = await t.q(`select count(*)::int n from public.avisos_pendientes where clase_id = $1 and tipo = 'clase_cancelada'`, [c]);
  assert.equal(n, 1);
  await t.q(`update public.cierres set anulado_en = now(), anulado_motivo = 'Se postergó' where id = $1`, [ci]);
  [k] = await t.q(`select cancelada_en from public.clases where id = $1`, [c]);
  assert.equal(k.cancelada_en, null);
});

test("19: la lista de espera saltea a quien ya no puede entrar", async () => {
  const c = await clase(spinning, D(1), "08:00:00", 1);
  await reservar(t.ctx.socios.por_vencer, c);
  const { s: susp } = await socio("Suspendida Espera", t.ctx.planes.full, [[-5, 25]]);
  await reservar(susp, c);
  await reservar(t.ctx.socios.cumple, c);
  await t.q(`insert into public.suspensiones (gimnasio_id, socio_id, desde, motivo) values ($1,$2,$3,'Deuda de casillero')`, [t.g, susp, momento]);
  const [{ id: r }] = await t.q(`select id from public.reservas where clase_id = $1 and socio_id = $2`, [c, t.ctx.socios.por_vencer]);
  await t.q(`select privado.cancelar_reserva($1, 'socio', false, $2)`, [r, momento]);
  const estados = Object.fromEntries((await t.q(`select socio_id, estado from public.reservas where clase_id = $1`, [c])).map((x) => [x.socio_id, x.estado]));
  assert.equal(estados[susp], "espera");
  assert.equal(estados[t.ctx.socios.cumple], "confirmada");
});

test("20: presente fuera de horario o a un suspendido no; anular el presente devuelve la clase", async () => {
  const pl = await plan("Pack spinning C", { tipo: "pack", cantidad_clases: 4, consume_en: "asistencia" });
  const { s } = await socio("Presente", null);
  const pk = await pack(s, pl, 4);
  const c = await clase(spinning, D(6));
  await t.falla(() => asistencia(c, s, momento), /desde una hora antes/);
  const r = await asistencia(c, s, await t.en(D(6), "19:10:00"));
  assert.equal(r["descontó_pack"], true);
  await t.q(`select privado.anular_asistencia($1, 'Se anotó al socio equivocado', null)`, [r.asistencia_id]);
  const [{ n }] = await t.q(`select count(*)::int n from public.consumos_pack where pack_id = $1 and anulado_en is null`, [pk]);
  assert.equal(n, 0);
  await t.q(`insert into public.suspensiones (gimnasio_id, socio_id, desde, motivo) values ($1,$2,$3,'Conducta')`, [t.g, s, momento]);
  const despues = await t.en(D(6), "19:15:00");
  await t.falla(() => asistencia(c, s, despues), /No puede tomar la clase: Suspendido/);
});

test("16/17: sin reserva no dice '1° en espera'; un login con varios socios tiene que elegir", async () => {
  const [{ id: h }] = await t.q(`insert into public.horarios_clase (gimnasio_id, sede_id, actividad_id, dia_semana, hora_inicio, duracion_min, cupo, vigente_desde)
      values ($1,$2,$3,extract(isodow from current_date)::int,'23:30',30,5,'2026-01-01') returning id`, [t.g, t.sede, yoga]);
  assert.ok(h);
  const [{ id: uFamilia }] = await t.q(`insert into auth.users (phone) values ('+5490000555666') returning id`);
  await t.q(`update public.socios set usuario_id = $2 where id = any($1)`, [[t.ctx.socios.sin_plan, t.ctx.socios.pack_agotado], uFamilia]);
  await como(uFamilia, async () => {
    await t.falla(() => t.q(`select * from public.clases_del_dia($1, current_date)`, [t.sede]), /elegí para quién/);
    const filas = await t.q(`select * from public.clases_del_dia($1, current_date, $2)`, [t.sede, t.ctx.socios.sin_plan]);
    assert.ok(filas.length > 0);
    assert.ok(filas.every((f) => f.mi_posicion === null));
  });
});

test("21: un horario no se edita; cerrarlo cancela las clases futuras ya creadas", async () => {
  const [{ id: h }] = await t.q(`insert into public.horarios_clase (gimnasio_id, sede_id, actividad_id, dia_semana, hora_inicio, duracion_min, cupo, vigente_desde)
      values ($1,$2,$3,7,'10:00',50,5,'2026-01-01') returning id`, [t.g, t.sede, spinning]);
  await t.falla(() => t.q(`update public.horarios_clase set hora_inicio = '11:00' where id = $1`, [h]), /solo se puede cambiar: vigente_hasta/);
  await t.q(`select privado.materializar_dia($1, $2::date)`, [t.sede, D(8)]);   // domingo 22/11
  await t.q(`update public.horarios_clase set vigente_hasta = $2::date where id = $1`, [h, D(7)]);
  const [{ cancelada_motivo }] = await t.q(`select cancelada_motivo from public.clases where horario_id = $1`, [h]);
  assert.equal(cancelada_motivo, "Cambió el horario de la clase");
});

test("22c/22e: la lista no repite a nadie; una actividad se puede quitar de un plan", async () => {
  const c = await clase(spinning, D(1), "21:00:00", 1, profe);
  await reservar(t.ctx.socios.al_dia, c);
  await reservar(t.ctx.socios.por_vencer, c);                   // queda en espera
  await asistencia(c, t.ctx.socios.por_vencer, await t.en(D(1), "21:05:00"));
  const lista = await como(uProfe, async () => await t.q(`select * from public.lista_clase($1)`, [c]));
  assert.equal(lista.filter((x) => x.socio_id === t.ctx.socios.por_vencer).length, 1);
  const p = await plan("Plan con actividades", { tipo: "membresia", duracion_meses: 1, renovacion: "continua" });
  await t.q(`insert into public.plan_actividades (gimnasio_id, plan_id, actividad_id) values ($1,$2,$3)`, [t.g, p, yoga]);
  const borradas = await como(uEnc, async () => (await t.db.query(`delete from public.plan_actividades where plan_id = $1`, [p])).rowCount);
  assert.equal(borradas, 1);
});

