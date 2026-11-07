// VD-57: día cerrado suma al vencimiento, como regla del gimnasio. Números fijos (HOY = sábado 14/11/2026, cierre del 15 al 17/11 = 3 días):
// con la regla en "no suma" (por defecto) el vencimiento no se mueve; con "suma" se corre exactamente 3 días a quien estaba cubierto
// en esos días y a nadie más; el aviso previo cuenta a cuántos; el cierre no decide distinto que la regla; cambiar la regla no reescribe
// cierres ya cargados; anular el cierre devuelve el vencimiento; solo el dueño cambia la regla.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir, HOY } from "./_comun.mjs";
import { sumarDias } from "../../scripts/datos/casos-testigo.mjs";

let t, momento, u = {}, A, B, C, g2;
const D = (n) => sumarDias(HOY, n);
const acc = async (socio) => (await t.q(`select (privado.calcular_acceso($1, $2, null)).*`, [socio, momento]))[0];
const coberturas = async (socio) =>
  (await t.q(`select origen from public.coberturas where socio_id = $1 and anulada_en is null`, [socio])).map((c) => c.origen);
async function persona(rol, gimnasio = null) {
  const [{ id }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`${rol}${Math.random()}@ejemplo.invalid`]);
  await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,$3,$4)`, [gimnasio ?? t.g, id, rol, rol]);
  return id;
}
async function como(usuario, fn) {
  await t.db.query("set role authenticated");
  await t.q(`select set_config('request.jwt.claims', $1, false)`, [JSON.stringify({ sub: usuario, role: "authenticated" })]);
  try { return await fn(); } finally { await t.db.query("reset role").catch(() => {}); await t.q(`select set_config('request.jwt.claims', '', false)`).catch(() => {}); }
}
async function socioNuevo(apellido, cobs) {
  const [{ id: s }] = await t.q(`insert into public.socios (gimnasio_id, nombre, apellido) values ($1,'Cierre',$2) returning id`, [t.g, apellido]);
  const [{ id: su }] = await t.q(`insert into public.suscripciones (gimnasio_id, socio_id, plan_id, inicio) values ($1,$2,$3,'2026-01-01T03:00:00Z') returning id`, [t.g, s, t.ctx.planes.full]);
  for (const [d, h] of cobs) {
    await t.q(`insert into public.coberturas (gimnasio_id, suscripcion_id, socio_id, desde, hasta, origen, motivo)
               values ($1,$2,$3,privado.medianoche($4::date,$6),privado.medianoche($5::date,$6),'cortesia','cierre')`, [t.g, su, s, d, h, t.ctx.zona]);
  }
  return s;
}
const cierre = (usuario, sede = null, compensa = null) => como(usuario, async () =>
  (await t.q(`select public.crear_cierre($1, $2::date, $3::date, 'Feriado', $4, $5) as c`, [t.g, D(1), D(4), compensa, sede]))[0].c);

before(async () => {
  t = await abrir("prueba-cierre-suma");
  momento = await t.en(HOY);
  for (const rol of ["dueno", "encargado", "recepcion", "profe"]) u[rol] = await persona(rol);
  A = await socioNuevo("A vence 24", [[D(-20), D(11)]]);    // cubierto hasta el 24/11: el cierre (15 al 17/11) cae adentro
  B = await socioNuevo("B vence 19", [[D(-20), D(6)]]);     // cubierto hasta el 19/11: también adentro
  C = await socioNuevo("C vencio", [[D(-40), D(-5)]]);      // venció el 8/11: el cierre no le toca
  [{ id: g2 }] = await t.q(`insert into public.gimnasios (slug, nombre) values ('otro-cierre', 'Otro') returning id`);
});
after(async () => t && t.cerrar());

test("por defecto la regla es 'no suma': el cierre se carga y el vencimiento NO se mueve", async () => {
  const cfg = await como(u.encargado, async () => (await t.q(`select public.config_cierres($1) as c`, [t.g]))[0].c);
  assert.equal(cfg.suma_dias, false);
  const prev = await como(u.encargado, async () => (await t.q(`select public.previsualizar_cierre($1, $2::date, $3::date) as p`, [t.g, D(1), D(4)]))[0].p);
  assert.deepEqual([prev.suma_dias, prev.dias, prev.socios], [false, 3, 0]);
  const c = await cierre(u.encargado);
  const [{ compensa }] = await t.q(`select compensa from public.cierres where id = $1`, [c]);
  assert.equal(compensa, false);
  assert.match((await acc(A)).texto, /vence el 24\/11$/);
  assert.match((await acc(B)).texto, /vence el 19\/11$/);
  assert.ok(!(await coberturas(A)).includes("compensacion"));
  // Anularlo no cambia nada (no había nada que devolver).
  await como(u.encargado, () => t.q(`select public.anular_cierre($1, 'me equivoqué')`, [c]));
  assert.match((await acc(A)).texto, /vence el 24\/11$/);
});

test("la regla la cambia solo el dueño; el encargado la ve; la recepción y el profe no", async () => {
  await como(u.encargado, () => t.falla(() => t.q(`select public.guardar_config_cierres($1, true)`, [t.g]), /Sin permiso/));
  await como(u.recepcion, () => t.falla(() => t.q(`select public.config_cierres($1)`, [t.g]), /Sin permiso/));
  await como(u.profe, () => t.falla(() => t.q(`select public.previsualizar_cierre($1, $2::date, $3::date)`, [t.g, D(1), D(4)]), /Sin permiso/));
  await como(u.recepcion, () => t.falla(() => t.q(`select public.crear_cierre($1, $2::date, $3::date, 'X')`, [t.g, D(1), D(4)]), /Sin permiso/));
  const g2dueno = await persona("dueno", g2);
  await como(g2dueno, () => t.falla(() => t.q(`select public.guardar_config_cierres($1, true)`, [t.g]), /Sin permiso/));
  await como(u.dueno, async () => {
    await t.falla(() => t.q(`select public.guardar_config_cierres($1, null)`, [t.g]), /Elegí si/);
    assert.equal((await t.q(`select public.guardar_config_cierres($1, true) as c`, [t.g]))[0].c.suma_dias, true);
  });
  assert.equal((await como(u.encargado, async () => (await t.q(`select public.config_cierres($1) as c`, [t.g]))[0].c)).suma_dias, true);
});

test("con 'suma': el aviso cuenta a quién y cuánto; el vencimiento se corre 3 días a los cubiertos y a nadie más", async () => {
  const prev = await como(u.encargado, async () => (await t.q(`select public.previsualizar_cierre($1, $2::date, $3::date) as p`, [t.g, D(1), D(4)]))[0].p);
  assert.equal(prev.suma_dias, true);
  assert.equal(prev.dias, 3);
  const [{ n }] = await t.q(`select count(*)::int n from public.suscripciones su where su.gimnasio_id = $1 and (su.baja_en is null)
      and exists (select 1 from public.coberturas c where c.suscripcion_id = su.id and c.anulada_en is null and c.desde < $3 and c.hasta > $2)`,
    [t.g, await t.en(D(1), "00:00:00"), await t.en(D(4), "00:00:00")]);
  assert.equal(prev.socios, n);       // el aviso coincide con quienes hoy están cubiertos en esos días
  assert.ok(prev.socios >= 2);        // al menos A y B
  const c = await cierre(u.encargado);
  const [{ compensa }] = await t.q(`select compensa from public.cierres where id = $1`, [c]);
  assert.equal(compensa, true);
  assert.match((await acc(A)).texto, /vence el 27\/11$/);     // 24/11 + 3 días
  assert.match((await acc(B)).texto, /vence el 22\/11$/);     // 19/11 + 3 días
  assert.ok((await coberturas(A)).includes("compensacion"));
  assert.ok(!(await coberturas(C)).includes("compensacion"));  // el que ya había vencido no recibe nada
  // Cambiar la regla después NO reescribe el cierre ya cargado.
  await como(u.dueno, () => t.q(`select public.guardar_config_cierres($1, false)`, [t.g]));
  assert.match((await acc(A)).texto, /vence el 27\/11$/);
  const [{ compensa: sigue }] = await t.q(`select compensa from public.cierres where id = $1`, [c]);
  assert.equal(sigue, true);
  // Anular el cierre devuelve el vencimiento original.
  await como(u.dueno, () => t.q(`select public.anular_cierre($1, 'se trabajó igual')`, [c]));
  assert.match((await acc(A)).texto, /vence el 24\/11$/);
  assert.match((await acc(B)).texto, /vence el 19\/11$/);
});

test("el cierre no puede decidir distinto que la regla; una sola sede nunca suma", async () => {
  // Regla en no suma (se dejó así arriba): pedir sumar es error.
  await t.falla(() => cierre(u.encargado, null, true), /es no sumar/);
  await como(u.dueno, () => t.q(`select public.guardar_config_cierres($1, true)`, [t.g]));
  await t.falla(() => cierre(u.encargado, null, false), /es sumar/);
  // Una sola sede: no suma aunque la regla sea sumar, y pedir sumarlo explícito es el error de siempre.
  await t.falla(() => cierre(u.encargado, t.sede, true), /gimnasio entero cerrado/);
  const c = await cierre(u.encargado, t.sede);
  const [{ compensa }] = await t.q(`select compensa from public.cierres where id = $1`, [c]);
  assert.equal(compensa, false);
  const prev = await como(u.encargado, async () => (await t.q(`select public.previsualizar_cierre($1, $2::date, $3::date, $4) as p`, [t.g, D(10), D(12), t.sede]))[0].p);
  assert.deepEqual([prev.suma_dias, prev.socios, prev.dias], [false, 0, 2]);
  assert.match((await acc(A)).texto, /vence el 24\/11$/);
  // Hay una sola versión de la función (la vieja se borró).
  const [{ n }] = await t.q(`select count(*)::int n from pg_proc p join pg_namespace s on s.oid = p.pronamespace where s.nspname = 'public' and p.proname = 'crear_cierre'`);
  assert.equal(n, 1);
});
