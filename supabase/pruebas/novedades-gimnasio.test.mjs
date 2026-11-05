// APP-6 (0096): el dueño publica una novedad con hasta qué día se ve; el
// socio la ve en la app mientras está vigente; quitada, no. La recepción
// las ve pero no publica; otro gimnasio, nada; máximo 3 a la vez.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir } from "./_comun.mjs";

let t, u = {}, socio;
async function persona(rol) {
  const [{ id }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`${rol}${Math.random()}@ejemplo.invalid`]);
  await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,$3,$4)`, [t.g, id, rol, rol]);
  return id;
}
// Sin volver atrás: lo que publica el dueño lo ve después el socio.
async function como(usuario, fn) {
  await t.q(`set local role authenticated`);
  await t.q(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: usuario, role: "authenticated" })]);
  try { return await fn(); } finally { await t.q(`reset role`).catch(() => {}); }
}
before(async () => {
  t = await abrir("prueba-novedades");
  for (const r of ["dueno", "recepcion"]) u[r] = await persona(r);
  [{ id: u.socio }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`s${Math.random()}@ejemplo.invalid`]);
  [{ id: socio }] = await t.q(`insert into public.socios (gimnasio_id, nombre, apellido, usuario_id) values ($1,'Lee','Novedades',$2) returning id`, [t.g, u.socio]);
});
after(async () => t && t.cerrar());

test("publicar, verla en la app y quitarla", async () => {
  const hoy = (await t.q(`select privado.dia_local(now(), $1)::text d`, [t.ctx.zona]))[0].d;
  let id;
  await como(u.dueno, async () => {
    await t.falla(() => t.q(`select public.publicar_novedad($1, 'x', $2::date)`, [t.g, hoy]), /Escribí la novedad/);
    await t.falla(() => t.q(`select public.publicar_novedad($1, 'Feriado', $2::date - 1)`, [t.g, hoy]), /hoy o más adelante/);
    await t.falla(() => t.q(`select public.publicar_novedad($1, 'Feriado', $2::date + 90)`, [t.g, hoy]), /hasta 60 días/);
    id = (await t.q(`select public.publicar_novedad($1, 'El lunes abrimos a las 10', $2::date) id`, [t.g, hoy]))[0].id;
  });
  await como(u.recepcion, async () => {
    const [{ n }] = await t.q(`select public.novedades_panel($1) n`, [t.g]);
    assert.equal(n[0].texto, "El lunes abrimos a las 10"); assert.equal(n[0].hasta, hoy);
    await t.falla(() => t.q(`select public.publicar_novedad($1, 'Hola a todos', $2::date)`, [t.g, hoy]), /permiso|rol/i);
  });
  await como(u.socio, async () => {
    const [{ n }] = await t.q(`select public.novedades_socio($1) n`, [socio]);
    assert.deepEqual(n.map((x) => x.texto), ["El lunes abrimos a las 10"]);
  });
  await como(u.dueno, () => t.q(`select public.quitar_novedad($1)`, [id]));
  await como(u.socio, async () => assert.deepEqual((await t.q(`select public.novedades_socio($1) n`, [socio]))[0].n, []));
});

test("máximo 3 a la vez; otro socio u otro gimnasio no", async () => {
  const hoy = (await t.q(`select privado.dia_local(now(), $1)::text d`, [t.ctx.zona]))[0].d;
  await como(u.dueno, async () => {
    for (const x of ["Uno", "Dos", "Tres"]) await t.q(`select public.publicar_novedad($1, $2, $3::date + 5)`, [t.g, `Novedad ${x}`, hoy]);
    await t.falla(() => t.q(`select public.publicar_novedad($1, 'Cuatro de más', $2::date)`, [t.g, hoy]), /Ya hay 3/);
  });
  const [{ id: otro }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`o${Math.random()}@ejemplo.invalid`]);
  await como(otro, () => t.falla(() => t.q(`select public.novedades_socio($1)`, [socio]), /permiso/i));
  await como(otro, () => t.falla(() => t.q(`select public.novedades_panel($1)`, [t.g]), /permiso|equipo|acceso/i));
});
