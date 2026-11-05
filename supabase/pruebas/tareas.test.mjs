// COM-4 (0124): tareas del equipo. Cada uno ve las suyas y las que creó; dueño
// y encargado ven todas. Se marcan hechas (y se reabren); otra persona no.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir } from "./_comun.mjs";

let t, u = {}, eq = {}, socio;
async function como(usuario, fn) {
  await t.db.query("set role authenticated");
  await t.q(`select set_config('request.jwt.claims', $1, false)`, [JSON.stringify({ sub: usuario, role: "authenticated" })]);
  try { return await fn(); } finally { await t.db.query("reset role"); await t.q(`select set_config('request.jwt.claims', '', false)`); }
}
before(async () => {
  t = await abrir("prueba-tareas");
  for (const [k, rol] of [["dueno", "dueno"], ["ana", "recepcion"], ["bea", "recepcion"]]) {
    const [{ id }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`${k}${Math.random()}@ejemplo.invalid`]);
    const [{ id: e }] = await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,$3,$4) returning id`, [t.g, id, k, rol]);
    u[k] = id; eq[k] = e;
  }
  [{ id: socio }] = await t.q(`select id from public.socios where gimnasio_id = $1 limit 1`, [t.g]);
});
after(async () => t && t.cerrar());

test("la dueña le asigna a Ana; Ana la ve y la marca; Bea no la ve ni la toca; la dueña ve todas", async () => {
  const hoy = (await t.q(`select (now() at time zone 'America/Argentina/Buenos_Aires')::date::text d`))[0].d;
  const tarea = await como(u.dueno, async () => {
    await t.falla(() => t.q(`select public.crear_tarea($1, 'x', $2, $3::date)`, [t.g, eq.ana, hoy]), /Escribí qué/);
    await t.falla(() => t.q(`select public.crear_tarea($1, 'Llamar', $2, $3::date - 5)`, [t.g, eq.ana, hoy]), /ya pasó/);
    return (await t.q(`select public.crear_tarea($1, 'Llamar para ofrecerle la pausa', $2, $3::date, $4) id`, [t.g, eq.ana, hoy, socio]))[0].id;
  });
  await como(u.ana, async () => {
    const [{ p }] = await t.q(`select public.tareas_panel($1) p`, [t.g]);
    const mia = p.tareas.find((x) => x.id === tarea);
    assert.ok(mia?.mia && mia.socio && mia.creada_por === "dueno");
    assert.ok(p.equipo.some((q) => q.yo && q.nombre === "ana"));
    await t.q(`select public.marcar_tarea($1, true)`, [tarea]);
  });
  await como(u.bea, async () => {
    const [{ p }] = await t.q(`select public.tareas_panel($1, true) p`, [t.g]);
    assert.equal(p.tareas.find((x) => x.id === tarea), undefined, "Bea no ve la de Ana (aunque pida todas)");
    await t.falla(() => t.q(`select public.marcar_tarea($1, false)`, [tarea]), /otra persona/);
  });
  await como(u.dueno, async () => {
    const [{ p }] = await t.q(`select public.tareas_panel($1, true) p`, [t.g]);
    const x = p.tareas.find((y) => y.id === tarea);
    assert.ok(x.hecha_en && x.hecha_por === "ana");
    await t.q(`select public.marcar_tarea($1, false)`, [tarea]);
    const [{ q }] = await t.q(`select public.tareas_panel($1, true) q`, [t.g]);
    assert.equal(q.tareas.find((y) => y.id === tarea).hecha_en, null, "la dueña la reabre");
  });
});
