// EQU-3 (0102): qué hizo cada uno en el día, calculado de los hechos:
// ventas, descuentos, anulaciones, dejados pasar, entradas y cierres de caja
// con su diferencia; y la lista de lo que conviene mirar. Lo ve el dueño, el
// encargado si ve el Resultado, la recepción no.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir } from "./_comun.mjs";

let t, u = {}, eq = {}, caja, agua;
async function como(usuario, fn) {
  await t.db.query("set role authenticated");
  await t.q(`select set_config('request.jwt.claims', $1, false)`, [JSON.stringify({ sub: usuario, role: "authenticated" })]);
  try { return await fn(); } finally { await t.db.query("reset role"); await t.q(`select set_config('request.jwt.claims', '', false)`); }
}
before(async () => {
  t = await abrir("prueba-actividad-equipo");
  for (const [rol, nombre] of [["dueno", "Sofía"], ["encargado", "Enzo"], ["recepcion", "Ana"]]) {
    const [{ id }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`${rol}${Math.random()}@ejemplo.invalid`]);
    const [{ id: e }] = await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,$3,$4) returning id`, [t.g, id, nombre, rol]);
    u[rol] = id; eq[rol] = e;
  }
  [{ id: caja }] = await t.q(`insert into public.cajas (gimnasio_id, sede_id, nombre) values ($1,$2,'Recepción') returning id`, [t.g, t.sede]);
  [{ id: agua }] = await t.q(`insert into public.productos (gimnasio_id, nombre, precio) values ($1,'Agua',1000) returning id`, [t.g]);
});
after(async () => t && t.cerrar());

test("el día de cada uno y lo que hay que mirar", async () => {
  let venta;
  await como(u.recepcion, async () => {
    const [{ id: turno }] = await t.q(`select public.abrir_caja($1, 1000) as id`, [caja]);
    await t.q(`select public.vender($1, $2, $3, null, $4)`, [t.sede, JSON.stringify([{ tipo: "producto", producto_id: agua, cantidad: 2, descuento: 100, descuento_motivo: "Cliente fiel" }]),
      JSON.stringify([{ medio: "efectivo", monto: 1900 }]), turno]);
    [{ r: venta }] = await t.q(`select public.vender($1, $2, $3, null, $4) as r`, [t.sede, JSON.stringify([{ tipo: "producto", producto_id: agua }]), JSON.stringify([{ medio: "efectivo", monto: 1000 }]), turno]);
    u.turno = turno;
  });
  // La anulación devuelve el efectivo de la caja abierta: esperado 1000 + 1900 + 1000 − 1000 = 2900.
  await como(u.encargado, () => t.q(`select public.anular_venta_panel($1, 'Se equivocó de producto')`, [venta.venta_id]));
  await como(u.recepcion, () => t.q(`select public.cerrar_caja($1, 2800, 'Faltan 100')`, [u.turno]));
  const [{ id: socio }] = await t.q(`select id from public.socios where gimnasio_id = $1 limit 1`, [t.g]);
  await t.q(`insert into public.ingresos (gimnasio_id, sede_id, socio_id, momento, via_acceso, resultado, via_habilitante, color, motivo, texto, forzado_motivo, registrado_por)
    values ($1,$2,$3, now(), 'recepcion', 'forzado', null, 'rojo', 'vencido', 'x', 'Paga mañana', $4)`, [t.g, t.sede, socio, eq.recepcion]);

  const [{ a }] = await como(u.dueno, () => t.q(`select public.actividad_equipo($1) a`, [t.g]));
  const ana = a.personas.find((p) => p.nombre === "Ana");
  assert.equal(ana.ventas, 1, "la anulada no cuenta como venta");
  assert.equal(Number(ana.vendido), 1900); assert.equal(Number(ana.descuentos), 100);
  assert.equal(ana.dejados_pasar, 1); assert.equal(ana.cierres, 1); assert.equal(Number(ana.diferencia_caja), -100);
  assert.equal(a.personas.find((p) => p.nombre === "Enzo").anulaciones, 1);
  assert.ok(!a.personas.some((p) => p.nombre === "Sofía"), "quien no hizo nada no aparece");
  assert.deepEqual(a.para_mirar.map((m) => m.tipo).sort(), ["anulacion", "caja", "dejo_pasar", "descuento"]);
});

test("la recepción no lo ve; el encargado, si ve el Resultado", async () => {
  await como(u.recepcion, () => t.falla(() => t.q(`select public.actividad_equipo($1)`, [t.g]), /permiso|rol|acceso/i));
  await como(u.encargado, () => t.q(`select public.actividad_equipo($1)`, [t.g]));
  await t.q(`update public.configuracion_gimnasio set encargado_ve_resultado = false where gimnasio_id = $1`, [t.g]);
  await como(u.encargado, () => t.falla(() => t.q(`select public.actividad_equipo($1)`, [t.g]), /no le dio acceso/));
  await como(u.dueno, () => t.falla(() => t.q(`select public.actividad_equipo($1, current_date + 3)`, [t.g]), /todavía no pasó/));
});
