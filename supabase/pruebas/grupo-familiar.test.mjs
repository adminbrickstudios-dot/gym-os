// Grupo familiar (0041): vincular arma la familia, sumar a un tercero la
// agranda, sacar al penúltimo la deshace; el profe no.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir } from "./_comun.mjs";

let t, u = {};
async function persona(rol) {
  const [{ id }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`${rol}${Math.random()}@ejemplo.invalid`]);
  await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,$3,$4)`, [t.g, id, rol, rol]);
  return id;
}
before(async () => { t = await abrir("prueba-familia"); u.recepcion = await persona("recepcion"); u.profe = await persona("profe"); });
after(async () => t && t.cerrar());

test("vincular, sumar y deshacer; profe no", async () => {
  const [a, b, c] = [t.ctx.socios.al_dia, t.ctx.socios.vencida, t.ctx.socios.por_vencer ?? Object.values(t.ctx.socios)[2]];
  await t.comoUsuario(u.recepcion, async () => {
    await t.q(`select public.vincular_familia($1, $2)`, [a, b]);
    await t.q(`select public.vincular_familia($1, $2)`, [c, b]);
    const f = (await t.q(`select public.familia_socio($1) as f`, [a]))[0].f;
    assert.deepEqual(new Set(f.map((x) => x.socio_id)), new Set([b, c]));
    assert.ok(f.every((x) => x.color && x.texto), "cada familiar con su estado");
    await t.q(`select public.sacar_de_familia($1)`, [c]);
    await t.q(`select public.sacar_de_familia($1)`, [b]);
    assert.equal((await t.q(`select public.familia_socio($1) as f`, [a]))[0].f.length, 0, "sola, ya no es familia");
    await t.falla(() => t.q(`select public.vincular_familia($1, $1)`, [a]), /otra persona/);
  });
  await t.comoUsuario(u.profe, async () => t.falla(() => t.q(`select public.familia_socio($1)`, [a]), /Sin permiso/));
});
