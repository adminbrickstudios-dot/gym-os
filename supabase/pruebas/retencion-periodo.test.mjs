// VD-16 (20261106001600): cada número de Retención y números, con datos y momento fijos (marzo de 2024).
// privado.numeros_periodo recibe el "ahora": ninguna cuenta depende del reloj. Medir < 300 ms con 3.000
// socios no se puede probar en esta corrida (ver docs/v2/ESTADO-NOCHE.md): la prueba de exactitud es esta.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir } from "./_comun.mjs";

let t, u = {}, plan, zona;
const AHORA = "2024-03-20 12:00:00-03";
// Un instante de un día local del gimnasio a una hora.
const en = async (dia, hora = "00:00") => (await t.q(`select (privado.medianoche($1::date, $2) + $3::interval)::text r`, [dia, zona, hora]))[0].r;

async function socio(nombre, alta, { baja = null, cobertura = null } = {}) {
  const [{ id: s }] = await t.q(`insert into public.socios (gimnasio_id, nombre, apellido, creado_en, dado_de_baja_en, motivo_baja)
     values ($1,$2,'Periodo',$3::timestamptz,$4::timestamptz, case when $4::timestamptz is null then null else 'precio' end) returning id`,
    [t.g, nombre, await en(alta, "09:00"), baja ? await en(baja, "09:00") : null]);
  const [{ id: su }] = await t.q(`insert into public.suscripciones (gimnasio_id, socio_id, plan_id, inicio) values ($1,$2,$3,$4::timestamptz) returning id`, [t.g, s, plan, await en(alta)]);
  if (cobertura) await t.q(`insert into public.coberturas (gimnasio_id, suscripcion_id, socio_id, desde, hasta, origen, motivo) values ($1,$2,$3,$4::timestamptz,$5::timestamptz,'cortesia','vd16')`,
    [t.g, su, s, await en(cobertura[0]), await en(cobertura[1])]);
  return s;
}
async function entrada(s, dia, hora, resultado = "entro") {
  await t.q(`insert into public.ingresos (gimnasio_id, sede_id, socio_id, momento, via_acceso, resultado, color, motivo, texto)
     values ($1,$2,$3,$4::timestamptz,'recepcion',$5,$6,$7,$8)`,
    [t.g, t.sede, s, await en(dia, hora), resultado, ...(resultado === "rechazado" ? ["rojo", "vencida", "Vencida"] : ["verde", "al_dia", "Al día"])]);
}
const calcular = async () => (await t.q(`select privado.numeros_periodo($1, date '2024-03-01', date '2024-04-01', $2::timestamptz) r`, [t.g, AHORA]))[0].r;

let A, B, C, D, r;
before(async () => {
  t = await abrir("prueba-retencion-periodo");
  for (const rol of ["dueno", "recepcion"]) {
    const [{ id }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`${rol}${Math.random()}@ejemplo.invalid`]);
    await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,$3,$4)`, [t.g, id, rol, rol]);
    u[rol] = id;
  }
  [{ id: plan }] = await t.q(`select id from public.planes where gimnasio_id = $1 and nombre = 'Plan Full'`, [t.g]);
  [{ zona_horaria: zona }] = await t.q(`select zona_horaria from public.gimnasios where id = $1`, [t.g]);
  // A: al día todo el período. B: al día al empezar, se da de baja el 10/03. C: se anota el 05/03 y se va el 15/03 (a los 10 días).
  // D: se anota el 08/03 y sigue.
  A = await socio("A", "2024-01-10", { cobertura: ["2024-02-15", "2024-04-15"] });
  B = await socio("B", "2024-01-10", { cobertura: ["2024-02-01", "2024-03-10"], baja: "2024-03-10" });
  C = await socio("C", "2024-03-05", { cobertura: ["2024-03-05", "2024-04-05"], baja: "2024-03-15" });
  D = await socio("D", "2024-03-08", { cobertura: ["2024-03-08", "2024-04-08"] });
  // Plata: dos pagos aprobados en el período, uno anterior, uno pendiente.
  const venta = async () => (await t.q(`insert into public.ventas (gimnasio_id, sede_id, socio_id, origen, estado, confirmada_en) values ($1,$2,$3,'recepcion','confirmada',$4::timestamptz) returning id`, [t.g, t.sede, A, await en("2024-03-05", "12:00")]))[0].id;
  const pago = async (monto, estado, dia) => t.q(`insert into public.pagos (gimnasio_id, venta_id, medio, monto, estado, aprobado_en) values ($1,$2,'debito',$3,$4,$5::timestamptz)`,
    [t.g, await venta(), monto, estado, estado === "aprobado" ? await en(dia, "12:00") : null]);
  await pago(10000, "aprobado", "2024-03-05"); await pago(5000, "aprobado", "2024-03-12");
  await pago(7000, "aprobado", "2024-02-20"); await pago(3000, "pendiente", null);
  // Asistencia: A viene 7 días (4 y 4 de nuevo, 6, 11 al 15); D una vez; un rechazado de B no cuenta.
  await entrada(A, "2024-03-04", "19:00"); await entrada(A, "2024-03-04", "20:00"); await entrada(A, "2024-03-06", "19:00");
  for (const d of ["11", "12", "13", "14", "15"]) await entrada(A, `2024-03-${d}`, "19:00");
  await entrada(D, "2024-03-09", "10:00"); await entrada(B, "2024-03-05", "08:00", "rechazado");
  // Clases: una pasada con cupo 10 (reservan A, B, D; asistió A), una cancelada (no cuenta), una futura con cupo 5 (reserva A).
  const [{ id: act }] = await t.q(`insert into public.actividades (gimnasio_id, nombre) values ($1,'Funcional') returning id`, [t.g]);
  const clase = async (dia, cupo, cancelada = false) => (await t.q(`insert into public.clases (gimnasio_id, sede_id, actividad_id, inicio, fin, cupo, cancelada_en, cancelada_motivo)
      values ($1,$2,$3,$4::timestamptz,$5::timestamptz,$6, $7::timestamptz, $8) returning id`,
    [t.g, t.sede, act, await en(dia, "18:00"), await en(dia, "19:00"), cupo, cancelada ? await en(dia, "08:00") : null, cancelada ? "lluvia" : null]))[0].id;
  const pasada = await clase("2024-03-07", 10), cancelada = await clase("2024-03-08", 4, true), futura = await clase("2024-03-25", 5);
  const reservar = (c, s) => t.q(`insert into public.reservas (gimnasio_id, clase_id, socio_id, estado) values ($1,$2,$3,'confirmada')`, [t.g, c, s]);
  for (const s of [A, B, D]) await reservar(pasada, s);
  await reservar(cancelada, A); await reservar(futura, A);
  await t.q(`insert into public.asistencias (gimnasio_id, clase_id, socio_id) values ($1,$2,$3)`, [t.g, pasada, A]);
  r = await calcular();
});
after(async () => t && t.cerrar());

test("el período: los rangos [desde, hasta) de cada opción", async () => {
  const rango = async (p) => (await t.q(`select p_desde::text d, p_hasta::text h from privado.rango_periodo($1, date '2026-11-14')`, [p]))[0];
  assert.deepEqual(await rango("mes"), { d: "2026-11-01", h: "2026-11-15" });
  assert.deepEqual(await rango("mes_pasado"), { d: "2026-10-01", h: "2026-11-01" });
  assert.deepEqual(await rango("3"), { d: "2026-09-01", h: "2026-11-15" });
  assert.deepEqual(await rango("6"), { d: "2026-06-01", h: "2026-11-15" });
  assert.deepEqual(await rango("12"), { d: "2025-12-01", h: "2026-11-15" });
  await t.falla(() => t.q(`select * from privado.rango_periodo('cualquiera', date '2026-11-14')`), /Período desconocido/);
  assert.equal(r.dias, 31);
});

test("socios al día, altas, bajas y churn (general y a 90 días)", async () => {
  assert.equal(r.socios.al_dia_inicio, 2, "A y B estaban al día el 1/03");
  assert.equal(r.socios.al_dia_fin, 2, "el 20/03 siguen A y D (B y C se dieron de baja)");
  assert.equal(r.socios.altas, 2); assert.equal(r.socios.bajas, 2); assert.equal(r.socios.neto, 0);
  assert.equal(Number(r.churn.general_pct), 100, "2 bajas sobre 2 al día al empezar");
  assert.equal(r.churn.base, 2);
  assert.equal(r.churn.noventa_altas, 2); assert.equal(r.churn.noventa_bajas, 1);
  assert.equal(Number(r.churn.noventa_pct), 50, "de C y D, C se fue a los 10 días");
});

test("ingreso por socio: solo pagos aprobados del período", async () => {
  assert.equal(Number(r.plata.cobrado), 15000, "10.000 + 5.000; no el de febrero ni el pendiente");
  assert.equal(Number(r.plata.socios_promedio), 2);
  assert.equal(Number(r.plata.por_socio), 7500);
});

test("asistencia: días de visita, visitas por socio y 'una vez por semana o menos'", async () => {
  assert.equal(r.asistencia.entradas, 9, "el rechazado no cuenta");
  assert.equal(r.asistencia.dias_de_visita, 8, "A 7 días distintos (el 4 vino dos veces) + D 1");
  assert.equal(r.asistencia.socios_que_vinieron, 2);
  assert.equal(Number(r.asistencia.visitas_por_socio), 4);
  assert.equal(r.asistencia.pocas_visitas, 1, "D vino 1 día en 31 (menos de una vez por semana); A, no");
});

test("mapa de calor: ingresos por día de la semana y hora local", async () => {
  const celda = (dia, hora) => r.calor.find((c) => c.dia === dia && c.hora === hora)?.n ?? 0;
  assert.equal(celda(1, 19), 2, "lunes 4 y 11 a las 19");
  assert.equal(celda(1, 20), 1);
  assert.equal(celda(3, 19), 2, "miércoles 6 y 13");
  assert.equal(celda(2, 19), 1); assert.equal(celda(4, 19), 1); assert.equal(celda(5, 19), 1);
  assert.equal(celda(6, 10), 1, "sábado 9 a las 10");
  assert.equal(r.calor.reduce((a, c) => a + c.n, 0), 9);
});

test("clases: ocupación, ausentes y por actividad (la cancelada no cuenta)", async () => {
  assert.equal(r.clases.cupos, 15);
  assert.equal(r.clases.reservas, 4, "3 en la pasada + 1 en la futura");
  assert.equal(Number(r.clases.ocupacion_pct), 26.7);
  assert.equal(r.clases.ausentes, 2, "B y D reservaron la pasada y no figuran en la asistencia; la futura todavía no pasó");
  assert.equal(r.clases.por_actividad.length, 1);
  assert.deepEqual([r.clases.por_actividad[0].actividad, r.clases.por_actividad[0].clases, r.clases.por_actividad[0].cupos, r.clases.por_actividad[0].reservas],
    ["Funcional", 2, 15, 4]);
});

test("retencion_periodo: la ven dueño y encargado, la recepción no, y un período inválido falla", async () => {
  await t.comoUsuario(u.dueno, async () => {
    const [{ x }] = await t.q(`select public.retencion_periodo($1, '3') x`, [t.g]);
    assert.equal(x.periodo, "3");
    assert.ok(x.socios && x.churn && x.plata && x.asistencia && Array.isArray(x.calor) && x.clases);
  });
  await t.comoUsuario(u.dueno, () => t.falla(() => t.q(`select public.retencion_periodo($1, 'cualquiera')`, [t.g]), /Período desconocido/));
  await t.comoUsuario(u.recepcion, () => t.falla(() => t.q(`select public.retencion_periodo($1, 'mes')`, [t.g]), /permiso|rol|acceso/i));
});
