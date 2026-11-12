// D4 (PREVENCION.md · "Medianoche y zona horaria"): cajas, vencimientos y "hoy" a las 23:59 y a las 00:01 hora del gimnasio.
// Momentos fijos (nunca now()): sábado 14/11/2026 23:59 y domingo 15/11/2026 00:01 en la zona del gimnasio (Argentina, UTC-3).
// Las 23:59 locales son las 02:59 UTC del día siguiente: quien calcule el día en UTC se equivoca justo acá.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir, HOY } from "./_comun.mjs";
import { sumarDias } from "../../scripts/datos/casos-testigo.mjs";

let t, zona, socioHastaHoy, socioHastaManana;
const D = (n) => sumarDias(HOY, n);
const acc = async (socio, momento) => (await t.q(`select (privado.calcular_acceso($1, $2, null)).*`, [socio, momento]))[0];
const veredicto = (a) => [a.color, a.motivo, a.puede];
async function socioCubierto(apellido, hastaDia) {
  const [{ id: s }] = await t.q(`insert into public.socios (gimnasio_id, nombre, apellido) values ($1,'Medianoche',$2) returning id`, [t.g, apellido]);
  const [{ id: su }] = await t.q(`insert into public.suscripciones (gimnasio_id, socio_id, plan_id, inicio) values ($1,$2,$3,'2026-01-01T03:00:00Z') returning id`, [t.g, s, t.ctx.planes.full]);
  await t.q(`insert into public.coberturas (gimnasio_id, suscripcion_id, socio_id, desde, hasta, origen, motivo)
             values ($1,$2,$3,privado.medianoche($4::date,$6),privado.medianoche($5::date,$6),'cortesia','medianoche')`, [t.g, su, s, D(-20), hastaDia, zona]);
  return s;
}

before(async () => {
  t = await abrir("prueba-medianoche");
  zona = t.ctx.zona;
  assert.equal(zona, "America/Argentina/Buenos_Aires", "el gimnasio de prueba está en la hora de Argentina");
  socioHastaHoy = await socioCubierto("Cubierto hasta el 14", D(1));        // [.., 00:00 del 15): último día cubierto = sábado 14
  socioHastaManana = await socioCubierto("Cubierto hasta el 15", D(2));     // último día cubierto = domingo 15
});
after(async () => t && t.cerrar());

test("el 'hoy' del gimnasio: 23:59 es el 14 y 00:01 es el 15, y no el día en UTC", async () => {
  const a = await t.en(D(0), "23:59:00");
  const b = await t.en(D(1), "00:01:00");
  assert.ok(new Date(b) - new Date(a) === 2 * 60 * 1000, "entre las dos pasan 2 minutos");
  const dia = async (m, z) => (await t.q(`select privado.dia_local($1::timestamptz, $2)::text as d`, [m, z]))[0].d;
  assert.equal(await dia(a, zona), D(0));
  assert.equal(await dia(b, zona), D(1));
  // La trampa: a las 23:59 locales ya es el 15 en UTC.
  assert.equal(await dia(a, "UTC"), D(1), "en UTC las 23:59 del 14 ya son el 15: por eso el día se calcula con la zona del gimnasio");
  // La medianoche local del 15 es exactamente 03:00 UTC.
  const [{ m }] = await t.q(`select to_char(privado.medianoche($1::date, $2) at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS') as m`, [D(1), zona]);
  assert.equal(m, `${D(1)}T03:00:00`);
});

test("el día de caja corta a la medianoche local, o a la hora de corte del gimnasio", async () => {
  const dc = async (m, corte) => (await t.q(`select privado.dia_caja($1::timestamptz, $2, $3::time)::text as d`, [m, zona, corte]))[0].d;
  const m2359 = await t.en(D(0), "23:59:00"), m0001 = await t.en(D(1), "00:01:00");
  assert.equal(await dc(m2359, "00:00"), D(0), "23:59 todavía es la caja del 14");
  assert.equal(await dc(m0001, "00:00"), D(1), "00:01 ya es la caja del 15");
  // Con corte a las 04:00 (gimnasio que cierra de madrugada): las 00:01 del 15 siguen en la caja del 14, y las 04:00 abren la del 15.
  assert.equal(await dc(m0001, "04:00"), D(0));
  assert.equal(await dc(await t.en(D(1), "03:59:00"), "04:00"), D(0));
  assert.equal(await dc(await t.en(D(1), "04:00:00"), "04:00"), D(1));
});

test("vencimientos: cubierto hasta el 14 entra a las 23:59 y no entra a las 00:01; el veredicto es el mismo a cualquier hora del mismo día", async () => {
  const antes = await acc(socioHastaHoy, await t.en(D(0), "23:59:00"));
  assert.equal(antes.puede, true, `23:59 del último día cubierto: ${antes.texto}`);
  assert.equal(antes.color === "rojo", false);
  // El mismo veredicto de la mañana de ese día: la medianoche no lo corre ni un minuto antes.
  assert.deepEqual(veredicto(antes), veredicto(await acc(socioHastaHoy, await t.en(D(0), "08:00:00"))));

  const despues = await acc(socioHastaHoy, await t.en(D(1), "00:01:00"));
  assert.notEqual(despues.color, "verde", `00:01 del día siguiente: ${despues.texto}`);
  assert.notDeepEqual(veredicto(despues), veredicto(antes), "a las 00:01 el veredicto ya cambió");
  assert.deepEqual(veredicto(despues), veredicto(await acc(socioHastaHoy, await t.en(D(1), "12:00:00"))), "y es el mismo que al mediodía del 15");
});

test("el que está cubierto un día más no cambia con la medianoche", async () => {
  const a = await acc(socioHastaManana, await t.en(D(0), "23:59:00"));
  const b = await acc(socioHastaManana, await t.en(D(1), "00:01:00"));
  assert.equal(a.puede, true);
  assert.equal(b.puede, true);
  assert.equal(b.color === "rojo", false);
});

test("el vencimiento guardado (cubierto_hasta) es la medianoche local exacta, no la del servidor", async () => {
  const [{ ok }] = await t.q(`select s.cubierto_hasta = privado.medianoche($2::date, $3) as ok from public.socios s where s.id = $1`, [socioHastaHoy, D(1), zona]);
  assert.equal(ok, true);
  const [{ vence }] = await t.q(`select privado.dia_local(s.cubierto_hasta - interval '1 second', $2)::text as vence from public.socios s where s.id = $1`, [socioHastaHoy, zona]);
  assert.equal(vence, D(0), "el último día cubierto es el 14");
});
