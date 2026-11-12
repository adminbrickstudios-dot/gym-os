// F9.5 (20261111193100) · La lista del super admin y la salud dan lo mismo que antes, ahora por rango de fechas.
// "Entradas de hoy" por rango tiene que dar EXACTAMENTE lo que daba comparar el día local de cada ingreso, con ingresos de ayer, de hoy y de mañana.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir } from "./_comun.mjs";

let t, brik;
async function comoBrik(fn) {
  await t.db.query("set role authenticated");
  await t.q(`select set_config('request.jwt.claims', $1, false)`, [JSON.stringify({ sub: brik, role: "authenticated" })]);
  try { return await fn(); } finally { await t.db.query("reset role"); await t.q(`select set_config('request.jwt.claims', '', false)`); }
}

before(async () => {
  t = await abrir("f9-admin-escala");
  const [{ id }] = await t.q(`insert into auth.users (email) values ('brik-f9-' || gen_random_uuid() || '@ejemplo.invalid') returning id`);
  await t.q(`insert into public.administradores_plataforma (usuario_id, rol) values ($1, 'principal')`, [id]);
  brik = id;
  const [{ socio }] = await t.q(`select id as socio from public.socios where gimnasio_id = $1 limit 1`, [t.g]);
  // Ingresos a distintas horas, alrededor de la medianoche local de hoy (zona del gimnasio).
  const [{ zona }] = await t.q(`select zona_horaria as zona from public.gimnasios where id = $1`, [t.g]);
  for (const desplazo of ["-1 second", "0 seconds", "+1 second", "+23 hours 59 minutes", "+24 hours", "-1 day"]) {
    await t.q(`insert into public.ingresos (gimnasio_id, sede_id, socio_id, momento, resultado, via_acceso, color, motivo, texto)
               values ($1, $2, $3, privado.medianoche(privado.dia_local(now(), $4), $4) + $5::interval, 'entro', 'recepcion', 'verde', 'ok', 'ok')`, [t.g, t.sede, socio, zona, desplazo]);
  }
});
after(async () => t && t.cerrar());

test("entradas de hoy por rango = comparar el día local de cada ingreso", async () => {
  const [{ esperado }] = await t.q(`select count(*)::int as esperado from public.ingresos i join public.gimnasios g on g.id = i.gimnasio_id
     where i.gimnasio_id = $1 and i.anulado_en is null and i.resultado <> 'rechazado'
       and privado.dia_local(i.momento, g.zona_horaria) = privado.dia_local(now(), g.zona_horaria)`, [t.g]);
  assert.ok(esperado >= 3, "hay ingresos de hoy en el caso de prueba");
  const filas = await comoBrik(async () => (await t.q(`select public.admin_lista_gimnasios('f9-admin-escala', null, null, null, null, null, null, null, false) as r`))[0].r);
  const fila = filas.find((f) => f.gimnasio_id === t.g);
  assert.ok(fila, "el gimnasio está en la lista");
  assert.equal(fila.entradas_hoy, esperado);
});

test("la salud sigue trayendo una entrada por gimnasio, con su color y su orden", async () => {
  const s = await comoBrik(async () => (await t.q(`select public.admin_salud_v2() as r`))[0].r);
  const total = (await t.q(`select count(*)::int as n from public.gimnasios`))[0].n;
  assert.equal(Object.keys(s).length, total);
  const mio = s[t.g];
  assert.ok(["verde", "amarillo", "rojo"].includes(mio.color));
  assert.equal(typeof mio.orden, "number");
});

test("un usuario común no ve ni la lista ni la salud", async () => {
  const [{ id }] = await t.q(`insert into auth.users (email) values ('comun-f9-' || gen_random_uuid() || '@ejemplo.invalid') returning id`);
  await t.db.query("set role authenticated");
  await t.q(`select set_config('request.jwt.claims', $1, false)`, [JSON.stringify({ sub: id, role: "authenticated" })]);
  try {
    await t.falla(() => t.q(`select public.admin_salud_v2()`), /administradores/);
    await t.falla(() => t.q(`select public.admin_lista_gimnasios(null, null, null, null, null, null, null, null, false)`), /administradores|BRIK|permiso/i);
  } finally { await t.db.query("reset role"); await t.q(`select set_config('request.jwt.claims', '', false)`); }
});
