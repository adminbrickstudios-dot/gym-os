// Prueba social de la página (VD-25, migración 0161): el dueño prende "+N socios" y carga las reseñas;
// el encargado lee y no guarda; recepción ni lee; la página pública muestra solo lo prendido, con los
// socios redondeados hacia abajo y sin número chico.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir } from "./_comun.mjs";

let t, u = {};
const HOST = `social-${Date.now()}.ejemplo.invalid`;
async function persona(rol) {
  const [{ id }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`${rol}${Math.random()}@ejemplo.invalid`]);
  await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,$3,$4)`, [t.g, id, rol, rol]);
  return id;
}
before(async () => {
  t = await abrir("prueba-prueba-social");
  for (const r of ["dueno", "encargado", "recepcion"]) u[r] = await persona(r);
  await t.q(`insert into public.dominios_gimnasio (gimnasio_id, host, tipo) values ($1, $2, 'propio')`, [t.g, HOST]);
  await t.q(`update public.landing_gimnasio set publicada = true where gimnasio_id = $1`, [t.g]);
});
after(async () => t && t.cerrar());

const publica = async () => (await t.q(`select public.landing_publica($1) as l`, [HOST]))[0].l;
const sociosHasta = async (n) => {
  const [{ n: hay }] = await t.q(`select count(*)::int n from public.socios where gimnasio_id = $1 and dado_de_baja_en is null`, [t.g]);
  for (let i = hay; i < n; i++) await t.q(`insert into public.socios (gimnasio_id, nombre) values ($1, $2)`, [t.g, `Socio ${i}`]);
};

test("por defecto la página no muestra ni socios ni reseñas", async () => {
  const l = await publica();
  assert.equal(l.prueba_social.socios, null);
  assert.equal(l.prueba_social.resena, null);
});

test("el dueño prende socios y carga reseñas; la página las muestra; socios redondeados hacia abajo", async () => {
  await sociosHasta(137);
  await t.comoUsuario(u.dueno, async () => {
    const r = (await t.q(`select public.guardar_prueba_social($1, true, 4.76, 120) as r`, [t.g]))[0].r;
    assert.equal(r.mostrar_socios, true);
    assert.equal(Number(r.resena_puntaje), 4.8, "el puntaje queda con un decimal");
    assert.equal(r.resena_cantidad, 120);
    const l = await publica();   // dentro de la sesión: comoUsuario revierte lo guardado al salir
    assert.equal(l.prueba_social.socios, 100, "137 socios se muestran como +100");
    assert.equal(Number(l.prueba_social.resena.puntaje), 4.8);
    assert.equal(l.prueba_social.resena.cantidad, 120);
  });
});

test("con menos de 20 socios no se muestra número aunque esté prendido", async () => {
  await t.q(`update public.landing_gimnasio set mostrar_socios = true where gimnasio_id = $1`, [t.g]);
  await t.q(`update public.socios set dado_de_baja_en = now(), motivo_baja = 'otro' where gimnasio_id = $1 and numero > 10`, [t.g]);
  assert.equal((await publica()).prueba_social.socios, null);
});

test("errores que dicen qué: puntaje fuera de rango, solo uno de los dos", async () => {
  await t.comoUsuario(u.dueno, async () => {
    await t.falla(() => t.q(`select public.guardar_prueba_social($1, true, 6, 10)`, [t.g]), /puntaje va de 1 a 5/);
    await t.falla(() => t.q(`select public.guardar_prueba_social($1, true, 4.5, null)`, [t.g]), /completá el puntaje y la cantidad/);
    await t.falla(() => t.q(`select public.guardar_prueba_social($1, true, 4.5, 0)`, [t.g]), /cantidad va de 1/);
  });
});

test("dejar los dos vacíos saca las reseñas", async () => {
  await t.q(`update public.landing_gimnasio set resena_puntaje = 4.5, resena_cantidad = 10 where gimnasio_id = $1`, [t.g]);
  await t.comoUsuario(u.dueno, async () => {
    await t.q(`select public.guardar_prueba_social($1, false, null, null)`, [t.g]);
    assert.equal((await publica()).prueba_social.resena, null);
  });
});

test("el encargado lee y no guarda; recepción ni lee; anon no puede ni llamar", async () => {
  await t.comoUsuario(u.encargado, async () => {
    const p = (await t.q(`select public.prueba_social_panel($1) as p`, [t.g]))[0].p;
    assert.equal(typeof p.mostrar_socios, "boolean");
    assert.equal(p.socios_ahora, null, "con menos de 20 socios, sin número");
    await t.falla(() => t.q(`select public.guardar_prueba_social($1, true, null, null)`, [t.g]), /./);
  });
  await t.comoUsuario(u.recepcion, async () => {
    await t.falla(() => t.q(`select public.prueba_social_panel($1)`, [t.g]), /./);
  });
  await t.db.query("savepoint anon");
  try {
    await t.db.query("set local role anon");
    await t.falla(() => t.q(`select public.guardar_prueba_social($1, true, null, null)`, [t.g]), /permission denied|permiso/i);
  } finally { await t.db.query("rollback to savepoint anon"); }
});
