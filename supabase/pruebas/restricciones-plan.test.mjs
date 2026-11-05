// Restricciones del plan desde Planes (PLA-2, 0055 y 0058): horario y veces por
// semana con errores que dicen qué poner; actividades incluidas (vacío = todas),
// que es lo que mira la reserva (privado.plan_incluye).
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir } from "./_comun.mjs";

let t, u = {}, plan, yoga, funcional, ajena;
before(async () => {
  t = await abrir("prueba-restricciones");
  for (const r of ["dueno", "recepcion"]) {
    const [{ id }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`${r}${Math.random()}@ejemplo.invalid`]);
    await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,$3,$4)`, [t.g, id, r, r]);
    u[r] = id;
  }
  [{ id: yoga }] = await t.q(`insert into public.actividades (gimnasio_id, nombre) values ($1,'Yoga') returning id`, [t.g]);
  [{ id: funcional }] = await t.q(`insert into public.actividades (gimnasio_id, nombre) values ($1,'Funcional') returning id`, [t.g]);
  const [{ id: otro }] = await t.q(`insert into public.gimnasios (slug, nombre) values ($1, 'Otro') returning id`, [`otro-${Date.now()}`]);
  [{ id: ajena }] = await t.q(`insert into public.actividades (gimnasio_id, nombre) values ($1,'Ajena') returning id`, [otro]);
});
after(async () => t && t.cerrar());
async function como(sub, fn) {
  await t.q(`set local role authenticated`);
  await t.q(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub, role: "authenticated" })]);
  try { return await fn(); } finally { await t.q(`reset role`).catch(() => {}); }
}

test("horario y veces por semana: lo mal puesto dice qué poner", async () => {
  await como(u.dueno, async () => {
    [{ id: plan }] = await t.q(`select public.guardar_plan($1, null, $2) as id`, [t.g, { tipo: "membresia", nombre: "Mañana", hora_desde: "07:00", hora_hasta: "12:00", max_ingresos_semana: 3 }]);
    await t.falla(() => t.q(`select public.guardar_plan($1, $2, $3)`, [t.g, plan, { hora_desde: "07:00", hora_hasta: "" }]), /desde y hasta/);
    await t.falla(() => t.q(`select public.guardar_plan($1, $2, $3)`, [t.g, plan, { hora_desde: "16:00", hora_hasta: "07:00" }]), /termina después de empezar/);
    await t.falla(() => t.q(`select public.guardar_plan($1, $2, $3)`, [t.g, plan, { max_ingresos_semana: 9 }]), /de 1 a 7/);
    await t.q(`select public.guardar_plan($1, $2, $3)`, [t.g, plan, { hora_desde: "", hora_hasta: "" }]);
  });
  const [p] = await t.q(`select hora_desde, max_ingresos_semana from public.planes where id = $1`, [plan]);
  assert.equal(p.hora_desde, null); assert.equal(p.max_ingresos_semana, 3);
});

test("actividades: elegir algunas restringe la reserva; vacío vuelve a todas", async () => {
  await como(u.dueno, async () => {
    assert.equal((await t.q(`select public.guardar_actividades_plan($1, $2) as n`, [plan, [yoga]]))[0].n, 1);
    const [{ m }] = await t.q(`select public.actividades_por_plan($1) as m`, [t.g]);
    assert.deepEqual(m[plan], [yoga]);
    await t.falla(() => t.q(`select public.guardar_actividades_plan($1, $2)`, [plan, [ajena]]), /no es de este gimnasio/);
  });
  const incluye = async (a) => (await t.q(`select privado.plan_incluye($1, $2) as i`, [plan, a]))[0].i;
  assert.equal(await incluye(yoga), true);
  assert.equal(await incluye(funcional), false);
  await como(u.dueno, () => t.q(`select public.guardar_actividades_plan($1, '{}')`, [plan]));
  assert.equal(await incluye(funcional), true);
  await como(u.recepcion, () => t.falla(() => t.q(`select public.guardar_actividades_plan($1, $2)`, [plan, [yoga]]), /Sin permiso/));
});
