// N10 · Cuánto deja un socio y cuánto dura (función nueva `valor_del_socio`, apagada por defecto), con números fijos.
//   DB_PRUEBAS_URL=postgres://... node --test supabase/pruebas/valor-del-socio.test.mjs
//
// Gimnasio propio y vacío (sin los casos testigo), cuota de $30.000 por mes. Los momentos son fijos: nada depende de now().
//   A  3 cuotas (1/9, 1/10, 1/11): cobertura hasta el 1/12. Sigue.
//   B  2 cuotas (20/8, 20/9): cobertura hasta el 20/10. Se fue: duró 61 días.
//   C  3 cuotas en enero a marzo (fuera de la ventana): cobertura hasta el 5/4. Se fue: duró 90 días.
//   D  sin membresía: compró algo por $8.000 el 10/10. Pagó, pero no tiene cobertura.
//   E  2 cuotas (1/9, 1/10), dado de baja el 15/10 con la cobertura corriendo hasta el 1/11. Se fue: duró 44 días (cuenta hasta la baja).
//   F  una venta sin socio por $10.000 (no suma). G  un pago en cuenta corriente de A por $5.000 (no suma).
//   H  solo una cortesía en julio (no es plata ni cuenta para cuánto dura).
// Momento 1 = 14/11 19:00 → ventana 90 días (desde el 16/8): cobraron A 90.000 + B 60.000 + E 60.000 + D 8.000 = 218.000 entre 4 socios
//   → 218.000 / 4 / 3 = 18.166,67 → $18.167 por mes. Se fueron B, C y E: (61 + 90 + 44) / 3 = 65 días → 2,2 meses.
// Momento 2 = 10/12 19:00 → ventana desde el 11/9: A 60.000 + B 30.000 + E 30.000 + D 8.000 = 128.000 entre 4 → 10.666,67 → $10.667.
//   Se fueron además A (91 días): (61 + 90 + 44 + 91) / 4 = 71,5 días → 2,4 meses.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import pg from "pg";

const URL = process.env.DB_PRUEBAS_URL;
let db, g, sede, zona, plan, dueno, recepcion, duenoOtro, otroGim;
const q = async (sql, params) => (await db.query(sql, params)).rows;
const uno = async (sql, p) => (await q(sql, p))[0];
const en = async (dia, hora = "10:00:00") => (await uno(`select privado.medianoche($1::date, $2) + $3::interval as t`, [dia, zona, hora])).t;
async function como(usuario, fn) {
  await db.query("set role authenticated");
  await q(`select set_config('request.jwt.claims', $1, false)`, [JSON.stringify({ sub: usuario, role: "authenticated" })]);
  try { return await fn(); } finally { await db.query("reset role"); await q(`select set_config('request.jwt.claims', '', false)`); }
}
async function falla(fn, patron) {
  await db.query("savepoint f");
  try { await fn(); } catch (e) { await db.query("rollback to savepoint f"); if (patron) assert.match(e.message, patron); return; }
  await db.query("rollback to savepoint f");
  assert.fail("se esperaba un error");
}
const persona = async (pref) => (await uno(`insert into auth.users (email) values ($1) returning id`, [`${pref}${Math.random().toString().slice(2, 10)}@ejemplo.invalid`])).id;
const socio = async (nombre) => (await uno(`insert into public.socios (gimnasio_id, nombre, apellido, telefono) values ($1, $2, 'Valor', $3) returning id`, [g, nombre, `+54900${Math.random().toString().slice(2, 9)}`])).id;

async function venta(socioId, dia, monto, { medio = "transferencia", tipo = "cuota", suscripcion = null, planId = null } = {}) {
  const cuando = await en(dia);
  const { id } = await uno(`insert into public.ventas (gimnasio_id, sede_id, socio_id, estado, origen, confirmada_en, creado_en) values ($1,$2,$3,'confirmada','recepcion',$4,$4) returning id`, [g, sede, socioId, cuando]);
  const item = await uno(`insert into public.venta_items (gimnasio_id, venta_id, tipo, plan_id, suscripcion_id, descripcion, precio_unitario) values ($1,$2,$3,$4,$5,'x',$6) returning id`, [g, id, tipo, planId, suscripcion, monto]);
  await q(`insert into public.pagos (gimnasio_id, venta_id, medio, monto, estado, aprobado_en, creado_en) values ($1,$2,$3,$4,'aprobado',$5,$5)`, [g, id, medio, monto, cuando]);
  return item.id;
}
/** Una cuota pagada el día `pago` que cubre [desde, hasta). */
async function cuota(socioId, sub, pago, desde, hasta) {
  const item = await venta(socioId, pago, 30000, { suscripcion: sub, planId: plan });
  await q(`insert into public.coberturas (gimnasio_id, suscripcion_id, socio_id, desde, hasta, origen, venta_item_id) values ($1,$2,$3,$4,$5,'pago',$6)`, [g, sub, socioId, await en(desde, "00:00:00"), await en(hasta, "00:00:00"), item]);
}
const suscripcion = async (socioId) => (await uno(`insert into public.suscripciones (gimnasio_id, socio_id, plan_id, inicio) values ($1,$2,$3,$4) returning id`, [g, socioId, plan, await en("2025-12-01", "00:00:00")])).id;
const valor = (usuario, momento) => como(usuario, async () => (await uno(`select public.valor_del_socio($1, $2) r`, [g, momento])).r);
const prender = (clave, activa) => como(dueno, () => q(`select public.cambiar_funcion_nueva($1, $2, $3)`, [g, clave, activa]));

before(async () => {
  if (!URL) throw new Error("Falta DB_PRUEBAS_URL");
  db = new pg.Client({ connectionString: URL }); await db.connect(); await db.query("begin");
  [{ id: g }] = await q(`insert into public.gimnasios (slug, nombre) values ('prueba-valor-socio', 'Prueba valor del socio') returning id`);
  [{ id: sede }] = await q(`select id from public.sedes where gimnasio_id = $1`, [g]);
  zona = (await uno(`select zona_horaria from public.gimnasios where id = $1`, [g])).zona_horaria;
  plan = (await uno(`insert into public.planes (gimnasio_id, tipo, nombre, duracion_meses, renovacion) values ($1,'membresia','Plan Valor',1,'continua') returning id`, [g])).id;
  dueno = await persona("dueno"); recepcion = await persona("recepcion");
  await q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,'Dueña','dueno'), ($1,$3,'Recepción','recepcion')`, [g, dueno, recepcion]);
  [{ id: otroGim }] = await q(`insert into public.gimnasios (slug, nombre) values ('prueba-valor-otro', 'Otro') returning id`);
  duenoOtro = await persona("duenootro");
  await q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,'Dueño de otro','dueno')`, [otroGim, duenoOtro]);

  const A = await socio("A"), B = await socio("B"), C = await socio("C"), D = await socio("D"), E = await socio("E"), H = await socio("H");
  const sA = await suscripcion(A);
  await cuota(A, sA, "2026-09-01", "2026-09-01", "2026-10-01"); await cuota(A, sA, "2026-10-01", "2026-10-01", "2026-11-01"); await cuota(A, sA, "2026-11-01", "2026-11-01", "2026-12-01");
  const sB = await suscripcion(B);
  await cuota(B, sB, "2026-08-20", "2026-08-20", "2026-09-20"); await cuota(B, sB, "2026-09-20", "2026-09-20", "2026-10-20");
  const sC = await suscripcion(C);
  await cuota(C, sC, "2026-01-05", "2026-01-05", "2026-02-05"); await cuota(C, sC, "2026-02-05", "2026-02-05", "2026-03-05"); await cuota(C, sC, "2026-03-05", "2026-03-05", "2026-04-05");
  await venta(D, "2026-10-10", 8000, { medio: "efectivo", tipo: "otro" });
  const sE = await suscripcion(E);
  await cuota(E, sE, "2026-09-01", "2026-09-01", "2026-10-01"); await cuota(E, sE, "2026-10-01", "2026-10-01", "2026-11-01");
  await q(`update public.socios set dado_de_baja_en = $2, motivo_baja = 'otro' where id = $1`, [E, await en("2026-10-15")]);
  await venta(null, "2026-10-10", 10000, { medio: "efectivo", tipo: "otro" });                                  // F
  await venta(A, "2026-10-12", 5000, { medio: "cuenta_corriente", tipo: "otro" });                             // G
  const sH = await suscripcion(H);
  await q(`insert into public.coberturas (gimnasio_id, suscripcion_id, socio_id, desde, hasta, origen, motivo) values ($1,$2,$3,$4,$5,'cortesia','Prueba')`, [g, sH, H, await en("2026-07-01", "00:00:00"), await en("2026-08-01", "00:00:00")]);
});
after(async () => { if (db) { await db.query("rollback"); await db.end(); } });

test("N10 apagada por defecto: sin la función prendida es un error con su texto (no un cero), y no hay fila en ningún gimnasio", async () => {
  const M1 = await en("2026-11-14", "19:00:00");
  assert.equal((await uno(`select count(*)::int n from public.funciones_nuevas_gimnasio where gimnasio_id = $1 and clave = 'valor_del_socio'`, [g])).n, 0);
  assert.equal((await como(dueno, async () => (await uno(`select public.funciones_nuevas_activas($1) a`, [g])).a)).includes("valor_del_socio"), false);
  await como(dueno, () => falla(() => q(`select public.valor_del_socio($1, $2)`, [g, M1]), /no está prendida/));
  const catalogo = (await como(dueno, async () => (await uno(`select public.funciones_nuevas_panel($1) r`, [g])).r)).find((x) => x.clave === "valor_del_socio");
  assert.ok(catalogo && catalogo.activa === false && catalogo.plata === false && /dos números/.test(catalogo.explicacion));
});

test("N10 permisos: la recepción y el dueño de otro gimnasio no pueden ni prendida; solo el dueño la prende", async () => {
  await como(recepcion, () => falla(() => q(`select public.cambiar_funcion_nueva($1, 'valor_del_socio', true)`, [g]), /permiso|rol|acceso/i));
  await prender("valor_del_socio", true);
  const M1 = await en("2026-11-14", "19:00:00");
  await como(recepcion, () => falla(() => q(`select public.valor_del_socio($1, $2)`, [g, M1]), /permiso|rol|acceso/i));
  await como(duenoOtro, () => falla(() => q(`select public.valor_del_socio($1, $2)`, [g, M1]), /permiso|rol|acceso/i));
  await db.query("set role anon");
  await falla(() => q(`select public.valor_del_socio($1, $2)`, [g, M1]), /permission denied|permiso/i);
  await db.query("reset role");
});

test("N10 momento 1 (14/11): $18.167 por mes entre 4 socios que pagaron, y 2,2 meses entre 3 que se fueron", async () => {
  const r = await valor(dueno, await en("2026-11-14", "19:00:00"));
  assert.equal(r.ventana_dias, 90);
  assert.equal(r.socios_que_pagaron, 4, "A, B, E y D; no la venta sin socio ni la cuenta corriente");
  assert.equal(Number(r.deja_por_mes), 18167);
  assert.equal(r.socios_que_se_fueron, 3, "B, C y E; no A (sigue), ni D (sin cobertura), ni H (solo una cortesía)");
  assert.equal(Number(r.dura_meses), 2.2);
});

test("N10 momento 2 (10/12): cambia con el momento; ahora A también se fue", async () => {
  const r = await valor(dueno, await en("2026-12-10", "19:00:00"));
  assert.equal(r.ventana_dias, 90);
  assert.equal(r.socios_que_pagaron, 4);
  assert.equal(Number(r.deja_por_mes), 10667);
  assert.equal(r.socios_que_se_fueron, 4);
  assert.equal(Number(r.dura_meses), 2.4);
});

test("N10 gimnasio nuevo: con menos de 30 días cobrando la ventana no baja de 30; sin socios que se hayan ido, la duración es null (no un cero)", async () => {
  const antesDelPrimerPago = await valor(dueno, await en("2025-12-20", "12:00:00"));
  assert.equal(antesDelPrimerPago.socios_que_pagaron, 0);
  assert.equal(antesDelPrimerPago.deja_por_mes, null);
  assert.equal(antesDelPrimerPago.dura_meses, null);
  assert.equal(antesDelPrimerPago.socios_que_se_fueron, 0);
  const diezDias = await valor(dueno, await en("2026-01-15", "12:00:00"));
  assert.equal(diezDias.ventana_dias, 30, "el primer pago fue hace 10 días: se mide sobre 30");
  assert.equal(diezDias.socios_que_pagaron, 1, "solo C pagó");
  assert.equal(Number(diezDias.deja_por_mes), 30000);
  assert.equal(diezDias.dura_meses, null, "todavía no se fue nadie");
});

test("N10 no cambia ningún veredicto ni ningún cobro: el mismo momento da lo mismo y no se escribió nada", async () => {
  const antes = await uno(`select (select count(*) from public.pagos where gimnasio_id = $1)::int p, (select count(*) from public.coberturas where gimnasio_id = $1)::int c, (select count(*) from public.funciones_nuevas_gimnasio where gimnasio_id = $1)::int f`, [g]);
  const a = await valor(dueno, await en("2026-11-14", "19:00:00"));
  const b = await valor(dueno, await en("2026-11-14", "19:00:00"));
  assert.deepEqual(a, b);
  const despues = await uno(`select (select count(*) from public.pagos where gimnasio_id = $1)::int p, (select count(*) from public.coberturas where gimnasio_id = $1)::int c, (select count(*) from public.funciones_nuevas_gimnasio where gimnasio_id = $1)::int f`, [g]);
  assert.deepEqual(despues, antes);
});

test("N10 apagarla de nuevo vuelve al error (el interruptor es por gimnasio)", async () => {
  await prender("valor_del_socio", false);
  await como(dueno, () => falla(() => q(`select public.valor_del_socio($1, $2)`, [g, null]), /no está prendida/));
});
