// C10 (20261111150100) · Cargar socios en el pasado.
// Un socio con alta y pago de hace 20 días da EXACTAMENTE el mismo veredicto que si se hubiera cobrado ese día;
// la caja de hoy no cambia; el Resultado del mes de la fecha del pago incluye el pago y el del mes actual no;
// el pago queda marcado (quién y cuándo se cargó); sin fechas futuras; la alerta VD-10 de "cobro con fecha atrasada"
// no suena en el primer mes del gimnasio y sí después; solo dueño y encargado cargan; todo o nada.
// Los momentos de la puerta son fijos (hora 19:00 de días relativos); lo único que sigue al reloj es "hoy" del gimnasio.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir } from "./_comun.mjs";

let t, u = {}, eq = {}, hoy, caja, turno, otro = {};
const dia = (d, n) => { const x = new Date(`${d}T00:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
async function como(usuario, fn) {
  await t.db.query("set role authenticated");
  await t.q(`select set_config('request.jwt.claims', $1, false)`, [JSON.stringify({ sub: usuario, role: "authenticated" })]);
  try { return await fn(); } finally { await t.db.query("reset role"); await t.q(`select set_config('request.jwt.claims', '', false)`); }
}
const fallaComo = (usuario, fn, patron) => como(usuario, () => t.falla(fn, patron));
const acceso = async (socio, m) => (await t.q(`select (privado.calcular_acceso($1, $2, $3)).*`, [socio, m, t.sede]))[0];
const alta = (usuario, datos, plan, fechaAlta, pagos) => como(usuario, async () => (await t.q(
  `select public.alta_socio_pasado($1, $2, $3::jsonb, $4, $5::date, $6::jsonb) as r`,
  [t.g, t.sede, JSON.stringify(datos), plan, fechaAlta, JSON.stringify(pagos)]))[0].r);
let dniN = 30000000;
const nuevo = (nombre) => ({ nombre, apellido: "Pasado", dni: String(++dniN) });
const resumen = async () => (await t.q(`select privado.resumen_turno($1) as r`, [turno]))[0].r;
const resultado = (usuario, mes) => como(usuario, async () => (await t.q(`select public.resultado_mes($1, $2::date) as r`, [t.g, mes]))[0].r);
const coberturas = (socio) => t.q(`select desde, hasta from public.coberturas where socio_id = $1 and anulada_en is null order by desde`, [socio]);

before(async () => {
  t = await abrir("prueba-cargar-pasado");
  for (const [rol, nombre] of [["dueno", "Sofía"], ["encargado", "Martín"], ["recepcion", "Ana"], ["profe", "Diego"]]) {
    const [{ id }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`${rol}${Math.random()}@ejemplo.invalid`]);
    const [{ id: e }] = await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,$3,$4) returning id`, [t.g, id, nombre, rol]);
    u[rol] = id; eq[rol] = e;
  }
  [{ hoy }] = await t.q(`select (now() at time zone zona_horaria)::date::text as hoy from public.gimnasios where id = $1`, [t.g]);
  // Una caja con su turno abierto y efectivo cobrado de verdad hoy: eso es lo que no se tiene que mover.
  [{ id: caja }] = await t.q(`insert into public.cajas (gimnasio_id, sede_id, nombre) values ($1,$2,'Recepción') returning id`, [t.g, t.sede]);
  [{ id: turno }] = await t.q(`insert into public.turnos_caja (gimnasio_id, caja_id, abierto_por, abierto_en, monto_inicial) values ($1,$2,$3, now(), 5000) returning id`, [t.g, caja, eq.recepcion]);
  const [{ id: agua }] = await t.q(`insert into public.productos (gimnasio_id, nombre, precio) values ($1,'Agua',1500) returning id`, [t.g]);
  await t.q(`select privado.vender($1,$2,null,$3::jsonb,$4::jsonb,$5,$6,null, now())`,
    [t.g, t.sede, JSON.stringify([{ tipo: "producto", producto_id: agua, cantidad: 2 }]), JSON.stringify([{ medio: "efectivo", monto: 3000 }]), turno, eq.recepcion]);
  // Otro gimnasio con su dueño: no puede cargar en el nuestro.
  const [{ id: gx }] = await t.q(`insert into public.gimnasios (slug, nombre) values ('prueba-cargar-pasado-otro', 'Otro') returning id`);
  const [{ id: ux }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`otro${Math.random()}@ejemplo.invalid`]);
  await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,'Bruno','dueno')`, [gx, ux]);
  otro = { g: gx, dueno: ux };
});
after(async () => t && t.cerrar());

test("alta y pago de hace 20 días: el mismo veredicto y las mismas coberturas que si se hubiera cobrado ese día", async () => {
  const d = dia(hoy, -20);
  // A: cargado hoy, en el pasado.
  const a = await alta(u.encargado, nuevo("Ana"), t.ctx.planes.full, d, [{ fecha: d, monto: "25000", medio: "transferencia" }]);
  assert.equal(a.pagos, 1); assert.equal(a.coberturas, 1); assert.equal(Number(a.total), 25000);
  // B: el mismo socio cobrado "ese día" por el camino de siempre (venta de mostrador en ese momento).
  const [{ id: b }] = await t.q(`insert into public.socios (gimnasio_id, nombre, apellido, creado_en) values ($1,'Beto','Pasado', privado.medianoche($2::date, $3)) returning id`, [t.g, d, t.ctx.zona]);
  await t.q(`insert into public.suscripciones (gimnasio_id, socio_id, plan_id, inicio) values ($1,$2,$3, privado.medianoche($4::date, $5))`, [t.g, b, t.ctx.planes.full, d, t.ctx.zona]);
  const momentoPago = (await t.q(`select privado.medianoche($1::date, $2) + interval '12 hours' as m`, [d, t.ctx.zona]))[0].m;
  await t.q(`select privado.vender($1,$2,$3,$4::jsonb,$5::jsonb,null,$6,null,$7)`,
    [t.g, t.sede, b, JSON.stringify([{ tipo: "cuota", cantidad: 1 }]), JSON.stringify([{ medio: "transferencia", monto: 25000 }]), eq.encargado, momentoPago]);
  const ca = await coberturas(a.socio_id), cb = await coberturas(b);
  assert.equal(ca.length, 1);
  assert.deepEqual(ca.map((c) => [c.desde.toISOString(), c.hasta.toISOString()]), cb.map((c) => [c.desde.toISOString(), c.hasta.toISOString()]), "mismas coberturas");
  for (const n of [-25, -20, -5, 0, 9, 10, 11, 40]) {
    const m = await t.en(dia(hoy, n));
    const va = await acceso(a.socio_id, m), vb = await acceso(b, m);
    for (const campo of ["puede", "color", "motivo", "texto", "para_regularizar"]) {
      assert.deepEqual(va[campo], vb[campo], `día ${n}: ${campo} igual`);
    }
  }
  const [{ cubierto_hasta, creado_en }] = await t.q(`select cubierto_hasta, creado_en from public.socios where id = $1`, [a.socio_id]);
  assert.equal(cubierto_hasta.toISOString(), ca[0].hasta.toISOString(), "cubierto_hasta lo dejó el trigger");
  assert.equal(creado_en.toISOString(), ca[0].desde.toISOString(), "el alta es el día pasado");
  const [{ malos }] = await t.q(`select count(*)::int as malos from public.socios where id = $1 and cubierto_hasta is distinct from privado.calcular_cubierto_hasta(id)`, [a.socio_id]);
  assert.equal(malos, 0, "guardado = recalculado");
});

test("varios pagos pasados encadenan como cobrados cada día; la deuda sale bien", async () => {
  // Alta hace 80 días, cuotas hace 80 y 50 días: la cobertura llega hasta hace ~20 días y hoy está vencido.
  const a = await alta(u.dueno, nuevo("Carla"), t.ctx.planes.full, dia(hoy, -80),
    [{ fecha: dia(hoy, -50), monto: "25.000", medio: "efectivo" }, { fecha: dia(hoy, -80), monto: "25000,00", medio: "debito" }]);
  assert.equal(a.pagos, 2); assert.equal(Number(a.total), 50000);
  const cs = await coberturas(a.socio_id);
  assert.equal(cs.length, 2);
  assert.equal(cs[0].hasta.toISOString(), cs[1].desde.toISOString(), "la segunda empieza donde termina la primera (renovación continua)");
  const v = await acceso(a.socio_id, await t.en(hoy));
  assert.equal(v.puede, false); assert.equal(v.motivo, "vencida");
  assert.ok(Number(v.para_regularizar) >= 25000, "la deuda sale de la cobertura real");
  const [{ cubierto_hasta }] = await t.q(`select cubierto_hasta from public.socios where id = $1`, [a.socio_id]);
  assert.equal(cubierto_hasta.toISOString(), cs[1].hasta.toISOString());
});

test("la caja de hoy no cambia, ni con efectivo: el pago queda sin turno y marcado quién y cuándo lo cargó", async () => {
  const antes = await resumen();
  assert.equal(Number(antes.efectivo), 3000);
  const a = await alta(u.encargado, nuevo("Dora"), t.ctx.planes.full, dia(hoy, -10), [{ fecha: dia(hoy, -10), monto: 25000, medio: "efectivo" }]);
  const despues = await resumen();
  assert.deepEqual(despues, antes, "el total y el esperado del turno son los mismos");
  assert.equal(Number(despues.esperado), 8000);
  const [p] = await t.q(`select p.turno_caja_id, p.cargado_despues_en, p.cargado_despues_por, p.aprobado_en, p.medio, v.turno_caja_id as turno_venta, v.otro_dia_motivo, v.registrada_en, v.creado_por
                           from public.pagos p join public.ventas v on v.id = p.venta_id where v.socio_id = $1`, [a.socio_id]);
  assert.equal(p.medio, "efectivo"); assert.equal(p.turno_caja_id, null); assert.equal(p.turno_venta, null);
  assert.equal(p.cargado_despues_por, eq.encargado);
  assert.ok(p.cargado_despues_en && Date.now() - p.cargado_despues_en.getTime() < 60000, "cuándo se cargó de verdad: ahora");
  assert.ok(p.aprobado_en < new Date(Date.now() - 9 * 86400000), "la fecha del pago es la pasada");
  assert.ok(p.otro_dia_motivo && p.registrada_en, "la venta queda marcada para Control");
  // La base no deja ponerlo en una caja después, ni un efectivo común sin turno.
  await t.falla(() => t.q(`update public.pagos set turno_caja_id = $1 where venta_id in (select id from public.ventas where socio_id = $2)`, [turno, a.socio_id]), /pagos_cargado_sin_caja|no se puede|solo se puede cambiar/i);
  const [{ v }] = await t.q(`select id as v from public.ventas where socio_id = $1`, [a.socio_id]);
  await t.falla(() => t.q(`insert into public.pagos (gimnasio_id, venta_id, medio, monto, estado, aprobado_en) values ($1,$2,'efectivo',100,'aprobado', now())`, [t.g, v]), /pagos_efectivo_con_turno/);
});

test("el pago cuenta en el Resultado del mes de SU fecha, no en el del mes actual", async () => {
  const mesActual = `${hoy.slice(0, 7)}-01`;
  const fecha = dia(mesActual, -10);                       // un día del mes anterior
  const mesPago = `${fecha.slice(0, 7)}-01`;
  const antesMes = await resultado(u.dueno, mesPago), antesHoy = await resultado(u.dueno, mesActual);
  await alta(u.encargado, nuevo("Elena"), t.ctx.planes.full, fecha, [{ fecha, monto: "25000", medio: "transferencia" }]);
  const despuesMes = await resultado(u.dueno, mesPago), despuesHoy = await resultado(u.dueno, mesActual);
  assert.equal(Number(despuesMes.cobrado) - Number(antesMes.cobrado), 25000, "el mes de la fecha del pago suma el pago");
  assert.equal(Number(despuesHoy.cobrado), Number(antesHoy.cobrado), "el mes actual no cambia");
  assert.equal(Number(despuesHoy.anterior_total) - Number(antesHoy.anterior_total), 25000, "visto desde el mes actual es el mes anterior");
  const dd = despuesMes.por_dia?.find((x) => x.dia === fecha);
  if (despuesMes.por_dia) assert.ok(dd && Number(dd.total) >= 25000, "y en su día");
  assert.equal(despuesMes.altas - antesMes.altas, 1, "el alta también cuenta en el mes de su fecha");
});

test("sin fechas futuras ni de hoy, ni antes del alta; errores en palabras; todo o nada", async () => {
  const cuenta = async () => (await t.q(`select count(*)::int as n from public.socios where gimnasio_id = $1`, [t.g]))[0].n;
  const ventasAntes = (await t.q(`select count(*)::int as n from public.ventas where gimnasio_id = $1`, [t.g]))[0].n;
  const antes = await cuenta();
  const mal = (pagos, fechaAlta, patron, plan = t.ctx.planes.full) =>
    fallaComo(u.dueno, () => t.q(`select public.alta_socio_pasado($1, $2, $3::jsonb, $4, $5::date, $6::jsonb)`,
      [t.g, t.sede, JSON.stringify(nuevo("Mal")), plan, fechaAlta, JSON.stringify(pagos)]), patron);
  await mal([{ fecha: dia(hoy, 1), monto: "25000", medio: "efectivo" }], dia(hoy, -3), /es futura/);
  await mal([{ fecha: hoy, monto: "25000", medio: "efectivo" }], dia(hoy, -3), /es hoy.*Cobrar/);
  await mal([{ fecha: dia(hoy, -5), monto: "25000", medio: "efectivo" }], dia(hoy, -3), /anterior a la fecha de alta/);
  await mal([{ fecha: dia(hoy, -5), monto: "0", medio: "efectivo" }], dia(hoy, -9), /monto/);
  await mal([{ fecha: dia(hoy, -5), monto: "25,000", medio: "efectivo" }], dia(hoy, -9), /monto/);
  await mal([{ fecha: dia(hoy, -5), monto: "25000", medio: "mercadopago" }], dia(hoy, -9), /medio/);
  await mal([{ fecha: dia(hoy, -5), monto: "25000", medio: "" }], dia(hoy, -9), /falta el medio/);
  await mal([{ fecha: "31/31/2026", monto: "25000", medio: "efectivo" }], dia(hoy, -9), /no se entiende/);
  await mal([{ fecha: dia(hoy, -5), monto: "25000", medio: "efectivo" }], dia(hoy, 2), /fecha de alta no puede ser futura/);
  await mal([{ fecha: dia(hoy, -5), monto: "25000", medio: "efectivo" }], dia(hoy, -9), /elegí el plan/, null);
  await mal([{ fecha: dia(hoy, -5), monto: "25001", medio: "efectivo", cuotas: 3 }], dia(hoy, -9), /no se reparte en 3 cuotas/);
  // El segundo pago está mal: el primero tampoco queda, y tampoco el socio.
  await mal([{ fecha: dia(hoy, -8), monto: "25000", medio: "efectivo" }, { fecha: dia(hoy, 3), monto: "25000", medio: "efectivo" }], dia(hoy, -9), /es futura/);
  assert.equal(await cuenta(), antes, "ningún socio a medias");
  assert.equal((await t.q(`select count(*)::int as n from public.ventas where gimnasio_id = $1`, [t.g]))[0].n, ventasAntes, "ningún pago a medias");
});

test("solo dueño y encargado cargan pagos pasados: recepción, profe y otro gimnasio reciben un error", async () => {
  const pagos = [{ fecha: dia(hoy, -5), monto: "25000", medio: "efectivo" }];
  for (const rol of ["recepcion", "profe"]) {
    const e = await fallaComo(u[rol], () => t.q(`select public.alta_socio_pasado($1, $2, $3::jsonb, $4, $5::date, $6::jsonb)`,
      [t.g, t.sede, JSON.stringify(nuevo("Sin permiso")), t.ctx.planes.full, dia(hoy, -5), JSON.stringify(pagos)]), /Sin permiso/);
    assert.equal(e.code, "42501", rol);
  }
  const e = await fallaComo(otro.dueno, () => t.q(`select public.alta_socio_pasado($1, $2, $3::jsonb, $4, $5::date, $6::jsonb)`,
    [t.g, t.sede, JSON.stringify(nuevo("Ajeno")), t.ctx.planes.full, dia(hoy, -5), JSON.stringify(pagos)]), /Sin permiso/);
  assert.equal(e.code, "42501");
  // La importación ya era de dueño y encargado.
  await fallaComo(u.recepcion, () => t.q(`select public.importar_socios($1, $2::jsonb, 'x')`, [t.g, JSON.stringify([{ nombre: "Z" }])]), /Sin permiso/);
});

test("VD-10: la carga inicial del primer mes no avisa; una carga atrasada después del primer mes sí", async () => {
  const claves = async () => (await como(u.dueno, async () => (await t.q(`select public.campana_control($1) as r`, [t.g]))[0].r)).items
    .filter((i) => String(i.clave).startsWith("otro_dia:")).map((i) => i.clave);
  const base = await claves();
  // Los de arriba se cargaron en el primer mes del gimnasio (recién creado): no hay aviso de ninguno.
  assert.deepEqual(base, [], "la carga inicial no dispara el aviso");
  const [{ n }] = await t.q(`select count(*)::int as n from public.ventas where gimnasio_id = $1 and carga_inicial`, [t.g]);
  assert.ok(n >= 4, "están marcadas como carga inicial");
  // Control las sigue mostrando, con quién las cargó.
  const linea = await como(u.dueno, async () => (await t.q(`select public.linea_de_control($1, $2::date, $3::date, array['otro_dia'], null, 200, null) as r`, [t.g, dia(hoy, -3), hoy]))[0].r);
  assert.ok(linea.items.length >= n && linea.items.every((i) => i.tipo === "otro_dia"), "Control lista las cargas");
  assert.ok(linea.items.some((i) => i.quien === "Martín" && /Carga|Alta/.test(i.detalle)), "quién las cargó y con qué motivo");
  // El gimnasio ya tiene más de un mes de vida: la misma carga atrasada sí avisa.
  await t.q(`update public.gimnasios set creado_en = now() - interval '60 days' where id = $1`, [t.g]);
  const a = await alta(u.encargado, nuevo("Fede"), t.ctx.planes.full, dia(hoy, -15), [{ fecha: dia(hoy, -15), monto: "25000", medio: "transferencia" }]);
  const [{ id: ventaId, carga_inicial }] = await t.q(`select id, carga_inicial from public.ventas where socio_id = $1`, [a.socio_id]);
  assert.equal(carga_inicial, false);
  assert.deepEqual(await claves(), [`otro_dia:${ventaId}`], "avisa, y solo ese");
});

test("importar con pagos pasados: revisa en palabras, carga todo en una transacción, no duplica y no se deshace", async () => {
  const d1 = dia(hoy, -40), d2 = dia(hoy, -10);
  const filas = [
    { nombre: "Gala", apellido: "Importada", dni: "41000001", plan: "Plan Full", alta: d1, pagos: [{ fecha: d1, monto: "25.000", medio: "Transferencia" }, { fecha: d2, monto: "25000", medio: "efectivo" }] },
    { nombre: "Hugo", apellido: "Importado", dni: "41000002", plan: "Plan Full", pagos: [{ fecha: dia(hoy, -20), monto: "25000", medio: "débito" }] },
    { nombre: "Iris", apellido: "Mala", dni: "41000003", plan: "Plan Full", pagos: [{ fecha: dia(hoy, 4), monto: "25000", medio: "efectivo" }] },
    { nombre: "Juan", apellido: "Doble", dni: "41000004", plan: "Plan Full", vence: "31/12/2030", pagos: [{ fecha: d2, monto: "25000", medio: "efectivo" }] },
    { nombre: "Karen", apellido: "SinPlan", dni: "41000005", pagos: [{ fecha: d2, monto: "25000", medio: "efectivo" }] },
    { nombre: "Lola", apellido: "SinPagos", dni: "41000006", plan: "Plan Full", alta: d2 },
  ];
  const rev = await como(u.encargado, async () => (await t.q(`select public.revisar_importacion($1, $2::jsonb) as r`, [t.g, JSON.stringify(filas)]))[0].r);
  assert.equal(rev.validas, 3); assert.equal(Number(rev.pagos), 3); assert.equal(Number(rev.monto_pagos), 75000);
  const err = (n) => rev.filas[n].errores.join(" | ");
  assert.match(err(2), /es futura/); assert.match(err(3), /“pagó hasta” o los pagos/); assert.match(err(4), /pagos pero no plan/);
  assert.equal(rev.filas[1].datos.alta, d1.replace(d1, dia(hoy, -20)), "sin fecha de alta, el alta es el día del primer pago");

  const antes = await resumen();
  const r = await como(u.encargado, async () => (await t.q(`select public.importar_socios($1, $2::jsonb, 'socios-viejos.csv') as r`, [t.g, JSON.stringify(filas)]))[0].r);
  assert.equal(r.importados, 3); assert.equal(r.pagos_cargados, 3); assert.equal(Number(r.monto_pagos), 75000);
  assert.deepEqual(await resumen(), antes, "la caja de hoy no se movió");
  const [gala] = await t.q(`select id, cubierto_hasta from public.socios where gimnasio_id = $1 and dni = '41000001'`, [t.g]);
  const cg = await coberturas(gala.id);
  assert.equal(cg.length, 2); assert.equal(gala.cubierto_hasta.toISOString(), cg[1].hasta.toISOString());
  const [{ n }] = await t.q(`select count(*)::int as n from public.pagos p join public.ventas v on v.id = p.venta_id
                              where v.importacion_id = $1 and p.cargado_despues_por = $2 and p.turno_caja_id is null`, [r.importacion_id, eq.encargado]);
  assert.equal(n, 3, "todos marcados: quién los cargó");
  // Volver a subir el mismo archivo no duplica plata.
  const ventas = (await t.q(`select count(*)::int as n from public.ventas where gimnasio_id = $1`, [t.g]))[0].n;
  const otra = await como(u.encargado, async () => (await t.q(`select public.importar_socios($1, $2::jsonb, 'socios-viejos.csv') as r`, [t.g, JSON.stringify(filas)]))[0].r);
  assert.equal(otra.pagos_cargados, 0); assert.equal(otra.importados, 0);
  assert.equal((await t.q(`select count(*)::int as n from public.ventas where gimnasio_id = $1`, [t.g]))[0].n, ventas);
  // La plata no se deshace de un golpe.
  await fallaComo(u.dueno, () => t.q(`select public.deshacer_importacion($1, $2)`, [t.g, r.importacion_id]), /cargó pagos: la plata no se borra/);
});

test("los montos se entienden como se escriben en Argentina", async () => {
  const m = async (x) => (await t.q(`select privado.monto_importado($1) as m`, [x]))[0].m;
  assert.equal(Number(await m("25000")), 25000);
  assert.equal(Number(await m("25.000")), 25000);
  assert.equal(Number(await m("$ 25.000,50")), 25000.5);
  assert.equal(Number(await m("25000,5")), 25000.5);
  assert.equal(Number(await m("1,234.56")), 1234.56);
  await t.falla(() => m("25,000"), /monto/);
  await t.falla(() => m("abc"), /monto/);
});
