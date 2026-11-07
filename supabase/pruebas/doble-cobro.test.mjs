// VD-50 (D29, REV-6a) · Doble cobro: la misma cuota del mismo socio cobrada hace menos de N minutos por OTRA operación
// frena con 'ya_cobrada' (quién y hace cuánto) y solo sigue con confirmar = true + un motivo, que queda en la venta.
// La misma clave sigue siendo idempotente; un producto o un pase nunca se frena; N es configurable (0 = apagado).
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir } from "./_comun.mjs";

let t, uDueno, uSofi, uPedro, uEnc, agua, eSofi, ePedro;
before(async () => {
  t = await abrir("prueba-doble-cobro");
  const crear = async (rol, nombre) => {
    const [{ id: u }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`${rol}${Math.random()}@ejemplo.invalid`]);
    const [{ id: e }] = await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,$3,$4) returning id`, [t.g, u, nombre, rol]);
    return [u, e];
  };
  [uDueno] = await crear("dueno", "Dueña");
  [uSofi, eSofi] = await crear("recepcion", "Sofi");
  [uPedro, ePedro] = await crear("recepcion", "Pedro");
  [uEnc] = await crear("encargado", "Beto");
  [{ id: agua }] = await t.q(`insert into public.productos (gimnasio_id, nombre, precio) values ($1,'Agua',1000) returning id`, [t.g]);
});
after(async () => t && t.cerrar());

// Cada llamada se hace con el usuario puesto y se descarta el rol; lo escrito queda en la transacción de la prueba.
async function como(u, fn) {
  await t.db.query("set role authenticated");
  await t.q(`select set_config('request.jwt.claims', $1, false)`, [JSON.stringify({ sub: u, role: "authenticated" })]);
  try { return await fn(); } finally {
    // Si fn falló la transacción está abortada: t.falla vuelve a su savepoint y con eso se deshace también el rol.
    try { await t.db.query("reset role"); await t.q(`select set_config('request.jwt.claims', '', false)`); } catch { /* transacción abortada */ }
  }
}
const uid = () => crypto.randomUUID();
const cuota = (socio, { u = uSofi, clave = uid(), cantidad = 1, confirmar = false, motivo = null } = {}) =>
  como(u, async () => (await t.q(`select public.vender($1, $2, $3, $4, null, $5, null, null, null, $6, $7) as r`, [
    t.sede, JSON.stringify([{ tipo: "cuota", cantidad }]), JSON.stringify([{ medio: "transferencia", monto: 25000 * cantidad }]), socio, clave, confirmar, motivo]))[0].r);
const producto = (socio, u = uSofi) => como(u, async () => (await t.q(`select public.vender($1, $2, $3, $4, null, $5) as r`, [
  t.sede, JSON.stringify([{ tipo: "producto", producto_id: agua }]), JSON.stringify([{ medio: "transferencia", monto: 1000 }]), socio, uid()]))[0].r);
// Hace pasar el tiempo: la venta se "cobró" hace tantos segundos.
const hace = (ventaId, seg) => t.q(`update public.ventas set creado_en = now() - make_interval(secs => $2), registrada_en = null where id = $1`, [ventaId, seg]);

test("la misma cuota cobrada por otra operación hace un momento frena: ya_cobrada dice quién y hace cuánto", async () => {
  const socio = t.ctx.socios.sin_pago;
  const primera = await cuota(socio);
  assert.equal(Number(primera.total), 25000);
  await hace(primera.venta_id, 40);
  const e = await t.falla(() => cuota(socio, { u: uPedro }), /^ya_cobrada: Sofi ya cobró esta cuota hace 40 s \(por \$25\.000\)/);
  assert.equal(e.code, "DC001");
  // También con la misma persona, y sin tocar nada: el rechazo no deja venta ni cobertura de más.
  await t.falla(() => cuota(socio, { u: uSofi }), /ya_cobrada/);
  const [{ n }] = await t.q(`select count(*)::int n from public.coberturas where socio_id = $1 and anulada_en is null and origen = 'pago'`, [socio]);
  assert.equal(n, 1, "una sola cobertura: la segunda no se cobró");
});

test("la misma clave de operación sigue siendo idempotente: devuelve el mismo cobro, no pregunta", async () => {
  const socio = t.ctx.socios.vencida;
  const clave = uid();
  const a = await cuota(socio, { clave });
  const b = await cuota(socio, { clave });
  assert.equal(b.repetida, true);
  assert.equal(b.venta_id, a.venta_id);
});

test("sigue solo con confirmar = true y un motivo escrito, que queda en la venta (con cuál era la cobrada)", async () => {
  const socio = t.ctx.socios.sin_pago;
  const [{ id: previa }] = await t.q(`select v.id from public.ventas v where v.socio_id = $1 and v.estado = 'confirmada' order by v.creado_en desc limit 1`, [socio]);
  await t.falla(() => cuota(socio, { u: uPedro, confirmar: true }), /necesita un motivo escrito/);
  await t.falla(() => cuota(socio, { u: uPedro, confirmar: true, motivo: "  " }), /necesita un motivo escrito/);
  await t.falla(() => cuota(socio, { u: uPedro, confirmar: true, motivo: "ab" }), /necesita un motivo escrito/);
  await t.falla(() => cuota(socio, { u: uPedro, confirmar: false, motivo: "Paga dos meses por separado" }), /motivo es de un cobro confirmado/);
  const r = await cuota(socio, { u: uPedro, confirmar: true, motivo: "Paga el mes que viene también, a pedido del socio" });
  assert.equal(Number(r.total), 25000);
  assert.equal(r.doble_cobro_de, previa);
  const [v] = await t.q(`select doble_cobro_motivo, doble_cobro_de, creado_por from public.ventas where id = $1`, [r.venta_id]);
  assert.equal(v.doble_cobro_motivo, "Paga el mes que viene también, a pedido del socio");
  assert.equal(v.doble_cobro_de, previa);
  assert.equal(v.creado_por, ePedro, "queda quién la confirmó");
  const [{ n }] = await t.q(`select count(*)::int n from public.ventas where gimnasio_id = $1 and doble_cobro_de is not null`, [t.g]);
  assert.equal(n, 1);
});

test("nunca frena lo que no es la cuota: un producto, otro socio, ni pagar varios meses juntos (una sola venta)", async () => {
  const socio = t.ctx.socios.sin_pago;            // ya tiene cuotas cobradas hace un momento
  const p = await producto(socio);
  assert.equal(Number(p.total), 1000, "un producto al mismo socio no se frena");
  const otro = await cuota(t.ctx.socios.al_dia, { u: uPedro });
  assert.ok(otro.venta_id, "otro socio, ningún problema");
  const adelantado = await cuota(t.ctx.socios.por_vencer, { cantidad: 2 });
  assert.equal(Number(adelantado.total), 50000, "dos meses juntos, en una sola operación");
  assert.equal(adelantado.generados >= 1, true);
});

test("pasados los N minutos vuelve a cobrar normal; N se cambia por gimnasio y 0 lo apaga", async () => {
  const socio = t.ctx.socios.vencida;
  const [{ id: ultima }] = await t.q(`select v.id from public.ventas v where v.socio_id = $1 and v.estado = 'confirmada' order by v.creado_en desc limit 1`, [socio]);
  await hace(ultima, 119);
  await t.falla(() => cuota(socio, { u: uPedro }), /ya_cobrada: Sofi ya cobró esta cuota hace 119 s|ya_cobrada: .* hace 2 min/);
  await hace(ultima, 121);
  const ok = await cuota(socio, { u: uPedro });
  assert.ok(ok.venta_id, "con 2 min y 1 s ya no es el mismo cobro");
  // El dueño sube N a 10 minutos: lo de hace 5 min frena (lo anterior ya es viejo).
  await hace(ultima, 3000);
  await como(uDueno, () => t.q(`select public.guardar_doble_cobro($1, 10)`, [t.g]));
  await hace(ok.venta_id, 300);
  const e = await t.falla(() => cuota(socio, { u: uSofi }), /ya_cobrada: Pedro ya cobró esta cuota hace 5 min/);
  assert.equal(e.code, "DC001");
  // 0 = apagado.
  await como(uDueno, () => t.q(`select public.guardar_doble_cobro($1, 0)`, [t.g]));
  const apagado = await cuota(socio, { u: uSofi });
  assert.ok(apagado.venta_id, "apagado, no pregunta");
  const [{ n }] = await t.q(`select count(*)::int n from public.ventas where id = $1 and doble_cobro_de is not null`, [apagado.venta_id]);
  assert.equal(n, 0, "sin aviso no se anota motivo");
  await como(uDueno, () => t.q(`select public.guardar_doble_cobro($1, 2)`, [t.g]));
});

test("una cuota anulada no cuenta: se puede volver a cobrar", async () => {
  const socio = t.ctx.socios.sin_pago;            // tiene cuotas recientes de las pruebas de arriba
  await t.falla(() => cuota(socio, { u: uSofi }), /ya_cobrada/);
  // El dueño anula todo lo cobrado a este socio (con motivo): ya no hay nada cobrado que avisar.
  for (const { id } of await t.q(`select id from public.ventas where socio_id = $1 and estado = 'confirmada'`, [socio])) {
    await como(uDueno, () => t.q(`select public.anular_venta_panel($1, 'Se cobró dos veces')`, [id]));
  }
  const nueva = await cuota(socio, { u: uSofi });
  assert.ok(nueva.venta_id, "anuladas las anteriores, nada que avisar");
});

test("contexto_cobro avisa al abrir con la misma regla y respeta N", async () => {
  const socio = t.ctx.socios.vence_hoy;
  const antes = await como(uPedro, async () => (await t.q(`select public.contexto_cobro($1, $2) as r`, [t.sede, socio]))[0].r);
  assert.equal(antes.reciente, null);
  assert.equal(antes.doble_cobro_minutos, 2);
  const v = await cuota(socio, { u: uSofi });
  await hace(v.venta_id, 40);
  const ctx = await como(uPedro, async () => (await t.q(`select public.contexto_cobro($1, $2) as r`, [t.sede, socio]))[0].r);
  assert.equal(ctx.reciente.quien, "Sofi");
  assert.equal(ctx.reciente.hace_seg, 40);
  assert.equal(Number(ctx.reciente.total), 25000);
  await como(uDueno, () => t.q(`select public.guardar_doble_cobro($1, 0)`, [t.g]));
  const apagado = await como(uPedro, async () => (await t.q(`select public.contexto_cobro($1, $2) as r`, [t.sede, socio]))[0].r);
  assert.equal(apagado.reciente, null);
  assert.equal(apagado.doble_cobro_minutos, 0);
  await como(uDueno, () => t.q(`select public.guardar_doble_cobro($1, 2)`, [t.g]));
});

test("configuración: solo el dueño la cambia, 0 a 60, queda en el historial; todos del equipo la leen", async () => {
  await como(uSofi, () => t.falla(() => t.q(`select public.guardar_doble_cobro($1, 5)`, [t.g]), /Sin permiso/));
  await como(uEnc, () => t.falla(() => t.q(`select public.guardar_doble_cobro($1, 5)`, [t.g]), /Sin permiso/));
  await como(uDueno, () => t.falla(() => t.q(`select public.guardar_doble_cobro($1, 61)`, [t.g]), /entre 0 \(apagado\) y 60/));
  await como(uDueno, () => t.falla(() => t.q(`select public.guardar_doble_cobro($1, -1)`, [t.g]), /entre 0/));
  await como(uDueno, () => t.falla(() => t.q(`select public.guardar_doble_cobro($1, null)`, [t.g]), /entre 0/));
  const c = await como(uDueno, async () => (await t.q(`select public.guardar_doble_cobro($1, 7) as r`, [t.g]))[0].r);
  assert.equal(c.doble_cobro_minutos, 7);
  assert.equal(c.doble_cobro_ultimo_cambio.por, "Dueña");
  const lee = await como(uSofi, async () => (await t.q(`select public.config_cobro($1) as r`, [t.g]))[0].r);
  assert.equal(lee.doble_cobro_minutos, 7);
  const [h] = await t.q(`select tema, antes, despues from public.cambios_cobro where gimnasio_id = $1 and tema = 'doble_cobro' and despues->>'minutos' = '7'`, [t.g]);   // (en una sola transacción todos comparten la hora)
  assert.ok(h, "el cambio quedó en el historial");
  assert.equal(h.antes.minutos, 2);
  await como(uDueno, () => t.q(`select public.guardar_doble_cobro($1, 2)`, [t.g]));
});

test("permisos: anon no ejecuta; la regla interna no la llama nadie desde afuera", async () => {
  const [r] = await t.q(`select has_function_privilege('anon', 'public.guardar_doble_cobro(uuid, int)', 'execute') a,
    has_function_privilege('anon', 'public.vender(uuid, jsonb, jsonb, uuid, uuid, uuid, timestamptz, text, text, boolean, text)', 'execute') b,
    has_function_privilege('authenticated', 'privado.cuota_cobrada_reciente(uuid, uuid, int)', 'execute') c`);
  assert.deepEqual([r.a, r.b, r.c], [false, false, false]);
});
