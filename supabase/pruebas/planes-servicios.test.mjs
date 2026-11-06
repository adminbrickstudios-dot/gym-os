// VD-17 (4700): servicios adicionales que se suman a la cuota, y los ajustes de cada plan
// (tolerancia, consume_en, visible en la página, sedes, orden). Permisos por rol.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir } from "./_comun.mjs";

let t, uDueno, uEnc, uRec, plan, pack, locker, toalla, socio, otro;
async function como(usuario, fn) {
  await t.db.query("savepoint c");
  try {
    await t.db.query("set local role authenticated");
    await t.q(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: usuario, role: "authenticated" })]);
    return await fn();
  } finally { await t.db.query("rollback to savepoint c"); }
}
before(async () => {
  t = await abrir("prueba-planes-servicios");
  for (const [rol, nombre] of [["dueno", "Dueña"], ["encargado", "Beto"], ["recepcion", "Sofi"]]) {
    const [{ id }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`${rol}${Math.random()}@ejemplo.invalid`]);
    await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,$3,$4)`, [t.g, id, nombre, rol]);
    if (rol === "dueno") uDueno = id; else if (rol === "encargado") uEnc = id; else uRec = id;
  }
  [{ id: plan }] = await t.q(`insert into public.planes (gimnasio_id, tipo, nombre, duracion_meses, renovacion) values ($1, 'membresia', 'Mensual', 1, 'continua') returning id`, [t.g]);
  await t.q(`insert into public.precios_plan (gimnasio_id, plan_id, monto, vigente_desde) values ($1, $2, 30000, '2020-01-01')`, [t.g, plan]);
  [{ id: pack }] = await t.q(`insert into public.planes (gimnasio_id, tipo, nombre, cantidad_clases, validez_dias, consume_en) values ($1, 'pack', 'Pack 8', 8, 60, 'ingreso') returning id`, [t.g]);
  for (const n of ["Con servicio", "Sin servicio"]) {
    const [{ id: s }] = await t.q(`insert into public.socios (gimnasio_id, nombre, apellido) values ($1, 'Prueba', $2) returning id`, [t.g, n]);
    await t.q(`insert into public.suscripciones (gimnasio_id, socio_id, plan_id, inicio) values ($1, $2, $3, '2026-01-01T03:00:00Z')`, [t.g, s, plan]);
    if (n === "Con servicio") socio = s; else otro = s;
  }
});
after(async () => t && t.cerrar());

test("el servicio se crea (dueño y encargado), no sale en el mostrador y la recepción no lo toca", async () => {
  await t.falla(() => como(uRec, () => t.q(`select public.guardar_servicio($1, null, 'Locker', 3000)`, [t.g])));
  locker = await como(uDueno, async () => (await t.q(`select public.guardar_servicio($1, null, 'Locker', 3000) as id`, [t.g]))[0].id);
  toalla = await como(uEnc, async () => (await t.q(`select public.guardar_servicio($1, null, 'Toalla', 1500) as id`, [t.g]))[0].id);
  // El savepoint de `como` descarta lo escrito: se vuelve a crear con la sesión del dueño y se deja.
  await t.q(`insert into public.productos (gimnasio_id, id, nombre, precio, recurrente) values ($1, $2, 'Locker', 3000, true), ($1, $3, 'Toalla', 1500, true)`, [t.g, locker, toalla]);
  const lista = await como(uDueno, async () => (await t.q(`select public.servicios_gimnasio($1) as s`, [t.g]))[0].s);
  assert.deepEqual(lista.map((s) => s.nombre).sort(), ["Locker", "Toalla"]);
  const prods = await como(uDueno, async () => (await t.q(`select * from public.productos_gimnasio($1)`, [t.g])));
  assert.equal(prods.filter((p) => ["Locker", "Toalla"].includes(p.nombre)).length, 0, "productos_gimnasio deja afuera los servicios");
  await t.falla(() => como(uRec, () => t.q(`select public.servicios_gimnasio($1)`, [t.g])));
});

test("asignar: solo dueño o encargado, uno por socio y servicio; quitar deja la historia", async () => {
  await t.falla(() => como(uRec, () => t.q(`select public.asignar_servicio($1, $2, true)`, [socio, locker])));
  await como(uEnc, async () => {
    await t.q(`select public.asignar_servicio($1, $2, true)`, [socio, locker]);
    await t.falla(() => t.q(`select public.asignar_servicio($1, $2, true)`, [socio, locker]), /ya tiene/);
    await t.falla(() => t.q(`select public.asignar_servicio($1, $2, false)`, [otro, locker]), /no tiene/);
  });
  // Un producto común no es un servicio.
  const [{ id: agua }] = await t.q(`insert into public.productos (gimnasio_id, nombre, precio) values ($1, 'Agua', 1000) returning id`, [t.g]);
  await t.falla(() => como(uDueno, () => t.q(`select public.asignar_servicio($1, $2, true)`, [socio, agua])));
  await t.q(`insert into public.servicios_socio (gimnasio_id, socio_id, producto_id, creado_por) select $1, $2, $3, id from public.equipo where gimnasio_id = $1 and rol = 'dueno'`, [t.g, socio, locker]);
});

test("precios_venta lleva los servicios del socio y la cuota los suma en la misma venta", async () => {
  const pv = await como(uRec, async () => (await t.q(`select public.precios_venta($1, $2) as p`, [t.sede, socio]))[0].p);
  assert.deepEqual(pv.servicios.map((s) => s.nombre), ["Locker"]);
  assert.equal(pv.productos.filter((p) => p.nombre === "Locker").length, 0, "los servicios no están en la grilla del mostrador");
  const sin = await como(uRec, async () => (await t.q(`select public.precios_venta($1, $2) as p`, [t.sede, otro]))[0].p);
  assert.deepEqual(sin.servicios, []);

  const cuota = Number(pv.cuota.precios.transferencia ?? pv.cuota.precios.lista);
  const items = [{ tipo: "cuota", cantidad: 1 }, { tipo: "servicio", producto_id: locker, cantidad: 1 }];
  const [{ r }] = await t.q(`select privado.vender($1, $2, $3, $4::jsonb, $5::jsonb, null, null, null, now()) as r`,
    [t.g, t.sede, socio, JSON.stringify(items), JSON.stringify([{ medio: "transferencia", monto: cuota + 3000 }])]);
  assert.equal(Number(r.total), cuota + 3000, "el servicio se suma a la cuota");
  const filas = await t.q(`select tipo, descripcion, precio_unitario from public.venta_items where venta_id = $1 order by tipo`, [r.venta_id]);
  assert.equal(filas.length, 2);
  assert.match(filas.find((f) => f.tipo === "producto").descripcion, /Servicio Locker/);
});

test("el servicio no se cobra solo, ni sin contratarlo, ni por otros meses que la cuota", async () => {
  const pago = (m) => JSON.stringify([{ medio: "transferencia", monto: m }]);
  const vender = (quien, items, monto) => t.q(`select privado.vender($1, $2, $3, $4::jsonb, $5::jsonb, null, null, null, now())`, [t.g, t.sede, quien, JSON.stringify(items), pago(monto)]);
  await t.falla(() => vender(socio, [{ tipo: "servicio", producto_id: locker }], 3000), /junto con la cuota/);
  await t.falla(() => vender(otro, [{ tipo: "cuota" }, { tipo: "servicio", producto_id: locker }], 33000), /no tiene contratado/);
  await t.falla(() => vender(socio, [{ tipo: "cuota", cantidad: 2 }, { tipo: "servicio", producto_id: locker, cantidad: 1 }], 63000), /mismos meses/);
  await t.falla(() => vender(null, [{ tipo: "servicio", producto_id: locker }], 3000), /socio/);
  // Como producto común tampoco.
  await t.falla(() => vender(socio, [{ tipo: "producto", producto_id: locker }], 3000), /Producto inexistente/);
});

test("quitar el servicio: la cuota deja de llevarlo y no se puede cobrar", async () => {
  await como(uDueno, () => t.q(`select public.asignar_servicio($1, $2, false)`, [socio, locker]));
  await t.q(`update public.servicios_socio set hasta = now() + interval '1 second' where socio_id = $1 and hasta is null`, [socio]);
  const pv = await como(uRec, async () => (await t.q(`select public.precios_venta($1, $2) as p`, [t.sede, socio]))[0].p);
  assert.deepEqual(pv.servicios, []);
});

test("ajustes del plan: tolerancia, consume_en, visible en la página y sedes; la recepción no", async () => {
  await t.falla(() => como(uRec, () => t.q(`select public.guardar_ajustes_plan($1, '{"tolerancia_dias": 3}')`, [plan])));
  await como(uDueno, async () => {
    await t.q(`select public.guardar_ajustes_plan($1, '{"tolerancia_dias": 3, "visible_en_landing": false}')`, [plan]);
    await t.q(`select public.guardar_ajustes_plan($1, '{"consume_en": "asistencia"}')`, [pack]);
    const a = (await t.q(`select public.ajustes_planes($1) as a`, [t.g]))[0].a;
    assert.equal(a.planes[plan].tolerancia_dias, 3);
    assert.equal(a.planes[plan].visible_en_landing, false);
    assert.equal(a.planes[pack].consume_en, "asistencia");
    assert.equal(a.planes[plan].renovacion, "continua");
    await t.falla(() => t.q(`select public.guardar_ajustes_plan($1, '{"tolerancia_dias": 90}')`, [plan]), /0 a 60/);
    await t.falla(() => t.q(`select public.guardar_ajustes_plan($1, '{"consume_en": "asistencia"}')`, [plan]), /Solo los packs/);
    await t.falla(() => t.q(`select public.guardar_ajustes_plan($1, '{"consume_en": "nunca"}')`, [pack]), /Elegí/);
    // Sedes: elegir ninguna con "no todas" es un error; elegir una vale.
    await t.falla(() => t.q(`select public.guardar_ajustes_plan($1, jsonb_build_object('todas_las_sedes', false, 'sedes', '[]'::jsonb))`, [plan]), /Elegí en qué sedes/);
    await t.q(`select public.guardar_ajustes_plan($1, jsonb_build_object('todas_las_sedes', false, 'sedes', jsonb_build_array($2::text)))`, [plan, t.sede]);
    const b = (await t.q(`select public.ajustes_planes($1) as a`, [t.g]))[0].a;
    assert.equal(b.planes[plan].todas_las_sedes, false);
    assert.deepEqual(b.planes[plan].sedes, [t.sede]);
  });
});

test("ordenar los planes: queda el orden pedido y no acepta planes ajenos ni repetidos", async () => {
  await como(uEnc, async () => {
    await t.q(`select public.ordenar_planes($1, array[$2, $3]::uuid[])`, [t.g, pack, plan]);
    const o = await t.q(`select id from public.planes where id in ($1, $2) order by orden`, [pack, plan]);
    assert.deepEqual(o.map((x) => x.id), [pack, plan]);
    await t.falla(() => t.q(`select public.ordenar_planes($1, array[$2, $2]::uuid[])`, [t.g, plan]), /repetido/);
    await t.falla(() => t.q(`select public.ordenar_planes($1, array[gen_random_uuid()])`, [t.g]), /no es de este gimnasio/);
  });
  await t.falla(() => como(uRec, () => t.q(`select public.ordenar_planes($1, array[$2]::uuid[])`, [t.g, plan])));
});
