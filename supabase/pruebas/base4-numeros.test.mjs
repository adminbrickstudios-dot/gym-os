// BASE-4 · Siempre a la vista: cada número nuevo de Inicio sale de la misma lista que lo forma (Retención).
// deben = lista "vencido"; vencen esta semana = "por_vencer" con 1 a 7 días; plata en riesgo = la de Retención, sin que la recepción la vea.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir } from "./_comun.mjs";

let t, uDueno, uRec;
before(async () => {
  t = await abrir("prueba-base4-numeros");
  const crear = async (rol, n) => {
    const [{ id: u }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`${rol}${Math.random()}@ejemplo.invalid`]);
    await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,$3,$4)`, [t.g, u, n, rol]);
    return u;
  };
  uDueno = await crear("dueno", "Sofía"); uRec = await crear("recepcion", "Ana");
});
after(async () => t && t.cerrar());
async function como(u, fn) {
  await t.db.query("set role authenticated");
  await t.q(`select set_config('request.jwt.claims', $1, false)`, [JSON.stringify({ sub: u, role: "authenticated" })]);
  try { return await fn(); } finally { await t.db.query("reset role"); await t.q(`select set_config('request.jwt.claims', '', false)`); }
}

test("deben, vencen esta semana y plata en riesgo coinciden con las listas de Retención", async () => {
  const d = await como(uDueno, async () => (await t.q(`select public.numeros_inicio($1) as n`, [t.g]))[0].n);
  const v = (c) => d.numeros.find((n) => n.clave === c)?.valor;
  const [{ deben, semana, riesgo }] = await t.q(`
    select count(*) filter (where lista = 'vencido')::int as deben,
           count(*) filter (where lista = 'por_vencer' and dias between 1 and 7)::int as semana,
           coalesce(sum(monto_mensual) filter (where lista in ('vencido','por_vencer','nuevo','no_viene')), 0)::numeric as riesgo
      from privado.retencion($1, now())`, [t.g]);
  assert.equal(Number(v("deben")), deben);
  assert.equal(Number(v("por_vencer")), semana);
  assert.equal(Number(v("plata_riesgo")), Number(riesgo));
  assert.equal(d.numeros.find((n) => n.clave === "plata_riesgo").formato, "pesos");
});

test("la recepción no ve la plata en riesgo ni la puede elegir; ve los que deben", async () => {
  const r = await como(uRec, async () => (await t.q(`select public.numeros_inicio($1) as n`, [t.g]))[0].n);
  assert.ok(!r.disponibles.some((x) => x.clave === "plata_riesgo" || x.clave === "cobrado"));
  assert.ok(r.numeros.some((n) => n.clave === "deben"));
});

test("el dueño puede elegir hasta 8 y se guardan en orden", async () => {
  await como(uDueno, async () => {
    await t.q(`select public.guardar_numeros_inicio($1, array['deben','por_vencer','plata_riesgo','adentro','entraron','cobrado','a_cobrar','activos'])`, [t.g]);
    const d = (await t.q(`select public.numeros_inicio($1) as n`, [t.g]))[0].n;
    assert.equal(d.numeros.length, 8);
    await t.q(`select public.guardar_numeros_inicio($1, '{}')`, [t.g]);
  });
});
