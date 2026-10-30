// Clases: grilla, reservas con cupo, lista de espera, cancelaciones y asistencia.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir, HOY } from "./_comun.mjs";
import { sumarDias } from "../../scripts/datos/casos-testigo.mjs";

let t, momento, act, profe, uProfe, uOtroProfe, clase;
const MANIANA = sumarDias(HOY, 1); // domingo 15/11

before(async () => {
  t = await abrir("prueba-clases");
  momento = await t.en(HOY, "12:00:00");
  await t.q(`update public.configuracion_gimnasio set modo_clases = 'reserva' where gimnasio_id = $1`, [t.g]);
  [{ id: act }] = await t.q(`insert into public.actividades (gimnasio_id, nombre, emoji) values ($1,'Spinning','🚴') returning id`, [t.g]);
  [{ id: uProfe }] = await t.q(`insert into auth.users (email) values ('profe@ejemplo.invalid') returning id`);
  [{ id: uOtroProfe }] = await t.q(`insert into auth.users (email) values ('otro-profe@ejemplo.invalid') returning id`);
  [{ id: profe }] = await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,'Prof. Caro','profe') returning id`, [t.g, uProfe]);
  await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,'Prof. Juan','profe')`, [t.g, uOtroProfe]);
  await t.q(`insert into public.horarios_clase (gimnasio_id, sede_id, actividad_id, dia_semana, hora_inicio, duracion_min, cupo, profe_id, vigente_desde)
             values ($1,$2,$3,7,'19:00',50,2,$4,'2026-01-01')`, [t.g, t.sede, act, profe]);
  await t.q(`select privado.materializar_dia($1, $2::date)`, [t.sede, MANIANA]);
  [{ id: clase }] = await t.q(`select id from public.clases where gimnasio_id = $1`, [t.g]);
});
after(async () => t && t.cerrar());

const reservar = async (socio, m = momento) => (await t.q(`select privado.reservar($1, $2, $3) as r`, [clase, socio, m]))[0].r;
const reserva = async (socio) => (await t.q(`select * from public.reservas where clase_id = $1 and socio_id = $2 and estado <> 'cancelada'`, [clase, socio]))[0];

test("la clase se crea a demanda desde la grilla, en hora local, una sola vez", async () => {
  await t.q(`select privado.materializar_dia($1, $2::date)`, [t.sede, MANIANA]);
  const filas = await t.q(`select to_char(inicio at time zone $2, 'DD/MM HH24:MI') as i, cupo from public.clases where gimnasio_id = $1`, [t.g, t.ctx.zona]);
  assert.deepEqual(filas, [{ i: "15/11 19:00", cupo: 2 }]);
});

test("cupo 2: los dos primeros confirman, el tercero queda en espera con su posición", async () => {
  assert.equal((await reservar(t.ctx.socios.al_dia)).estado, "confirmada");
  assert.equal((await reservar(t.ctx.socios.por_vencer)).estado, "confirmada");
  const r = await reservar(t.ctx.socios.pack_con_clases);
  assert.equal(r.estado, "espera");
  assert.equal(r.posicion, 1);
  await t.falla(() => reservar(t.ctx.socios.al_dia), /Ya tenés una reserva/);
});

test("no reserva quien no va a poder entrar a esa hora, y dice por qué", async () => {
  await t.falla(() => reservar(t.ctx.socios.vencida), /No podés reservar: Venció el 24\/10/);
  await t.falla(() => reservar(t.ctx.socios.suspendido), /No podés reservar: Suspendido/);
});

test("un plan que no incluye la actividad no reserva", async () => {
  await t.db.query("savepoint pa");
  const [{ id: yoga }] = await t.q(`insert into public.actividades (gimnasio_id, nombre) values ($1,'Yoga') returning id`, [t.g]);
  await t.q(`insert into public.plan_actividades (gimnasio_id, plan_id, actividad_id) values ($1,$2,$3)`, [t.g, t.ctx.planes.full, yoga]);
  const e = await t.falla(() => reservar(t.ctx.socios.cumple), /Tu plan no incluye Spinning/);
  await t.db.query("rollback to savepoint pa");
  assert.ok(e);
});

test("cancelar una confirmada sube al primero de la espera y deja el aviso", async () => {
  const r = await reserva(t.ctx.socios.por_vencer);
  await t.q(`select privado.cancelar_reserva($1, 'socio', false, $2)`, [r.id, momento]);
  assert.equal((await reserva(t.ctx.socios.pack_con_clases)).estado, "confirmada");
  const [aviso] = await t.q(`select tipo, texto from public.avisos_pendientes where socio_id = $1`, [t.ctx.socios.pack_con_clases]);
  assert.equal(aviso.tipo, "lugar_liberado");
  assert.equal(aviso.texto, "Se liberó un lugar: tenés confirmada Spinning del 15/11 a las 19:00.");
});

test("el socio no cancela a último momento; la recepción sí", async () => {
  const r = await reserva(t.ctx.socios.al_dia);
  const tarde = await t.en(MANIANA, "18:00:00");
  await t.falla(() => t.q(`select privado.cancelar_reserva($1, 'socio', false, $2)`, [r.id, tarde]), /Faltan menos de 2 horas/);
  await t.db.query("savepoint rc");
  await t.q(`select privado.cancelar_reserva($1, 'equipo', true, $2)`, [r.id, tarde]);
  await t.db.query("rollback to savepoint rc");
});

test("la reserva se abre 7 días antes", async () => {
  const antes = await t.en(sumarDias(HOY, -10), "12:00:00");
  await t.falla(() => reservar(t.ctx.socios.cumple, antes), /hasta 7 días antes/);
});

test("asistencia: con pack 'se descuenta en la clase', descuenta una", async () => {
  const [{ id: pl }] = await t.q(`insert into public.planes (gimnasio_id, tipo, nombre, cantidad_clases, validez_dias, consume_en)
                                 values ($1,'pack','Pack 8 spinning',8,60,'asistencia') returning id`, [t.g]);
  const [{ id: s }] = await t.q(`insert into public.socios (gimnasio_id, nombre, apellido) values ($1,'Clase','Suelta') returning id`, [t.g]);
  await t.q(`insert into public.packs (gimnasio_id, socio_id, plan_id, cantidad, desde, vence_en)
             values ($1,$2,$3,8,$4,$4::timestamptz + interval '60 days')`, [t.g, s, pl, momento]);
  const [{ r }] = await t.q(`select privado.tomar_asistencia($1, $2, $3) as r`, [clase, s, profe]);
  assert.equal(r["descontó_pack"], true);
  await t.falla(() => t.q(`select privado.tomar_asistencia($1, $2, $3)`, [clase, s, profe]), /Ya tiene el presente/);
});

test("cancelar la clase: avisa a todos, cancela las reservas y devuelve la clase del pack", async () => {
  await t.db.query("savepoint cc");
  const [{ n }] = await t.q(`select privado.cancelar_clase($1, 'Se cortó la luz') as n`, [clase]);
  const avisos = await t.q(`select texto from public.avisos_pendientes where clase_id = $1 and tipo = 'clase_cancelada'`, [clase]);
  const [{ devueltos }] = await t.q(`select count(*)::int devueltos from public.consumos_pack where asistencia_id is not null and anulado_en is not null`);
  await t.db.query("rollback to savepoint cc");
  assert.equal(n, avisos.length);
  assert.ok(n >= 2);
  assert.match(avisos[0].texto, /^Se canceló Spinning del 15\/11 a las 19:00: Se cortó la luz$/);
  assert.equal(devueltos, 1);
});

test("un cierre del gimnasio crea las clases de ese día ya canceladas", async () => {
  await t.db.query("savepoint ci");
  await t.q(`insert into public.cierres (gimnasio_id, desde, hasta, motivo) values ($1,$2,$3,'Feriado')`,
    [t.g, await t.en(sumarDias(HOY, 8), "00:00:00"), await t.en(sumarDias(HOY, 9), "00:00:00")]);
  await t.q(`select privado.materializar_dia($1, $2::date)`, [t.sede, sumarDias(HOY, 8)]);
  const [c] = await t.q(`select cancelada_motivo from public.clases where gimnasio_id = $1 and inicio > $2::timestamptz + interval '7 days'`, [t.g, momento]);
  await t.db.query("rollback to savepoint ci");
  assert.equal(c.cancelada_motivo, "Gimnasio cerrado: Feriado");
});

test("modos: sin reserva no se reserva; sin clases no se muestran", async () => {
  await t.db.query("savepoint modo");
  await t.q(`update public.configuracion_gimnasio set modo_clases = 'sin_reserva' where gimnasio_id = $1`, [t.g]);
  await t.falla(() => reservar(t.ctx.socios.cumple), /no se reservan/);
  await t.q(`update public.configuracion_gimnasio set modo_clases = 'ninguno' where gimnasio_id = $1`, [t.g]);
  await t.q(`select set_config('request.jwt.claims', '{"role":"service_role"}', true)`);
  await t.falla(() => t.q(`select * from public.clases_del_dia($1, $2::date)`, [t.sede, MANIANA]), /no tiene clases/);
  await t.db.query("rollback to savepoint modo");
});

test("permisos: el profe ve y toma lista solo en sus clases; el socio reserva solo para sí", async () => {
  await t.comoUsuario(uProfe, async () => {
    const lista = await t.q(`select * from public.lista_clase($1)`, [clase]);
    assert.ok(lista.length >= 2);
    const socios = await t.q(`select id from public.socios`);
    assert.equal(socios.length, 0, "el profe no lee la tabla de socios");
  });
  await t.comoUsuario(uOtroProfe, () => t.falla(() => t.q(`select * from public.lista_clase($1)`, [clase]), /tus clases/));
  const [{ id: uSocio }] = await t.q(`insert into auth.users (phone) values ('+5490000666777') returning id`);
  await t.q(`update public.socios set usuario_id = $2 where id = $1`, [t.ctx.socios.cumple, uSocio]);
  await t.comoUsuario(uSocio, async () => {
    await t.falla(() => t.q(`select public.reservar($1, $2)`, [clase, t.ctx.socios.al_dia]), /Sin permiso/);
    const dia = await t.q(`select * from public.clases_del_dia($1, $2::date)`, [t.sede, MANIANA]);
    assert.equal(dia.length, 1);
    assert.equal(dia[0].actividad, "Spinning");
  });
});
