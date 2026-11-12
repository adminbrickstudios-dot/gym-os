// F4/F5 · Interruptor por gimnasio de las funciones nuevas (apagadas por defecto), solo el dueño las prende,
// y "ingresos por hora y día" (horarios pico, detalle 68): cuenta por día de la semana y hora, sin rechazados ni anulados.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir } from "./_comun.mjs";

let t, u = {};
// Como la persona, sin deshacer lo que escribe (comoUsuario revierte): el rol se vuelve a soltar al terminar.
async function como(usuario, fn) {
  await t.db.query("set role authenticated");
  await t.q("select set_config('request.jwt.claims', $1, false)", [JSON.stringify({ sub: usuario, role: "authenticated" })]);
  try { return await fn(); } finally { await t.db.query("reset role"); await t.q("select set_config('request.jwt.claims', '', false)"); }
}
async function persona(rol) {
  const [{ id }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`${rol}${Math.random()}@ejemplo.invalid`]);
  await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,$3,$4)`, [t.g, id, `P ${rol}`, rol]);
  return id;
}
before(async () => {
  t = await abrir("prueba-funciones-nuevas");
  for (const r of ["dueno", "encargado", "recepcion", "profe"]) u[r] = await persona(r);
});
after(async () => t && t.cerrar());

test("todo arranca apagado; el dueño prende y apaga; los demás roles leen pero no cambian", async () => {
  const lee = (rol) => como(u[rol], async () => (await t.q(`select public.funciones_nuevas_gimnasio($1) as f`, [t.g]))[0].f);
  assert.deepEqual(await lee("recepcion"), []);
  await como(u.dueno, () => t.q(`select public.guardar_funcion_nueva($1, 'panel_pago', true)`, [t.g]));
  await como(u.dueno, () => t.q(`select public.guardar_funcion_nueva($1, 'panel_pago', true)`, [t.g]));   // idempotente
  await como(u.dueno, () => t.q(`select public.guardar_funcion_nueva($1, 'borrador_alta', true)`, [t.g]));
  assert.deepEqual(await lee("recepcion"), ["borrador_alta", "panel_pago"]);
  await como(u.dueno, () => t.q(`select public.guardar_funcion_nueva($1, 'panel_pago', false)`, [t.g]));
  assert.deepEqual(await lee("profe"), ["borrador_alta"]);
  for (const rol of ["encargado", "recepcion", "profe"]) {
    await como(u[rol], () => t.falla(() => t.q(`select public.guardar_funcion_nueva($1, 'panel_pago', true)`, [t.g]), /permiso|autorizad|acceso/i));
  }
  await como(u.dueno, () => t.falla(() => t.q(`select public.guardar_funcion_nueva($1, 'inventada', true)`, [t.g]), /no existe/i));
});

test("otro gimnasio no puede leer ni cambiar las funciones", async () => {
  const [{ id: otro }] = await t.q(`insert into public.gimnasios (slug, nombre) values ('otro-funciones', 'Otro') returning id`);
  await como(u.dueno, () => t.falla(() => t.q(`select public.funciones_nuevas_gimnasio($1)`, [otro])));
  await como(u.dueno, () => t.falla(() => t.q(`select public.guardar_funcion_nueva($1, 'panel_pago', true)`, [otro])));
});

test("horarios pico: cuenta por día y hora, sin rechazados; solo dueño y encargado", async () => {
  const [{ id: socio }] = await t.q(`select id from public.socios where gimnasio_id = $1 limit 1`, [t.g]);
  const zona = (await t.q(`select zona_horaria z from public.gimnasios where id = $1`, [t.g]))[0].z;
  // Hace tres días a las 19:30 hora del gimnasio, dentro de las últimas 8 semanas.
  const [{ momento, d }] = await t.q(`select (date_trunc('day', now() at time zone $1) - interval '3 days' + interval '19 hours 30 minutes') at time zone $1 as momento,
    extract(isodow from (now() at time zone $1) - interval '3 days')::int as d`, [zona]);
  const mete = (resultado) => t.q(`insert into public.ingresos (gimnasio_id, sede_id, socio_id, momento, via_acceso, resultado, color, motivo, texto)
    values ($1,$2,$3,$4,'recepcion',$5,'verde','al_dia','x')`, [t.g, t.sede, socio, momento, resultado]);
  const hora = (rol) => como(u[rol], async () => (await t.q(`select public.ingresos_por_hora_y_dia($1, 8) as r`, [t.g]))[0].r);
  const antes = await hora("dueno");
  await mete("entro"); await mete("entro"); await mete("rechazado");
  const r = await hora("encargado");
  assert.equal(r.celdas.length, 7);
  assert.ok(r.celdas.every((f) => f.length === 24));
  assert.equal(r.celdas[d - 1][19] - antes.celdas[d - 1][19], 2, "dos entradas a las 19 h, el rechazo no cuenta");
  assert.equal(r.semanas, 8);
  await como(u.recepcion, () => t.falla(() => t.q(`select public.ingresos_por_hora_y_dia($1)`, [t.g])));
});
