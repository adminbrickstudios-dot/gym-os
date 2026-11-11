// Carril B · F2.5: con 200 gimnasios el tablero y la lista del super admin abren en menos de 2 s (LISTO SI de SA-1).
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir } from "./_comun.mjs";

let t, admin;
async function como(usuario, fn) {
  await t.db.query("set role authenticated");
  await t.q(`select set_config('request.jwt.claims', $1, false)`, [JSON.stringify({ sub: usuario, role: "authenticated" })]);
  try { return await fn(); } finally { await t.db.query("reset role"); await t.q(`select set_config('request.jwt.claims', '', false)`); }
}
const ms = async (fn) => { const d = performance.now(); const r = await fn(); return [r, performance.now() - d]; };

before(async () => {
  t = await abrir("prueba-sa-escala");
  admin = (await t.q(`insert into auth.users (email) values ($1) returning id`, [`escala${Math.random()}@ejemplo.invalid`]))[0].id;
  await t.q(`insert into public.administradores_plataforma (usuario_id) values ($1)`, [admin]);
  // 200 gimnasios con dueño, algunos socios, entradas de hoy y errores: lo que mira el tablero.
  // Cada gimnasio nuevo dispara sus triggers (configuración, sede, landing, plantillas, historial) y con muchos en una sola transacción
  // tarda minutos. Lo que se mide acá son las funciones del super admin, que solo necesitan gimnasios, equipo y socios: se apagan los triggers
  // de usuario para sembrar (todo se deshace al final de la prueba).
  await t.q(`alter table public.gimnasios disable trigger user`);
  await t.q(`insert into public.gimnasios (slug, nombre) select 'escala-' || n, 'Escala ' || n from generate_series(1, 200) n`);
  await t.q(`alter table public.gimnasios enable trigger user`);
  await t.q(`insert into public.equipo (gimnasio_id, nombre, rol) select id, 'Dueño ' || slug, 'dueno' from public.gimnasios where slug like 'escala-%'`);
  await t.q(`insert into public.socios (gimnasio_id, numero, nombre, apellido) select g.id, s, 'Socio', g.slug || '-' || s from public.gimnasios g, generate_series(1, 5) s where g.slug like 'escala-%'`);
  await t.q(`insert into public.errores_app (gimnasio_id, pantalla, mensaje) select id, '/panel/x', 'error de prueba' from public.gimnasios where slug like 'escala-%' and (length(slug) % 3) = 0`);
});
after(async () => t && t.cerrar());

test("SA-1 con 200 gimnasios el tablero abre en menos de 2 s", async () => {
  await como(admin, async () => {
    const [x, tiempo] = await ms(async () => (await t.q(`select public.admin_tablero() x`))[0].x);
    assert.ok(x.numeros.activos_hoy);
    assert.ok(x.necesitan_atencion.length > 50, "con 200 gimnasios sin terminar hay mucho para atender");
    console.log(`  tablero con 200 gimnasios: ${tiempo.toFixed(0)} ms`);
    assert.ok(tiempo < 2000, `el tablero tardó ${tiempo.toFixed(0)} ms`);
  });
});

test("SA-2 con 200 gimnasios la lista (y con filtros) abre en menos de 2 s", async () => {
  await como(admin, async () => {
    const [l, tiempo] = await ms(async () => (await t.q(`select public.admin_lista_gimnasios() l`))[0].l);
    assert.ok(l.length >= 200);
    console.log(`  lista con 200 gimnasios: ${tiempo.toFixed(0)} ms`);
    assert.ok(tiempo < 2000, `la lista tardó ${tiempo.toFixed(0)} ms`);
    const [f, tf] = await ms(async () => (await t.q(`select public.admin_lista_gimnasios('escala-1', p_abono => 'sin_abono') l`))[0].l);
    assert.ok(f.length >= 1);
    assert.ok(tf < 2000, `la lista filtrada tardó ${tf.toFixed(0)} ms`);
  });
});

test("SA-9 el uso por gimnasio y los errores de 24 h también", async () => {
  await como(admin, async () => {
    const [u, tu] = await ms(async () => (await t.q(`select public.admin_uso_gimnasios() x`))[0].x);
    assert.ok(u.length >= 200); assert.ok(tu < 2000, `el uso tardó ${tu.toFixed(0)} ms`);
    const [e, te] = await ms(async () => (await t.q(`select public.admin_errores() x`))[0].x);
    assert.ok(e.length >= 1); assert.ok(te < 2000, `los errores tardaron ${te.toFixed(0)} ms`);
  });
});
