// Carril B · VD-26B: los pedidos de demo sin atender entran a las alertas de BRIK, y un plan puede quedar fuera de la web pública.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir } from "./_comun.mjs";

let t, admin;
async function como(usuario, fn) {
  await t.db.query("set role authenticated");
  await t.q(`select set_config('request.jwt.claims', $1, false)`, [JSON.stringify({ sub: usuario, role: "authenticated" })]);
  try { return await fn(); } finally { await t.db.query("reset role"); await t.q(`select set_config('request.jwt.claims', '', false)`); }
}
const uno = async (sql, p) => (await t.q(sql, p))[0];
before(async () => {
  t = await abrir("prueba-demo-alerta");
  admin = (await uno(`insert into auth.users (email) values ($1) returning id`, [`a${Math.random().toString().slice(2)}@ejemplo.invalid`])).id;
  await t.q(`insert into public.administradores_plataforma (usuario_id) values ($1)`, [admin]);
});
after(async () => t && t.cerrar());

test("un pedido de demo sin atender aparece en las alertas; pasado un día, en rojo", async () => {
  const antes = await como(admin, async () => (await uno(`select public.admin_alertas() x`)).x);
  const base = antes.alertas.filter((x) => x.clave === "pedidos_demo").length;
  await t.q(`insert into public.pedidos_demo_brik (nombre, contacto) values ('Ana Prueba', '+54 9 000 111 2222')`);
  const a = await como(admin, async () => (await uno(`select public.admin_alertas() x`)).x);
  const al = a.alertas.find((x) => x.clave === "pedidos_demo");
  assert.ok(al && /sin atender/.test(al.texto)); assert.equal(base, 0);
  await t.q(`insert into public.pedidos_demo_brik (nombre, contacto, creado_en) values ('Vieja Prueba', '+54 9 000 333 4444', now() - interval '2 days')`);
  const b = await como(admin, async () => (await uno(`select public.admin_alertas() x`)).x);
  assert.equal(b.alertas.find((x) => x.clave === "pedidos_demo").nivel, "rojo");
});

test("plan público: se puede sacar de la web sin borrarlo", async () => {
  const plan = await como(admin, async () => (await uno(`select public.admin_guardar_plan_brik(null, 'Plan Oculto', 99999) id`)).id);
  const nombres = async () => (await uno(`select public.planes_brik_publicos() x`)).x.map((p) => p.nombre);
  assert.ok((await nombres()).includes("Plan Oculto"));
  await como(admin, () => t.q(`select public.admin_plan_publico($1, false)`, [plan]));
  assert.ok(!(await nombres()).includes("Plan Oculto"));
  const lista = await como(admin, async () => (await uno(`select public.admin_planes_con_limites() x`)).x);
  assert.equal(lista.find((p) => p.id === plan).publico, false);
  await como(admin, () => t.falla(() => t.q(`select public.admin_plan_publico(gen_random_uuid(), true)`), /no existe/));
});
