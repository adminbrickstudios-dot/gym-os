// VD-7 (D18): cómo vencen las cuotas. Día fijo + primera cuota a mitad de mes: proporcional exacto
// (mes de 30, de 31 y febrero), mes entero, gratis hasta el día fijo y "completo" (lo de siempre);
// un gimnasio sin configurar no cambia; cambiar el modo no toca lo ya cobrado; solo el dueño escribe,
// y todo cambio queda en cambios_cobro.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir } from "./_comun.mjs";

let t, uDueno, uEnc, uRec, plan;
// Corre `fn` con la sesión del usuario; lo que escribe se descarta al salir (savepoint), así que lo que
// hay que mirar se mira adentro, con `mirar` (vuelve a superusuario un momento).
async function como(usuario, fn) {
  await t.db.query("savepoint c");
  try {
    await t.db.query("set local role authenticated");
    await t.q(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: usuario, role: "authenticated" })]);
    return await fn();
  } finally { await t.db.query("rollback to savepoint c"); }
}
async function mirar(sql, params) {
  await t.db.query("reset role");
  try { return await t.q(sql, params); } finally { await t.db.query("set local role authenticated"); }
}
before(async () => {
  t = await abrir("prueba-vencimiento");
  for (const [rol, nombre] of [["dueno", "Dueña"], ["encargado", "Beto"], ["recepcion", "Sofi"]]) {
    const [{ id }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`${rol}${Math.random()}@ejemplo.invalid`]);
    await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,$3,$4)`, [t.g, id, nombre, rol]);
    if (rol === "dueno") uDueno = id; else if (rol === "encargado") uEnc = id; else uRec = id;
  }
  [{ id: plan }] = await t.q(`insert into public.planes (gimnasio_id, tipo, nombre, duracion_meses, renovacion, dia_fijo)
                              values ($1, 'membresia', 'Mensual día 1', 1, 'dia_fijo', 1) returning id`, [t.g]);
  await t.q(`insert into public.precios_plan (gimnasio_id, plan_id, monto, vigente_desde) values ($1, $2, 30000, '2020-01-01')`, [t.g, plan]);
});
after(async () => t && t.cerrar());

const config = (primera, extra = {}) => t.q(
  `insert into public.configuracion_vencimiento (gimnasio_id, renovacion, dia_fijo, primera_cuota, redondeo)
   values ($1, 'continua', null, $2, $3)
   on conflict (gimnasio_id) do update set primera_cuota = excluded.primera_cuota, redondeo = excluded.redondeo`, [t.g, primera, extra.redondeo ?? 100]);
const nuevoSocio = async (nombre, p = plan) => {
  const [{ id: s }] = await t.q(`insert into public.socios (gimnasio_id, nombre, apellido) values ($1, 'Prueba', $2) returning id`, [t.g, nombre]);
  await t.q(`insert into public.suscripciones (gimnasio_id, socio_id, plan_id, inicio) values ($1, $2, $3, '2026-01-01T03:00:00Z')`, [t.g, s, p]);
  return s;
};
// Cobra la cuota de ese día a transferencia, por el mismo precio que muestra precios_cuota (el que ve la hoja).
async function cobrar(socio, dia, cantidad = 1) {
  const m = await t.en(dia, "11:00:00");
  const [{ id: sus }] = await t.q(`select id from public.suscripciones where socio_id = $1 and baja_en is null`, [socio]);
  const [{ p }] = await t.q(`select privado.precios_cuota($1, $2, $3, $4) as p`, [sus, plan, t.sede, m]);
  const unitario = Number(p.precios.transferencia);
  const pagos = unitario > 0 ? [{ medio: "transferencia", monto: unitario * cantidad }] : [];
  const [{ r }] = await t.q(`select privado.vender($1, $2, $3, $4::jsonb, $5::jsonb, null, null, null, $6) as r`,
    [t.g, t.sede, socio, JSON.stringify([{ tipo: "cuota", cantidad }]), JSON.stringify(pagos), m]);
  return { r, parcial: p.parcial, unitario };
}
const coberturas = async (socio) => (await t.q(
  `select to_char(desde at time zone $2, 'YYYY-MM-DD') as desde, to_char(hasta at time zone $2, 'YYYY-MM-DD') as hasta, origen
     from public.coberturas where socio_id = $1 and anulada_en is null order by desde`, [socio, t.ctx.zona]));

test("sin configurar, la primera cuota de día fijo es la de siempre: el mes entero desde el último día fijo", async () => {
  const s = await nuevoSocio("Sin config");
  const { r, parcial } = await cobrar(s, "2026-11-20");
  assert.equal(parcial, null);
  assert.equal(Number(r.total), 30000);
  assert.deepEqual(await coberturas(s), [{ desde: "2026-11-01", hasta: "2026-12-01", origen: "pago" }]);
});

test("proporcional, mes de 30 días: se anota el 20/11 y paga 11 días de 30", async () => {
  await config("proporcional");
  const s = await nuevoSocio("Prop 30");
  const { r, parcial } = await cobrar(s, "2026-11-20");
  assert.equal(parcial.dias, 11); assert.equal(parcial.dias_ciclo, 30); assert.equal(parcial.texto, "11 días de 30");
  assert.equal(Number(r.total), 11000);              // 30000 * 11 / 30 = 11000 exacto
  assert.deepEqual(await coberturas(s), [{ desde: "2026-11-20", hasta: "2026-12-01", origen: "pago" }]);
  // Desde ahí entra al ciclo de todos: la siguiente cuota es entera, del 01/12 al 01/01.
  const sig = await cobrar(s, "2026-11-25");
  assert.equal(sig.parcial, null); assert.equal(Number(sig.r.total), 30000);
  assert.deepEqual((await coberturas(s)).map((c) => `${c.desde}→${c.hasta}`), ["2026-11-20→2026-12-01", "2026-12-01→2027-01-01"]);
});

test("proporcional, mes de 31 días: 21 de 31 y redondeo a $100", async () => {
  await config("proporcional");
  const s = await nuevoSocio("Prop 31");
  const { r, parcial } = await cobrar(s, "2026-12-11");
  assert.deepEqual([parcial.dias, parcial.dias_ciclo], [21, 31]);
  assert.equal(Number(r.total), 20300);              // 30000 * 21 / 31 = 20322,58 → 20300
  assert.deepEqual(await coberturas(s), [{ desde: "2026-12-11", hasta: "2027-01-01", origen: "pago" }]);
});

test("proporcional en febrero: 14 de 28 días", async () => {
  await config("proporcional");
  const s = await nuevoSocio("Prop feb");
  const { r, parcial } = await cobrar(s, "2027-02-15");
  assert.deepEqual([parcial.dias, parcial.dias_ciclo], [14, 28]);
  assert.equal(Number(r.total), 15000);
  assert.deepEqual(await coberturas(s), [{ desde: "2027-02-15", hasta: "2027-03-01", origen: "pago" }]);
});

test("sin redondeo (0) el proporcional es al centavo", async () => {
  await config("proporcional", { redondeo: 0 });
  const s = await nuevoSocio("Prop centavos");
  const { r } = await cobrar(s, "2026-12-11");
  assert.equal(Number(r.total), 20322.58);
  await config("proporcional");
});

test("se anota justo el día fijo: cuota entera, sin parcial", async () => {
  await config("proporcional");
  const s = await nuevoSocio("Justo el 1");
  const { r, parcial } = await cobrar(s, "2026-12-01");
  assert.equal(parcial, null); assert.equal(Number(r.total), 30000);
  assert.deepEqual(await coberturas(s), [{ desde: "2026-12-01", hasta: "2027-01-01", origen: "pago" }]);
});

test("mes entero: paga la cuota entera y queda cubierto hasta el día fijo del mes siguiente", async () => {
  await config("mes_entero");
  const s = await nuevoSocio("Mes entero");
  const { r, parcial } = await cobrar(s, "2026-11-20");
  assert.equal(parcial.modo, "mes_entero"); assert.equal(Number(r.total), 30000);
  assert.deepEqual(await coberturas(s), [{ desde: "2026-11-20", hasta: "2027-01-01", origen: "pago" }]);
});

test("gratis hasta el día fijo: no paga nada y queda cubierto hasta el día fijo", async () => {
  await config("gratis");
  const s = await nuevoSocio("Gratis");
  const { r, parcial } = await cobrar(s, "2026-11-20");
  assert.equal(parcial.modo, "gratis"); assert.equal(Number(r.total), 0);
  assert.deepEqual(await coberturas(s), [{ desde: "2026-11-20", hasta: "2026-12-01", origen: "pago" }]);
  const [{ n }] = await t.q(`select count(*)::int as n from public.pagos where venta_id = $1`, [r.venta_id]);
  assert.equal(n, 0);
});

test("la primera cuota parcial se cobra sola (no se mezcla con más cuotas)", async () => {
  await config("proporcional");
  const s = await nuevoSocio("Dos cuotas");
  await t.falla(() => cobrar(s, "2026-11-20", 2), /primera cuota es parcial/);
});

test("cambiar el modo no toca lo ya cobrado", async () => {
  await config("proporcional");
  const s = await nuevoSocio("Cambio de modo");
  await cobrar(s, "2026-11-20");
  const antes = await coberturas(s);
  const m = await t.en("2026-11-25");
  const [{ x: accesoAntes }] = await t.q(`select to_jsonb(privado.calcular_acceso($1, $2, $3)) as x`, [s, m, t.sede]);
  const [{ n: ventasAntes }] = await t.q(`select count(*)::int as n from public.ventas where socio_id = $1`, [s]);
  for (const modo of ["gratis", "mes_entero", "completo", "proporcional"]) await config(modo);
  await como(uDueno, async () => {
    await t.q(`select public.guardar_regla_vencimiento($1, '{"renovacion":"continua","primera_cuota":"gratis"}')`, [t.g]);
    assert.deepEqual(await mirar(`select primera_cuota from public.configuracion_vencimiento where gimnasio_id = $1`, [t.g]), [{ primera_cuota: "gratis" }]);
  });
  assert.deepEqual(await coberturas(s), antes);
  const [{ n: ventasDespues }] = await t.q(`select count(*)::int as n from public.ventas where socio_id = $1`, [s]);
  assert.equal(ventasDespues, ventasAntes);
  const [{ x: accesoDespues }] = await t.q(`select to_jsonb(privado.calcular_acceso($1, $2, $3)) as x`, [s, m, t.sede]);
  assert.deepEqual(accesoDespues, accesoAntes);
});

test("un plan que usa la regla del gimnasio la sigue; uno con la suya, no", async () => {
  await t.q(`insert into public.configuracion_vencimiento (gimnasio_id, renovacion, dia_fijo, primera_cuota) values ($1, 'dia_fijo', 5, 'proporcional')
             on conflict (gimnasio_id) do update set renovacion = 'dia_fijo', dia_fijo = 5, primera_cuota = 'proporcional'`, [t.g]);
  const [{ id: delGim }] = await t.q(`insert into public.planes (gimnasio_id, tipo, nombre, duracion_meses, renovacion, usa_regla_gimnasio)
                                      values ($1, 'membresia', 'Sigue al gimnasio', 1, 'continua', true) returning id`, [t.g]);
  const [{ r: a }] = await t.q(`select to_jsonb(privado.regla_vencimiento($1)) as r`, [delGim]);
  assert.deepEqual([a.p_renovacion, a.p_dia_fijo], ["dia_fijo", 5]);
  const [{ r: b }] = await t.q(`select to_jsonb(privado.regla_vencimiento($1)) as r`, [plan]);
  assert.deepEqual([b.p_renovacion, b.p_dia_fijo], ["dia_fijo", 1]);
  await t.q(`update public.configuracion_vencimiento set renovacion = 'continua', dia_fijo = null where gimnasio_id = $1`, [t.g]);
  const [{ r: c }] = await t.q(`select to_jsonb(privado.regla_vencimiento($1)) as r`, [delGim]);
  assert.equal(c.p_renovacion, "continua");
});

test("la pantalla: solo el dueño guarda; el encargado lee; queda escrito quién y qué cambió", async () => {
  await t.falla(() => como(uRec, () => t.q(`select public.reglas_vencimiento($1)`, [t.g])), /Sin permiso/);
  await t.falla(() => como(uEnc, () => t.q(`select public.guardar_regla_vencimiento($1, '{"primera_cuota":"gratis"}')`, [t.g])), /Sin permiso/);
  const lectura = await como(uEnc, async () => (await t.q(`select public.reglas_vencimiento($1) as r`, [t.g]))[0].r);
  assert.ok(Array.isArray(lectura.planes) && lectura.planes.some((p) => p.plan_id === plan));
  await t.falla(() => como(uDueno, () => t.q(`select public.guardar_regla_vencimiento($1, '{"renovacion":"dia_fijo"}')`, [t.g])), /qué día vencen/);
  await t.falla(() => como(uDueno, () => t.q(`select public.guardar_regla_vencimiento($1, '{"renovacion":"dia_fijo","dia_fijo":31}')`, [t.g])), /del 1 al 28/);
  await t.falla(() => como(uDueno, () => t.q(`select public.guardar_regla_vencimiento($1, '{"primera_cuota":"regalada"}')`, [t.g])), /Primera cuota/);
  await t.falla(() => como(uDueno, () => t.q(`select public.guardar_regla_vencimiento($1, '{"descuento":5}')`, [t.g])), /no se pueden cambiar/);
  await como(uDueno, async () => {
    const [{ r }] = await t.q(`select public.guardar_regla_vencimiento($1, '{"renovacion":"dia_fijo","dia_fijo":10,"primera_cuota":"mes_entero","redondeo":500}') as r`, [t.g]);
    assert.deepEqual([r.renovacion, r.dia_fijo, r.primera_cuota, Number(r.redondeo)], ["dia_fijo", 10, "mes_entero", 500]);
    const [h] = await mirar(`select c.tema, c.despues, q.nombre from public.cambios_cobro c join public.equipo q on q.id = c.equipo_id
                              where c.gimnasio_id = $1 and c.tema = 'vencimiento' order by c.cambiado_en desc, c.id limit 1`, [t.g]);
    assert.equal(h.nombre, "Dueña"); assert.equal(h.despues.dia_fijo, 10);
  });
  const [{ id }] = await t.q(`insert into public.cambios_cobro (gimnasio_id, tema, detalle) values ($1, 'vencimiento', 'x') returning id`, [t.g]);
  await t.falla(() => t.q(`update public.cambios_cobro set detalle = 'otra cosa' where id = $1`, [id]), /solo se puede cambiar/);
});

test("un plan puede pisar la regla (solo el dueño)", async () => {
  await t.q(`delete from public.configuracion_vencimiento where gimnasio_id = $1`, [t.g]);
  const [{ id: p2 }] = await t.q(`insert into public.planes (gimnasio_id, tipo, nombre, duracion_meses, renovacion) values ($1, 'membresia', 'Libre', 1, 'continua') returning id`, [t.g]);
  await t.falla(() => como(uDueno, () => t.q(`select public.guardar_regla_plan($1, true)`, [p2])), /Primero elegí la regla del gimnasio/);
  await t.falla(() => como(uEnc, () => t.q(`select public.guardar_regla_plan($1, false, 'dia_fijo', 5)`, [p2])), /Sin permiso/);
  await t.falla(() => como(uDueno, () => t.q(`select public.guardar_regla_plan($1, false, 'dia_fijo', null)`, [p2])), /elegí el día/);
  await como(uDueno, async () => {
    await t.q(`select public.guardar_regla_plan($1, false, 'dia_fijo', 5)`, [p2]);
    const [pl] = await mirar(`select renovacion, dia_fijo, usa_regla_gimnasio from public.planes where id = $1`, [p2]);
    assert.deepEqual([pl.renovacion, pl.dia_fijo, pl.usa_regla_gimnasio], ["dia_fijo", 5, false]);
    const [h] = await mirar(`select detalle from public.cambios_cobro where gimnasio_id = $1 and tema = 'plan'`, [t.g]);
    assert.match(h.detalle, /Libre/);
  });
});

test("la simulación de la pantalla da lo mismo que se cobra", async () => {
  await config("proporcional");
  const sim = await como(uDueno, async () => (await t.q(`select public.simular_cuota($1, $2, '2026-12-11') as r`, [t.g, plan]))[0].r);
  assert.equal(sim.parcial, true); assert.equal(Number(sim.precio), 20300);
  assert.match(sim.texto, /21 días de 31/);
});

test("la hoja Cobrar y la base coinciden: precios_venta trae el precio ya escalado y vender cobra lo mismo", async () => {
  await config("proporcional");
  const s = await nuevoSocio("Hoja");
  await como(uRec, async () => {
    const [{ r: v }] = await t.q(`select public.precios_venta($1, $2) as r`, [t.sede, s]);
    const unitario = Number(v.cuota.precios.transferencia);
    // Hoy puede ser el día fijo o no: en los dos casos lo que muestra la hoja es lo que cobra vender.
    const [{ r }] = await t.q(`select public.vender($1, $2::jsonb, $3::jsonb, $4) as r`,
      [t.sede, JSON.stringify([{ tipo: "cuota" }]), JSON.stringify(unitario > 0 ? [{ medio: "transferencia", monto: unitario }] : []), s]);
    assert.equal(Number(r.total), unitario);
  });
});
