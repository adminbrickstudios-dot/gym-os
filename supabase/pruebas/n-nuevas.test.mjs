// Fase N (20261111200100 a 200600): el interruptor por gimnasio (N5) y las funciones nuevas que cuelgan de él.
//   N5 apagadas de fábrica, solo el dueño las prende, queda escrito, no se filtra entre gimnasios.
//   N4 origen de las altas (reporte, pagaron), N3 resumen de la noche, N6 qué hay de nuevo, N1 débito automático (idempotencia, monto, solo servidor).
// Apagada, cada función no deja ver ni hacer nada. Los momentos del acceso son de n2-apto.test.mjs.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir } from "./_comun.mjs";

let t, u = {}, gOtro, uOtro, socio, socio2;
const crear = async (g, rol) => {
  const [{ id }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`${rol}${Math.random()}@ejemplo.invalid`]);
  await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,$3,$4)`, [g, id, rol, rol]);
  return id;
};
before(async () => {
  t = await abrir("prueba-n-nuevas");
  for (const rol of ["dueno", "encargado", "recepcion", "profe"]) u[rol] = await crear(t.g, rol);
  const [{ id }] = await t.q(`insert into public.gimnasios (slug, nombre) values ('otro-n-nuevas', 'Otro Gimnasio') returning id`);
  gOtro = id; uOtro = await crear(gOtro, "dueno");
  socio = t.ctx.socios.al_dia; socio2 = t.ctx.socios.sin_plan;
});
after(async () => t && t.cerrar());

// Como una sesión de ese usuario, sin deshacer lo que hace adentro (comoUsuario de _comun revierte al salir).
async function como(usuario, fn) {
  await t.db.query("set role authenticated");
  await t.q(`select set_config('request.jwt.claims', $1, false)`, [JSON.stringify({ sub: usuario, role: "authenticated" })]);
  try { return await fn(); } finally { await t.db.query("reset role"); await t.q(`select set_config('request.jwt.claims', '', false)`); }
}
const prender = (clave, activa = true) => t.q(`select public.cambiar_funcion_nueva($1, $2, $3)`, [t.g, clave, activa]);
const comoDueno = (fn) => como(u.dueno, fn);

// ── N5 ──────────────────────────────────────────────────────────────
test("N5: todas nacen apagadas; el dueño las ve y las prende; el encargado las ve pero no las cambia; la recepción no ve la pantalla", async () => {
  assert.equal((await t.q(`select count(*)::int n from public.funciones_nuevas_gimnasio where gimnasio_id = $1`, [t.g]))[0].n, 0, "no hay filas: apagado es la ausencia");
  await comoDueno(async () => {
    const [{ r }] = await t.q(`select public.funciones_nuevas_panel($1) r`, [t.g]);
    assert.deepEqual(r.map((x) => x.clave), ["borrador_alta", "panel_pago", "horarios_pico", "apto_vencimiento", "origen_altas", "resumen_noche", "debito_automatico"]);
    assert.ok(r.every((x) => x.activa === false && x.prendida_en === null), "todas apagadas");
    assert.equal(r.find((x) => x.clave === "debito_automatico").plata, true);
    const [{ a }] = await t.q(`select public.funciones_nuevas_activas($1) a`, [t.g]);
    assert.deepEqual(a, []);
    await prender("origen_altas");
    const [{ r: r2 }] = await t.q(`select public.funciones_nuevas_panel($1) r`, [t.g]);
    const f = r2.find((x) => x.clave === "origen_altas");
    assert.equal(f.activa, true); assert.ok(f.prendida_en && f.prendida_dia);
    await t.falla(() => prender("no_existe"), /no existe/);
    await t.falla(() => t.q(`select public.cambiar_funcion_nueva($1, 'origen_altas', null)`, [t.g]), /prendida o apagada/);
    const [{ h }] = await t.q(`select count(*)::int h from public.historial_configuracion where gimnasio_id = $1 and campo = 'funcion_nueva.origen_altas'`, [t.g]);
    assert.equal(h, 1, "queda escrito quién y cuándo");
    await prender("origen_altas");   // repetir no duplica el historial
    assert.equal((await t.q(`select count(*)::int h from public.historial_configuracion where gimnasio_id = $1 and campo = 'funcion_nueva.origen_altas'`, [t.g]))[0].h, 1);
    await prender("origen_altas", false);
    assert.equal((await t.q(`select count(*)::int h from public.historial_configuracion where gimnasio_id = $1 and campo = 'funcion_nueva.origen_altas'`, [t.g]))[0].h, 2);
  });
  await como(u.encargado, async () => {
    await t.q(`select public.funciones_nuevas_panel($1)`, [t.g]);
    await t.falla(() => prender("origen_altas"), /Sin permiso/);
  });
  await como(u.recepcion, async () => {
    await t.falla(() => t.q(`select public.funciones_nuevas_panel($1)`, [t.g]), /Sin permiso/);
    await t.falla(() => prender("origen_altas"), /Sin permiso/);
    await t.q(`select public.funciones_nuevas_activas($1)`, [t.g]);
  });
  await como(uOtro, async () => {
    await t.falla(() => t.q(`select public.funciones_nuevas_panel($1)`, [t.g]), /Sin permiso/);
    await t.falla(() => prender("origen_altas"), /Sin permiso/);
  });
});

test("N5: prender en un gimnasio no prende en otro", async () => {
  await comoDueno(() => prender("resumen_noche"));
  assert.equal((await t.q(`select privado.funcion_activa($1, 'resumen_noche') a`, [t.g]))[0].a, true);
  assert.equal((await t.q(`select privado.funcion_activa($1, 'resumen_noche') a`, [gOtro]))[0].a, false);
  await comoDueno(() => prender("resumen_noche", false));
});

// ── N4 ──────────────────────────────────────────────────────────────
test("N4: apagada no anota ni muestra nada; prendida, el socio anota su origen una vez y el reporte lo cuenta", async () => {
  // El socio de prueba se anotó solo desde la página, hoy.
  await t.q(`update public.socios set origen = 'alta_web', creado_en = now() where id = $1`, [socio]);
  await t.q(`update public.socios set origen = 'alta_web', creado_en = now() where id = $1`, [socio2]);
  const [{ usuario }] = [{ usuario: (await t.q(`insert into auth.users (email) values ('socio-n4@ejemplo.invalid') returning id`))[0].id }];
  await t.q(`update public.socios set usuario_id = $2 where id = $1`, [socio, usuario]);

  // Apagada
  await como(usuario, async () => {
    assert.equal((await t.q(`select public.anotar_origen_alta($1, 'instagram') r`, [socio]))[0].r, false);
  });
  assert.equal((await t.q(`select count(*)::int n from public.origenes_alta where gimnasio_id = $1`, [t.g]))[0].n, 0);
  await comoDueno(async () => {
    await t.falla(() => t.q(`select public.origen_altas_reporte($1, 30)`, [t.g]), /no está prendida/);
    assert.equal((await t.q(`select public.origen_alta_socio($1) r`, [socio]))[0].r, null);
  });

  await comoDueno(() => prender("origen_altas"));
  await como(usuario, async () => {
    assert.equal((await t.q(`select public.anotar_origen_alta($1, 'tiktok') r`, [socio]))[0].r, false, "un canal que no existe no cuenta");
    assert.equal((await t.q(`select public.anotar_origen_alta($1, 'qr') r`, [socio]))[0].r, true);
    assert.equal((await t.q(`select public.anotar_origen_alta($1, 'instagram') r`, [socio]))[0].r, false, "una sola vez");
    await t.falla(() => t.q(`select public.anotar_origen_alta($1, 'qr')`, [socio2]), /Sin permiso/);   // el ajeno
  });
  await t.q(`insert into public.origenes_alta (gimnasio_id, socio_id, canal) values ($1, $2, 'instagram')`, [t.g, socio2]);
  await comoDueno(async () => {
    const [{ r }] = await t.q(`select public.origen_altas_reporte($1, 30) r`, [t.g]);
    assert.equal(r.total, 2);
    const por = Object.fromEntries(r.canales.map((c) => [c.canal, c]));
    assert.equal(por.qr_cartel.altas, 1); assert.equal(por.instagram.altas, 1); assert.equal(por.whatsapp.altas, 0);
    assert.equal(por.qr_cartel.pagaron, 1, "Testigo Al Día tiene cobertura: pagó");
    assert.equal(por.instagram.pagaron, 0, "Testigo Sin Plan no pagó");
    assert.equal(r.ultimas.length, 2);
    assert.equal((await t.q(`select public.origen_alta_socio($1) r`, [socio]))[0].r, "qr_cartel");
    await t.falla(() => t.q(`select public.origen_altas_reporte($1, 0)`, [t.g]), /entre 1 y 365/);
  });
  await como(u.profe, () => t.falla(() => t.q(`select public.origen_altas_reporte($1, 30)`, [t.g]), /Sin permiso/));
  await como(uOtro, () => t.falla(() => t.q(`select public.origen_altas_reporte($1, 30)`, [t.g]), /Sin permiso/));
  await comoDueno(() => prender("origen_altas", false));
  await comoDueno(async () => {
    await t.falla(() => t.q(`select public.origen_altas_reporte($1, 30)`, [t.g]), /no está prendida/);
    assert.equal((await t.q(`select public.origen_alta_socio($1) r`, [socio]))[0].r, null, "apagada: la ficha no muestra el origen");
  });
});

// ── N3 ──────────────────────────────────────────────────────────────
test("N3: el resumen sale de los hechos del día, solo para el dueño y solo prendido", async () => {
  await comoDueno(() => t.falla(() => t.q(`select public.resumen_noche($1)`, [t.g]), /no está prendida/));
  await comoDueno(() => prender("resumen_noche"));
  const antes = await comoDueno(async () => (await t.q(`select public.resumen_noche($1) r`, [t.g]))[0].r);
  // Un cobro de $1.500 por transferencia, una entrada, un alta y una baja, todo "ahora".
  const [{ id: venta }] = await t.q(`insert into public.ventas (gimnasio_id, sede_id, socio_id, estado, origen, confirmada_en) values ($1,$2,$3,'confirmada','recepcion', now()) returning id`, [t.g, t.sede, socio]);
  await t.q(`insert into public.pagos (gimnasio_id, venta_id, medio, monto, estado, aprobado_en) values ($1,$2,'transferencia',1500,'aprobado', now())`, [t.g, venta]);
  await t.q(`insert into public.ingresos (gimnasio_id, sede_id, socio_id, via_acceso, resultado, color, motivo, texto) values ($1,$2,$3,'recepcion','entro','verde','al_dia','Al día')`, [t.g, t.sede, socio]);
  await t.q(`insert into public.ingresos (gimnasio_id, sede_id, socio_id, via_acceso, resultado, color, motivo, texto) values ($1,$2,$3,'recepcion','rechazado','rojo','vencida','Vencida')`, [t.g, t.sede, socio2]);
  await t.q(`insert into public.socios (gimnasio_id, nombre, apellido, dni, telefono) values ($1, 'Nuevo', 'Resumen', '39000001', '+5490000000001')`, [t.g]);
  const despues = await comoDueno(async () => (await t.q(`select public.resumen_noche($1) r`, [t.g]))[0].r);
  assert.equal(Number(despues.cobrado) - Number(antes.cobrado), 1500);
  assert.equal(despues.cobros - antes.cobros, 1);
  assert.equal(despues.entradas - antes.entradas, 1, "el rechazado no cuenta como entrada");
  assert.equal(despues.altas - antes.altas, 1);
  assert.equal(despues.bajas, antes.bajas);
  assert.ok(despues.por_medio.some((m) => m.medio === "transferencia"));
  assert.equal(despues.es_hoy, true);
  // Otro día: sin hechos de hoy.
  const ayer = await comoDueno(async () => (await t.q(`select public.resumen_noche($1, (now() at time zone $2)::date - 3) r`, [t.g, t.ctx.zona]))[0].r);
  assert.equal(ayer.es_hoy, false); assert.equal(Number(ayer.cobrado), 0);
  await comoDueno(() => t.falla(() => t.q(`select public.resumen_noche($1, (now() at time zone $2)::date + 2)`, [t.g, t.ctx.zona]), /últimos 60/));
  for (const rol of ["encargado", "recepcion", "profe"]) await como(u[rol], () => t.falla(() => t.q(`select public.resumen_noche($1)`, [t.g]), /Sin permiso/));
  await como(uOtro, () => t.falla(() => t.q(`select public.resumen_noche($1)`, [t.g]), /Sin permiso/));
  await comoDueno(() => prender("resumen_noche", false));
  await comoDueno(() => t.falla(() => t.q(`select public.resumen_noche($1)`, [t.g]), /no está prendida/));
});

// ── N6 ──────────────────────────────────────────────────────────────
test("N6: 'qué hay de nuevo' lista solo lo prendido, con su fecha; sin nada prendido, vacío", async () => {
  await comoDueno(async () => {
    assert.deepEqual((await t.q(`select public.que_hay_de_nuevo($1) r`, [t.g]))[0].r, []);
    await prender("resumen_noche");
    await prender("apto_vencimiento");
    const [{ r }] = await t.q(`select public.que_hay_de_nuevo($1) r`, [t.g]);
    assert.deepEqual(r.map((x) => x.clave).sort(), ["apto_vencimiento", "resumen_noche"]);
    assert.ok(r.every((x) => x.texto.length > 20 && x.desde));
    await prender("resumen_noche", false);
    assert.deepEqual((await t.q(`select public.que_hay_de_nuevo($1) r`, [t.g]))[0].r.map((x) => x.clave), ["apto_vencimiento"]);
    await prender("apto_vencimiento", false);
  });
  await como(u.encargado, async () => { await t.q(`select public.que_hay_de_nuevo($1)`, [t.g]); });
  await como(u.recepcion, () => t.falla(() => t.q(`select public.que_hay_de_nuevo($1)`, [t.g]), /Sin permiso/));
  await como(uOtro, () => t.falla(() => t.q(`select public.que_hay_de_nuevo($1)`, [t.g]), /Sin permiso/));
});

// ── N1 ──────────────────────────────────────────────────────────────
async function conectarMP() {
  const [{ id: tok }] = await t.q(`select vault.create_secret('TEST-token-de-prueba-n1-000000000000', 'n1_tok_' || gen_random_uuid(), 'n1') as id`);
  const [{ id: sec }] = await t.q(`select vault.create_secret('secreto-de-prueba-n1-000000', 'n1_sec_' || gen_random_uuid(), 'n1') as id`);
  const [{ id: eq }] = await t.q(`select id from public.equipo where gimnasio_id = $1 and rol = 'dueno'`, [t.g]);
  await t.q(`insert into public.proveedores_pago (gimnasio_id, modo, token_secreto_id, webhook_secreto_id, conectado_por) values ($1,'prueba',$2,$3,$4) on conflict do nothing`, [t.g, tok, sec, eq]);
}
const cobro = (susc, pago, monto, estado) => t.q(`select public.acreditar_cobro_debito($1, $2, $3, $4, $5) r`, [t.g, susc, pago, monto, estado]).then((x) => x[0].r);

test("N1: apagado no deja ver, adherir ni acreditar; solo el servidor acredita", async () => {
  await comoDueno(async () => {
    await t.falla(() => t.q(`select public.debito_estado($1)`, [t.g]), /no está prendida/);
    await t.falla(() => t.q(`select public.registrar_adhesion_debito($1, $2, 'sus-1', 25000)`, [t.g, socio]), /no está prendida/);
  });
  assert.equal(await cobro("sus-1", "pago-1", 25000, "approved"), "funcion_apagada", "el aviso con la función apagada no hace nada");
  assert.equal((await t.q(`select count(*)::int n from public.cobros_debito where gimnasio_id = $1`, [t.g]))[0].n, 0);
  await comoDueno(() => prender("debito_automatico"));
  await como(u.dueno, () => t.falla(() => t.q(`select public.acreditar_cobro_debito($1, 'x', 'y', 1, 'approved')`, [t.g]), /permission denied|permiso/i));
  await como(u.dueno, () => t.falla(() => t.q(`select public.actualizar_adhesion_debito($1, 'x', 'authorized')`, [t.g]), /permission denied|permiso/i));
  await comoDueno(() => prender("debito_automatico", false));
});

test("N1: adhesión → cobro aprobado crea la cuota y mueve la cobertura; el mismo ID no se acredita dos veces; el monto tiene que coincidir", async () => {
  await comoDueno(() => prender("debito_automatico"));
  await comoDueno(async () => {
    await t.falla(() => t.q(`select public.registrar_adhesion_debito($1, $2, 'sus-1', 25000)`, [t.g, socio]), /Conectá MercadoPago/);
  });
  await conectarMP();
  await comoDueno(async () => {
    await t.falla(() => t.q(`select public.registrar_adhesion_debito($1, $2, 'sus-x', 25000)`, [t.g, t.ctx.socios.sin_plan]), /membresía activa/);
    await t.falla(() => t.q(`select public.registrar_adhesion_debito($1, $2, 'sus-x', 0)`, [t.g, socio]), /monto/);
    const [{ id }] = await t.q(`select public.registrar_adhesion_debito($1, $2, 'sus-1', 25000) as id`, [t.g, socio]);
    assert.ok(id);
    await t.falla(() => t.q(`select public.registrar_adhesion_debito($1, $2, 'sus-2', 25000)`, [t.g, socio]), /unique|duplicate|duplicada/i);   // una viva por socio
    const [{ e }] = await t.q(`select public.debito_estado($1) e`, [t.g]);
    assert.equal(e.mp_conectado, true); assert.equal(e.adhesiones.length, 1); assert.equal(e.adhesiones[0].estado, "pendiente");
  });
  for (const rol of ["recepcion", "profe"]) await como(u[rol], () => t.falla(() => t.q(`select public.debito_estado($1)`, [t.g]), /Sin permiso/));
  await como(uOtro, () => t.falla(() => t.q(`select public.debito_estado($1)`, [t.g]), /Sin permiso/));

  const antes = (await t.q(`select cubierto_hasta from public.socios where id = $1`, [socio]))[0].cubierto_hasta;
  await t.falla(() => cobro("sus-1", "mp-pago-1", 20000, "approved"), /no se acredita/);   // otro monto
  assert.equal((await t.q(`select count(*)::int n from public.cobros_debito where gimnasio_id = $1`, [t.g]))[0].n, 0);
  assert.equal(await cobro("sus-1", "mp-pago-1", 25000, "approved"), "acreditado");
  assert.equal(await cobro("sus-1", "mp-pago-1", 25000, "approved"), "ya_procesado", "idempotente por ID externo");
  const [{ n, pagos, medio }] = await t.q(`select count(*)::int n, (select count(*)::int from public.pagos p where p.gimnasio_id = $1 and p.mp_pago_id = 'mp-pago-1') pagos,
     (select medio from public.pagos p where p.gimnasio_id = $1 and p.mp_pago_id = 'mp-pago-1') medio from public.cobros_debito where gimnasio_id = $1 and estado = 'acreditado'`, [t.g]);
  assert.equal(n, 1); assert.equal(pagos, 1); assert.equal(medio, "debito_automatico");
  const despues = (await t.q(`select cubierto_hasta from public.socios where id = $1`, [socio]))[0].cubierto_hasta;
  assert.ok(new Date(despues) > new Date(antes), "la cobertura avanzó con el pago");
  assert.equal((await t.q(`select estado from public.debitos_automaticos where gimnasio_id = $1 and mp_suscripcion_id = 'sus-1'`, [t.g]))[0].estado, "activa");
  assert.equal((await t.q(`select count(*)::int n from public.ventas where gimnasio_id = $1 and origen = 'debito' and estado = 'confirmada'`, [t.g]))[0].n, 1);
  // Rechazado: se anota, no toca la cobertura. Devolución: se resuelve a mano.
  assert.equal(await cobro("sus-1", "mp-pago-2", 25000, "rejected"), "rechazado");
  assert.equal(await cobro("sus-1", "mp-pago-3", 25000, "refunded"), "devolucion_manual");
  assert.equal((await t.q(`select cubierto_hasta from public.socios where id = $1`, [socio]))[0].cubierto_hasta.toString(), despues.toString());
  await t.falla(() => cobro("sus-inexistente", "mp-pago-9", 25000, "approved"), /Adhesión inexistente/);
  // Pausa y cancelación por aviso; una cancelada que cobra no acredita.
  assert.equal((await t.q(`select public.actualizar_adhesion_debito($1, 'sus-1', 'paused') r`, [t.g]))[0].r, "pausada");
  assert.equal((await t.q(`select public.actualizar_adhesion_debito($1, 'sus-1', 'cancelled') r`, [t.g]))[0].r, "cancelada");
  assert.equal((await t.q(`select public.actualizar_adhesion_debito($1, 'sus-1', 'authorized') r`, [t.g]))[0].r, "ya_cancelada");
  assert.equal(await cobro("sus-1", "mp-pago-4", 25000, "approved"), "adhesion_cancelada");
  assert.equal((await t.q(`select estado from public.cobros_debito where gimnasio_id = $1 and mp_pago_id = 'mp-pago-4'`, [t.g]))[0].estado, "sin_acreditar");
  assert.equal((await t.q(`select count(*)::int n from public.pagos where gimnasio_id = $1 and mp_pago_id = 'mp-pago-4'`, [t.g]))[0].n, 0);
  await comoDueno(async () => {
    await t.falla(() => t.q(`select public.cancelar_adhesion_debito($1, (select id from public.debitos_automaticos where gimnasio_id = $1 limit 1))`, [t.g]), /ya estaba cancelada/);
  });
});
