// COM-2 (0122): el primer mes del socio nuevo. Ficha "día N de 30 · entradas
// (meta)"; Avisos de hoy con bienvenida (día 1), primera semana (día 7) y
// primer mes (día 30); En riesgo si en la primera semana vino menos de 2
// veces; la meta se configura (1 a 60).
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir } from "./_comun.mjs";

let t, u = {}, plan;
before(async () => {
  t = await abrir("prueba-primer-mes");
  for (const rol of ["dueno", "recepcion"]) {
    const [{ id }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`${rol}${Math.random()}@ejemplo.invalid`]);
    await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,$3,$4)`, [t.g, id, rol, rol]);
    u[rol] = id;
  }
  [{ id: plan }] = await t.q(`insert into public.planes (gimnasio_id, tipo, nombre, duracion_meses, renovacion) values ($1,'membresia','Nuevo',1,'continua') returning id`, [t.g]);
});
after(async () => t && t.cerrar());

async function nuevo(nombre, haceDias, entradasHaceDias = []) {
  const [{ id: s }] = await t.q(`insert into public.socios (gimnasio_id, nombre, apellido) values ($1,$2,'Nuevo') returning id`, [t.g, nombre]);
  const [{ id: su }] = await t.q(`insert into public.suscripciones (gimnasio_id, socio_id, plan_id, inicio) values ($1,$2,$3, now() - make_interval(days => $4)) returning id`, [t.g, s, plan, haceDias]);
  await t.q(`insert into public.coberturas (gimnasio_id, suscripcion_id, socio_id, desde, hasta, origen, motivo)
             values ($1,$2,$3, now() - make_interval(days => $4), now() + interval '20 days', 'cortesia', 'nuevo')`, [t.g, su, s, haceDias]);
  for (const d of entradasHaceDias) await t.q(`insert into public.ingresos (gimnasio_id, sede_id, socio_id, momento, via_acceso, resultado, color, motivo, texto)
      values ($1,$2,$3, now() - make_interval(days => $4), 'recepcion', 'entro', 'verde', 'al_dia', 'Al día')`, [t.g, t.sede, s, d]);
  return s;
}

test("ficha, avisos de los días 1, 7 y 30, riesgo de la primera semana y la meta configurable", async () => {
  const hoy = await nuevo("Hoy", 0);
  const tres = await nuevo("Tres", 3, [2]);
  const ocho = await nuevo("Ocho", 8, [7]);
  const treinta = await nuevo("Treinta", 31, [30, 25, 20]);
  await t.comoUsuario(u.recepcion, async () => {
    const [{ r: f }] = await t.q(`select public.primer_mes_socio($1) r`, [tres]);
    assert.deepEqual({ dia: f.dia, de: f.de, entradas: f.entradas, meta: f.meta }, { dia: 4, de: 30, entradas: 1, meta: 8 });
    const [{ r: viejo }] = await t.q(`select public.primer_mes_socio($1) r`, [treinta]);
    assert.equal(viejo, null, "pasados los 30 días, la ficha no lo muestra");
    const [{ r: bandeja }] = await t.q(`select public.bandeja_avisos($1) r`, [t.g]);
    const clave = (id) => bandeja.find((b) => b.socio_id === id)?.clave;
    assert.equal(clave(hoy), "bienvenida");
    assert.equal(clave(ocho), "primera_semana");
    assert.match(bandeja.find((b) => b.socio_id === ocho).mensaje, /Viniste 1 vez\./);
    assert.equal(clave(treinta), "primer_mes");
    assert.equal(clave(tres), undefined, "el día 4 no hay mensaje");
    await t.q(`select public.marcar_avisado($1, 'primera_semana', $2)`, [ocho, bandeja.find((b) => b.socio_id === ocho).referencia]);
    const [{ r: riesgo }] = await t.q(`select public.riesgo_baja($1) r`, [t.g]);
    assert.match(riesgo.find((x) => x.socio_id === ocho)?.porque.join(" ") ?? "", /Primera semana: vino 1 vez \(la meta del mes es 8\)/);
    assert.equal(riesgo.find((x) => x.socio_id === tres), undefined, "antes del día 7 no se juzga la primera semana");
  });
  await t.comoUsuario(u.dueno, async () => {
    await t.falla(() => t.q(`select public.guardar_configuracion($1, '{"meta_primer_mes": 70}')`, [t.g]), /entre 1 y 60/);
    await t.q(`select public.guardar_configuracion($1, '{"meta_primer_mes": 10}')`, [t.g]);
    const [{ c }] = await t.q(`select public.configuracion_panel($1) c`, [t.g]);
    assert.equal(c.meta_primer_mes, 10);
  });
});
