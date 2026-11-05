// Comprobante de pago por WhatsApp (0064): el texto sale del mensaje editable
// del gimnasio con lo cobrado; venta sin socio o anulada, error que lo dice.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir } from "./_comun.mjs";

let t, uRec;
before(async () => {
  t = await abrir("prueba-comprobante");
  const [{ id: u }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`rec${Math.random()}@ejemplo.invalid`]);
  await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,'Ana','recepcion')`, [t.g, u]);
  uRec = u;
  await t.q(`insert into public.productos (gimnasio_id, nombre, precio) values ($1,'Agua',1000)`, [t.g]);
  await t.q(`update public.socios set telefono = '+5490001112233' where id = $1`, [t.ctx.socios.vencida]);
});
after(async () => t && t.cerrar());
async function como(u, fn) {
  await t.db.query("set role authenticated");
  await t.q(`select set_config('request.jwt.claims', $1, false)`, [JSON.stringify({ sub: u, role: "authenticated" })]);
  try { return await fn(); } finally { await t.db.query("reset role"); await t.q(`select set_config('request.jwt.claims', '', false)`); }
}

test("cuota cobrada: texto con monto, detalle y hasta cuándo; sin socio no", async () => {
  const s = t.ctx.socios.vencida;
  await como(uRec, async () => {
    const p = (await t.q(`select public.precios_venta($1, $2) as p`, [t.sede, s]))[0].p;
    const [{ r }] = await t.q(`select public.vender($1, $2, $3, $4, null) as r`, [t.sede, JSON.stringify([{ tipo: "cuota" }]),
      JSON.stringify([{ medio: "transferencia", monto: p.cuota.precios.transferencia }]), s]);
    const [{ c }] = await t.q(`select public.comprobante_venta($1) as c`, [r.venta_id]);
    assert.equal(c.telefono, "+5490001112233");
    assert.match(c.mensaje, /^Hola Testigo! Recibimos tu pago de \$[\d.]+ en .+ \(Cuota .+, \d\d\/\d\d\)\. Quedás al día hasta el \d\d\/\d\d\. ¡Gracias! 💪$/);
    const prod = (await t.q(`select id from public.productos where gimnasio_id = $1`, [t.g]))[0].id;
    const [{ r: r2 }] = await t.q(`select public.vender($1, $2, $3, null, null) as r`, [t.sede, JSON.stringify([{ tipo: "producto", producto_id: prod }]), JSON.stringify([{ medio: "transferencia", monto: 1000 }])]);
    await t.falla(() => t.q(`select public.comprobante_venta($1)`, [r2.venta_id]), /no es de un socio/);
  });
});
