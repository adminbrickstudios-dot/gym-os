// COM-8 (0128): eventos sueltos. El dueño crea uno (producto con cupo); se
// vende en Vender como un producto; los anotados y los lugares salen de las
// ventas; la página y la app lo muestran mientras no pasó; cerrarlo lo saca.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir } from "./_comun.mjs";

let t, u = {}, host, us;
async function como(usuario, fn) {
  await t.db.query("set role authenticated");
  await t.q(`select set_config('request.jwt.claims', $1, false)`, [JSON.stringify({ sub: usuario, role: "authenticated" })]);
  try { return await fn(); } finally { await t.db.query("reset role"); await t.q(`select set_config('request.jwt.claims', '', false)`); }
}
before(async () => {
  t = await abrir("prueba-eventos");
  for (const rol of ["dueno", "recepcion"]) {
    const [{ id }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`${rol}${Math.random()}@ejemplo.invalid`]);
    await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,$3,$4)`, [t.g, id, rol, rol]);
    u[rol] = id;
  }
  host = `eventos-${Date.now()}.localhost`;
  await t.q(`insert into public.dominios_gimnasio (gimnasio_id, host, tipo) values ($1, $2, 'subdominio')`, [t.g, host]);
  const n = (await t.q(`update public.landing_gimnasio set publicada = true where gimnasio_id = $1 returning 1`, [t.g])).length;
  if (!n) await t.q(`insert into public.landing_gimnasio (gimnasio_id, publicada) values ($1, true)`, [t.g]);
  [{ id: us }] = await t.q(`insert into auth.users (phone) values ('+5490000888111') returning id`);
  await t.q(`update public.socios set usuario_id = $2 where id = $1`, [t.ctx.socios.al_dia, us]);
});
after(async () => t && t.cerrar());

test("crear, vender, anotados y lugares, página y app, cerrar", async () => {
  const ev = await como(u.dueno, async () => {
    await t.falla(() => t.q(`select public.crear_evento($1, 'Workshop', now() - interval '1 day', 10, 5000)`, [t.g]), /todavía no pasaron/);
    return (await t.q(`select public.crear_evento($1, 'Workshop de movilidad', now() + interval '3 days', 2, 5000, 'Dos horas con Laura', 'todos') id`, [t.g]))[0].id;
  });
  await como(u.recepcion, async () => {
    await t.falla(() => t.q(`select public.crear_evento($1, 'Otro', now() + interval '3 days', 2, 0)`, [t.g]), /permiso|rol|acceso/i);
    const [{ p }] = await t.q(`select public.eventos_panel($1) p`, [t.g]);
    const e = p.find((x) => x.evento_id === ev);
    assert.equal(e.nombre, "Workshop de movilidad"); assert.equal(e.quedan, 2);
    const [{ r }] = await t.q(`select public.vender($1, $2::jsonb, $3::jsonb, $4) r`,
      [t.sede, JSON.stringify([{ tipo: "producto", producto_id: e.producto_id }]), JSON.stringify([{ medio: "transferencia", monto: 5000 }]), t.ctx.socios.al_dia]);
    assert.ok(r.venta_id);
    const [{ p: p2 }] = await t.q(`select public.eventos_panel($1) p`, [t.g]);
    const e2 = p2.find((x) => x.evento_id === ev);
    assert.equal(e2.quedan, 1); assert.equal(e2.anotados.length, 1); assert.match(e2.anotados[0].nombre, /Testigo/);
  });
  await t.q(`set local role anon`);
  const [{ pub }] = await t.q(`select public.eventos_publicos($1) pub`, [host]);
  await t.q(`reset role`);
  assert.equal(pub.find((x) => x.evento_id === ev)?.quedan, 1);
  assert.equal(pub[0].anotados, undefined, "la página no muestra quiénes se anotaron");
  await como(us, async () => {
    const [{ a }] = await t.q(`select public.eventos_socio($1) a`, [t.ctx.socios.al_dia]);
    assert.equal(a.find((x) => x.evento_id === ev)?.anotado, true);
  });
  await como(u.dueno, () => t.q(`select public.cerrar_evento($1)`, [ev]));
  const [{ pub: despues }] = await t.q(`select public.eventos_publicos($1) pub`, [host]);
  assert.equal(despues.find((x) => x.evento_id === ev), undefined, "cerrado no se muestra");
  const [{ activo }] = await t.q(`select p.activo from public.eventos e join public.productos p on p.id = e.producto_id where e.id = $1`, [ev]);
  assert.equal(activo, false, "y sale de Vender");
});
