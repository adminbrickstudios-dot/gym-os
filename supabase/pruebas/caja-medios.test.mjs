// H1 · Caja por medio (reclamo de Temple Gym: "las transferencias del mostrador no salen en Caja").
// Números fijos: en un turno, 2 cobros en efectivo ($3.000 y $4.500), 3 por transferencia ($1.500, $3.000 y $4.500) y 1 con tarjeta ($1.500).
// El resumen del turno, el cierre, el reporte del turno, el del día (Z) y la lista de transferencias dicen lo mismo, y "tiene que haber"
// es SOLO el efectivo (fondo + efectivo + ingresos − retiros): la transferencia y la tarjeta no mueven la diferencia de caja.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir } from "./_comun.mjs";

let t, caja, agua, uDueno, uAna, uBeto, eAna, turno, ventas = {};
before(async () => {
  t = await abrir("prueba-caja-medios");
  [{ id: caja }] = await t.q(`insert into public.cajas (gimnasio_id, sede_id, nombre) values ($1,$2,'Mostrador') returning id`, [t.g, t.sede]);
  [{ id: agua }] = await t.q(`insert into public.productos (gimnasio_id, nombre, precio) values ($1,'Agua 500 ml',1500) returning id`, [t.g]);
  const crear = async (rol, nombre) => {
    const [{ id: u }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`${rol}${Math.random()}@ejemplo.invalid`]);
    const [{ id: e }] = await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,$3,$4) returning id`, [t.g, u, nombre, rol]);
    return [u, e];
  };
  [uDueno] = await crear("dueno", "Sofía");
  [uAna, eAna] = await crear("recepcion", "Ana");
  [uBeto] = await crear("recepcion", "Beto");
});
after(async () => t && t.cerrar());

async function como(u, fn) {
  await t.db.query("set role authenticated");
  await t.q(`select set_config('request.jwt.claims', $1, false)`, [JSON.stringify({ sub: u, role: "authenticated" })]);
  try { return await fn(); } finally { await t.db.query("reset role"); await t.q(`select set_config('request.jwt.claims', '', false)`); }
}
const vender = async (u, n, medio, turnoId = null) => (await como(u, () => t.q(`select public.vender($1, $2, $3, null, $4) as r`,
  [t.sede, JSON.stringify([{ tipo: "producto", producto_id: agua, cantidad: n }]), JSON.stringify([{ medio, monto: 1500 * n }]), turnoId])))[0].r;
const cobros = (u, ids) => como(u, async () => (await t.q(`select public.cobros_de_turnos($1::uuid[]) as r`, [ids]))[0].r);
const medio = (r, m) => r.find((x) => x.medio === m);
const resumen = async () => (await t.q(`select privado.resumen_turno($1) as r`, [turno]))[0].r;

test("2 en efectivo, 3 por transferencia y 1 con tarjeta: el resumen por medio, con su lista, y 'tiene que haber' solo del efectivo", async () => {
  turno = await como(uAna, async () => (await t.q(`select public.abrir_caja($1, 10000) as id`, [caja]))[0].id);
  ventas.e1 = await vender(uAna, 2, "efectivo", turno);        // 3.000
  ventas.e2 = await vender(uAna, 3, "efectivo", turno);        // 4.500
  ventas.t1 = await vender(uAna, 1, "transferencia", turno);   // 1.500
  ventas.t2 = await vender(uAna, 2, "transferencia", turno);   // 3.000
  ventas.t3 = await vender(uAna, 3, "transferencia", turno);   // 4.500
  ventas.d1 = await vender(uAna, 1, "debito", turno);          // 1.500

  const antes = await resumen();   // lo que ya calculaba la caja (no se tocó)
  assert.equal(Number(antes.efectivo), 7500);
  assert.equal(Number(antes.esperado), 17500, "tiene que haber = 10.000 + 7.500: la transferencia y la tarjeta no suman");
  assert.equal(Number(antes.otros_medios.transferencia), 9000);
  assert.equal(Number(antes.otros_medios.debito), 1500);

  const r = await cobros(uDueno, [turno]);
  assert.deepEqual(r.map((x) => x.medio), ["efectivo", "transferencia", "debito"], "el efectivo primero");
  assert.equal(Number(medio(r, "efectivo").total), 7500); assert.equal(medio(r, "efectivo").cantidad, 2);
  assert.equal(Number(medio(r, "transferencia").total), 9000); assert.equal(medio(r, "transferencia").cantidad, 3);
  assert.equal(Number(medio(r, "debito").total), 1500); assert.equal(medio(r, "debito").cantidad, 1);
  assert.equal(medio(r, "transferencia").cobros.length, 3, "la lista trae cada cobro");
  assert.deepEqual(medio(r, "transferencia").cobros.map((c) => Number(c.monto)).sort((a, b) => a - b), [1500, 3000, 4500]);
  assert.ok(medio(r, "transferencia").cobros.every((c) => c.cobro === "Ana" && c.en), "quién cobró y a qué hora");
  assert.equal(Number(medio(r, "efectivo").total), Number(antes.efectivo), "el resumen de siempre y el nuevo dicen lo mismo");

  // El reporte del turno (X) dice lo mismo, medio por medio.
  const x = await como(uDueno, async () => (await t.q(`select public.reporte_turno($1) as r`, [turno]))[0].r);
  for (const m of x.por_medio) {
    assert.equal(Number(medio(r, m.medio).total), Number(m.total), `${m.medio}: igual que reporte_turno`);
    assert.equal(medio(r, m.medio).cantidad, Number(m.cantidad));
  }
  assert.equal(x.por_medio.length, r.length);
  assert.equal(Number(x.esperado), 17500);
});

test("el cierre, el reporte del turno y el del día (Z) dicen lo mismo; la diferencia cuenta solo el efectivo", async () => {
  // Cuenta 17.500 en el cajón: la transferencia (9.000) y la tarjeta (1.500) NO están en el cajón y no hacen faltar plata.
  const cierre = await como(uAna, async () => (await t.q(`select public.cerrar_caja($1, 17500, null) as r`, [turno]))[0].r);
  assert.equal(Number(cierre.esperado), 17500);
  assert.equal(Number(cierre.diferencia), 0, "caja justa aunque hubo 9.000 por transferencia");
  assert.equal(Number(cierre.otros_medios.transferencia), 9000);

  // Ana (cerró) ve el suyo; Beto, no. El dueño, todo.
  const ana = await cobros(uAna, [turno]);
  assert.equal(Number(medio(ana, "transferencia").total), 9000);
  await como(uBeto, () => t.falla(() => t.q(`select public.cobros_de_turnos($1::uuid[])`, [[turno]]), /Sin permiso/));
  await t.falla(() => t.q(`select public.cobros_de_turnos($1::uuid[])`, [[turno]]), /Sin permiso|permission denied/);

  const z = await como(uDueno, async () => (await t.q(`select public.reporte_dia($1, null) as r`, [t.sede]))[0].r);
  const dia = await cobros(uDueno, z.turnos.map((x) => x.turno_id));
  assert.equal(z.por_medio.length, dia.length);
  for (const m of z.por_medio) {
    assert.equal(Number(medio(dia, m.medio).total), Number(m.total), `${m.medio}: el Z y la lista dicen lo mismo`);
    assert.equal(medio(dia, m.medio).cantidad, Number(m.cantidad));
  }
  assert.equal(Number(z.diferencia), 0);
  assert.equal(Number(z.esperado_contado), 17500);
});

test("Transferencias · 'Cobradas en el mostrador': las 3 del turno y la cobrada sin caja; la tilde deja quién y cuándo", async () => {
  // Beto cobra una transferencia sin caja abierta: no queda en ningún turno, pero el banco la tiene que ver.
  ventas.t4 = await vender(uBeto, 1, "transferencia");
  const [{ turno_caja_id }] = await t.q(`select turno_caja_id from public.ventas where id = $1`, [ventas.t4.venta_id]);
  assert.equal(turno_caja_id, null);

  const lista = () => como(uDueno, async () => (await t.q(`select public.cobradas_en_mostrador($1, 30) as r`, [t.g]))[0].r);
  const l = await lista();
  // El gimnasio de prueba ya trae transferencias del seed: se mide lo nuestro (Ana y Beto) y lo demás es la línea de base.
  const mias = l.filas.filter((f) => ["Ana", "Beto"].includes(f.cobro));
  assert.equal(mias.length, 4, "3 del turno + la de Beto; ni el efectivo ni la tarjeta");
  const base = l.sin_ver_cantidad - 4, baseTotal = Number(l.sin_ver_total) - 10500;
  assert.equal(mias.reduce((a, f) => a + Number(f.monto), 0), 10500, "4.500 + 3.000 + 1.500 + 1.500");
  assert.ok(mias.every((f) => f.visto_en == null));
  assert.equal(mias.find((f) => f.cobro === "Beto").caja, null);
  assert.equal(mias.filter((f) => f.caja === "Mostrador").length, 3);

  const pagoId = async (venta) => (await t.q(`select id from public.pagos where venta_id = $1`, [venta.venta_id]))[0].id;
  const p1 = await pagoId(ventas.t1), pEfectivo = await pagoId(ventas.e1), pDebito = await pagoId(ventas.d1);
  const marca = await como(uAna, async () => (await t.q(`select public.marcar_transferencia_vista($1, true) as r`, [p1]))[0].r);
  assert.equal(marca.visto_por, "Ana"); assert.ok(marca.visto_en);
  const l2 = await lista();
  assert.equal(l2.sin_ver_cantidad, base + 3);
  assert.equal(Number(l2.sin_ver_total) - baseTotal, 9000);
  assert.equal(l2.filas.find((f) => f.pago_id === p1).visto_por, "Ana");
  // Tildar dos veces no cambia quién ni cuándo.
  const otra = await como(uDueno, async () => (await t.q(`select public.marcar_transferencia_vista($1, true) as r`, [p1]))[0].r);
  assert.equal(otra.visto_por, "Ana");

  // Solo se tilda una transferencia del mostrador.
  await como(uAna, () => t.falla(() => t.q(`select public.marcar_transferencia_vista($1, true)`, [pEfectivo]), /Solo se tilda una transferencia/));
  await como(uAna, () => t.falla(() => t.q(`select public.marcar_transferencia_vista($1, true)`, [pDebito]), /Solo se tilda una transferencia/));
  // Sacar la tilde: la recepción solo la suya; el dueño, cualquiera.
  await como(uBeto, () => t.falla(() => t.q(`select public.marcar_transferencia_vista($1, false)`, [p1]), /Solo quien la tildó/));
  await como(uAna, () => t.q(`select public.marcar_transferencia_vista($1, false)`, [p1]));
  assert.equal((await lista()).sin_ver_cantidad, base + 4);
  await como(uAna, () => t.q(`select public.marcar_transferencia_vista($1, true)`, [p1]));
  await como(uDueno, () => t.q(`select public.marcar_transferencia_vista($1, false)`, [p1]));
  assert.equal((await lista()).sin_ver_cantidad, base + 4);
  // Sin sesión: error, nunca lista vacía. Y la tabla no se escribe directo.
  await t.falla(() => t.q(`select public.cobradas_en_mostrador($1, 30)`, [t.g]), /Sin permiso|permission denied/);
  await como(uAna, () => t.falla(() => t.q(`insert into public.pagos_vistos_en_banco (gimnasio_id, pago_id, visto_por) values ($1, $2, $3)`, [t.g, p1, eAna]), /permission denied|row-level security/));
});

test("el resumen no cambió: los mismos totales del turno antes y después de mirar por medio", async () => {
  const r = await resumen();
  assert.equal(Number(r.efectivo), 7500);
  assert.equal(Number(r.esperado), 17500);
  assert.equal(Number(r.contado), 17500);
  assert.equal(Number(r.diferencia), 0);
  assert.equal(Number(r.otros_medios.transferencia), 9000);
  assert.equal(Number(r.otros_medios.debito), 1500);
});
