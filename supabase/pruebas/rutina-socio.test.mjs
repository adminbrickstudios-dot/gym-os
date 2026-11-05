// RUT-2 (0104): el profe asigna una rutina (una activa: otra la reemplaza);
// el socio la ve con lo último que anotó en cada ejercicio y anota peso y
// repeticiones; anular un registro lo saca; otro socio no ve ni anota nada.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir } from "./_comun.mjs";

let t, uProfe, uSocio, uOtro, socio, rutina, rutina2, sentadilla;
async function como(usuario, fn) {
  await t.q(`set local role authenticated`);
  await t.q(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: usuario, role: "authenticated" })]);
  try { return await fn(); } finally { await t.q(`reset role`).catch(() => {}); }
}
before(async () => {
  t = await abrir("prueba-rutina-socio");
  [{ id: uProfe }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`p${Math.random()}@ejemplo.invalid`]);
  await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,'Profe','profe')`, [t.g, uProfe]);
  [{ id: uSocio }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`s${Math.random()}@ejemplo.invalid`]);
  [{ id: uOtro }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`o${Math.random()}@ejemplo.invalid`]);
  [{ id: socio }] = await t.q(`insert into public.socios (gimnasio_id, nombre, apellido, usuario_id) values ($1,'Le','Vanta',$2) returning id`, [t.g, uSocio]);
  await t.q(`insert into public.socios (gimnasio_id, nombre, apellido, usuario_id) values ($1,'Otro','Socio',$2)`, [t.g, uOtro]);
  await como(uProfe, async () => {
    [{ id: sentadilla }] = await t.q(`select public.guardar_ejercicio($1, null, 'Sentadilla', 'piernas') id`, [t.g]);
    [{ id: rutina }] = await t.q(`select public.guardar_rutina($1, null, 'Fuerza', null, $2) id`, [t.g, JSON.stringify([{ dia: 1, ejercicio_id: sentadilla, series: 4, repeticiones: "8" }])]);
    [{ id: rutina2 }] = await t.q(`select public.guardar_rutina($1, null, 'Otra', null, $2) id`, [t.g, JSON.stringify([{ dia: 1, ejercicio_id: sentadilla, series: 3, repeticiones: "12" }])]);
  });
});
after(async () => t && t.cerrar());

test("asignar, ver y anotar", async () => {
  await como(uProfe, () => t.q(`select public.asignar_rutina($1, $2)`, [socio, rutina]));
  let reg;
  await como(uSocio, async () => {
    const [{ r }] = await t.q(`select public.rutina_de_socio($1) r`, [socio]);
    assert.equal(r.nombre, "Fuerza"); assert.equal(r.items[0].ultimo, null);
    [{ id: reg }] = await t.q(`select public.anotar_ejercicio($1, $2, 62.5, 8) id`, [socio, sentadilla]);
    await t.falla(() => t.q(`select public.anotar_ejercicio($1, $2, null, null)`, [socio, sentadilla]), /peso o las repeticiones/);
    await t.falla(() => t.q(`select public.anotar_ejercicio($1, $2, 2000, 1)`, [socio, sentadilla]), /0 a 1000/);
    const [{ r: r2 }] = await t.q(`select public.rutina_de_socio($1) r`, [socio]);
    assert.equal(Number(r2.items[0].ultimo.peso), 62.5); assert.equal(r2.items[0].ultimo.repeticiones, 8);
  });
  await como(uOtro, async () => {
    await t.falla(() => t.q(`select public.rutina_de_socio($1)`, [socio]), /permiso/i);
    await t.falla(() => t.q(`select public.anotar_ejercicio($1, $2, 10, 10)`, [socio, sentadilla]), /permiso/i);
    await t.falla(() => t.q(`select public.anular_registro($1)`, [reg]), /permiso/i);
  });
  await como(uSocio, async () => {
    await t.q(`select public.anular_registro($1)`, [reg]);
    assert.equal((await t.q(`select public.rutina_de_socio($1) r`, [socio]))[0].r.items[0].ultimo, null);
  });
});

test("otra rutina reemplaza; quitar la saca; el socio no se asigna solo", async () => {
  await como(uSocio, () => t.falla(() => t.q(`select public.asignar_rutina($1, $2)`, [socio, rutina2]), /permiso|rol|acceso/i));
  await como(uProfe, async () => {
    await t.q(`select public.asignar_rutina($1, $2)`, [socio, rutina2]);
    assert.equal((await t.q(`select public.rutina_de_socio($1) r`, [socio]))[0].r.nombre, "Otra");
    await t.q(`select public.quitar_rutina_socio($1)`, [socio]);
    assert.equal((await t.q(`select public.rutina_de_socio($1) r`, [socio]))[0].r, null);
  });
  const [{ n }] = await t.q(`select count(*)::int n from public.rutinas_socio where socio_id = $1`, [socio]);
  assert.equal(n, 2, "las anteriores quedan como historia");
});

test("RUT-3: la marca es el mayor peso; el progreso, lo anotado en orden; el profe lo ve, otro socio no", async () => {
  await como(uSocio, async () => {
    for (const [kg, reps] of [[50, 10], [70, 5], [65, 8]]) await t.q(`select public.anotar_ejercicio($1, $2, $3, $4)`, [socio, sentadilla, kg, reps]);
    await t.q(`select public.anotar_ejercicio($1, $2, null, 20)`, [socio, sentadilla]);   // solo repeticiones: no es marca de peso
  });
  const [{ p }] = await como(uProfe, () => t.q(`select public.progreso_socio($1) p`, [socio]));
  const e = p.ejercicios[0];
  assert.equal(e.ejercicio, "Sentadilla");
  assert.equal(Number(e.marca.peso), 70); assert.equal(e.marca.repeticiones, 5);
  // En la prueba todo pasa en la misma transacción (mismo momento): se compara sin el orden.
  assert.deepEqual(e.registros.map((r) => r.peso === null ? 0 : Number(r.peso)).sort((a, b) => a - b), [0, 50, 65, 70]);
  await como(uOtro, () => t.falla(() => t.q(`select public.progreso_socio($1)`, [socio]), /permiso/i));
});
