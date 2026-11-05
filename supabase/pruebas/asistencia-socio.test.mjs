// Asistencia en la ficha (0035): días del mes en hora del gimnasio, sin contar
// los rechazos, y la racha de semanas; el profe no la ve.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir } from "./_comun.mjs";

let t, u = {};
async function persona(rol) {
  const [{ id }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`${rol}${Math.random()}@ejemplo.invalid`]);
  await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,$3,$4)`, [t.g, id, rol, rol]);
  return id;
}
before(async () => { t = await abrir("prueba-asistencia"); u.recepcion = await persona("recepcion"); u.profe = await persona("profe"); });
after(async () => t && t.cerrar());

test("días del mes en hora local, sin rechazos; racha de semanas seguidas", async () => {
  const s = t.ctx.socios.al_dia;
  const ins = (m, res = "entro") => t.q(`insert into public.ingresos (gimnasio_id, sede_id, socio_id, momento, via_acceso, resultado, color, motivo, texto)
      values ($1, $2, $3, $4, 'recepcion', $5, 'verde', 'al_dia', 'Al día')`, [t.g, t.sede, s, m, res]);
  // 23:30 hora de Argentina del 2 de enero = 02:30 UTC del 3: cuenta como el 2.
  await ins("2026-01-03T02:30:00Z"); await ins("2026-01-05T12:00:00Z"); await ins("2026-01-05T20:00:00Z");
  await ins("2026-01-07T12:00:00Z", "rechazado");
  await t.comoUsuario(u.recepcion, async () => {
    const a = (await t.q(`select public.asistencia_socio($1, '2026-01-15') as a`, [s]))[0].a;
    assert.deepEqual(a.dias, ["2026-01-02", "2026-01-05"]);
    assert.equal(a.veces, 2);
    assert.equal(a.mes, "2026-01");
    assert.equal(typeof a.racha_semanas, "number");
  });
  await t.comoUsuario(u.profe, async () => t.falla(() => t.q(`select public.asistencia_socio($1)`, [s]), /Sin permiso/));
});
