// E8 · panel_vivo junta en una llamada lo que el panel pedía al abrir cada pantalla en tres: tiene que dar EXACTAMENTE lo mismo que las piezas
// por separado, con los mismos permisos (sin permiso es un error, nunca algo vacío).
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir } from "./_comun.mjs";

let t, u = {};
before(async () => {
  t = await abrir("prueba-panel-vivo");
  for (const rol of ["dueno", "encargado", "recepcion", "profe"]) {
    const [{ id }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`${rol}${Math.random()}@ejemplo.invalid`]);
    await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,$3,$4)`, [t.g, id, rol, rol]);
    u[rol] = id;
  }
});
after(async () => t && t.cerrar());

const solo = async (f) => { try { return (await t.q(`select to_jsonb(public.${f}('${t.g}'::uuid)) r`))[0].r; } catch { return null; } };
const norm = (x) => JSON.parse(JSON.stringify(x));

for (const rol of ["dueno", "encargado", "recepcion"]) {
  test(`${rol}: panel_vivo es igual a las piezas por separado`, async () => {
    await t.comoUsuario(u[rol], async () => {
      const [{ r }] = await t.q(`select public.panel_vivo('${t.g}'::uuid) r`);
      assert.deepEqual(norm(r.pendientes), norm(await solo("pendientes_panel")));
      assert.deepEqual(norm(r.campana), norm(await solo("campana_panel")));
      assert.deepEqual(norm(r.mp), norm(await solo("avisos_pagos_mp")));
    });
  });
}

test("sin permiso es un error, nunca algo vacío; anon no puede ejecutarla", async () => {
  const [{ id }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`nadie${Math.random()}@ejemplo.invalid`]);
  await t.comoUsuario(id, async () => {
    await t.falla(() => t.q(`select public.panel_vivo('${t.g}'::uuid)`), /./);
  });
  const [{ p }] = await t.q(`select has_function_privilege('anon', 'public.panel_vivo(uuid)', 'execute') p`);
  assert.equal(p, false);
});
