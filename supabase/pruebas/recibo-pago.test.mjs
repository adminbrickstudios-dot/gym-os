// VD-56: recibo de cada pago. El número se asigna una sola vez al cobrar, sin saltos y por gimnasio; el recibo sale de los hechos
// (ítems con descuento, medios, quién cobró, fecha en hora del gimnasio); la venta anulada lo dice; el equipo ve los del gimnasio
// y el socio solo los suyos; el motivo interno de la anulación no llega al socio.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir } from "./_comun.mjs";

let t, u = {}, eq = {}, socio, uSocio, uOtro, g2;
async function crear(rol, nombre, gimnasio = null) {
  const [{ id }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`${rol}${Math.random()}@ejemplo.invalid`]);
  const [{ e }] = await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,$3,$4) returning id as e`, [gimnasio ?? t.g, id, nombre, rol]);
  return [id, e];
}
async function como(usuario, fn) {
  await t.db.query("set role authenticated");
  await t.q(`select set_config('request.jwt.claims', $1, false)`, [JSON.stringify({ sub: usuario, role: "authenticated" })]);
  try { return await fn(); } finally { await t.db.query("reset role").catch(() => {}); await t.q(`select set_config('request.jwt.claims', '', false)`).catch(() => {}); }
}
/** Una venta con un ítem (precio, descuento) y un pago aprobado, en el estado dado. */
async function venta({ gimnasio = t.g, sede = t.sede, socioId = socio, estado = "confirmada", cobro = eq.Rita, confirmada = "2026-11-05T22:30:00Z", items = [["Cuota mensual", 1, 10000, 0]], pagos = [["transferencia", 10000]] } = {}) {
  const [{ id }] = await t.q(`insert into public.ventas (gimnasio_id, sede_id, socio_id, origen, estado, confirmada_en, creado_por) values ($1,$2,$3,'recepcion','pendiente',null,$4) returning id`, [gimnasio, sede, socioId, cobro]);
  for (const [d, c, p, desc] of items) {
    await t.q(`insert into public.venta_items (gimnasio_id, venta_id, tipo, descripcion, cantidad, precio_unitario, descuento, descuento_motivo) values ($1,$2,'otro',$3,$4,$5,$6,$7)`, [gimnasio, id, d, c, p, desc, desc > 0 ? "promo" : null]);
  }
  for (const [m, monto] of pagos) {
    await t.q(`insert into public.pagos (gimnasio_id, venta_id, medio, monto, estado, aprobado_en) values ($1,$2,$3,$4,'aprobado',$5)`, [gimnasio, id, m, monto, confirmada]);
  }
  if (estado !== "pendiente") await t.q(`update public.ventas set estado = 'confirmada', confirmada_en = $2 where id = $1`, [id, confirmada]);
  return id;
}
const numero = async (v) => (await t.q(`select numero from public.recibos where venta_id = $1`, [v]))[0]?.numero;

before(async () => {
  t = await abrir("prueba-recibo");
  for (const [rol, nombre] of [["dueno", "Sofía"], ["encargado", "Enzo"], ["recepcion", "Rita"], ["profe", "Pablo"]]) {
    const [usuario, equipo] = await crear(rol, nombre);
    u[nombre] = usuario; eq[nombre] = equipo;
  }
  await t.q(`update public.sedes set direccion = 'Av. Siempre Viva 742', telefono = '+5490001112222' where id = $1`, [t.sede]);
});
after(async () => t && t.cerrar());

test("setup de socios", async () => {
  [{ id: uSocio }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`s${Math.random()}@ejemplo.invalid`]);
  [{ id: uOtro }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`o${Math.random()}@ejemplo.invalid`]);
  [{ id: socio }] = await t.q(`insert into public.socios (gimnasio_id, nombre, apellido, dni, telefono, usuario_id) values ($1,'Lucía','Pérez','30111222','+5490001112233',$2) returning id`, [t.g, uSocio]);
  await t.q(`insert into public.socios (gimnasio_id, nombre, apellido, usuario_id) values ($1,'Otro','Socio',$2) returning id`, [t.g, uOtro]);
});

test("el número se asigna una sola vez al cobrar, correlativo y sin saltos, por gimnasio", async () => {
  const base = Number((await t.q(`select coalesce(max(numero), 0) m from public.recibos where gimnasio_id = $1`, [t.g]))[0].m);
  const pendiente = await venta({ estado: "pendiente" });
  assert.equal(await numero(pendiente), undefined);   // sin cobrar no hay recibo
  const v1 = await venta(), v2 = await venta();
  assert.equal(await numero(v1), base + 1);
  assert.equal(await numero(v2), base + 2);
  // Una venta que se arma y se revierte no deja hueco.
  await t.db.query("savepoint s");
  await venta();
  await t.db.query("rollback to savepoint s");
  const v3 = await venta();
  assert.equal(await numero(v3), base + 3);
  // Confirmar la pendiente le da el 4; volver a tocar la venta no cambia el número.
  await t.q(`update public.ventas set estado = 'confirmada', confirmada_en = now() where id = $1`, [pendiente]);
  assert.equal(await numero(pendiente), base + 4);
  await t.q(`update public.ventas set estado = 'anulada', anulada_en = now(), anulada_motivo = 'error', anulada_por = $2 where id = $1`, [v1, eq.Sofía]);
  assert.equal(await numero(v1), base + 1);   // el anulado conserva su número; no se reusa
  const v5 = await venta();
  assert.equal(await numero(v5), base + 5);
  // Otro gimnasio cuenta aparte.
  [{ id: g2 }] = await t.q(`insert into public.gimnasios (slug, nombre) values ('otro-recibo', 'Otro gimnasio') returning id`);
  const [{ id: sede2 }] = await t.q(`select id from public.sedes where gimnasio_id = $1`, [g2]);
  const [, eq2] = await crear("dueno", "Dueña de otro", g2);
  const w = await venta({ gimnasio: g2, sede: sede2, socioId: null, cobro: eq2 });
  assert.equal(await numero(w), 1);
  await t.falla(() => t.q(`delete from public.recibos where venta_id = $1`, [v1]), /no se borran/);
  await t.falla(() => t.q(`update public.recibos set numero = 99 where venta_id = $1`, [v1]), /solo se puede cambiar/);
  const [{ n, m }] = await t.q(`select count(*)::int n, max(numero) m from public.recibos where gimnasio_id = $1`, [t.g]);
  assert.equal(n, m);   // sin saltos
});

test("el recibo trae todo armado desde los hechos: ítems con descuento, medio, quién cobró, fecha en hora del gimnasio, sede y marca", async () => {
  const v = await venta({ items: [["Cuota mensual", 1, 10000, 1000], ["Agua", 2, 1500, 0]], pagos: [["debito", 5000], ["transferencia", 7000]], confirmada: "2026-11-05T22:30:00Z" });
  const r = await como(u["Rita"], async () => (await t.q(`select public.recibo_venta($1) as r`, [v]))[0].r);
  assert.equal(r.anulado, false);
  assert.equal(r.numero_texto, String(r.numero).padStart(8, "0"));
  assert.equal(r.fecha, "05/11/2026 19:30");    // 22:30 UTC = 19:30 en Buenos Aires
  assert.equal(Number(r.total), 12000);          // 10.000 - 1.000 de descuento + 2 × 1.500
  assert.deepEqual(r.items.map((i) => [i.descripcion, Number(i.subtotal)]), [["Agua", 3000], ["Cuota mensual", 9000]]);
  assert.deepEqual(r.pagos.map((p) => [p.medio, Number(p.monto)]).sort(), [["debito", 5000], ["transferencia", 7000]]);
  assert.equal(r.cobro, "Rita");
  assert.equal(r.gimnasio.nombre, "Gimnasio de Prueba");
  assert.equal(r.sede.direccion, "Av. Siempre Viva 742");
  assert.equal(r.socio.nombre, "Lucía Pérez");
  assert.equal(r.telefono, "+5490001112233");    // el equipo lo necesita para mandarlo por WhatsApp
  assert.equal(r.anulacion, null);
  assert.ok(!("cuit" in r.gimnasio));            // no se inventa lo que no existe en los datos
});

test("anulado: el recibo lo dice; el motivo interno lo ve el equipo, no el socio", async () => {
  const v = await venta();
  await t.q(`update public.ventas set estado = 'anulada', anulada_en = '2026-11-06T15:00:00Z', anulada_motivo = 'se cobró dos veces', anulada_por = $2 where id = $1`, [v, eq.Sofía]);
  const equipo = await como(u["Enzo"], async () => (await t.q(`select public.recibo_venta($1) as r`, [v]))[0].r);
  assert.equal(equipo.anulado, true);
  assert.equal(equipo.anulacion.motivo, "se cobró dos veces");
  assert.equal(equipo.anulacion.fecha, "06/11/2026 12:00");
  const suyo = await como(uSocio, async () => (await t.q(`select public.recibo_venta($1) as r`, [v]))[0].r);
  assert.equal(suyo.anulado, true);
  assert.equal(suyo.anulacion.motivo, null);
  assert.equal(suyo.telefono, null);
});

test("quién lo ve: dueño, encargado y recepción; el socio solo los suyos; el profe, otro socio y otro gimnasio no", async () => {
  const v = await venta();
  for (const quien of ["Sofía", "Enzo", "Rita"]) {
    const r = await como(u[quien], async () => (await t.q(`select public.recibo_venta($1) as r`, [v]))[0].r);
    assert.equal(r.socio.nombre, "Lucía Pérez");
  }
  assert.equal((await como(uSocio, async () => (await t.q(`select public.recibo_venta($1) as r`, [v]))[0].r)).socio.nombre, "Lucía Pérez");
  await como(u["Pablo"], () => t.falla(() => t.q(`select public.recibo_venta($1)`, [v]), /Sin permiso/));
  await como(uOtro, () => t.falla(() => t.q(`select public.recibo_venta($1)`, [v]), /Sin permiso/));
  const [uAjeno] = await crear("dueno", "Ajeno", g2);
  await como(uAjeno, () => t.falla(() => t.q(`select public.recibo_venta($1)`, [v]), /Sin permiso/));
  // Una venta sin socio (mostrador) solo la ve el equipo.
  const sinSocio = await venta({ socioId: null });
  await como(uSocio, () => t.falla(() => t.q(`select public.recibo_venta($1)`, [sinSocio]), /Sin permiso/));
  assert.equal((await como(u["Rita"], async () => (await t.q(`select public.recibo_venta($1) as r`, [sinSocio]))[0].r)).socio, null);
  // Sin cobrar no hay recibo, ni para el equipo.
  const pendiente = await venta({ estado: "pendiente" });
  await como(u["Rita"], () => t.falla(() => t.q(`select public.recibo_venta($1)`, [pendiente]), /no tiene recibo/));
  await como(u["Rita"], async () => {
    await t.falla(() => t.q(`select * from public.recibos`), /permission denied/);
    await t.falla(() => t.q(`select * from public.contadores_recibo`), /permission denied/);
  });
  const anon = await t.q(`select has_function_privilege('anon', 'public.recibo_venta(uuid)', 'execute') as p`);
  assert.equal(anon[0].p, false);
});

test("la ficha y la app enganchan el recibo (recibo_n en la venta, venta_id en el historial del socio)", async () => {
  const v = await venta();
  const ventas = await como(u["Sofía"], async () => (await t.q(`select public.ventas_socio($1) as r`, [socio]))[0].r);
  const fila = ventas.find((x) => x.venta_id === v);
  assert.equal(fila.recibo_n, await numero(v));
  const h = await como(uSocio, async () => (await t.q(`select public.mi_historial($1) as h`, [socio]))[0].h);
  const pago = h.pagos.find((p) => p.venta_id === v);
  assert.equal(pago.recibo, true);
});
