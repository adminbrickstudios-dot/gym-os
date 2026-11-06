// MercadoPago: reembolso, contracargo y conciliación (0068, VD-46A). Con eventos simulados (no se llama a
// MercadoPago): un pago aprobado + charged_back/refunded pasa a 'devuelto', anula la venta con motivo y retira la
// cobertura (el socio vuelve a como estaba); el hecho original se conserva; un approved posterior a un refunded se
// ignora; el reembolso parcial solo avisa; revertir es solo de la clave de servicio; la reconsulta se sella.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir } from "./_comun.mjs";

let t, u = {}, socio, colorAntes, cobAntes;
const T0 = Date.now(); const F = (h) => new Date(T0 + h * 3600e3).toISOString();   // fechas de MercadoPago relativas a hoy
const TOKEN = "TEST-1234567890123456-abcdefABCDEF-1234567890";
async function persona(rol) {
  const [{ id }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`${rol}${Math.random()}@ejemplo.invalid`]);
  await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,$3,$4)`, [t.g, id, `P ${rol}`, rol]);
  return id;
}
async function como(usuario, fn, rol = "authenticated") {
  await t.db.query(`set role ${rol}`);
  await t.q(`select set_config('request.jwt.claims', $1, false)`, [JSON.stringify({ sub: usuario, role: rol })]);
  try { return await fn(); } finally { await t.db.query("reset role"); await t.q(`select set_config('request.jwt.claims', '', false)`); }
}
const servicio = async (sql, args) => (await como(null, () => t.q(sql, args), "service_role"))[0];
const acreditar = async (pago, idMp, estado, { fecha = null, reembolsado = null, monto } = {}) =>
  (await servicio(`select public.acreditar_pago_mp($1, $2, $3, $4, $5, $6) as r`, [pago.pago_id, idMp, monto ?? pago.monto, estado, fecha, reembolsado])).r;
const iniciar = async () => (await como(u.socio, () => t.q(`select public.iniciar_pago_online($1) as p`, [socio])))[0].p;
const vigentes = async () => Number((await t.q(`select count(*) n from public.coberturas where socio_id = $1 and anulada_en is null`, [socio]))[0].n);
const color = async () => (await como(u.dueno, () => t.q(`select (public.estado_acceso($1)).color as c`, [socio])))[0].c;
const pagoDe = async (id) => (await t.q(`select p.*, v.estado as venta_estado, v.anulada_origen, v.anulada_por, v.anulada_motivo from public.pagos p join public.ventas v on v.id = p.venta_id where p.id = $1`, [id]))[0];

before(async () => {
  t = await abrir("prueba-mp-devoluciones");
  u.dueno = await persona("dueno"); u.encargado = await persona("encargado"); u.recepcion = await persona("recepcion");
  const [{ id }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`socio${Math.random()}@ejemplo.invalid`]);
  u.socio = id;
  [{ id: socio }] = await t.q(`update public.socios set usuario_id = $2 where gimnasio_id = $1 and nombre = 'Testigo' and apellido = 'Al Día' returning id`, [t.g, id]);
  await como(u.dueno, () => t.q(`select public.guardar_mercadopago($1, $2, $3, 'prueba')`, [t.g, TOKEN, "s".repeat(32)]));
  colorAntes = await color();
  cobAntes = await vigentes();
});
after(async () => t && t.cerrar());

test("contracargo de un pago aprobado: pasa a devuelto, anula la venta y retira la cobertura; el hecho se conserva", async () => {
  const p = await iniciar();
  assert.equal(await acreditar(p, "880001", "approved", { fecha: F(2) }), "acreditado");
  assert.equal(await vigentes(), cobAntes + 1, "el pago acreditado sumó su cobertura");
  assert.equal(await acreditar(p, "880001", "approved", { fecha: F(2) }), "ya_acreditado");

  assert.equal(await acreditar(p, "880001", "charged_back", { fecha: F(23) }), "devuelto");
  const d = await pagoDe(p.pago_id);
  assert.equal(d.estado, "devuelto");
  assert.equal(d.mp_pago_id, "880001", "el ID de MercadoPago se conserva");
  assert.ok(d.aprobado_en, "cuándo se aprobó se conserva");
  assert.ok(d.devuelto_en); assert.match(d.devuelto_motivo, /contracargo/);
  assert.equal(d.venta_estado, "anulada"); assert.equal(d.anulada_origen, "mercadopago"); assert.equal(d.anulada_por, null);
  assert.match(d.anulada_motivo, /contracargo/);
  assert.equal(await vigentes(), cobAntes, "la cobertura se retiró");
  assert.equal(await color(), colorAntes, "el socio vuelve a como estaba");
  const [{ n }] = await t.q(`select count(*)::int n from public.coberturas where socio_id = $1 and anulada_en is not null and anulada_motivo like 'Venta anulada: MercadoPago%'`, [socio]);
  assert.ok(n >= 1, "la cobertura quedó anulada con motivo, no borrada");

  // Repetido, y un approved tardío (más viejo o sin fecha) no revive nada.
  assert.equal(await acreditar(p, "880001", "charged_back", { fecha: F(23) }), "ya_devuelto");
  assert.equal(await acreditar(p, "880001", "approved", { fecha: F(2) }), "ignorado_viejo");
  assert.equal(await acreditar(p, "880001", "approved"), "ya_devuelto");
  assert.equal(await vigentes(), cobAntes);
  assert.equal((await pagoDe(p.pago_id)).estado, "devuelto");
});

test("un approved que llega después de un refunded (el pago nunca se había acreditado) se ignora", async () => {
  const p = await iniciar();
  assert.equal(await acreditar(p, "880002", "refunded", { fecha: F(24) }), "rechazado");
  assert.equal(await acreditar(p, "880002", "approved", { fecha: F(0) }), "ignorado_viejo");
  assert.equal(await acreditar(p, "880002", "approved"), "ya_rechazado");
  assert.equal(await vigentes(), cobAntes, "no se acreditó");
  assert.equal((await pagoDe(p.pago_id)).estado, "rechazado");
});

test("reembolso parcial: no toca la cobertura, queda anotado; el reembolso total sí la retira", async () => {
  const p = await iniciar();
  assert.equal(await acreditar(p, "880003", "approved", { fecha: F(0) }), "acreditado");
  const mitad = Number(p.monto) / 2;
  assert.equal(await acreditar(p, "880003", "approved", { fecha: F(1), reembolsado: mitad }), "reembolso_parcial");
  assert.equal(await acreditar(p, "880003", "approved", { fecha: F(1.5), reembolsado: mitad }), "ya_acreditado", "el mismo parcial no se anota dos veces");
  assert.equal(await vigentes(), cobAntes + 1, "la cobertura sigue");
  assert.equal(Number((await pagoDe(p.pago_id)).mp_reembolsado), mitad);
  const av = (await como(u.dueno, () => t.q(`select public.avisos_pagos_mp($1) as a`, [t.g])))[0].a;
  assert.ok(av.items.some((i) => i.clave.startsWith(`pago_mp:${p.pago_id}:parcial`)), "el dueño ve la devolución parcial");
  assert.equal(await acreditar(p, "880003", "approved", { fecha: F(2), reembolsado: Number(p.monto) }), "devuelto");
  assert.equal(await vigentes(), cobAntes);
  assert.equal(await color(), colorAntes);
});

test("si la venta tenía otro pago aprobado no se anula sola: el pago queda devuelto y se avisa para revisar a mano", async () => {
  const p = await iniciar();
  assert.equal(await acreditar(p, "880004", "approved", { fecha: F(0) }), "acreditado");
  const [{ venta_id }] = await t.q(`select venta_id from public.pagos where id = $1`, [p.pago_id]);
  await t.q(`insert into public.pagos (gimnasio_id, venta_id, medio, monto, estado, aprobado_en) values ($1, $2, 'transferencia', 1000, 'aprobado', now())`, [t.g, venta_id]);
  assert.equal(await acreditar(p, "880004", "refunded", { fecha: F(24) }), "devuelto_revisar");
  const d = await pagoDe(p.pago_id);
  assert.equal(d.estado, "devuelto"); assert.notEqual(d.venta_estado, "anulada");
  assert.equal(await vigentes(), cobAntes + 1, "la cobertura sigue hasta que el dueño decida");
  const av = (await como(u.dueno, () => t.q(`select public.avisos_pagos_mp($1) as a`, [t.g])))[0].a;
  const item = av.items.find((i) => i.clave === `pago_mp:${p.pago_id}:devuelto`);
  assert.ok(item); assert.match(item.detalle, /revisala a mano/);
});

test("las alertas al dueño: las ven el dueño y el encargado, no la recepción ni el socio", async () => {
  const av = (await como(u.dueno, () => t.q(`select public.avisos_pagos_mp($1) as a`, [t.g])))[0].a;
  const dev = av.items.find((i) => /Contracargo/.test(i.titulo));
  assert.ok(dev, "el contracargo aparece"); assert.match(dev.href, /^\/socios\//); assert.equal(dev.leido, false);
  assert.ok(av.sin_leer >= 1);
  await como(u.encargado, () => t.q(`select public.avisos_pagos_mp($1)`, [t.g]));
  await como(u.recepcion, () => t.falla(() => t.q(`select public.avisos_pagos_mp($1)`, [t.g]), /permiso/i));
  await como(u.socio, () => t.falla(() => t.q(`select public.avisos_pagos_mp($1)`, [t.g]), /permiso/i));
});

test("revertir es solo de la clave de servicio: ni el dueño ni el navegador", async () => {
  const p = await iniciar();
  assert.equal(await acreditar(p, "880005", "approved", { fecha: F(0) }), "acreditado");
  for (const rol of [u.dueno, u.encargado, u.socio]) {
    await como(rol, () => t.falla(() => t.q(`select public.revertir_pago_mp($1, '880005', 'charged_back', null)`, [p.pago_id]), /permission denied/));
    await como(rol, () => t.falla(() => t.q(`select public.acreditar_pago_mp($1, '880005', 1, 'charged_back')`, [p.pago_id]), /permission denied/));
    await como(rol, () => t.falla(() => t.q(`select public.revisar_pagos_mp($1, null)`, [t.g]), /permission denied/));
  }
  await como(null, () => t.falla(() => t.q(`select public.revertir_pago_mp($1, '880005', 'approved', null)`, [p.pago_id]), /inválido/), "service_role");
  await como(null, () => t.falla(() => t.q(`select public.revertir_pago_mp($1, 'otro-id', 'charged_back', null)`, [p.pago_id]), /otro ID/), "service_role");
  assert.equal((await pagoDe(p.pago_id)).estado, "aprobado", "nada cambió");
  assert.equal(await acreditar(p, "880005", "charged_back"), "devuelto");
  assert.equal(await acreditar(p, "880005", "charged_back"), "ya_devuelto");
});

test("conciliación sin cron: lo colgado de más de 15 minutos se lista una vez y se sella", async () => {
  const p = await iniciar();
  const lista = async () => (await servicio(`select public.revisar_pagos_mp($1, $2) as r`, [t.g, p.pago_id])).r;
  assert.deepEqual(await lista(), [], "recién creado: todavía no");
  await como(u.socio, async () => assert.equal((await t.q(`select public.pago_online_revisable($1) as r`, [p.pago_id]))[0].r.revisable, false));
  await t.q(`update public.pagos set creado_en = now() - interval '20 minutes' where id = $1`, [p.pago_id]);
  await como(u.socio, async () => assert.equal((await t.q(`select public.pago_online_revisable($1) as r`, [p.pago_id]))[0].r.revisable, true));
  await como(u.encargado, () => t.falla(() => t.q(`select public.pago_online_revisable($1)`, [p.pago_id]), /Sin permiso/));
  const uno = await lista();
  assert.equal(uno.length, 1); assert.equal(uno[0].pago_id, p.pago_id); assert.equal(uno[0].mp_pago_id, null);
  assert.deepEqual(await lista(), [], "sellado: no se reconsulta lo mismo dos veces en un minuto");
  const toda = (await servicio(`select public.revisar_pagos_mp($1) as r`, [t.g])).r;
  assert.ok(!toda.some((x) => x.pago_id === p.pago_id), "el sellado también vale para la revisión general");
  // Un aprobado reciente entra en la revisión general (por si se perdió el aviso de una devolución).
  assert.equal(await acreditar(p, "880006", "approved", { fecha: F(0) }), "acreditado");
  await t.q(`update public.pagos set mp_revisado_en = null where id = $1`, [p.pago_id]);
  const general = (await servicio(`select public.revisar_pagos_mp($1) as r`, [t.g])).r;
  const mio = general.find((x) => x.pago_id === p.pago_id);
  assert.ok(mio); assert.equal(mio.mp_pago_id, "880006"); assert.equal(mio.estado, "aprobado");
});

test("el evento de MercadoPago es idempotente por ID externo y por estado", async () => {
  const ev = (clave) => servicio(`select public.registrar_evento_webhook('mp_cobros', 'payment', $1, $2, '{}') as r`, [clave, t.g]);
  const a = (await ev("880001:approved")).r, b = (await ev("880001:charged_back")).r, c = (await ev("880001:charged_back")).r;
  assert.equal(a.nuevo, true); assert.equal(b.nuevo, true, "otro estado del mismo pago es otro evento");
  assert.equal(c.nuevo, false); assert.equal(c.evento_id, b.evento_id);
});
