// VD-26 (6700): la página de Gym OS para vender. Cualquiera (sin sesión) deja un pedido de demo; solo el super
// admin lo ve y lo marca atendido; los planes públicos son los activos del super admin y nada más.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir } from "./_comun.mjs";

let t, admin, dueno;
async function como(rol, usuario, fn) {
  await t.db.query(`set role ${rol}`);
  await t.q(`select set_config('request.jwt.claims', $1, false)`, [JSON.stringify(usuario ? { sub: usuario, role: rol } : { role: rol })]);
  try { return await fn(); } finally { await t.db.query("reset role"); await t.q(`select set_config('request.jwt.claims', '', false)`); }
}
before(async () => {
  t = await abrir("prueba-pedidos-demo");
  [{ id: admin }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`a${Math.random()}@ejemplo.invalid`]);
  await t.q(`insert into public.administradores_plataforma (usuario_id) values ($1)`, [admin]);
  [{ id: dueno }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`d${Math.random()}@ejemplo.invalid`]);
  await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,'Dueña','dueno')`, [t.g, dueno]);
});
after(async () => t && t.cerrar());
const pedir = (nombre, contacto, gim = null, msg = null) => como("anon", null, () => t.q(`select public.pedir_demo_brik($1,$2,$3,$4) r`, [nombre, gim, contacto, msg]));

test("sin sesión se deja un pedido, y el mismo contacto no se duplica", async () => {
  const [{ r: a }] = await pedir("Marta Prueba", "387 000 1111", "Gimnasio Prueba");
  assert.equal(a.ok, true);
  assert.equal(a.repetido, false);
  const [{ r: b }] = await pedir("Marta Prueba", "387 000 1111");
  assert.equal(b.repetido, true);
  assert.equal(Number((await t.q(`select count(*) n from public.pedidos_demo_brik where contacto = '387 000 1111'`))[0].n), 1);
});

test("un contacto que no sirve o un nombre vacío se rechazan con un mensaje claro", async () => {
  await t.falla(() => pedir("Marta", "hola"), /WhatsApp|mail/);
  await t.falla(() => pedir("", "marta@ejemplo.invalid"), /nombre/);
  await t.falla(() => pedir("Marta", "marta@ejemplo.invalid", null, "x".repeat(501)), /largo/);
});

test("el tope por hora frena el spam", async () => {
  for (let i = 0; i < 25; i++) {
    try { await pedir(`Spam ${i}`, `spam${i}@ejemplo.invalid`); } catch { /* el tope corta al llegar a 20 */ }
  }
  await t.falla(() => pedir("Otro", "otro@ejemplo.invalid"), /muchos pedidos/);
});

test("la tabla no se lee directo; el listado es solo del super admin; se marca atendido una vez", async () => {
  await t.falla(() => como("anon", null, () => t.q(`select * from public.pedidos_demo_brik`)), /permission|permiso/i);
  await t.falla(() => como("anon", null, () => t.q(`select public.admin_pedidos_demo(true)`)), /permission|permiso|administradores/i);
  await t.falla(() => como("authenticated", dueno, () => t.q(`select public.admin_pedidos_demo(true)`)), /administradores/);
  const [{ l }] = await como("authenticated", admin, () => t.q(`select public.admin_pedidos_demo(true) l`));
  const marta = l.find((p) => p.contacto === "387 000 1111");
  assert.ok(marta, "el admin ve el pedido");
  assert.equal(marta.gimnasio, "Gimnasio Prueba");
  await t.falla(() => como("authenticated", dueno, () => t.q(`select public.admin_atender_demo($1)`, [marta.id])), /administradores/);
  await como("authenticated", admin, () => t.q(`select public.admin_atender_demo($1)`, [marta.id]));
  await t.falla(() => como("authenticated", admin, () => t.q(`select public.admin_atender_demo($1)`, [marta.id])), /ya estaba atendido/);
  const [{ l: despues }] = await como("authenticated", admin, () => t.q(`select public.admin_pedidos_demo(true) l`));
  assert.ok(!despues.some((p) => p.id === marta.id));
  const [{ l: todos }] = await como("authenticated", admin, () => t.q(`select public.admin_pedidos_demo(false) l`));
  assert.ok(todos.some((p) => p.id === marta.id), "atendido queda en el historial");
});

test("planes públicos: solo los activos, con el precio que cargó el super admin", async () => {
  const antes = (await como("anon", null, () => t.q(`select public.planes_brik_publicos() p`)))[0].p.length;
  await t.q(`insert into public.plataforma_planes (nombre, precio_mensual, activo) values ('Plan visible', 12345.50, true), ('Plan apagado', 99999, false)`);
  const [{ p }] = await como("anon", null, () => t.q(`select public.planes_brik_publicos() p`));
  assert.equal(p.length, antes + 1);
  const visible = p.find((x) => x.nombre === "Plan visible");
  assert.equal(Number(visible.precio_mensual), 12345.5);
  assert.ok(!p.some((x) => x.nombre === "Plan apagado"));
});
