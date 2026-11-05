// Lista de precios de un plan (0056): general + más baratos por medio o por
// pagar antes de un día; programada desde una fecha; anular la que no rige.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir } from "./_comun.mjs";

let t, u = {}, plan;
before(async () => {
  t = await abrir("prueba-lista-precios");
  for (const r of ["dueno", "recepcion"]) {
    const [{ id }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`${r}${Math.random()}@ejemplo.invalid`]);
    await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,$3,$4)`, [t.g, id, r, r]);
    u[r] = id;
  }
  [{ id: plan }] = await t.q(`insert into public.planes (gimnasio_id, tipo, nombre, duracion_meses, renovacion) values ($1,'membresia','Libre',1,'continua') returning id`, [t.g]);
  await t.q(`insert into public.precios_plan (gimnasio_id, plan_id, monto, vigente_desde) values ($1,$2,50000, now() - interval '30 days')`, [t.g, plan]);
});
after(async () => t && t.cerrar());
async function como(sub, fn) {
  await t.q(`set local role authenticated`);
  await t.q(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub, role: "authenticated" })]);
  try { return await fn(); } finally { await t.q(`reset role`).catch(() => {}); }
}
const precio = async (medio, momento = "now()") => (await t.q(`select privado.precio_para($1, ${momento}, $2, null, true) as p`, [plan, medio]))[0].p;

test("guarda la lista entera y cobrar usa el menor que corresponde", async () => {
  const l = await como(u.dueno, async () => {
    await t.q(`select public.programar_lista_precios($1, 60000, $2, null)`, [plan, JSON.stringify([{ medio: "efectivo", monto: 54000 }, { medio: "transferencia", monto: 57000 }])]);
    return (await t.q(`select public.lista_precios_plan($1) as l`, [plan]))[0].l;
  });
  {
    assert.equal(Number(l.hoy.general), 60000);
    assert.deepEqual(l.hoy.variantes.map((v) => [v.medio, Number(v.monto)]), [["efectivo", 54000], ["transferencia", 57000]]);
    assert.equal(l.proxima, null);
    assert.equal(Number(await precio("efectivo")), 54000);
    assert.equal(Number(await precio("credito")), 60000);
    assert.equal(Number((await t.q(`select privado.precio_base($1, now()) as p`, [plan]))[0].p), 60000);
  }
});

test("rechaza lo que no tendría efecto o no se acepta", async () => {
  await t.comoUsuario(u.dueno, async () => {
    const mal = (v, re) => t.falla(() => t.q(`select public.programar_lista_precios($1, 60000, $2, null)`, [plan, JSON.stringify(v)]), re);
    await mal([{ medio: "efectivo", monto: 61000 }], /menor que el general/);
    await mal([{ medio: "mercadopago", monto: 50000 }], /No aceptás mercadopago/);
    await mal([{ hasta_dia: 31, monto: 50000 }], /del 1 al 28/);
    await mal([{ monto: 50000 }], /con qué medio o hasta qué día/);
    await mal([{ medio: "efectivo", monto: 50000 }, { medio: "efectivo", monto: 51000 }], /dos precios para lo mismo/);
  });
});

test("una lista futura convive con la de hoy, se reemplaza el mismo día y se puede anular", async () => {
  const [{ d }] = await t.q(`select (privado.dia_local(now(), $1) + 10)::text as d`, [t.ctx.zona]);
  await como(u.dueno, async () => {
    await t.q(`select public.programar_lista_precios($1, 70000, $2, $3::date)`, [plan, JSON.stringify([{ hasta_dia: 10, monto: 65000 }]), d]);
    await t.q(`select public.programar_lista_precios($1, 72000, $2, $3::date)`, [plan, JSON.stringify([{ hasta_dia: 10, monto: 66000 }]), d]);
    const [{ l }] = await t.q(`select public.lista_precios_plan($1) as l`, [plan]);
    assert.equal(Number(l.hoy.general), 60000);
    assert.equal(Number(l.proxima.general), 72000);
    assert.equal(l.proxima.variantes.length, 1);
    await t.falla(() => t.q(`select public.anular_precio_programado($1, now() - interval '1 day')`, [plan]), /ya rige/);
    const [{ n }] = await t.q(`select public.anular_precio_programado($1, $2::timestamptz) as n`, [plan, l.proxima.desde]);
    assert.equal(n, 2);
    const [{ l: l2 }] = await t.q(`select public.lista_precios_plan($1) as l`, [plan]);
    assert.equal(l2.proxima, null);
  });
  await t.comoUsuario(u.recepcion, async () => {
    await t.falla(() => t.q(`select public.lista_precios_plan($1)`, [plan]), /Sin permiso/);
    await t.falla(() => t.q(`select public.programar_lista_precios($1, 1, null, null)`, [plan]), /Sin permiso/);
  });
});
