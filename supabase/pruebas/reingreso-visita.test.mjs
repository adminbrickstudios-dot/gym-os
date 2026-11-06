// VD-3 (4200): una visita dura N horas y el anti-préstamo. Todo con momentos fijos, nunca now().
//   4 h 59 m = repetido (no cuenta, no descuenta); 5 h 01 m = entrada nueva; el QR dos veces dice "ya entraste";
//   otra vía antes de N minutos = amarillo con alerta para el dueño; 0 = apagado.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir, HOY } from "./_comun.mjs";

let t, uDueno, uRec;
async function como(usuario, fn) {
  await t.db.query("set role authenticated");
  await t.q(`select set_config('request.jwt.claims', $1, false)`, [JSON.stringify({ sub: usuario, role: "authenticated" })]);
  try { return await fn(); } finally { await t.db.query("reset role"); await t.q(`select set_config('request.jwt.claims', '', false)`); }
}
before(async () => {
  t = await abrir("prueba-reingreso-visita");
  for (const rol of ["dueno", "recepcion"]) {
    const [{ id }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`${rol}${Math.random()}@ejemplo.invalid`]);
    await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,$3,$4)`, [t.g, id, rol, rol]);
    if (rol === "dueno") uDueno = id; else uRec = id;
  }
});
after(async () => t && t.cerrar());

const sumar = (m, minutos) => new Date(new Date(m).getTime() + minutos * 60_000);
const reg = async (socio, m, via = "recepcion") =>
  (await t.q(`select privado.registrar_ingreso($1, $2, $3, null, null, null, $4) as r`, [socio, t.sede, via, m]))[0].r;
const ingresos = async (socio) => (await t.q(`select count(*)::int n from public.ingresos where socio_id = $1 and resultado <> 'rechazado'`, [socio]))[0].n;
const packs = async (socio) => (await t.q(`select count(*)::int n from public.consumos_pack where socio_id = $1 and anulado_en is null`, [socio]))[0].n;
const alertas = async (socio) => (await t.q(`select count(*)::int n from public.alertas_prestamo where socio_id = $1`, [socio]))[0].n;
const config = (datos) => t.q(`insert into public.configuracion_visita (gimnasio_id, visita_horas, antiprestamo_minutos) values ($1, $2, $3)
                               on conflict (gimnasio_id) do update set visita_horas = $2, antiprestamo_minutos = $3`, [t.g, datos.horas, datos.minutos]);

test("a las 4 h 59 m es la misma visita: no cuenta otra entrada ni descuenta el pack", async () => {
  const s = t.ctx.socios.pack_con_clases;
  const m = await t.en(HOY, "10:00:00");
  const antes = await packs(s);
  const entradasAntes = await ingresos(s);   // el caso testigo ya trae las entradas de sus clases consumidas
  const r1 = await reg(s, m);
  assert.equal(r1.repetido, false);
  assert.equal(await packs(s), antes + 1);
  const r2 = await reg(s, sumar(m, 4 * 60 + 59));
  assert.equal(r2.repetido, true);
  assert.equal(r2.ingreso_id, r1.ingreso_id);
  assert.match(r2.texto, /^Ya entró a las 10:00$/);
  assert.equal(r2.color, r1.veredicto.color, "el color de quien está al día no cambia");
  assert.equal(await ingresos(s), entradasAntes + 1);
  assert.equal(await packs(s), antes + 1, "el pack no se descuenta otra vez");
});

test("a las 5 h 01 m es una entrada nueva", async () => {
  const s = t.ctx.socios.pack_con_clases;
  const m = await t.en(HOY, "10:00:00");
  const entradasAntes = await ingresos(s);
  const r = await reg(s, sumar(m, 5 * 60 + 1));
  assert.equal(r.repetido, false);
  assert.notEqual(r.ingreso_id, undefined);
  assert.equal(await ingresos(s), entradasAntes + 1);
});

test("el QR dos veces dice 'ya entraste' y no cuenta otra", async () => {
  const s = t.ctx.socios.por_vencer;
  const m = await t.en(HOY, "08:00:00");
  const base = await ingresos(s);
  const r1 = await reg(s, m, "qr_socio");
  const r2 = await reg(s, sumar(m, 90), "qr_socio");
  assert.equal(r2.repetido, true);
  assert.equal(r2.ingreso_id, r1.ingreso_id);
  assert.equal(r2.alerta_prestamo, undefined, "misma vía: no es préstamo");
  assert.match(r2.texto, /^Ya entraste a las 08:00 ✓$/);
  assert.equal(r2.color, r1.veredicto.color);
  assert.equal(await ingresos(s), base + 1);
  assert.equal(await alertas(s), 0);
});

test("otra vía a los 4 minutos: amarillo, sin entrada nueva, y queda la alerta para el dueño", async () => {
  const s = t.ctx.socios.al_dia;
  const m = await t.en(HOY, "10:00:00");
  const base = await ingresos(s);
  const r1 = await reg(s, m, "recepcion");
  assert.equal(r1.veredicto.color, "verde");
  const r2 = await reg(s, sumar(m, 4), "qr_pared");
  assert.equal(r2.repetido, true);
  assert.equal(r2.alerta_prestamo, true);
  assert.equal(r2.color, "amarillo");
  assert.equal(r2.color_entrada, "verde");
  assert.match(r2.texto, /^Ya entró hace 4 min por recepción: ¿es la misma persona\?$/);
  assert.equal(await ingresos(s), base + 1, "no cuenta otra entrada");
  assert.equal(await alertas(s), 1);
  // El dueño la ve; la recepción no.
  const lista = await como(uDueno, async () => (await t.q(`select public.alertas_prestamo($1, $2::date, 7) as a`, [t.g, HOY]))[0].a);
  assert.equal(lista.length, 1);
  assert.equal(lista[0].minutos, 4);
  assert.equal(lista[0].via_anterior, "recepcion");
  assert.equal(lista[0].via_nueva, "qr_pared");
  await como(uRec, () => t.falla(() => t.q(`select public.alertas_prestamo($1, $2::date, 7)`, [t.g, HOY]), /permiso|rol|acceso/i));
});

test("otra vía pasada la hora (o el mismo dispositivo) es un repetido común, sin alerta", async () => {
  const s = t.ctx.socios.al_dia;
  const m = await t.en(HOY, "10:00:00");
  const r = await reg(s, sumar(m, 61), "qr_pared");
  assert.equal(r.repetido, true);
  assert.equal(r.alerta_prestamo, undefined);
  assert.equal(r.color, "verde");
  assert.match(r.texto, /^Ya entraste a las 10:00 ✓$/);
  assert.equal(await alertas(s), 1, "la alerta de antes sigue siendo una sola");
});

test("avisar en 0 minutos apaga el anti-préstamo", async () => {
  const s = t.ctx.socios.vence_hoy;
  await config({ horas: 5, minutos: 0 });
  const m = await t.en(HOY, "10:00:00");
  await reg(s, m, "recepcion");
  const r = await reg(s, sumar(m, 2), "kiosco");
  assert.equal(r.repetido, true);
  assert.equal(r.alerta_prestamo, undefined);
  assert.notEqual(r.motivo, "posible_prestamo");
  assert.equal(await alertas(s), 0);
});

test("visita en 0 horas: queda el doble toque de 60 segundos y nada más", async () => {
  const s = t.ctx.socios.en_tolerancia;
  await config({ horas: 0, minutos: 0 });
  const m = await t.en(HOY, "10:00:00");
  const base = await ingresos(s);
  const r1 = await reg(s, m);
  const r2 = await reg(s, new Date(new Date(m).getTime() + 20_000));
  assert.equal(r2.repetido, true);
  assert.equal(r2.ingreso_id, r1.ingreso_id);
  const r3 = await reg(s, sumar(m, 2));
  assert.equal(r3.repetido, false, "a los 2 minutos ya es otra entrada");
  assert.equal(await ingresos(s), base + 2);
});

test("la configuración: el dueño la cambia, todos la leen, y se valida", async () => {
  const guardar = (usuario, datos) => como(usuario, async () => (await t.q(`select public.guardar_config_visita($1, $2::jsonb) c`, [t.g, JSON.stringify(datos)]))[0].c);
  const leer = (usuario) => como(usuario, async () => (await t.q(`select public.config_visita($1) c`, [t.g]))[0].c);
  const r = await guardar(uDueno, { visita_horas: 3, antiprestamo_minutos: 30 });
  assert.deepEqual(r, { visita_horas: 3, antiprestamo_minutos: 30, avisar_en_vivo: true });
  assert.deepEqual(await leer(uRec), r);
  await como(uRec, () => t.falla(() => t.q(`select public.guardar_config_visita($1, '{"visita_horas": 1}'::jsonb)`, [t.g]), /permiso|rol|acceso/i));
  await como(uDueno, () => t.falla(() => t.q(`select public.guardar_config_visita($1, '{"visita_horas": 30}'::jsonb)`, [t.g]), /de 0 a 24/));
  await como(uDueno, () => t.falla(() => t.q(`select public.guardar_config_visita($1, '{"antiprestamo_minutos": -1}'::jsonb)`, [t.g]), /de 0 a 720/));
  await como(uDueno, () => t.falla(() => t.q(`select public.guardar_config_visita($1, '{"otra": 1}'::jsonb)`, [t.g]), /no se pueden cambiar/));
  assert.deepEqual(await leer(uDueno), r, "nada cambió con los errores");
});
