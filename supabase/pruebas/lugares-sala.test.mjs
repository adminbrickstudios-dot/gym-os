// COM-12 (0132): lugar puntual en la sala. El dueño numera la sala (con uno
// fuera de servicio); cada socio con reserva confirmada elige el suyo; dos
// no pueden tener el mismo: no hay chequeo previo en la función, el que lo
// frena es el índice único (así vale también si tocan a la vez); cancelar lo libera.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir } from "./_comun.mjs";

let t, u = {}, eq = {}, act, clase, ajena, socios = {}, reservas = {};
async function como(usuario, fn) {
  await t.db.query("set role authenticated");
  await t.q(`select set_config('request.jwt.claims', $1, false)`, [JSON.stringify({ sub: usuario, role: "authenticated" })]);
  try { return await fn(); } finally { await t.db.query("reset role"); await t.q(`select set_config('request.jwt.claims', '', false)`); }
}
before(async () => {
  t = await abrir("prueba-lugares");
  for (const rol of ["dueno", "recepcion", "profe"]) {
    const [{ id }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`${rol}${Math.random()}@ejemplo.invalid`]);
    const [{ id: e }] = await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,$3,$4) returning id`, [t.g, id, rol, rol]);
    u[rol] = id; eq[rol] = e;
  }
  [{ id: act }] = await t.q(`insert into public.actividades (gimnasio_id, nombre) values ($1, 'Spinning') returning id`, [t.g]);
  const nueva = async (profe) => (await t.q(`insert into public.clases (gimnasio_id, sede_id, actividad_id, inicio, fin, cupo, profe_id)
    values ($1,$2,$3, now() + interval '1 day', now() + interval '1 day 1 hour', 10, $4) returning id`, [t.g, t.sede, act, profe]))[0].id;
  clase = await nueva(eq.profe); ajena = await nueva(null);
  for (const n of ["Ana", "Beto", "Caro"]) {
    const [{ id: us }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`${n}${Math.random()}@ejemplo.invalid`]);
    const [{ id: s }] = await t.q(`insert into public.socios (gimnasio_id, nombre, apellido, usuario_id) values ($1,$2,'Lugar',$3) returning id`, [t.g, n, us]);
    socios[n] = { id: s, us };
    reservas[n] = (await t.q(`insert into public.reservas (gimnasio_id, clase_id, socio_id, estado) values ($1,$2,$3,$4) returning id`,
      [t.g, clase, s, n === "Caro" ? "espera" : "confirmada"]))[0].id;
  }
});
after(async () => t && t.cerrar());

test("numerar la sala, elegir, no repetir, fuera de servicio, cancelar libera", async () => {
  await como(socios.Ana.us, async () => {
    const [{ m }] = await t.q(`select public.lugares_clase($1, $2) m`, [clase, socios.Ana.id]);
    assert.equal(m, null, "sin sala numerada no hay mapa");
    await t.falla(() => t.q(`select public.elegir_lugar($1, 3)`, [reservas.Ana]), /no tiene lugares numerados/);
  });
  await como(u.recepcion, () => t.falla(() => t.q(`select public.guardar_lugares($1, 12, 'Bici', '{7}')`, [clase]), /permiso|rol|acceso/i));
  await como(u.dueno, async () => {
    await t.falla(() => t.q(`select public.guardar_lugares($1, 12, 'Bici', '{13}')`, [clase]), /del 1 al 12/);
    await t.q(`select public.guardar_lugares($1, 12, 'Bici', '{7,7}')`, [clase]);
  });
  await como(socios.Ana.us, async () => {
    await t.falla(() => t.q(`select public.elegir_lugar($1, 7)`, [reservas.Ana]), /Bici 7 está fuera de servicio/);
    await t.falla(() => t.q(`select public.elegir_lugar($1, 13)`, [reservas.Ana]), /del 1 al 12/);
    await t.q(`select public.elegir_lugar($1, 3)`, [reservas.Ana]);
    await t.falla(() => t.q(`select public.elegir_lugar($1, 4)`, [reservas.Beto]), /Sin permiso|permiso|rol/i);
  });
  await como(socios.Beto.us, async () => {
    await t.falla(() => t.q(`select public.elegir_lugar($1, 3)`, [reservas.Beto]), /Bici 3 ya lo eligió otra persona/);
    const [{ m }] = await t.q(`select public.lugares_clase($1, $2) m`, [clase, socios.Beto.id]);
    assert.deepEqual(m.ocupados, [3], "el socio ve los ocupados, sin nombres");
    assert.equal(m.mio, null); assert.equal(m.etiqueta, "Bici"); assert.deepEqual(m.fuera_servicio, [7]);
    await t.falla(() => t.q(`select public.lugares_clase($1, $2)`, [clase, socios.Ana.id]), /Sin permiso/);
  });
  await como(socios.Caro.us, () => t.falla(() => t.q(`select public.elegir_lugar($1, 5)`, [reservas.Caro]), /en espera todavía no/));
  await como(u.profe, async () => {
    const [{ m }] = await t.q(`select public.lugares_clase($1) m`, [clase]);
    assert.equal(m.ocupados[0].nombre, "Ana Lugar");
    await t.falla(() => t.q(`select public.lugares_clase($1)`, [ajena]), /tus clases/);
    await t.falla(() => t.q(`select public.elegir_lugar($1, 5)`, [reservas.Beto]), /permiso|rol|acceso/i);
  });
  // La recepción le asigna uno a Beto.
  await como(u.recepcion, () => t.q(`select public.elegir_lugar($1, 5)`, [reservas.Beto]));
  // Ana cancela: su bici queda libre para otro.
  await t.q(`update public.reservas set estado = 'cancelada', cancelada_en = now(), cancelada_por = 'socio' where id = $1`, [reservas.Ana]);
  await como(socios.Beto.us, async () => {
    await t.q(`select public.elegir_lugar($1, 3)`, [reservas.Beto]);
    const [{ m }] = await t.q(`select public.lugares_clase($1, $2) m`, [clase, socios.Beto.id]);
    assert.equal(m.mio, 3); assert.deepEqual(m.ocupados, [3]);
  });
});
