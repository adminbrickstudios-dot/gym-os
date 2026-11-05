// Matrícula por plan (0059): se calcula de lo cobrado; Vender la ofrece y la
// cobra una vez; una venta anulada la vuelve a deber; la anual vuelve al año.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir } from "./_comun.mjs";

let t, uDueno, uRec, plan, socio;
before(async () => {
  t = await abrir("prueba-matricula");
  const crear = async (rol) => {
    const [{ id: u }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`${rol}${Math.random()}@ejemplo.invalid`]);
    await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,$3,$4)`, [t.g, u, rol, rol]);
    return u;
  };
  uDueno = await crear("dueno"); uRec = await crear("recepcion");
  [{ id: plan }] = await t.q(`insert into public.planes (gimnasio_id, tipo, nombre, duracion_meses, renovacion) values ($1,'membresia','Con matrícula',1,'continua') returning id`, [t.g]);
  await t.q(`insert into public.precios_plan (gimnasio_id, plan_id, monto, vigente_desde) values ($1,$2,20000,'2020-01-01')`, [t.g, plan]);
  [{ id: socio }] = await t.q(`insert into public.socios (gimnasio_id, nombre, apellido) values ($1,'Nuevo','Inscripto') returning id`, [t.g]);
  await t.q(`insert into public.suscripciones (gimnasio_id, socio_id, plan_id, inicio) values ($1,$2,$3, now() - interval '1 hour')`, [t.g, socio, plan]);
});
after(async () => t && t.cerrar());
async function como(u, fn) {
  await t.db.query("set role authenticated");
  await t.q(`select set_config('request.jwt.claims', $1, false)`, [JSON.stringify({ sub: u, role: "authenticated" })]);
  try { return await fn(); } finally { await t.db.query("reset role"); await t.q(`select set_config('request.jwt.claims', '', false)`); }
}
const precios = async () => (await t.q(`select public.precios_venta($1, $2) as p`, [t.sede, socio]))[0].p;
const vender = (items, monto) => t.q(`select public.vender($1, $2, $3, $4, null) as r`,
  [t.sede, JSON.stringify(items), JSON.stringify([{ medio: "transferencia", monto }]), socio]);

test("el dueño la pone; solo membresías; la recepción no", async () => {
  await como(uDueno, async () => {
    await t.q(`select public.guardar_matricula_plan($1, 10000, false)`, [plan]);
    const [{ m }] = await t.q(`select public.matriculas_planes($1) as m`, [t.g]);
    assert.deepEqual(m[plan], { monto: 10000, anual: false });
    await t.falla(() => t.q(`select public.guardar_matricula_plan($1, 0, false)`, [plan]), /mayor a cero/);
  });
  await como(uRec, () => t.falla(() => t.q(`select public.guardar_matricula_plan($1, 1, false)`, [plan]), /Sin permiso/));
});

test("Vender la ofrece, la cobra una vez, y una venta anulada la vuelve a deber", async () => {
  const r = await como(uRec, async () => {
    assert.equal(Number((await precios()).matricula.monto), 10000);
    const [{ r }] = await vender([{ tipo: "cuota", cantidad: 1 }, { tipo: "matricula" }], 30000);
    assert.equal(Number(r.total), 30000);
    assert.equal((await precios()).matricula, null);
    await t.falla(() => vender([{ tipo: "matricula" }], 10000), /no debe matrícula/);
    return r;
  });
  const [{ d }] = await t.q(`select descripcion as d from public.venta_items where venta_id = $1 and tipo = 'matricula'`, [r.venta_id]);
  assert.equal(d, "Matrícula Con matrícula");
  await como(uDueno, () => t.q(`select public.anular_venta($1, 'Prueba')`, [r.venta_id]));
  await como(uRec, async () => assert.equal(Number((await precios()).matricula.monto), 10000));
});

test("anual: la cobrada hace más de un año se vuelve a deber", async () => {
  await como(uDueno, () => t.q(`select public.guardar_matricula_plan($1, 10000, true)`, [plan]));
  const [{ id: v }] = await t.q(`insert into public.ventas (gimnasio_id, sede_id, socio_id, estado, origen, creado_en, confirmada_en)
                                 values ($1,$2,$3,'confirmada','recepcion', now() - interval '13 months', now() - interval '13 months') returning id`, [t.g, t.sede, socio]);
  await t.q(`insert into public.venta_items (gimnasio_id, venta_id, tipo, plan_id, descripcion, cantidad, precio_unitario) values ($1,$2,'matricula',$3,'Matrícula',1,10000)`, [t.g, v, plan]);
  assert.notEqual((await t.q(`select privado.matricula_pendiente($1, now()) as m`, [socio]))[0].m, null);
  await t.q(`update public.ventas set creado_en = now() - interval '2 months' where id = $1`, [v]);
  assert.equal((await t.q(`select privado.matricula_pendiente($1, now()) as m`, [socio]))[0].m, null);
});
