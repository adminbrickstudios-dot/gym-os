// VD-46U (7803): anular una devolución registrada por error. Es un hecho nuevo (con motivo y quién), libera los períodos para
// registrarla de nuevo bien, y con el efectivo que volvió a la caja deja un ingreso en la caja de quien anula. Solo dueño y encargado.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir } from "./_comun.mjs";

let t, u = {}, eq = {}, socio, caja, turno, primera, segunda;
async function persona(rol, nombre) {
  const [{ id }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`${rol}${Math.random()}@ejemplo.invalid`]);
  const [{ id: e }] = await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,$3,$4) returning id`, [t.g, id, nombre, rol]);
  u[rol] = id; eq[rol] = e;
}
async function como(usuario, fn) {
  await t.db.query("savepoint como");
  await t.db.query("set role authenticated");
  await t.q(`select set_config('request.jwt.claims', $1, false)`, [JSON.stringify({ sub: usuario, role: "authenticated" })]);
  try {
    const r = await fn();
    await t.db.query("reset role"); await t.q(`select set_config('request.jwt.claims', '', false)`);
    return r;
  } catch (e) { await t.db.query("rollback to savepoint como"); await t.db.query("reset role"); throw e; }
}
const calc = (usuario) => como(usuario, async () => (await t.q(`select public.calcular_devolucion_baja($1) as r`, [socio]))[0].r);
const registrar = (usuario, medio, monto, motivo) => como(usuario, async () => (await t.q(`select public.registrar_devolucion($1, $2, $3, $4) as r`, [socio, medio, monto, motivo]))[0].r);
const anular = (usuario, id, motivo, reintegro = false) => como(usuario, async () => (await t.q(`select public.anular_devolucion($1, $2, $3) as r`, [id, motivo, reintegro]))[0].r);
const intentoAnular = (usuario, id, motivo, reintegro, patron) => como(usuario, () => t.falla(() => t.q(`select public.anular_devolucion($1, $2, $3)`, [id, motivo, reintegro]), patron));
const esperado = async () => Number((await t.q(`select privado.resumen_turno($1) as r`, [turno]))[0].r.esperado);

before(async () => {
  t = await abrir("prueba-vd46u");
  await persona("dueno", "Sofía"); await persona("encargado", "Martín"); await persona("recepcion", "Ana");
  [{ id: caja }] = await t.q(`insert into public.cajas (gimnasio_id, sede_id, nombre) values ($1,$2,'Recepción') returning id`, [t.g, t.sede]);
  [{ id: socio }] = await t.q(`insert into public.socios (gimnasio_id, nombre, apellido) values ($1, 'Anula', 'Devolucion') returning id`, [t.g]);
  const [{ id: su }] = await t.q(`insert into public.suscripciones (gimnasio_id, socio_id, plan_id, inicio) values ($1,$2,$3, now() - interval '40 days') returning id`, [t.g, socio, t.ctx.planes.full]);
  const [{ id: venta }] = await t.q(`insert into public.ventas (gimnasio_id, sede_id, socio_id, estado, origen, confirmada_en, creado_por) values ($1,$2,$3,'confirmada','recepcion', now() - interval '10 days', $4) returning id`, [t.g, t.sede, socio, eq.recepcion]);
  const [{ id: it }] = await t.q(`insert into public.venta_items (gimnasio_id, venta_id, tipo, plan_id, suscripcion_id, descripcion, cantidad, precio_unitario, descuento)
    values ($1,$2,'cuota',$3,$4,'Cuota Full',3,30000,0) returning id`, [t.g, venta, t.ctx.planes.full, su]);
  await t.q(`insert into public.pagos (gimnasio_id, venta_id, medio, monto, estado, aprobado_en) values ($1,$2,'transferencia',90000,'aprobado', now() - interval '10 days')`, [t.g, venta]);
  for (const [a, b] of [[-10, 20], [20, 50], [50, 80]]) {
    await t.q(`insert into public.coberturas (gimnasio_id, suscripcion_id, socio_id, desde, hasta, origen, venta_item_id)
      select $1, $2, $3, privado.medianoche(privado.dia_local(now(), g.zona_horaria) + $4::int, g.zona_horaria), privado.medianoche(privado.dia_local(now(), g.zona_horaria) + $5::int, g.zona_horaria), 'pago', $6
        from public.gimnasios g where g.id = $1`, [t.g, su, socio, a, b, it]);
  }
  await como(u.recepcion, () => t.q(`select public.dar_de_baja($1, 'mudanza')`, [socio]));
  turno = await como(u.encargado, async () => (await t.q(`select public.abrir_caja($1, 10000) as id`, [caja]))[0].id);
  primera = await registrar(u.encargado, "efectivo", 50000, "Se mudó y pidió que le devolvamos");
});
after(async () => t && t.cerrar());

test("solo dueño y encargado anulan, con motivo; no existe ni se anula dos veces", async () => {
  await intentoAnular(u.recepcion, primera.devolucion_id, "Me equivoqué de socio", false, /Sin permiso/);
  await intentoAnular(u.encargado, primera.devolucion_id, "x", false, /motivo/);
  await intentoAnular(u.encargado, "00000000-0000-0000-0000-000000000000", "Me equivoqué", false, /Sin permiso/);
  assert.equal(await esperado(), -40000, "antes de anular, la devolución en efectivo bajó lo esperado");
});

test("anular sin reintegro: queda el hecho, no se toca la caja y los períodos vuelven a estar para devolver", async () => {
  const a = await anular(u.dueno, primera.devolucion_id, "La registré con el monto equivocado");
  assert.equal(a.reintegro_caja, false); assert.equal(a.movimiento_caja_id, null);
  assert.equal(await esperado(), -40000, "sin reintegro no se mueve la caja");
  const [h] = await t.q(`select motivo, anulada_por from public.devoluciones_anuladas where devolucion_id = $1`, [primera.devolucion_id]);
  assert.equal(h.motivo, "La registré con el monto equivocado"); assert.equal(h.anulada_por, eq.dueno);
  await intentoAnular(u.encargado, primera.devolucion_id, "Otra vez", false, /ya estaba anulada/);
  await t.falla(() => t.q(`update public.devoluciones_anuladas set motivo = 'otro' where devolucion_id = $1`, [primera.devolucion_id]), /solo se puede cambiar/);
  await t.falla(() => t.q(`delete from public.devoluciones_anuladas where devolucion_id = $1`, [primera.devolucion_id]), /no se borran/);
  // La devolución original sigue ahí, intacta.
  const [d] = await t.q(`select monto from public.devoluciones where id = $1`, [primera.devolucion_id]);
  assert.equal(Number(d.monto), 50000);
  const c = await calc(u.dueno);
  assert.equal(Number(c.total), 60000, "los dos períodos que no empezaron, a $30.000");
  assert.equal(c.ya_registrada, false, "puede registrarse de nuevo");
});

test("se registra de nuevo bien; cada período sigue devolviéndose una sola vez", async () => {
  segunda = await registrar(u.encargado, "transferencia", 60000, "Corregida: el monto era el calculado");
  assert.equal(Number(segunda.monto), 60000);
  await como(u.encargado, () => t.falla(() => t.q(`select public.registrar_devolucion($1, 'transferencia', 100, 'Una tercera')`, [socio]), /No hay nada para devolver/));
  // Aunque se intente por abajo, el período devuelto en pie no se repite.
  const [{ cobertura_id: cob }] = await t.q(`select cobertura_id from public.devoluciones_items where devolucion_id = $1 limit 1`, [segunda.devolucion_id]);
  await t.falla(() => t.q(`insert into public.devoluciones_items (gimnasio_id, devolucion_id, cobertura_id, monto) values ($1,$2,$3,1)`, [t.g, segunda.devolucion_id, cob]), /ya tiene una devolución/);
  assert.equal((await t.q(`select count(*)::int n from public.devoluciones_items where cobertura_id = $1`, [cob]))[0].n, 2, "queda la del hecho anulado y la nueva");
});

test("anular la de efectivo CON reintegro: pide la caja abierta, anota un ingreso en la caja de quien anula y sube lo esperado", async () => {
  const ef = await registrar(u.encargado, "efectivo", 10, "Prueba").catch(() => null);
  assert.equal(ef, null, "no hay nada para devolver mientras la segunda siga en pie");
  await intentoAnular(u.dueno, segunda.devolucion_id, "Era por transferencia", true, /Solo una devolución en efectivo/);
  // Se anula la segunda y se devuelve en efectivo para probar el reintegro.
  await anular(u.dueno, segunda.devolucion_id, "La hago en efectivo");
  const tercera = await registrar(u.encargado, "efectivo", 20000, "En efectivo, parcial");
  assert.equal(await esperado(), -60000, "10.000 de inicial menos el retiro original (50.000, anulado sin reintegro) y el nuevo de 20.000");
  await intentoAnular(u.dueno, tercera.devolucion_id, "Nunca salió la plata", true, /abrí tu caja/);
  const otraCaja = (await t.q(`insert into public.cajas (gimnasio_id, sede_id, nombre) values ($1,$2,'Caja 2') returning id`, [t.g, t.sede]))[0].id;
  const turnoDueno = await como(u.dueno, async () => (await t.q(`select public.abrir_caja($1, 5000) as id`, [otraCaja]))[0].id);
  const a = await anular(u.dueno, tercera.devolucion_id, "Nunca salió la plata del cajón", true);
  assert.equal(a.reintegro_caja, true);
  const [m] = await t.q(`select tipo, monto, motivo, creado_por, turno_caja_id from public.movimientos_caja where id = $1`, [a.movimiento_caja_id]);
  assert.equal(m.tipo, "ingreso"); assert.equal(Number(m.monto), 20000); assert.equal(m.creado_por, eq.dueno); assert.equal(m.turno_caja_id, turnoDueno);
  assert.match(m.motivo, /^Anulación de devolución a Anula Devolucion: Nunca salió/);
  assert.equal(Number((await t.q(`select privado.resumen_turno($1) as r`, [turnoDueno]))[0].r.esperado), 25000, "5.000 de inicial + 20.000 que volvieron");
});

test("la ficha lista las devoluciones con su anulación (solo dueño y encargado) y Control marca la anulada", async () => {
  const l = await como(u.encargado, async () => (await t.q(`select public.devoluciones_socio($1) as r`, [socio]))[0].r);
  assert.equal(l.length, 3);
  assert.equal(l.filter((x) => x.anulada).length, 3, "las tres quedaron anuladas");
  assert.equal(l.find((x) => x.id === primera.devolucion_id).anulada_motivo, "La registré con el monto equivocado");
  await como(u.recepcion, () => t.falla(() => t.q(`select public.devoluciones_socio($1)`, [socio]), /Sin permiso/));
  const c = await como(u.dueno, async () => (await t.q(`select public.moderacion_control($1, (now() at time zone 'UTC')::date - 3, (now() at time zone 'UTC')::date + 1) as r`, [t.g]))[0].r);
  const dev = c.items.filter((i) => i.tipo === "devolucion");
  assert.ok(dev.length >= 3 && dev.every((d) => /ANULADA: /.test(d.detalle)), JSON.stringify(dev.map((d) => d.detalle)));
});

test("Configuración → Reglas: topes, motivos y regla de devolución; los edita solo el dueño; la recepción no entra", async () => {
  const d = await como(u.dueno, async () => (await t.q(`select public.reglas_beneficios($1) as r`, [t.g]))[0].r);
  assert.equal(d.puede_editar, true); assert.equal(d.devolucion_modo, "cuotas_adelantadas");
  assert.ok(d.motivos.length >= 1); assert.ok(d.topes.max_dias_recepcion >= 0);
  const e = await como(u.encargado, async () => (await t.q(`select public.reglas_beneficios($1) as r`, [t.g]))[0].r);
  assert.equal(e.puede_editar, false);
  await como(u.recepcion, () => t.falla(() => t.q(`select public.reglas_beneficios($1)`, [t.g]), /Sin permiso/));
});
