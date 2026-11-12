// H2c (20261112200000) · Fechas de cobertura visibles y editables al cobrar y en el alta en el pasado.
// Sin tocar fechas: la propuesta es la de H2b. Con fechas elegidas por dueño o encargado: esas fechas, con la propuesta y quién las
// cambió guardados (y en Control). Recepción solo ve la propuesta. Fechas inválidas: error en palabras. El monto nunca cambia solo.
// Los días son relativos a "hoy" del gimnasio; los momentos de la puerta, fijos.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir } from "./_comun.mjs";

let t, u = {}, eq = {}, hoy;
const dia = (d, n) => { const x = new Date(`${d}T00:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
const mesDespues = (d) => { const [a, m, x] = d.split("-").map(Number); return new Date(Date.UTC(a, m, x)).toISOString().slice(0, 10); };
async function como(usuario, fn) {
  await t.db.query("set role authenticated");
  await t.q(`select set_config('request.jwt.claims', $1, false)`, [JSON.stringify({ sub: usuario, role: "authenticated" })]);
  try { return await fn(); } finally { await t.db.query("reset role"); await t.q(`select set_config('request.jwt.claims', '', false)`); }
}
let dniN = 51000000;
const nuevo = (nombre) => ({ nombre, apellido: "Fechas", dni: String(++dniN) });
const alta = (plan, fechaAlta, pagos = []) => como(u.dueno, async () => (await t.q(
  `select public.alta_socio_pasado($1, $2, $3::jsonb, $4, $5::date, $6::jsonb) as r`,
  [t.g, t.sede, JSON.stringify(nuevo("Socio")), plan, fechaAlta, JSON.stringify(pagos)]))[0].r);
// El cobro de Cobrar (privado.vender) con o sin fechas elegidas, por la persona del equipo que cobra.
const cobrar = (socio, quien, monto = 25000, fechas = {}) => t.q(`select privado.vender($1,$2,$3,$4::jsonb,$5::jsonb,null,$6,null, now()) as r`,
  [t.g, t.sede, socio, JSON.stringify([{ tipo: "cuota", cantidad: 1, ...fechas }]), JSON.stringify([{ medio: "transferencia", monto }]), eq[quien]]);
const local = async (m) => (await t.q(`select ($1::timestamptz at time zone $2)::date::text as d`, [m, t.ctx.zona]))[0].d;
const coberturas = async (socio) => {
  const filas = await t.q(`select desde, hasta from public.coberturas where socio_id = $1 and anulada_en is null order by desde`, [socio]);
  return Promise.all(filas.map(async (c) => [await local(c.desde), await local(c.hasta)]));
};
const malos = async (socio) => (await t.q(`select count(*)::int as n from public.socios where id = $1 and cubierto_hasta is distinct from privado.calcular_cubierto_hasta(id)`, [socio]))[0].n;
const socioNuevo = async (d) => (await alta(t.ctx.planes.full, d)).socio_id;
const item = async (socio) => (await t.q(`select i.*, i.cubre_desde::text as cubre_desde_txt from public.venta_items i join public.ventas v on v.id = i.venta_id where v.socio_id = $1 and i.tipo = 'cuota' order by v.creado_en desc limit 1`, [socio]))[0];
const hasta = (fn, patron) => t.falla(fn, patron);   // con savepoint: la prueba corre en una sola transacción

before(async () => {
  t = await abrir("prueba-fechas-cobertura");
  for (const [rol, nombre] of [["dueno", "Sofía"], ["encargado", "Martín"], ["recepcion", "Ana"]]) {
    const [{ id }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`${rol}${Math.random()}@ejemplo.invalid`]);
    const [{ id: e }] = await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,$3,$4) returning id`, [t.g, id, nombre, rol]);
    u[rol] = id; eq[rol] = e;
  }
  [{ hoy }] = await t.q(`select (now() at time zone zona_horaria)::date::text as hoy from public.gimnasios where id = $1`, [t.g]);
});
after(async () => t && t.cerrar());

test("sin tocar las fechas: la propuesta es la de H2b y no se guarda ningún cambio", async () => {
  const d = dia(hoy, -10);
  const s = await socioNuevo(d);
  const p = await como(u.recepcion, async () => (await t.q(`select public.periodo_cuota_propuesto($1, $2) as r`, [t.sede, s]))[0].r);
  assert.equal(p.desde, d); assert.equal(p.hasta, dia(mesDespues(d), -1)); assert.equal(p.cubierto_hasta, dia(mesDespues(d), -1));
  assert.equal(p.puede_cambiar, false, "recepción solo ve la propuesta");
  await cobrar(s, "recepcion");
  assert.deepEqual(await coberturas(s), [[d, mesDespues(d)]]);
  const i = await item(s);
  assert.equal(i.cubre_desde, null); assert.equal(i.cubre_cambiada_por, null);
  assert.equal(await malos(s), 0);
});

test("dueño y encargado ven que pueden cambiar las fechas", async () => {
  const s = await socioNuevo(dia(hoy, -10));
  for (const rol of ["dueno", "encargado"]) {
    const p = await como(u[rol], async () => (await t.q(`select public.periodo_cuota_propuesto($1, $2) as r`, [t.sede, s]))[0].r);
    assert.equal(p.puede_cambiar, true, rol);
  }
});

test("fechas cambiadas: la cobertura es esa, con la propuesta y quién la cambió guardadas, y cubierto_hasta = recalculado", async () => {
  const d = dia(hoy, -10);
  const s = await socioNuevo(d);
  const desde = dia(d, 3), hastaIncl = dia(mesDespues(d), 3);   // por ejemplo 5/11 → 4/12
  const monto = 25000;
  await cobrar(s, "encargado", monto, { cubre_desde: desde, cubre_hasta: hastaIncl });
  assert.deepEqual(await coberturas(s), [[desde, dia(hastaIncl, 1)]], "esas fechas, hasta inclusive");
  const i = await item(s);
  assert.equal(i.cubre_desde_txt, desde);
  assert.equal(i.cubre_cambiada_por, eq.encargado, "quién cambió la fecha");
  assert.equal(await local(i.cubre_propuesta_desde), d, "la propuesta era desde el alta");
  assert.equal(await local(i.cubre_propuesta_hasta), mesDespues(d));
  assert.equal(await malos(s), 0, "cubierto_hasta guardado = recalculado");
  // El monto no cambió solo: se cobró lo que se cobró.
  const [{ total }] = await t.q(`select coalesce(sum(p.monto), 0) as total from public.pagos p join public.ventas v on v.id = p.venta_id where v.socio_id = $1`, [s]);
  assert.equal(Number(total), monto);
});

test("fechas iguales a la propuesta: no queda registrado como cambio", async () => {
  const d = dia(hoy, -10);
  const s = await socioNuevo(d);
  await cobrar(s, "dueno", 25000, { cubre_desde: d, cubre_hasta: dia(mesDespues(d), -1) });
  assert.deepEqual(await coberturas(s), [[d, mesDespues(d)]]);
  assert.equal((await item(s)).cubre_cambiada_por, null);
});

test("recepción no puede cambiar las fechas", async () => {
  const s = await socioNuevo(dia(hoy, -10));
  await hasta(() => cobrar(s, "recepcion", 25000, { cubre_desde: dia(hoy, -5), cubre_hasta: dia(hoy, 20) }), /Solo el dueño o el encargado/);
  assert.deepEqual(await coberturas(s), [], "no se cobró nada");
});

test("fechas inválidas: error en palabras y nada se guarda", async () => {
  const d = dia(hoy, -10);
  const s = await socioNuevo(d);
  const prueba = (f, patron) => hasta(() => cobrar(s, "dueno", 25000, f), patron);
  await prueba({ cubre_desde: dia(hoy, 1), cubre_hasta: dia(hoy, 30) }, /no puede empezar en el futuro/);
  await prueba({ cubre_desde: dia(hoy, -3), cubre_hasta: dia(hoy, -5) }, /no puede ser antes/);
  await prueba({ cubre_desde: dia(hoy, -3), cubre_hasta: dia(hoy, 400) }, /máximo 12 meses/);
  await prueba({ cubre_desde: dia(hoy, -3) }, /las dos fechas/);
  await prueba({ cubre_desde: "no-es-fecha", cubre_hasta: dia(hoy, 20) }, /no se entienden/);
  assert.deepEqual(await coberturas(s), [], "ninguna cobertura quedó");
  // Pisar lo ya cubierto: primero se cobra la propuesta y después se intenta cubrir un tramo adentro.
  await cobrar(s, "dueno");
  await prueba({ cubre_desde: dia(d, 5), cubre_hasta: dia(d, 40) }, /se pisan con lo que ya está cubierto/);
  assert.equal((await coberturas(s)).length, 1, "sigue una sola cobertura");
});

test("alta en el pasado: la propuesta que ve el formulario es la de la misma función y no deja rastro", async () => {
  const d = dia(hoy, -20);
  const antes = (await t.q(`select ultimo_numero_socio as n from public.configuracion_gimnasio where gimnasio_id = $1`, [t.g]))[0]?.n;
  const [{ cuantos: c0 }] = await t.q(`select count(*)::int as cuantos from public.socios where gimnasio_id = $1`, [t.g]);
  const p = await como(u.dueno, async () => (await t.q(`select public.periodo_alta_propuesto($1, $2, $3::date, $3::date) as r`, [t.g, t.ctx.planes.full, d]))[0].r);
  assert.equal(p.desde, d); assert.equal(p.hasta, dia(mesDespues(d), -1));
  const [{ cuantos: c1 }] = await t.q(`select count(*)::int as cuantos from public.socios where gimnasio_id = $1`, [t.g]);
  assert.equal(c1, c0, "no quedó ningún socio de vista previa");
  const despues = (await t.q(`select ultimo_numero_socio as n from public.configuracion_gimnasio where gimnasio_id = $1`, [t.g]))[0]?.n;
  assert.equal(despues, antes, "el contador de socios no avanzó");
  // Recepción no lo usa.
  await hasta(() => como(u.recepcion, () => t.q(`select public.periodo_alta_propuesto($1, $2, $3::date, $3::date)`, [t.g, t.ctx.planes.full, d])), /permiso/);
});

test("alta en el pasado con un pago y fechas elegidas: cubre esas fechas", async () => {
  const d = dia(hoy, -20);
  const desde = dia(d, 2), hastaIncl = dia(mesDespues(d), 2);
  const r = await alta(t.ctx.planes.full, d, [{ fecha: d, monto: "25000", medio: "transferencia", cubre_desde: desde, cubre_hasta: hastaIncl }]);
  assert.equal(r.pagos, 1); assert.equal(r.coberturas, 1);
  assert.deepEqual(await coberturas(r.socio_id), [[desde, dia(hastaIncl, 1)]]);
  assert.equal((await item(r.socio_id)).cubre_cambiada_por, eq.dueno);
  assert.equal(await malos(r.socio_id), 0);
  // Sin fechas: la propuesta de siempre.
  const r2 = await alta(t.ctx.planes.full, d, [{ fecha: d, monto: "25000", medio: "transferencia" }]);
  assert.deepEqual(await coberturas(r2.socio_id), [[d, mesDespues(d)]]);
});

test("Control muestra el cobro con otras fechas, con la propuesta y quién la cambió", async () => {
  const d = dia(hoy, -10);
  const s = await socioNuevo(d);
  await cobrar(s, "encargado", 25000, { cubre_desde: dia(d, 3), cubre_hasta: dia(mesDespues(d), 3) });
  const r = await como(u.dueno, async () => (await t.q(`select public.linea_de_control($1, $2::date, $3::date, array['cobertura'], null, 50, null) as r`, [t.g, dia(hoy, -2), dia(hoy, 1)]))[0].r);
  const filas = JSON.stringify(r);
  assert.match(filas, /la propuesta era del/);
  assert.ok(filas.includes(eq.encargado), "dice quién lo cambió");
});
