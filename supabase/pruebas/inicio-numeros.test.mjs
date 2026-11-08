// VD-12 · los 4 números del Inicio en un viaje: por defecto según el rol, elegibles por el
// dueño (datos por gimnasio), la recepción no ve la plata, el profe no entra, la elección se valida.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir } from "./_comun.mjs";

let t, uDueno, uRec, uProfe;
before(async () => {
  t = await abrir("prueba-inicio-numeros");
  const crear = async (rol, n) => {
    const [{ id: u }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`${rol}${Math.random()}@ejemplo.invalid`]);
    await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,$3,$4)`, [t.g, u, n, rol]);
    return u;
  };
  uDueno = await crear("dueno", "Sofía"); uRec = await crear("recepcion", "Ana"); uProfe = await crear("profe", "Pablo");
});
after(async () => t && t.cerrar());
async function como(u, fn) {
  await t.db.query("set role authenticated");
  await t.q(`select set_config('request.jwt.claims', $1, false)`, [JSON.stringify({ sub: u, role: "authenticated" })]);
  try { return await fn(); } finally { await t.db.query("reset role"); await t.q(`select set_config('request.jwt.claims', '', false)`); }
}
const numeros = async (u) => como(u, async () => (await t.q(`select public.numeros_inicio($1) as n`, [t.g]))[0].n);

test("por defecto (BASE-4): el dueño ve la plata y los que vencen; la recepción lo mismo sin la plata", async () => {
  const d = await numeros(uDueno);
  assert.deepEqual(d.numeros.map((n) => n.clave), ["adentro", "entraron", "cobrado", "a_cobrar", "por_vencer", "deben", "plata_riesgo"]);
  assert.equal(d.numeros.find((n) => n.clave === "entraron").serie.length, 7);
  assert.equal(d.numeros.find((n) => n.clave === "cobrado").formato, "pesos");
  const r = await numeros(uRec);
  assert.deepEqual(r.numeros.map((n) => n.clave), ["adentro", "entraron", "a_cobrar", "por_vencer", "deben"]);
  assert.ok(!r.disponibles.some((x) => x.clave === "cobrado"));
});

test("el profe no usa esta función", async () => {
  await como(uProfe, async () => t.falla(() => t.q(`select public.numeros_inicio($1)`, [t.g]), /permiso/i));
});

test("solo el dueño elige; hasta 8, sin repetir y solo claves que existen", async () => {
  await como(uRec, async () => t.falla(() => t.q(`select public.guardar_numeros_inicio($1, array['activos'])`, [t.g]), /permiso/i));
  await como(uDueno, async () => {
    await t.falla(() => t.q(`select public.guardar_numeros_inicio($1, array['activos','altas_mes','bajas_mes','adentro','entraron','deben','por_vencer','a_cobrar','ocupacion'])`, [t.g]), /hasta 8/);
    await t.falla(() => t.q(`select public.guardar_numeros_inicio($1, array['activos','activos'])`, [t.g]), /repitas/);
    await t.falla(() => t.q(`select public.guardar_numeros_inicio($1, array['inventado'])`, [t.g]), /no existe/);
    await t.q(`select public.guardar_numeros_inicio($1, array['activos','altas_mes','bajas_mes','cobrado'])`, [t.g]);
  });
  const d = await numeros(uDueno);
  assert.deepEqual(d.numeros.map((n) => n.clave), ["activos", "altas_mes", "bajas_mes", "cobrado"]);
  // La recepción no ve "cobrado" aunque el dueño lo haya elegido: se queda con los 3 que sí puede.
  const r = await numeros(uRec);
  assert.deepEqual(r.numeros.map((n) => n.clave), ["activos", "altas_mes", "bajas_mes"]);
});
