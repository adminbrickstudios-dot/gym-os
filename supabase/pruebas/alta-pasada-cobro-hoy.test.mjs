// H2b (20261112180000) · Alta con fecha pasada y la primera cuota cobrada hoy desde Cobrar.
// Caso real de Temple Gym (12/11): alta el 2/11 sin pagos cargados, cobro el 12/11 → quedaba "cubierto hasta 11/12".
// Lo que tiene que pasar: la primera cuota cubre desde el día del alta (2/11 → 2/12, "cubierto hasta 1/12"), mientras
// ese período todavía no haya terminado. Si el alta es más vieja que un período entero, cubre desde hoy (como antes).
// Un socio dado de alta hoy, y los planes de día fijo, no cambian.
// Los días son relativos a "hoy" del gimnasio; los momentos de la puerta, fijos (19:00 de cada día).
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir } from "./_comun.mjs";

let t, dueno, eqDueno, hoy;
const dia = (d, n) => { const x = new Date(`${d}T00:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
const mesDespues = (d) => { const [a, m, x] = d.split("-").map(Number); const f = new Date(Date.UTC(a, m, x)); return f.toISOString().slice(0, 10); };
async function como(usuario, fn) {
  await t.db.query("set role authenticated");
  await t.q(`select set_config('request.jwt.claims', $1, false)`, [JSON.stringify({ sub: usuario, role: "authenticated" })]);
  try { return await fn(); } finally { await t.db.query("reset role"); await t.q(`select set_config('request.jwt.claims', '', false)`); }
}
let dniN = 41000000;
const nuevo = (nombre) => ({ nombre, apellido: "Alta Pasada", dni: String(++dniN) });
const alta = (plan, fechaAlta) => como(dueno, async () => (await t.q(
  `select public.alta_socio_pasado($1, $2, $3::jsonb, $4, $5::date, '[]'::jsonb) as r`,
  [t.g, t.sede, JSON.stringify(nuevo("Socio")), plan, fechaAlta]))[0].r.socio_id);
// La cuota cobrada hoy por el camino de siempre (Cobrar → venta de mostrador, ahora).
const cobrarHoy = (socio, monto) => t.q(`select privado.vender($1,$2,$3,$4::jsonb,$5::jsonb,null,$6,null, now())`,
  [t.g, t.sede, socio, JSON.stringify([{ tipo: "cuota", cantidad: 1 }]), JSON.stringify([{ medio: "transferencia", monto }]), eqDueno]);
const local = async (m) => (await t.q(`select ($1::timestamptz at time zone $2)::date::text as d`, [m, t.ctx.zona]))[0].d;
const coberturas = async (socio) => {
  const filas = await t.q(`select desde, hasta from public.coberturas where socio_id = $1 and anulada_en is null order by desde`, [socio]);
  return Promise.all(filas.map(async (c) => [await local(c.desde), await local(c.hasta)]));
};
const acceso = async (socio, m) => (await t.q(`select (privado.calcular_acceso($1, $2, $3)).*`, [socio, m, t.sede]))[0];
const guardadoIgualRecalculado = async (socio) => (await t.q(
  `select count(*)::int as malos from public.socios where id = $1 and cubierto_hasta is distinct from privado.calcular_cubierto_hasta(id)`, [socio]))[0].malos;

before(async () => {
  t = await abrir("prueba-alta-pasada-cobro-hoy");
  const [{ id }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`dueno${Math.random()}@ejemplo.invalid`]);
  const [{ id: e }] = await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,'Sofía','dueno') returning id`, [t.g, id]);
  dueno = id; eqDueno = e;
  [{ hoy }] = await t.q(`select (now() at time zone zona_horaria)::date::text as hoy from public.gimnasios where id = $1`, [t.g]);
});
after(async () => t && t.cerrar());

test("alta hace 10 días, primera cuota cobrada hoy: cubre desde el alta, no desde hoy", async () => {
  const d = dia(hoy, -10);
  // Plan Full ($25.000) y Plan 3 veces por semana ($20.000), como el "plan 4 días" de Temple Gym.
  for (const [plan, precio] of [[t.ctx.planes.full, 25000], [t.ctx.planes.tres, 20000]]) {
    const s = await alta(plan, d);
    await cobrarHoy(s, precio);
    assert.deepEqual(await coberturas(s), [[d, mesDespues(d)]], "un período, desde el día del alta");
    assert.equal(await guardadoIgualRecalculado(s), 0, "cubierto_hasta guardado = recalculado");
    // La puerta: hoy entra; el último día del período entra; el día que termina, ya no.
    const ultimo = dia(mesDespues(d), -1);
    assert.equal((await acceso(s, await t.en(hoy))).puede, true, "hoy entra");
    assert.equal((await acceso(s, await t.en(ultimo))).puede, true, `el ${ultimo} todavía entra`);
    assert.notEqual((await acceso(s, await t.en(mesDespues(d)))).color, "verde", `el ${mesDespues(d)} ya no está al día`);
  }
});

test("la segunda cuota sigue encadenada desde donde terminó la primera", async () => {
  const d = dia(hoy, -10);
  const s = await alta(t.ctx.planes.full, d);
  await cobrarHoy(s, 25000);
  await cobrarHoy(s, 25000);
  assert.deepEqual(await coberturas(s), [[d, mesDespues(d)], [mesDespues(d), mesDespues(mesDespues(d))]]);
});

test("alta más vieja que un período entero: la cuota de hoy cubre desde hoy (no se cobra un mes ya vencido)", async () => {
  const d = dia(hoy, -45);
  const s = await alta(t.ctx.planes.full, d);
  await cobrarHoy(s, 25000);
  assert.deepEqual(await coberturas(s), [[hoy, mesDespues(hoy)]]);
});

test("alta con fecha de hoy y socio dado de alta por el camino normal: cubre desde hoy, igual que antes", async () => {
  const s1 = await alta(t.ctx.planes.full, hoy);
  await cobrarHoy(s1, 25000);
  assert.deepEqual(await coberturas(s1), [[hoy, mesDespues(hoy)]]);
  // Camino normal: guardar_socio + asignar_plan ahora, cobro ahora.
  const s2 = await como(dueno, async () => (await t.q(`select public.guardar_socio($1, null, $2::jsonb) as id`, [t.g, JSON.stringify(nuevo("Normal"))]))[0].id);
  await como(dueno, () => t.q(`select public.asignar_plan($1, $2)`, [s2, t.ctx.planes.full]));
  await cobrarHoy(s2, 25000);
  assert.deepEqual(await coberturas(s2), [[hoy, mesDespues(hoy)]]);
});
