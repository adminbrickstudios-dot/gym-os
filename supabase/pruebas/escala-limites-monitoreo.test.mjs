// Carril B · F9.4 y F9.6: RLS con (select auth.uid()), límites por plan, tablas que crecen, registro paginado y alertas.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir } from "./_comun.mjs";

let t, admin, uLectura, uVentas, plan;
async function como(usuario, fn) {
  await t.db.query("set role authenticated");
  await t.q(`select set_config('request.jwt.claims', $1, false)`, [JSON.stringify({ sub: usuario, role: "authenticated" })]);
  try { return await fn(); } catch (e) { console.log("INTERNO", e.message); throw e; } finally { await t.db.query("reset role"); await t.q(`select set_config('request.jwt.claims', '', false)`); }
}
const uno = async (sql, p) => (await t.q(sql, p))[0];
const mk = async (pref) => (await uno(`insert into auth.users (email) values ($1) returning id, email`, [`${pref}${Math.random().toString().slice(2)}@ejemplo.invalid`]));

before(async () => {
  t = await abrir("prueba-escala-limites");
  admin = (await mk("principal")).id;
  await t.q(`insert into public.administradores_plataforma (usuario_id) values ($1)`, [admin]);
  const l = await mk("lectura"), v = await mk("ventas"); uLectura = l.id; uVentas = v.id;
  for (const [u, rol] of [[l, "lectura"], [v, "ventas"]]) await como(admin, () => t.q(`select public.admin_dar_rol_brik($1, $2)`, [u.email, rol]));
});
after(async () => t && t.cerrar());

test("ESC-03 ninguna política llama auth.uid() pelado (se evalúa una vez, no por fila)", async () => {
  const pelados = await t.q(`select tablename, policyname from pg_policies where schemaname = 'public'
    and coalesce(qual, '') || coalesce(with_check, '') ~ 'auth\\.uid\\(\\)' and coalesce(qual, '') || coalesce(with_check, '') !~ '(?i)select auth\\.uid\\(\\)'`);
  assert.deepEqual(pelados, []);
  const envueltas = await t.q(`select count(*)::int n from pg_policies where schemaname = 'public' and coalesce(qual, '') || coalesce(with_check, '') ~ '(?i)select auth\\.uid\\(\\)'`);
  assert.ok(envueltas[0].n >= 9, "las que estaban peladas ahora están envueltas");
});

test("ESC-08 límites por plan: se guardan en datos y se ve quién se acerca", async () => {
  await como(admin, async () => {
    plan = (await uno(`select public.admin_guardar_plan_brik(null, 'Plan Límites', 20000) id`)).id;
    await t.q(`select public.admin_asignar_plan_brik($1, $2)`, [t.g, plan]);
    await t.falla(() => t.q(`select public.admin_guardar_limites_plan($1, 0, 3)`, [plan]), /mayores a cero/);
  });
  await como(uLectura, () => t.falla(() => t.q(`select public.admin_guardar_limites_plan($1, 100, 1)`, [plan]), /no puede hacer esto/));
  const socios = (await uno(`select count(*)::int n from public.socios where gimnasio_id = $1 and dado_de_baja_en is null`, [t.g])).n;
  assert.ok(socios > 0);
  const estado = async () => (await como(uLectura, async () => (await uno(`select public.admin_limites_gimnasios() x`)).x)).find((x) => x.gimnasio_id === t.g);
  await como(uVentas, () => t.q(`select public.admin_guardar_limites_plan($1, $2, 5)`, [plan, socios * 10]));
  assert.equal((await estado()).estado, "ok");
  await como(uVentas, () => t.q(`select public.admin_guardar_limites_plan($1, $2, 5)`, [plan, socios]));   // justo en el límite: 100 %
  assert.equal((await estado()).estado, "cerca");
  await como(uVentas, () => t.q(`select public.admin_guardar_limites_plan($1, $2, 5)`, [plan, socios - 1]));
  assert.equal((await estado()).estado, "pasado");
  await como(uVentas, () => t.q(`select public.admin_guardar_limites_plan($1, null, null)`, [plan]));
  assert.equal((await estado()).estado, "sin_limite");
  const p = await como(uLectura, async () => (await uno(`select public.admin_planes_con_limites() x`)).x);
  assert.ok(p.find((x) => x.id === plan));
});

test("ESC-05 tablas que crecen: tamaño a la vista y el registro de BRIK siempre paginado por cursor", async () => {
  const tam = await como(uLectura, async () => (await uno(`select public.admin_tamano_tablas() x`)).x);
  assert.ok(tam.find((x) => x.tabla === "ingresos")); assert.ok(tam.every((x) => typeof x.partir === "boolean"));
  for (let i = 0; i < 7; i++) await t.q(`insert into public.registro_brik (usuario_id, accion, creado_en) values ($1, 'prueba_pagina', now() - ($2 || ' minutes')::interval)`, [admin, String(i + 1)]);
  const primera = await como(admin, async () => (await uno(`select public.admin_registro_brik(3) x`)).x);
  assert.equal(primera.length, 3);
  const siguiente = await como(admin, async () => (await uno(`select public.admin_registro_brik(3, $1) x`, [primera[2].cuando])).x);
  assert.ok(siguiente.length >= 1 && siguiente.every((r) => new Date(r.cuando) < new Date(primera[2].cuando)), "la página siguiente son filas más viejas, sin repetir");
  assert.ok((await como(admin, async () => (await uno(`select jsonb_array_length(public.admin_registro_brik(100000)) n`)).n)) <= 200, "el tope de una página es 200");
  await como(uVentas, () => t.falla(() => t.q(`select public.admin_registro_brik(10)`), /no puede hacer esto/));
});

test("ESC-06 alertas: errores de la última hora, webhooks fallidos y límites", async () => {
  const base = await como(admin, async () => (await uno(`select public.admin_alertas() x`)).x);
  assert.equal(typeof base.hay_rojas, "boolean");
  for (let i = 0; i < 6; i++) await t.q(`insert into public.errores_app (gimnasio_id, pantalla, mensaje) values ($1, '/panel/x', 'e')`, [t.g]);
  await t.q(`insert into public.eventos_webhook (origen, tipo, id_externo, gimnasio_id, error) values ('mp_cobros','payment','alerta-1',$1,'fallo')`, [t.g]);
  const a = await como(uLectura, async () => (await uno(`select public.admin_alertas() x`)).x);
  const claves = Object.fromEntries(a.alertas.map((x) => [x.clave, x.nivel]));
  assert.equal(claves.errores_hora, "amarillo"); assert.equal(claves.webhooks_fallidos, "rojo"); assert.equal(a.hay_rojas, true);
  for (let i = 0; i < 15; i++) await t.q(`insert into public.errores_app (gimnasio_id, pantalla, mensaje) values ($1, '/panel/x', 'e')`, [t.g]);
  const b = await como(admin, async () => (await uno(`select public.admin_alertas() x`)).x);
  assert.equal(b.alertas.find((x) => x.clave === "errores_hora").nivel, "rojo");
});
