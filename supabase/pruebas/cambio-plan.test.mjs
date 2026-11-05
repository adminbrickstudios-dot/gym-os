// Cambio de plan con días a favor (0060, D6): la vista previa dice cuántos días
// pasan y hasta cuándo; el cambio los pasa 1 a 1; no hay plata automática; un
// plan de otro gimnasio, que no se vende o que no es membresía, dice por qué.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir } from "./_comun.mjs";

let t, uRec, viejo, nuevo, pack, inactivo, ajeno, socio;
before(async () => {
  t = await abrir("prueba-cambio-plan");
  const [{ id: u }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`rec${Math.random()}@ejemplo.invalid`]);
  await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,'Ana','recepcion')`, [t.g, u]);
  uRec = u;
  const plan = async (n, tipo = "membresia", activo = true, g = t.g) => (await t.q(
    `insert into public.planes (gimnasio_id, tipo, nombre, duracion_meses, renovacion, cantidad_clases, consume_en, activo)
     values ($1,$2,$3, case when $2 = 'membresia' then 1 end, case when $2 = 'membresia' then 'continua' end,
             case when $2 = 'pack' then 8 end, case when $2 = 'pack' then 'ingreso' end, $4) returning id`, [g, tipo, n, activo]))[0].id;
  viejo = await plan("Musculación"); nuevo = await plan("Pase libre"); pack = await plan("Pack 8", "pack"); inactivo = await plan("Viejo", "membresia", false);
  const [{ id: otro }] = await t.q(`insert into public.gimnasios (slug, nombre) values ($1,'Otro') returning id`, [`otro-${Date.now()}`]);
  ajeno = await plan("Ajeno", "membresia", true, otro);
  for (const [p, m] of [[viejo, 20000], [nuevo, 30000]]) await t.q(`insert into public.precios_plan (gimnasio_id, plan_id, monto, vigente_desde) values ($1,$2,$3,'2020-01-01')`, [t.g, p, m]);
  [{ id: socio }] = await t.q(`insert into public.socios (gimnasio_id, nombre, apellido) values ($1,'Cambia','Plan') returning id`, [t.g]);
  const [{ id: su }] = await t.q(`insert into public.suscripciones (gimnasio_id, socio_id, plan_id, inicio) values ($1,$2,$3, now() - interval '20 days') returning id`, [t.g, socio, viejo]);
  // Pagó hasta dentro de 10 días.
  await t.q(`insert into public.coberturas (gimnasio_id, suscripcion_id, socio_id, desde, hasta, origen, motivo)
             values ($1,$2,$3, privado.medianoche(privado.dia_local(now(), $4) - 20, $4), privado.medianoche(privado.dia_local(now(), $4) + 10, $4), 'cortesia', 'prueba')`,
    [t.g, su, socio, t.ctx.zona]);
});
after(async () => t && t.cerrar());
async function como(u, fn) {
  await t.db.query("set role authenticated");
  await t.q(`select set_config('request.jwt.claims', $1, false)`, [JSON.stringify({ sub: u, role: "authenticated" })]);
  try { return await fn(); } finally { await t.db.query("reset role"); await t.q(`select set_config('request.jwt.claims', '', false)`); }
}

test("vista previa: 10 días a favor, precios por mes", async () => {
  const v = await como(uRec, async () => (await t.q(`select public.vista_cambio_plan($1, $2) as v`, [socio, nuevo]))[0].v);
  assert.equal(v.dias_a_favor, 10);
  assert.equal(Number(v.precio_viejo), 20000); assert.equal(Number(v.precio_nuevo), 30000);
  assert.equal(v.plan_viejo, "Musculación");
});

test("lo que no se puede, dice por qué", async () => {
  await como(uRec, async () => {
    await t.falla(() => t.q(`select public.cambiar_plan($1, $2)`, [socio, pack]), /pack de clases/);
    await t.falla(() => t.q(`select public.cambiar_plan($1, $2)`, [socio, inactivo]), /no se vende más/);
    await t.falla(() => t.q(`select public.cambiar_plan($1, $2)`, [socio, ajeno]), /no es de este gimnasio/);
  });
});

test("el cambio pasa los días 1 a 1, sin cobrar nada", async () => {
  const antes = (await t.q(`select count(*)::int as n from public.ventas where socio_id = $1`, [socio]))[0].n;
  await como(uRec, () => t.q(`select public.cambiar_plan($1, $2)`, [socio, nuevo]));
  const [c] = await t.q(`select c.origen, privado.dia_local(c.hasta, $2) - privado.dia_local(now(), $2) as dias, pl.nombre
                           from public.coberturas c join public.suscripciones su on su.id = c.suscripcion_id join public.planes pl on pl.id = su.plan_id
                          where c.socio_id = $1 and su.baja_en is null`, [socio, t.ctx.zona]);
  assert.equal(c.origen, "traspaso"); assert.equal(c.dias, 10); assert.equal(c.nombre, "Pase libre");
  assert.equal((await t.q(`select count(*)::int as n from public.ventas where socio_id = $1`, [socio]))[0].n, antes);
  const [{ e }] = await t.q(`select (privado.calcular_acceso($1, now())).color as e`, [socio]);
  assert.equal(e, "verde");
});
