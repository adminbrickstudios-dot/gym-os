// Cuenta corriente (0067, D5): apagada no se fía; prendida, hasta el tope;
// la puerta lo deja entrar en amarillo con "Debe $X a cuenta"; la deuda se
// paga en Vender (no a cuenta); anular la vuelve atrás.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir } from "./_comun.mjs";

let t, uDueno, uRec, socio, agua;
before(async () => {
  t = await abrir("prueba-fiado");
  const crear = async (rol) => {
    const [{ id: u }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`${rol}${Math.random()}@ejemplo.invalid`]);
    await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,$3,$4)`, [t.g, u, rol, rol]);
    return u;
  };
  uDueno = await crear("dueno"); uRec = await crear("recepcion");
  socio = t.ctx.socios.vencida;
  [{ id: agua }] = await t.q(`insert into public.productos (gimnasio_id, nombre, precio) values ($1,'Agua',1000) returning id`, [t.g]);
});
after(async () => t && t.cerrar());
async function como(u, fn) {
  await t.db.query("set role authenticated");
  await t.q(`select set_config('request.jwt.claims', $1, false)`, [JSON.stringify({ sub: u, role: "authenticated" })]);
  try { return await fn(); } finally { await t.db.query("reset role"); await t.q(`select set_config('request.jwt.claims', '', false)`); }
}
const vender = (items, pagos, s = socio) => t.q(`select public.vender($1, $2, $3, $4, null) as r`, [t.sede, JSON.stringify(items), JSON.stringify(pagos), s]);
const acceso = async () => (await t.q(`select (privado.calcular_acceso($1, now())).* `, [socio]))[0];

test("apagado no se fía; prendido, hasta el tope", async () => {
  await como(uRec, () => t.falla(() => vender([{ tipo: "producto", producto_id: agua }], [{ medio: "cuenta_corriente", monto: 1000 }]), /no cobra con a cuenta/));
  await como(uDueno, () => t.q(`select public.guardar_configuracion($1, $2)`, [t.g, { fiado_activo: true, fiado_tope: "30000" }]));
  await como(uRec, async () => {
    const p = (await t.q(`select public.precios_venta($1, $2) as p`, [t.sede, socio]))[0].p;
    assert.equal(Number(p.fiado.disponible), 30000);
    const cuota = Number(p.cuota.precios.lista);
    await vender([{ tipo: "cuota" }], [{ medio: "cuenta_corriente", monto: cuota }]);
    await t.falla(() => vender([{ tipo: "producto", producto_id: agua, cantidad: 10 }], [{ medio: "cuenta_corriente", monto: 10000 }]), /Supera el tope para fiar/);
    await t.falla(() => vender([{ tipo: "producto", producto_id: agua }], [{ medio: "cuenta_corriente", monto: 1000 }], null), /solo se le puede cobrar a un socio/);
  });
  const a = await acceso();
  assert.equal(a.puede, true); assert.equal(a.color, "amarillo");
  assert.ok(a.avisos.some((x) => /^Debe \$[\d.]+ a cuenta$/.test(x)));
});

test("la deuda se paga en Vender (no a cuenta) y queda en cero; anular la vuelve", async () => {
  const deuda = Number((await t.q(`select privado.deuda_socio($1) as d`, [socio]))[0].d);
  const r = await como(uRec, async () => {
    await t.falla(() => vender([{ tipo: "deuda", precio_unitario: deuda + 1 }], [{ medio: "transferencia", monto: deuda + 1 }]), /hasta lo que debe/);
    await t.falla(() => vender([{ tipo: "deuda", precio_unitario: deuda }], [{ medio: "cuenta_corriente", monto: deuda }]), /no se paga a cuenta/);
    return (await vender([{ tipo: "deuda", precio_unitario: deuda }], [{ medio: "transferencia", monto: deuda }]))[0].r;
  });
  assert.equal(Number((await t.q(`select privado.deuda_socio($1) as d`, [socio]))[0].d), 0);
  assert.equal((await acceso()).color, "verde");
  await como(uDueno, () => t.q(`select public.anular_venta_panel($1, 'Prueba')`, [r.venta_id]));
  assert.equal(Number((await t.q(`select privado.deuda_socio($1) as d`, [socio]))[0].d), deuda);
});
