// Caja, carrito del mostrador y transferencias informadas por el socio.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir, HOY } from "./_comun.mjs";

let t, caja, uRec, uEnc, uSocio;
before(async () => {
  t = await abrir("prueba-caja");
  [{ id: caja }] = await t.q(`insert into public.cajas (gimnasio_id, sede_id, nombre) values ($1,$2,'Recepción') returning id`, [t.g, t.sede]);
  const crear = async (rol) => {
    const [{ id: u }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`${rol}${Math.random()}@ejemplo.invalid`]);
    const [{ id: e }] = await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,$3,$4) returning id`, [t.g, u, rol, rol]);
    return { u, e };
  };
  ({ u: uRec } = await crear("recepcion"));
  ({ u: uEnc } = await crear("encargado"));
  [{ id: uSocio }] = await t.q(`insert into auth.users (phone) values ('+5490000444555') returning id`);
  await t.q(`update public.socios set usuario_id = $2 where id = $1`, [t.ctx.socios.vencida, uSocio]);
  await t.q(`insert into public.productos (gimnasio_id, nombre, precio) values ($1,'Agua 500 ml',1500)`, [t.g]);
});
after(async () => t && t.cerrar());

// Ejecuta como un usuario sin revertir lo que hace (para encadenar pasos).
async function como(u, fn) {
  await t.db.query("set role authenticated");
  await t.q(`select set_config('request.jwt.claims', $1, false)`, [JSON.stringify({ sub: u, role: "authenticated" })]);
  try { return await fn(); } finally { await t.db.query("reset role"); await t.q(`select set_config('request.jwt.claims', '', false)`); }
}
const producto = async () => (await t.q(`select id from public.productos where gimnasio_id = $1`, [t.g]))[0].id;
// Los casos testigo están armados para HOY (14/11/2026); las RPC usan now().
const acceso = async (s) => (await t.q(`select (privado.calcular_acceso($1, $2)).*`, [s, await t.en(HOY)]))[0];

let turno;
test("abrir caja: una sola abierta por caja", async () => {
  turno = await como(uRec, async () => (await t.q(`select public.abrir_caja($1, 10000) as id`, [caja]))[0].id);
  await como(uRec, () => t.falla(() => t.q(`select public.abrir_caja($1, 5000)`, [caja]), /ya está abierta/));
});

test("vender carrito con pago mixto: cuota + agua, efectivo y transferencia", async () => {
  const prod = await producto();
  const r = await como(uRec, async () => (await t.q(`select public.vender($1, $2, $3, $4, $5) as r`, [
    t.sede,
    JSON.stringify([{ tipo: "cuota" }, { tipo: "producto", producto_id: prod, cantidad: 2 }]),
    JSON.stringify([{ medio: "efectivo", monto: 10000 }, { medio: "transferencia", monto: 18000 }]),
    t.ctx.socios.vencida, turno]))[0].r);
  assert.equal(Number(r.total), 28000);                       // 25.000 + 2 × 1.500
  assert.equal(r.veredicto.color, "verde");
});

test("los pagos tienen que sumar exactamente el total", async () => {
  await como(uRec, () => t.falla(() => t.q(`select public.vender($1, $2, $3, $4, $5)`, [
    t.sede, JSON.stringify([{ tipo: "cuota" }]), JSON.stringify([{ medio: "transferencia", monto: 20000 }]),
    t.ctx.socios.sin_pago, turno]), /suman \$20\.000 y el total es \$25\.000/));
});

test("el precio lo pone la base: un precio_unitario en una cuota se ignora", async () => {
  const r = await como(uRec, async () => (await t.q(`select public.vender($1, $2, $3, $4, $5) as r`, [
    t.sede, JSON.stringify([{ tipo: "cuota", precio_unitario: 1 }]), JSON.stringify([{ medio: "transferencia", monto: 25000 }]),
    t.ctx.socios.sin_pago, turno]))[0].r);
  assert.equal(Number(r.total), 25000);
});

test("pase diario y pack en el mostrador", async () => {
  const [{ id: s }] = await t.q(`insert into public.socios (gimnasio_id, nombre, apellido) values ($1,'Visitante','Ficticio') returning id`, [t.g]);
  const r = await como(uRec, async () => (await t.q(`select public.vender($1, $2, $3, $4, $5) as r`, [
    t.sede, JSON.stringify([{ tipo: "pase", plan_id: t.ctx.planes.pase }, { tipo: "pack", plan_id: t.ctx.planes.pack10 }]),
    JSON.stringify([{ medio: "efectivo", monto: 45000 }]), s, turno]))[0].r);
  assert.equal(r.generados, 2);
  assert.equal(r.veredicto.motivo, "pase_de_hoy", "con pase de hoy entra con el pase y no toca el pack");
});

test("un plan de pack no se vende como pase", async () => {
  await como(uRec, () => t.falla(() => t.q(`select public.vender($1, $2, $3, $4, $5)`, [
    t.sede, JSON.stringify([{ tipo: "pase", plan_id: t.ctx.planes.pack10 }]), JSON.stringify([{ medio: "efectivo", monto: 40000 }]),
    t.ctx.socios.sin_plan, turno]), /no es un pase/));
});

test("descuento: la recepción tiene tope y necesita motivo; el encargado no tiene tope", async () => {
  const prod = await producto();
  const item = (d, m) => JSON.stringify([{ tipo: "producto", producto_id: prod, cantidad: 10, descuento: d, descuento_motivo: m }]);
  await como(uRec, () => t.falla(() => t.q(`select public.vender($1, $2, $3)`, [t.sede, item(500, null), JSON.stringify([{ medio: "transferencia", monto: 14500 }])]), /necesita un motivo/));
  await como(uRec, () => t.falla(() => t.q(`select public.vender($1, $2, $3)`, [t.sede, item(3000, "Amigo"), JSON.stringify([{ medio: "transferencia", monto: 12000 }])]), /descuento máximo es 10\.00 %/));
  const ok = await como(uRec, async () => (await t.q(`select public.vender($1, $2, $3) as r`, [t.sede, item(1500, "Promo"), JSON.stringify([{ medio: "transferencia", monto: 13500 }])]))[0].r);
  assert.equal(Number(ok.total), 13500);
  const enc = await como(uEnc, async () => (await t.q(`select public.vender($1, $2, $3) as r`, [t.sede, item(7500, "Sponsor"), JSON.stringify([{ medio: "transferencia", monto: 7500 }])]))[0].r);
  assert.equal(Number(enc.total), 7500);
});

test("efectivo sin caja abierta no se cobra", async () => {
  const prod = await producto();
  await como(uRec, () => t.falla(() => t.q(`select public.vender($1, $2, $3)`, [
    t.sede, JSON.stringify([{ tipo: "producto", producto_id: prod }]), JSON.stringify([{ medio: "efectivo", monto: 1500 }])]), /caja abierta/));
});

test("movimientos y cierre con arqueo: esperado y diferencia", async () => {
  await como(uRec, () => t.q(`select public.movimiento_caja($1, 'retiro', 3000, 'Pago al proveedor de agua')`, [turno]));
  await como(uRec, () => t.falla(() => t.q(`select public.resumen_caja($1)`, [turno]), /Sin permiso/));   // ciego para la recepción
  const abierto = await como(uEnc, async () => (await t.q(`select public.resumen_caja($1) as r`, [turno]))[0].r);
  // 10.000 inicial + 10.000 (carrito) + 45.000 (pase y pack) − 3.000 retiro
  assert.equal(Number(abierto.esperado), 62000);
  const cierre = await como(uRec, async () => (await t.q(`select public.cerrar_caja($1, 61500, 'Faltan 500') as r`, [turno]))[0].r);
  assert.equal(Number(cierre.esperado), 62000);
  assert.equal(Number(cierre.diferencia), -500);
  assert.ok(Number(cierre.otros_medios.transferencia) > 0);
  await como(uRec, () => t.falla(() => t.q(`select public.movimiento_caja($1, 'ingreso', 100, 'x')`, [turno]), /está cerrado/));
  await como(uRec, () => t.falla(() => t.q(`select public.cerrar_caja($1, 1)`, [turno]), /ya estaba cerrado/));
  const despues = await como(uRec, async () => (await t.q(`select public.resumen_caja($1) as r`, [turno]))[0].r);
  assert.equal(Number(despues.diferencia), -500, "cerrado, la recepción ya ve el resultado");
});

test("la recepción no escribe ventas ni pagos directo", async () => {
  await como(uRec, async () => {
    await t.falla(() => t.q(`insert into public.ventas (gimnasio_id, sede_id, origen) values ($1,$2,'recepcion')`, [t.g, t.sede]), /row-level security/);
    const r = await t.db.query(`update public.pagos set monto = 1 where gimnasio_id = $1`, [t.g]);
    assert.equal(r.rowCount, 0);
  });
});

// ── Transferencia informada por el socio ─────────────────────────────
let pagoPendiente;
test("el socio informa su transferencia con comprobante; queda pendiente", async () => {
  const s = t.ctx.socios.vencida;
  await t.q(`update public.socios set usuario_id = $2 where id = $1`, [t.ctx.socios.en_tolerancia, uSocio]);
  const ruta = `${t.g}/${t.ctx.socios.en_tolerancia}/comprobante.jpg`;
  const r = await como(uSocio, async () => (await t.q(`select public.informar_transferencia($1, $2) as r`, [t.ctx.socios.en_tolerancia, ruta]))[0].r);
  pagoPendiente = r.pago_id;
  assert.equal(Number(r.monto), 25000);
  assert.equal((await acceso(t.ctx.socios.en_tolerancia)).color, "naranja", "pendiente no habilita");
  await como(uSocio, () => t.falla(() => t.q(`select public.informar_transferencia($1, $2)`, [t.ctx.socios.en_tolerancia, ruta]), /ya se usó/));
  await como(uSocio, () => t.falla(() => t.q(`select public.informar_transferencia($1, $2)`, [t.ctx.socios.en_tolerancia, ruta.replace(".jpg", "-2.jpg")]), /esperando aprobación/));
  await como(uSocio, () => t.falla(() => t.q(`select public.informar_transferencia($1, $2)`, [s, `${t.g}/${t.ctx.socios.en_tolerancia}/x.jpg`]), /carpeta del socio/));
  await como(uSocio, () => t.falla(() => t.q(`select public.informar_transferencia($1, $2)`, [t.ctx.socios.al_dia, `${t.g}/${t.ctx.socios.al_dia}/x.jpg`]), /Sin permiso/));
});

test("el socio no aprueba su propio pago; la recepción lo ve en la lista y lo aprueba", async () => {
  await como(uSocio, () => t.falla(() => t.q(`select public.aprobar_pago($1)`, [pagoPendiente]), /Sin permiso/));
  const lista = await como(uRec, async () => await t.q(`select * from public.pagos_por_aprobar($1)`, [t.g]));
  assert.ok(lista.some((p) => p.pago_id === pagoPendiente));
  const r = await como(uRec, async () => (await t.q(`select public.aprobar_pago($1) as r`, [pagoPendiente]))[0].r);
  assert.equal(r.veredicto.color, "verde");
  await como(uRec, () => t.falla(() => t.q(`select public.aprobar_pago($1)`, [pagoPendiente]), /ya está aprobado/));
});

test("rechazar un comprobante anula la venta y no habilita nada", async () => {
  const s = t.ctx.socios.vence_hoy;
  await t.q(`update public.socios set usuario_id = $2 where id = $1`, [s, uSocio]);
  const r = await como(uSocio, async () => (await t.q(`select public.informar_transferencia($1, $2) as r`, [s, `${t.g}/${s}/c.jpg`]))[0].r);
  await como(uRec, () => t.falla(() => t.q(`select public.rechazar_pago($1, '')`, [r.pago_id]), /Decí por qué/));
  await como(uRec, () => t.q(`select public.rechazar_pago($1, 'El monto no coincide')`, [r.pago_id]));
  const [{ estado }] = await t.q(`select estado from public.ventas where id = $1`, [r.venta_id]);
  assert.equal(estado, "anulada");
  const [{ n }] = await t.q(`select count(*)::int n from public.coberturas where venta_item_id in (select id from public.venta_items where venta_id = $1)`, [r.venta_id]);
  assert.equal(n, 0);
});
