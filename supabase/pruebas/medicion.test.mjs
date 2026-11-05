// COM-11 (0131): píxel de Meta y Google Analytics. Solo IDs validados (nunca
// código libre), solo el dueño los guarda, y la página los entrega solo si
// está publicada.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir } from "./_comun.mjs";

let t, u = {}, host;
async function como(usuario, fn) {
  await t.db.query("set role authenticated");
  await t.q(`select set_config('request.jwt.claims', $1, false)`, [JSON.stringify({ sub: usuario, role: "authenticated" })]);
  try { return await fn(); } finally { await t.db.query("reset role"); await t.q(`select set_config('request.jwt.claims', '', false)`); }
}
before(async () => {
  t = await abrir("prueba-medicion");
  for (const rol of ["dueno", "encargado"]) {
    const [{ id }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`${rol}${Math.random()}@ejemplo.invalid`]);
    await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,$3,$4)`, [t.g, id, rol, rol]);
    u[rol] = id;
  }
  host = `medicion-${Date.now()}.localhost`;
  await t.q(`insert into public.dominios_gimnasio (gimnasio_id, host, tipo) values ($1, $2, 'subdominio')`, [t.g, host]);
  const n = (await t.q(`update public.landing_gimnasio set publicada = false where gimnasio_id = $1 returning 1`, [t.g])).length;
  if (!n) await t.q(`insert into public.landing_gimnasio (gimnasio_id, publicada) values ($1, false)`, [t.g]);
});
after(async () => t && t.cerrar());

test("solo IDs válidos, solo el dueño, y la página los da solo publicada", async () => {
  await como(u.encargado, async () => {
    const [{ m }] = await t.q(`select public.medicion_panel($1) m`, [t.g]);
    assert.equal(m.pixel_meta, null);
    await t.falla(() => t.q(`select public.guardar_medicion($1, '1234567890', null)`, [t.g]), /permiso|rol|acceso/i);
  });
  await como(u.dueno, async () => {
    await t.falla(() => t.q(`select public.guardar_medicion($1, '<script>alert(1)</script>', null)`, [t.g]), /solo números/);
    await t.falla(() => t.q(`select public.guardar_medicion($1, null, 'UA-1234-1')`, [t.g]), /empieza con G-/);
    await t.falla(() => t.q(`select public.guardar_medicion($1, null, 'G-AB"><script>')`, [t.g]), /empieza con G-/);
    const [{ m }] = await t.q(`select public.guardar_medicion($1, ' 123456789012345 ', 'g-ab12cd34ef') m`, [t.g]);
    assert.equal(m.pixel_meta, "123456789012345");
    assert.equal(m.google_analytics, "G-AB12CD34EF");
  });
  await t.db.query("set role anon");
  try {
    const [{ m }] = await t.q(`select public.medicion_publica($1) m`, [host]);
    assert.deepEqual(m, {}, "sin publicar no carga nada");
  } finally { await t.db.query("reset role"); }
  await t.q(`update public.landing_gimnasio set publicada = true where gimnasio_id = $1`, [t.g]);
  await t.db.query("set role anon");
  try {
    const [{ m }] = await t.q(`select public.medicion_publica($1) m`, [host.toUpperCase()]);
    assert.equal(m.pixel_meta, "123456789012345");
    assert.equal(m.google_analytics, "G-AB12CD34EF");
    await t.falla(() => t.q(`select public.guardar_medicion($1, null, null)`, [t.g]), /permission|permiso/i);
  } finally { await t.db.query("reset role"); }
  await como(u.dueno, async () => {
    const [{ m }] = await t.q(`select public.guardar_medicion($1, '', '') m`, [t.g]);
    assert.equal(m.pixel_meta, null);
    assert.equal(m.google_analytics, null);
  });
});
