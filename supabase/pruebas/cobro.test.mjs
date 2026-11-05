// Pruebas de cobro de cuotas: precio vigente y cómo un pago se vuelve cobertura.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir, HOY } from "./_comun.mjs";
import { sumarDias } from "../../scripts/datos/casos-testigo.mjs";

let t, momento;
before(async () => {
  t = await abrir("prueba-cobro");
  momento = await t.en(HOY);
});
after(async () => t && t.cerrar());

const cobrar = async (socio, medio = "transferencia", cuotas = 1, turno = null, m = momento) =>
  (await t.q(`select privado.cobrar_cuota($1, $2, $3, $4, $5, null, $6) as r`, [socio, t.sede, medio, cuotas, turno, m]))[0].r;
const estado = async (socio, m = momento) => (await t.q(`select (privado.calcular_acceso($1, $2)).*`, [socio, m]))[0];

async function socioConPlan(nombre, plan, coberturas) {
  const [{ id: s }] = await t.q(`insert into public.socios (gimnasio_id, nombre, apellido) values ($1, 'Prueba', $2) returning id`, [t.g, nombre]);
  const [{ id: su }] = await t.q(`insert into public.suscripciones (gimnasio_id, socio_id, plan_id, inicio)
                                  values ($1, $2, $3, '2026-01-01T03:00:00Z') returning id`, [t.g, s, plan]);
  for (const [d, h] of coberturas) {
    await t.q(`insert into public.coberturas (gimnasio_id, suscripcion_id, socio_id, desde, hasta, origen, motivo)
               values ($1, $2, $3, privado.medianoche($4::date, $6), privado.medianoche($5::date, $6), 'cortesia', 'prueba')`,
      [t.g, su, s, sumarDias(HOY, d), sumarDias(HOY, h), t.ctx.zona]);
  }
  return s;
}

test("continua: paga una cuota vencida y queda cubierto desde que venció", async () => {
  const r = await cobrar(t.ctx.socios.vencida);       // venció el 24/10
  assert.equal(Number(r.total), 25000);
  assert.equal(r.veredicto.texto, "Al día · Plan Full · vence el 24/11");
});

test("continua: con tres meses de deuda, tres cuotas lo ponen al día", async () => {
  const r = await cobrar(t.ctx.socios.vencida_tres_meses, "transferencia", 3);
  assert.equal(r.coberturas, 3);
  assert.equal(r.veredicto.color, "verde");
  assert.match(r.veredicto.texto, /vence el 19\/11$/);
});

test("al día: paga por adelantado y se encadena al final", async () => {
  const r = await cobrar(t.ctx.socios.al_dia);         // vencía el 24/11
  assert.match(r.veredicto.texto, /vence el 24\/12$/);
});

test("desde_pago: los días sin cubrir se pierden, arranca hoy", async () => {
  const [{ id: p }] = await t.q(`insert into public.planes (gimnasio_id, tipo, nombre, duracion_meses, renovacion)
                                 values ($1, 'membresia', 'Libre desde pago', 1, 'desde_pago') returning id`, [t.g]);
  await t.q(`insert into public.precios_plan (gimnasio_id, plan_id, monto, vigente_desde) values ($1, $2, 21000, '2020-01-01')`, [t.g, p]);
  const s = await socioConPlan("Desde Pago", p, [[-60, -30]]);
  const r = await cobrar(s);
  assert.match(r.veredicto.texto, /vence el 13\/12$/);  // 14/11 + 1 mes, último día 13/12
});

test("dia_fijo: el período va del día 10 al día 10", async () => {
  const [{ id: p }] = await t.q(`insert into public.planes (gimnasio_id, tipo, nombre, duracion_meses, renovacion, dia_fijo)
                                 values ($1, 'membresia', 'Mensual día 10', 1, 'dia_fijo', 10) returning id`, [t.g]);
  await t.q(`insert into public.precios_plan (gimnasio_id, plan_id, monto, vigente_desde) values ($1, $2, 20000, '2020-01-01')`, [t.g, p]);
  const s = await socioConPlan("Dia Fijo", p, [[-65, -35]]); // venció el 9/10
  const r = await cobrar(s);
  assert.match(r.veredicto.texto, /vence el 09\/12$/);  // 10/11 → 10/12
});

test("reinicio: si estuvo afuera más de N días, arranca hoy aunque sea continua", async () => {
  const [{ id: p }] = await t.q(`insert into public.planes (gimnasio_id, tipo, nombre, duracion_meses, renovacion, reinicio_tras_dias)
                                 values ($1, 'membresia', 'Continua con reinicio', 1, 'continua', 30) returning id`, [t.g]);
  await t.q(`insert into public.precios_plan (gimnasio_id, plan_id, monto, vigente_desde) values ($1, $2, 20000, '2020-01-01')`, [t.g, p]);
  const s = await socioConPlan("Reinicio", p, [[-100, -70]]);
  const r = await cobrar(s);
  assert.equal(r.coberturas, 1);
  assert.match(r.veredicto.texto, /vence el 13\/12$/);
});

test("precio según medio y día de pago, dentro de la misma lista", async () => {
  const [{ id: p }] = await t.q(`insert into public.planes (gimnasio_id, tipo, nombre, duracion_meses, renovacion)
                                 values ($1, 'membresia', 'Con descuentos', 1, 'continua') returning id`, [t.g]);
  const lista = "2026-01-01T03:00:00Z";
  for (const [monto, medio, dia] of [[25000, null, null], [22000, "efectivo", null], [23000, null, 10], [20000, "efectivo", 10]]) {
    await t.q(`insert into public.precios_plan (gimnasio_id, plan_id, monto, vigente_desde, medio_pago, pago_hasta_dia)
               values ($1, $2, $3, $4, $5, $6)`, [t.g, p, monto, lista, medio, dia]);
  }
  const precio = async (dia, medio) =>
    Number((await t.q(`select privado.precio_para($1, $2, $3, null, true) as v`, [p, await t.en(dia, "12:00:00"), medio]))[0].v);
  assert.equal(await precio("2026-11-05", "credito"), 23000);   // del 1 al 10
  assert.equal(await precio("2026-11-05", "efectivo"), 20000);  // efectivo y del 1 al 10
  assert.equal(await precio("2026-11-14", "credito"), 25000);   // después del 10
  assert.equal(await precio("2026-11-14", "efectivo"), 22000);
  const [{ v }] = await t.q(`select privado.precio_base($1, $2) as v`, [p, momento]);
  assert.equal(Number(v), 25000, "la deuda se calcula con el precio de lista");

  // Aumento programado: una lista nueva. El descuento viejo no queda pegado.
  await t.q(`insert into public.precios_plan (gimnasio_id, plan_id, monto, vigente_desde) values ($1, $2, 30000, '2026-11-10T03:00:00Z')`, [t.g, p]);
  assert.equal(await precio("2026-11-14", "efectivo"), 30000);
  assert.equal(await precio("2026-11-09", "efectivo"), 20000, "antes del aumento rige la lista vieja (efectivo, del 1 al 10)");
});

test("efectivo exige caja abierta en la sede; el pago queda en ese turno", async () => {
  await t.falla(() => cobrar(t.ctx.socios.sin_pago, "efectivo"), /caja abierta/);
  const [{ id: caja }] = await t.q(`insert into public.cajas (gimnasio_id, sede_id, nombre) values ($1, $2, 'Recepción') returning id`, [t.g, t.sede]);
  const [{ id: eq }] = await t.q(`insert into public.equipo (gimnasio_id, nombre, rol) values ($1, 'Caro', 'recepcion') returning id`, [t.g]);
  const [{ id: turno }] = await t.q(`insert into public.turnos_caja (gimnasio_id, caja_id, abierto_por, monto_inicial) values ($1, $2, $3, 5000) returning id`, [t.g, caja, eq]);
  const r = await cobrar(t.ctx.socios.sin_pago, "efectivo", 1, turno);
  assert.equal(r.veredicto.color, "verde");
  const [{ turno_caja_id }] = await t.q(`select p.turno_caja_id from public.pagos p where p.venta_id = $1`, [r.venta_id]);
  assert.equal(turno_caja_id, turno);
});

test("MercadoPago no se confirma en el mostrador", async () => {
  await t.falla(() => cobrar(t.ctx.socios.vencida_con_pack, "mercadopago"), /webhook/);
});

test("una venta sin la plata completa no se confirma", async () => {
  const [{ id: su }] = await t.q(`select id from public.suscripciones where socio_id = $1`, [t.ctx.socios.en_tolerancia]);
  const [{ id: v }] = await t.q(`insert into public.ventas (gimnasio_id, sede_id, socio_id, origen) values ($1, $2, $3, 'recepcion') returning id`,
    [t.g, t.sede, t.ctx.socios.en_tolerancia]);
  await t.q(`insert into public.venta_items (gimnasio_id, venta_id, tipo, plan_id, suscripcion_id, descripcion, precio_unitario)
             values ($1, $2, 'cuota', $3, $4, 'Cuota', 25000)`, [t.g, v, t.ctx.planes.full, su]);
  await t.q(`insert into public.pagos (gimnasio_id, venta_id, medio, monto, estado, aprobado_en) values ($1, $2, 'transferencia', 10000, 'aprobado', now())`, [t.g, v]);
  await t.falla(() => t.q(`select privado.confirmar_venta($1, $2)`, [v, momento]), /Falta cobrar/);
});

test("anular una venta: la recepción no puede; el dueño sí, y el socio vuelve a deber", async () => {
  const r = await cobrar(t.ctx.socios.en_tolerancia);
  assert.equal(r.veredicto.color, "verde");
  const [{ id: uRec }] = await t.q(`insert into auth.users (email) values ('rec@ejemplo.invalid') returning id`);
  const [{ id: uDue }] = await t.q(`insert into auth.users (email) values ('duenio@ejemplo.invalid') returning id`);
  await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1, $2, 'Rec', 'recepcion'), ($1, $3, 'Dueño', 'dueno')`,
    [t.g, uRec, uDue]);
  await t.comoUsuario(uRec, () => t.falla(() => t.q(`select public.anular_venta($1, 'error')`, [r.venta_id]), /Sin permiso/));
  await t.db.query("savepoint anula");
  await t.q(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: uDue, role: "authenticated" })]);
  await t.db.query("set local role authenticated");
  await t.q(`select public.anular_venta($1, 'Cobro duplicado')`, [r.venta_id]);
  await t.db.query("reset role");
  const despues = await estado(t.ctx.socios.en_tolerancia);
  await t.db.query("rollback to savepoint anula");
  assert.equal(despues.color, "naranja");
});

test("la recepción cobra por RPC; un socio no puede cobrarse", async () => {
  const [{ id: u }] = await t.q(`insert into auth.users (email) values ('caja@ejemplo.invalid') returning id`);
  await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1, $2, 'Caja', 'recepcion')`, [t.g, u]);
  await t.comoUsuario(u, async () => {
    const [{ r }] = await t.q(`select public.cobrar_cuota($1, $2, 'transferencia') as r`, [t.ctx.socios.por_vencer, t.sede]);
    assert.ok(r.venta_id);
  });
  const [{ id: us }] = await t.q(`insert into auth.users (phone) values ('+5490000777777') returning id`);
  await t.q(`update public.socios set usuario_id = $2 where id = $1`, [t.ctx.socios.vence_hoy, us]);
  await t.comoUsuario(us, () => t.falla(() => t.q(`select public.cobrar_cuota($1, $2, 'transferencia')`, [t.ctx.socios.vence_hoy, t.sede]), /Sin permiso/));
});

test("trimestral (PLA-1): una cuota cubre 3 meses", async () => {
  const [{ id: p }] = await t.q(`insert into public.planes (gimnasio_id, tipo, nombre, duracion_meses, renovacion)
                                 values ($1, 'membresia', 'Trimestral', 3, 'desde_pago') returning id`, [t.g]);
  await t.q(`insert into public.precios_plan (gimnasio_id, plan_id, monto, vigente_desde) values ($1, $2, 81000, '2020-01-01')`, [t.g, p]);
  const s = await socioConPlan("Trimestral", p, []);
  const r = await cobrar(s);
  assert.match(r.veredicto.texto, /vence el 13\/02$/);  // 14/11 + 3 meses, último día 13/02
  assert.equal((await estado(s, await t.en(sumarDias(HOY, 80)))).color, "verde");
});
