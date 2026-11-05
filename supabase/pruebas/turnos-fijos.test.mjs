// Turnos fijos (0081): apagados no se puede; prendidos, abonarse reserva las
// clases de la ventana; si el socio cancela una semana no se vuelve a
// reservar; al que no puede tomar la clase no se le reserva; los lugares fijos
// tienen tope (el cupo); quitar el turno cancela las próximas.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir } from "./_comun.mjs";

let t, u = {}, alDia, vencida, otro, horario;
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
const socio = async (apellido) => (await t.q(`select id from public.socios where gimnasio_id = $1 and nombre = 'Testigo' and apellido = $2`, [t.g, apellido]))[0].id;
const reservasDe = async (s) => t.q(`select r.estado, r.cancelada_por, r.turno_fijo_id is not null as fijo from public.reservas r join public.clases c on c.id = r.clase_id
                                     where r.socio_id = $1 and c.horario_id = $2 order by c.inicio`, [s, horario]);
before(async () => {
  t = await abrir("prueba-turnos");
  u.dueno = await persona("dueno"); u.recepcion = await persona("recepcion");
  const [{ id }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`socio${Math.random()}@ejemplo.invalid`]);
  u.socio = id;
  alDia = await socio("Al Día"); vencida = await socio("Vencida"); otro = await socio("Por Vencer");
  await t.q(`update public.socios set usuario_id = $2 where id = $1`, [alDia, id]);
  await t.q(`update public.configuracion_gimnasio set modo_clases = 'reserva', reserva_dias_anticipacion = 7 where gimnasio_id = $1`, [t.g]);
  const [{ id: act }] = await t.q(`insert into public.actividades (gimnasio_id, nombre) values ($1, 'Funcional') returning id`, [t.g]);
  // Mañana a las 10, cupo 2.
  [{ id: horario }] = await t.q(`insert into public.horarios_clase (gimnasio_id, sede_id, actividad_id, dia_semana, hora_inicio, duracion_min, cupo, vigente_desde)
    values ($1, $2, $3, extract(isodow from privado.dia_local(now(), $4) + 1)::int, '10:00', 60, 2, privado.dia_local(now(), $4)) returning id`, [t.g, t.sede, act, t.ctx.zona]);
});
after(async () => t && t.cerrar());

test("apagados: no se puede abonar", async () => {
  await como(u.socio, () => t.falla(() => t.q(`select public.abonar_turno($1, $2)`, [alDia, horario]), /no tiene turnos fijos/));
});

test("prendidos: se reserva sola; cancelar una semana se respeta; al que no puede, no", async () => {
  await como(u.dueno, () => t.q(`select public.guardar_turnos_fijos($1, true)`, [t.g]));
  await como(u.socio, () => t.q(`select public.abonar_turno($1, $2)`, [alDia, horario]));
  let r = await reservasDe(alDia);
  assert.deepEqual(r.map((x) => [x.estado, x.fijo]), [["confirmada", true]], "la clase de mañana quedó reservada");
  // La cancela: al volver a mirar el día, no se vuelve a reservar.
  const [{ id: res }] = await t.q(`select r.id from public.reservas r join public.clases c on c.id = r.clase_id where r.socio_id = $1 and c.horario_id = $2`, [alDia, horario]);
  await como(u.socio, () => t.q(`select public.cancelar_reserva($1)`, [res]));
  await t.q(`select privado.materializar_dia($1, privado.dia_local(now(), $2) + 1)`, [t.sede, t.ctx.zona]);
  r = await reservasDe(alDia);
  assert.deepEqual(r.map((x) => x.estado), ["cancelada"]);
  // La recepción abona a una socia vencida: el turno queda, la reserva no (no puede tomar la clase).
  await como(u.recepcion, () => t.q(`select public.abonar_turno($1, $2)`, [vencida, horario]));
  assert.equal((await reservasDe(vencida)).length, 0);
});

test("el cupo topea los lugares fijos; quitar el turno cancela las próximas", async () => {
  await como(u.recepcion, () => t.falla(() => t.q(`select public.abonar_turno($1, $2)`, [otro, horario]), /todos los lugares fijos/));
  const [{ t: ts }] = await como(u.socio, () => t.q(`select public.turnos_socio($1) as t`, [alDia]));
  assert.equal(ts.prendido, true);
  assert.equal(ts.turnos[0].actividad, "Funcional"); assert.equal(ts.turnos[0].hora, "10:00");
  await como(u.socio, () => t.q(`select public.quitar_turno($1)`, [ts.turnos[0].turno_id]));
  const [{ t: ts2 }] = await como(u.socio, () => t.q(`select public.turnos_socio($1) as t`, [alDia]));
  assert.equal(ts2.turnos.length, 0);
  await como(u.socio, () => t.falla(() => t.q(`select public.quitar_turno($1)`, [ts.turnos[0].turno_id]), /ya estaba quitado/));
  await como(u.socio, () => t.falla(() => t.q(`select public.turnos_socio($1)`, [otro]), /permiso/i));
});
