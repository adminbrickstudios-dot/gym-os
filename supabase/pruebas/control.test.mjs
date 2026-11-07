// VD-10 (20261106004300): Control, la línea de tiempo del dueño.
// La ve el dueño (y el encargado si ve el Resultado); la recepción y el profe reciben un error, no una
// lista vacía. Cada tipo aparece con datos fijos, se filtra por tipo y persona, se pagina por cursor, un
// gimnasio no ve el de al lado, y la alerta de la campana llega una sola vez.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir } from "./_comun.mjs";

let t, u = {}, eq = {}, socio, hoy, desde, ingresoAnterior, g2 = {};
async function como(usuario, fn) {
  await t.db.query("set role authenticated");
  await t.q(`select set_config('request.jwt.claims', $1, false)`, [JSON.stringify({ sub: usuario, role: "authenticated" })]);
  try { return await fn(); } finally { await t.db.query("reset role"); await t.q(`select set_config('request.jwt.claims', '', false)`); }
}
const linea = (usuario, g, args = {}) => como(usuario, async () => (await t.q(
  `select public.linea_de_control($1, $2::date, $3::date, $4::text[], $5::uuid, $6::int, $7::text) as r`,
  [g, args.desde ?? desde, args.hasta ?? hoy, args.tipos ?? null, args.quien ?? null, args.limite ?? 200, args.cursor ?? null]))[0].r);
const venta = async ({ por, estado = "confirmada", cuando = "now()", items, otroDia = null }) => {
  const [{ id }] = await t.q(`insert into public.ventas (gimnasio_id, sede_id, socio_id, estado, origen, confirmada_en, creado_por, otro_dia_motivo, registrada_en)
    values ($1,$2,$3,$4,'recepcion',${cuando},$5,$6::text, case when $6::text is null then null else now() end) returning id`, [t.g, t.sede, socio, estado, por, otroDia]);
  for (const [descripcion, precio, descuento, motivo] of items) {
    await t.q(`insert into public.venta_items (gimnasio_id, venta_id, tipo, descripcion, precio_unitario, descuento, descuento_motivo) values ($1,$2,'otro',$3,$4,$5,$6)`,
      [t.g, id, descripcion, precio, descuento ?? 0, motivo ?? null]);
  }
  return id;
};

before(async () => {
  t = await abrir("prueba-control");
  for (const [rol, nombre] of [["dueno", "Sofía"], ["encargado", "Martín"], ["recepcion", "Ana"], ["profe", "Diego"]]) {
    const [{ id }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`${rol}${Math.random()}@ejemplo.invalid`]);
    const [{ id: e }] = await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,$3,$4) returning id`, [t.g, id, nombre, rol]);
    u[rol] = id; eq[rol] = e;
  }
  [{ id: socio }] = await t.q(`select id from public.socios where gimnasio_id = $1 limit 1`, [t.g]);
  [{ hoy, desde }] = await t.q(`select (now() at time zone zona_horaria)::date::text as hoy, ((now() at time zone zona_horaria)::date - 10)::text as desde from public.gimnasios where id = $1`, [t.g]);

  // Cobros: uno normal, uno con descuento, uno anulado, uno "cobré otro día".
  await venta({ por: eq.recepcion, items: [["Cuota Full", 25000]] });
  await venta({ por: eq.recepcion, items: [["Cuota Básico", 20000, 5000, "Amigo"]] });
  const anulada = await venta({ por: eq.encargado, items: [["Pase diario", 8000]] });
  await t.q(`update public.ventas set estado = 'anulada', anulada_en = now(), anulada_por = $2, anulada_motivo = 'Error de monto' where id = $1`, [anulada, eq.encargado]);
  await venta({ por: eq.encargado, cuando: "now() - interval '5 days'", items: [["Cuota atrasada", 21000]], otroDia: "Pagó en mano la semana pasada" });

  // Puerta: dejado pasar (con promesa), entrada anulada, préstamo.
  [{ id: ingresoAnterior }] = await t.q(`insert into public.ingresos (gimnasio_id, sede_id, socio_id, momento, via_acceso, resultado, color, motivo, texto, forzado_motivo, registrado_por)
    values ($1,$2,$3, now(), 'recepcion', 'forzado', 'rojo', 'vencido', 'x', 'Paga mañana', $4) returning id`, [t.g, t.sede, socio, eq.recepcion]);
  await t.q(`insert into public.promesas_pago (gimnasio_id, ingreso_id, socio_id, promete_el, modo, pedido_por) values ($1,$2,$3, current_date + 1, 'libre', $4)`,
    [t.g, ingresoAnterior, socio, eq.recepcion]);
  await t.q(`insert into public.ingresos (gimnasio_id, sede_id, socio_id, momento, via_acceso, resultado, color, motivo, texto, registrado_por, anulado_en, anulado_por, anulado_motivo)
    values ($1,$2,$3, now() - interval '1 hour', 'recepcion', 'rechazado', 'rojo', 'vencido', 'x', $4, now(), $4, 'Se tocó el socio equivocado')`, [t.g, t.sede, socio, eq.recepcion]);
  await t.q(`insert into public.alertas_prestamo (gimnasio_id, sede_id, socio_id, momento, ingreso_anterior_id, via_anterior, via_nueva, minutos)
    values ($1,$2,$3, now(), $4, 'recepcion', 'qr_socio', 12)`, [t.g, t.sede, socio, ingresoAnterior]);

  // Cajas: abierta, cerrada con faltante, sin contar.
  const caja = async (n) => (await t.q(`insert into public.cajas (gimnasio_id, sede_id, nombre) values ($1,$2,$3) returning id`, [t.g, t.sede, n]))[0].id;
  await t.q(`insert into public.turnos_caja (gimnasio_id, caja_id, abierto_por, abierto_en, monto_inicial) values ($1,$2,$3, now(), 1000)`, [t.g, await caja("Caja abierta"), eq.recepcion]);
  await t.q(`insert into public.turnos_caja (gimnasio_id, caja_id, abierto_por, abierto_en, monto_inicial, cerrado_en, cerrado_por, monto_contado, monto_esperado)
    values ($1,$2,$3, now() - interval '3 hours', 1000, now() - interval '1 hour', $3, 1900, 2000)`, [t.g, await caja("Caja cerrada"), eq.recepcion]);
  await t.q(`insert into public.turnos_caja (gimnasio_id, caja_id, abierto_por, abierto_en, monto_inicial, cerrado_en, sin_contar, sin_contar_en, monto_esperado)
    values ($1,$2,$3, now() - interval '2 days', 500, now() - interval '1 day', true, now() - interval '1 day', 3000)`, [t.g, await caja("Caja olvidada"), eq.recepcion]);

  // Precios, configuración e invitado.
  await t.q(`insert into public.precios_plan (gimnasio_id, plan_id, monto, vigente_desde, creado_por) values ($1,$2,31000, now() + interval '30 days', $3)`, [t.g, t.ctx.planes.full, u.dueno]);
  const [{ id: prod }] = await t.q(`insert into public.productos (gimnasio_id, nombre, precio) values ($1,'Proteína',10000) returning id`, [t.g]);
  await t.q(`update public.productos set precio = 12000 where id = $1`, [prod]);
  await t.q(`update public.configuracion_gimnasio set dias_aviso = 4 where gimnasio_id = $1`, [t.g]);
  await t.q(`insert into public.invitados (gimnasio_id, sede_id, socio_id, nombre, dni, para_el_dia, creado_por) values ($1,$2,$3,'Amigo de Lu','12345678', now(), $4)`, [t.g, t.sede, socio, u.recepcion]);

  // Otro gimnasio, con algo que este no debe ver.
  const [{ id: gx }] = await t.q(`insert into public.gimnasios (slug, nombre) values ('prueba-control-otro', 'Otro Gimnasio') returning id`);
  const [{ id: sx }] = await t.q(`select id from public.sedes where gimnasio_id = $1`, [gx]);
  const [{ id: ux }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`otro${Math.random()}@ejemplo.invalid`]);
  const [{ id: ex }] = await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,'Bruno','dueno') returning id`, [gx, ux]);
  const [{ id: sox }] = await t.q(`insert into public.socios (gimnasio_id, numero, nombre) values ($1, 1, 'Ajeno') returning id`, [gx]);
  const [{ id: vx }] = await t.q(`insert into public.ventas (gimnasio_id, sede_id, socio_id, estado, origen, confirmada_en, creado_por) values ($1,$2,$3,'confirmada','recepcion', now(), $4) returning id`, [gx, sx, sox, ex]);
  await t.q(`insert into public.venta_items (gimnasio_id, venta_id, tipo, descripcion, precio_unitario) values ($1,$2,'otro','Secreto del otro',99999)`, [gx, vx]);
  g2 = { id: gx, dueno: ux };
});
after(async () => t && t.cerrar());

test("cada tipo aparece, con quién, cuánto y por qué", async () => {
  const { items, siguiente } = await linea(u.dueno, t.g);
  assert.equal(siguiente, null);
  const tipos = new Set(items.map((i) => i.tipo));
  for (const esperado of ["cobro", "anulacion", "descuento", "otro_dia", "dejado_pasar", "caja", "precio", "configuracion", "entrada_anulada", "invitado", "prestamo"]) {
    assert.ok(tipos.has(esperado), `falta el tipo ${esperado}: hay ${[...tipos].join(", ")}`);
  }
  const de = (tipo) => items.filter((i) => i.tipo === tipo);
  assert.ok(de("cobro").some((i) => i.quien === "Ana" && Number(i.monto) === 25000));
  assert.ok(de("cobro").some((i) => i.extra.anulada === true), "el cobro anulado sigue estando (anular es un hecho nuevo)");
  const anul = de("anulacion")[0];
  assert.equal(anul.quien, "Martín"); assert.equal(anul.detalle, "Error de monto"); assert.equal(Number(anul.monto), 8000);
  const desc = de("descuento")[0];
  assert.equal(Number(desc.monto), 5000); assert.equal(Number(desc.extra.porcentaje), 25); assert.match(desc.detalle, /Amigo/);
  const otro = de("otro_dia")[0];
  assert.equal(otro.quien, "Martín"); assert.match(otro.detalle, /Pagó en mano/); assert.ok(new Date(otro.extra.cobrado_el) < new Date(otro.en), "cobrado antes de cargado");
  const dej = de("dejado_pasar")[0];
  assert.equal(dej.quien, "Ana"); assert.equal(dej.detalle, "Paga mañana"); assert.ok(dej.extra.promete_el, "con la promesa de pago");
  assert.deepEqual(de("caja").map((i) => i.extra.evento).sort(), ["abrio", "abrio", "abrio", "cerro", "sin_contar"]);
  assert.equal(Number(de("caja").find((i) => i.extra.evento === "cerro").monto), -100);
  assert.ok(de("precio").some((i) => Number(i.monto) === 31000 && i.quien === "Sofía"), "precio de plan");
  assert.ok(de("precio").some((i) => Number(i.monto) === 12000 && i.detalle === "Proteína" && Number(i.extra.antes) === 10000), "precio de producto");
  assert.ok(de("configuracion").some((i) => i.detalle === "dias_aviso" && Number(i.extra.despues) === 4));
  assert.equal(de("entrada_anulada")[0].detalle, "Se tocó el socio equivocado");
  assert.equal(de("invitado")[0].detalle, "Amigo de Lu"); assert.equal(de("invitado")[0].quien, "Ana");
  assert.equal(de("prestamo")[0].extra.minutos, 12);
  const ms = items.map((i) => Date.parse(i.en));
  assert.deepEqual(ms, [...ms].sort((x, y) => y - x), "de lo más nuevo a lo más viejo");
});

test("se filtra por tipo y por persona, y por fecha", async () => {
  const soloAnul = await linea(u.dueno, t.g, { tipos: ["anulacion", "descuento"] });
  assert.deepEqual([...new Set(soloAnul.items.map((i) => i.tipo))].sort(), ["anulacion", "descuento"]);
  const deAna = await linea(u.dueno, t.g, { quien: eq.recepcion });
  assert.ok(deAna.items.length > 0 && deAna.items.every((i) => i.quien_id === eq.recepcion));
  assert.ok(!deAna.items.some((i) => i.tipo === "prestamo"), "sin autor no entra al filtrar por persona");
  // Un día de hace dos meses: nada (y no es un error).
  const viejo = await linea(u.dueno, t.g, { desde: "2020-01-01", hasta: "2020-01-31" });
  assert.deepEqual(viejo.items, []);
  await como(u.dueno, () => t.falla(() => t.q(`select public.linea_de_control($1, $2::date, $3::date, '{inventado}')`, [t.g, desde, hoy]), /no existe/));
  await como(u.dueno, () => t.falla(() => t.q(`select public.linea_de_control($1, $2::date, $3::date)`, [t.g, hoy, desde]), /no puede ser antes/));
  await como(u.dueno, () => t.falla(() => t.q(`select public.linea_de_control($1, '2020-01-01'::date, $2::date)`, [t.g, hoy]), /un año/));
  await como(u.dueno, () => t.falla(() => t.q(`select public.linea_de_control($1, $2::date, $3::date, null, null, 500)`, [t.g, desde, hoy]), /1 a 200/));
});

test("paginada por cursor: sin repetir ni saltear", async () => {
  const todo = (await linea(u.dueno, t.g)).items.map((i) => i.clave);
  const juntos = [];
  let cursor = null, vueltas = 0;
  do {
    const p = await linea(u.dueno, t.g, { limite: 4, cursor });
    assert.ok(p.items.length <= 4);
    juntos.push(...p.items.map((i) => i.clave));
    cursor = p.siguiente; vueltas++;
  } while (cursor && vueltas < 40);
  assert.deepEqual(juntos, todo);
  assert.ok(vueltas > 1, "hubo varias páginas");
  await como(u.dueno, () => t.falla(() => t.q(`select public.linea_de_control($1, $2::date, $3::date, null, null, 10, 'cualquier cosa')`, [t.g, desde, hoy]), /cursor/));
});

test("la recepción y el profe no la ven: error, no lista vacía", async () => {
  for (const rol of ["recepcion", "profe"]) {
    await como(u[rol], () => t.falla(() => t.q(`select public.linea_de_control($1, $2::date, $3::date)`, [t.g, desde, hoy]), /permiso|rol|acceso/i));
    await como(u[rol], () => t.falla(() => t.q(`select public.campana_control($1)`, [t.g]), /permiso|rol|acceso/i));
  }
  await como(u.encargado, () => t.q(`select public.linea_de_control($1, $2::date, $3::date)`, [t.g, desde, hoy]));
  await t.q(`update public.configuracion_gimnasio set encargado_ve_resultado = false where gimnasio_id = $1`, [t.g]);
  await como(u.encargado, () => t.falla(() => t.q(`select public.linea_de_control($1, $2::date, $3::date)`, [t.g, desde, hoy]), /no le dio acceso/));
  await como(u.encargado, () => t.falla(() => t.q(`select public.campana_control($1)`, [t.g]), /no le dio acceso/));
  await t.q(`update public.configuracion_gimnasio set encargado_ve_resultado = true where gimnasio_id = $1`, [t.g]);
});

test("un gimnasio no ve el de al lado", async () => {
  const mio = await linea(u.dueno, t.g);
  assert.ok(!mio.items.some((i) => /Secreto|99999/.test(`${i.detalle} ${i.monto}`) || i.socio === "Ajeno"), "no aparece nada del otro gimnasio");
  await como(u.dueno, () => t.falla(() => t.q(`select public.linea_de_control($1, $2::date, $3::date)`, [g2.id, desde, hoy]), /permiso|rol|acceso/i));
  const suyo = await linea(g2.dueno, g2.id);
  assert.deepEqual(suyo.items.map((i) => i.detalle), ["Secreto del otro"]);
  // Pasarle a mi gimnasio una persona del otro no trae nada del otro.
  const [{ id: eqAjeno }] = await t.q(`select id from public.equipo where gimnasio_id = $1`, [g2.id]);
  assert.deepEqual((await linea(u.dueno, t.g, { quien: eqAjeno })).items, []);
});

test("la campana del dueño: anulación, descuento y cobro con fecha atrasada llegan, y una sola vez", async () => {
  const camp = await como(u.dueno, async () => (await t.q(`select public.campana($1) as r`, [t.g]))[0].r);
  const titulos = camp.items.map((i) => i.titulo);
  assert.ok(titulos.some((x) => /Se anuló una venta de/.test(x)), `anulación en la campana: ${titulos.join(" | ")}`);
  assert.ok(titulos.some((x) => /^Descuento de/.test(x)), "descuento en la campana");

  const a = await como(u.dueno, async () => (await t.q(`select public.campana_control($1) as r`, [t.g]))[0].r);
  const claves = a.items.map((i) => i.clave);
  assert.equal(claves.filter((c) => c.startsWith("otro_dia:")).length, 1, "cobro con fecha atrasada");
  assert.equal(claves.filter((c) => c.startsWith("prestamo:")).length, 1, "anti-préstamo");
  assert.match(a.items.find((c) => c.clave.startsWith("otro_dia:")).titulo, /Cobro cargado con fecha del/);
  assert.equal(a.sin_leer, 2);
  // Pedirla de nuevo no repite; leerla la marca vista y no vuelve a contar como nueva.
  const b = await como(u.dueno, async () => (await t.q(`select public.campana_control($1) as r`, [t.g]))[0].r);
  assert.deepEqual(b.items.map((i) => i.clave), claves);
  await como(u.dueno, () => t.q(`select public.leer_campana($1, $2::text[])`, [t.g, claves]));
  const c = await como(u.dueno, async () => (await t.q(`select public.campana_control($1) as r`, [t.g]))[0].r);
  assert.equal(c.items.length, claves.length); assert.equal(c.sin_leer, 0);
  // Quien cargó el cobro no se alerta a sí mismo.
  const m = await como(u.encargado, async () => (await t.q(`select public.campana_control($1) as r`, [t.g]))[0].r);
  assert.ok(!m.items.some((i) => i.clave.startsWith("otro_dia:")));
});

test("la sección control se puede apagar", async () => {
  await t.q(`update public.configuracion_gimnasio set secciones_apagadas = array['control'] where gimnasio_id = $1`, [t.g]);
  await t.q(`update public.configuracion_gimnasio set secciones_apagadas = '{}' where gimnasio_id = $1`, [t.g]);
  await t.falla(() => t.q(`update public.configuracion_gimnasio set secciones_apagadas = array['no_existe'] where gimnasio_id = $1`, [t.g]), /configuracion_secciones_validas/);
});
