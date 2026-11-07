// VD-49 (D32) · Efectivo sin caja: el efectivo cae en la caja de QUIEN cobra; sin caja abierta de esa persona en esa
// sede la base rechaza con un error estable (sin_caja / CJ001); la caja ajena también (caja_ajena / CJ002);
// transferencia y tarjeta cobran sin caja. Y la caja CUADRA, con números fijos:
//   esperado = fondo + efectivo cobrado − retiros + ingresos extra  (la transferencia no suma, lo de otra persona no entra).
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir } from "./_comun.mjs";

let t, cajaA, cajaB, agua, uPc, uDueno, eAna, eBeto, tokAna, tokBeto;
before(async () => {
  t = await abrir("prueba-efectivo-sin-caja");
  [{ id: cajaA }] = await t.q(`insert into public.cajas (gimnasio_id, sede_id, nombre) values ($1,$2,'Recepción') returning id`, [t.g, t.sede]);
  [{ id: cajaB }] = await t.q(`insert into public.cajas (gimnasio_id, sede_id, nombre) values ($1,$2,'Salón') returning id`, [t.g, t.sede]);
  [{ id: agua }] = await t.q(`insert into public.productos (gimnasio_id, nombre, precio) values ($1,'Agua 500 ml',1500) returning id`, [t.g]);
  const crear = async (rol, nombre) => {
    const [{ id: u }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`${rol}${Math.random()}@ejemplo.invalid`]);
    const [{ id: e }] = await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,$3,$4) returning id`, [t.g, u, nombre, rol]);
    return [u, e];
  };
  [uPc] = await crear("recepcion", "PC Recepción");      // la compu compartida: cada uno entra con su PIN
  [uDueno] = await crear("dueno", "Sofía");
  const [uA, ea] = await crear("recepcion", "Ana"); eAna = ea;
  const [uB, eb] = await crear("recepcion", "Beto"); eBeto = eb;
  await como(uA, () => t.q(`select public.guardar_mi_pin($1, '4827')`, [t.g]));
  await como(uB, () => t.q(`select public.guardar_mi_pin($1, '9051')`, [t.g]));
  tokAna = (await como(uPc, async () => (await t.q(`select public.entrar_con_pin($1, '4827') as r`, [t.g]))[0].r)).token;
  tokBeto = (await como(uPc, async () => (await t.q(`select public.entrar_con_pin($1, '9051') as r`, [t.g]))[0].r)).token;
});
after(async () => t && t.cerrar());

async function como(u, fn, token = null) {
  await t.db.query("set role authenticated");
  await t.q(`select set_config('request.jwt.claims', $1, false), set_config('request.headers', $2, false)`,
    [JSON.stringify({ sub: u, role: "authenticated" }), JSON.stringify(token ? { "x-gymos-operador": token } : {})]);
  try { return await fn(); } finally { await t.db.query("reset role"); await t.q(`select set_config('request.jwt.claims', '', false), set_config('request.headers', '', false)`); }
}
const comoAna = (fn) => como(uPc, fn, tokAna);
const comoBeto = (fn) => como(uPc, fn, tokBeto);

const items = (n = 1) => JSON.stringify([{ tipo: "producto", producto_id: agua, cantidad: n }]);
const pago = (medio, monto) => JSON.stringify([{ medio, monto }]);
// vender(sede, items, pagos, socio, turno): turno null = que lo busque la base.
const vender = (n, medio, turno = null) => t.q(`select public.vender($1, $2, $3, null, $4) as r`, [t.sede, items(n), pago(medio, 1500 * n), turno]);
const resumen = async (turno) => (await t.q(`select privado.resumen_turno($1) as r`, [turno]))[0].r;

test("efectivo sin caja abierta de esa persona: error estable (sin_caja, CJ001); transferencia, débito y crédito cobran sin caja", async () => {
  const e = await comoAna(() => t.falla(() => vender(1, "efectivo"), /sin_caja: .*caja abierta/));
  assert.equal(e.code, "CJ001");
  for (const medio of ["transferencia", "debito", "credito"]) {
    const [{ r }] = await comoAna(() => vender(1, medio));
    assert.equal(Number(r.total), 1500, `${medio} cobra sin caja`);
    const [{ turno_caja_id }] = await t.q(`select turno_caja_id from public.ventas where id = $1`, [r.venta_id]);
    assert.equal(turno_caja_id, null, "sin caja, la venta no queda en ningún turno");
  }
});

test("con otra persona con la caja abierta, quien cobra sin caja sigue sin poder cobrar en efectivo", async () => {
  const turnoBeto = await comoBeto(async () => (await t.q(`select public.abrir_caja($1, 5000) as id`, [cajaB]))[0].id);
  // Ana no tiene caja: la de Beto no es la suya (con la base eligiendo, o pasándola ella).
  const e1 = await comoAna(() => t.falla(() => vender(1, "efectivo"), /sin_caja/));
  assert.equal(e1.code, "CJ001");
  const e2 = await comoAna(() => t.falla(() => vender(1, "efectivo", turnoBeto), /caja_ajena/));
  assert.equal(e2.code, "CJ002");
  // La hoja Cobrar de Ana lo ve igual: sin turno propio, con las cajas libres que puede abrir.
  const cp = await comoAna(async () => (await t.q(`select public.caja_para_cobrar($1) as r`, [t.sede]))[0].r);
  assert.equal(cp.turno_id, null);
  assert.ok(cp.libres.some((l) => l.nombre === "Recepción") && !cp.libres.some((l) => l.nombre === "Salón"), "la del Salón la tiene Beto");
  assert.equal(Number(cp.libres.find((l) => l.nombre === "Recepción").fondo_sugerido), 0);
  // Y la de Beto, a nombre de Beto.
  const cb = await comoBeto(async () => (await t.q(`select public.caja_para_cobrar($1) as r`, [t.sede]))[0].r);
  assert.equal(cb.turno_id, turnoBeto);
});

test("la caja CUADRA con números fijos: fondo + efectivo − retiros + ingresos; la transferencia y lo de otra persona no entran", async () => {
  // Beto ya abrió el Salón con $5.000 (test anterior). Ana abre Recepción con $10.000.
  const turnoAna = await comoAna(async () => (await t.q(`select public.abrir_caja($1, 10000) as id`, [cajaA]))[0].id);
  const turnoBeto = (await t.q(`select id from public.turnos_caja where caja_id = $1 and cerrado_en is null`, [cajaB]))[0].id;

  // Sin pasar el turno: la base lo busca (el de quien cobra) y el pago queda ahí.
  const [{ r: v1 }] = await comoAna(() => vender(2, "efectivo"));                 // $3.000 efectivo
  const [{ r: v2 }] = await comoAna(() => vender(3, "efectivo", turnoAna));       // $4.500 efectivo, pasando su turno
  await comoAna(() => vender(1, "transferencia", turnoAna));                       // $1.500 transferencia: NO suma al cajón
  const [{ r: v4 }] = await comoAna(() => vender(1, "efectivo"));                 // $1.500 efectivo que se anula
  await comoBeto(() => vender(4, "efectivo"));                                     // $6.000 de Beto: NO entra en la caja de Ana
  for (const v of [v1, v2, v4]) {
    const [{ turno }] = await t.q(`select p.turno_caja_id as turno from public.pagos p where p.venta_id = $1 and p.medio = 'efectivo'`, [v.venta_id]);
    assert.equal(turno, turnoAna, "el efectivo cayó en la caja de Ana");
  }
  await comoAna(() => t.q(`select public.movimiento_caja($1, 'retiro', 2000, 'Pago al de limpieza')`, [turnoAna]));
  await comoAna(() => t.q(`select public.movimiento_caja($1, 'ingreso', 500, 'Cambio que trajo el dueño')`, [turnoAna]));
  await como(uDueno, () => t.q(`select public.anular_venta_panel($1, 'Se equivocó de producto')`, [v4.venta_id]));

  const r = await resumen(turnoAna);
  assert.equal(Number(r.monto_inicial), 10000);
  assert.equal(Number(r.efectivo), 7500, "3.000 + 4.500 (la anulada y la transferencia no cuentan)");
  assert.equal(Number(r.retiros), 2000);
  assert.equal(Number(r.ingresos), 500);
  assert.equal(Number(r.esperado), 16000, "10.000 + 7.500 − 2.000 + 500");
  assert.equal(Number(r.otros_medios.transferencia), 1500, "la transferencia se informa aparte, no suma al cajón");
  const rb = await resumen(turnoBeto);
  assert.equal(Number(rb.esperado), 11000, "5.000 + 6.000: lo de Beto queda en la caja de Beto");

  // La lectura del cierre (arqueo ciego) coincide: contó 15.800 → FALTAN 200 sobre un esperado de 16.000.
  const cierre = await comoAna(async () => (await t.q(`select public.cerrar_caja($1, 15800, 'Faltan 200') as r`, [turnoAna]))[0].r);
  assert.equal(Number(cierre.esperado), 16000);
  assert.equal(Number(cierre.contado), 15800);
  assert.equal(Number(cierre.diferencia), -200, "FALTAN 200");
  const rep = await como(uDueno, async () => (await t.q(`select public.reporte_turno($1) as r`, [turnoAna]))[0].r);
  assert.equal(Number(rep.esperado), 16000);
  assert.equal(Number(rep.diferencia), -200);
  assert.equal(rep.estado, "cerrado");
  assert.equal(Number(rep.ventas.total) >= 0, true);
  // Sobrando: la de Beto, contando 11.250 → SOBRAN 250.
  const cb = await comoBeto(async () => (await t.q(`select public.cerrar_caja($1, 11250) as r`, [turnoBeto]))[0].r);
  assert.equal(Number(cb.diferencia), 250, "SOBRAN 250");
});

test("con PIN la caja es la de esa persona: la compu compartida abre y cobra con la de quien puso su PIN", async () => {
  // Sin PIN la compu no tiene caja propia: no hay efectivo posible. Con el PIN de Ana (que ya cerró), tampoco.
  await como(uPc, () => t.falla(() => vender(1, "efectivo"), /sin_caja/));
  await comoAna(() => t.falla(() => vender(1, "efectivo"), /sin_caja/));
  const turnoAna = await comoAna(async () => (await t.q(`select public.abrir_caja($1, 1000) as id`, [cajaA]))[0].id);
  const [{ por }] = await t.q(`select abierto_por as por from public.turnos_caja where id = $1`, [turnoAna]);
  assert.equal(por, eAna);
  // Cobra Beto en la misma compu: el turno de Ana NO es el suyo, aunque la sesión sea la misma.
  await comoBeto(() => t.falla(() => vender(1, "efectivo"), /sin_caja/));
  await comoBeto(() => t.falla(() => vender(1, "efectivo", turnoAna), /caja_ajena/));
  // Y cobra Ana: el pago queda en su turno.
  const [{ r }] = await comoAna(() => vender(1, "efectivo"));
  const [{ turno }] = await t.q(`select turno_caja_id as turno from public.pagos where venta_id = $1`, [r.venta_id]);
  assert.equal(turno, turnoAna);
  // La compu sin PIN ve el turno de nadie: su sesión no es Ana.
  const cp = await como(uPc, async () => (await t.q(`select public.caja_para_cobrar($1) as r`, [t.sede]))[0].r);
  assert.equal(cp.turno_id, null);
  const ca = await comoAna(async () => (await t.q(`select public.caja_para_cobrar($1) as r`, [t.sede]))[0].r);
  assert.equal(ca.turno_id, turnoAna);
  assert.equal(Number(ca.libres.find((l) => l.nombre === "Salón").dejo_anterior), 11250, "el Salón dejó lo contado por Beto");
  assert.equal(Number(ca.libres.find((l) => l.nombre === "Salón").fondo_sugerido), 11250, "fondo sugerido = lo que dejó el turno anterior");
});

test("una caja que se cerró sola (sin contar) no recibe efectivo: se pide abrir otra y la vieja queda registrada", async () => {
  // El turno de Ana (de arriba) se hace viejo: abierto ayer, pasó el corte.
  const [{ id: turno }] = await t.q(`select id from public.turnos_caja where caja_id = $1 and cerrado_en is null`, [cajaA]);
  await t.q(`update public.turnos_caja set abierto_en = now() - interval '2 days' where id = $1`, [turno]);
  const cp = await comoAna(async () => (await t.q(`select public.caja_para_cobrar($1) as r`, [t.sede]))[0].r);
  assert.equal(cp.turno_id, null, "el turno viejo no sirve para cobrar");
  assert.equal(cp.vencido, true);
  assert.ok(cp.libres.some((l) => l.nombre === "Recepción" && l.con_vencida), "la caja se puede abrir de nuevo: la vieja se registra sin contar");
  await comoAna(() => t.falla(() => vender(1, "efectivo"), /sin_caja/));
  await comoAna(() => t.falla(() => vender(1, "efectivo", turno), /sin contar: nadie puede cobrar/));
  // Abre el nuevo: la vieja queda cerrada "sin contar" con el esperado calculado, y el cobro cae en el nuevo.
  const nuevo = await comoAna(async () => (await t.q(`select public.abrir_caja($1, 1000) as id`, [cajaA]))[0].id);
  const [vieja] = await t.q(`select cerrado_en, sin_contar, monto_contado, monto_esperado from public.turnos_caja where id = $1`, [turno]);
  assert.ok(vieja.cerrado_en && vieja.sin_contar && vieja.monto_contado === null);
  assert.equal(Number(vieja.monto_esperado), 2500, "fondo 1.000 + 1.500 cobrado antes de que se venciera");
  const [{ r }] = await comoAna(() => vender(1, "efectivo"));
  const [{ turno: donde }] = await t.q(`select turno_caja_id as turno from public.pagos where venta_id = $1`, [r.venta_id]);
  assert.equal(donde, nuevo, "nada queda en la caja cerrada sin contar");
  const [{ n }] = await t.q(`select count(*)::int as n from public.pagos where turno_caja_id = $1`, [turno]);
  assert.equal(n, 1, "la caja vieja sigue con su único cobro: nada nuevo entró");
});

test("permisos: caja_para_cobrar no la lee quien no es del equipo; anon no ejecuta nada", async () => {
  const [{ id: u }] = await t.q(`insert into auth.users (email) values ('nadie@ejemplo.invalid') returning id`);
  await como(u, () => t.falla(() => t.q(`select public.caja_para_cobrar($1)`, [t.sede]), /Sin permiso/));
  const [{ a }] = await t.q(`select has_function_privilege('anon', 'public.caja_para_cobrar(uuid)', 'execute') a`);
  assert.equal(a, false);
});
