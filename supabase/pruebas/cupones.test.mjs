// COM-9 (0129): cupones. El dueño crea uno; la recepción lo valida, lo aplica
// como descuento con motivo "Cupón X" (sigue valiendo su tope) y registra el
// uso al cobrar; el tope de usos y el vencimiento frenan; el panel cuenta
// usos y socios; sin el descuento no se registra.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir } from "./_comun.mjs";

let t, u = {}, full;
async function como(usuario, fn) {
  await t.db.query("set role authenticated");
  await t.q(`select set_config('request.jwt.claims', $1, false)`, [JSON.stringify({ sub: usuario, role: "authenticated" })]);
  try { return await fn(); } finally { await t.db.query("reset role"); await t.q(`select set_config('request.jwt.claims', '', false)`); }
}
before(async () => {
  t = await abrir("prueba-cupones");
  for (const rol of ["dueno", "recepcion"]) {
    const [{ id }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`${rol}${Math.random()}@ejemplo.invalid`]);
    await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,$3,$4)`, [t.g, id, rol, rol]);
    u[rol] = id;
  }
  await t.q(`update public.configuracion_gimnasio set descuento_max_recepcion = 25 where gimnasio_id = $1`, [t.g]);
  [{ id: full }] = await t.q(`select id from public.planes where gimnasio_id = $1 and nombre = 'Plan Full'`, [t.g]);
});
after(async () => t && t.cerrar());

test("crear, validar, aplicar y registrar; tope y vencimiento; el panel cuenta", async () => {
  await como(u.dueno, async () => {
    await t.falla(() => t.q(`select public.guardar_cupon($1, 'a b', 'porcentaje', 10)`, [t.g]), /3 a 20 letras/);
    await t.falla(() => t.q(`select public.guardar_cupon($1, 'MAL', 'porcentaje', 150)`, [t.g]), /no es válido/);
    await t.q(`select public.guardar_cupon($1, 'verano25', 'porcentaje', 20, 1, null, $2::uuid[])`, [t.g, [full]]);
    await t.q(`select public.guardar_cupon($1, 'VIEJO', 'monto', 1000, null, current_date - 2)`, [t.g]);
    await t.falla(() => t.q(`select public.guardar_cupon($1, 'VERANO25', 'monto', 10)`, [t.g]), /Ya hay un cupón/);
  });
  await como(u.recepcion, async () => {
    await t.falla(() => t.q(`select public.validar_cupon($1, 'viejo')`, [t.g]), /ya venció/);
    const [{ c }] = await t.q(`select public.validar_cupon($1, ' verano25 ') c`, [t.g]);
    assert.equal(c.codigo, "VERANO25"); assert.deepEqual(c.planes, [full]);
    const socio = t.ctx.socios.por_vencer;
    const [{ p }] = await t.q(`select public.precios_venta($1, $2) p`, [t.sede, socio]);
    const precio = Number(p.cuota.precios.transferencia);
    const desc = Math.round(precio * 0.2 * 100) / 100;
    const [{ r }] = await t.q(`select public.vender($1, $2::jsonb, $3::jsonb, $4) r`, [t.sede,
      JSON.stringify([{ tipo: "cuota", descuento: desc, descuento_motivo: "Cupón VERANO25" }]), JSON.stringify([{ medio: "transferencia", monto: precio - desc }]), socio]);
    await t.q(`select public.registrar_uso_cupon($1, 'verano25')`, [r.venta_id]);
    await t.falla(() => t.q(`select public.validar_cupon($1, 'VERANO25')`, [t.g]), /1 veces que tenía/);
    await t.falla(() => t.q(`select public.cupones_panel($1)`, [t.g]), /permiso|rol|acceso/i);
  });
  await como(u.dueno, async () => {
    const [{ l }] = await t.q(`select public.cupones_panel($1) l`, [t.g]);
    const v = l.find((x) => x.codigo === "VERANO25");
    assert.equal(v.usos, 1); assert.equal(v.socios, 1); assert.deepEqual(v.planes, ["Plan Full"]);
  });
});

test("una venta sin el descuento del cupón no se anota como uso", async () => {
  await como(u.dueno, () => t.q(`select public.guardar_cupon($1, 'SINUSO', 'monto', 500)`, [t.g]));
  const [{ id: prod }] = await t.q(`insert into public.productos (gimnasio_id, nombre, precio) values ($1, 'Agua cupón', 1500) returning id`, [t.g]);
  const precio = 1500;
  await como(u.recepcion, async () => {
    const [{ r }] = await t.q(`select public.vender($1, $2::jsonb, $3::jsonb) r`, [t.sede,
      JSON.stringify([{ tipo: "producto", producto_id: prod }]), JSON.stringify([{ medio: "transferencia", monto: Number(precio) }])]);
    await t.falla(() => t.q(`select public.registrar_uso_cupon($1, 'SINUSO')`, [r.venta_id]), /no tiene el descuento/);
  });
});
