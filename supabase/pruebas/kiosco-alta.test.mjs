// Paneles completos · kiosco_alta: la tablet recibe el slug del gimnasio solo si las altas online están prendidas; un token malo da error (nunca null).
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir } from "./_comun.mjs";

let t, token;
before(async () => {
  t = await abrir("prueba-kiosco-alta");
  await t.q(`update public.configuracion_gimnasio set accesos_activos = array_append(accesos_activos, 'kiosco') where gimnasio_id = $1 and not ('kiosco' = any (accesos_activos))`, [t.g]);
  // Una tablet autorizada (el token se guarda hasheado; comoUsuario revierte lo que hace, así que se inserta directo como lo hace autorizar_tablet).
  token = "token-de-prueba-" + Math.random().toString(36).slice(2);
  const [{ id: did }] = await t.q(`insert into public.dispositivos (gimnasio_id, sede_id, nombre, tipo) values ($1,$2,'Tablet de prueba','kiosco') returning id`, [t.g, t.sede]);
  await t.q(`insert into public.dispositivos_tokens (gimnasio_id, dispositivo_id, token_hash) values ($1,$2, encode(extensions.digest($3, 'sha256'), 'hex'))`, [t.g, did, token]);
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
