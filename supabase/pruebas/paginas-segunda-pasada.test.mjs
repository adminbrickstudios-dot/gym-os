// VD-62 (6200): video de portada de la página del gimnasio y WhatsApp de BRIK para "Pedí una demo".
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir } from "./_comun.mjs";

let t, admin, dueno, recep;
async function como(rol, usuario, fn) {
  await t.db.query(`set role ${rol}`);
  await t.q(`select set_config('request.jwt.claims', $1, false)`, [JSON.stringify(usuario ? { sub: usuario, role: rol } : { role: rol })]);
  try { return await fn(); } finally {
    try { await t.db.query("reset role"); await t.q(`select set_config('request.jwt.claims', '', false)`); } catch { /* lo deshace falla() */ }
  }
}
before(async () => {
  t = await abrir("prueba-paginas-2");
  [{ id: admin }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`a${Math.random()}@ejemplo.invalid`]);
  await t.q(`insert into public.administradores_plataforma (usuario_id) values ($1)`, [admin]);
  [{ id: dueno }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`d${Math.random()}@ejemplo.invalid`]);
  await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,'Dueña','dueno')`, [t.g, dueno]);
  [{ id: recep }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`r${Math.random()}@ejemplo.invalid`]);
  await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,'Recep','recepcion')`, [t.g, recep]);
});
after(async () => t && t.cerrar());

test("el dueño guarda el video de portada y la página pública lo trae", async () => {
  const [{ ok }] = await t.q(`select count(*)::int ok from public.landing_gimnasio where gimnasio_id = $1`, [t.g]);
  assert.equal(ok, 1, "el gimnasio de prueba tiene página");
  const url = "https://ejemplo.invalid/portada.mp4?v=2";
  const [{ r }] = await como("authenticated", dueno, () => t.q(`select public.guardar_video_portada($1, $2) r`, [t.g, url]));
  assert.equal(r, url);
  const [{ l }] = await t.q(`select privado.landing_completa($1) l`, [t.g]);
  assert.equal(l.portada.video_url, url);
  assert.ok(Array.isArray(l.equipo_publico) && l.prueba_social, "sigue trayendo equipo y prueba social");
  await como("authenticated", dueno, () => t.q(`select public.guardar_video_portada($1, '  ') r`, [t.g]));
  const [{ l: sin }] = await t.q(`select privado.landing_completa($1) l`, [t.g]);
  assert.equal(sin.portada.video_url, null);
});

test("el video tiene que ser un link https a mp4 o webm; solo el dueño lo cambia", async () => {
  for (const mal of ["http://ejemplo.invalid/a.mp4", "https://ejemplo.invalid/a.mov", "https://ejemplo.invalid/pagina", "javascript:alert(1)"]) {
    await t.falla(() => como("authenticated", dueno, () => t.q(`select public.guardar_video_portada($1, $2)`, [t.g, mal])), /link directo/);
  }
  await t.falla(() => como("authenticated", recep, () => t.q(`select public.guardar_video_portada($1, 'https://ejemplo.invalid/a.mp4')`, [t.g])), /.+/);
  await t.falla(() => como("anon", null, () => t.q(`select public.guardar_video_portada($1, 'https://ejemplo.invalid/a.mp4')`, [t.g])), /permission|permiso/i);
});

test("el WhatsApp de la plataforma: cualquiera lo lee, solo el super admin lo cambia, la tabla no se lee directo", async () => {
  const [{ c: antes }] = await como("anon", null, () => t.q(`select public.contacto_plataforma_publico() c`));
  assert.ok(antes.mensaje_demo.length > 0);
  await t.falla(() => como("anon", null, () => t.q(`select * from public.plataforma_contacto`)), /permission|permiso/i);
  await t.falla(() => como("authenticated", dueno, () => t.q(`select public.admin_guardar_contacto_plataforma('+5493875550000', 'Hola')`)), /administradores/);
  await t.falla(() => como("authenticated", admin, () => t.q(`select public.admin_guardar_contacto_plataforma('12345', 'Hola')`)), /WhatsApp/);
  await t.falla(() => como("authenticated", admin, () => t.q(`select public.admin_guardar_contacto_plataforma('+5493875550000', $1)`, ["x".repeat(301)])), /largo/);
  const [{ c }] = await como("authenticated", admin, () => t.q(`select public.admin_guardar_contacto_plataforma('+54 9 387 555-0000', 'Quiero la demo') c`));
  assert.equal(c.whatsapp, "+5493875550000");
  const [{ c: leido }] = await como("anon", null, () => t.q(`select public.contacto_plataforma_publico() c`));
  assert.deepEqual(leido, { whatsapp: "+5493875550000", mensaje_demo: "Quiero la demo" });
  const [{ c: vacio }] = await como("authenticated", admin, () => t.q(`select public.admin_guardar_contacto_plataforma('', '') c`));
  assert.equal(vacio.whatsapp, null, "se puede quitar el número: la página no muestra el botón");
  assert.equal((await t.q(`select count(*)::int n from public.plataforma_contacto`))[0].n, 1);
});
