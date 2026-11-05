// COM-5 (0125): retención en números con sus nombres: altas y bajas del mes,
// los que se anotaron hace 3 meses y siguen, y los al día con pocas visitas.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir } from "./_comun.mjs";

let t, u = {}, plan;
before(async () => {
  t = await abrir("prueba-retencion-numeros");
  for (const rol of ["dueno", "recepcion"]) {
    const [{ id }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`${rol}${Math.random()}@ejemplo.invalid`]);
    await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,$3,$4)`, [t.g, id, rol, rol]);
    u[rol] = id;
  }
  [{ id: plan }] = await t.q(`insert into public.planes (gimnasio_id, tipo, nombre, duracion_meses, renovacion) values ($1,'membresia','Num',1,'continua') returning id`, [t.g]);
});
after(async () => t && t.cerrar());

async function socio(nombre, creado, { cubre = false, baja = null, vino = 0 } = {}) {
  const [{ id: s }] = await t.q(`insert into public.socios (gimnasio_id, nombre, apellido, creado_en, dado_de_baja_en, motivo_baja)
     values ($1,$2,'Num',$3::timestamptz,$4::timestamptz, case when $4::timestamptz is null then null else 'precio' end) returning id`, [t.g, nombre, creado, baja]);
  if (cubre) {
    const [{ id: su }] = await t.q(`insert into public.suscripciones (gimnasio_id, socio_id, plan_id, inicio) values ($1,$2,$3,$4::timestamptz) returning id`, [t.g, s, plan, creado]);
    await t.q(`insert into public.coberturas (gimnasio_id, suscripcion_id, socio_id, desde, hasta, origen, motivo)
               values ($1,$2,$3, now() - interval '5 days', now() + interval '20 days', 'cortesia', 'num')`, [t.g, su, s]);
  }
  for (let i = 0; i < vino; i++) await t.q(`insert into public.ingresos (gimnasio_id, sede_id, socio_id, momento, via_acceso, resultado, color, motivo, texto)
     values ($1,$2,$3, now() - make_interval(days => $4), 'recepcion', 'entro', 'verde', 'al_dia', 'Al día')`, [t.g, t.sede, s, i + 1]);
  return s;
}

test("los números con sus nombres; la recepción no", async () => {
  const hace3 = (await t.q(`select (date_trunc('month', now() at time zone 'America/Argentina/Buenos_Aires') - interval '3 months' + interval '10 days')::text d`))[0].d;
  const [{ ahora, viejo }] = await t.q(`select now()::text ahora, (now() - interval '200 days')::text viejo`);
  const alta = await socio("Alta", ahora);
  const baja = await socio("Baja", viejo, { baja: ahora });
  const sigue = await socio("Sigue", hace3, { cubre: true, vino: 8 });
  const sefue = await socio("Sefue", hace3);
  const poco = await socio("Poco", viejo, { cubre: true, vino: 1 });
  await t.comoUsuario(u.dueno, async () => {
    const [{ r }] = await t.q(`select public.retencion_numeros($1) r`, [t.g]);
    const ids = (l) => l.map((x) => x.socio_id);
    assert.ok(ids(r.altas).includes(alta)); assert.ok(ids(r.bajas).includes(baja));
    assert.equal(r.bajas.find((x) => x.socio_id === baja).motivo, "precio");
    assert.ok(ids(r.cohorte.siguen).includes(sigue)); assert.ok(ids(r.cohorte.se_fueron).includes(sefue));
    assert.ok(r.cohorte.entraron >= 2);
    assert.ok(ids(r.pocas.lista).includes(poco)); assert.ok(!ids(r.pocas.lista).includes(sigue));
    assert.equal(r.pocas.lista.find((x) => x.socio_id === poco).dias, 1);
  });
  await t.comoUsuario(u.recepcion, () => t.falla(() => t.q(`select public.retencion_numeros($1)`, [t.g]), /permiso|rol|acceso/i));
});
