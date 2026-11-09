// FA-15 · Marcar cada serie como hecha: un hecho por serie y día; repetir no duplica; se deshace; no pasa de las series de la
// rutina; el socio solo toca las suyas; lo marcado hoy se lee con series_hechas_hoy.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir } from "./_comun.mjs";

let t, profe, socioU, otroU, sentadilla, remo;
async function como(usuario, fn) {
  await t.db.query("set role authenticated");
  await t.q(`select set_config('request.jwt.claims', $1, false)`, [JSON.stringify({ sub: usuario, role: "authenticated" })]);
  try { return await fn(); } finally { await t.db.query("reset role"); await t.q(`select set_config('request.jwt.claims', '', false)`); }
}
const S = () => t.ctx.socios;

before(async () => {
  t = await abrir("prueba-series-hechas");
  [{ id: profe }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`profe${Math.random()}@ejemplo.invalid`]);
  await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,'Profe','profe')`, [t.g, profe]);
  [{ id: socioU }] = await t.q(`insert into auth.users (phone) values ('+549000077800001') returning id`);
  [{ id: otroU }] = await t.q(`insert into auth.users (phone) values ('+549000077800002') returning id`);
  await t.q(`update public.socios set usuario_id = $2 where id = $1`, [S().al_dia, socioU]);
  await t.q(`update public.socios set usuario_id = $2 where id = $1`, [S().por_vencer, otroU]);
  await como(profe, async () => {
    sentadilla = (await t.q(`select public.guardar_ejercicio($1, null, 'Sentadilla', 'piernas', null, true, 'barra') id`, [t.g]))[0].id;
    remo = (await t.q(`select public.guardar_ejercicio($1, null, 'Remo', 'espalda', null, true, 'mancuernas') id`, [t.g]))[0].id;
    const items = [{ dia: 1, ejercicio_id: sentadilla, series: 4, repeticiones: "8" }, { dia: 2, ejercicio_id: remo, series: 3, repeticiones: "12" }];
    const rutina = (await t.q(`select public.guardar_rutina($1, null, 'Fuerza', null, $2) id`, [t.g, JSON.stringify(items)]))[0].id;
    await t.q(`select public.asignar_rutina_varios($1, array[$2]::uuid[])`, [rutina, S().al_dia]);
  });
});
after(async () => t && t.cerrar());

test("el socio marca series, repetir no duplica y se leen las de hoy", async () => {
  await como(socioU, async () => {
    const a = (await t.q(`select public.marcar_serie_rutina($1, 1, $2, 1) r`, [S().al_dia, sentadilla]))[0].r;
    assert.deepEqual(a, { hechas: 1, de: 4 });
    await t.q(`select public.marcar_serie_rutina($1, 1, $2, 1)`, [S().al_dia, sentadilla]);
    const b = (await t.q(`select public.marcar_serie_rutina($1, 1, $2, 2) r`, [S().al_dia, sentadilla]))[0].r;
    assert.deepEqual(b, { hechas: 2, de: 4 });
    const hoy = (await t.q(`select public.series_hechas_hoy($1) r`, [S().al_dia]))[0].r;
    assert.deepEqual(hoy.map((x) => [x.dia, x.serie]), [[1, 1], [1, 2]]);
  });
});

test("se deshace una serie; el deshacer de una que no estaba no rompe", async () => {
  await como(socioU, async () => {
    const r = (await t.q(`select public.marcar_serie_rutina($1, 1, $2, 2, false) r`, [S().al_dia, sentadilla]))[0].r;
    assert.deepEqual(r, { hechas: 1, de: 4 });
    const otra = (await t.q(`select public.marcar_serie_rutina($1, 1, $2, 4, false) r`, [S().al_dia, sentadilla]))[0].r;
    assert.equal(otra.hechas, 1);
  });
});

test("no pasa de las series de la rutina ni acepta un ejercicio o día que no está", async () => {
  await como(socioU, async () => {
    await t.falla(() => t.q(`select public.marcar_serie_rutina($1, 1, $2, 5)`, [S().al_dia, sentadilla]), /no existe en tu rutina/);
    await t.falla(() => t.q(`select public.marcar_serie_rutina($1, 1, $2, 0)`, [S().al_dia, sentadilla]), /no existe en tu rutina/);
    await t.falla(() => t.q(`select public.marcar_serie_rutina($1, 1, $2, 1)`, [S().al_dia, remo]), /no está en tu rutina/);
    await t.falla(() => t.q(`select public.marcar_serie_rutina($1, 3, $2, 1)`, [S().al_dia, sentadilla]), /no está en tu rutina/);
  });
});

test("otro socio no puede marcar ni leer las series de este", async () => {
  await como(otroU, async () => {
    await t.falla(() => t.q(`select public.marcar_serie_rutina($1, 1, $2, 1)`, [S().al_dia, sentadilla]), /permiso|rol|acceso/i);
    await t.falla(() => t.q(`select public.series_hechas_hoy($1)`, [S().al_dia]), /permiso|rol|acceso/i);
  });
});

test("el navegador sin sesión (anon) no puede llamarlas", async () => {
  await t.db.query("set role anon");
  try { await t.falla(() => t.q(`select public.marcar_serie_rutina($1, 1, $2, 1)`, [S().al_dia, sentadilla]), /permission|permiso/i); } finally { await t.db.query("reset role"); }
});
