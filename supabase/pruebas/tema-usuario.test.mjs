// BASE-6 (migración 202611090400): el tema claro/oscuro es de cada persona del equipo; no cambia el de otro ni el del gimnasio.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir } from "./_comun.mjs";

let t, duena, recepcion, ajeno;
before(async () => {
  t = await abrir("prueba-tema-usuario");
  for (const rol of ["dueno", "recepcion"]) {
    const [{ id }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`${rol}${Math.random()}@ejemplo.invalid`]);
    await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,$3,$4)`, [t.g, id, rol, rol]);
    if (rol === "dueno") duena = id; else recepcion = id;
  }
  [{ id: ajeno }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`ajeno${Math.random()}@ejemplo.invalid`]);
});
after(async () => t && t.cerrar());

test("cada uno elige el suyo; sin elegir es null (el del gimnasio); valores raros se rechazan", async () => {
  await t.comoUsuario(recepcion, async () => {
    assert.equal((await t.q(`select public.mi_tema($1) m`, [t.g]))[0].m, null);
    await t.q(`select public.guardar_tema_usuario($1, 'oscuro')`, [t.g]);
    assert.equal((await t.q(`select public.mi_tema($1) m`, [t.g]))[0].m, "oscuro");
    await t.falla(() => t.q(`select public.guardar_tema_usuario($1, 'fucsia')`, [t.g]), /claro u oscuro/);
    await t.q(`select public.guardar_tema_usuario($1, null)`, [t.g]);
    assert.equal((await t.q(`select public.mi_tema($1) m`, [t.g]))[0].m, null, "null vuelve al del gimnasio");
  });
  // El de uno no cambia el de otro.
  await t.q(`update public.equipo set preferencias = preferencias || '{"tema":"claro"}' where usuario_id = $1`, [duena]);
  await t.comoUsuario(recepcion, async () => assert.equal((await t.q(`select public.mi_tema($1) m`, [t.g]))[0].m, null));
  await t.comoUsuario(duena, async () => assert.equal((await t.q(`select public.mi_tema($1) m`, [t.g]))[0].m, "claro"));
});

test("quien no es del equipo no puede ni leerlo ni guardarlo: error, no vacío", async () => {
  await t.comoUsuario(ajeno, async () => {
    await t.falla(() => t.q(`select public.guardar_tema_usuario($1, 'oscuro')`, [t.g]), /Sin permiso/);
    await t.falla(() => t.q(`select public.mi_tema($1)`, [t.g]), /Sin permiso/);
  });
});
