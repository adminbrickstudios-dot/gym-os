// COM-3 (0123): avisar a los anotados de una clase. Un WhatsApp armado por
// persona con {nombre}, {clase} y {dia}; el aviso queda anotado en la clase.
// El profe solo en sus clases y sin teléfonos si el dueño no lo prendió.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir } from "./_comun.mjs";

let t, u = {}, eq = {}, act, clase, otra;
async function persona(rol) {
  const [{ id }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`${rol}${Math.random()}@ejemplo.invalid`]);
  const [{ id: e }] = await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,$3,$4) returning id`, [t.g, id, `P ${rol}`, rol]);
  u[rol] = id; eq[rol] = e;
}
async function como(usuario, fn) {
  await t.db.query("set role authenticated");
  await t.q(`select set_config('request.jwt.claims', $1, false)`, [JSON.stringify({ sub: usuario, role: "authenticated" })]);
  try { return await fn(); } finally { await t.db.query("reset role"); await t.q(`select set_config('request.jwt.claims', '', false)`); }
}
before(async () => {
  t = await abrir("prueba-avisar-clase");
  for (const r of ["dueno", "recepcion", "profe"]) await persona(r);
  [{ id: act }] = await t.q(`insert into public.actividades (gimnasio_id, nombre) values ($1, 'Spinning') returning id`, [t.g]);
  const nueva = async (profe) => (await t.q(`insert into public.clases (gimnasio_id, sede_id, actividad_id, inicio, fin, cupo, profe_id)
    values ($1,$2,$3, now() + interval '1 day', now() + interval '1 day 1 hour', 10, $4) returning id`, [t.g, t.sede, act, profe]))[0].id;
  clase = await nueva(eq.profe); otra = await nueva(null);
  for (const [n, tel] of [["Ana", "+5490001110001"], ["Beto", null]]) {
    const [{ id: s }] = await t.q(`insert into public.socios (gimnasio_id, nombre, apellido, telefono) values ($1,$2,'Aviso',$3) returning id`, [t.g, n, tel]);
    await t.q(`insert into public.reservas (gimnasio_id, clase_id, socio_id, estado) values ($1,$2,$3,'confirmada')`, [t.g, clase, s]);
  }
});
after(async () => t && t.cerrar());

test("la recepción avisa: un mensaje por persona y queda anotado; el profe en la suya, sin teléfonos; vacío no", async () => {
  await como(u.recepcion, async () => {
    const [{ r }] = await t.q(`select public.avisar_clase($1, 'Hola {nombre}! {clase} del {dia} arranca 15 minutos tarde') r`, [clase]);
    const ana = r.mensajes.find((m) => m.nombre === "Ana Aviso");
    assert.match(ana.mensaje, /^Hola Ana! Spinning del \d\d\/\d\d a las \d\d:\d\d arranca 15 minutos tarde$/);
    assert.equal(ana.telefono, "+5490001110001");
    assert.equal(r.mensajes.find((m) => m.nombre === "Beto Aviso").telefono, null);
    const [{ l }] = await t.q(`select public.avisos_clase($1) l`, [clase]);
    assert.equal(l.length, 1); assert.equal(l[0].personas, 2); assert.equal(l[0].por, "P recepcion");
    await t.falla(() => t.q(`select public.avisar_clase($1, '   ')`, [clase]), /Escribí qué/);
  });
  await t.q(`update public.configuracion_gimnasio set profe_ve_telefono = false where gimnasio_id = $1`, [t.g]);
  await como(u.profe, async () => {
    const [{ r }] = await t.q(`select public.avisar_clase($1, 'Hola {nombre}') r`, [clase]);
    assert.ok(r.mensajes.every((m) => m.telefono === null), "el profe sin permiso no ve teléfonos");
    await t.falla(() => t.q(`select public.avisar_clase($1, 'Hola')`, [otra]), /tus clases/);
  });
});
