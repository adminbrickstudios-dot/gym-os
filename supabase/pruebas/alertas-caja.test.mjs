// Alertas de caja (0069): diferencia, retiro, anulación y descuento grande de
// otros, calculadas de los hechos; el ticket del retiro: ruta de la base, una
// sola vez, solo quien lo anotó; la recepción no ve alertas.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir } from "./_comun.mjs";

let t, uRec, uEnc, uDueno, caja, agua;
before(async () => {
  t = await abrir("prueba-alertas-caja");
  [{ id: caja }] = await t.q(`insert into public.cajas (gimnasio_id, sede_id, nombre) values ($1,$2,'Recepción') returning id`, [t.g, t.sede]);
  const crear = async (rol, n) => {
    const [{ id: u }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`${rol}${Math.random()}@ejemplo.invalid`]);
    await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,$3,$4)`, [t.g, u, n, rol]);
    return u;
  };
  uRec = await crear("recepcion", "Ana"); uEnc = await crear("encargado", "Enzo"); uDueno = await crear("dueno", "Sofía");
  [{ id: agua }] = await t.q(`insert into public.productos (gimnasio_id, nombre, precio) values ($1,'Agua',1000) returning id`, [t.g]);
});
after(async () => t && t.cerrar());
async function como(u, fn) {
  await t.db.query("set role authenticated");
  await t.q(`select set_config('request.jwt.claims', $1, false)`, [JSON.stringify({ sub: u, role: "authenticated" })]);
  try { return await fn(); } finally { await t.db.query("reset role"); await t.q(`select set_config('request.jwt.claims', '', false)`); }
}

test("las cuatro alertas, de otros; el ticket una sola vez", async () => {
  let mov;
  await como(uRec, async () => {
    const [{ id: turno }] = await t.q(`select public.abrir_caja($1, 1000) as id`, [caja]);
    [{ id: mov }] = await t.q(`select public.movimiento_caja($1, 'retiro', 300, 'Proveedor') as id`, [turno]);
    const ruta = (await t.q(`select public.preparar_ticket($1, 'jpg') as r`, [mov]))[0].r;
    assert.match(ruta, /\/ticket-[0-9a-f]{32}\.jpg$/);
    await t.q(`select public.confirmar_ticket($1, $2)`, [mov, ruta]);
    await t.falla(() => t.q(`select public.preparar_ticket($1, 'jpg')`, [mov]), /ya tiene su ticket/);
    await t.q(`select public.cerrar_caja($1, 500, null)`, [turno]);
    await t.falla(() => t.q(`select public.alertas_caja($1)`, [t.g]), /Sin permiso/);
  });
  // Descuento grande del encargado (sin tope) y una anulación del encargado.
  const [{ r }] = await como(uEnc, () => t.q(`select public.vender($1, $2, $3, null, null) as r`, [t.sede,
    JSON.stringify([{ tipo: "producto", producto_id: agua, descuento: 500, descuento_motivo: "Amigo o familiar del gimnasio" }]), JSON.stringify([{ medio: "transferencia", monto: 500 }])]));
  await como(uEnc, () => t.q(`select public.anular_venta_panel($1, 'Error')`, [r.venta_id]));
  const a = await como(uDueno, async () => (await t.q(`select public.alertas_caja($1) as a`, [t.g]))[0].a);
  const tipos = a.map((x) => x.tipo).sort();
  assert.deepEqual(tipos, ["anulacion", "diferencia", "retiro"]);   // el descuento era de una venta que después se anuló
  assert.equal(Number(a.find((x) => x.tipo === "diferencia").monto), -200);
  assert.equal(a.find((x) => x.tipo === "retiro").ticket, true);
  const ruta = await como(uDueno, async () => (await t.q(`select public.ticket_movimiento($1) as r`, [mov]))[0].r);
  assert.ok(ruta);
  // El encargado no ve lo que hizo él.
  const ae = await como(uEnc, async () => (await t.q(`select public.alertas_caja($1) as a`, [t.g]))[0].a);
  assert.ok(!ae.some((x) => x.tipo === "anulacion"));
  const [{ r: r2 }] = await como(uEnc, () => t.q(`select public.vender($1, $2, $3, null, null) as r`, [t.sede,
    JSON.stringify([{ tipo: "producto", producto_id: agua, descuento: 500, descuento_motivo: "Amigo o familiar del gimnasio" }]), JSON.stringify([{ medio: "transferencia", monto: 500 }])]));
  assert.ok(r2.venta_id);
  const a2 = await como(uDueno, async () => (await t.q(`select public.alertas_caja($1) as a`, [t.g]))[0].a);
  assert.equal(a2.find((x) => x.tipo === "descuento").porcentaje, 50);
});
