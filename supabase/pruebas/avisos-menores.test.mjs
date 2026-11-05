// Avisos de un menor (0047): Retención, Vencen hoy y Cumplen hoy le
// escriben al celular del responsable; a un adulto, al suyo.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir, HOY } from "./_comun.mjs";

let t, momento;
before(async () => { t = await abrir("prueba-avisos-menores"); momento = await t.en(HOY); });
after(async () => t && t.cerrar());

test("retención y cumpleaños: al menor se le escribe al responsable", async () => {
  // El vencido de los casos testigo pasa a ser menor con responsable.
  const s = t.ctx.socios.vencida;
  const nac = `${Number(HOY.slice(0, 4)) - 12}${HOY.slice(4)}`;    // cumple 12 hoy
  await t.q(`update public.socios set telefono = '+5490001110001', fecha_nacimiento = $2, responsable_nombre = 'Mamá', responsable_telefono = '+5490001110002' where id = $1`, [s, nac]);
  const filas = await t.q(`select socio_id, telefono from privado.retencion($1, $2)`, [t.g, momento]);
  const f = filas.find((x) => x.socio_id === s);
  assert.ok(f, "el vencido está en Retención");
  assert.equal(f.telefono, "+5490001110002");
  const [{ id: u }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`rece${Math.random()}@ejemplo.invalid`]);
  await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,'Rece','recepcion')`, [t.g, u]);
  const [{ c }] = await t.comoUsuario(u, () => t.q(`select public.cumplen_hoy($1, $2) as c`, [t.g, momento]));
  assert.equal(c.find((x) => x.socio_id === s)?.telefono, "+5490001110002");
  // Un adulto, al suyo.
  await t.q(`update public.socios set fecha_nacimiento = '1990-01-01' where id = $1`, [s]);
  const [g] = (await t.q(`select telefono from privado.retencion($1, $2) where socio_id = $3`, [t.g, momento, s]));
  assert.equal(g.telefono, "+5490001110001");
});
