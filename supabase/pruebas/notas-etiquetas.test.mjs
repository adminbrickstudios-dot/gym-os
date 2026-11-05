// Notas y etiquetas (0036): autor y fecha; borra el autor o dueño/encargado;
// etiquetas sin repetir (mayúsculas), filtran la lista; profe no ve nada.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir } from "./_comun.mjs";

let t, u = {};
async function persona(rol, nombre) {
  const [{ id }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`${rol}${Math.random()}@ejemplo.invalid`]);
  await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,$3,$4)`, [t.g, id, nombre, rol]);
  return id;
}
before(async () => {
  t = await abrir("prueba-notas");
  u.recepcion = await persona("recepcion", "Ana Recepción"); u.recepcion2 = await persona("recepcion", "Otra Recepción");
  u.encargado = await persona("encargado", "Martín"); u.profe = await persona("profe", "Profe");
});
after(async () => t && t.cerrar());

test("notas con autor; borra el autor o el encargado, no otra recepción", async () => {
  const s = t.ctx.socios.al_dia;
  let nota;
  await t.q(`savepoint a`);
  await t.q(`set local role authenticated`);
  await t.q(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: u.recepcion, role: "authenticated" })]);
  nota = (await t.q(`select public.agregar_nota($1, '  Prefiere el turno mañana  ') as id`, [s]))[0].id;
  await t.falla(() => t.q(`select public.agregar_nota($1, '   ')`, [s]), /Escribí la nota/);
  const ne = (await t.q(`select public.notas_y_etiquetas($1) as n`, [s]))[0].n;
  assert.equal(ne.notas[0].texto, "Prefiere el turno mañana");
  assert.equal(ne.notas[0].autor, "Ana Recepción");
  assert.equal(ne.notas[0].puedo_borrar, true);
  await t.q(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: u.recepcion2, role: "authenticated" })]);
  await t.falla(() => t.q(`select public.borrar_nota($1)`, [nota]), /solo quien la escribió/);
  await t.q(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: u.encargado, role: "authenticated" })]);
  await t.q(`select public.borrar_nota($1)`, [nota]);
  assert.equal((await t.q(`select public.notas_y_etiquetas($1) as n`, [s]))[0].n.notas.length, 0);
  await t.q(`rollback to savepoint a`);
});

test("etiquetas: sin repetir, filtran la lista; la que nadie tiene desaparece; profe no", async () => {
  const [a, b] = [t.ctx.socios.al_dia, t.ctx.socios.vencida];
  await t.comoUsuario(u.recepcion, async () => {
    const e1 = (await t.q(`select public.poner_etiqueta($1, 'Turno  mañana') as e`, [a]))[0].e;
    const e2 = (await t.q(`select public.poner_etiqueta($1, 'turno mañana') as e`, [b]))[0].e;
    assert.equal(e1, e2, "mayúsculas y espacios: la misma etiqueta");
    const filtrados = await t.q(`select socio_id from public.buscar_socios($1, '', 100, $2)`, [t.g, e1]);
    assert.deepEqual(new Set(filtrados.map((x) => x.socio_id)), new Set([a, b]));
    await t.q(`select public.sacar_etiqueta($1, $2)`, [a, e1]);
    await t.q(`select public.sacar_etiqueta($1, $2)`, [b, e1]);
    assert.equal((await t.q(`select public.etiquetas_gimnasio($1) as e`, [t.g]))[0].e.length, 0);
  });
  await t.comoUsuario(u.profe, async () => t.falla(() => t.q(`select public.notas_y_etiquetas($1)`, [a]), /Sin permiso/));
});
