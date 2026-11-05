// Control de la puerta (0054): dejados pasar y anuladas del rango, con la cuenta
// por persona; la recepción no lo ve.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir } from "./_comun.mjs";

let t, u = {};
before(async () => {
  t = await abrir("prueba-control");
  for (const r of ["dueno", "recepcion"]) {
    const [{ id }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`${r}${Math.random()}@ejemplo.invalid`]);
    await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,$3,$4)`, [t.g, id, r === "recepcion" ? "Ana" : "Dueña", r]);
    u[r] = id;
  }
});
after(async () => t && t.cerrar());
async function como(sub, fn) {
  await t.q(`set local role authenticated`);
  await t.q(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub, role: "authenticated" })]);
  try { return await fn(); } finally { await t.q(`reset role`).catch(() => {}); }
}

test("cuenta a quién dejó pasar cada uno y qué se anuló", async () => {
  const [{ id: s }] = await t.q(`insert into public.socios (gimnasio_id, nombre, apellido) values ($1,'Sin','Plan') returning id`, [t.g]);
  const [{ r }] = await como(u.recepcion, () => t.q(`select public.registrar_ingreso($1, $2, 'recepcion', 'Paga mañana') as r`, [s, t.sede]));
  await como(u.dueno, () => t.q(`select public.anular_ingreso($1, 'Se anotó de más')`, [r.ingreso_id]));
  const hoy = (await t.q(`select privado.dia_local(now(), $1)::text as d`, [t.ctx.zona]))[0].d;
  await t.comoUsuario(u.dueno, async () => {
    const [{ c }] = await t.q(`select public.control_entrada($1, $2::date - 6, 7) as c`, [t.g, hoy]);
    const f = c.forzados.find((x) => x.ingreso_id === r.ingreso_id);
    assert.equal(f.por, "Ana"); assert.equal(f.motivo, "Paga mañana"); assert.equal(f.anulado, true);
    const a = c.anuladas.find((x) => x.ingreso_id === r.ingreso_id);
    assert.equal(a.por, "Dueña"); assert.equal(a.motivo, "Se anotó de más");
    assert.equal(c.por_persona.find((x) => x.nombre === "Ana").forzados, 1);
    assert.equal(c.por_persona.find((x) => x.nombre === "Dueña").anuladas, 1);
    await t.falla(() => t.q(`select public.control_entrada($1, $2::date, 40)`, [t.g, hoy]), /de 1 a 31/);
  });
  await t.comoUsuario(u.recepcion, () => t.falla(() => t.q(`select public.control_entrada($1, now()::date, 7)`, [t.g]), /Sin permiso/));
});
