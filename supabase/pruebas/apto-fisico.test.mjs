// Apto físico (0044, D9): solo si lo presentó y hasta cuándo; apagado por
// defecto y, apagado, no se carga; la recepción lo carga y lo quita; el
// profe no lo ve; no frena la entrada.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir } from "./_comun.mjs";

let t, u = {};
async function persona(rol) {
  const [{ id }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`${rol}${Math.random()}@ejemplo.invalid`]);
  await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,$3,$4)`, [t.g, id, rol, rol]);
  return id;
}
before(async () => { t = await abrir("prueba-apto"); for (const r of ["dueno", "recepcion", "profe"]) u[r] = await persona(r); });
after(async () => t && t.cerrar());

test("apagado no aparece; prendido se carga, vence y se quita", async () => {
  const s = t.ctx.socios.al_dia;
  const proximo = `${new Date().getFullYear() + 1}-06-30`;
  await t.comoUsuario(u.recepcion, async () => {
    assert.deepEqual((await t.q(`select public.apto_socio($1) as a`, [s]))[0].a, { pide: false });
    await t.falla(() => t.q(`select public.cargar_apto($1, $2)`, [s, proximo]), /no pide apto/);
  });
  await t.q(`update public.configuracion_gimnasio set pide_apto = true where gimnasio_id = $1`, [t.g]);
  await t.comoUsuario(u.recepcion, async () => {
    assert.equal((await t.q(`select public.apto_socio($1) as a`, [s]))[0].a.apto, null);
    await t.falla(() => t.q(`select public.cargar_apto($1, '2020-01-01')`, [s]), /ya venció/);
    const [{ id }] = await t.q(`select public.cargar_apto($1, $2) as id`, [s, proximo]);
    const a = (await t.q(`select public.apto_socio($1) as a`, [s]))[0].a.apto;
    assert.equal(a.vence, proximo, "vale todo el día que vence");
    assert.equal(a.vigente, true);
    await t.q(`select public.anular_apto($1)`, [id]);
    assert.equal((await t.q(`select public.apto_socio($1) as a`, [s]))[0].a.apto, null);
  });
  await t.comoUsuario(u.profe, async () => t.falla(() => t.q(`select public.apto_socio($1)`, [s]), /Sin permiso/));
  // El dueño lo prende y lo apaga desde Reglas.
  await t.comoUsuario(u.dueno, async () => {
    await t.q(`select public.guardar_configuracion($1, '{"pide_apto": false}')`, [t.g]);
    assert.equal((await t.q(`select public.configuracion_panel($1) as c`, [t.g]))[0].c.pide_apto, false);
    await t.falla(() => t.q(`select public.guardar_configuracion($1, '{"pide_apto": "si"}')`, [t.g]), /elegí sí o no/);
  });
});
