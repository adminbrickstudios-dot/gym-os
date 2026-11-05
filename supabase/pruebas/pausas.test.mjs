// Pausas (0042, D7): el dueño y el encargado dan la pausa; la recepción la
// pide y queda pendiente hasta que la aprueban o la rechazan; motivos sin
// salud; máximo de días por año configurable; el profe no ve nada.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir } from "./_comun.mjs";

let t, u = {};
async function persona(rol) {
  const [{ id }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`${rol}${Math.random()}@ejemplo.invalid`]);
  await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,$3,$4)`, [t.g, id, rol, rol]);
  return id;
}
async function socio(apellido) {
  const [{ id: s }] = await t.q(`insert into public.socios (gimnasio_id, nombre, apellido) values ($1,'Pausa',$2) returning id`, [t.g, apellido]);
  const [{ id: su }] = await t.q(`insert into public.suscripciones (gimnasio_id, socio_id, plan_id, inicio) values ($1,$2,$3,'2026-01-01T03:00:00Z') returning id`,
    [t.g, s, t.ctx.planes.full]);
  return { s, su };
}
before(async () => {
  t = await abrir("prueba-pausas");
  for (const r of ["dueno", "encargado", "recepcion", "profe"]) u[r] = await persona(r);
});
after(async () => t && t.cerrar());
// Como alguien del equipo, sin volver atrás al terminar (lo que pide la recepción lo ve después el encargado).
async function como(usuario, fn) {
  await t.q(`set local role authenticated`);
  await t.q(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: usuario, role: "authenticated" })]);
  try { return await fn(); } finally { await t.q(`reset role`).catch(() => {}); }
}
const congelar = (su, d, h, cat = "viaje") => t.q(`select public.congelar($1, $2::date, $3::date, $4)`, [su, d, h, cat]);

test("el dueño da la pausa; el máximo por año frena; salud no es un motivo", async () => {
  const { s, su } = await socio("Max");
  await t.comoUsuario(u.dueno, async () => {
    await congelar(su, "2027-02-01", "2027-02-21");
    await t.falla(() => congelar(su, "2027-04-01", "2027-04-15"), /máximo de 30 días .* en 2027 ya usó 20 y esta pausa suma 14/);
    await congelar(su, "2027-04-01", "2027-04-11", "trabajo");                     // 20 + 10 = 30: entra justo
    await t.falla(() => congelar(su, "2027-06-01", "2027-06-03", "lesion"), /viaje, trabajo, estudio u otro/);
    const p = (await t.q(`select public.pausas_socio($1) as p`, [s]))[0].p;
    assert.equal(p.pausas.length, 2);
    assert.equal(p.puede_dar, true);
    assert.equal(p.suscripcion_id, su);
  });
  // Cruza el año: se cuenta en cada uno.
  const { su: su2 } = await socio("Cruza");
  await t.comoUsuario(u.encargado, async () => {
    await congelar(su2, "2027-12-20", "2028-01-10");                                // 12 en 2027, 9 en 2028
    await t.falla(() => congelar(su2, "2027-11-01", "2027-11-20"), /en 2027 ya usó 12 y esta pausa suma 19/);
  });
});

test("la recepción pide; queda pendiente; el encargado aprueba y la cuota se corre", async () => {
  const { s, su } = await socio("Pide");
  let pid;
  await como(u.recepcion, async () => {
    await t.falla(() => congelar(su, "2027-03-01", "2027-03-11"), /Pedir pausa/);
    await t.falla(() => t.q(`select public.pedir_pausa($1, '2026-01-10', '2026-01-20', 'viaje')`, [su]), /fecha pasada/);
    pid = (await t.q(`select public.pedir_pausa($1, '2027-03-01', '2027-03-11', 'estudio', 'Rinde finales') as id`, [su]))[0].id;
    await t.falla(() => t.q(`select public.pedir_pausa($1, '2027-03-05', '2027-03-08', 'viaje')`, [su]), /esperando que lo aprueben/);
    const p = (await t.q(`select public.pausas_socio($1) as p`, [s]))[0].p;
    assert.equal(p.puede_dar, false);
    assert.equal(p.pedidos.length, 1);
    assert.equal(p.pedidos[0].pedido_por, "recepcion");
    await t.falla(() => t.q(`select public.resolver_pedido_pausa($1, true)`, [pid]), /Sin permiso/);
  });
  await como(u.encargado, async () => {
    const pend = (await t.q(`select public.pedidos_pausa_pendientes($1) as p`, [t.g]))[0].p;
    assert.ok(pend.some((x) => x.id === pid && x.desde === "2027-03-01"));
    await t.q(`select public.resolver_pedido_pausa($1, true)`, [pid]);
    await t.falla(() => t.q(`select public.resolver_pedido_pausa($1, false)`, [pid]), /ya estaba resuelto/);
    const p = (await t.q(`select public.pausas_socio($1) as p`, [s]))[0].p;
    assert.equal(p.pedidos.length, 0);
    assert.deepEqual(p.pausas.map((x) => [x.desde, x.vuelve, x.categoria, x.estado]), [["2027-03-01", "2027-03-11", "estudio", "programada"]]);
  });
  const [{ c, tx }] = await t.q(`select (x).color c, (x).texto tx from (select privado.calcular_acceso($1, privado.medianoche('2027-03-05', $2) + interval '12 hours') as x) y`, [s, t.ctx.zona]);
  assert.equal(c, "rojo");
  assert.match(tx, /Congelada · vuelve el 11\/03/);
});

test("rechazar no congela; con máximo 0 no hay pausas; el profe no ve", async () => {
  const { s, su } = await socio("Rechazo");
  let pid;
  await como(u.recepcion, async () => { pid = (await t.q(`select public.pedir_pausa($1, '2027-05-01', '2027-05-04', 'otro') as id`, [su]))[0].id; });
  await t.comoUsuario(u.dueno, async () => {
    await t.q(`select public.resolver_pedido_pausa($1, false)`, [pid]);
    const p = (await t.q(`select public.pausas_socio($1) as p`, [s]))[0].p;
    assert.equal(p.pausas.length + p.pedidos.length, 0);
    await t.q(`select public.guardar_configuracion($1, '{"pausa_dias_por_anio": 0}')`, [t.g]);
    await t.falla(() => congelar(su, "2027-05-01", "2027-05-04"), /no da pausas/);
    await t.falla(() => t.q(`select public.guardar_configuracion($1, '{"pausa_dias_por_anio": 400}')`, [t.g]), /entre 0 y 365/);
    assert.equal((await t.q(`select public.configuracion_panel($1) as c`, [t.g]))[0].c.pausa_dias_por_anio, 0);
  });
  await t.comoUsuario(u.profe, async () => t.falla(() => t.q(`select public.pausas_socio($1)`, [s]), /Sin permiso/));
});
