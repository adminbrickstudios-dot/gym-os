// VD-46Q (7603): perdonar una falta o el bloqueo de reservas, con motivo.
// Solo dueño y encargado; la falta perdonada deja de contar (bloqueo, lista y descuento del pack);
// queda escrito quién y por qué; el perdón no se cambia ni se borra.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir } from "./_comun.mjs";

let t, u = {}, socio, act, pl;
async function persona(rol) {
  const [{ id }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`${rol}${Math.random()}@ejemplo.invalid`]);
  await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,$3,$4)`, [t.g, id, `P ${rol}`, rol]);
  return id;
}
// Como el usuario, SIN deshacer lo que escribe (lo que prueba cada test queda para el siguiente).
async function como(usuario, fn) {
  await t.db.query("set role authenticated");
  await t.q(`select set_config('request.jwt.claims', $1, false)`, [JSON.stringify({ sub: usuario, role: "authenticated" })]);
  try { return await fn(); } finally { await t.db.query("reset role"); await t.q(`select set_config('request.jwt.claims', '', false)`); }
}
const clase = async (desdeAhora, horas = 1) => (await t.q(`insert into public.clases (gimnasio_id, sede_id, actividad_id, inicio, fin, cupo)
  values ($1,$2,$3, now() + $4::interval, now() + $4::interval + $5::interval, 10) returning id`, [t.g, t.sede, act, desdeAhora, `${horas} hours`]))[0].id;
const reservar = (c, s = socio) => t.q(`insert into public.reservas (gimnasio_id, clase_id, socio_id, estado) values ($1,$2,$3,'confirmada') returning id`, [t.g, c, s]);
const bloqueo = () => t.q(`select privado.bloqueo_reservas($1) as b`, [socio]).then((r) => r[0].b);

before(async () => {
  t = await abrir("prueba-perdonar");
  u.dueno = await persona("dueno"); u.recepcion = await persona("recepcion"); u.encargado = await persona("encargado");
  [{ id: socio }] = await t.q(`select id from public.socios where gimnasio_id = $1 and nombre = 'Testigo' and apellido = 'Al Día'`, [t.g]);
  [{ id: act }] = await t.q(`insert into public.actividades (gimnasio_id, nombre) values ($1, 'Spinning') returning id`, [t.g]);
  [{ id: pl }] = await t.q(`insert into public.planes (gimnasio_id, tipo, nombre, cantidad_clases, validez_dias, consume_en)
                            values ($1,'pack','Pack 4',4,60,'ingreso') returning id`, [t.g]);
  await t.q(`update public.configuracion_gimnasio set modo_clases = 'reserva', falta_politica = 'bloquear', falta_bloqueo_dias = 3 where gimnasio_id = $1`, [t.g]);
  await t.q(`update public.configuracion_gimnasio set falta_politica_desde = now() - interval '10 days' where gimnasio_id = $1`, [t.g]);
});
after(async () => t && t.cerrar());

test("el bloqueo se perdona con motivo; solo dueño y encargado; el socio vuelve a poder reservar", async () => {
  const falto = await clase("-2 hours");
  await reservar(falto);
  assert.ok(await bloqueo(), "con la falta, está bloqueado");
  await como(u.recepcion, () => t.falla(() => t.q(`select public.perdonar_bloqueo($1, 'avisó por teléfono')`, [socio]), /Sin permiso/));
  await como(u.dueno, () => t.falla(() => t.q(`select public.perdonar_bloqueo($1, '  ')`, [socio]), /motivo/));
  const [{ r }] = await como(u.encargado, () => t.q(`select public.perdonar_bloqueo($1, 'Avisó por teléfono que estaba enfermo') as r`, [socio]));
  assert.equal(r.perdonadas, 1);
  assert.equal(await bloqueo(), null, "el bloqueo se fue");
  await como(u.dueno, () => t.falla(() => t.q(`select public.perdonar_bloqueo($1, 'de nuevo')`, [socio]), /no tiene un bloqueo/));
  const [{ f }] = await como(u.dueno, () => t.q(`select public.faltas_socio($1) as f`, [socio]));
  assert.ok(!f.some((x) => x.clase_id === falto), "la falta perdonada sale de la lista");
});

test("queda en el historial con quién y por qué; la recepción no lo ve; no se cambia ni se borra", async () => {
  const [{ d }] = await como(u.dueno, () => t.q(`select public.faltas_socio_detalle($1) as d`, [socio]));
  assert.equal(d.puede_perdonar, true);
  assert.equal(d.faltas.length, 0);
  assert.equal(d.perdonadas.length, 1);
  assert.equal(d.perdonadas[0].motivo, "Avisó por teléfono que estaba enfermo");
  assert.equal(d.perdonadas[0].por, "P encargado");
  const [{ d: dr }] = await como(u.recepcion, () => t.q(`select public.faltas_socio_detalle($1) as d`, [socio]));
  assert.equal(dr.puede_perdonar, false);
  assert.equal(dr.perdonadas.length, 0);
  await t.falla(() => t.q(`update public.faltas_perdonadas set motivo = 'otro motivo' where socio_id = $1`, [socio]), /queda escrito/);
  await t.falla(() => t.q(`delete from public.faltas_perdonadas where socio_id = $1`, [socio]), /queda escrito/);
});

test("perdonar una falta suelta: exige que sea falta, no se perdona dos veces y no cruza gimnasios", async () => {
  const falto = await clase("-90 minutes");
  const proxima = await clase("1 day");
  await reservar(falto); await reservar(proxima);
  await como(u.dueno, () => t.falla(() => t.q(`select public.perdonar_falta($1, $2, 'todavía no pasó')`, [proxima, socio]), /no cuenta como falta/));
  await como(u.recepcion, () => t.falla(() => t.q(`select public.perdonar_falta($1, $2, 'avisó')`, [falto, socio]), /Sin permiso/));
  await como(u.dueno, () => t.falla(() => t.q(`select public.perdonar_falta($1, $2, 'x')`, [falto, socio]), /motivo/));
  assert.ok(await bloqueo());
  const [{ r }] = await como(u.dueno, () => t.q(`select public.perdonar_falta($1, $2, 'Avisó con tiempo, fue un error de la agenda') as r`, [falto, socio]));
  assert.equal(r.bloqueo, null);
  assert.equal(await bloqueo(), null);
  const [{ l }] = await como(u.dueno, () => t.q(`select public.faltas_clase($1) as l`, [falto]));
  assert.equal(l.length, 1);
  assert.equal(l[0].perdonada, true);
  assert.equal(l[0].motivo, "Avisó con tiempo, fue un error de la agenda");
  await como(u.recepcion, () => t.falla(() => t.q(`select public.faltas_clase($1)`, [falto]), /Sin permiso/));
  await como(u.dueno, () => t.falla(() => t.q(`select public.perdonar_falta($1, $2, 'otra vez')`, [falto, socio]), /ya estaba perdonada/));
  await como(u.dueno, () => t.falla(() => t.q(`select public.perdonar_falta($1, $2, 'sin reserva')`, [falto, t.ctx.socios.vencida]), /no tiene una reserva/));
});

test("el pack recupera la clase perdonada (regla descontar)", async () => {
  await t.q(`update public.configuracion_gimnasio set falta_politica = 'descontar' where gimnasio_id = $1`, [t.g]);
  await t.q(`update public.configuracion_gimnasio set falta_politica_desde = now() - interval '10 days' where gimnasio_id = $1`, [t.g]);
  const [{ id: s }] = await t.q(`insert into public.socios (gimnasio_id, nombre, apellido) values ($1,'Falta','Pack') returning id`, [t.g]);
  const [{ id: pk }] = await t.q(`insert into public.packs (gimnasio_id, socio_id, plan_id, cantidad, desde, vence_en)
    values ($1,$2,$3,4, now() - interval '1 day', now() + interval '60 days') returning id`, [t.g, s, pl]);
  const c = await clase("1 day");
  const [{ id: res }] = await t.q(`insert into public.reservas (gimnasio_id, clase_id, socio_id, estado, pack_id) values ($1,$2,$3,'confirmada',$4) returning id`, [t.g, c, s, pk]);
  const [{ fin }] = await t.q(`select fin from public.clases where id = $1`, [c]);
  const despues = new Date(new Date(fin).getTime() + 3600e3);
  const faltas = async () => (await t.q(`select privado.faltas_pack($1, $2) n`, [pk, despues]))[0].n;
  assert.equal(await faltas(), 1, "faltó: el pack pierde una clase");
  const [{ id: e }] = await t.q(`select id from public.equipo where gimnasio_id = $1 and rol = 'dueno'`, [t.g]);
  await t.q(`insert into public.faltas_perdonadas (gimnasio_id, reserva_id, socio_id, clase_id, motivo, perdonado_por) values ($1,$2,$3,$4,'Avisó',$5)`, [t.g, res, s, c, e]);
  assert.equal(await faltas(), 0, "perdonada: el pack recupera la clase");
});
