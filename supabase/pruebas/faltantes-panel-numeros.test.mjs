// F5.1 (migración 202611090407): tasa de cobro (FA-10), fotos de los anotados (FA-11), diferencia de caja por cajero (FA-21).
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir } from "./_comun.mjs";

let t, dueno, recepcion, equipoDueno, equipoRecep;
before(async () => {
  t = await abrir("prueba-faltantes-panel");
  for (const rol of ["dueno", "recepcion"]) {
    const [{ id }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`${rol}${Math.random()}@ejemplo.invalid`]);
    const [{ id: eid }] = await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,$3,$4) returning id`, [t.g, id, rol === "dueno" ? "Sofía" : "Ana", rol]);
    if (rol === "dueno") { dueno = id; equipoDueno = eid; } else { recepcion = id; equipoRecep = eid; }
  }
});
after(async () => t && t.cerrar());

test("FA-10: de los que se les vencía la cuota este mes, cuántos renovaron; con la lista de los que faltan; solo dueño y encargado", async () => {
  const [{ plan }] = await t.q(`select id as plan from public.planes where gimnasio_id = $1 and tipo = 'membresia' limit 1`, [t.g]);
  const socio = async (nombre) => (await t.q(`insert into public.socios (gimnasio_id, nombre, apellido, telefono) values ($1,$2,'Tasa','+5490000555${Math.floor(Math.random() * 900 + 100)}') returning id`, [t.g, nombre]))[0].id;
  const suscripcion = async (s) => (await t.q(`insert into public.suscripciones (gimnasio_id, socio_id, plan_id, inicio) values ($1,$2,$3, now() - interval '60 days') returning id`, [t.g, s, plan]))[0].id;
  const cobertura = (sus, s, desde, hasta) => t.q(`insert into public.coberturas (gimnasio_id, suscripcion_id, socio_id, desde, hasta, origen, motivo) values ($1,$2,$3, now() + $4::interval, now() + $5::interval, 'importacion', 'prueba')`, [t.g, sus, s, desde, hasta]);
  // Mes de prueba: el de hoy. Vencieron hace 1 hora (dentro del mes salvo el 1° de madrugada: se corre el mes con p_mes).
  const mes = (await t.q(`select date_trunc('month', now() - interval '2 hours')::date m`))[0].m;
  const a = await socio("Renovó"), b = await socio("NoRenovó");
  const sa = await suscripcion(a), sb = await suscripcion(b);
  await cobertura(sa, a, "-30 days", "-2 hours"); await cobertura(sa, a, "-2 hours", "30 days");   // renovó: cubierto más allá del vencimiento
  await cobertura(sb, b, "-30 days", "-2 hours");                                                    // no renovó
  await t.comoUsuario(dueno, async () => {
    const [{ r }] = await t.q(`select public.tasa_de_cobro($1, $2) r`, [t.g, mes]);
    const mios = r.pendientes.filter((p) => /Tasa/.test(p.nombre));
    assert.deepEqual(mios.map((p) => p.nombre), ["NoRenovó Tasa"], "los que faltan: solo el que no renovó");
    assert.ok(r.tocaba >= 2 && r.renovaron >= 1 && r.renovaron < r.tocaba);
    assert.equal(Number(r.tasa), Math.round((1000 * r.renovaron) / r.tocaba) / 10);
  });
  await t.comoUsuario(recepcion, () => t.falla(() => t.q(`select public.tasa_de_cobro($1)`, [t.g]), /Sin permiso/));
});

test("FA-11: la clase devuelve la foto de cada anotado que la tiene", async () => {
  const [{ id: act }] = await t.q(`insert into public.actividades (gimnasio_id, nombre) values ($1,'Funcional') returning id`, [t.g]);
  const [{ id: clase }] = await t.q(`insert into public.clases (gimnasio_id, sede_id, actividad_id, inicio, fin) values ($1,$2,$3, now() + interval '1 hour', now() + interval '2 hours') returning id`, [t.g, t.sede, act]);
  const [{ id: con }] = await t.q(`insert into public.socios (gimnasio_id, nombre, apellido, telefono, foto_path) values ($1,'Con','Foto','+5490000777001', 'g/s/0123456789abcdef0123456789abcdef.jpg') returning id`, [t.g]);
  const [{ id: sin }] = await t.q(`insert into public.socios (gimnasio_id, nombre, apellido, telefono) values ($1,'Sin','Foto','+5490000777002') returning id`, [t.g]);
  for (const s of [con, sin]) await t.q(`insert into public.reservas (gimnasio_id, clase_id, socio_id, estado) values ($1,$2,$3,'confirmada')`, [t.g, clase, s]);
  await t.comoUsuario(recepcion, async () => {
    const [{ r }] = await t.q(`select public.fotos_de_clase($1) r`, [clase]);
    assert.equal(r.length, 1);
    assert.equal(r[0].socio_id, con);
    assert.equal(r[0].version, "0123456789abcdef0123456789abcdef");
  });
});

test("FA-21: lo que faltó y sobró de cada cajero, acumulado; no cuenta lo sin contar; la recepción no lo ve", async () => {
  const [{ id: caja }] = await t.q(`select id from public.cajas where gimnasio_id = $1 limit 1`, [t.g]).then((r) => r.length ? r : t.q(`insert into public.cajas (gimnasio_id, sede_id, nombre) values ($1,$2,'Caja') returning id`, [t.g, t.sede]));
  const turno = (esperado, contado) => t.q(
    `insert into public.turnos_caja (gimnasio_id, caja_id, abierto_por, abierto_en, monto_inicial, cerrado_en, cerrado_por, monto_contado, monto_esperado)
     values ($1,$2,$3, now() - interval '5 hours', 0, now() - interval '1 hour', $3, $4, $5)`, [t.g, caja, equipoRecep, contado, esperado]);
  await turno(1000, 900);    // faltaron 100
  await turno(2000, 2050);   // sobraron 50
  await turno(500, 500);
  await t.comoUsuario(dueno, async () => {
    const [{ r }] = await t.q(`select public.diferencia_caja_por_cajero($1, 30) r`, [t.g]);
    const ana = r.find((x) => x.cajero === "Ana");
    assert.equal(ana.turnos, 3);
    assert.equal(Number(ana.diferencia), -50);
    assert.equal(Number(ana.faltante), 100);
    assert.equal(Number(ana.sobrante), 50);
    assert.equal(ana.con_diferencia, 2);
    await t.falla(() => t.q(`select public.diferencia_caja_por_cajero($1, 0)`, [t.g]), /1 a 366/);
  });
  await t.comoUsuario(recepcion, () => t.falla(() => t.q(`select public.diferencia_caja_por_cajero($1)`, [t.g]), /Sin permiso/));
});

test("FA-9: de los socios elegidos, devuelve a los que NO se les escribe; la recepción puede; otro gimnasio no", async () => {
  const [{ id: a }] = await t.q(`insert into public.socios (gimnasio_id, nombre, apellido, telefono) values ($1,'Sí','Escribir','+5490000888001') returning id`, [t.g]);
  const [{ id: b }] = await t.q(`insert into public.socios (gimnasio_id, nombre, apellido, telefono, no_escribirle_en, no_escribirle_motivo) values ($1,'No','Escribir','+5490000888002', now(), 'lo pidió') returning id`, [t.g]);
  await t.comoUsuario(recepcion, async () => {
    const [{ r }] = await t.q(`select public.no_escribirles_de($1, $2::uuid[]) r`, [t.g, [a, b]]);
    assert.deepEqual(r, [b]);
  });
  const [{ id: g2 }] = await t.q(`insert into public.gimnasios (slug, nombre) values ('otro-lote', 'Otro') returning id`);
  await t.comoUsuario(recepcion, () => t.falla(() => t.q(`select public.no_escribirles_de($1, $2::uuid[])`, [g2, [a]]), /Sin permiso/));
});
