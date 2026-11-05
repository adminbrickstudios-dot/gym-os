// Historial del socio (0092): sus pagos (sin los anulados) y sus entradas,
// lo más nuevo primero; otro socio no lo ve.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir } from "./_comun.mjs";

let t, socio, uSocio, uOtro;
async function como(usuario, fn) {
  await t.db.query("set role authenticated");
  await t.q(`select set_config('request.jwt.claims', $1, false)`, [JSON.stringify({ sub: usuario, role: "authenticated" })]);
  try { return await fn(); } finally { await t.db.query("reset role"); await t.q(`select set_config('request.jwt.claims', '', false)`); }
}
before(async () => {
  t = await abrir("prueba-historial");
  [{ id: uSocio }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`s${Math.random()}@ejemplo.invalid`]);
  [{ id: uOtro }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`o${Math.random()}@ejemplo.invalid`]);
  [{ id: socio }] = await t.q(`insert into public.socios (gimnasio_id, nombre, apellido, usuario_id) values ($1,'Hist','Orial',$2) returning id`, [t.g, uSocio]);
  await t.q(`insert into public.socios (gimnasio_id, nombre, apellido, usuario_id) values ($1,'Otro','Socio',$2)`, [t.g, uOtro]);
  for (const [dias, monto] of [[40, 10000], [5, 12000]]) {
    const [{ id: v }] = await t.q(`insert into public.ventas (gimnasio_id, sede_id, socio_id, origen, estado, confirmada_en, creado_en) values ($1,$2,$3,'recepcion','confirmada', now() - make_interval(days => $4), now() - make_interval(days => $4)) returning id`, [t.g, t.sede, socio, dias]);
    await t.q(`insert into public.venta_items (gimnasio_id, venta_id, tipo, descripcion, cantidad, precio_unitario) values ($1,$2,'otro','Cuota',1,$3)`, [t.g, v, monto]);
    await t.q(`insert into public.pagos (gimnasio_id, venta_id, medio, monto, estado, aprobado_en) values ($1,$2,'transferencia',$3,'aprobado', now() - make_interval(days => $4))`, [t.g, v, monto, dias]);
  }
  await t.q(`insert into public.ingresos (gimnasio_id, sede_id, socio_id, momento, via_acceso, resultado, via_habilitante, color, motivo, texto)
    values ($1,$2,$3, now() - interval '1 day', 'recepcion', 'entro', 'membresia', 'verde', 'al_dia', 'x')`, [t.g, t.sede, socio]);
});
after(async () => t && t.cerrar());

test("sus pagos y entradas, lo más nuevo primero; otro socio no", async () => {
  const [{ h }] = await como(uSocio, () => t.q(`select public.mi_historial($1) as h`, [socio]));
  assert.deepEqual(h.pagos.map((p) => Number(p.monto)), [12000, 10000]);
  assert.equal(h.pagos[0].detalle, "Cuota");
  assert.equal(h.entradas.length, 1); assert.equal(h.entradas[0].tipo, "entrada");
  await como(uOtro, () => t.falla(() => t.q(`select public.mi_historial($1)`, [socio]), /permiso/i));
});
