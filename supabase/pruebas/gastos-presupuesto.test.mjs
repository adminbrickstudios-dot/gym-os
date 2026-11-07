// VD-41 · Gastos y presupuesto (20261106004150): seis categorías, gastos fijos que
// aparecen todos los meses (se calculan, sin cron), presupuesto por categoría con su
// desvío, ganancia = ingresos - gastos, comprobante con su ruta, y permisos: la
// recepción no ve gastos (error, no lista vacía), el encargado solo si el dueño se lo
// prende, y un gimnasio no ve los gastos de otro.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir } from "./_comun.mjs";

let t, u = {}, g2;
async function persona(gimnasio, rol) {
  const [{ id }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`${rol}${Math.random()}@ejemplo.invalid`]);
  await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,$3,$4)`, [gimnasio, id, `P ${rol}`, rol]);
  return id;
}
async function como(usuario, fn) {
  await t.db.query("set role authenticated");
  await t.q(`select set_config('request.jwt.claims', $1, false)`, [JSON.stringify({ sub: usuario, role: "authenticated" })]);
  try { return await fn(); } finally { await t.db.query("reset role"); await t.q(`select set_config('request.jwt.claims', '', false)`); }
}
before(async () => {
  t = await abrir("prueba-gastos-presupuesto");
  [{ id: g2 }] = await t.q(`insert into public.gimnasios (slug, nombre) values ('otro-gimnasio-gastos', 'Otro gimnasio') returning id`);
  u.dueno = await persona(t.g, "dueno"); u.encargado = await persona(t.g, "encargado"); u.recepcion = await persona(t.g, "recepcion");
  u.dueno2 = await persona(g2, "dueno");
  const cuando = await t.en("2026-03-10", "10:00:00");
  const [{ id: v }] = await t.q(`insert into public.ventas (gimnasio_id, sede_id, origen, estado, confirmada_en, creado_en) values ($1,$2,'recepcion','confirmada',$3,$3) returning id`, [t.g, t.sede, cuando]);
  await t.q(`insert into public.pagos (gimnasio_id, venta_id, medio, monto, estado, aprobado_en, creado_en) values ($1,$2,'transferencia',500000,'aprobado',$3,$3)`, [t.g, v, cuando]);
});
after(async () => t && t.cerrar());
const mes = (usuario, gim, m) => como(usuario, async () => (await t.q(`select public.ganancia_mes($1, $2::date) as r`, [gim, m]))[0].r);

test("la recepción no ve ni carga nada de gastos: error, no una lista vacía", async () => {
  await como(u.dueno, () => t.q(`select public.cargar_gasto($1, '2026-03-12', 'alquiler', 'Local', 1000)`, [t.g]));
  await como(u.recepcion, async () => {
    await t.falla(() => t.q(`select public.ganancia_mes($1, '2026-03-01')`, [t.g]), /permiso/i);
    await t.falla(() => t.q(`select public.cargar_gasto($1, '2026-03-12', 'otros', null, 10)`, [t.g]), /permiso/i);
    await t.falla(() => t.q(`select public.guardar_gasto_fijo($1, 'otros', null, 10, '2026-03-01')`, [t.g]), /permiso/i);
    await t.falla(() => t.q(`select public.guardar_presupuesto_gasto($1, 'otros', 10)`, [t.g]), /permiso/i);
    await t.falla(() => t.q(`select public.exportar_gastos($1, '2026-03-01')`, [t.g]), /permiso/i);
  });
});

test("categorías nuevas, ganancia = ingresos - gastos y desvío contra el presupuesto", async () => {
  await como(u.dueno, async () => {
    await t.q(`select public.cargar_gasto($1, '2026-03-15', 'mantenimiento', 'Cinta', 30000)`, [t.g]);
    await t.q(`select public.cargar_gasto($1, '2026-03-20', 'proveedores', 'Agua', 5000.50)`, [t.g]);
    await t.falla(() => t.q(`select public.cargar_gasto($1, '2026-03-15', 'viajes', null, 10)`, [t.g]), /mantenimiento, proveedores/);
    await t.falla(() => t.q(`select public.cargar_gasto($1, '2026-03-15', 'otros', null, 0)`, [t.g]), /mayor a cero/);
    await t.q(`select public.guardar_presupuesto_gasto($1, 'mantenimiento', 20000)`, [t.g]);
    await t.q(`select public.guardar_presupuesto_gasto($1, 'servicios', 8000)`, [t.g]);
    await t.falla(() => t.q(`select public.guardar_presupuesto_gasto($1, 'viajes', 1)`, [t.g]), /categoría/);
  });
  let r = await mes(u.dueno, t.g, "2026-03-20");
  assert.equal(Number(r.ingresos), 500000);
  assert.equal(Number(r.total), 36000.5, "1000 del alquiler + 30000 + 5000,50");
  assert.equal(Number(r.ganancia), 500000 - 36000.5);
  assert.equal(r.por_categoria.length, 6);
  const mant = r.por_categoria.find((c) => c.categoria === "mantenimiento");
  assert.equal(Number(mant.gastado), 30000); assert.equal(Number(mant.presupuesto), 20000); assert.equal(Number(mant.desvio), 10000);
  const serv = r.por_categoria.find((c) => c.categoria === "servicios");
  assert.equal(Number(serv.desvio), -8000, "no gastó nada: todo el presupuesto es margen");
  assert.equal(r.por_categoria.find((c) => c.categoria === "otros").desvio, null, "sin presupuesto no hay desvío");
  // Monto 0 saca el presupuesto.
  await como(u.dueno, () => t.q(`select public.guardar_presupuesto_gasto($1, 'servicios', 0)`, [t.g]));
  r = await mes(u.dueno, t.g, "2026-03-01");
  assert.equal(r.por_categoria.find((c) => c.categoria === "servicios").presupuesto, null);
  assert.equal(Number(r.presupuesto_total), 20000);
  // El gasto cae en el mes de su día.
  const g = r.gastos.find((x) => x.detalle === "Cinta");
  assert.equal(g.fecha, "2026-03-15");
  assert.equal(Number((await mes(u.dueno, t.g, "2026-04-01")).total), 0);
});

test("un gasto fijo aparece todos los meses, sin cron, hasta que se termina", async () => {
  const fijo = await como(u.dueno, async () => (await t.q(`select public.guardar_gasto_fijo($1, 'alquiler', 'Local', 100000, '2026-03-17') as id`, [t.g]))[0].id);
  for (const m of ["2026-03-01", "2026-04-01", "2026-09-01", "2027-01-01"]) {
    const r = await mes(u.dueno, t.g, m);
    assert.equal(Number(r.total_fijos), 100000, `el fijo cuenta en ${m}`);
    assert.equal(r.fijos.length, 1);
    assert.equal(r.fijos[0].desde, "2026-03-01", "desde el primero del mes en que se cargó");
  }
  assert.equal(Number((await mes(u.dueno, t.g, "2026-02-01")).total_fijos), 0, "antes de empezar no cuenta");
  const marzo = await mes(u.dueno, t.g, "2026-03-01");
  assert.equal(Number(marzo.total), 36000.5 + 100000);
  assert.equal(Number(marzo.por_categoria.find((c) => c.categoria === "alquiler").gastado), 101000, "alquiler: fijo + gasto del día");
  // Dejar de repetir desde junio: marzo a mayo siguen igual.
  await como(u.dueno, () => t.q(`select public.terminar_gasto_fijo($1, '2026-06-15')`, [fijo]));
  assert.equal(Number((await mes(u.dueno, t.g, "2026-05-01")).total_fijos), 100000);
  assert.equal(Number((await mes(u.dueno, t.g, "2026-06-01")).total_fijos), 0);
  // Un fijo que se termina el mismo mes en que empieza se anula del todo.
  const otro = await como(u.dueno, async () => (await t.q(`select public.guardar_gasto_fijo($1, 'servicios', 'Prueba', 10, '2026-08-01') as id`, [t.g]))[0].id);
  await como(u.dueno, () => t.q(`select public.terminar_gasto_fijo($1, '2026-08-01')`, [otro]));
  const [{ n }] = await t.q(`select count(*)::int n from public.gastos_fijos where id = $1 and anulado_en is not null`, [otro]);
  assert.equal(n, 1, "queda anulado, no se borra");
  assert.equal(Number((await mes(u.dueno, t.g, "2026-08-01")).total_fijos), 0);
});

test("el encargado no ve gastos hasta que el dueño se lo prende; los fijos y el presupuesto siguen siendo del dueño", async () => {
  await como(u.encargado, () => t.falla(() => t.q(`select public.ganancia_mes($1, '2026-03-01')`, [t.g]), /no le dio acceso/i));
  await como(u.encargado, () => t.falla(() => t.q(`select public.cargar_gasto($1, '2026-03-01', 'otros', null, 10)`, [t.g]), /no le dio acceso/i));
  await como(u.encargado, () => t.falla(() => t.q(`select public.guardar_permiso_gastos($1, true)`, [t.g]), /permiso/i));
  await como(u.dueno, () => t.q(`select public.guardar_permiso_gastos($1, true)`, [t.g]));
  const r = await mes(u.encargado, t.g, "2026-04-01");
  assert.equal(r.es_dueno, false);
  assert.equal(r.fijos.length, 0, "la lista de fijos (sueldos) no se la muestra");
  assert.equal(Number(r.total_fijos), 100000, "pero entra en el total");
  const id = await como(u.encargado, async () => (await t.q(`select public.cargar_gasto($1, '2026-04-02', 'otros', 'Limpieza', 777) as id`, [t.g]))[0].id);
  await como(u.encargado, () => t.q(`select public.anular_gasto($1)`, [id]));
  await como(u.encargado, () => t.falla(() => t.q(`select public.guardar_gasto_fijo($1, 'otros', null, 10, '2026-03-01')`, [t.g]), /permiso/i));
  await como(u.encargado, () => t.falla(() => t.q(`select public.guardar_presupuesto_gasto($1, 'otros', 10)`, [t.g]), /permiso/i));
  const filas = await como(u.encargado, async () => (await t.q(`select public.exportar_gastos($1, '2026-03-01') as r`, [t.g]))[0].r);
  assert.ok(filas.length >= 3 && filas.every((f) => f.tipo === "Único"), "el CSV del encargado no trae los fijos");
  await como(u.dueno, () => t.q(`select public.guardar_permiso_gastos($1, false)`, [t.g]));
  await como(u.encargado, () => t.falla(() => t.q(`select public.ganancia_mes($1, '2026-03-01')`, [t.g]), /no le dio acceso/i));
});

test("exportar: los únicos y los fijos del mes, para el contador", async () => {
  const filas = await como(u.dueno, async () => (await t.q(`select public.exportar_gastos($1, '2026-04-10') as r`, [t.g]))[0].r);
  assert.equal(filas.length, 1);
  assert.equal(filas[0].tipo, "Fijo");
  assert.equal(Number(filas[0].monto), 100000);
});

test("el comprobante tiene su ruta, se confirma una vez y solo lo ve quien puede", async () => {
  const id = await como(u.dueno, async () => (await t.q(`select public.cargar_gasto($1, '2026-03-22', 'servicios', 'Luz', 4500) as id`, [t.g]))[0].id);
  const ruta = await como(u.dueno, async () => (await t.q(`select public.preparar_comprobante_gasto($1, 'jpg') as r`, [id]))[0].r);
  assert.match(ruta, new RegExp(`^${t.g}/${id}/comprobante-[0-9a-f]{32}\\.jpg$`));
  await como(u.dueno, () => t.falla(() => t.q(`select public.preparar_comprobante_gasto($1, 'exe')`, [id]), /JPG, PNG, WEBP o PDF/));
  await como(u.dueno, () => t.falla(() => t.q(`select public.confirmar_comprobante_gasto($1, $2)`, [id, `${g2}/${id}/comprobante-${"a".repeat(32)}.jpg`]), /inválida/));
  await como(u.dueno, () => t.q(`select public.confirmar_comprobante_gasto($1, $2)`, [id, ruta]));
  await como(u.dueno, () => t.falla(() => t.q(`select public.preparar_comprobante_gasto($1, 'png')`, [id]), /ya tiene su comprobante/));
  assert.equal(await como(u.dueno, async () => (await t.q(`select public.comprobante_gasto($1) as r`, [id]))[0].r), ruta);
  await como(u.recepcion, () => t.falla(() => t.q(`select public.comprobante_gasto($1)`, [id]), /permiso/i));
  const r = await mes(u.dueno, t.g, "2026-03-01");
  assert.equal(r.gastos.find((x) => x.gasto_id === id).comprobante, true);
});

test("un gimnasio no ve ni toca los gastos de otro", async () => {
  const r2 = await mes(u.dueno2, g2, "2026-03-01");
  assert.equal(Number(r2.total), 0); assert.equal(r2.gastos.length, 0); assert.equal(r2.fijos.length, 0);
  await como(u.dueno, () => t.falla(() => t.q(`select public.ganancia_mes($1, '2026-03-01')`, [g2]), /permiso/i));
  await como(u.dueno, () => t.falla(() => t.q(`select public.cargar_gasto($1, '2026-03-01', 'otros', null, 10)`, [g2]), /permiso/i));
  const [{ id: gasto }] = await t.q(`select id from public.gastos where gimnasio_id = $1 limit 1`, [t.g]);
  await como(u.dueno2, () => t.falla(() => t.q(`select public.anular_gasto($1)`, [gasto]), /permiso/i));
  const filas = await como(u.dueno2, async () => t.q(`select count(*)::int n from public.gastos_fijos where gimnasio_id = $1`, [t.g]));
  assert.equal(filas[0].n, 0, "RLS: las filas de otro gimnasio no existen");
});

test("lo viejo sigue andando: guardar_gasto sin día toma el primero del mes; la sección Gastos se puede apagar", async () => {
  await como(u.dueno, () => t.q(`select public.guardar_gasto($1, '2026-05-17', 'otros', 'Viejo', 50)`, [t.g]));
  const [{ fecha }] = await t.q(`select fecha::text from public.gastos where detalle = 'Viejo' and gimnasio_id = $1`, [t.g]);
  assert.equal(fecha, "2026-05-01");
  await t.q(`update public.configuracion_gimnasio set secciones_apagadas = array['gastos'] where gimnasio_id = $1`, [t.g]);
  const [{ s }] = await t.q(`select secciones_apagadas s from public.configuracion_gimnasio where gimnasio_id = $1`, [t.g]);
  assert.deepEqual(s, ["gastos"]);
});
