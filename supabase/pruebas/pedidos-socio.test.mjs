// APP-8 (0093): el socio pide una pausa (queda pendiente, la aprueba el
// encargado) o la baja con el motivo; aparece en la campana; la recepción la
// resuelve en la ficha. Otro socio no puede pedir por él.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir } from "./_comun.mjs";

let t, socio, uSocio, uOtro, uRec, uDueno;
async function persona(rol) {
  const [{ id }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`${rol}${Math.random()}@ejemplo.invalid`]);
  await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,$3,$4)`, [t.g, id, rol, rol]);
  return id;
}
before(async () => {
  t = await abrir("prueba-pedidos-socio");
  uRec = await persona("recepcion"); uDueno = await persona("dueno");
  [{ id: uSocio }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`s${Math.random()}@ejemplo.invalid`]);
  [{ id: uOtro }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`o${Math.random()}@ejemplo.invalid`]);
  [{ id: socio }] = await t.q(`insert into public.socios (gimnasio_id, nombre, apellido, usuario_id) values ($1,'Pide','Desde App',$2) returning id`, [t.g, uSocio]);
  await t.q(`insert into public.socios (gimnasio_id, nombre, apellido, usuario_id) values ($1,'Otro','Socio',$2)`, [t.g, uOtro]);
  await t.q(`insert into public.suscripciones (gimnasio_id, socio_id, plan_id, inicio) values ($1,$2,$3,'2026-01-01T03:00:00Z')`, [t.g, socio, t.ctx.planes.full]);
});
after(async () => t && t.cerrar());
// Sin volver atrás al terminar: lo que pide el socio lo ve después el equipo.
async function como(usuario, fn) {
  await t.q(`set local role authenticated`);
  await t.q(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: usuario, role: "authenticated" })]);
  try { return await fn(); } finally { await t.q(`reset role`).catch(() => {}); }
}

test("pausa: el socio la pide, no se repite, otro no puede; el encargado la ve pendiente", async () => {
  await como(uSocio, async () => {
    await t.falla(() => t.q(`select public.pedir_pausa_socio($1, '2026-01-10', '2026-01-20', 'viaje')`, [socio]), /hoy o más adelante/);
    await t.falla(() => t.q(`select public.pedir_pausa_socio($1, '2027-03-01', '2027-03-11', 'lesion')`, [socio]), /viaje, trabajo, estudio u otro/);
    await t.q(`select public.pedir_pausa_socio($1, '2027-03-01', '2027-03-11', 'viaje', 'Me voy a la costa')`, [socio]);
    await t.falla(() => t.q(`select public.pedir_pausa_socio($1, '2027-03-05', '2027-03-08', 'viaje')`, [socio]), /Ya pediste una pausa/);
  });
  await como(uOtro, () => t.falla(() => t.q(`select public.pedir_pausa_socio($1, '2027-05-01', '2027-05-05', 'viaje')`, [socio]), /permiso/i));
  await como(uDueno, async () => {
    const [{ p }] = await t.q(`select public.pedidos_pausa_pendientes($1) as p`, [t.g]);
    assert.ok(p.some((x) => x.socio_id === socio && x.desde === "2027-03-01"));
  });
});

test("baja: el socio la pide con motivo; campana; la recepción resuelve 'se queda' o da de baja", async () => {
  await como(uSocio, async () => {
    await t.falla(() => t.q(`select public.pedir_baja_socio($1, null)`, [socio]), /por qué/);
    await t.q(`select public.pedir_baja_socio($1, 'precio', 'Está caro')`, [socio]);
    await t.falla(() => t.q(`select public.pedir_baja_socio($1, 'precio')`, [socio]), /Ya pediste la baja/);
    const [{ p }] = await t.q(`select public.pedido_baja_socio($1) as p`, [socio]);
    assert.equal(p.motivo, "precio");
  });
  await como(uOtro, () => t.falla(() => t.q(`select public.pedir_baja_socio($1, 'precio')`, [socio]), /permiso/i));
  await como(uDueno, async () => {
    const [{ c }] = await t.q(`select public.campana($1) as c`, [t.g]);
    assert.ok(c.items.some((i) => i.clave.startsWith("pedido_baja:") && /pidió la baja/.test(i.titulo)));
  });
  let pid;
  await como(uRec, async () => {
    pid = (await t.q(`select public.pedido_baja_socio($1) as p`, [socio]))[0].p.pedido_id;
    await t.q(`select public.resolver_pedido_baja($1, false)`, [pid]);
    await t.falla(() => t.q(`select public.resolver_pedido_baja($1, true)`, [pid]), /ya se resolvió/);
    assert.equal((await t.q(`select public.pedido_baja_socio($1) as p`, [socio]))[0].p, null);
  });
  const [{ b }] = await t.q(`select dado_de_baja_en is null as b from public.socios where id = $1`, [socio]);
  assert.equal(b, true, "“se queda” no da de baja");
  await como(uSocio, () => t.q(`select public.pedir_baja_socio($1, 'mudanza')`, [socio]));
  await como(uRec, async () => {
    const id = (await t.q(`select public.pedido_baja_socio($1) as p`, [socio]))[0].p.pedido_id;
    await t.q(`select public.resolver_pedido_baja($1, true)`, [id]);
  });
  const [s] = await t.q(`select dado_de_baja_en is not null as b, motivo_baja from public.socios where id = $1`, [socio]);
  assert.equal(s.b, true); assert.equal(s.motivo_baja, "mudanza");
});

test("AUD-14: los pedidos de baja pendientes, para Inicio (la recepción también; el socio no)", async () => {
  const [{ id: s2 }] = await t.q(`insert into public.socios (gimnasio_id, nombre, apellido, usuario_id) values ($1,'Se','Va',$2) returning id`, [t.g, uOtro]);
  await como(uOtro, () => t.q(`select public.pedir_baja_socio($1, 'horario', 'No llego')`, [s2]));
  const [{ p }] = await como(uRec, () => t.q(`select public.pedidos_baja_pendientes($1) p`, [t.g]));
  assert.ok(p.some((x) => x.socio_id === s2 && x.motivo === "horario" && x.nota === "No llego"));
  await como(uOtro, () => t.falla(() => t.q(`select public.pedidos_baja_pendientes($1)`, [t.g]), /permiso|equipo|acceso/i));
});
