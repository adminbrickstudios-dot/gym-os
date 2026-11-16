// Mateo 16/11 · Cambiar el slug de un gimnasio no rompe un QR impreso (migración 20261116100000).
// El historial lo mantiene el trigger: cada slug que un gimnasio dejó queda guardado, lo resuelve slug_actual_de (anon) y nadie más lo puede tomar.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir } from "./_comun.mjs";

let t, admin, uDueno, otro;
const uno = async (sql, p) => (await t.q(sql, p))[0];
async function como(usuario, fn) {
  await t.db.query("set role authenticated");
  await t.q(`select set_config('request.jwt.claims', $1, false)`, [JSON.stringify({ sub: usuario, role: "authenticated" })]);
  try { return await fn(); } finally { await t.db.query("reset role"); await t.q(`select set_config('request.jwt.claims', '', false)`); }
}
before(async () => {
  t = await abrir("prueba-slugs-1");
  admin = (await uno(`insert into auth.users (email) values ($1) returning id`, [`a${Math.random()}@ejemplo.invalid`])).id;
  await t.q(`insert into public.administradores_plataforma (usuario_id) values ($1)`, [admin]);
  uDueno = (await uno(`insert into auth.users (email) values ($1) returning id`, [`d${Math.random()}@ejemplo.invalid`])).id;
  await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,'Dueña','dueno')`, [t.g, uDueno]);
  otro = (await uno(`insert into public.gimnasios (slug, nombre) values ('prueba-slugs-otro', 'Otro gimnasio') returning id`)).id;
});
after(async () => t && t.cerrar());

test("al cambiar el slug, el anterior queda guardado y slug_actual_de lo resuelve (también para anon)", async () => {
  await como(admin, () => t.q(`select public.admin_cambiar_slug($1, 'prueba-slugs-2')`, [t.g]));
  await como(admin, () => t.q(`select public.admin_cambiar_slug($1, 'prueba-slugs-3')`, [t.g]));
  await t.db.query("set role anon");
  try {
    for (const viejo of ["prueba-slugs-1", "prueba-slugs-2", "PRUEBA-SLUGS-1 "]) {
      assert.equal((await uno(`select public.slug_actual_de($1) s`, [viejo])).s, "prueba-slugs-3", viejo);
    }
    assert.equal((await uno(`select public.slug_actual_de('nunca-existio') s`)).s, null);
    assert.equal((await uno(`select public.slug_actual_de(null) s`)).s, null);
    // La tabla no se lee directo: solo la función devuelve algo, y solo un slug.
    await t.falla(() => t.q(`select * from public.slugs_anteriores`), /permission denied/);
  } finally { await t.db.query("reset role"); }
});

test("el slug que dejó un gimnasio no lo puede tomar otro (ni al crear ni al cambiar); el propio puede volver", async () => {
  await como(admin, async () => {
    await t.falla(() => t.q(`select public.admin_cambiar_slug($1, 'prueba-slugs-1')`, [otro]), /lo usó antes otro gimnasio/);
    await t.falla(() => t.q(`insert into public.gimnasios (slug, nombre) values ('prueba-slugs-2', 'Intruso')`), /lo usó antes otro gimnasio/);
    await t.q(`select public.admin_cambiar_slug($1, 'prueba-slugs-1')`, [t.g]); // el propio vuelve
  });
  assert.equal((await uno(`select count(*)::int n from public.slugs_anteriores where slug = 'prueba-slugs-1'`)).n, 0, "el slug vigente deja de ser 'anterior'");
  assert.equal((await uno(`select public.slug_actual_de('prueba-slugs-3') s`)).s, "prueba-slugs-1");
});

test("permisos en negativo: un dueño de otro gimnasio y un dueño común no pueden cambiar el slug (error, no vacío)", async () => {
  await como(uDueno, () => t.falla(() => t.q(`select public.admin_cambiar_slug($1, 'cualquiera-1')`, [otro]), /administradores/));
  await como(uDueno, () => t.falla(() => t.q(`select public.admin_cambiar_slug($1, 'cualquiera-2')`, [t.g]), /administradores/));
});
