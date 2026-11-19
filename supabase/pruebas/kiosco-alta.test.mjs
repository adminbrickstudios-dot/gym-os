// Paneles completos · kiosco_alta: la tablet recibe el slug del gimnasio solo si las altas online están prendidas; un token malo da error (nunca null).
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir } from "./_comun.mjs";

let t, token;
before(async () => {
  t = await abrir("prueba-kiosco-alta");
  // Una tablet autorizada: el token se guarda hasheado, así que se usa la función que la autoriza (la misma del panel).
  const [{ id: u }] = await t.q(`insert into auth.users (email) values ('duenok@ejemplo.invalid') returning id`);
  await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,'Dueno','dueno')`, [t.g, u]);
  await t.comoUsuario(u, async () => {
    const r = await t.q(`select public.autorizar_tablet($1, $2, 'Tablet de prueba') r`, [t.g, t.sede]);
    token = typeof r[0].r === "string" ? r[0].r : (r[0].r.token ?? r[0].r.link?.split("token=")[1]);
  });
});
after(async () => t && t.cerrar());

test("con las altas apagadas (lo normal) la tablet no recibe nada", async () => {
  await t.q(`update public.configuracion_gimnasio set altas_online = false where gimnasio_id = $1`, [t.g]);
  assert.equal((await t.q(`select public.kiosco_alta($1) r`, [token]))[0].r, null);
});
test("con las altas prendidas recibe el slug de su gimnasio, y solo el suyo", async () => {
  await t.q(`update public.configuracion_gimnasio set altas_online = true where gimnasio_id = $1`, [t.g]);
  assert.equal((await t.q(`select public.kiosco_alta($1) r`, [token]))[0].r, "prueba-kiosco-alta");
});
test("un token que no es de ninguna tablet da error, no null", async () => {
  await t.falla(() => t.q(`select public.kiosco_alta('token-inventado')`));
});
