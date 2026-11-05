// Volver a dar de alta (migración 0033): borra la baja del socio, guarda el
// hecho, no le da días gratis; profe no puede; dos veces da error claro.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir } from "./_comun.mjs";

let t, u = {};
async function persona(rol) {
  const [{ id }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`${rol}${Math.random()}@ejemplo.invalid`]);
  await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,$3,$4)`, [t.g, id, rol, rol]);
  return id;
}
before(async () => { t = await abrir("prueba-volver"); u.recepcion = await persona("recepcion"); u.profe = await persona("profe"); });
after(async () => t && t.cerrar());

test("se fue y vuelve: la baja queda en el historial y vuelve sin días gratis", async () => {
  const socio = t.ctx.socios.al_dia;
  await t.comoUsuario(u.recepcion, async () => {
    const color = async () => (await t.q(`select (public.estado_acceso($1)).color`, [socio]))[0].color;
    const antes = await color();
    await t.q(`select public.dar_de_baja($1, 'precio')`, [socio]);
    assert.ok(["rojo", "gris"].includes(await color()), "dado de baja no entra");
    await t.q(`select public.volver_a_dar_de_alta($1)`, [socio]);
    const [s] = await t.q(`select dado_de_baja_en, motivo_baja from public.socios where id = $1`, [socio]);
    assert.deepEqual(s, { dado_de_baja_en: null, motivo_baja: null });
    const [h] = await t.q(`select motivo, volvio_por from public.historial_bajas where socio_id = $1`, [socio]);
    assert.equal(h.motivo, "precio");
    assert.equal(h.volvio_por, u.recepcion);
    const [{ n }] = await t.q(`select count(*)::int n from public.suscripciones where socio_id = $1 and baja_en is null`, [socio]);
    assert.equal(n, 0, "la suscripción vieja sigue terminada: hay que asignarle plan y cobrar");
    assert.notEqual(await color(), "verde", `vuelve sin plan (antes estaba ${antes}): se le asigna uno y se cobra`);
    await t.falla(() => t.q(`select public.volver_a_dar_de_alta($1)`, [socio]), /no está dado de baja/);
  });
  await t.comoUsuario(u.profe, async () => t.falla(() => t.q(`select public.volver_a_dar_de_alta($1)`, [t.ctx.socios.al_dia]), /Sin permiso|permiso/));
});
