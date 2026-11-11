// Carril B · F2: el soporte de BRIK no toca plata salvo que el dueño lo haya pedido; y "ver como este socio" (solo lectura).
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir } from "./_comun.mjs";

let t, admin, uLectura, socio;
async function como(usuario, fn) {
  await t.db.query("set role authenticated");
  await t.q(`select set_config('request.jwt.claims', $1, false)`, [JSON.stringify({ sub: usuario, role: "authenticated" })]);
  try { return await fn(); } finally { await t.db.query("reset role"); await t.q(`select set_config('request.jwt.claims', '', false)`); }
}
const uno = async (sql, p) => (await t.q(sql, p))[0];
const mk = async (pref) => (await uno(`insert into auth.users (email) values ($1) returning id, email`, [`${pref}${Math.random().toString().slice(2)}@ejemplo.invalid`]));

before(async () => {
  t = await abrir("prueba-soporte-plata");
  admin = (await mk("principal")).id;
  await t.q(`insert into public.administradores_plataforma (usuario_id) values ($1)`, [admin]);
  const l = await mk("lectura"); uLectura = l.id;
  await como(admin, () => t.q(`select public.admin_dar_rol_brik($1, 'lectura')`, [l.email]));
  socio = (await uno(`select id from public.socios where gimnasio_id = $1 limit 1`, [t.g])).id;
});
after(async () => t && t.cerrar());

const sinPlata = async () => (await uno(`select privado.soporte_sin_plata($1) x`, [t.g])).x;

test("entrar como soporte sin marcar plata: no puede cargar plata, y se nota en el motivo cuando sí se marca", async () => {
  await como(admin, () => t.q(`select public.admin_entrar_gimnasio($1, 'reviso un problema de planes', 'dueno')`, [t.g]));
  await t.q(`select set_config('request.jwt.claims', $1, false)`, [JSON.stringify({ sub: admin, role: "authenticated" })]);
  assert.equal(await sinPlata(), true);
  await t.q(`select set_config('request.jwt.claims', '', false)`);
  await como(admin, () => t.falla(() => t.q(`insert into public.movimientos_caja (gimnasio_id) values ($1)`, [t.g]), /no puede cargar ni cambiar plata/));
  await como(admin, () => t.falla(() => t.q(`insert into public.ventas (gimnasio_id) values ($1)`, [t.g]), /no puede cargar ni cambiar plata/));

  await como(admin, () => t.q(`select public.admin_entrar_gimnasio($1, 'me pidió corregir un cobro', 'dueno', true)`, [t.g]));
  await t.q(`select set_config('request.jwt.claims', $1, false)`, [JSON.stringify({ sub: admin, role: "authenticated" })]);
  assert.equal(await sinPlata(), false);
  await t.q(`select set_config('request.jwt.claims', '', false)`);
  const s = await uno(`select motivo, plata_autorizada from public.soportes_gimnasio where gimnasio_id = $1 and usuario_id = $2 and salio_en is null`, [t.g, admin]);
  assert.match(s.motivo, /pidió tocar plata/); assert.equal(s.plata_autorizada, true);
  // con permiso, el trigger no frena: falla por otra cosa (columnas obligatorias), no por la regla del soporte
  await como(admin, () => t.falla(() => t.q(`insert into public.movimientos_caja (gimnasio_id) values ($1)`, [t.g]), /^(?![\s\S]*no puede cargar ni cambiar plata)/));
});

test("quien no es soporte (sin sesión de soporte) no queda frenado por esta regla", async () => {
  assert.equal(await sinPlata(), false);   // sin usuario: no aplica
});

test("ver como este socio: solo lectura, con el motivo del acceso, y queda registrado", async () => {
  const v = await como(uLectura, async () => (await uno(`select public.admin_ver_socio($1, $2) x`, [t.g, socio])).x);
  assert.ok(v.nombre !== undefined); assert.ok(v.acceso); assert.ok(Array.isArray(v.ultimos_pagos)); assert.ok(Array.isArray(v.ultimos_ingresos));
  const r = await uno(`select count(*)::int n from public.registro_brik where accion = 'ver_como_socio' and gimnasio_id = $1`, [t.g]);
  assert.equal(r.n, 1);
  await como(uLectura, () => t.falla(() => t.q(`select public.admin_ver_socio($1, gen_random_uuid())`, [t.g]), /no existe/));
  const intruso = (await mk("intruso")).id;
  await como(intruso, () => t.falla(() => t.q(`select public.admin_ver_socio($1, $2)`, [t.g, socio]), /Solo para administradores/));
});
