// VD-11 (20261106004900): el menú del encargado no muestra "Gastos" si el dueño
// no se lo prendió (encargado_ve_gastos, apagado de origen); el dueño siempre
// lo ve; la recepción no lo tiene en su lista de roles (lo decide el menú),
// pero la base tampoco le deja entrar a los gastos.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir } from "./_comun.mjs";

let t, u = {};
async function como(usuario, fn) {
  await t.db.query("set role authenticated");
  await t.q(`select set_config('request.jwt.claims', $1, false)`, [JSON.stringify({ sub: usuario, role: "authenticated" })]);
  try { return await fn(); } finally { await t.db.query("reset role"); await t.q(`select set_config('request.jwt.claims', '', false)`); }
}
before(async () => {
  t = await abrir("prueba-menu-gastos");
  for (const rol of ["dueno", "encargado", "recepcion"]) {
    const [{ id }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`${rol}${Math.random()}@ejemplo.invalid`]);
    await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,$3,$4)`, [t.g, id, rol, rol]);
    u[rol] = id;
  }
});
after(async () => t && t.cerrar());
const panel = async (quien) => (await como(u[quien], () => t.q(`select public.panel_gimnasio($1) p`, [t.g])))[0].p;

test("el encargado sin permiso no ve Gastos en el menú; con permiso sí; el dueño siempre", async () => {
  await t.q(`update public.configuracion_gimnasio set encargado_ve_gastos = false where gimnasio_id = $1`, [t.g]);
  let p = await panel("encargado");
  assert.ok(p.secciones_apagadas.includes("gastos"), "el encargado sin permiso no tiene Gastos");
  assert.equal(p.permisos.encargado_ve_gastos, false);
  assert.ok(!(await panel("dueno")).secciones_apagadas.includes("gastos"), "el dueño siempre lo ve");

  await t.q(`update public.configuracion_gimnasio set encargado_ve_gastos = true where gimnasio_id = $1`, [t.g]);
  p = await panel("encargado");
  assert.ok(!p.secciones_apagadas.includes("gastos"), "con permiso aparece");
  assert.equal(p.permisos.encargado_ve_gastos, true);
});

test("sin permiso, la base tampoco deja entrar a los gastos (no es solo el menú)", async () => {
  await t.q(`update public.configuracion_gimnasio set encargado_ve_gastos = false where gimnasio_id = $1`, [t.g]);
  await como(u.encargado, () => t.falla(() => t.q(`select public.ganancia_mes($1, null)`, [t.g]), /no le dio acceso a los gastos/));
  await como(u.recepcion, () => t.falla(() => t.q(`select public.ganancia_mes($1, null)`, [t.g]), /permiso|rol/i));
});
