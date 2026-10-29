// Pruebas de "¿puede entrar hoy?" contra una base Postgres real.
//   DB_PRUEBAS_URL=postgres://... node --test supabase/pruebas/
// Todo corre en UNA transacción que se revierte al final: la base queda
// como estaba. Nunca correr contra producción (la prueba se niega si el
// host parece de Supabase).

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import pg from "pg";
import { CASOS_TESTIGO, HORA_TESTIGO, sembrarCasos, sumarDias } from "../../scripts/datos/casos-testigo.mjs";

const URL = process.env.DB_PRUEBAS_URL;
const HOY = "2026-11-14"; // sábado
let db, g, sede, ctx, momento;

const q = async (sql, params) => (await db.query(sql, params)).rows;
const en = async (dia, hora) =>
  (await q(`select privado.medianoche($1::date, $2) + $3::interval as t`, [dia, ctx.zona, hora]))[0].t;
const acceso = async (socio, m = momento) =>
  (await q(`select (privado.calcular_acceso($1, $2, $3)).*`, [socio, m, sede]))[0];

// Ejecuta fn y espera un error; revierte solo lo de adentro.
async function falla(fn, patron) {
  await db.query("savepoint s");
  try {
    await fn();
  } catch (e) {
    await db.query("rollback to savepoint s");
    if (patron) assert.match(e.message, patron);
    return e;
  }
  await db.query("rollback to savepoint s");
  assert.fail("se esperaba un error");
}

async function comoUsuario(usuarioId, fn) {
  await db.query("savepoint u");
  try {
    await db.query(`set local role authenticated`);
    await db.query(`select set_config('request.jwt.claims', $1, true)`,
      [JSON.stringify({ sub: usuarioId, role: "authenticated" })]);
    return await fn();
  } finally {
    await db.query("rollback to savepoint u");
  }
}

before(async () => {
  if (!URL) throw new Error("Falta DB_PRUEBAS_URL (ver scripts/db/local.sh url)");
  if (/supabase\.(co|com)/.test(URL)) throw new Error("Las pruebas no corren contra Supabase");
  db = new pg.Client({ connectionString: URL });
  await db.connect();
  await db.query("begin");
  [{ id: g }] = await q(`insert into public.gimnasios (slug, nombre) values ('prueba-acceso', 'Gimnasio de Prueba') returning id`);
  [{ id: sede }] = await q(`select id from public.sedes where gimnasio_id = $1`, [g]);
  ctx = await sembrarCasos(db, { gimnasioId: g, sedeId: sede, hoy: HOY });
  momento = await en(HOY, `${HORA_TESTIGO}:00`);
});

after(async () => {
  if (db) {
    await db.query("rollback");
    await db.end();
  }
});

// ── Cada caso testigo da la respuesta que le corresponde ─────────────
for (const caso of CASOS_TESTIGO) {
  test(`caso testigo: ${caso.clave}`, async () => {
    const v = await acceso(ctx.socios[caso.clave]);
    const e = caso.esperado;
    if ("puede" in e) assert.equal(v.puede, e.puede, v.texto);
    if (e.color) assert.equal(v.color, e.color, v.texto);
    if (e.motivo) assert.equal(v.motivo, e.motivo, v.texto);
    if (e.via) assert.equal(v.via, e.via, v.texto);
    if (e.consume) assert.equal(v.consume, e.consume, v.texto);
    if (e.texto) assert.match(v.texto, e.texto);
    if (e.aviso) assert.ok(v.avisos.some((a) => e.aviso.test(a)), `avisos: ${JSON.stringify(v.avisos)}`);
    for (const k of ["tolerancia_usada", "tolerancia_total", "pack_restantes"]) {
      if (k in e) assert.equal(v[k], e[k], k);
    }
    if ("para_regularizar" in e) assert.equal(Number(v.para_regularizar), e.para_regularizar);
    assert.ok(v.texto && v.texto.length > 0, "siempre dice por qué");
  });
}

test("los textos dicen el porqué con fecha y plata", async () => {
  assert.equal((await acceso(ctx.socios.al_dia)).texto, "Al día · Plan Full · vence el 24/11");
  assert.equal((await acceso(ctx.socios.en_tolerancia)).texto, "Venció el 11/11 · dentro de tolerancia (3 de 5 días)");
  assert.equal((await acceso(ctx.socios.vencida)).texto, "Venció el 24/10 · debe $25.000");
  assert.equal((await acceso(ctx.socios.congelada)).texto, "Congelada · vuelve el 24/11");
  assert.equal((await acceso(ctx.socios.fuera_de_franja)).texto, "Plan Mañana es de 07:00 a 12:00");
});

// ── Zona horaria: el último día cubierto termina a medianoche local ─
test("23:50 del último día está cubierto; 00:10 del día siguiente ya no", async () => {
  const s = ctx.socios.vence_hoy; // cubierto hasta hoy inclusive
  const v1 = await acceso(s, await en(HOY, "23:50:00"));
  assert.equal(v1.puede, true);
  assert.equal(v1.color, "amarillo");
  const v2 = await acceso(s, await en(sumarDias(HOY, 1), "00:10:00"));
  assert.equal(v2.color, "naranja");
  assert.equal(v2.tolerancia_usada, 1);
});

test("la sesión en UTC no cambia el resultado", async () => {
  await db.query("savepoint tz");
  await db.query("set local timezone = 'UTC'");
  const v = await acceso(ctx.socios.vence_hoy, await en(HOY, "23:50:00"));
  await db.query("rollback to savepoint tz");
  assert.equal(v.color, "amarillo");
});

// ── Congelamiento: devuelve los días ─────────────────────────────────
test("al volver del congelamiento tiene los días devueltos", async () => {
  // cubierto hasta el +19 (hasta +20); congelado del -2 al +9: 12 días devueltos desde el +20
  const v = await acceso(ctx.socios.congelada, await en(sumarDias(HOY, 10), "10:00:00"));
  assert.equal(v.color, "verde");
  assert.match(v.texto, /vence el 15\/12$/);
  const [c] = await q(`select origen, motivo from public.coberturas where socio_id = $1 and origen = 'compensacion' and anulada_en is null`,
    [ctx.socios.congelada]);
  assert.equal(c.origen, "compensacion");
});

test("no se puede congelar dos veces las mismas fechas", async () => {
  const [{ id }] = await q(`select id from public.suscripciones where socio_id = $1`, [ctx.socios.congelada]);
  await falla(() => q(`select privado.congelar($1, $2::date, $3::date, 'viaje', null, null, true)`,
    [id, sumarDias(HOY, 0), sumarDias(HOY, 3)]), /Ya hay un congelamiento/);
});

// ── Registrar ingresos ───────────────────────────────────────────────
const registrar = async (socio, m = momento, forzar = null) =>
  (await q(`select privado.registrar_ingreso($1, $2, 'recepcion', null, null, $3, $4) as r`, [socio, sede, forzar, m]))[0].r;

test("el pack se descuenta una sola vez aunque toquen dos veces", async () => {
  const s = ctx.socios.pack_con_clases;
  const r1 = await registrar(s);
  assert.equal(r1.resultado, "entro");
  assert.equal(r1.veredicto.pack_restantes, 6);
  const r2 = await registrar(s, new Date(new Date(momento).getTime() + 20_000));
  assert.equal(r2.repetido, true);
  assert.equal(r2.ingreso_id, r1.ingreso_id);
  const [{ n }] = await q(`select count(*)::int as n from public.consumos_pack where socio_id = $1 and anulado_en is null`, [s]);
  assert.equal(n, 4);
});

test("reingreso el mismo día no descuenta otra clase", async () => {
  const s = ctx.socios.pack_con_clases;
  const r = await registrar(s, new Date(new Date(momento).getTime() + 2 * 3600_000));
  assert.equal(r.resultado, "entro");
  assert.equal(r.veredicto.consume, "nada");
  const [{ n }] = await q(`select count(*)::int as n from public.consumos_pack where socio_id = $1 and anulado_en is null`, [s]);
  assert.equal(n, 4);
});

test("el pase se usa una vez; el reingreso pasa sin consumir", async () => {
  const s = ctx.socios.pase_hoy;
  const r1 = await registrar(s);
  assert.equal(r1.veredicto.consume, "pase");
  const [{ usado }] = await q(`select usado_en_ingreso_id as usado from public.pases_diarios where socio_id = $1`, [s]);
  assert.equal(usado, r1.ingreso_id);
  const r2 = await registrar(s, new Date(new Date(momento).getTime() + 3600_000));
  assert.equal(r2.veredicto.motivo, "pase_reingreso");
});

test("rojo sin motivo queda rechazado y registrado; con motivo queda forzado", async () => {
  const s = ctx.socios.vencida;
  const r1 = await registrar(s);
  assert.equal(r1.resultado, "rechazado");
  const r2 = await registrar(s, new Date(new Date(momento).getTime() + 1000), "Paga mañana, habló con el dueño");
  assert.equal(r2.resultado, "forzado");
  const filas = await q(`select resultado, forzado_motivo from public.ingresos where socio_id = $1 order by momento`, [s]);
  assert.deepEqual(filas.map((f) => f.resultado), ["rechazado", "forzado"]);
});

test("anular un ingreso devuelve la clase del pack", async () => {
  const s = ctx.socios.vencida_con_pack;
  const r = await registrar(s);
  assert.equal(r.veredicto.via, "pack");
  await q(`select privado.anular_ingreso($1, 'Se registró al socio equivocado', null, true)`, [r.ingreso_id]);
  const [{ n }] = await q(`select count(*)::int as n from public.consumos_pack where socio_id = $1 and anulado_en is null`, [s]);
  assert.equal(n, 0);
});

// ── Modo avisar sin bloquear ─────────────────────────────────────────
test("modo aviso deja pasar pero conserva color y motivo", async () => {
  await db.query("savepoint aviso");
  await q(`update public.configuracion_gimnasio set avisar_sin_bloquear_hasta = $2 where gimnasio_id = $1`,
    [g, await en(sumarDias(HOY, 7), "00:00:00")]);
  const v = await acceso(ctx.socios.vencida);
  const r = await registrar(ctx.socios.vencida, new Date(new Date(momento).getTime() + 5 * 3600_000));
  await db.query("rollback to savepoint aviso");
  assert.equal(v.puede, true);
  assert.equal(v.modo_aviso, true);
  assert.equal(v.color, "rojo");
  assert.equal(v.motivo, "vencida");
  assert.equal(r.resultado, "entro_modo_aviso");
});

// ── Cierre del gimnasio ──────────────────────────────────────────────
test("un cierre compensa los días a cada membresía cubierta", async () => {
  await db.query("savepoint cierre");
  await q(
    `insert into public.cierres (gimnasio_id, desde, hasta, motivo) values ($1, $2, $3, 'Vacaciones') returning id`,
    [g, await en(sumarDias(HOY, 1), "00:00:00"), await en(sumarDias(HOY, 4), "00:00:00")]);
  const v = await acceso(ctx.socios.al_dia);
  await db.query("rollback to savepoint cierre");
  assert.match(v.texto, /vence el 27\/11$/); // 24/11 + 3 días
});

// ── Los hechos no se pisan ───────────────────────────────────────────
test("una cobertura no se edita ni se borra; solo se anula", async () => {
  const [{ id }] = await q(`select id from public.coberturas where socio_id = $1 limit 1`, [ctx.socios.al_dia]);
  await falla(() => q(`update public.coberturas set hasta = hasta + interval '30 days' where id = $1`, [id]), /solo se puede cambiar/);
  await falla(() => q(`delete from public.coberturas where id = $1`, [id]), /no se borran/);
  await db.query("savepoint anula");
  await q(`update public.coberturas set anulada_en = now(), anulada_motivo = 'Pago duplicado' where id = $1`, [id]);
  const v = await acceso(ctx.socios.al_dia);
  await db.query("rollback to savepoint anula");
  assert.notEqual(v.color, "verde");
});

test("una cobertura no puede apuntar a un socio de otro gimnasio", async () => {
  const [{ id: g2 }] = await q(`insert into public.gimnasios (slug, nombre) values ('otro-gym', 'Otro') returning id`);
  const [{ id: s2 }] = await q(`insert into public.socios (gimnasio_id, nombre) values ($1, 'Ajeno') returning id`, [g2]);
  const [{ id: su }] = await q(`select id from public.suscripciones where socio_id = $1`, [ctx.socios.al_dia]);
  await falla(() => q(
    `insert into public.coberturas (gimnasio_id, suscripcion_id, socio_id, desde, hasta, origen, motivo)
     values ($1, $2, $3, now(), now() + interval '1 day', 'cortesia', 'x')`, [g, su, s2]), /foreign key/);
});

// ── Permisos ─────────────────────────────────────────────────────────
test("permisos: recepción de otro gimnasio recibe error, no un vacío", async () => {
  const [{ id: u }] = await q(`insert into auth.users (email) values ('recepcion@ejemplo.invalid') returning id`);
  const [{ id: g2 }] = await q(`insert into public.gimnasios (slug, nombre) values ('ajeno', 'Ajeno') returning id`);
  await q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1, $2, 'Caro', 'recepcion')`, [g2, u]);
  await comoUsuario(u, async () => {
    await falla(() => q(`select public.estado_acceso($1)`, [ctx.socios.al_dia]), /Sin permiso/);
    await falla(() => q(`select public.registrar_ingreso($1, $2)`, [ctx.socios.al_dia, sede]), /Sin permiso/);
    const filas = await q(`select id from public.socios where gimnasio_id = $1`, [g]);
    assert.equal(filas.length, 0, "RLS no deja ver socios ajenos");
  });
});

test("permisos: la recepción del gimnasio registra; no puede crear coberturas a mano", async () => {
  const [{ id: u }] = await q(`insert into auth.users (email) values ('caro@ejemplo.invalid') returning id`);
  await q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1, $2, 'Caro', 'recepcion')`, [g, u]);
  await comoUsuario(u, async () => {
    const [{ v }] = await q(`select (public.estado_acceso($1)).color as v`, [ctx.socios.al_dia]);
    assert.ok(["verde", "amarillo", "naranja", "rojo"].includes(v));
    const [{ n }] = await q(`select count(*)::int as n from public.socios`);
    assert.ok(n > 0);
    const [{ id: su }] = await q(`select id from public.suscripciones where socio_id = $1`, [ctx.socios.sin_pago]);
    await falla(() => q(
      `insert into public.coberturas (gimnasio_id, suscripcion_id, socio_id, desde, hasta, origen, motivo)
       values ($1, $2, $3, now(), now() + interval '30 days', 'cortesia', 'regalo')`, [g, su, ctx.socios.sin_pago]),
      /row-level security/);
  });
});

test("permisos: el socio ve su estado y no el de otro", async () => {
  const [{ id: u }] = await q(`insert into auth.users (phone) values ('+5490000999999') returning id`);
  await q(`update public.socios set usuario_id = $2 where id = $1`, [ctx.socios.al_dia, u]);
  await comoUsuario(u, async () => {
    const [{ c }] = await q(`select (public.estado_acceso($1)).color as c`, [ctx.socios.al_dia]);
    assert.equal(c, "verde");
    await falla(() => q(`select public.estado_acceso($1)`, [ctx.socios.vencida]), /Sin permiso/);
    await falla(() => q(`select public.registrar_ingreso($1, $2)`, [ctx.socios.al_dia, sede]), /Sin permiso/);
    const visibles = await q(`select id from public.socios`);
    assert.deepEqual(visibles.map((r) => r.id), [ctx.socios.al_dia]);
  });
});

test("permisos: anon no ejecuta nada del acceso", async () => {
  await db.query("savepoint anon");
  await db.query("set local role anon");
  let error;
  try { await db.query(`select public.estado_acceso($1)`, [ctx.socios.al_dia]); } catch (e) { error = e; }
  await db.query("rollback to savepoint anon");
  assert.match(error?.message ?? "", /permission denied/);
});
