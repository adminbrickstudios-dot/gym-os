// COM-13 (0133): grados y cinturones. El dueño arma los grados de una
// actividad con requisitos; "listos para rendir" sale de las asistencias y el
// tiempo desde el grado actual; el profe otorga; el socio ve el suyo.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir } from "./_comun.mjs";

let t, u = {}, eq = {}, act, socio, us, otro;
async function como(usuario, fn) {
  await t.db.query("set role authenticated");
  await t.q(`select set_config('request.jwt.claims', $1, false)`, [JSON.stringify({ sub: usuario, role: "authenticated" })]);
  try { return await fn(); } finally { await t.db.query("reset role"); await t.q(`select set_config('request.jwt.claims', '', false)`); }
}
async function asistio(s, haceDias) {
  const [{ id: c }] = await t.q(`insert into public.clases (gimnasio_id, sede_id, actividad_id, inicio, fin)
    values ($1,$2,$3, now() - make_interval(days => $4), now() - make_interval(days => $4) + interval '1 hour') returning id`, [t.g, t.sede, act, haceDias]);
  await t.q(`insert into public.asistencias (gimnasio_id, clase_id, socio_id) values ($1,$2,$3)`, [t.g, c, s]);
}
before(async () => {
  t = await abrir("prueba-grados");
  for (const rol of ["dueno", "recepcion", "profe"]) {
    const [{ id }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`${rol}${Math.random()}@ejemplo.invalid`]);
    const [{ id: e }] = await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,$3,$4) returning id`, [t.g, id, `P ${rol}`, rol]);
    u[rol] = id; eq[rol] = e;
  }
  [{ id: act }] = await t.q(`insert into public.actividades (gimnasio_id, nombre) values ($1, 'Judo') returning id`, [t.g]);
  [{ id: us }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`judoka${Math.random()}@ejemplo.invalid`]);
  [{ id: socio }] = await t.q(`insert into public.socios (gimnasio_id, nombre, apellido, usuario_id) values ($1,'Kano','Grado',$2) returning id`, [t.g, us]);
  [{ id: otro }] = await t.q(`insert into public.socios (gimnasio_id, nombre, apellido) values ($1,'Nuevo','Grado') returning id`, [t.g]);
  // Kano: 5 clases en los últimos 4 meses. Nuevo: 1 clase ayer.
  for (const d of [120, 90, 60, 30, 2]) await asistio(socio, d);
  await asistio(otro, 1);
});
after(async () => t && t.cerrar());

test("armar grados, listos para rendir, otorgar, el socio ve su progreso", async () => {
  let blanco, amarillo;
  await como(u.profe, () => t.falla(() => t.q(`select public.guardar_grado($1, null, 'Blanco', 1)`, [act]), /permiso|rol|acceso/i));
  await como(u.dueno, async () => {
    [{ id: blanco }] = await t.q(`select public.guardar_grado($1, null, 'Cinturón blanco', 1, 0, 0, '#ffffff') id`, [act]);
    [{ id: amarillo }] = await t.q(`select public.guardar_grado($1, null, 'Cinturón amarillo', 2, 4, 3) id`, [act]);
    await t.falla(() => t.q(`select public.guardar_grado($1, null, 'Otro', 2)`, [act]), /Ya hay un grado con el número 2 en Judo/);
  });
  // Sin grado: el próximo es el blanco (sin requisitos), así que los dos están listos.
  await como(u.recepcion, async () => {
    const [{ p }] = await t.q(`select public.grados_panel($1) p`, [t.g]);
    const judo = p.actividades.find((a) => a.actividad_id === act);
    assert.deepEqual(judo.grados.map((g) => g.nombre), ["Cinturón blanco", "Cinturón amarillo"]);
    assert.equal(p.listos.filter((l) => l.actividad_id === act).length, 2);
    await t.falla(() => t.q(`select public.otorgar_grado($1, $2)`, [socio, blanco]), /permiso|rol|acceso/i);
  });
  // El profe le da el blanco a Kano hace 4 meses: desde ahí, 4 clases y 4 meses → listo para el amarillo.
  await como(u.profe, async () => {
    const hace = (await t.q(`select ((now() - interval '125 days') at time zone 'America/Argentina/Buenos_Aires')::date::text d`))[0].d;
    await t.q(`select public.otorgar_grado($1, $2, $3::date)`, [socio, blanco, hace]);
    await t.falla(() => t.q(`select public.otorgar_grado($1, $2)`, [socio, blanco]), /Ya tiene Cinturón blanco/);
    await t.falla(() => t.q(`select public.otorgar_grado($1, $2, (current_date + 5))`, [socio, amarillo]), /futura/);
    const [{ p }] = await t.q(`select public.grados_panel($1) p`, [t.g]);
    const kano = p.listos.find((l) => l.socio_id === socio);
    assert.equal(kano.actual.nombre, "Cinturón blanco");
    assert.equal(kano.proximo.nombre, "Cinturón amarillo");
    assert.ok(kano.clases >= 4 && kano.meses >= 3, JSON.stringify(kano));
  });
  // Con más requisitos, ya no está listo.
  await como(u.dueno, () => t.q(`select public.guardar_grado($1, $2, 'Cinturón amarillo', 2, 20, 3)`, [act, amarillo]));
  await como(us, async () => {
    const [{ g }] = await t.q(`select public.grados_socio($1) g`, [socio]);
    const judo = g.find((x) => x.actividad_id === act);
    assert.equal(judo.actual.nombre, "Cinturón blanco");
    assert.equal(judo.proximo.clases_minimas, 20);
    assert.equal(judo.listo, false);
    assert.equal(judo.historial.length, 1);
    await t.falla(() => t.q(`select public.grados_socio($1)`, [otro]), /permiso|rol|acceso|Sin permiso/i);
  });
  // El amarillo otorgado y anulado: vuelve al blanco.
  const [{ id: x }] = await como(u.profe, () => t.q(`select public.otorgar_grado($1, $2) id`, [socio, amarillo]));
  await como(u.profe, () => t.falla(() => t.q(`select public.anular_grado_socio($1, 'Error de carga')`, [x]), /permiso|rol|acceso/i));
  await como(u.dueno, async () => {
    await t.q(`select public.anular_grado_socio($1, 'Error de carga')`, [x]);
    const [{ g }] = await t.q(`select public.grados_socio($1) g`, [socio]);
    assert.equal(g.find((y) => y.actividad_id === act).actual.nombre, "Cinturón blanco");
  });
});
