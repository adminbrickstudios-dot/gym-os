// VD-46J (20261106007203): devolución proporcional al dar de baja con cuota adelantada.
// Tres cuotas pagadas juntas (con descuento), la primera en curso y dos por empezar. Se calcula por período (regla del gimnasio), la plata la ven
// solo el dueño y el encargado, registrar es un hecho nuevo con motivo (el pago original no se toca), en efectivo sale de la caja como retiro y baja
// lo esperado del cierre, y cada período se devuelve una sola vez.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir } from "./_comun.mjs";

let t, u = {}, eq = {}, socio, venta, items = [], turno, caja;
async function persona(rol, nombre) {
  const [{ id }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`${rol}${Math.random()}@ejemplo.invalid`]);
  const [{ id: e }] = await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,$3,$4) returning id`, [t.g, id, nombre, rol]);
  u[rol] = id; eq[rol] = e;
}
async function como(usuario, fn) {
  // Con savepoint: si algo falla, el error de verdad sale (no el "transacción abortada" del reset role).
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
const intento = (usuario, medio, monto, motivo, patron) => como(usuario, () => t.falla(() => t.q(`select public.registrar_devolucion($1, $2, $3, $4)`, [socio, medio, monto, motivo]), patron));

before(async () => {
  t = await abrir("prueba-vd46j");
  await persona("dueno", "Sofía"); await persona("encargado", "Martín"); await persona("recepcion", "Ana");
  [{ id: caja }] = await t.q(`insert into public.cajas (gimnasio_id, sede_id, nombre) values ($1,$2,'Recepción') returning id`, [t.g, t.sede]);
  [{ id: socio }] = await t.q(`insert into public.socios (gimnasio_id, nombre, apellido) values ($1, 'Devo', 'Adelantada') returning id`, [t.g]);
  const [{ id: su }] = await t.q(`insert into public.suscripciones (gimnasio_id, socio_id, plan_id, inicio) values ($1,$2,$3, now() - interval '40 days') returning id`, [t.g, socio, t.ctx.planes.full]);
  [{ id: venta }] = await t.q(`insert into public.ventas (gimnasio_id, sede_id, socio_id, estado, origen, confirmada_en, creado_por) values ($1,$2,$3,'confirmada','recepcion', now() - interval '10 days', $4) returning id`, [t.g, t.sede, socio, eq.recepcion]);
  // 3 cuotas de $30.000 con $6.000 de descuento en total: cada período salió $28.000.
  const [{ id: it }] = await t.q(`insert into public.venta_items (gimnasio_id, venta_id, tipo, plan_id, suscripcion_id, descripcion, cantidad, precio_unitario, descuento, descuento_motivo)
    values ($1,$2,'cuota',$3,$4,'Cuota Full',3,30000,6000,'Convenio o canje') returning id`, [t.g, venta, t.ctx.planes.full, su]);
  items.push(it);
  await t.q(`insert into public.pagos (gimnasio_id, venta_id, medio, monto, estado, aprobado_en) values ($1,$2,'transferencia',84000,'aprobado', now() - interval '10 days')`, [t.g, venta]);
  // Períodos de 30 días: el actual (empezó hace 10 días) y dos por delante.
  for (const [a, b] of [[-10, 20], [20, 50], [50, 80]]) {
    await t.q(`insert into public.coberturas (gimnasio_id, suscripcion_id, socio_id, desde, hasta, origen, venta_item_id)
      select $1, $2, $3, privado.medianoche(privado.dia_local(now(), g.zona_horaria) + $4::int, g.zona_horaria), privado.medianoche(privado.dia_local(now(), g.zona_horaria) + $5::int, g.zona_horaria), 'pago', $6
        from public.gimnasios g where g.id = $1`, [t.g, su, socio, a, b, it]);
  }
});
after(async () => t && t.cerrar());

test("se calcula por período según la regla; el dueño y el encargado ven la plata, la recepción solo que hay algo", async () => {
  const e = await calc(u.encargado);
  assert.equal(e.modo, "cuotas_adelantadas");
  assert.equal(Number(e.total), 56000, "los dos períodos que no empezaron, a $28.000 (precio menos descuento, por período)");
  assert.equal(e.lineas.length, 2); assert.ok(e.lineas.every((l) => !l.empezado && Number(l.a_devolver) === 28000));
  assert.equal(e.hay, true); assert.equal(e.puede_registrar, false, "todavía no se dio de baja");
  const r = await calc(u.recepcion);
  assert.equal(r.hay, true); assert.equal(r.total, undefined); assert.equal(r.lineas, undefined);
  // La regla proporcional suma los días sin usar del período en curso: 28000 × 20/30.
  await como(u.dueno, () => t.q(`select public.guardar_devolucion_baja_modo($1, 'proporcional')`, [t.g]));
  const p = await calc(u.dueno);
  assert.ok(Math.abs(Number(p.total) - 74666.67) < 0.005, `total ${p.total}`);
  assert.equal(p.lineas.find((l) => l.empezado).dias_sin_usar, 20);
  await como(u.dueno, () => t.q(`select public.guardar_devolucion_baja_modo($1, 'ninguna')`, [t.g]));
  assert.equal((await calc(u.dueno)).hay, false);
  await como(u.encargado, () => t.falla(() => t.q(`select public.guardar_devolucion_baja_modo($1, 'proporcional')`, [t.g]), /Sin permiso/));
  await como(u.dueno, () => t.falla(() => t.q(`select public.guardar_devolucion_baja_modo($1, 'rara')`, [t.g]), /una de las tres/));
  assert.equal(await como(u.encargado, async () => (await t.q(`select public.devolucion_baja_config($1) as r`, [t.g]))[0].r), "ninguna");
  await como(u.dueno, () => t.q(`select public.guardar_devolucion_baja_modo($1, 'cuotas_adelantadas')`, [t.g]));
});

test("sin baja no se registra; la baja no toca el pago ni la venta", async () => {
  await intento(u.encargado, "efectivo", 1000, "Antes de la baja", /Primero hay que darlo de baja/);
  await como(u.recepcion, () => t.q(`select public.dar_de_baja($1, 'mudanza')`, [socio]));
  const c = await calc(u.encargado);
  assert.equal(Number(c.total), 56000); assert.equal(c.puede_registrar, true); assert.equal(c.dado_de_baja, true);
  const [v] = await t.q(`select v.estado, p.estado as pago from public.ventas v join public.pagos p on p.venta_id = v.id where v.id = $1`, [venta]);
  assert.deepEqual([v.estado, v.pago], ["confirmada", "aprobado"]);
  await intento(u.recepcion, "efectivo", 1000, "Quiero devolver", /Sin permiso/);
});

test("registrar: motivo y tope; en efectivo sale de la caja abierta como retiro y baja lo esperado", async () => {
  await intento(u.encargado, "efectivo", 50000, "x", /motivo/);
  await intento(u.encargado, "efectivo", 60000, "Se mudó y pidió que le devolvamos", /más de lo calculado/);
  await intento(u.encargado, "ninguno", 100, "No se devuelve pero puse monto", /No se devuelve/);
  await intento(u.encargado, "efectivo", 0, "Cero en efectivo", /No se devuelve/);
  await intento(u.encargado, "bitcoin", 100, "Medio raro", /cómo se devuelve/);
  await intento(u.encargado, "efectivo", 50000, "Se mudó y pidió que le devolvamos", /abrí tu caja/);
  turno = await como(u.encargado, async () => (await t.q(`select public.abrir_caja($1, 10000) as id`, [caja]))[0].id);
  const antes = (await t.q(`select privado.resumen_turno($1) as r`, [turno]))[0].r;
  assert.equal(Number(antes.esperado), 10000);
  const r = await registrar(u.encargado, "efectivo", 50000, "Se mudó y pidió que le devolvamos");
  assert.equal(Number(r.monto), 50000); assert.equal(Number(r.calculado), 56000);
  const despues = (await t.q(`select privado.resumen_turno($1) as r`, [turno]))[0].r;
  assert.equal(Number(despues.retiros), 50000); assert.equal(Number(despues.esperado), -40000, "la devolución en efectivo baja lo esperado del cierre");
  const [m] = await t.q(`select tipo, monto, motivo, creado_por from public.movimientos_caja where id = $1`, [r.movimiento_caja_id]);
  assert.equal(m.tipo, "retiro"); assert.equal(Number(m.monto), 50000); assert.equal(m.creado_por, eq.encargado);
  assert.match(m.motivo, /^Devolución de baja BAJA-[0-9A-F]{8} a Devo Adelantada: Se mudó/);
  const [d] = await t.q(`select medio, monto, monto_calculado, motivo, creado_por from public.devoluciones where id = $1`, [r.devolucion_id]);
  assert.deepEqual([d.medio, Number(d.monto), Number(d.monto_calculado), d.creado_por], ["efectivo", 50000, 56000, eq.encargado]);
  assert.equal((await t.q(`select count(*)::int n from public.devoluciones_items where devolucion_id = $1`, [r.devolucion_id]))[0].n, 2);
  // Un hecho no se edita ni se borra, y cada período se devuelve una sola vez.
  await t.falla(() => t.q(`update public.devoluciones set monto = 1 where id = $1`, [r.devolucion_id]), /solo se puede cambiar/);
  await t.falla(() => t.q(`delete from public.devoluciones where id = $1`, [r.devolucion_id]), /no se borran/);
  await intento(u.encargado, "efectivo", 100, "Otra vez", /No hay nada para devolver/);
  const c = await calc(u.dueno);
  assert.equal(c.hay, false); assert.equal(Number(c.total), 0);
  // El pago original sigue como estaba.
  const [v] = await t.q(`select v.estado, p.estado as pago, p.monto from public.ventas v join public.pagos p on p.venta_id = v.id where v.id = $1`, [venta]);
  assert.deepEqual([v.estado, v.pago, Number(v.monto)], ["confirmada", "aprobado", 84000]);
});

test("Control lista la devolución con quién, cuánto y por qué; la campana avisa la que falta decidir; “no se devuelve” se asienta con motivo", async () => {
  const c = await como(u.dueno, async () => (await t.q(`select public.moderacion_control($1, (now() at time zone 'UTC')::date - 3, (now() at time zone 'UTC')::date + 1) as r`, [t.g]))[0].r);
  const dev = c.items.find((i) => i.tipo === "devolucion");
  assert.ok(dev, "la devolución está en Control");
  assert.equal(dev.quien, "Martín"); assert.equal(Number(dev.monto), 50000); assert.match(dev.detalle, /En efectivo · Se mudó/); assert.match(dev.detalle, /calculado/);
  assert.ok(c.items.some((i) => i.tipo === "baja" && /BAJA-/.test(i.detalle)));

  // Otra socia: pagó por adelantado, se va, y nadie decidió todavía.
  const [{ id: s2 }] = await t.q(`insert into public.socios (gimnasio_id, nombre, apellido) values ($1, 'Devo', 'Pendiente') returning id`, [t.g]);
  const [{ id: su2 }] = await t.q(`insert into public.suscripciones (gimnasio_id, socio_id, plan_id, inicio) values ($1,$2,$3, now() - interval '5 days') returning id`, [t.g, s2, t.ctx.planes.full]);
  const [{ id: v2 }] = await t.q(`insert into public.ventas (gimnasio_id, sede_id, socio_id, estado, origen, confirmada_en, creado_por) values ($1,$2,$3,'confirmada','recepcion', now(), $4) returning id`, [t.g, t.sede, s2, eq.recepcion]);
  const [{ id: i2 }] = await t.q(`insert into public.venta_items (gimnasio_id, venta_id, tipo, plan_id, suscripcion_id, descripcion, cantidad, precio_unitario) values ($1,$2,'cuota',$3,$4,'Cuota Full',2,25000) returning id`, [t.g, v2, t.ctx.planes.full, su2]);
  await t.q(`insert into public.pagos (gimnasio_id, venta_id, medio, monto, estado, aprobado_en) values ($1,$2,'transferencia',50000,'aprobado', now())`, [t.g, v2]);
  await t.q(`insert into public.coberturas (gimnasio_id, suscripcion_id, socio_id, desde, hasta, origen, venta_item_id)
    select $1, $2, $3, privado.medianoche(privado.dia_local(now(), g.zona_horaria) + 5, g.zona_horaria), privado.medianoche(privado.dia_local(now(), g.zona_horaria) + 35, g.zona_horaria), 'pago', $4
      from public.gimnasios g where g.id = $1`, [t.g, su2, s2, i2]);
  await como(u.dueno, () => t.q(`select public.dar_de_baja($1, 'precio')`, [s2]));
  const avisos = async () => (await como(u.dueno, async () => (await t.q(`select public.campana_control($1) as r`, [t.g]))[0].r)).items.filter((i) => /^devolucion_pendiente:/.test(i.clave));
  const a = await avisos();
  assert.equal(a.length, 1); assert.match(a[0].titulo, /Hay que decidir la devolución a Devo Pendiente: \$25\.000/);
  socio = s2;
  await intento(u.dueno, "ninguno", 0, " ", /motivo/);
  const r = await registrar(u.dueno, "ninguno", 0, "Pidió quedarse con los días como crédito");
  assert.equal(r.medio, "ninguno"); assert.equal(Number(r.monto), 0); assert.equal(r.movimiento_caja_id, null);
  assert.equal((await avisos()).length, 0, "ya se decidió: el aviso se va");
});
