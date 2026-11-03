// Super admin y claves (migración 0019). Cada función se llama con el rol
// de la persona logueada, como la llama la pantalla.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir } from "./_comun.mjs";

let t, otro, u = {}, eq = {};

async function persona(rol, gimnasio = null, conCuenta = true) {
  let usuario = null;
  if (conCuenta) [{ id: usuario }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`${rol}${Math.random()}@ejemplo.invalid`]);
  const [{ id }] = await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,$3,$4) returning id`,
    [gimnasio ?? t.g, usuario, `Persona ${rol}`, rol]);
  return { usuario, id };
}
// Como el usuario, y lo que escribe QUEDA (t.comoUsuario revierte todo al salir).
async function hacer(usuario, sql, params) {
  await t.q(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: usuario, role: "authenticated" })]);
  await t.q(`set local role authenticated`);
  try {
    return await t.q(sql, params);
  } finally {
    await t.q(`reset role`);
    await t.q(`select set_config('request.jwt.claims', '', true)`);
  }
}
const uno = async (usuario, sql, params) => (await hacer(usuario, sql, params))[0];
async function comoAnon(fn) {
  await t.q("savepoint anon");
  try {
    await t.q(`set local role anon`);
    return await fn();
  } finally {
    await t.q("rollback to savepoint anon");
  }
}

before(async () => {
  t = await abrir("prueba-super-admin");
  [{ id: otro }] = await t.q(`insert into public.gimnasios (slug, nombre) values ('prueba-super-admin-otro', 'Otro') returning id`);
  for (const rol of ["dueno", "encargado", "recepcion"]) ({ usuario: u[rol], id: eq[rol] } = await persona(rol));
  ({ usuario: u.dueno2, id: eq.dueno2 } = await persona("dueno"));
  ({ id: eq.sinCuenta } = await persona("profe", null, false));
  ({ usuario: u.ajeno, id: eq.ajeno } = await persona("dueno", otro));
  [{ id: u.admin }] = await t.q(`insert into auth.users (email) values ('admin-sa@ejemplo.invalid') returning id`);
  await t.q(`insert into public.administradores_plataforma (usuario_id) values ($1)`, [u.admin]);
});
after(async () => t && t.cerrar());

test("admin_entrar_gimnasio: el admin queda como Soporte BRIK y ve el panel; otro no puede", async () => {
  const { slug } = await uno(u.admin, `select public.admin_entrar_gimnasio($1) as slug`, [t.g]);
  const [g] = await t.q(`select slug from public.gimnasios where id = $1`, [t.g]);
  assert.equal(slug, g.slug);
  const [s] = await t.q(`select nombre, rol, es_soporte, activo from public.equipo where gimnasio_id = $1 and usuario_id = $2`, [t.g, u.admin]);
  assert.deepEqual(s, { nombre: "Soporte BRIK", rol: "dueno", es_soporte: true, activo: true });
  const { r } = await uno(u.admin, `select public.panel_gimnasio($1) as r`, [t.g]);
  assert.equal(r.yo.nombre, "Soporte BRIK");
  // Entrar dos veces no duplica
  await uno(u.admin, `select public.admin_entrar_gimnasio($1)`, [t.g]);
  const [{ n }] = await t.q(`select count(*)::int as n from public.equipo where gimnasio_id = $1 and usuario_id = $2`, [t.g, u.admin]);
  assert.equal(n, 1);
  await t.comoUsuario(u.dueno, () => t.falla(() => t.q(`select public.admin_entrar_gimnasio($1)`, [otro]), /administradores/));
});

test("admin_salir_gimnasio: desactiva el acceso de soporte; volver a entrar lo reactiva", async () => {
  await uno(u.admin, `select public.admin_salir_gimnasio($1)`, [t.g]);
  await t.comoUsuario(u.admin, () => t.falla(() => t.q(`select public.panel_gimnasio($1)`, [t.g]), /Sin permiso/));
  await t.comoUsuario(u.admin, () => t.falla(() => t.q(`select public.admin_salir_gimnasio($1)`, [t.g]), /No tenías acceso/));
  await uno(u.admin, `select public.admin_entrar_gimnasio($1)`, [t.g]);
  const { r } = await uno(u.admin, `select public.panel_gimnasio($1) as r`, [t.g]);
  assert.equal(r.yo.rol, "dueno");
});

test("admin_gimnasios / admin_gimnasio: el admin ve el equipo con mail; el dueño recibe error", async () => {
  const lista = await hacer(u.admin, `select * from public.admin_gimnasios()`);
  const fila = lista.find((g) => g.gimnasio_id === t.g);
  assert.equal(fila.estoy_dentro, true);
  assert.ok(!fila.duenos.includes("Soporte BRIK"));
  const { r } = await uno(u.admin, `select public.admin_gimnasio($1) as r`, [t.g]);
  assert.ok(r.equipo.some((p) => p.es_soporte && p.soy_yo));
  assert.ok(r.equipo.find((p) => p.equipo_id === eq.dueno).email.endsWith("@ejemplo.invalid"));
  await t.comoUsuario(u.dueno, () => t.falla(() => t.q(`select public.admin_gimnasio($1)`, [t.g]), /administradores/));
  await t.comoUsuario(u.dueno, () => t.falla(() => t.q(`select * from public.admin_gimnasios()`), /administradores/));
});

test("cuenta_para_nueva_clave: el dueño, a su equipo menos dueños y soporte; el admin, a cualquiera menos BRIK", async () => {
  const { r } = await uno(u.dueno, `select public.cuenta_para_nueva_clave($1) as r`, [eq.recepcion]);
  assert.equal(r.usuario_id, u.recepcion);
  await t.comoUsuario(u.dueno, () => t.falla(() => t.q(`select public.cuenta_para_nueva_clave($1)`, [eq.dueno2]), /Sin permiso/));
  await t.comoUsuario(u.dueno, () => t.falla(() => t.q(`select public.cuenta_para_nueva_clave($1)`, [eq.ajeno]), /Sin permiso/));
  await t.comoUsuario(u.encargado, () => t.falla(() => t.q(`select public.cuenta_para_nueva_clave($1)`, [eq.recepcion]), /Sin permiso/));
  const [{ id: soporte }] = await t.q(`select id from public.equipo where gimnasio_id = $1 and es_soporte`, [t.g]);
  await t.comoUsuario(u.dueno, () => t.falla(() => t.q(`select public.cuenta_para_nueva_clave($1)`, [soporte]), /Sin permiso/));
  const { r: delAdmin } = await uno(u.admin, `select public.cuenta_para_nueva_clave($1) as r`, [eq.dueno]);
  assert.equal(delAdmin.usuario_id, u.dueno);
  await t.comoUsuario(u.admin, () => t.falla(() => t.q(`select public.cuenta_para_nueva_clave($1)`, [soporte]), /Sin permiso/));
  await t.comoUsuario(u.admin, () => t.falla(() => t.q(`select public.cuenta_para_nueva_clave($1)`, [eq.sinCuenta]), /no tiene acceso/));
});

test("persona_para_dar_acceso: el dueño o el admin, solo a quien no tiene cuenta", async () => {
  const { r } = await uno(u.dueno, `select public.persona_para_dar_acceso($1) as r`, [eq.sinCuenta]);
  assert.equal(r.equipo_id, eq.sinCuenta);
  await uno(u.admin, `select public.persona_para_dar_acceso($1)`, [eq.sinCuenta]);
  await t.comoUsuario(u.recepcion, () => t.falla(() => t.q(`select public.persona_para_dar_acceso($1)`, [eq.sinCuenta]), /Sin permiso/));
  await t.comoUsuario(u.ajeno, () => t.falla(() => t.q(`select public.persona_para_dar_acceso($1)`, [eq.sinCuenta]), /Sin permiso/));
  await t.comoUsuario(u.dueno, () => t.falla(() => t.q(`select public.persona_para_dar_acceso($1)`, [eq.recepcion]), /ya tiene acceso/));
});

test("admin_agregar_persona: solo el admin, con rol válido", async () => {
  const { id } = await uno(u.admin, `select public.admin_agregar_persona($1, 'Nueva Dueña', 'dueno') as id`, [t.g]);
  const [p] = await t.q(`select gimnasio_id, rol, usuario_id from public.equipo where id = $1`, [id]);
  assert.deepEqual(p, { gimnasio_id: t.g, rol: "dueno", usuario_id: null });
  await t.comoUsuario(u.admin, () => t.falla(() => t.q(`select public.admin_agregar_persona($1, 'X', 'jefe')`, [t.g]), /Rol no válido/));
  await t.comoUsuario(u.dueno, () => t.falla(() => t.q(`select public.admin_agregar_persona($1, 'X', 'profe')`, [t.g]), /administradores/));
});

test("direcciones: el admin suma una propia (limpia) y la quita; el subdominio no se quita; repetida, error", async () => {
  const { id } = await uno(u.admin, `select public.admin_agregar_dominio($1, 'HTTPS://Prueba-SA.vercel.app/algo') as id`, [t.g]);
  const [d] = await t.q(`select host, tipo from public.dominios_gimnasio where id = $1`, [id]);
  assert.deepEqual(d, { host: "prueba-sa.vercel.app", tipo: "propio" });
  await t.comoUsuario(u.admin, () => t.falla(() => t.q(`select public.admin_agregar_dominio($1, 'prueba-sa.vercel.app')`, [otro]), /ya es de un gimnasio/));
  await t.comoUsuario(u.admin, () => t.falla(() => t.q(`select public.admin_agregar_dominio($1, 'no valido')`, [t.g]), /no es válida/));
  const [{ g }] = await t.q(`select slug as g from public.gimnasios where id = $1`, [t.g]);
  const porSlug = await t.q(`select host from public.gimnasio_por_slug($1)`, [g]);
  assert.equal(porSlug[0].host, "prueba-sa.vercel.app");
  await uno(u.admin, `select public.admin_quitar_dominio($1)`, [id]);
  const [sub] = await t.q(`select id from public.dominios_gimnasio where gimnasio_id = $1 and tipo = 'subdominio'`, [t.g]);
  if (sub) await t.comoUsuario(u.admin, () => t.falla(() => t.q(`select public.admin_quitar_dominio($1)`, [sub.id]), /Solo se quitan/));
  await t.comoUsuario(u.dueno, () => t.falla(() => t.q(`select public.admin_agregar_dominio($1, 'x-sa.vercel.app')`, [t.g]), /administradores/));
});

test("gimnasio_por_slug: lo puede llamar anon (el middleware) y devuelve una dirección", async () => {
  const [{ g }] = await t.q(`select slug as g from public.gimnasios where id = $1`, [t.g]);
  await t.q(`insert into public.dominios_gimnasio (gimnasio_id, host, tipo) values ($1, 'sub-sa.ejemplo.invalid', 'subdominio') on conflict do nothing`, [t.g]);
  const r = await comoAnon(() => t.q(`select gimnasio_id, host from public.gimnasio_por_slug($1)`, [g]));
  assert.equal(r[0].gimnasio_id, t.g);
  assert.ok(r[0].host);
});
