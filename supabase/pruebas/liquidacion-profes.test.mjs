// VD-52 (D33): liquidación de profes. Números fijos: por clase, por alumno presente y por hora; un cambio de regla a mitad
// de mes; una clase cancelada y una de otro mes que no cuentan; horas cargadas a mano que mandan; corregir una asistencia
// recalcula; pagar (transferencia y efectivo desde la caja), no pasarse de lo que falta; quién ve qué.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir } from "./_comun.mjs";

let t, u = {}, eq = {}, mes, act, caja;
const mesTxt = () => mes;
async function crear(rol, nombre) {
  const [{ id }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`${rol}${Math.random()}@ejemplo.invalid`]);
  const [{ e }] = await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,$3,$4) returning id as e`, [t.g, id, nombre, rol]);
  return [id, e];
}
async function como(usuario, fn) {
  await t.db.query("set role authenticated");
  await t.q(`select set_config('request.jwt.claims', $1, false)`, [JSON.stringify({ sub: usuario, role: "authenticated" })]);
  try { return await fn(); } finally { await t.db.query("reset role").catch(() => {}); await t.q(`select set_config('request.jwt.claims', '', false)`).catch(() => {}); }
}
/** Una clase del mes pasado, a las 19 (hora del gimnasio), de `min` minutos, con `n` presentes. */
async function clase(profe, dia, min, presentes, cancelada = false, mesBase = mes) {
  const [{ ini }] = await t.q(`select privado.medianoche(($1::date + $2::int), 'America/Argentina/Buenos_Aires') + interval '19 hours' as ini`, [mesBase, dia - 1]);
  const [{ id }] = await t.q(`insert into public.clases (gimnasio_id, sede_id, actividad_id, inicio, fin, profe_id, cancelada_en, cancelada_motivo)
    values ($1,$2,$3,$4, $4::timestamptz + ($5 || ' minutes')::interval, $6, $7, $8) returning id`,
    [t.g, t.sede, act, ini, String(min), profe, cancelada ? new Date() : null, cancelada ? "feriado" : null]);
  const ids = [];
  for (let i = 0; i < presentes; i++) {
    const [{ s }] = await t.q(`insert into public.socios (gimnasio_id, nombre, apellido) values ($1,'Alumno','N') returning id as s`, [t.g]);
    const [{ a }] = await t.q(`insert into public.asistencias (gimnasio_id, clase_id, socio_id) values ($1,$2,$3) returning id as a`, [t.g, id, s]);
    ids.push(a);
  }
  return { id, asistencias: ids };
}
const resumen = async (usuario, profe) => como(usuario, async () => {
  const [{ r }] = await t.q(`select public.liquidacion_profes($1, $2::date) r`, [t.g, mesTxt()]);
  return r.profes.find((p) => p.profe_id === profe);
});

before(async () => {
  t = await abrir("prueba-liquidacion-profes");
  [mes] = (await t.q(`select to_char(date_trunc('month', now() - interval '1 month'), 'YYYY-MM-DD') as m`)).map((r) => r.m);
  for (const [rol, nombre] of [["dueno", "Sofía"], ["encargado", "Enzo"], ["recepcion", "Rita"], ["profe", "Pablo"], ["profe", "Paula"], ["profe", "Hugo"]]) {
    const [usuario, equipo] = await crear(rol, nombre);
    u[nombre] = usuario; eq[nombre] = equipo;
  }
  [{ id: act }] = await t.q(`insert into public.actividades (gimnasio_id, nombre, emoji) values ($1, 'Funcional', '🏋️') returning id`, [t.g]);
  [{ id: caja }] = await t.q(`insert into public.cajas (gimnasio_id, sede_id, nombre) values ($1,$2,'Mostrador') returning id`, [t.g, t.sede]);
});
after(async () => t && t.cerrar());

test("las reglas las pone solo el dueño", async () => {
  await como(u["Rita"], () => t.falla(() => t.q(`select public.guardar_regla_profe($1,$2,'por_clase',1000)`, [t.g, eq["Pablo"]]), /permiso|rol|acceso/i));
  await como(u["Enzo"], () => t.falla(() => t.q(`select public.guardar_regla_profe($1,$2,'por_clase',1000)`, [t.g, eq["Pablo"]]), /permiso|rol|acceso/i));
  await como(u["Sofía"], async () => {
    await t.falla(() => t.q(`select public.guardar_regla_profe($1,$2,'quincenal',1000)`, [t.g, eq["Pablo"]]), /Elegí cómo se le paga/);
    await t.falla(() => t.q(`select public.guardar_regla_profe($1,$2,'por_clase',-5)`, [t.g, eq["Pablo"]]), /monto/);
  });
});

test("por alumno presente, con un cambio de regla a mitad de mes, una clase cancelada y una de otro mes", async () => {
  // Pablo: $1.000 por presente desde el día 1; desde el 15, $3.000 por clase.
  await t.q(`insert into public.reglas_pago_profe (gimnasio_id, profe_id, modo, monto, vigente_desde, creado_por) values ($1,$2,'por_presente',1000,$3::date,$2)`, [t.g, eq["Pablo"], mes]);
  await t.q(`insert into public.reglas_pago_profe (gimnasio_id, profe_id, modo, monto, vigente_desde, creado_por) values ($1,$2,'por_clase',3000,$3::date + 14,$2)`, [t.g, eq["Pablo"], mes]);
  await clase(eq["Pablo"], 3, 60, 3);       // 3 presentes × 1.000 = 3.000
  await clase(eq["Pablo"], 10, 60, 2);      // 2 presentes × 1.000 = 2.000
  await clase(eq["Pablo"], 20, 60, 5);      // desde el 15 es por clase: 3.000 (los 5 presentes no suman)
  await clase(eq["Pablo"], 12, 60, 4, true); // cancelada: no cuenta
  const [{ otro }] = await t.q(`select to_char(date_trunc('month', $1::date - interval '1 month'), 'YYYY-MM-DD') otro`, [mes]);
  await clase(eq["Pablo"], 5, 60, 6, false, otro);   // del mes anterior al liquidado: no cuenta
  const r = await resumen(u["Sofía"], eq["Pablo"]);
  assert.equal(r.clases, 3);
  assert.equal(r.presentes, 10);
  assert.equal(Number(r.total), 8000, "3.000 + 2.000 + 3.000");
  assert.equal(Number(r.pagado), 0);
  assert.equal(Number(r.pendiente), 8000);
});

test("corregir una asistencia recalcula el mes", async () => {
  const [{ id: c }] = await t.q(`select c.id from public.clases c where c.profe_id = $1 and c.cancelada_en is null
                                 and privado.dia_local(c.inicio, 'America/Argentina/Buenos_Aires') = $2::date + 9`, [eq["Pablo"], mes]);   // la del día 10
  const [{ id: a }] = await t.q(`select id from public.asistencias where clase_id = $1 limit 1`, [c]);
  await t.q(`update public.asistencias set anulada_en = now(), anulada_motivo = 'vino a otra clase', anulada_por = $2 where id = $1`, [a, eq["Sofía"]]);
  const r = await resumen(u["Sofía"], eq["Pablo"]);
  assert.equal(r.presentes, 9);
  assert.equal(Number(r.total), 7000, "la clase del 10 pasó a 1 presente: 1.000 + 3.000 + 3.000");
});

test("por clase y por hora; las horas cargadas a mano mandan sobre las de las clases", async () => {
  await t.q(`insert into public.reglas_pago_profe (gimnasio_id, profe_id, modo, monto, vigente_desde, creado_por) values ($1,$2,'por_clase',8000,$3::date,$2)`, [t.g, eq["Paula"], mes]);
  await clase(eq["Paula"], 4, 60, 1); await clase(eq["Paula"], 11, 60, 0);
  const paula = await resumen(u["Sofía"], eq["Paula"]);
  assert.equal(Number(paula.total), 16000, "2 clases × 8.000");

  await t.q(`insert into public.reglas_pago_profe (gimnasio_id, profe_id, modo, monto, vigente_desde, creado_por) values ($1,$2,'por_hora',6000,$3::date,$2)`, [t.g, eq["Hugo"], mes]);
  await clase(eq["Hugo"], 6, 60, 0); await clase(eq["Hugo"], 13, 90, 0);
  let hugo = await resumen(u["Sofía"], eq["Hugo"]);
  assert.equal(Number(hugo.horas_clases), 2.5);
  assert.equal(Number(hugo.total), 15000, "2,5 h × 6.000 por los minutos de las clases");
  // El dueño carga 4 horas (el profe estuvo más tiempo que sus clases): mandan las cargadas.
  await como(u["Rita"], () => t.falla(() => t.q(`select public.cargar_horas_profe($1,$2,$3::date + 5, 240)`, [t.g, eq["Hugo"], mes]), /permiso|rol|acceso/i));
  await como(u["Sofía"], async () => {
    await t.falla(() => t.q(`select public.cargar_horas_profe($1,$2,$3::date + 5, 0)`, [t.g, eq["Hugo"], mes]), /minutos/);
  });
  await t.q(`select set_config('request.jwt.claims', $1, false)`, [JSON.stringify({ sub: u["Sofía"], role: "authenticated" })]);
  await t.db.query("set role authenticated");
  const [{ h }] = await t.q(`select public.cargar_horas_profe($1,$2,$3::date + 5, 240, 'incluye la apertura') h`, [t.g, eq["Hugo"], mes]);
  await t.db.query("reset role");
  hugo = await resumen(u["Sofía"], eq["Hugo"]);
  assert.equal(Number(hugo.horas_cargadas), 4);
  assert.equal(Number(hugo.total), 24000, "4 h × 6.000");
  await como(u["Sofía"], () => t.q(`select public.anular_horas_profe($1, 'me equivoqué')`, [h]).then(async () => {
    const [{ r }] = await t.q(`select public.liquidacion_profes($1, $2::date) r`, [t.g, mes]);
    assert.equal(Number(r.profes.find((p) => p.profe_id === eq["Hugo"]).total), 15000, "anuladas las horas, vuelve a contar las de las clases");
  }));
});

test("sin regla: aparece con las clases y se avisa, pero no suma", async () => {
  const [, nuevo] = await crear("profe", "Sin Regla");
  await clase(nuevo, 8, 60, 2);
  const r = await resumen(u["Sofía"], nuevo);
  assert.equal(r.sin_regla, true);
  assert.equal(Number(r.total), 0);
});

test("pagar: transferencia, no pasarse, mismo pago dos veces es uno, efectivo sale de la caja", async () => {
  const pagar = (monto, medio, extra = {}) => t.q(`select public.pagar_profe($1,$2,$3::date,$4,$5,$6,$7,$8) id`,
    [t.g, eq["Paula"], mes, monto, medio, extra.nota ?? null, extra.turno ?? null, extra.clave ?? null]);
  await como(u["Rita"], () => t.falla(() => pagar(1000, "transferencia"), /permiso|rol|acceso/i));
  await como(u["Enzo"], () => t.falla(() => pagar(1000, "transferencia"), /permiso|rol|acceso/i));
  await como(u["Sofía"], async () => {
    await t.falla(() => pagar(16000.01, "transferencia"), /más de lo que falta/);
    await t.falla(() => pagar(0, "transferencia"), /mayor a cero/);
    await t.falla(() => pagar(1000, "bitcoin"), /Elegí cómo se le pagó/);
    await t.falla(() => pagar(1000, "efectivo"), /abrí tu turno de caja/);
    const [{ id: a }] = await pagar(6000, "transferencia", { nota: "alias paula.mp", clave: "op-1" });
    const [{ id: b }] = await pagar(6000, "transferencia", { clave: "op-1" });
    assert.equal(a, b, "la misma clave de operación no paga dos veces");
    const [{ r }] = await t.q(`select public.liquidacion_profes($1, $2::date) r`, [t.g, mes]);
    const p = r.profes.find((x) => x.profe_id === eq["Paula"]);
    assert.equal(Number(p.pagado), 6000); assert.equal(Number(p.pendiente), 10000);
    // En efectivo: sale de SU turno abierto, queda como retiro con motivo.
    const [{ id: turno }] = await t.q(`select public.abrir_caja($1, 0) as id`, [caja]);
    await t.falla(() => pagar(10000, "efectivo", { turno: "00000000-0000-0000-0000-000000000000" }), /turno de caja/);
    const [{ id: pago }] = await pagar(10000, "efectivo", { turno });
    const [{ n, total, motivo }] = await t.q(`select count(*)::int n, sum(monto) total, min(motivo) motivo from public.movimientos_caja where turno_caja_id = $1 and tipo = 'retiro'`, [turno]);
    assert.equal(n, 1); assert.equal(Number(total), 10000); assert.match(motivo, /Pago a profe: Paula/);
    const [{ r: r2 }] = await t.q(`select public.liquidacion_profes($1, $2::date) r`, [t.g, mes]);
    assert.equal(Number(r2.profes.find((x) => x.profe_id === eq["Paula"]).pendiente), 0, "pagado todo");
    await t.falla(() => pagar(1, "transferencia"), /más de lo que falta/);
    // Anular un pago en efectivo devuelve la plata a la caja abierta de quien anula, y vuelve a deber.
    await t.falla(() => t.q(`select public.anular_pago_profe($1, 'error')`, [pago]), /abrí tu turno/);
    await t.q(`select public.anular_pago_profe($1, 'me equivoqué de profe', $2)`, [pago, turno]);
    const [{ ing }] = await t.q(`select coalesce(sum(monto),0) ing from public.movimientos_caja where turno_caja_id = $1 and tipo = 'ingreso'`, [turno]);
    assert.equal(Number(ing), 10000);
    const [{ r: r3 }] = await t.q(`select public.liquidacion_profes($1, $2::date) r`, [t.g, mes]);
    assert.equal(Number(r3.profes.find((x) => x.profe_id === eq["Paula"]).pendiente), 10000);
    await t.falla(() => t.q(`select public.anular_pago_profe($1, 'otra vez', $2)`, [pago, turno]), /ya estaba anulado/);
  });
  // Los pagos no se borran ni se editan.
  await t.falla(() => t.q(`delete from public.pagos_profe`), /inmutable|no se puede|no se borra|permission/i);
});

test("quién ve qué: el encargado solo si el dueño lo prende; cada profe ve lo suyo; la recepción nada", async () => {
  await como(u["Rita"], () => t.falla(() => t.q(`select public.liquidacion_profes($1, $2::date)`, [t.g, mes]), /permiso|rol|acceso/i));
  await como(u["Enzo"], () => t.falla(() => t.q(`select public.liquidacion_profes($1, $2::date)`, [t.g, mes]), /no te dio acceso/));
  await como(u["Enzo"], () => t.falla(() => t.q(`select public.config_liquidacion($1)`, [t.g]), /permiso|rol|acceso/i));
  await t.q(`select set_config('request.jwt.claims', $1, false)`, [JSON.stringify({ sub: u["Sofía"], role: "authenticated" })]);
  await t.db.query("set role authenticated");
  await t.q(`select public.guardar_config_liquidacion($1, true)`, [t.g]);
  await t.db.query("reset role");
  await como(u["Enzo"], async () => {
    const [{ r }] = await t.q(`select public.liquidacion_profes($1, $2::date) r`, [t.g, mes]);
    assert.ok(r.profes.length >= 3, "con el permiso prendido el encargado ve el resumen");
    await t.falla(() => t.q(`select public.pagar_profe($1,$2,$3::date,1,'transferencia')`, [t.g, eq["Paula"], mes]), /permiso|rol|acceso/i);
  });
  // Cada profe ve solo lo suyo.
  await como(u["Pablo"], async () => {
    const [{ r }] = await t.q(`select public.mi_liquidacion($1, $2::date) r`, [t.g, mes]);
    assert.equal(r.resumen.nombre, "Pablo");
    assert.equal(Number(r.resumen.total), 7000);
    assert.equal(r.clases.length, 3);
    await t.falla(() => t.q(`select public.liquidacion_profes($1, $2::date)`, [t.g, mes]), /permiso|rol|acceso/i);
    await t.falla(() => t.q(`select count(*) from public.pagos_profe`), /permission|permiso/i);
  });
  // Otro gimnasio no ve nada de este.
  const [{ id: otro }] = await t.q(`insert into public.gimnasios (slug, nombre) values ('otro-liq', 'Otro') returning id`);
  const [{ id: uo }] = await t.q(`insert into auth.users (email) values ('dueno-otro-liq@ejemplo.invalid') returning id`);
  await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,'Dueño otro','dueno')`, [otro, uo]);
  await como(uo, () => t.falla(() => t.q(`select public.liquidacion_profes($1, $2::date)`, [t.g, mes]), /permiso|rol|acceso|equipo/i));
});
