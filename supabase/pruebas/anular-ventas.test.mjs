// Anular ventas (0062): la recepción pide (solo ventas suyas de hoy), el dueño
// o el encargado aprueban o rechazan; aprobar revierte la cuota; el efectivo
// de una caja ya cerrada sale de la caja abierta; ventas_socio dice el estado.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir } from "./_comun.mjs";

let t, caja, uRec, uRec2, uEnc, socio, venta, turno;
before(async () => {
  t = await abrir("prueba-anular");
  [{ id: caja }] = await t.q(`insert into public.cajas (gimnasio_id, sede_id, nombre) values ($1,$2,'Recepción') returning id`, [t.g, t.sede]);
  const crear = async (rol, n) => {
    const [{ id: u }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`${rol}${Math.random()}@ejemplo.invalid`]);
    await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,$3,$4)`, [t.g, u, n, rol]);
    return u;
  };
  uRec = await crear("recepcion", "Ana"); uRec2 = await crear("recepcion", "Beto"); uEnc = await crear("encargado", "Encargado");
  socio = t.ctx.socios.vencida;
});
after(async () => t && t.cerrar());
async function como(u, fn) {
  await t.db.query("set role authenticated");
  await t.q(`select set_config('request.jwt.claims', $1, false)`, [JSON.stringify({ sub: u, role: "authenticated" })]);
  try { return await fn(); } finally { await t.db.query("reset role"); await t.q(`select set_config('request.jwt.claims', '', false)`); }
}
const color = async () => (await t.q(`select (privado.calcular_acceso($1, now())).color as c`, [socio]))[0].c;

test("la recepción pide; otra recepcionista no; el encargado rechaza", async () => {
  turno = await como(uRec, async () => (await t.q(`select public.abrir_caja($1, 0) as id`, [caja]))[0].id);
  const precio = await como(uRec, async () => (await t.q(`select public.precios_venta($1, $2) as p`, [t.sede, socio]))[0].p.cuota.precios.efectivo);
  venta = await como(uRec, async () => (await t.q(`select public.vender($1, $2, $3, $4, $5) as r`,
    [t.sede, JSON.stringify([{ tipo: "cuota" }]), JSON.stringify([{ medio: "efectivo", monto: precio }]), socio, turno]))[0].r.venta_id);
  assert.equal(await color(), "verde");
  await como(uRec2, () => t.falla(() => t.q(`select public.pedir_anulacion($1, 'Error')`, [venta]), /cobraste vos/));
  await como(uRec, async () => {
    await t.falla(() => t.q(`select public.anular_venta_panel($1, 'x')`, [venta]), /Sin permiso/);
    await t.falla(() => t.q(`select public.pedir_anulacion($1, '  ')`, [venta]), /por qué/);
    await t.q(`select public.pedir_anulacion($1, 'Cobré dos veces')`, [venta]);
    await t.falla(() => t.q(`select public.pedir_anulacion($1, 'otra vez')`, [venta]), /Ya pediste/);
  });
  const p = await como(uEnc, async () => (await t.q(`select public.pedidos_anulacion_pendientes($1) as p`, [t.g]))[0].p);
  assert.equal(p.length, 1); assert.equal(p[0].pedido.motivo, "Cobré dos veces"); assert.equal(p[0].cobro, "Ana");
  await como(uEnc, () => t.q(`select public.resolver_pedido_anulacion($1, false, 'No, está bien')`, [p[0].pedido.pedido_id]));
  assert.equal(await color(), "verde");
});

test("aprobado: la venta queda anulada con motivo y la cuota se revierte; el efectivo de caja cerrada sale de la abierta", async () => {
  await como(uRec, () => t.q(`select public.pedir_anulacion($1, 'Se equivocó de socio')`, [venta]));
  // Se cierra la caja donde entró la plata y se abre otra.
  await como(uRec, () => t.q(`select public.cerrar_caja($1, 0, null)`, [turno]));
  const pid = (await como(uEnc, async () => (await t.q(`select public.pedidos_anulacion_pendientes($1) as p`, [t.g]))[0].p))[0].pedido.pedido_id;
  await como(uEnc, () => t.falla(() => t.q(`select public.resolver_pedido_anulacion($1, true)`, [pid]), /abrí una caja/));
  const turno2 = await como(uRec, async () => (await t.q(`select public.abrir_caja($1, 0) as id`, [caja]))[0].id);
  await como(uEnc, () => t.q(`select public.resolver_pedido_anulacion($1, true)`, [pid]));
  assert.equal(await color(), "rojo");
  const vs = await como(uEnc, async () => (await t.q(`select public.ventas_socio($1) as v`, [socio]))[0].v);
  const v = vs.find((x) => x.venta_id === venta);
  assert.equal(v.estado, "anulada"); assert.equal(v.anulada_motivo, "Se equivocó de socio"); assert.equal(v.anulada_por, "Encargado");
  const [{ n }] = await t.q(`select count(*)::int as n from public.movimientos_caja where turno_caja_id = $1 and tipo = 'retiro'`, [turno2]);
  assert.equal(n, 1);
  await como(uRec, () => t.falla(() => t.q(`select public.ventas_socio($1)`, [socio]), /Sin permiso/));
});
