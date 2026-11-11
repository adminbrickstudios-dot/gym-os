// FA-23 (migración 202611090412): leer y guardar el plazo para aceptar el lugar de la lista de espera. Solo el dueño lo cambia; dueño y encargado lo leen.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir } from "./_comun.mjs";

let t, u = {};
before(async () => {
  t = await abrir("prueba-espera-plazo");
  for (const rol of ["dueno", "encargado", "recepcion"]) {
    const [{ id }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`${rol}${Math.random()}@ejemplo.invalid`]);
    await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,$3,$4)`, [t.g, id, rol, rol]);
    u[rol] = id;
  }
});
after(async () => t && t.cerrar());

test("sin plazo por defecto; el dueño lo pone y lo saca; fuera de rango se rechaza", async () => {
  await t.comoUsuario(u.dueno, async () => {
    assert.equal((await t.q(`select public.espera_plazo_gimnasio($1) r`, [t.g]))[0].r.minutos, null);
    await t.q(`select public.guardar_espera_plazo($1, 60)`, [t.g]);
    assert.equal((await t.q(`select public.espera_plazo_gimnasio($1) r`, [t.g]))[0].r.minutos, 60);
    await t.falla(() => t.q(`select public.guardar_espera_plazo($1, 2)`, [t.g]), /5 minutos a 24 horas/);
    await t.q(`select public.guardar_espera_plazo($1, null)`, [t.g]);
    assert.equal((await t.q(`select public.espera_plazo_gimnasio($1) r`, [t.g]))[0].r.minutos, null);
  });
});

test("el encargado lo lee pero no lo cambia; la recepción no ve nada: error, no vacío", async () => {
  await t.comoUsuario(u.encargado, async () => {
    await t.q(`select public.espera_plazo_gimnasio($1)`, [t.g]);
    await t.falla(() => t.q(`select public.guardar_espera_plazo($1, 30)`, [t.g]), /Sin permiso/);
  });
  await t.comoUsuario(u.recepcion, () => t.falla(() => t.q(`select public.espera_plazo_gimnasio($1)`, [t.g]), /Sin permiso/));
});
