// BASE-7 (migración 202611090400): los 9 pasos del asistente salen de los hechos, incluidos el 6 (entrada) y el 7 (clases y profes).
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir } from "./_comun.mjs";

let t, dueno, recepcion;
before(async () => {
  t = await abrir("prueba-asistente-pasos");
  for (const rol of ["dueno", "recepcion"]) {
    const [{ id }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`${rol}${Math.random()}@ejemplo.invalid`]);
    await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,$3,$4)`, [t.g, id, rol, rol]);
    if (rol === "dueno") dueno = id; else recepcion = id;
  }
});
after(async () => t && t.cerrar());
const pasos = async () => (await t.q(`select public.pasos_asistente($1) p`, [t.g]))[0].p;
const paso = (p, clave) => p.find((x) => x.clave === clave);

test("devuelve los 9 pasos en orden; solo el dueño los ve", async () => {
  await t.comoUsuario(dueno, async () => {
    const p = await pasos();
    assert.deepEqual(p.map((x) => x.n), [1, 2, 3, 4, 5, 6, 7, 8, 9]);
    assert.deepEqual(p.map((x) => x.clave), ["gimnasio", "marca", "horarios", "planes", "cobros", "entrada_modos", "clases_profes", "equipo", "socios"]);
  });
  await t.comoUsuario(recepcion, () => t.falla(() => pasos(), /Sin permiso/));
});

test("paso 6: se mide cuando el dueño cambia una regla de entrada", async () => {
  await t.comoUsuario(dueno, async () => {
    assert.equal(paso(await pasos(), "entrada_modos").hecho, false, "recién creado: sin tocar nada");
    const [{ c }] = await t.q(`select public.configuracion_panel($1) as c`, [t.g]);
    await t.q(`select public.guardar_configuracion($1, $2)`, [t.g, { tolerancia_dias: c.tolerancia_dias + 2 }]);
    assert.equal(paso(await pasos(), "entrada_modos").hecho, true);
  });
});

test("paso 7: sin clases no aplica; con clases pide un horario y un profe activo", async () => {
  const dueno_ = (fn) => t.comoUsuario(dueno, fn);
  await dueno_(async () => {
    const sin = paso(await pasos(), "clases_profes");
    assert.deepEqual([sin.hecho, sin.no_aplica], [true, true]);
  });
  await t.q(`update public.configuracion_gimnasio set modo_clases = 'reserva' where gimnasio_id = $1`, [t.g]);
  const [{ id: act }] = await t.q(`insert into public.actividades (gimnasio_id, nombre) values ($1,'Funcional') returning id`, [t.g]);
  const [{ id: u }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`profe${Math.random()}@ejemplo.invalid`]);
  const [{ id: profe }] = await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol, activo) values ($1,$2,'Profe','profe',false) returning id`, [t.g, u]);
  const estado = () => dueno_(async () => { const c = paso(await pasos(), "clases_profes"); return [c.hecho, c.no_aplica]; });
  assert.deepEqual(await estado(), [false, false], "da clases y no hay nada cargado");
  await t.q(`insert into public.horarios_clase (gimnasio_id, sede_id, actividad_id, dia_semana, hora_inicio, duracion_min, cupo, profe_id) values ($1,$2,$3,1,'19:00',60,10,$4)`, [t.g, t.sede, act, profe]);
  assert.deepEqual(await estado(), [false, false], "hay horario pero el profe no está activo");
  await t.q(`update public.equipo set activo = true where id = $1`, [profe]);
  assert.deepEqual(await estado(), [true, false]);
});
