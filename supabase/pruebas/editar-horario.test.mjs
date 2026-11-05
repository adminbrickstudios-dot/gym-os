// Editar un horario (0086): cupo y profe pasan a las clases futuras; si
// cambia la hora, la clase con reservas conserva su hora y el resto se mueve
// (sin dos clases el mismo día); el cupo no baja de lo reservado.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir } from "./_comun.mjs";

let t, u = {}, h0, act, manana, socio, profe;
async function como(usuario, fn) {
  await t.db.query("set role authenticated");
  await t.q(`select set_config('request.jwt.claims', $1, false)`, [JSON.stringify({ sub: usuario, role: "authenticated" })]);
  try { return await fn(); } finally { await t.db.query("reset role"); await t.q(`select set_config('request.jwt.claims', '', false)`); }
}
const clasesDe = (dia) => t.q(`select c.id, c.horario_id, to_char(c.inicio at time zone $3, 'HH24:MI') hora, c.cupo, c.profe_id, c.cancelada_en
  from public.clases c where c.actividad_id = $1 and privado.dia_local(c.inicio, $3) = $2::date order by c.inicio`, [act, dia, t.ctx.zona]);
before(async () => {
  t = await abrir("prueba-editar-horario");
  const [{ id }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`dueno${Math.random()}@ejemplo.invalid`]);
  await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,'Sofía','dueno')`, [t.g, id]);
  u.dueno = id;
  [{ id: profe }] = await t.q(`insert into public.equipo (gimnasio_id, nombre, rol) values ($1,'Diego','profe') returning id`, [t.g]);
  [{ id: act }] = await t.q(`insert into public.actividades (gimnasio_id, nombre) values ($1, 'Funcional') returning id`, [t.g]);
  [{ d: manana }] = await t.q(`select (privado.dia_local(now(), $1) + 1)::text d`, [t.ctx.zona]);
  [{ id: h0 }] = await t.q(`insert into public.horarios_clase (gimnasio_id, sede_id, actividad_id, dia_semana, hora_inicio, duracion_min, cupo, vigente_desde)
    values ($1,$2,$3, extract(isodow from $4::date)::int, '10:00', 60, 5, $4::date - 14) returning id`, [t.g, t.sede, act, manana]);
  await t.q(`select privado.materializar_dia($1, $2::date), privado.materializar_dia($1, $2::date + 7)`, [t.sede, manana]);
  [{ id: socio }] = await t.q(`select id from public.socios where gimnasio_id = $1 and nombre = 'Testigo' and apellido = 'Al Día'`, [t.g]);
  const [c] = await clasesDe(manana);
  await t.q(`insert into public.reservas (gimnasio_id, clase_id, socio_id, estado) values ($1,$2,$3,'confirmada')`, [t.g, c.id, socio]);
});
after(async () => t && t.cerrar());

test("cupo y profe: pasan a las clases futuras sin cancelar nada", async () => {
  const [{ h }] = await como(u.dueno, () => t.q(`select public.editar_horario($1, '10:00', 60, 8, $2) as h`, [h0, profe]));
  assert.notEqual(h, h0);
  for (const dia of [manana]) {
    const cs = await clasesDe(dia);
    assert.equal(cs.length, 1); assert.equal(cs[0].horario_id, h); assert.equal(cs[0].cupo, 8); assert.equal(cs[0].profe_id, profe); assert.equal(cs[0].cancelada_en, null);
  }
  u.h1 = h;
});

test("cambiar la hora: la clase con reservas conserva la suya; las otras se mueven; no hay dos el mismo día", async () => {
  const [{ h }] = await como(u.dueno, () => t.q(`select public.editar_horario($1, '11:00', 60, 8, $2) as h`, [u.h1, profe]));
  const m = await clasesDe(manana);
  assert.deepEqual(m.map((c) => c.hora), ["10:00"], "mañana: la reservada queda a las 10");
  const [{ d: semana }] = await t.q(`select ($1::date + 7)::text d`, [manana]);
  const s = await clasesDe(semana);
  assert.deepEqual(s.map((c) => [c.hora, c.horario_id === h]), [["11:00", true]]);
  // Volver a mirar los días no duplica.
  await t.q(`select privado.materializar_dia($1, $2::date), privado.materializar_dia($1, $2::date + 7)`, [t.sede, manana]);
  assert.equal((await clasesDe(manana)).filter((c) => !c.cancelada_en).length, 1);
  assert.equal((await clasesDe(semana)).filter((c) => !c.cancelada_en).length, 1);
  u.h2 = h;
});

test("el cupo no baja de lo reservado", async () => {
  const [c] = await clasesDe(manana);
  const [{ id: otro }] = await t.q(`select id from public.socios where gimnasio_id = $1 and nombre = 'Testigo' and apellido = 'Por Vencer'`, [t.g]);
  await t.q(`insert into public.reservas (gimnasio_id, clase_id, socio_id, estado) values ($1,$2,$3,'confirmada')`, [t.g, c.id, otro]);
  await como(u.dueno, () => t.falla(() => t.q(`select public.editar_horario($1, '10:00', 60, 1, null)`, [c.horario_id]), /ya tiene 2 reservas: el cupo no puede bajar de 2/));
});

test("0087: un horario sacado (aunque se haya creado hoy) ya no aparece en la grilla", async () => {
  const [{ id: hoyH }] = await t.q(`insert into public.horarios_clase (gimnasio_id, sede_id, actividad_id, dia_semana, hora_inicio, duracion_min, vigente_desde)
    values ($1,$2,$3, 7, '23:15', 60, privado.dia_local(now(), $4)) returning id`, [t.g, t.sede, act, t.ctx.zona]);
  const ids = async () => (await como(u.dueno, () => t.q(`select horario_id from public.horarios_gimnasio($1)`, [t.g]))).map((r) => r.horario_id);
  assert.ok((await ids()).includes(hoyH));
  await como(u.dueno, () => t.q(`select public.cerrar_horario($1)`, [hoyH]));
  assert.ok(!(await ids()).includes(hoyH));
});
