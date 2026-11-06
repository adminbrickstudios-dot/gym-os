// VD-46L · Lo que se les debe a los socios (0074.1): usos de packs que quedan + parte de las
// cuotas pagadas que aún no pasó, al neto pagado; con momento fijo. Lo vencido, anulado o sin
// venta no suma; solo dueño y encargado (con permiso); es de solo lectura.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir } from "./_comun.mjs";

let t, u = {}, ahora, a, b, c;
async function persona(rol) {
  const [{ id }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`${rol}${Math.random()}@ejemplo.invalid`]);
  await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,$3,$4)`, [t.g, id, `P ${rol}`, rol]);
  return id;
}
async function como(usuario, fn) {
  await t.db.query("set role authenticated");
  await t.q(`select set_config('request.jwt.claims', $1, false)`, [JSON.stringify({ sub: usuario, role: "authenticated" })]);
  try { return await fn(); } finally { await t.db.query("reset role"); await t.q(`select set_config('request.jwt.claims', '', false)`); }
}
const mas = async (dias) => (await t.q(`select ($1::timestamptz + ($2 || ' days')::interval) as t`, [ahora, String(dias)]))[0].t;
async function item(tipo, plan, neto, cantidad = 1, suscripcion = null) {
  const [{ id: v }] = await t.q(`insert into public.ventas (gimnasio_id, sede_id, origen, estado, confirmada_en, creado_en) values ($1,$2,'recepcion','confirmada',$3,$3) returning id`, [t.g, t.sede, await mas(-12)]);
  return (await t.q(`insert into public.venta_items (gimnasio_id, venta_id, tipo, plan_id, descripcion, cantidad, precio_unitario, suscripcion_id) values ($1,$2,$3,$4,'x',$5,$6,$7) returning id`, [t.g, v, tipo, plan, cantidad, neto / cantidad, suscripcion]))[0].id;
}
async function socio(n) {
  const [{ id }] = await t.q(`insert into public.socios (gimnasio_id, nombre, apellido) values ($1,$2,'Deuda') returning id`, [t.g, n]);
  return id;
}
async function pack(socio, plan, cantidad, vence, venta) {
  return (await t.q(`insert into public.packs (gimnasio_id, socio_id, plan_id, cantidad, desde, vence_en, venta_item_id) values ($1,$2,$3,$4,$5,$6,$7) returning id`,
    [t.g, socio, plan, cantidad, await mas(-12), vence, venta]))[0].id;
}
async function consumir(socio, packId, veces) {
  for (let i = 0; i < veces; i++) {
    const [{ id: ing }] = await t.q(`insert into public.ingresos (gimnasio_id, sede_id, socio_id, momento, via_acceso, resultado, via_habilitante, color, motivo, texto)
      values ($1,$2,$3,$4,'recepcion','entro','pack','verde','pack','Entra con el pack') returning id`, [t.g, t.sede, socio, await mas(-5 + i)]);
    await t.q(`insert into public.consumos_pack (gimnasio_id, pack_id, socio_id, momento, ingreso_id) values ($1,$2,$3,$4,$5)`, [t.g, packId, socio, await mas(-5 + i), ing]);
  }
}
async function cobertura(socio, plan, desde, hasta, neto) {
  const [{ id: s }] = await t.q(`insert into public.suscripciones (gimnasio_id, socio_id, plan_id, inicio) values ($1,$2,$3,$4) returning id`, [t.g, socio, plan, await mas(-60)]);
  const venta = await item("cuota", plan, neto, 1, s);
  await t.q(`insert into public.coberturas (gimnasio_id, suscripcion_id, socio_id, desde, hasta, origen, venta_item_id) values ($1,$2,$3,$4,$5,'pago',$6)`, [t.g, s, socio, await mas(desde), await mas(hasta), venta]);
}

before(async () => {
  t = await abrir("prueba-deuda-socios");
  u.dueno = await persona("dueno"); u.recepcion = await persona("recepcion");
  ahora = await t.en("2026-11-14", "12:00:00");
  const [{ id: pk }] = await t.q(`insert into public.planes (gimnasio_id, tipo, nombre, cantidad_clases, consume_en) values ($1,'pack','Pack 10 deuda',10,'ingreso') returning id`, [t.g]);
  const [{ id: mem }] = await t.q(`insert into public.planes (gimnasio_id, tipo, nombre, duracion_meses, renovacion) values ($1,'membresia','Mensual deuda',1,'continua') returning id`, [t.g]);
  a = await socio("Ana"); b = await socio("Beto"); c = await socio("Cami");
  // Ana: pack de 10 por $10.000, usó 3 → le quedan 7 = $7.000. Cuota de $30.000 de hace 10 días a +20: queda 20/30 = $20.000.
  const p1 = await pack(a, pk, 10, await mas(40), await item("pack", pk, 10000));
  await consumir(a, p1, 3);
  await cobertura(a, mem, -10, 20, 30000);
  // Beto: cuota adelantada de $24.000 que empieza en 30 días (todo a favor). Un pack vencido no se debe.
  await cobertura(b, mem, 30, 60, 24000);
  await pack(b, pk, 10, await mas(-1), await item("pack", pk, 8000));
  // Cami: un pack cargado sin venta (cortesía): 5 usos que no suman plata.
  await pack(c, pk, 5, await mas(10), null);
});
after(async () => t && t.cerrar());

test("suma los usos que quedan y lo que falta de las cuotas, al neto pagado", async () => {
  const d = await como(u.dueno, async () => (await t.q(`select public.deuda_con_socios($1, $2) as d`, [t.g, ahora]))[0].d);
  assert.equal(Number(d.packs.valor), 7000); assert.equal(d.packs.usos, 12); assert.equal(d.packs.socios, 2);
  assert.equal(d.packs.usos_sin_venta, 5);
  assert.equal(Number(d.cuotas.valor), 44000); assert.equal(Number(d.cuotas.adelantadas), 24000); assert.equal(Number(d.cuotas.en_curso), 20000);
  assert.equal(d.cuotas.socios, 2);
  assert.equal(Number(d.total), 51000);
  assert.equal(d.mayores[0].nombre, "Ana Deuda"); assert.equal(Number(d.mayores[0].valor), 27000);
  assert.equal(d.mayores.length, 2);
});

test("un consumo anulado devuelve el uso; sin cobertura ni packs no hay deuda", async () => {
  await t.q(`update public.consumos_pack set anulado_en = $2 where socio_id = $1 and id = (select id from public.consumos_pack where socio_id = $1 limit 1)`, [a, ahora]);
  const d = await como(u.dueno, async () => (await t.q(`select public.deuda_con_socios($1, $2) as d`, [t.g, ahora]))[0].d);
  assert.equal(Number(d.packs.valor), 8000);
  const lejos = await como(u.dueno, async () => (await t.q(`select public.deuda_con_socios($1, $2::timestamptz + interval '3 years') as d`, [t.g, ahora]))[0].d);
  assert.equal(Number(lejos.total), 0); assert.equal(lejos.mayores.length, 0);
});

test("solo dueño y encargado; la recepción recibe un error, no un cero", async () => {
  await como(u.recepcion, () => t.falla(() => t.q(`select public.deuda_con_socios($1, $2)`, [t.g, ahora]), /Sin permiso/));
});
