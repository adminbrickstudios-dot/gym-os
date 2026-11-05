// CFG-7 (migración 0027): con la sección Transferencias apagada nadie puede
// aprobar comprobantes, así que la app no los pide y la base no los acepta.
// Cobrar por transferencia en el mostrador sigue andando.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir } from "./_comun.mjs";

let t, uSocio;
before(async () => {
  t = await abrir("prueba-cfg7");
  [{ id: uSocio }] = await t.q(`insert into auth.users (phone) values ('+5490000777888') returning id`);
  await t.q(`update public.socios set usuario_id = $2 where id = $1`, [t.ctx.socios.vencida, uSocio]);
  await t.q(`update public.configuracion_gimnasio set alias_transferencia = 'gym.prueba' where gimnasio_id = $1`, [t.g]);
});
after(async () => t && t.cerrar());

const app = async () => t.comoUsuario(uSocio, async () => (await t.q(`select public.mi_socio($1, $2) as m`, [t.g, t.ctx.socios.vencida]))[0].m);

test("Transferencias apagada: la app no ofrece transferir y la base no acepta el comprobante", async () => {
  assert.equal((await app()).transferencia.alias, "gym.prueba", "prendida: la app ofrece transferir");
  await t.q(`update public.configuracion_gimnasio set secciones_apagadas = '{transferencias}' where gimnasio_id = $1`, [t.g]);
  assert.equal((await app()).transferencia, null);
  const s = t.ctx.socios.vencida;
  await t.comoUsuario(uSocio, () => t.falla(() => t.q(`select public.informar_transferencia($1, $2)`, [s, `${t.g}/${s}/c.jpg`]), /no recibe pagos por transferencia/));
});

test("con la sección apagada, el mostrador sigue cobrando por transferencia", async () => {
  await t.q(`update public.configuracion_gimnasio set secciones_apagadas = '{transferencias}' where gimnasio_id = $1`, [t.g]);
  const [{ id: u }] = await t.q(`insert into auth.users (email) values ('rec-cfg7@ejemplo.invalid') returning id`);
  await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,'Rec','recepcion')`, [t.g, u]);
  await t.comoUsuario(u, async () => {
    const [{ r }] = await t.q(`select public.vender($1, $2, $3, $4) as r`,
      [t.sede, JSON.stringify([{ tipo: "cuota" }]), JSON.stringify([{ medio: "transferencia", monto: 25000 }]), t.ctx.socios.sin_pago]);
    assert.equal(Number(r.total), 25000);
  });
});
