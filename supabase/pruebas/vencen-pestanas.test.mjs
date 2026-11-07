// VD-14 (20261106004400): vencen_pestanas trae las tres listas con sus totales, calculadas por la base;
// con día fijo el modo dice "día 4 de 10"; la recepción no ve la plata de la cuota; la profe no la pide.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir } from "./_comun.mjs";

let t, u = {}, plan;
before(async () => {
  t = await abrir("prueba-vencen-pestanas");
  for (const rol of ["dueno", "recepcion", "profe"]) {
    const [{ id }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`${rol}${Math.random()}@ejemplo.invalid`]);
    await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,$3,$4)`, [t.g, id, rol, rol]);
    u[rol] = id;
  }
  [{ id: plan }] = await t.q(`select id from public.planes where gimnasio_id = $1 and nombre = 'Plan Full'`, [t.g]);
});
after(async () => t && t.cerrar());

// Un socio cuya cobertura termina a la medianoche del día local (hoy + terminaEn + 1): su último día cubierto es hoy + terminaEn.
async function socio(nombre, terminaEn) {
  const [{ id: s }] = await t.q(`insert into public.socios (gimnasio_id, nombre, apellido) values ($1,$2,'Pestanas') returning id`, [t.g, nombre]);
  const [{ id: su }] = await t.q(`insert into public.suscripciones (gimnasio_id, socio_id, plan_id, inicio) values ($1,$2,$3, now() - interval '60 days') returning id`, [t.g, s, plan]);
  await t.q(`insert into public.coberturas (gimnasio_id, suscripcion_id, socio_id, desde, hasta, origen, motivo)
             values ($1,$2,$3, now() - interval '70 days',
                     privado.medianoche(privado.dia_local(now(), (select zona_horaria from public.gimnasios where id = $1)) + $4::int + 1,
                                        (select zona_horaria from public.gimnasios where id = $1)), 'cortesia', 'vd14')`, [t.g, su, s, terminaEn]);
  return s;
}
const leer = (usuario) => t.comoUsuario(usuario, async () => (await t.q(`select public.vencen_pestanas($1) r`, [t.g]))[0].r);

test("totales por pestaña: cada una suma lo que lista", async () => {
  const antes = await leer(u.dueno);
  const hoy1 = await socio("Hoy Uno", 0), hoy2 = await socio("Hoy Dos", 0);
  const prox = await socio("Proximo", 2);
  const venc = await socio("Vencido", -10);
  const d = await leer(u.dueno);
  const ids = (g) => d[g].filas.map((f) => f.socio_id);
  assert.ok(ids("hoy").includes(hoy1) && ids("hoy").includes(hoy2), "los dos que vencen hoy están en Hoy");
  assert.ok(!ids("hoy").includes(prox) && ids("por_vencer").includes(prox), "el de dentro de 2 días está en Por vencer");
  assert.ok(ids("vencidos").includes(venc) && !ids("hoy").includes(venc), "el vencido está en Vencidos");
  for (const g of ["hoy", "vencidos", "por_vencer"]) assert.equal(d[g].cantidad, d[g].filas.length, `${g}: la cantidad es la de sus filas`);
  assert.equal(d.hoy.cantidad - antes.hoy.cantidad, 2);
  assert.equal(d.por_vencer.cantidad - antes.por_vencer.cantidad, 1);
  assert.equal(d.vencidos.cantidad - antes.vencidos.cantidad, 1);
  // La plata de Hoy es la suma de lo que paga cada uno por mes; la de Vencidos, la suma de lo que debe cada uno.
  const suma = (g, c) => d[g].filas.reduce((a, f) => a + Number(f[c] ?? 0), 0);
  assert.equal(Number(d.hoy.plata), suma("hoy", "monto_mensual"));
  assert.equal(Number(d.por_vencer.plata), suma("por_vencer", "monto_mensual"));
  assert.equal(Number(d.vencidos.plata), suma("vencidos", "debe"));
  assert.equal(Number(d.hoy.plata) - Number(antes.hoy.plata), 50000, "dos cuotas de 25.000");
  assert.equal(Number(d.vencidos.plata) - Number(antes.vencidos.plata), 25000, "el vencido debe una cuota");
});

test("la recepción ve cantidades y lo que debe cada vencido, nunca lo que paga cada uno", async () => {
  const d = await leer(u.recepcion);
  assert.equal(d.hoy.plata, null);
  assert.equal(d.por_vencer.plata, null);
  assert.ok(d.hoy.filas.every((f) => f.monto_mensual == null));
  assert.ok(d.por_vencer.filas.every((f) => f.monto_mensual == null));
  assert.ok(d.vencidos.plata != null);
});

test("la profe no la pide", async () => {
  await t.comoUsuario(u.profe, () => t.falla(() => t.q(`select public.vencen_pestanas($1)`, [t.g]), /permiso|rol|acceso/i));
});

test("el modo de cobro: con día fijo, 'día 4 de 10'; sin configurar, cuota continua", async () => {
  const [{ r: t4 }] = await t.q(`select privado.periodo_pago('dia_fijo', 10, date '2026-11-04') r`);
  assert.equal(t4.texto, "Período de pago, día 4 de 10");
  assert.equal(t4.pasado, false);
  const [{ r: t12 }] = await t.q(`select privado.periodo_pago('dia_fijo', 10, date '2026-11-12') r`);
  assert.equal(t12.pasado, true);
  assert.match(t12.texto, /ya pasó/);
  const [{ r: dp }] = await t.q(`select privado.periodo_pago('desde_pago', null, date '2026-11-04') r`);
  assert.match(dp.texto, /desde el día que se paga/);
  const sin = await leer(u.dueno);
  assert.equal(sin.modo.renovacion, "continua");
  await t.q(`insert into public.configuracion_vencimiento (gimnasio_id, renovacion, dia_fijo) values ($1,'dia_fijo',10)
             on conflict (gimnasio_id) do update set renovacion = 'dia_fijo', dia_fijo = 10`, [t.g]);
  const con = await leer(u.dueno);
  assert.equal(con.modo.dia_fijo, 10);
  assert.match(con.modo.texto, /^Período de pago, día \d+ de 10$|ya pasó/);
});
