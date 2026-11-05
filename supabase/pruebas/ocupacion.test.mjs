// Ocupación (0083): por horario, los que vinieron contra el cupo en las
// clases que ya pasaron; las canceladas no cuentan; solo dueño y encargado.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir } from "./_comun.mjs";

let t, u = {}, horario;
async function persona(rol) {
  const [{ id }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`${rol}${Math.random()}@ejemplo.invalid`]);
  await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,$3,$4)`, [t.g, id, `P ${rol}`, rol]);
  return id;
}
async function como(usuario, fn) {
  await t.db.query("set role authenticated");
  await t.q(`select set_config('request.jwt.claims', $1, false)`, [JSON.stringify({ sub: usuario, role: "authenticated" })]);
  try { return await fn(); } finally { await t.db.query("reset role"); await t.q(`select set_config('request.jwt.claims', '', false)`); }
}
before(async () => {
  t = await abrir("prueba-ocupacion");
  u.dueno = await persona("dueno"); u.recepcion = await persona("recepcion");
  const [{ id: act }] = await t.q(`insert into public.actividades (gimnasio_id, nombre) values ($1, 'Crossfit') returning id`, [t.g]);
  [{ id: horario }] = await t.q(`insert into public.horarios_clase (gimnasio_id, sede_id, actividad_id, dia_semana, hora_inicio, duracion_min, cupo, vigente_desde)
    values ($1,$2,$3, 1, '18:00', 60, 10, '2026-01-01') returning id`, [t.g, t.sede, act]);
  const socios = (await t.q(`select id from public.socios where gimnasio_id = $1 limit 6`, [t.g])).map((r) => r.id);
  // Dos clases pasadas: vinieron 6 y 4 (promedio 5 de 10 = 50 %); una cancelada no cuenta.
  for (const [hace, n, cancelada] of [["7 days", 6, false], ["14 days", 4, false], ["21 days", 9, true]]) {
    const [{ id: c }] = await t.q(`insert into public.clases (gimnasio_id, sede_id, horario_id, actividad_id, inicio, fin, cupo, cancelada_en, cancelada_motivo)
      values ($1,$2,$3,$4, now() - $5::interval, now() - $5::interval + interval '1 hour', 10, case when $6 then now() end, case when $6 then 'x' end) returning id`, [t.g, t.sede, horario, act, hace, cancelada]);
    for (const s of socios.slice(0, Math.min(n, socios.length))) await t.q(`insert into public.asistencias (gimnasio_id, clase_id, socio_id) values ($1,$2,$3)`, [t.g, c, s]);
  }
});
after(async () => t && t.cerrar());

test("50 % de ocupación con dos clases (la cancelada no cuenta); la recepción no lo ve", async () => {
  const [{ o }] = await como(u.dueno, () => t.q(`select public.ocupacion_horarios($1, 4) as o`, [t.g]));
  const h = o.find((x) => x.horario_id === horario);
  assert.equal(h.clases, 2);
  assert.equal(Number(h.vinieron), 5);
  assert.equal(Number(h.porcentaje), 50);
  await como(u.recepcion, () => t.falla(() => t.q(`select public.ocupacion_horarios($1)`, [t.g]), /permiso/i));
});
