// Faltas (0080): con la regla "no dejar reservar", el socio que faltó sin
// cancelar no reserva por N días (la recepción sí lo anota); con presente no
// es falta; lo de antes de prender la regla no cuenta; apagada, nada.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir } from "./_comun.mjs";

let t, u = {}, socio, act;
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
const clase = async (desdeAhora, horas = 1) => (await t.q(`insert into public.clases (gimnasio_id, sede_id, actividad_id, inicio, fin, cupo)
  values ($1,$2,$3, now() + $4::interval, now() + $4::interval + $5::interval, 10) returning id`, [t.g, t.sede, act, desdeAhora, `${horas} hours`]))[0].id;
const politica = () => como(u.socio, async () => (await t.q(`select public.politica_reservas($1) as p`, [socio]))[0].p);
before(async () => {
  t = await abrir("prueba-faltas");
  u.dueno = await persona("dueno"); u.recepcion = await persona("recepcion");
  const [{ id }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`socio${Math.random()}@ejemplo.invalid`]);
  u.socio = id;
  [{ id: socio }] = await t.q(`update public.socios set usuario_id = $2 where gimnasio_id = $1 and nombre = 'Testigo' and apellido = 'Al Día' returning id`, [t.g, id]);
  await t.q(`update public.configuracion_gimnasio set modo_clases = 'reserva', reserva_dias_anticipacion = 7 where gimnasio_id = $1`, [t.g]);
  [{ id: act }] = await t.q(`insert into public.actividades (gimnasio_id, nombre) values ($1, 'Spinning') returning id`, [t.g]);
  // Una falta de ANTES de prender la regla: no cuenta.
  const vieja = await clase("-3 hours");
  await t.q(`insert into public.reservas (gimnasio_id, clase_id, socio_id, estado) values ($1,$2,$3,'confirmada')`, [t.g, vieja, socio]);
});
after(async () => t && t.cerrar());

test("apagada no pasa nada; prendida, lo de antes no cuenta", async () => {
  assert.equal((await politica()).bloqueo, null);
  await como(u.dueno, () => t.q(`select public.guardar_configuracion($1, $2)`, [t.g, { falta_politica: "bloquear", falta_bloqueo_dias: 3 }]));
  const p = await politica();
  assert.equal(p.bloqueo, null, "la falta de antes de prender la regla no bloquea");
  assert.ok(p.reglas.some((r) => /no podés reservar por 3 días/.test(r)));
  await como(u.dueno, () => t.falla(() => t.q(`select public.guardar_configuracion($1, $2)`, [t.g, { falta_politica: "descontar" }]), /Faltas: elegí/));
});

test("faltó sin cancelar: el socio no reserva por 3 días; la recepción lo anota igual; con presente no es falta", async () => {
  // La regla se prendió hace 2 h 30 (después de la falta vieja) y la clase fue hace 2.
  await t.q(`update public.configuracion_gimnasio set falta_politica_desde = now() - interval '150 minutes' where gimnasio_id = $1`, [t.g]);
  const falto = await clase("-2 hours");
  const [{ id: res }] = await t.q(`insert into public.reservas (gimnasio_id, clase_id, socio_id, estado) values ($1,$2,$3,'confirmada') returning id`, [t.g, falto, socio]);
  const p = await politica();
  assert.match(p.bloqueo.texto, /^No podés reservar hasta el \d\d\/\d\d: faltaste a Spinning del \d\d\/\d\d sin cancelar\.$/);
  const proxima = await clase("1 day");
  await como(u.socio, () => t.falla(() => t.q(`select public.reservar($1, $2)`, [proxima, socio]), /No podés reservar hasta/));
  const [{ r }] = await como(u.recepcion, () => t.q(`select public.reservar($1, $2) as r`, [proxima, socio]));
  assert.equal(r.estado, "confirmada", "la recepción lo anota igual");
  const [{ f }] = await como(u.recepcion, () => t.q(`select public.faltas_socio($1) as f`, [socio]));
  assert.ok(f.some((x) => x.clase_id === falto));
  // Si vino (presente), no es falta.
  await t.q(`insert into public.asistencias (gimnasio_id, clase_id, socio_id, reserva_id) values ($1,$2,$3,$4)`, [t.g, falto, socio, res]);
  assert.equal((await politica()).bloqueo, null);
});
