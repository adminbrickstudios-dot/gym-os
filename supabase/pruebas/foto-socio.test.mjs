// Foto del socio (0039): la ruta la arma la base y no acepta otra; la ve el
// equipo (también el profe); sin ser del gimnasio, error.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir } from "./_comun.mjs";

let t, u = {};
async function persona(rol) {
  const [{ id }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`${rol}${Math.random()}@ejemplo.invalid`]);
  await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,$3,$4)`, [t.g, id, rol, rol]);
  return id;
}
before(async () => { t = await abrir("prueba-foto"); u.recepcion = await persona("recepcion"); u.profe = await persona("profe");
  [{ id: u.ajeno }] = await t.q(`insert into auth.users (email) values ('ajeno-foto@ejemplo.invalid') returning id`); });
after(async () => t && t.cerrar());

test("ruta armada por la base; otra ruta no; el profe la ve; un ajeno no", async () => {
  const s = t.ctx.socios.al_dia;
  await t.comoUsuario(u.recepcion, async () => {
    const ruta = (await t.q(`select public.preparar_foto_socio($1) as r`, [s]))[0].r;
    assert.match(ruta, new RegExp(`^${t.g}/${s}/foto-[0-9a-f]{32}\\.jpg$`));
    await t.falla(() => t.q(`select public.confirmar_foto_socio($1, $2)`, [s, `otro/${s}/foto-${"a".repeat(32)}.jpg`]), /Ruta de foto inválida/);
    assert.equal((await t.q(`select public.confirmar_foto_socio($1, $2) as a`, [s, ruta]))[0].a, null);
  });
  await t.q(`update public.socios set foto_path = $2 where id = $1`, [s, `${t.g}/${s}/foto-${"b".repeat(32)}.jpg`]);
  await t.comoUsuario(u.profe, async () => assert.ok((await t.q(`select public.foto_socio($1) as r`, [s]))[0].r));
  await t.comoUsuario(u.ajeno, async () => t.falla(() => t.q(`select public.foto_socio($1)`, [s]), /Sin permiso/));
});
