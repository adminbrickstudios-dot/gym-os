// Aumento de precios de varios planes (0057): vista previa = lo que se guarda;
// % y monto, redondeo, precios especiales con el mismo aumento; lo que no
// tiene precio frena todo; la recepción no.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir } from "./_comun.mjs";

let t, u = {}, a, b, sin;
before(async () => {
  t = await abrir("prueba-aumento");
  for (const r of ["dueno", "recepcion"]) {
    const [{ id }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`${r}${Math.random()}@ejemplo.invalid`]);
    await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,$3,$4)`, [t.g, id, r, r]);
    u[r] = id;
  }
  const plan = async (n) => (await t.q(`insert into public.planes (gimnasio_id, tipo, nombre, duracion_meses, renovacion) values ($1,'membresia',$2,1,'continua') returning id`, [t.g, n]))[0].id;
  [a, b, sin] = [await plan("A"), await plan("B"), await plan("Sin precio")];
  await t.q(`insert into public.precios_plan (gimnasio_id, plan_id, monto, vigente_desde, medio_pago) values
    ($1,$2,30000, now() - interval '9 days', null), ($1,$2,27000, now() - interval '9 days', 'efectivo'), ($1,$3,12345, now() - interval '9 days', null)`, [t.g, a, b]);
});
after(async () => t && t.cerrar());
async function como(sub, fn) {
  await t.q(`set local role authenticated`);
  await t.q(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub, role: "authenticated" })]);
  try { return await fn(); } finally { await t.q(`reset role`).catch(() => {}); }
}

test("vista previa y aplicar: 10% redondeado a $100, con el precio en efectivo", async () => {
  const [{ d }] = await t.q(`select (privado.dia_local(now(), $1) + 35)::text as d`, [t.ctx.zona]);
  const v = await como(u.dueno, async () => (await t.q(`select public.vista_aumento($1, $2, 'porcentaje', 10, 100, $3::date) as v`, [t.g, [a, b], d]))[0].v);
  const pa = v.planes.find((x) => x.plan_id === a), pb = v.planes.find((x) => x.plan_id === b);
  assert.equal(Number(pa.nuevo), 33000); assert.equal(Number(pa.variantes[0].monto), 29700); assert.equal(pa.problema, null);
  assert.equal(Number(pb.nuevo), 13600);
  const n = await como(u.dueno, async () => (await t.q(`select public.aplicar_aumento($1, $2, 'porcentaje', 10, 100, $3::date) as n`, [t.g, [a, b], d]))[0].n);
  assert.equal(n, 2);
  // Hoy sigue el viejo; desde el día elegido, el nuevo (y el de efectivo).
  const precio = async (p, medio, cuando) => Number((await t.q(`select privado.precio_para($1, ${cuando}, $2, null, true) as p`, [p, medio]))[0].p);
  assert.equal(await precio(a, null, "now()"), 30000);
  assert.equal(await precio(a, "efectivo", "now() + interval '36 days'"), 29700);
  assert.equal(await precio(a, "credito", "now() + interval '36 days'"), 33000);
  assert.equal(await precio(b, null, "now() + interval '36 days'"), 13600);
});

test("monto fijo; un plan sin precio frena todo y no guarda nada; la recepción no", async () => {
  await como(u.dueno, async () => {
    const [{ v }] = await t.q(`select public.vista_aumento($1, $2, 'monto', 2000, 1, null) as v`, [t.g, [a]]);
    assert.equal(Number(v.planes[0].nuevo), 32000);
    const [{ v: v2 }] = await t.q(`select public.vista_aumento($1, $2, 'porcentaje', 10, 100, null) as v`, [t.g, [sin]]);
    assert.match(v2.planes[0].problema, /No tiene precio/);
    await t.falla(() => t.q(`select public.aplicar_aumento($1, $2, 'porcentaje', 10, 100, null)`, [t.g, [a, sin]]), /Sin precio: No tiene precio/);
    await t.falla(() => t.q(`select public.vista_aumento($1, $2, 'porcentaje', 500, 100, null)`, [t.g, [a]]), /200%/);
    await t.falla(() => t.q(`select public.vista_aumento($1, $2, 'porcentaje', 10, 7, null)`, [t.g, [a]]), /Se redondea/);
  });
  const [{ c }] = await t.q(`select count(*)::int as c from public.precios_plan where plan_id = $1 and vigente_desde > now() - interval '1 minute' and vigente_desde <= now()`, [a]);
  assert.equal(c, 0);
  await como(u.recepcion, () => t.falla(() => t.q(`select public.vista_aumento($1, $2, 'porcentaje', 10, 100, null)`, [t.g, [a]]), /Sin permiso/));
});
