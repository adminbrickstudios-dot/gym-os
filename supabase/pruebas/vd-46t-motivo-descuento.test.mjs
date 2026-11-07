// VD-46T (7802): la base rechaza un descuento manual con un motivo fuera de la lista del gimnasio (motivos_beneficio).
// Vale para todos los roles; el cupón existente y activo sigue pasando; sin descuento nada cambia.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir } from "./_comun.mjs";

let t, uDueno, uRec, eDueno, agua;
async function como(usuario, fn) {
  await t.db.query("savepoint c");
  try {
    await t.db.query("set local role authenticated");
    await t.q(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: usuario, role: "authenticated" })]);
    return await fn();
  } finally { await t.db.query("rollback to savepoint c"); }
}
const items = (motivo, descuento = 50) => JSON.stringify([{ tipo: "producto", producto_id: agua, ...(descuento ? { descuento, descuento_motivo: motivo } : {}) }]);
const pago = (monto) => JSON.stringify([{ medio: "transferencia", monto }]);
const vender = (usuario, motivo, descuento = 50) =>
  como(usuario, async () => (await t.q(`select public.vender($1, $2, $3) as r`, [t.sede, items(motivo, descuento), pago(1000 - descuento)]))[0].r);

before(async () => {
  t = await abrir("prueba-motivo-descuento");
  for (const [rol, nombre] of [["dueno", "Dueña"], ["recepcion", "Sofi"]]) {
    const [{ id }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`${rol}${Math.random()}@ejemplo.invalid`]);
    const [{ id: e }] = await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,$3,$4) returning id`, [t.g, id, nombre, rol]);
    if (rol === "dueno") { uDueno = id; eDueno = e; } else uRec = id;
  }
  [{ id: agua }] = await t.q(`insert into public.productos (gimnasio_id, nombre, precio) values ($1,'Agua',1000) returning id`, [t.g]);
});
after(async () => t && t.cerrar());

test("un motivo escrito a mano que no está en la lista se rechaza, para la recepción y para el dueño", async () => {
  await t.falla(() => vender(uRec, "porque sí"), /no está en la lista del gimnasio/);
  await t.falla(() => vender(uDueno, "Amiguete"), /no está en la lista del gimnasio/);
});

test("un motivo de la lista pasa (sin importar mayúsculas ni espacios) y queda escrito en la venta", async () => {
  const it = await como(uRec, async () => {
    const [{ r }] = await t.q(`select public.vender($1, $2, $3) as r`, [t.sede, items("  amigo o familiar del gimnasio "), pago(950)]);
    await t.db.query("reset role");
    return (await t.q(`select descuento, descuento_motivo from public.venta_items where venta_id = $1`, [r.venta_id]))[0];
  });
  assert.equal(Number(it.descuento), 50);
  assert.match(it.descuento_motivo, /amigo o familiar del gimnasio/i);
});

test("un motivo desactivado deja de valer; al reactivarlo vuelve a valer", async () => {
  await t.q(`update public.motivos_beneficio set activo = false where gimnasio_id = $1 and nombre = 'Staff o profe'`, [t.g]);
  await t.falla(() => vender(uRec, "Staff o profe"), /no está en la lista del gimnasio/);
  await t.q(`update public.motivos_beneficio set activo = true where gimnasio_id = $1 and nombre = 'Staff o profe'`, [t.g]);
  const r = await vender(uRec, "Staff o profe");
  assert.ok(r.venta_id);
});

test("un cupón activo del gimnasio pasa; uno inventado o desactivado, no", async () => {
  await t.falla(() => vender(uRec, "Cupón VERANO99"), /no está en la lista del gimnasio/);
  await t.q(`insert into public.cupones (gimnasio_id, codigo, tipo, valor, creado_por) values ($1,'VERANO99','monto',50,$2)`, [t.g, eDueno]);
  const r = await vender(uRec, "Cupón VERANO99");
  assert.ok(r.venta_id);
  await t.q(`update public.cupones set activo = false where gimnasio_id = $1 and codigo = 'VERANO99'`, [t.g]);
  await t.falla(() => vender(uRec, "Cupón VERANO99"), /no está en la lista del gimnasio/);
});

test("sin motivo sigue pidiendo motivo; sin descuento no se pide nada", async () => {
  await t.falla(() => vender(uRec, "", 50), /necesita un motivo/);
  const r = await vender(uRec, null, 0);
  assert.ok(r.venta_id);
});

test("la lista de otro gimnasio no vale", async () => {
  const [{ id: g2 }] = await t.q(`insert into public.gimnasios (slug, nombre) values ('otro-motivo-desc', 'Otro') returning id`);
  await t.q(`insert into public.motivos_beneficio (gimnasio_id, nombre) values ($1, 'Motivo de otro gimnasio') on conflict do nothing`, [g2]);
  await t.falla(() => vender(uRec, "Motivo de otro gimnasio"), /no está en la lista del gimnasio/);
});
