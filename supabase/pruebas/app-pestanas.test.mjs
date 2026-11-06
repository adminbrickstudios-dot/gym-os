// VD-36 (3600): las pestañas de la app del socio salen de la configuración del gimnasio.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir } from "./_comun.mjs";

let t, uSocio, uAjeno;
before(async () => {
  t = await abrir("prueba-pestanas");
  [{ id: uSocio }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`socio${Math.random()}@ejemplo.invalid`]);
  [{ id: uAjeno }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`ajeno${Math.random()}@ejemplo.invalid`]);
  await t.q(`update public.socios set usuario_id = $1 where id = (select id from public.socios where gimnasio_id = $2 order by numero limit 1)`, [uSocio, t.g]);
});
after(async () => t && t.cerrar());

const pedir = (usuario) => t.comoUsuario(usuario, async () => (await t.q(`select public.pestanas_app($1) as r`, [t.g]))[0].r);

test("con clases y rutinas prendidas, las dos pestañas están", async () => {
  await t.q(`update public.configuracion_gimnasio set modo_clases = 'reserva', secciones_apagadas = '{}' where gimnasio_id = $1`, [t.g]);
  assert.deepEqual(await pedir(uSocio), { clases: true, rutina: true });
});

test("sin clases (modo ninguno) no hay pestaña Clases", async () => {
  await t.q(`update public.configuracion_gimnasio set modo_clases = 'ninguno' where gimnasio_id = $1`, [t.g]);
  assert.equal((await pedir(uSocio)).clases, false);
});

test("la sección apagada saca su pestaña", async () => {
  await t.q(`update public.configuracion_gimnasio set modo_clases = 'sin_reserva', secciones_apagadas = '{clases,rutinas}' where gimnasio_id = $1`, [t.g]);
  assert.deepEqual(await pedir(uSocio), { clases: false, rutina: false });
});

test("quien no es socio del gimnasio no puede pedirlas: error, no una lista vacía", async () => {
  await assert.rejects(() => pedir(uAjeno), /Sin permiso/);
});
