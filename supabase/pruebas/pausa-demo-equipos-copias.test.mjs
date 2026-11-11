// Carril B · cierre de F2: estado del gimnasio para la pantalla, landing neutral de una demo vencida, estado de copias y equipo nuevo de BRIK.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir } from "./_comun.mjs";

let t, admin, intruso;
async function como(usuario, fn, extra = {}) {
  await t.db.query("set role authenticated");
  await t.q(`select set_config('request.jwt.claims', $1, false)`, [JSON.stringify({ sub: usuario, role: "authenticated", ...extra })]);
  try { return await fn(); } finally { await t.db.query("reset role"); await t.q(`select set_config('request.jwt.claims', '', false)`); }
}
const uno = async (sql, p) => (await t.q(sql, p))[0];
const mk = async (pref) => (await uno(`insert into auth.users (email) values ($1) returning id, email`, [`${pref}${Math.random().toString().slice(2)}@ejemplo.invalid`]));

before(async () => {
  t = await abrir("prueba-pausa-demo");
  admin = (await mk("principal")).id; intruso = (await mk("intruso")).id;
  await t.q(`insert into public.administradores_plataforma (usuario_id) values ($1)`, [admin]);
});
after(async () => t && t.cerrar());

test("estado del gimnasio: normal, pausado, dado de baja y demo vencida; solo para el equipo o BRIK", async () => {
  const r0 = await como(admin, async () => (await uno(`select public.estado_gimnasio_aviso($1) x`, [t.g])).x);
  assert.deepEqual([r0.pausado, r0.baja, r0.demo_vencida], [false, false, false]);
  await t.q(`update public.gimnasios set suspension_manual_en = now(), suspension_manual_motivo = 'prueba' where id = $1`, [t.g]);
  assert.equal((await como(admin, async () => (await uno(`select public.estado_gimnasio_aviso($1) x`, [t.g])).x)).pausado, true);
  await t.q(`update public.gimnasios set suspension_manual_en = null, suspension_manual_motivo = null, baja_en = now() where id = $1`, [t.g]);
  assert.equal((await como(admin, async () => (await uno(`select public.estado_gimnasio_aviso($1) x`, [t.g])).x)).baja, true);
  await t.q(`update public.gimnasios set baja_en = null, es_demo = true, demo_hasta = now() - interval '1 day' where id = $1`, [t.g]);
  assert.equal((await como(admin, async () => (await uno(`select public.estado_gimnasio_aviso($1) x`, [t.g])).x)).demo_vencida, true);
  await como(intruso, () => t.falla(() => t.q(`select public.estado_gimnasio_aviso($1)`, [t.g]), /No tenés acceso/));
});

test("landing: una demo vencida muestra la portada neutral (marca sin contenido ni WhatsApp), no la página publicada", async () => {
  const host = (await uno(`select host from public.dominios_gimnasio where gimnasio_id = $1 limit 1`, [t.g]))?.host;
  if (!host) return;   // sin dominio no hay landing que pedir
  await t.q(`update public.landing_gimnasio set publicada = true where gimnasio_id = $1`, [t.g]);
  await t.q(`update public.gimnasios set es_demo = false, demo_hasta = null where id = $1`, [t.g]);
  const normal = (await uno(`select public.landing_publica($1) x`, [host])).x;
  assert.equal(normal.publicada, true);
  await t.q(`update public.gimnasios set es_demo = true, demo_hasta = now() - interval '1 hour' where id = $1`, [t.g]);
  const vencida = (await uno(`select public.landing_publica($1) x`, [host])).x;
  assert.equal(vencida.publicada, false);
  assert.ok(vencida.marca.nombre);
  assert.equal(vencida.contacto.whatsapp, null);
});

test("estado de copias: cuándo y quién exportó por última vez", async () => {
  const antes = await como(admin, async () => (await uno(`select public.admin_estado_copias($1) x`, [t.g])).x);
  assert.equal(antes.ultima_exportacion, null);
  await t.q(`insert into public.registro_brik (usuario_id, gimnasio_id, accion) values ($1, $2, 'exportar_gimnasio')`, [admin, t.g]);
  const d = await como(admin, async () => (await uno(`select public.admin_estado_copias($1) x`, [t.g])).x);
  assert.ok(d.ultima_exportacion); assert.equal(d.exportaciones, 1);
  await como(intruso, () => t.falla(() => t.q(`select public.admin_estado_copias($1)`, [t.g]), /Solo para administradores/));
});

test("equipo nuevo de BRIK: el primero no avisa, uno distinto sí y queda en el registro", async () => {
  const s1 = (await uno(`insert into auth.sessions (id, user_id, user_agent) values (gen_random_uuid(), $1, 'Chrome en Windows') returning id`, [admin])).id;
  const s2 = (await uno(`insert into auth.sessions (id, user_id, user_agent) values (gen_random_uuid(), $1, 'Safari en iPhone') returning id`, [admin])).id;
  const r1 = await como(admin, async () => (await uno(`select public.admin_registrar_equipo() x`)).x, { session_id: s1 });
  assert.equal(r1.nuevo, false);
  const r1b = await como(admin, async () => (await uno(`select public.admin_registrar_equipo() x`)).x, { session_id: s1 });
  assert.equal(r1b.nuevo, false);
  const r2 = await como(admin, async () => (await uno(`select public.admin_registrar_equipo() x`)).x, { session_id: s2 });
  assert.equal(r2.nuevo, true);
  assert.equal((await uno(`select count(*)::int n from public.registro_brik where accion = 'equipo_nuevo' and usuario_id = $1`, [admin])).n, 1);
  await como(intruso, () => t.falla(() => t.q(`select public.admin_registrar_equipo()`), /Solo para administradores/));
});
