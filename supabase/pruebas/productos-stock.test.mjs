// VD-18 (4800): productos con foto, costo, categoría y margen; el stock baja con cada venta, avisa "queda poco"
// y no se pasa de cero salvo que el producto lo permita; entrada de mercadería con remito. Permisos por rol.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir } from "./_comun.mjs";

let t, uDueno, uEnc, uRec, agua;
before(async () => {
  t = await abrir("prueba-productos-stock");
  const crear = async (rol) => {
    const [{ id: u }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`${rol}${Math.random()}@ejemplo.invalid`]);
    await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,$3,$4)`, [t.g, u, rol, rol]);
    return u;
  };
  uDueno = await crear("dueno"); uEnc = await crear("encargado"); uRec = await crear("recepcion");
  [{ id: agua }] = await t.q(`insert into public.productos (gimnasio_id, nombre, precio) values ($1,'Agua VD18',1000) returning id`, [t.g]);
});
after(async () => t && t.cerrar());
// Con la sesión del usuario; lo que escribe se conserva si sale bien, y si falla vuelve todo atrás (la transacción sigue viva).
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
const items = (...cants) => JSON.stringify(cants.map((n) => ({ tipo: "producto", producto_id: agua, cantidad: n })));
const pagos = (n) => JSON.stringify([{ medio: "transferencia", monto: 1000 * n }]);
const vender = (...cants) => t.q(`select public.vender($1, $2, $3, null, null) as r`, [t.sede, items(...cants), pagos(cants.reduce((a, b) => a + b, 0))]);
const stock = () => como(uDueno, async () => (await t.q(`select public.stock_productos($1) as s`, [t.g]))[0].s[agua]);

test("la ficha: costo, categoría y margen; la recepción no ve el costo ni lo toca", async () => {
  await t.falla(() => como(uRec, () => t.q(`select public.guardar_ficha_producto($1, '{"costo": 600}')`, [agua])));
  await t.falla(() => como(uRec, () => t.q(`select public.productos_mostrador($1)`, [t.g])));
  await como(uEnc, async () => {
    await t.q(`select public.guardar_ficha_producto($1, '{"costo": 600, "categoria": "Bebidas"}')`, [agua]);
    const fila = (await t.q(`select public.productos_mostrador($1) as p`, [t.g]))[0].p.find((x) => x.producto_id === agua);
    assert.equal(Number(fila.costo), 600);
    assert.equal(Number(fila.margen), 400);
    assert.equal(fila.categoria, "Bebidas");
    await t.falla(() => t.q(`select public.guardar_ficha_producto($1, '{"costo": -1}')`, [agua]), /costo/);
    // Vacío = sin costo cargado, y no hay margen.
    await t.q(`select public.guardar_ficha_producto($1, '{"costo": null}')`, [agua]);
    const sin = (await t.q(`select public.productos_mostrador($1) as p`, [t.g]))[0].p.find((x) => x.producto_id === agua);
    assert.equal(sin.costo, null); assert.equal(sin.margen, null);
  });
});

test("el stock baja con cada venta, 'queda poco' sale del mínimo y no se vende de más", async () => {
  await como(uDueno, async () => {
    await t.q(`select public.configurar_stock($1, true, 2)`, [agua]);
    await t.q(`select public.contar_stock($1, 3)`, [agua]);
  });
  assert.equal((await stock()).stock, 3);
  await como(uRec, () => vender(1));
  const s = await stock();
  assert.equal(s.stock, 2);
  assert.ok(s.stock > 0 && s.stock <= s.minimo, "queda poco: hay pero no más que el mínimo");
  // Pedir más de lo que hay frena la venta (y no deja nada a medias).
  await t.falla(() => como(uRec, () => vender(3)), /quedan 2/);
  // Lo cargado en el mismo carrito cuenta: 2 + 1 con 2 en stock.
  await t.falla(() => como(uRec, () => vender(2, 1)), /quedan/);
  assert.equal((await stock()).stock, 2, "ninguna de las dos ventas fallidas tocó el stock");
  await como(uRec, () => vender(2));
  assert.equal((await stock()).stock, 0);
  await t.falla(() => como(uRec, () => vender(1)), /quedan 0/);
});

test("el producto puede permitir vender sin stock: queda en negativo (se cuenta y se ajusta)", async () => {
  await t.falla(() => como(uRec, () => t.q(`select public.guardar_ficha_producto($1, '{"permite_negativo": true}')`, [agua])));
  await como(uDueno, () => t.q(`select public.guardar_ficha_producto($1, '{"permite_negativo": true}')`, [agua]));
  assert.equal((await stock()).negativo, true);
  await como(uRec, () => vender(2));
  assert.equal((await stock()).stock, -2);
  await como(uDueno, async () => {
    await t.q(`select public.guardar_ficha_producto($1, '{"permite_negativo": false}')`, [agua]);
    await t.q(`select public.contar_stock($1, 5)`, [agua]);
  });
  assert.equal((await stock()).stock, 5);
});

test("un producto que no lleva stock no tiene tope", async () => {
  const [{ id: gaseosa }] = await t.q(`insert into public.productos (gimnasio_id, nombre, precio) values ($1,'Gaseosa VD18',500) returning id`, [t.g]);
  await como(uRec, () => t.q(`select public.vender($1, $2, $3, null, null)`, [t.sede,
    JSON.stringify([{ tipo: "producto", producto_id: gaseosa, cantidad: 40 }]), JSON.stringify([{ medio: "transferencia", monto: 20000 }])]));
});

test("precios_venta trae la foto y la categoría de cada producto", async () => {
  const ruta = await como(uDueno, async () => (await t.q(`select public.preparar_foto_producto($1, 'webp') as r`, [agua]))[0].r);
  assert.match(ruta, new RegExp(`^${t.g}/${agua}/foto-[0-9a-f]{32}\\.webp$`));
  await t.falla(() => como(uRec, () => t.q(`select public.preparar_foto_producto($1, 'webp')`, [agua])));
  await t.falla(() => como(uDueno, () => t.q(`select public.preparar_foto_producto($1, 'gif')`, [agua])), /JPG, PNG o WEBP/);
  await t.falla(() => como(uDueno, () => t.q(`select public.confirmar_foto_producto($1, 'otra/ruta.webp')`, [agua])), /inválida/);
  await como(uDueno, () => t.q(`select public.confirmar_foto_producto($1, $2)`, [agua, ruta]));
  const pv = await como(uRec, async () => (await t.q(`select public.precios_venta($1, null) as p`, [t.sede]))[0].p);
  const fila = pv.productos.find((x) => x.producto_id === agua);
  assert.equal(fila.foto_path, ruta);
  assert.equal(fila.categoria, "Bebidas");
  await como(uDueno, () => t.q(`select public.quitar_foto_producto($1)`, [agua]));
  const sin = await como(uRec, async () => (await t.q(`select public.precios_venta($1, null) as p`, [t.sede]))[0].p);
  assert.equal(sin.productos.find((x) => x.producto_id === agua).foto_path, null);
});

test("entrada de mercadería con remito: queda pegado a la entrada y solo dueño y encargado lo ven", async () => {
  await como(uDueno, async () => {
    await t.q(`select public.entrada_stock($1, 10, 'Proveedor')`, [agua]);
    const ruta = (await t.q(`select public.preparar_remito_stock($1, 'pdf') as r`, [agua]))[0].r;
    assert.match(ruta, new RegExp(`^${t.g}/${agua}/remito-[0-9a-f]{32}\\.pdf$`));
    await t.falla(() => t.q(`select public.confirmar_remito_stock($1, 'x/y.pdf')`, [agua]), /inválida/);
    await t.q(`select public.confirmar_remito_stock($1, $2)`, [agua, ruta]);
    const movs = (await t.q(`select public.movimientos_stock_producto($1) as m`, [agua]))[0].m;
    const entrada = movs.find((m) => m.tipo === "entrada" && m.cantidad === 10);
    assert.equal(entrada.remito, true);
    assert.equal((await t.q(`select public.remito_stock($1) as r`, [entrada.id]))[0].r, ruta);
    // Ya no queda una entrada tuya sin remito.
    const otra = (await t.q(`select public.preparar_remito_stock($1, 'jpg') as r`, [agua]))[0].r;
    await t.falla(() => t.q(`select public.confirmar_remito_stock($1, $2)`, [agua, otra]), /sin remito/);
  });
  const [m] = await t.q(`select id from public.movimientos_stock where producto_id = $1 and remito_path is not null`, [agua]);
  await t.falla(() => como(uRec, () => t.q(`select public.remito_stock($1)`, [m.id])));
  await t.falla(() => como(uRec, () => t.q(`select public.preparar_remito_stock($1, 'pdf')`, [agua])));
});
