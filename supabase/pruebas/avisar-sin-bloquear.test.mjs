// FA-7 (migración 202611090405): "los primeros N días la entrada avisa pero no frena". Solo el dueño lo cambia; el encargado lo ve;
// la recepción no. Es la fecha que calcular_acceso ya respeta.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir } from "./_comun.mjs";

let t, u = {};
before(async () => {
  t = await abrir("prueba-avisar-sin-bloquear");
  for (const rol of ["dueno", "encargado", "recepcion"]) {
    const [{ id }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`${rol}${Math.random()}@ejemplo.invalid`]);
    await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,$3,$4)`, [t.g, id, rol, rol]);
    u[rol] = id;
  }
});
after(async () => t && t.cerrar());

test("el dueño lo prende por N días y lo apaga; valores fuera de rango se rechazan", async () => {
  await t.comoUsuario(u.dueno, async () => {
    const [{ r: a }] = await t.q(`select public.avisar_sin_bloquear_estado($1) r`, [t.g]);
    assert.equal(a.activo, false);
    const [{ r: b }] = await t.q(`select public.guardar_avisar_sin_bloquear($1, 14) r`, [t.g]);
    assert.equal(b.activo, true);
    const [{ dias }] = await t.q(`select round(extract(epoch from (avisar_sin_bloquear_hasta - now())) / 86400)::int dias from public.configuracion_gimnasio where gimnasio_id = $1`, [t.g]);
    assert.equal(dias, 14);
    await t.falla(() => t.q(`select public.guardar_avisar_sin_bloquear($1, 61)`, [t.g]), /y 60 días/);
    await t.falla(() => t.q(`select public.guardar_avisar_sin_bloquear($1, -1)`, [t.g]), /y 60 días/);
    const [{ r: c }] = await t.q(`select public.guardar_avisar_sin_bloquear($1, 0) r`, [t.g]);
    assert.equal(c.activo, false);
  });
});

test("el encargado lo ve pero no lo cambia; la recepción no ve nada: error, no vacío", async () => {
  await t.comoUsuario(u.encargado, async () => {
    await t.q(`select public.avisar_sin_bloquear_estado($1)`, [t.g]);
    await t.falla(() => t.q(`select public.guardar_avisar_sin_bloquear($1, 7)`, [t.g]), /Sin permiso/);
  });
  await t.comoUsuario(u.recepcion, async () => {
    await t.falla(() => t.q(`select public.avisar_sin_bloquear_estado($1)`, [t.g]), /Sin permiso/);
  });
});
