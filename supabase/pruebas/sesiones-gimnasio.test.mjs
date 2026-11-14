// F2.11 (SA-10) · Sesiones abiertas de un gimnasio y "Cerrar todas": solo el rol Principal (Soporte, Ventas y un dueño reciben error),
// con motivo; corta solo las del equipo activo de ese gimnasio (no las de BRIK ni las de otro gimnasio) y deja registro.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir } from "./_comun.mjs";

let t, admin, uVentas, uSoporte, dueno, recep, ajeno, bajaU;
async function como(usuario, fn) {
  await t.db.query("set role authenticated");
  await t.q(`select set_config('request.jwt.claims', $1, false)`, [JSON.stringify({ sub: usuario, role: "authenticated" })]);
  try { return await fn(); } finally { await t.db.query("reset role"); await t.q(`select set_config('request.jwt.claims', '', false)`); }
}
const uno = async (sql, p) => (await t.q(sql, p))[0];
const mk = async (pref) => (await uno(`insert into auth.users (email) values ($1) returning id, email`, [`${pref}${Math.random().toString().slice(2)}@ejemplo.invalid`]));
const sesion = (u, ua = "Chrome de prueba") => t.q(`insert into auth.sessions (user_id, user_agent) values ($1, $2)`, [u, ua]);
const cuantas = async (u) => (await uno(`select count(*)::int n from auth.sessions where user_id = $1`, [u])).n;

before(async () => {
  t = await abrir("prueba-sesiones-gimnasio");
  admin = (await mk("principal")).id;
  await t.q(`insert into public.administradores_plataforma (usuario_id) values ($1)`, [admin]);
  const v = await mk("ventas"), s = await mk("soporte");
  uVentas = v.id; uSoporte = s.id;
  for (const [u, rol] of [[v, "ventas"], [s, "soporte"]]) await como(admin, () => t.q(`select public.admin_dar_rol_brik($1, $2)`, [u.email, rol]));
  dueno = (await mk("dueno")).id; recep = (await mk("recep")).id; ajeno = (await mk("ajeno")).id; bajaU = (await mk("baja")).id;
  await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,'Dueña','dueno'), ($1,$3,'Ana','recepcion')`, [t.g, dueno, recep]);
  await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol, activo) values ($1,$2,'Ex empleado','recepcion', false)`, [t.g, bajaU]);
  for (const u of [dueno, dueno, recep, ajeno, bajaU, admin]) await sesion(u);
});
after(async () => t && t.cerrar());

test("solo el Principal lista y cierra; Soporte, Ventas y un dueño reciben error", async () => {
  for (const u of [uSoporte, uVentas, dueno]) {
    await como(u, async () => {
      await t.falla(() => t.q(`select public.admin_sesiones_gimnasio($1)`, [t.g]), /no puede hacer esto|administradores de la plataforma/);
      await t.falla(() => t.q(`select public.admin_cerrar_sesiones_gimnasio($1, 'un motivo de prueba largo')`, [t.g]), /no puede hacer esto|administradores de la plataforma/);
    });
  }
  assert.equal(await cuantas(dueno), 2, "no se cerró nada");
});

test("la lista trae solo las sesiones del equipo activo de ese gimnasio (no las de BRIK ni las de gente de afuera)", async () => {
  const lista = await como(admin, async () => (await uno(`select public.admin_sesiones_gimnasio($1) x`, [t.g])).x);
  assert.equal(lista.length, 3, "dos de la dueña y una de Ana");
  assert.deepEqual([...new Set(lista.map((s) => s.nombre))].sort(), ["Ana", "Dueña"]);
  assert.ok(lista.every((s) => s.mail && s.creada && s.actividad), "con mail y fechas");
});

test("Cerrar todas pide motivo, corta solo esas y deja registro", async () => {
  await como(admin, async () => {
    await t.falla(() => t.q(`select public.admin_cerrar_sesiones_gimnasio($1, 'corto')`, [t.g]), /al menos 10 letras/);
    await t.falla(() => t.q(`select public.admin_cerrar_sesiones_gimnasio($1, null)`, [t.g]), /al menos 10 letras/);
  });
  assert.equal(await cuantas(dueno), 2, "sin motivo no se cortó nada");
  const n = await como(admin, async () => (await uno(`select public.admin_cerrar_sesiones_gimnasio($1, 'Se fue una empleada y no devolvió la compu') n`, [t.g])).n);
  assert.equal(n, 3);
  assert.equal(await cuantas(dueno), 0);
  assert.equal(await cuantas(recep), 0);
  assert.equal(await cuantas(ajeno), 1, "alguien de afuera no se toca");
  assert.equal(await cuantas(bajaU), 1, "un ex integrante dado de baja no es del equipo activo: no se toca");
  assert.equal(await cuantas(admin), 1, "las de BRIK no se tocan");
  const reg = await uno(`select detalle from public.registro_brik where gimnasio_id = $1 and accion = 'cerrar_sesiones_gimnasio'`, [t.g]);
  assert.equal(reg.detalle.sesiones, 3);
  assert.match(reg.detalle.motivo, /empleada/);
  const vacia = await como(admin, async () => (await uno(`select public.admin_sesiones_gimnasio($1) x`, [t.g])).x);
  assert.equal(vacia.length, 0);
});

test("anon no puede ejecutarlas", async () => {
  const [{ a, b }] = await t.q(`select has_function_privilege('anon', 'public.admin_sesiones_gimnasio(uuid)', 'execute') a, has_function_privilege('anon', 'public.admin_cerrar_sesiones_gimnasio(uuid, text)', 'execute') b`);
  assert.equal(a, false);
  assert.equal(b, false);
});
