// F9.2 (EDIT-D04) y F9.3 (WEB-06) · 20261111193000.
// Restaurar un cambio de Configuración: apagado por defecto, solo el dueño, solo lo que no toca plata ni la puerta,
// solo el último cambio de cada dato, deja su propia fila en el historial (se puede volver a deshacer).
// Términos por gimnasio: arrancan sin publicar, solo el dueño los guarda, la página pública solo los ve si se publicaron.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir } from "./_comun.mjs";

let t, u = {}, host, otroG, otroDueno;
async function como(usuario, fn) {
  await t.db.query("set role authenticated");
  await t.q(`select set_config('request.jwt.claims', $1, false)`, [JSON.stringify({ sub: usuario, role: "authenticated" })]);
  try { return await fn(); } finally { await t.db.query("reset role"); await t.q(`select set_config('request.jwt.claims', '', false)`); }
}
const fallaComo = (usuario, fn, patron) => como(usuario, () => t.falla(fn, patron));
const rpc = (usuario, sql, params) => como(usuario, async () => (await t.q(sql, params))[0]);
const ultimo = async (campo) => (await t.q(`select id, antes, despues from public.historial_configuracion where gimnasio_id = $1 and campo = $2 order by cambiado_en desc, id limit 1`, [t.g, campo]))[0];
const restaurables = (usuario) => como(usuario, async () => (await t.q(`select public.cambios_restaurables($1) as r`, [t.g]))[0].r);

before(async () => {
  t = await abrir("f9-terminos");
  for (const [rol, nombre] of [["dueno", "Sofía"], ["encargado", "Martín"], ["recepcion", "Ana"]]) {
    const [{ id }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`${rol}${Math.random()}@ejemplo.invalid`]);
    await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,$3,$4)`, [t.g, id, nombre, rol]);
    u[rol] = id;
  }
  host = "f9-terminos.ejemplo.invalid";
  await t.q(`insert into public.dominios_gimnasio (gimnasio_id, host, tipo, verificado_en) values ($1, $2, 'subdominio', now()) on conflict do nothing`, [t.g, host]);
  const [{ id: gx }] = await t.q(`insert into public.gimnasios (slug, nombre) values ('f9-terminos-otro', 'Otro') returning id`);
  const [{ id: ux }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`otro${Math.random()}@ejemplo.invalid`]);
  await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,'Bruno','dueno')`, [gx, ux]);
  otroG = gx; otroDueno = ux;
});
after(async () => t && t.cerrar());

test("restaurar cambios arranca apagado: la lista viene vacía y restaurar da error", async () => {
  await t.q(`update public.configuracion_gimnasio set color_acento = '#112233' where gimnasio_id = $1`, [t.g]);
  const h = await ultimo("color_acento");
  assert.ok(h, "el cambio quedó en el historial");
  assert.deepEqual(await restaurables(u.dueno), []);
  await fallaComo(u.dueno, () => t.q(`select public.restaurar_cambio_configuracion($1, $2)`, [t.g, h.id]), /todavía no está disponible/);
});

test("prendida la función: el dueño restaura y vuelve el valor anterior; queda su fila en el historial", async () => {
  await t.q(`insert into public.funciones_gimnasio (gimnasio_id, clave, activa) values ($1, 'restaurar_cambios', true)`, [t.g]);
  const antes = (await t.q(`select color_acento from public.configuracion_gimnasio where gimnasio_id = $1`, [t.g]))[0].color_acento;
  assert.equal(antes, "#112233");
  const h = await ultimo("color_acento");
  const lista = await restaurables(u.dueno);
  assert.ok(lista.some((x) => x.id === h.id), "el último cambio aparece como restaurable");
  const r = await rpc(u.dueno, `select public.restaurar_cambio_configuracion($1, $2) as r`, [t.g, h.id]);
  assert.equal(r.r.campo, "color_acento");
  const hoy = (await t.q(`select color_acento from public.configuracion_gimnasio where gimnasio_id = $1`, [t.g]))[0].color_acento;
  assert.equal(hoy, h.antes);
  const n = (await t.q(`select count(*)::int n from public.historial_configuracion where gimnasio_id = $1 and campo = 'color_acento'`, [t.g]))[0].n;
  assert.equal(n, 2, "el restaurar también queda en el historial");
  // Y se puede deshacer lo restaurado.
  const h2 = await ultimo("color_acento");
  await rpc(u.dueno, `select public.restaurar_cambio_configuracion($1, $2)`, [t.g, h2.id]);
  assert.equal((await t.q(`select color_acento from public.configuracion_gimnasio where gimnasio_id = $1`, [t.g]))[0].color_acento, "#112233");
});

test("un cambio viejo no se restaura si el dato cambió después", async () => {
  const viejo = await ultimo("color_acento");
  await t.q(`update public.configuracion_gimnasio set color_acento = '#445566' where gimnasio_id = $1`, [t.g]);
  await fallaComo(u.dueno, () => t.q(`select public.restaurar_cambio_configuracion($1, $2)`, [t.g, viejo.id]), /ya cambió después/);
});

test("nombre, página y mensajes se restauran; las filas se verifican (todo o nada)", async () => {
  await t.q(`update public.gimnasios set nombre = 'Nombre Nuevo' where id = $1`, [t.g]);
  const h = await ultimo("nombre");
  await rpc(u.dueno, `select public.restaurar_cambio_configuracion($1, $2)`, [t.g, h.id]);
  assert.equal((await t.q(`select nombre from public.gimnasios where id = $1`, [t.g]))[0].nombre, "Gimnasio de Prueba");

  await t.q(`insert into public.landing_gimnasio (gimnasio_id, titulo, whatsapp) values ($1, 'Prueba', '+5490001111111') on conflict (gimnasio_id) do update set whatsapp = excluded.whatsapp`, [t.g]);
  await t.q(`update public.landing_gimnasio set whatsapp = '+5490002222222' where gimnasio_id = $1`, [t.g]);
  const w = await ultimo("pagina.whatsapp");
  await rpc(u.dueno, `select public.restaurar_cambio_configuracion($1, $2)`, [t.g, w.id]);
  assert.equal((await t.q(`select whatsapp from public.landing_gimnasio where gimnasio_id = $1`, [t.g]))[0].whatsapp, "+5490001111111");
});

test("lo que toca plata o la puerta no se restaura desde el historial", async () => {
  await t.q(`update public.configuracion_gimnasio set alias_transferencia = 'ALIAS.NUEVO.X' where gimnasio_id = $1`, [t.g]);
  const h = await ultimo("alias_transferencia");
  assert.ok(h);
  assert.ok(!(await restaurables(u.dueno)).some((x) => x.id === h.id), "no figura como restaurable");
  await fallaComo(u.dueno, () => t.q(`select public.restaurar_cambio_configuracion($1, $2)`, [t.g, h.id]), /no se restaura desde acá/);
});

test("solo el dueño restaura; encargado y recepción no; otro gimnasio no ve ni toca", async () => {
  await t.q(`update public.configuracion_gimnasio set color_fondo = '#abcdef' where gimnasio_id = $1`, [t.g]);
  const h = await ultimo("color_fondo");
  for (const rol of ["encargado", "recepcion"]) {
    await fallaComo(u[rol], () => t.q(`select public.restaurar_cambio_configuracion($1, $2)`, [t.g, h.id]), /Sin permiso/);
  }
  await fallaComo(otroDueno, () => t.q(`select public.restaurar_cambio_configuracion($1, $2)`, [t.g, h.id]), /Sin permiso/);
  await fallaComo(otroDueno, () => t.q(`select public.cambios_restaurables($1)`, [t.g]), /Sin permiso/);
  await fallaComo(u.recepcion, () => t.q(`select public.cambios_restaurables($1)`, [t.g]), /Sin permiso/);
});

test("un demo tiene la función prendida sin configurarla; solo BRIK principal la cambia", async () => {
  assert.equal((await t.q(`select privado.funcion_nueva($1, 'restaurar_cambios') as f`, [otroG]))[0].f, false);
  await t.q(`update public.gimnasios set es_demo = true where id = $1`, [otroG]);
  assert.equal((await t.q(`select privado.funcion_nueva($1, 'restaurar_cambios') as f`, [otroG]))[0].f, true);
  await fallaComo(u.dueno, () => t.q(`select public.admin_funcion_gimnasio($1, 'restaurar_cambios', true)`, [t.g]), /Sin permiso|administrador|BRIK/i);
});

test("términos: arrancan sin publicar y la página pública no existe", async () => {
  assert.equal((await t.q(`select public.terminos_publicos($1) as r`, [host]))[0].r, null);
  const p = await rpc(u.dueno, `select public.terminos_propios($1) as r`, [t.g]);
  assert.equal(p.r.publicado, false);
  assert.equal(p.r.texto, null);
});

test("términos: solo el dueño guarda; texto muy corto, vacío al publicar y sin publicar no se ve", async () => {
  const texto = "Reglas del gimnasio: se entra con el QR, la cuota se paga por mes adelantado y las bajas se piden en la recepción con aviso.";
  for (const rol of ["encargado", "recepcion"]) {
    await fallaComo(u[rol], () => t.q(`select public.guardar_terminos($1, $2, false)`, [t.g, texto]), /Sin permiso/);
  }
  await fallaComo(otroDueno, () => t.q(`select public.guardar_terminos($1, $2, false)`, [t.g, texto]), /Sin permiso/);
  await fallaComo(u.dueno, () => t.q(`select public.guardar_terminos($1, 'corto', false)`, [t.g]), /muy cortos/);
  await fallaComo(u.dueno, () => t.q(`select public.guardar_terminos($1, null, true)`, [t.g]), /Para publicar/);
  await rpc(u.dueno, `select public.guardar_terminos($1, $2, false)`, [t.g, texto]);
  assert.equal((await t.q(`select public.terminos_publicos($1) as r`, [host]))[0].r, null, "guardado sin publicar no se ve");
  assert.equal((await rpc(u.encargado, `select public.terminos_propios($1) as r`, [t.g])).r.texto, texto, "el encargado lo lee");
});

test("términos: publicados se ven por la dirección del gimnasio y despublicar los oculta", async () => {
  const [{ texto }] = [(await rpc(u.dueno, `select public.terminos_propios($1) as r`, [t.g])).r];
  await rpc(u.dueno, `select public.guardar_terminos($1, $2, true)`, [t.g, texto]);
  const pub = (await t.q(`select public.terminos_publicos($1) as r`, [host]))[0].r;
  assert.equal(pub.texto, texto);
  assert.equal(pub.gimnasio, "Gimnasio de Prueba");
  assert.equal((await t.q(`select public.terminos_publicos('otra-direccion.ejemplo.invalid') as r`))[0].r, null);
  await rpc(u.dueno, `select public.guardar_terminos($1, $2, false)`, [t.g, texto]);
  assert.equal((await t.q(`select public.terminos_publicos($1) as r`, [host]))[0].r, null);
});

test("las tablas nuevas no se escriben desde el cliente ni las lee otro gimnasio", async () => {
  await fallaComo(u.dueno, () => t.q(`insert into public.funciones_gimnasio (gimnasio_id, clave, activa) values ($1, 'restaurar_cambios', true)`, [t.g]));
  const tocadas = await como(u.dueno, async () => (await t.db.query(`update public.terminos_gimnasio set publicado = true where gimnasio_id = $1`, [t.g])).rowCount);
  assert.equal(tocadas, 0, "el cliente no actualiza los términos por tabla");
  const filas = await como(otroDueno, async () => (await t.q(`select count(*)::int n from public.terminos_gimnasio where gimnasio_id = $1`, [t.g]))[0].n);
  assert.equal(filas, 0);
});
