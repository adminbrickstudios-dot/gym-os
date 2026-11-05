// RUT-1 (0103): ejercicios (nombre único activo, grupo, video https) y
// rutinas plantilla por días; las arman dueño, encargado y profe; la
// recepción no; guardar reemplaza los ejercicios; archivar la saca.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir } from "./_comun.mjs";

let t, u = {}, sentadilla, remo;
before(async () => {
  t = await abrir("prueba-rutinas");
  for (const rol of ["profe", "recepcion"]) {
    const [{ id }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`${rol}${Math.random()}@ejemplo.invalid`]);
    await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,$3,$4)`, [t.g, id, rol, rol]);
    u[rol] = id;
  }
});
after(async () => t && t.cerrar());
const ej = (nombre, grupo, video = null) => t.q(`select public.guardar_ejercicio($1, null, $2, $3, $4) id`, [t.g, nombre, grupo, video]).then((r) => r[0].id);

test("ejercicios: el profe los carga; nombre único, grupo y video con https", async () => {
  await t.comoUsuario(u.profe, async () => {
    sentadilla = await ej("Sentadilla", "piernas", "https://ejemplo.invalid/video");
    remo = await ej("Remo con barra", "espalda");
    await t.falla(() => ej("sentadilla", "piernas"), /Ya hay un ejercicio/);
    await t.falla(() => ej("Press", "pecho", "http://inseguro.invalid"), /https/);
    await t.falla(() => ej("Press", "lesion"), /grupo muscular/);
  });
  await t.comoUsuario(u.recepcion, () => t.falla(() => ej("Plancha", "core"), /permiso|rol|acceso/i));
});

test("rutina por días; guardar de nuevo reemplaza; archivar la saca", async () => {
  await t.comoUsuario(u.profe, async () => {
    sentadilla = await ej("Sentadilla", "piernas"); remo = await ej("Remo con barra", "espalda");
    const items = [{ dia: 1, ejercicio_id: sentadilla, series: 4, repeticiones: "8-10" }, { dia: 1, ejercicio_id: remo, series: 3, repeticiones: "12" },
                   { dia: 2, ejercicio_id: remo, series: 5, repeticiones: "5", nota: "Pesado" }];
    const [{ id }] = await t.q(`select public.guardar_rutina($1, null, 'Fuerza 2 días', null, $2) id`, [t.g, JSON.stringify(items)]);
    const [{ d }] = await t.q(`select public.rutina_detalle($1) d`, [id]);
    assert.deepEqual(d.items.map((x) => [x.dia, x.orden, x.ejercicio, x.series, x.repeticiones]),
      [[1, 1, "Sentadilla", 4, "8-10"], [1, 2, "Remo con barra", 3, "12"], [2, 1, "Remo con barra", 5, "5"]]);
    await t.q(`select public.guardar_rutina($1, $2, 'Fuerza 1 día', null, $3)`, [t.g, id, JSON.stringify([items[0]])]);
    const [{ l }] = await t.q(`select public.rutinas_gimnasio($1) l`, [t.g]);
    assert.deepEqual(l.map((r) => [r.nombre, r.dias, r.ejercicios]), [["Fuerza 1 día", 1, 1]]);
    await t.falla(() => t.q(`select public.guardar_rutina($1, null, 'Vacía', null, '[]')`, [t.g]), /al menos un ejercicio/);
    await t.falla(() => t.q(`select public.guardar_rutina($1, null, 'Mala', null, $2)`, [t.g, JSON.stringify([{ dia: 9, ejercicio_id: remo, series: 3, repeticiones: "10" }])]), /1 al 7/);
    await t.q(`select public.archivar_rutina($1)`, [id]);
    assert.deepEqual((await t.q(`select public.rutinas_gimnasio($1) l`, [t.g]))[0].l, []);
  });
});
