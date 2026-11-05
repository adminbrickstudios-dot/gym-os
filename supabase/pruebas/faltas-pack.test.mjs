// CLA-9 (0095): con la regla "descontar", faltar a una clase reservada con
// pack descuenta la clase; se calcula (puerta, reserva, ficha y app dan lo
// mismo), con momento fijo. No es falta con presente, si ese día entró, ni
// con la regla en "nada"; el presente tarde no queda frenado por su propia falta.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir } from "./_comun.mjs";

let t, act, pl, uDueno;
before(async () => {
  t = await abrir("prueba-faltas-pack");
  [{ id: act }] = await t.q(`insert into public.actividades (gimnasio_id, nombre) values ($1, 'Spinning') returning id`, [t.g]);
  [{ id: pl }] = await t.q(`insert into public.planes (gimnasio_id, tipo, nombre, cantidad_clases, validez_dias, consume_en)
                            values ($1,'pack','Pack 4',4,60,'ingreso') returning id`, [t.g]);
  const [{ id }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`d${Math.random()}@ejemplo.invalid`]);
  await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,'Dueña','dueno')`, [t.g, id]);
  uDueno = id;
  await t.q(`update public.configuracion_gimnasio set falta_politica = 'descontar', modo_clases = 'reserva' where gimnasio_id = $1`, [t.g]);
});
after(async () => t && t.cerrar());

// Un socio con un pack de N clases y una reserva confirmada en una clase de mañana (respecto de ahora).
async function escena(apellido, cantidad = 4) {
  const [{ id: s }] = await t.q(`insert into public.socios (gimnasio_id, nombre, apellido) values ($1,'Falta',$2) returning id`, [t.g, apellido]);
  const [{ id: pk }] = await t.q(`insert into public.packs (gimnasio_id, socio_id, plan_id, cantidad, desde, vence_en)
    values ($1,$2,$3,$4, now() - interval '1 day', now() + interval '60 days') returning id`, [t.g, s, pl, cantidad]);
  const [{ id: c, fin }] = await t.q(`insert into public.clases (gimnasio_id, sede_id, actividad_id, inicio, fin, cupo)
    values ($1,$2,$3, now() + interval '1 day', now() + interval '1 day 1 hour', 10) returning id, fin`, [t.g, t.sede, act]);
  await t.q(`select privado.reservar($1, $2, now())`, [c, s]);
  const [{ pack_id }] = await t.q(`select pack_id from public.reservas where clase_id = $1 and socio_id = $2`, [c, s]);
  assert.equal(pack_id, pk, "la reserva queda respaldada por el pack");
  const despues = new Date(new Date(fin).getTime() + 3600e3);
  return { s, pk, c, fin, despues };
}
const texto = async (s, m) => (await t.q(`select (privado.calcular_acceso($1, $2, $3)).texto`, [s, m, t.sede]))[0].texto;
const faltas = async (pk, m) => (await t.q(`select privado.faltas_pack($1, $2) n`, [pk, m]))[0].n;

test("faltó: la clase se descuenta en la puerta", async () => {
  const { s, pk, c, despues } = await escena("Faltó");
  const antes = new Date(Date.now() + 3600e3);
  assert.equal(await faltas(pk, antes), 0);
  assert.match(await texto(s, antes), /le quedan 3$/);
  assert.equal(await faltas(pk, despues), 1);
  assert.match(await texto(s, despues), /le quedan 2$/, "4 − 1 falta, y al entrar le quedan 2");
  // Reservar otra con el pack: le quedan 3 (no 4).
  const [{ h }] = await t.q(`select privado.habilitacion_clase($1, $2, $3) h`, [s, c, despues]);
  assert.equal(h.ok, true);
  void c;
});

test("con presente, o si ese día entró por la puerta, no es falta", async () => {
  const a = await escena("Vino");
  await t.q(`insert into public.asistencias (gimnasio_id, clase_id, socio_id) values ($1,$2,$3)`, [t.g, a.c, a.s]);
  assert.equal(await faltas(a.pk, a.despues), 0);
  const b = await escena("Entró");
  await t.q(`insert into public.ingresos (gimnasio_id, sede_id, socio_id, momento, via_acceso, resultado, via_habilitante, color, motivo, texto)
    values ($1,$2,$3, now() + interval '1 day', 'recepcion', 'entro', 'pack', 'verde', 'pack', 'x')`, [t.g, t.sede, b.s]);
  assert.equal(await faltas(b.pk, b.despues), 0);
});

test("el presente tarde no queda frenado por su propia falta (pack de 1)", async () => {
  const { s, c, pk, despues } = await escena("Tarde", 1);
  assert.equal(await faltas(pk, despues), 1);
  const [{ r }] = await t.q(`select privado.tomar_asistencia($1, $2, null, $3, false) r`, [c, s, despues]);
  assert.equal(r["descontó_pack"], false, "pack 'ingreso': el presente no descuenta");
  assert.equal(await faltas(pk, despues), 0, "con el presente deja de ser falta");
});

test("la ficha y la app cuentan la falta; con la regla en 'nada', no cuenta", async () => {
  const [{ id: s }] = await t.q(`insert into public.socios (gimnasio_id, nombre, apellido) values ($1,'Falta','Ficha') returning id`, [t.g]);
  const [{ id: pk }] = await t.q(`insert into public.packs (gimnasio_id, socio_id, plan_id, cantidad, desde, vence_en)
    values ($1,$2,$3,4, now() - interval '5 days', now() + interval '60 days') returning id`, [t.g, s, pl]);
  const [{ id: c }] = await t.q(`insert into public.clases (gimnasio_id, sede_id, actividad_id, inicio, fin, cupo)
    values ($1,$2,$3, now() - interval '3 hours', now() - interval '2 hours', 10) returning id`, [t.g, t.sede, act]);
  await t.q(`insert into public.reservas (gimnasio_id, clase_id, socio_id, estado, pack_id) values ($1,$2,$3,'confirmada',$4)`, [t.g, c, s, pk]);
  // La regla se prendió antes de esa clase.
  await t.q(`update public.configuracion_gimnasio set falta_politica_desde = now() - interval '1 day' where gimnasio_id = $1`, [t.g]);
  const usadas = () => t.comoUsuario(uDueno, async () => (await t.q(`select public.ficha_socio($1) f`, [s]))[0].f.packs[0].usadas);
  assert.equal(await usadas(), 1);
  await t.q(`update public.configuracion_gimnasio set falta_politica = 'nada' where gimnasio_id = $1`, [t.g]);
  assert.equal(await usadas(), 0);
  assert.equal(await faltas(pk, new Date()), 0);
});

test("guardar 'descontar' desde Configuración; la app avisa la regla", async () => {
  await t.comoUsuario(uDueno, async () => {
    await t.q(`select public.guardar_configuracion($1, '{"falta_politica":"descontar"}'::jsonb)`, [t.g]);
    await t.falla(() => t.q(`select public.guardar_configuracion($1, '{"falta_politica":"multar"}'::jsonb)`, [t.g]), /descontar la clase del pack/);
    const [{ c }] = await t.q(`select public.configuracion_panel($1) c`, [t.g]);
    assert.equal(JSON.stringify(c).match(/"falta_politica":\s*"(\w+)"/)[1], "descontar");
  });
});
