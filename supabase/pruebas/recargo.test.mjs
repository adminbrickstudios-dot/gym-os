// Recargo por pagar tarde (0061, D8): apagado por defecto; prendido, se calcula
// al cobrar; Vender lo exige junto con la cuota; no cobrarlo es un descuento
// con motivo (con el tope de la recepción); el que nunca pagó no tiene atraso.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir } from "./_comun.mjs";

let t, uDueno, uRec, plan, tarde, justo, nuevo;
before(async () => {
  t = await abrir("prueba-recargo");
  const crear = async (rol) => {
    const [{ id: u }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`${rol}${Math.random()}@ejemplo.invalid`]);
    await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,$3,$4)`, [t.g, u, rol, rol]);
    return u;
  };
  uDueno = await crear("dueno"); uRec = await crear("recepcion");
  [{ id: plan }] = await t.q(`insert into public.planes (gimnasio_id, tipo, nombre, duracion_meses, renovacion) values ($1,'membresia','Mensual',1,'continua') returning id`, [t.g]);
  await t.q(`insert into public.precios_plan (gimnasio_id, plan_id, monto, vigente_desde) values ($1,$2,20000,'2020-01-01')`, [t.g, plan]);
  const socio = async (n, vencioHace) => {
    const [{ id: s }] = await t.q(`insert into public.socios (gimnasio_id, nombre, apellido) values ($1,'Pago',$2) returning id`, [t.g, n]);
    const [{ id: su }] = await t.q(`insert into public.suscripciones (gimnasio_id, socio_id, plan_id, inicio) values ($1,$2,$3, now() - interval '90 days') returning id`, [t.g, s, plan]);
    if (vencioHace != null) await t.q(`insert into public.coberturas (gimnasio_id, suscripcion_id, socio_id, desde, hasta, origen, motivo)
      values ($1,$2,$3, privado.medianoche(privado.dia_local(now(), $4) - $5::int - 30, $4), privado.medianoche(privado.dia_local(now(), $4) - $5::int, $4), 'cortesia', 'prueba')`, [t.g, su, s, t.ctx.zona, vencioHace]);
    return s;
  };
  tarde = await socio("Tarde", 14);   // 15 días de atraso
  justo = await socio("Justo", 9);    // 10 días: todavía no
  nuevo = await socio("Nuevo", null);
});
after(async () => t && t.cerrar());
async function como(u, fn) {
  await t.db.query("set role authenticated");
  await t.q(`select set_config('request.jwt.claims', $1, false)`, [JSON.stringify({ sub: u, role: "authenticated" })]);
  try { return await fn(); } finally { await t.db.query("reset role"); await t.q(`select set_config('request.jwt.claims', '', false)`); }
}
const precios = async (s) => (await t.q(`select public.precios_venta($1, $2) as p`, [t.sede, s]))[0].p;
const vender = (s, items, monto) => t.q(`select public.vender($1, $2, $3, $4, null) as r`, [t.sede, JSON.stringify(items), JSON.stringify(monto ? [{ medio: "transferencia", monto }] : []), s]);

test("apagado por defecto; la dueña lo prende con reglas claras", async () => {
  await como(uRec, async () => assert.equal((await precios(tarde)).recargo, null));
  await como(uDueno, async () => {
    const guardar = (d) => t.q(`select public.guardar_configuracion($1, $2)`, [t.g, d]);
    await t.falla(() => guardar({ recargo_tipo: "porcentaje" }), /poné de cuánto/);
    await t.falla(() => guardar({ recargo_tipo: "porcentaje", recargo_valor: 80 }), /hasta 50/);
    await t.falla(() => guardar({ recargo_tipo: "cualquiera" }), /elegí sin recargo/);
    await guardar({ recargo_tipo: "porcentaje", recargo_valor: 10, recargo_dias: 10 });
    const [{ c }] = await t.q(`select public.configuracion_panel($1) as c`, [t.g]);
    assert.equal(c.recargo_tipo, "porcentaje"); assert.equal(Number(c.recargo_valor), 10);
  });
});

test("Vender lo muestra y lo exige con la cuota; no cobrarlo es un descuento con tope", async () => {
  await como(uRec, async () => {
    const p = await precios(tarde);
    assert.equal(Number(p.recargo.monto), 2000); assert.equal(p.recargo.atraso, 15);
    assert.equal((await precios(justo)).recargo, null);
    assert.equal((await precios(nuevo)).recargo, null);
    await t.falla(() => vender(tarde, [{ tipo: "cuota" }], 20000), /Falta el recargo por pagar tarde \(\$2\.000\)/);
    await t.falla(() => vender(tarde, [{ tipo: "cuota" }, { tipo: "recargo", descuento: 2000, descuento_motivo: "Amigo o familiar del gimnasio" }], 20000), /descuento máximo/);
    await t.falla(() => vender(justo, [{ tipo: "cuota" }, { tipo: "recargo" }], 22000), /no tiene recargo/);
  });
  await como(uDueno, async () => {
    const [{ r }] = await vender(tarde, [{ tipo: "cuota" }, { tipo: "recargo", descuento: 2000, descuento_motivo: "Amigo o familiar del gimnasio" }], 20000);
    assert.equal(Number(r.total), 20000);
    const [{ d, tipo }] = await t.q(`select descripcion as d, tipo from public.venta_items where venta_id = $1 and tipo = 'adicional'`, [r.venta_id]);
    assert.equal(tipo, "adicional"); assert.match(d, /Recargo por pagar tarde \(15 días\)/);
  });
  // Ya pagó: no debe más.
  await como(uRec, async () => assert.equal((await precios(tarde)).recargo, null));
});

test("monto fijo y la recepción lo cobra entero", async () => {
  await como(uDueno, () => t.q(`select public.guardar_configuracion($1, $2)`, [t.g, { recargo_tipo: "monto", recargo_valor: 1500 }]));
  const [{ r }] = await como(uRec, () => vender(justo, [{ tipo: "cuota" }], 20000));
  assert.equal(Number(r.total), 20000);   // a 10 días: sin recargo
  await como(uDueno, () => t.q(`select public.guardar_configuracion($1, $2)`, [t.g, { recargo_tipo: "no" }]));
  const [c] = await t.q(`select recargo_tipo, recargo_valor::text as v from public.configuracion_gimnasio where gimnasio_id = $1`, [t.g]);
  assert.deepEqual(c, { recargo_tipo: "no", v: "0.00" });
});
