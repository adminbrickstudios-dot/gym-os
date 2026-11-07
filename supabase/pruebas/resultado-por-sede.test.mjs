// VD-46P · Resultado por sede (0074.2): dónde se cobró, dónde se usó y cómo se reparte la parte de
// servicio entre las sedes en proporción a las entradas; el total repartido es igual al cobrado;
// solo dueño y encargado.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir } from "./_comun.mjs";

let t, u = {}, sedeB;
async function persona(rol) {
  const [{ id }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`${rol}${Math.random()}@ejemplo.invalid`]);
  await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,$3,$4)`, [t.g, id, `P ${rol}`, rol]);
  return id;
}
async function como(usuario, fn) {
  await t.db.query("set role authenticated");
  await t.q(`select set_config('request.jwt.claims', $1, false)`, [JSON.stringify({ sub: usuario, role: "authenticated" })]);
  try { return await fn(); } finally { await t.db.query("reset role"); await t.q(`select set_config('request.jwt.claims', '', false)`); }
}
async function cobro(sede, socio, cuando, tipo, plan, monto) {
  const susc = tipo === "cuota" ? (await t.q(`insert into public.suscripciones (gimnasio_id, socio_id, plan_id, inicio) values ($1,$2,$3,$4) returning id`, [t.g, socio, plan, cuando]))[0].id : null;
  const [{ id: v }] = await t.q(`insert into public.ventas (gimnasio_id, sede_id, socio_id, origen, estado, confirmada_en, creado_en) values ($1,$2,$3,'recepcion','confirmada',$4,$4) returning id`, [t.g, sede, socio, cuando]);
  await t.q(`insert into public.venta_items (gimnasio_id, venta_id, tipo, plan_id, descripcion, cantidad, precio_unitario, suscripcion_id) values ($1,$2,$3,$4,'x',1,$5,$6)`, [t.g, v, tipo, plan, monto, susc]);
  await t.q(`insert into public.pagos (gimnasio_id, venta_id, medio, monto, estado, aprobado_en, creado_en) values ($1,$2,'transferencia',$3,'aprobado',$4,$4)`, [t.g, v, monto, cuando]);
}
async function entrada(sede, socio, cuando) {
  await t.q(`insert into public.ingresos (gimnasio_id, sede_id, socio_id, momento, via_acceso, resultado, via_habilitante, color, motivo, texto)
    values ($1,$2,$3,$4,'recepcion','entro','membresia','verde','membresia','Entra')`, [t.g, sede, socio, cuando]);
}
const socio = async (n) => (await t.q(`insert into public.socios (gimnasio_id, nombre, apellido) values ($1,$2,'Sede') returning id`, [t.g, n]))[0].id;

before(async () => {
  t = await abrir("prueba-por-sede");
  u.dueno = await persona("dueno"); u.recepcion = await persona("recepcion");
  sedeB = (await t.q(`insert into public.sedes (gimnasio_id, nombre) values ($1,'Sede B') returning id`, [t.g]))[0].id;
  const mem = (await t.q(`insert into public.planes (gimnasio_id, tipo, nombre, duracion_meses, renovacion) values ($1,'membresia','Mensual sede',1,'continua') returning id`, [t.g]))[0].id;
  const pk = (await t.q(`insert into public.planes (gimnasio_id, tipo, nombre, cantidad_clases, consume_en) values ($1,'pack','Pack sede',10,'ingreso') returning id`, [t.g]))[0].id;
  const [x, y, z] = [await socio("Equis"), await socio("Ye"), await socio("Zeta")];
  const mar = (d, h = "10:00:00") => t.en(`2026-03-${d}`, h);
  // X paga $30.000 de cuota en la sede principal y entrena 3 veces ahí y 1 en la B.
  await cobro(t.sede, x, await mar("02"), "cuota", mem, 30000);
  for (const d of ["03", "04", "05"]) await entrada(t.sede, x, await mar(d, "18:00:00"));
  await entrada(sedeB, x, await mar("06", "18:00:00"));
  // Y compra algo que no es servicio en la B: se queda ahí. Z paga un pack en la B y no entró en el mes: se queda ahí.
  await cobro(sedeB, y, await mar("07"), "otro", null, 5000);
  await entrada(t.sede, y, await mar("08", "18:00:00"));
  await cobro(sedeB, z, await mar("09"), "pack", pk, 10000);
});
after(async () => t && t.cerrar());

test("cobrado por sede, entradas por sede y el reparto por uso; el total no cambia", async () => {
  const r = await como(u.dueno, async () => (await t.q(`select public.resultado_por_sede($1, '2026-03-01') as r`, [t.g]))[0].r);
  const A = r.sedes.find((s) => s.sede_id === t.sede), B = r.sedes.find((s) => s.sede_id === sedeB);
  assert.equal(Number(A.cobrado), 30000); assert.equal(Number(B.cobrado), 15000);
  assert.equal(A.entradas, 4); assert.equal(B.entradas, 1); assert.equal(A.socios, 2); assert.equal(B.socios, 1);
  // X: 30.000 × 3/4 en A y × 1/4 en B. Y (producto) y Z (sin entradas) se quedan en la B.
  assert.equal(Number(A.repartido), 22500); assert.equal(Number(B.repartido), 22500);
  assert.equal(Number(r.cobrado), 45000); assert.equal(Number(r.repartido), 45000);
  assert.equal(r.compartidos, 1);
});

test("un mes sin movimientos da ceros; uno que no empezó da error; la recepción no puede", async () => {
  const r = await como(u.dueno, async () => (await t.q(`select public.resultado_por_sede($1, '2026-01-01') as r`, [t.g]))[0].r);
  assert.equal(Number(r.cobrado), 0); assert.equal(Number(r.repartido), 0); assert.equal(r.sedes.length, 2);
  await como(u.dueno, () => t.falla(() => t.q(`select public.resultado_por_sede($1, '2999-01-01')`, [t.g]), /todavía no empezó/));
  await como(u.recepcion, () => t.falla(() => t.q(`select public.resultado_por_sede($1, '2026-03-01')`, [t.g]), /Sin permiso/));
});
