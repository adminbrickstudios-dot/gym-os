// Deshacer un presente (0082): con motivo; la clase del pack vuelve; el profe
// solo en sus clases; otro gimnasio no; dos veces no.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir } from "./_comun.mjs";

let t, u = {}, socio, clase, otraClase;
async function persona(rol, nombre) {
  const [{ id }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`${rol}${Math.random()}@ejemplo.invalid`]);
  const [{ id: eid }] = await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,$3,$4) returning id`, [t.g, id, nombre, rol]);
  return { id, eid };
}
async function como(usuario, fn) {
  await t.db.query("set role authenticated");
  await t.q(`select set_config('request.jwt.claims', $1, false)`, [JSON.stringify({ sub: usuario, role: "authenticated" })]);
  try { return await fn(); } finally { await t.db.query("reset role"); await t.q(`select set_config('request.jwt.claims', '', false)`); }
}
before(async () => {
  t = await abrir("prueba-anular-presente");
  u.recepcion = await persona("recepcion", "Ana"); u.profe = await persona("profe", "Diego"); u.otroProfe = await persona("profe", "Otro");
  [{ id: socio }] = await t.q(`select id from public.socios where gimnasio_id = $1 and nombre = 'Testigo' and apellido = 'Al Día'`, [t.g]);
  const [{ id: act }] = await t.q(`insert into public.actividades (gimnasio_id, nombre) values ($1, 'Yoga') returning id`, [t.g]);
  [{ id: clase }] = await t.q(`insert into public.clases (gimnasio_id, sede_id, actividad_id, inicio, fin, profe_id) values ($1,$2,$3, now() - interval '30 minutes', now() + interval '30 minutes', $4) returning id`, [t.g, t.sede, act, u.profe.eid]);
  [{ id: otraClase }] = await t.q(`insert into public.clases (gimnasio_id, sede_id, actividad_id, inicio, fin, profe_id) values ($1,$2,$3, now() - interval '20 minutes', now() + interval '40 minutes', $4) returning id`, [t.g, t.sede, act, u.otroProfe.eid]);
  await t.q(`insert into public.asistencias (gimnasio_id, clase_id, socio_id) values ($1,$2,$3), ($1,$4,$3)`, [t.g, clase, socio, otraClase]);
});
after(async () => t && t.cerrar());

test("el profe deshace en su clase, con motivo; no en la de otro; dos veces no", async () => {
  await como(u.profe.id, () => t.falla(() => t.q(`select public.anular_presente($1, $2, '  ')`, [clase, socio]), /motivo es obligatorio/));
  await como(u.profe.id, () => t.q(`select public.anular_presente($1, $2, 'Lo marqué por error')`, [clase, socio]));
  const [{ m }] = await t.q(`select anulada_motivo m from public.asistencias where clase_id = $1 and socio_id = $2`, [clase, socio]);
  assert.equal(m, "Lo marqué por error");
  await como(u.profe.id, () => t.falla(() => t.q(`select public.anular_presente($1, $2, 'x')`, [clase, socio]), /No tiene presente/));
  await como(u.profe.id, () => t.falla(() => t.q(`select public.anular_presente($1, $2, 'x')`, [otraClase, socio]), /tus clases/));
  await como(u.recepcion.id, () => t.q(`select public.anular_presente($1, $2, 'Se fue antes')`, [otraClase, socio]));
});
