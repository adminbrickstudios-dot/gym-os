// Stock de productos (0065): se calcula de entradas, conteos y ventas no
// anuladas; el primer conteo absorbe lo vendido antes; la recepción lo lee y
// no lo carga.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir } from "./_comun.mjs";

let t, uDueno, uRec, agua;
before(async () => {
  t = await abrir("prueba-stock");
  const crear = async (rol) => {
    const [{ id: u }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`${rol}${Math.random()}@ejemplo.invalid`]);
    await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,$3,$4)`, [t.g, u, rol, rol]);
    return u;
  };
  uDueno = await crear("dueno"); uRec = await crear("recepcion");
  [{ id: agua }] = await t.q(`insert into public.productos (gimnasio_id, nombre, precio) values ($1,'Agua',1000) returning id`, [t.g]);
});
after(async () => t && t.cerrar());
async function como(u, fn) {
  await t.db.query("set role authenticated");
  await t.q(`select set_config('request.jwt.claims', $1, false)`, [JSON.stringify({ sub: u, role: "authenticated" })]);
  try { return await fn(); } finally { await t.db.query("reset role"); await t.q(`select set_config('request.jwt.claims', '', false)`); }
}
const vender = (n) => t.q(`select public.vender($1, $2, $3, null, null) as r`, [t.sede, JSON.stringify([{ tipo: "producto", producto_id: agua, cantidad: n }]), JSON.stringify([{ medio: "transferencia", monto: 1000 * n }])]);
const stock = async () => (await t.q(`select public.stock_productos($1) as s`, [t.g]))[0].s[agua]?.stock;

test("prender, contar, entrar mercadería, vender y anular", async () => {
  await como(uRec, () => vender(3));     // vendido antes de llevar stock
  await como(uDueno, async () => {
    await t.falla(() => t.q(`select public.entrada_stock($1, 10)`, [agua]), /no lleva stock/);
    await t.q(`select public.configurar_stock($1, true, 5)`, [agua]);
    assert.equal(await stock(), -3);
    assert.equal((await t.q(`select public.contar_stock($1, 12) as n`, [agua]))[0].n, 12);
    assert.equal((await t.q(`select public.entrada_stock($1, 24, 'Proveedor') as n`, [agua]))[0].n, 36);
  });
  const [{ r }] = await como(uRec, () => vender(2));
  await como(uRec, async () => {
    assert.equal(await stock(), 34);
    await t.falla(() => t.q(`select public.entrada_stock($1, 1)`, [agua]), /Sin permiso/);
  });
  await como(uDueno, async () => {
    await t.q(`select public.anular_venta_panel($1, 'Prueba')`, [r.venta_id]);
    assert.equal(await stock(), 36);
    const [{ m }] = await t.q(`select public.movimientos_stock_producto($1) as m`, [agua]);
    assert.deepEqual(m.map((x) => [x.tipo, x.cantidad]).sort(), [["conteo", 15], ["entrada", 24]]);   // en la misma transacción tienen la misma hora
    await t.falla(() => t.q(`select public.contar_stock($1, -1)`, [agua]), /de 0 en adelante/);
  });
});
