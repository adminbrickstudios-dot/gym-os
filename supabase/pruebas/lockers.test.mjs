// VD-55 (5500): lockers. El alquiler se cobra con Vender (tarifa = producto con locker_meses); el estado se calcula (libre / ocupado /
// vencido); un locker no va a dos socios a la vez; un cobro paga un solo alquiler; sin cobro sólo dueño/encargado, con motivo.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir } from "./_comun.mjs";

let t, uDueno, uEnc, uRec, uProfe, tarifa, socioA, socioB, sedeId;
async function como(u, fn) {
  await t.db.query("savepoint co");
  await t.db.query("set role authenticated");
  await t.q(`select set_config('request.jwt.claims', $1, false)`, [JSON.stringify({ sub: u, role: "authenticated" })]);
  try {
    const r = await fn();
    await t.db.query("reset role");
    await t.q(`select set_config('request.jwt.claims', '', false)`);
    await t.db.query("release savepoint co");
    return r;
  } catch (e) {
    await t.db.query("rollback to savepoint co");
    throw e;
  }
}
before(async () => {
  t = await abrir("prueba-lockers");
  for (const rol of ["dueno", "encargado", "recepcion", "profe"]) {
    const [{ id }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`${rol}${Math.random()}@ejemplo.invalid`]);
    await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,$3,$4)`, [t.g, id, rol, rol]);
    if (rol === "dueno") uDueno = id; else if (rol === "encargado") uEnc = id; else if (rol === "recepcion") uRec = id; else uProfe = id;
  }
  sedeId = t.sede;
  socioA = t.ctx.socios.al_dia; socioB = t.ctx.socios.vencida;
  [{ r: tarifa }] = await como(uDueno, () => t.q(`select public.guardar_tarifa_locker($1, null, 'Locker mensual', 4500, 1) as r`, [t.g]));
});
after(async () => t && t.cerrar());

const nuevoLocker = async (num) => (await como(uDueno, () => t.q(`select public.crear_locker($1, $2, $3, 'Vestuario') as id`, [t.g, sedeId, num])))[0].id;
// Cobra N meses de locker por Vender (con la transferencia) y devuelve la línea de venta.
async function cobrar(socio, cantidad = 1, quien = uRec) {
  const r = await como(quien, () => t.q(`select public.vender($1, $2, $3, $4, null) as r`,
    [t.sede, JSON.stringify([{ tipo: "producto", producto_id: tarifa, cantidad }]), JSON.stringify([{ medio: "transferencia", monto: 4500 * cantidad }]), socio]));
  const [{ id }] = await t.q(`select id from public.venta_items where venta_id = $1`, [r[0].r.venta_id]);
  return id;
}
const panel = async (u = uDueno) => (await como(u, () => t.q(`select public.lockers_panel($1) as r`, [t.g])))[0].r;
const estadoDe = async (id) => (await panel()).lockers.find((l) => l.locker_id === id);

test("la tarifa es un producto del mostrador: el precio lo pone el sistema; sólo dueño y encargado la guardan", async () => {
  const [p] = await t.q(`select precio, locker_meses, recurrente, controla_stock from public.productos where id = $1`, [tarifa]);
  assert.equal(Number(p.precio), 4500); assert.equal(p.locker_meses, 1); assert.equal(p.recurrente, false);
  await como(uRec, () => t.falla(() => t.q(`select public.guardar_tarifa_locker($1, null, 'x', 100, 1)`, [t.g]), /Sin permiso/));
  await como(uEnc, () => t.falla(() => t.q(`select public.guardar_tarifa_locker($1, null, 'x', 0, 1)`, [t.g]), /mayor a cero/));
  await como(uEnc, () => t.falla(() => t.q(`select public.guardar_tarifa_locker($1, null, 'x', 100, 13)`, [t.g]), /1 a 12 meses/));
  await como(uEnc, () => t.q(`select public.guardar_tarifa_locker($1, $2, 'Locker mensual', 5000, 1, true)`, [t.g, tarifa]));
  await como(uEnc, () => t.q(`select public.guardar_tarifa_locker($1, $2, 'Locker mensual', 4500, 1, true)`, [t.g, tarifa]));
  // Un producto común no se edita por acá.
  const [{ id: comun }] = await t.q(`insert into public.productos (gimnasio_id, nombre, precio) values ($1, 'Agua', 100) returning id`, [t.g]);
  await como(uEnc, () => t.falla(() => t.q(`select public.guardar_tarifa_locker($1, $2, 'Agua', 100, 1)`, [t.g, comun]), /Sin permiso o tarifa/));
});

test("alta de lockers: uno, una tanda y sin repetir; sólo dueño y encargado", async () => {
  await como(uRec, () => t.falla(() => t.q(`select public.crear_locker($1, $2, '1')`, [t.g, sedeId]), /Sin permiso/));
  await como(uProfe, () => t.falla(() => t.q(`select public.lockers_panel($1)`, [t.g]), /Sin permiso/));
  await nuevoLocker("A1");
  await como(uDueno, () => t.falla(() => t.q(`select public.crear_locker($1, $2, 'a1')`, [t.g, sedeId]), /Ya hay un locker/));
  const [{ n }] = await como(uEnc, () => t.q(`select public.crear_lockers_serie($1, $2, 1, 5, 'B-') as n`, [t.g, sedeId]));
  assert.equal(n, 5);
  const [{ n: otra }] = await como(uEnc, () => t.q(`select public.crear_lockers_serie($1, $2, 3, 7, 'B-') as n`, [t.g, sedeId]));
  assert.equal(otra, 2);   // B-3..B-5 ya estaban
  await como(uEnc, () => t.falla(() => t.q(`select public.crear_lockers_serie($1, $2, 1, 400)`, [t.g, sedeId]), /300/));
});

test("cobrar y asignar: estado ocupado con vencimiento a la medianoche local; el precio sale del cobro", async () => {
  const l = await nuevoLocker("C1");
  assert.equal((await estadoDe(l)).estado, "libre");
  const item = await cobrar(socioA);
  const pend = (await panel()).por_asignar.find((x) => x.venta_item_id === item);
  assert.ok(pend, "el cobro aparece como alquiler por asignar");
  assert.equal(pend.meses, 1);
  await como(uRec, () => t.q(`select public.alquilar_locker($1, $2, $3)`, [l, socioA, item]));
  const e = await estadoDe(l);
  assert.equal(e.estado, "ocupado");
  assert.equal(e.alquiler.socio_id, socioA);
  assert.equal(e.alquiler.cortesia, false);
  const [{ ok }] = await t.q(`select (hasta = privado.medianoche((privado.dia_local(desde, $2) + interval '1 month')::date, $2)) as ok from public.alquileres_locker where locker_id = $1`, [l, t.ctx.zona]);
  assert.equal(ok, true);
  assert.equal((await panel()).por_asignar.some((x) => x.venta_item_id === item), false);
  // El socio lo ve en su app.
  const m = (await como(uRec, () => t.q(`select public.mi_locker($1) as r`, [socioA])))[0].r;
  assert.equal(m.lockers[0].numero, "C1");
});

test("un locker no va a dos socios a la vez (también por la base, sin pasar por la función)", async () => {
  const l = await nuevoLocker("D1");
  const i1 = await cobrar(socioA), i2 = await cobrar(socioB);
  await como(uRec, () => t.q(`select public.alquilar_locker($1, $2, $3)`, [l, socioA, i1]));
  await como(uRec, () => t.falla(() => t.q(`select public.alquilar_locker($1, $2, $3)`, [l, socioB, i2]), /ya está alquilado/));
  await t.falla(() => t.q(`insert into public.alquileres_locker (gimnasio_id, locker_id, socio_id, desde, hasta, cortesia_motivo, creado_por)
    select $1, $2, $3, now(), now() + interval '1 day', 'prueba', id from public.equipo where gimnasio_id = $1 limit 1`, [t.g, l, socioB]), /alquileres_locker_uno_abierto|duplicate/);
});

test("un cobro paga un solo alquiler; tiene que ser de ese socio y no estar anulado", async () => {
  const l1 = await nuevoLocker("E1"), l2 = await nuevoLocker("E2");
  const item = await cobrar(socioA);
  await como(uRec, () => t.falla(() => t.q(`select public.alquilar_locker($1, $2, $3)`, [l1, socioB, item]), /de otro socio/));
  await como(uRec, () => t.q(`select public.alquilar_locker($1, $2, $3)`, [l1, socioA, item]));
  await como(uRec, () => t.falla(() => t.q(`select public.alquilar_locker($1, $2, $3)`, [l2, socioA, item]), /ya se usó/));
  // Carrera: dos asignaciones del mismo cobro a lockers distintos no pasan las dos (índice único sobre venta_item_id).
  await t.falla(() => t.q(`insert into public.alquileres_locker (gimnasio_id, locker_id, socio_id, desde, hasta, venta_item_id, creado_por)
    select $1, $2, $3, now(), now() + interval '1 day', $4, id from public.equipo where gimnasio_id = $1 limit 1`, [t.g, l2, socioA, item]), /alquileres_locker_item_unico|duplicate/);
  // Un cobro de otra cosa no sirve.
  const [{ id: agua }] = await t.q(`insert into public.productos (gimnasio_id, nombre, precio) values ($1, 'Agua L', 100) returning id`, [t.g]);
  const r = await como(uRec, () => t.q(`select public.vender($1, $2, $3, $4, null) as r`, [t.sede, JSON.stringify([{ tipo: "producto", producto_id: agua, cantidad: 1 }]), JSON.stringify([{ medio: "transferencia", monto: 100 }]), socioA]));
  const [{ id: itemAgua }] = await t.q(`select id from public.venta_items where venta_id = $1`, [r[0].r.venta_id]);
  await como(uRec, () => t.falla(() => t.q(`select public.alquilar_locker($1, $2, $3)`, [l2, socioA, itemAgua]), /no es un alquiler de locker/));
  // Anulada la venta, ya no vale.
  const item2 = await cobrar(socioA);
  const [{ venta_id }] = await t.q(`select venta_id from public.venta_items where id = $1`, [item2]);
  await t.q(`update public.ventas set estado = 'anulada', anulada_en = now(), anulada_motivo = 'prueba', anulada_por = (select id from public.equipo where gimnasio_id = $2 limit 1) where id = $1`, [venta_id, t.g]);
  await como(uRec, () => t.falla(() => t.q(`select public.alquilar_locker($1, $2, $3)`, [l2, socioA, item2]), /no está confirmado/));
});

test("sin cobro (cortesía): sólo dueño y encargado, con motivo y de 1 a 12 meses", async () => {
  const l = await nuevoLocker("F1");
  await como(uRec, () => t.falla(() => t.q(`select public.alquilar_locker($1, $2, null, 1, 'amigo')`, [l, socioA]), /cobralo primero/));
  await como(uEnc, () => t.falla(() => t.q(`select public.alquilar_locker($1, $2, null, 1, null)`, [l, socioA]), /necesita un motivo/));
  await como(uEnc, () => t.falla(() => t.q(`select public.alquilar_locker($1, $2, null, 24, 'regalo')`, [l, socioA]), /1 a 12 meses/));
  await como(uEnc, () => t.q(`select public.alquilar_locker($1, $2, null, 2, 'Regalo por 5 años de socio')`, [l, socioA]));
  const e = await estadoDe(l);
  assert.equal(e.alquiler.cortesia, true);
  assert.equal(e.alquiler.cortesia_motivo, "Regalo por 5 años de socio");
});

test("vencido: sigue ocupando el locker hasta que se libera; liberar pide motivo y deja el historial", async () => {
  const l = await nuevoLocker("G1");
  await como(uDueno, () => t.q(`select public.alquilar_locker($1, $2, null, 1, 'prueba vencido')`, [l, socioA]));
  // Se vence "a mano" (como si hubiera pasado el mes): sólo se puede por la base, no por las funciones.
  await t.db.query("alter table public.alquileres_locker disable trigger alquiler_locker_inmutable");
  await t.q(`update public.alquileres_locker set desde = now() - interval '40 days', hasta = now() - interval '2 days' where locker_id = $1`, [l]);
  await t.db.query("alter table public.alquileres_locker enable trigger alquiler_locker_inmutable");
  assert.equal((await estadoDe(l)).estado, "vencido");
  const v = (await como(uRec, () => t.q(`select public.lockers_vencen_semana($1) as r`, [t.g])))[0].r;
  assert.ok(v.some((x) => x.locker === "G1" && x.vencido === true));
  await como(uRec, () => t.falla(() => t.q(`select public.alquilar_locker($1, $2, null, 1, 'x')`, [l, socioB]), /ya está alquilado|cobralo primero/));
  await como(uRec, () => t.falla(() => t.q(`select public.liberar_locker($1, 'ok')`, [l]), /por qué se libera/));
  await como(uRec, () => t.q(`select public.liberar_locker($1, 'Devolvió la llave')`, [l]));
  assert.equal((await estadoDe(l)).estado, "libre");
  await como(uRec, () => t.falla(() => t.q(`select public.liberar_locker($1, 'Devolvió la llave')`, [l]), /no está alquilado/));
  const [h] = await t.q(`select liberado_motivo, liberado_por is not null as quien from public.alquileres_locker where locker_id = $1`, [l]);
  assert.equal(h.liberado_motivo, "Devolvió la llave"); assert.equal(h.quien, true);
  // Historia: no se borra ni se reescribe.
  await t.falla(() => t.q(`delete from public.alquileres_locker where locker_id = $1`, [l]), /no se borran/);
  await t.falla(() => t.q(`update public.alquileres_locker set socio_id = $2 where locker_id = $1`, [l, socioB]), /sólo se completa la liberación/);
  // Y el locker libre se puede asignar a otro.
  await como(uDueno, () => t.q(`select public.alquilar_locker($1, $2, null, 1, 'nuevo socio')`, [l, socioB]));
});

test("renovar: sin vencer continúa donde termina; vencido arranca hoy; el anterior queda cerrado por renovación", async () => {
  const l = await nuevoLocker("H1");
  const a = (await como(uDueno, () => t.q(`select public.alquilar_locker($1, $2, null, 1, 'primera') as id`, [l, socioA])))[0].id;
  const [{ hasta: h1 }] = await t.q(`select hasta from public.alquileres_locker where id = $1`, [a]);
  const item = await cobrar(socioA, 2);
  const nuevo = (await como(uRec, () => t.q(`select public.renovar_alquiler_locker($1, $2) as id`, [a, item])))[0].id;
  const [n] = await t.q(`select desde, hasta from public.alquileres_locker where id = $1`, [nuevo]);
  assert.equal(new Date(n.desde).getTime(), new Date(h1).getTime());
  assert.ok(new Date(n.hasta) > new Date(n.desde));
  const [ant] = await t.q(`select liberado_motivo from public.alquileres_locker where id = $1`, [a]);
  assert.equal(ant.liberado_motivo, "Renovación");
  assert.equal((await estadoDe(l)).alquiler.alquiler_id, nuevo);
  await como(uRec, () => t.falla(() => t.q(`select public.renovar_alquiler_locker($1, $2)`, [a, item]), /ya terminó/));
});

test("una tarifa ya vendida no cambia de duración (lo pagado es lo que se da); el precio sí puede cambiar", async () => {
  const [{ id: nueva }] = await t.q(`insert into public.productos (gimnasio_id, nombre, precio, locker_meses) values ($1, 'Locker prueba', 1000, 3) returning id`, [t.g]);
  await t.q(`update public.productos set locker_meses = 6 where id = $1`, [nueva]);          // sin ventas todavía: se puede
  await como(uRec, () => t.q(`select public.vender($1, $2, $3, $4, null)`,
    [t.sede, JSON.stringify([{ tipo: "producto", producto_id: nueva, cantidad: 1 }]), JSON.stringify([{ medio: "transferencia", monto: 1000 }]), socioA]));
  await t.falla(() => t.q(`update public.productos set locker_meses = 1 where id = $1`, [nueva]), /ya se vendió/);
  await como(uEnc, () => t.falla(() => t.q(`select public.guardar_tarifa_locker($1, $2, 'Locker prueba', 1200, 2)`, [t.g, nueva]), /ya se vendió/));
  await como(uEnc, () => t.q(`select public.guardar_tarifa_locker($1, $2, 'Locker prueba', 1200, 6)`, [t.g, nueva]));
});

test("baja de un locker: no si está alquilado; la sección apagada es un error, no una lista vacía", async () => {
  const l = await nuevoLocker("I1");
  await como(uDueno, () => t.q(`select public.alquilar_locker($1, $2, null, 1, 'prueba')`, [l, socioA]));
  await como(uDueno, () => t.falla(() => t.q(`select public.dar_de_baja_locker($1, false)`, [l]), /liberalo antes/));
  await como(uDueno, () => t.q(`select public.liberar_locker($1, 'Fin de la prueba')`, [l]));
  await como(uRec, () => t.falla(() => t.q(`select public.dar_de_baja_locker($1, false)`, [l]), /Sin permiso/));
  await como(uEnc, () => t.q(`select public.dar_de_baja_locker($1, false)`, [l]));
  await como(uDueno, () => t.falla(() => t.q(`select public.alquilar_locker($1, $2, null, 1, 'x')`, [l, socioA]), /dado de baja/));
  const [{ id: forastero }] = await t.q(`insert into auth.users (email) values ('fuera@ejemplo.invalid') returning id`);
  await como(forastero, () => t.falla(() => t.q(`select public.lockers_panel($1)`, [t.g]), /Sin permiso/));
  await t.q(`update public.configuracion_gimnasio set secciones_apagadas = array['lockers'] where gimnasio_id = $1`, [t.g]);
  await como(uDueno, () => t.falla(() => t.q(`select public.lockers_panel($1)`, [t.g]), /apagados/));
  assert.deepEqual((await como(uDueno, () => t.q(`select public.lockers_vencen_semana($1) as r`, [t.g])))[0].r, []);
  assert.equal((await como(uRec, () => t.q(`select public.mi_locker($1) as r`, [socioA])))[0].r.prendido, false);
});
