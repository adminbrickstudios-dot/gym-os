// SEG-5 (0135): entrada sin internet. La copia la calcula la base (la misma
// función de siempre); al volver internet, lo anotado se registra con la
// función de siempre en el momento en que pasó: si no podía entrar, queda
// rechazado (nadie entra gratis en silencio). Reintentar no duplica.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { abrir } from "./_comun.mjs";

let t, u = {};
async function como(usuario, fn) {
  await t.db.query("set role authenticated");
  await t.q(`select set_config('request.jwt.claims', $1, false)`, [JSON.stringify({ sub: usuario, role: "authenticated" })]);
  try { return await fn(); } finally { await t.db.query("reset role"); await t.q(`select set_config('request.jwt.claims', '', false)`); }
}
before(async () => {
  t = await abrir("prueba-sin-internet");
  for (const rol of ["recepcion", "profe"]) {
    const [{ id }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`${rol}${Math.random()}@ejemplo.invalid`]);
    await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,$3,$4)`, [t.g, id, rol, rol]);
    u[rol] = id;
  }
});
after(async () => t && t.cerrar());

test("la copia sale de calcular_acceso; sincronizar registra con la base decidiendo, sin duplicar", async () => {
  await como(u.profe, () => t.falla(() => t.q(`select public.copia_entrada($1)`, [t.sede]), /permiso|rol|acceso/i));
  const copia = await como(u.recepcion, async () => (await t.q(`select public.copia_entrada($1) c`, [t.sede]))[0].c);
  assert.ok(new Date(copia.valida_hasta) > new Date(copia.generada_en));
  // Cada fila es lo que dice calcular_acceso para ese socio (nada se calcula aparte).
  const reales = await t.q(`select s.id, v.puede, v.color, v.texto from public.socios s
    cross join lateral privado.calcular_acceso(s.id, $2::timestamptz, $3) v where s.gimnasio_id = $1 and s.dado_de_baja_en is null`, [t.g, copia.generada_en, t.sede]);
  assert.equal(copia.socios.length, reales.length);
  for (const r of reales) {
    const c = copia.socios.find((x) => x.s === r.id);
    assert.deepEqual([c.p, c.c, c.t], [r.puede, r.color, r.texto]);
  }
  const puede = copia.socios.find((x) => x.p), noPuede = copia.socios.find((x) => !x.p);
  assert.ok(puede && noPuede, "los casos testigo traen al menos uno que entra y uno que no");

  const entradas = [
    { id_local: randomUUID(), socio_id: puede.s, momento: new Date(Date.now() - 10 * 60e3).toISOString() },
    // Uno que la copia decía que no: si lo anotaran igual (no debería poder la pantalla), la base lo rechaza.
    { id_local: randomUUID(), socio_id: noPuede.s, momento: new Date(Date.now() - 5 * 60e3).toISOString() },
  ];
  const r1 = await como(u.recepcion, async () => (await t.q(`select public.sincronizar_sin_internet($1, $2::jsonb) r`, [t.sede, JSON.stringify(entradas)]))[0].r);
  assert.deepEqual(r1.map((x) => [x.resultado === "rechazado", x.ya_estaba]), [[false, false], [true, false]]);
  const contar = async () => (await t.q(`select count(*)::int n from public.ingresos where gimnasio_id = $1`, [t.g]))[0].n;
  const antes = await contar();
  const r2 = await como(u.recepcion, async () => (await t.q(`select public.sincronizar_sin_internet($1, $2::jsonb) r`, [t.sede, JSON.stringify(entradas)]))[0].r);
  assert.ok(r2.every((x) => x.ya_estaba), "reintentar devuelve lo mismo");
  assert.equal(await contar(), antes, "y no duplica");
  const [{ m }] = await t.q(`select i.momento m from public.ingresos_sin_internet x join public.ingresos i on i.id = x.ingreso_id where x.id_local = $1`, [entradas[0].id_local]);
  assert.equal(new Date(m).toISOString(), entradas[0].momento, "queda con la hora en que pasó");

  await como(u.recepcion, async () => {
    await t.falla(() => t.q(`select public.sincronizar_sin_internet($1, $2::jsonb)`, [t.sede, JSON.stringify([{ id_local: randomUUID(), socio_id: puede.s, momento: new Date(Date.now() + 3600e3).toISOString() }])]), /hora imposible/);
    await t.falla(() => t.q(`select public.sincronizar_sin_internet($1, $2::jsonb)`, [t.sede, JSON.stringify([{ id_local: randomUUID(), socio_id: randomUUID(), momento: new Date().toISOString() }])]), /no es de este gimnasio/);
    await t.falla(() => t.q(`select public.sincronizar_sin_internet($1, '{"a":1}'::jsonb)`, [t.sede]), /lista/);
  });
  await como(u.profe, () => t.falla(() => t.q(`select public.sincronizar_sin_internet($1, '[]'::jsonb)`, [t.sede]), /permiso|rol|acceso/i));
});
