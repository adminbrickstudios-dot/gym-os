// VD-46E (20261106007202): baja con constancia.
// Cada baja tiene su código (la pedida por la app y la dada en el mostrador); un pedido sin responder hace más de 24 h avisa en la campana
// y se dice en Para hacer hoy; dar la baja anula los pagos pendientes (y sus ventas), saca los turnos fijos y cancela las reservas futuras,
// sin tocar lo ya cobrado.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir } from "./_comun.mjs";

let t, u = {}, eq = {}, alDia, horario, hoy, desde;
async function persona(rol, nombre) {
  const [{ id }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`${rol}${Math.random()}@ejemplo.invalid`]);
  const [{ id: e }] = await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,$3,$4) returning id`, [t.g, id, nombre, rol]);
  u[rol] = id; eq[rol] = e;
}
async function como(usuario, fn) {
  // Con savepoint: si algo falla, el error de verdad sale (no el "transacción abortada" del reset role).
  await t.db.query("savepoint como");
  await t.db.query("set role authenticated");
  await t.q(`select set_config('request.jwt.claims', $1, false)`, [JSON.stringify({ sub: usuario, role: "authenticated" })]);
  try {
    const r = await fn();
    await t.db.query("reset role"); await t.q(`select set_config('request.jwt.claims', '', false)`);
    return r;
  } catch (e) { await t.db.query("rollback to savepoint como"); await t.db.query("reset role"); throw e; }
}
const campana = async () => (await como(u.dueno, async () => (await t.q(`select public.campana_control($1) as r`, [t.g]))[0].r)).items;

before(async () => {
  t = await abrir("prueba-vd46e");
  await persona("dueno", "Sofía"); await persona("encargado", "Martín"); await persona("recepcion", "Ana");
  const [{ id }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`socio${Math.random()}@ejemplo.invalid`]);
  u.socio = id;
  alDia = t.ctx.socios.al_dia;
  await t.q(`update public.socios set usuario_id = $2 where id = $1`, [alDia, id]);
  [{ hoy, desde }] = await t.q(`select (now() at time zone zona_horaria)::date::text as hoy, ((now() at time zone zona_horaria)::date - 3)::text as desde from public.gimnasios where id = $1`, [t.g]);
  // Un turno fijo mañana a las 10 (deja una reserva futura).
  await t.q(`update public.configuracion_gimnasio set modo_clases = 'reserva', reserva_dias_anticipacion = 7 where gimnasio_id = $1`, [t.g]);
  const [{ id: act }] = await t.q(`insert into public.actividades (gimnasio_id, nombre) values ($1, 'Funcional') returning id`, [t.g]);
  [{ id: horario }] = await t.q(`insert into public.horarios_clase (gimnasio_id, sede_id, actividad_id, dia_semana, hora_inicio, duracion_min, cupo, vigente_desde)
    values ($1, $2, $3, extract(isodow from privado.dia_local(now(), $4) + 1)::int, '10:00', 60, 5, privado.dia_local(now(), $4)) returning id`, [t.g, t.sede, act, t.ctx.zona]);
  await como(u.dueno, () => t.q(`select public.guardar_turnos_fijos($1, true)`, [t.g]));
  await como(u.socio, () => t.q(`select public.abonar_turno($1, $2)`, [alDia, horario]));
  // Una transferencia que espera aprobación, y un cobro ya aprobado.
  const [{ id: vp }] = await t.q(`insert into public.ventas (gimnasio_id, sede_id, socio_id, estado, origen, creado_por) values ($1,$2,$3,'pendiente','app',null) returning id`, [t.g, t.sede, alDia]);
  await t.q(`insert into public.venta_items (gimnasio_id, venta_id, tipo, descripcion, precio_unitario) values ($1,$2,'otro','Transferencia pendiente',20000)`, [t.g, vp]);
  await t.q(`insert into public.pagos (gimnasio_id, venta_id, medio, monto, estado, comprobante_path) values ($1,$2,'transferencia',20000,'pendiente','comprobantes/x.jpg')`, [t.g, vp]);
  const [{ id: vc }] = await t.q(`insert into public.ventas (gimnasio_id, sede_id, socio_id, estado, origen, confirmada_en, creado_por) values ($1,$2,$3,'confirmada','recepcion', now(), $4) returning id`, [t.g, t.sede, alDia, eq.recepcion]);
  await t.q(`insert into public.venta_items (gimnasio_id, venta_id, tipo, descripcion, precio_unitario) values ($1,$2,'otro','Cobrado',9000)`, [t.g, vc]);
  await t.q(`insert into public.pagos (gimnasio_id, venta_id, medio, monto, estado, aprobado_en) values ($1,$2,'transferencia',9000,'aprobado', now())`, [t.g, vc]);
  t.vp = vp; t.vc = vc;
});
after(async () => t && t.cerrar());

test("el socio pide la baja por la app y ve su código; el equipo lo ve igual", async () => {
  const id = await como(u.socio, async () => (await t.q(`select public.pedir_baja_socio($1, 'precio', 'Está caro') as id`, [alDia]))[0].id);
  assert.ok(id);
  const c = await como(u.socio, async () => (await t.q(`select public.constancia_baja($1) as r`, [alDia]))[0].r);
  assert.match(c.codigo, /^BAJA-[0-9A-F]{8}$/);
  assert.equal(c.estado, "pendiente");
  const f = await como(u.recepcion, async () => (await t.q(`select public.pedido_baja_socio($1) as r`, [alDia]))[0].r);
  assert.equal(f.codigo, c.codigo);
  const l = await como(u.recepcion, async () => (await t.q(`select public.pedidos_baja_pendientes($1) as r`, [t.g]))[0].r);
  assert.equal(l.length, 1); assert.equal(l[0].codigo, c.codigo); assert.equal(l[0].tarde, false);
  // Otro socio no ve la constancia de éste.
  await como(u.socio, () => t.falla(() => t.q(`select public.constancia_baja($1)`, [t.ctx.socios.vencida]), /Sin permiso/));
});

test("sin responder hace más de 24 h: avisa en la campana (una vez) y Para hacer hoy lo dice", async () => {
  assert.equal((await campana()).filter((i) => /^pedido_baja_tarde:/.test(i.clave)).length, 0, "recién pedido: todavía no");
  await t.q(`update public.pedidos_baja set pedido_en = now() - interval '26 hours' where socio_id = $1 and estado = 'pendiente'`, [alDia]);
  const a = (await campana()).filter((i) => /^pedido_baja_tarde:/.test(i.clave));
  assert.equal(a.length, 1); assert.match(a[0].titulo, /Testigo Al Día pidió la baja hace más de 24 h/); assert.match(a[0].detalle, /BAJA-/);
  const tareas = await como(u.dueno, async () => (await t.q(`select public.para_hacer_hoy($1) as r`, [t.g]))[0].r);
  const baja = tareas.find((x) => x.clave === "pedidos_baja");
  assert.ok(baja, "Para hacer hoy trae las bajas pedidas");
  assert.match(baja.texto, /1 baja pedida desde la app \(1 sin responder hace más de 24 h\)/);
  const l = await como(u.dueno, async () => (await t.q(`select public.pedidos_baja_pendientes($1) as r`, [t.g]))[0].r);
  assert.equal(l[0].tarde, true);
});

test("dar la baja cierra lo pendiente: pago por aprobar, turno fijo y reserva futura; lo cobrado no se toca", async () => {
  const [{ n: antes }] = await t.q(`select count(*)::int n from public.reservas where socio_id = $1 and estado = 'confirmada'`, [alDia]);
  assert.equal(antes, 1, "tenía una reserva futura");
  const [{ id: pedido }] = await t.q(`select id from public.pedidos_baja where socio_id = $1 and estado = 'pendiente'`, [alDia]);
  await como(u.recepcion, () => t.q(`select public.resolver_pedido_baja($1, true)`, [pedido]));
  const [s] = await t.q(`select dado_de_baja_en, motivo_baja from public.socios where id = $1`, [alDia]);
  assert.ok(s.dado_de_baja_en); assert.equal(s.motivo_baja, "precio");
  const [p] = await t.q(`select estado, rechazado_motivo, rechazado_por from public.pagos where venta_id = $1`, [t.vp]);
  assert.equal(p.estado, "rechazado"); assert.equal(p.rechazado_motivo, "Baja del socio"); assert.equal(p.rechazado_por, eq.recepcion);
  const [v] = await t.q(`select estado, anulada_motivo, anulada_por from public.ventas where id = $1`, [t.vp]);
  assert.equal(v.estado, "anulada"); assert.equal(v.anulada_motivo, "Baja del socio"); assert.equal(v.anulada_por, eq.recepcion);
  const [cobrado] = await t.q(`select v.estado as v, p.estado as p from public.ventas v join public.pagos p on p.venta_id = v.id where v.id = $1`, [t.vc]);
  assert.deepEqual([cobrado.v, cobrado.p], ["confirmada", "aprobado"], "lo ya cobrado queda como estaba");
  const [{ n: turnos }] = await t.q(`select count(*)::int n from public.turnos_fijos where socio_id = $1 and hasta is null`, [alDia]);
  assert.equal(turnos, 0);
  const [{ n: reservas }] = await t.q(`select count(*)::int n from public.reservas where socio_id = $1 and estado <> 'cancelada'`, [alDia]);
  assert.equal(reservas, 0);
  const [rc] = await t.q(`select cancelada_por from public.reservas where socio_id = $1 order by creado_en desc limit 1`, [alDia]);
  assert.equal(rc.cancelada_por, "equipo");
  const [pd] = await t.q(`select estado, resuelto_por, codigo from public.pedidos_baja where id = $1`, [pedido]);
  assert.equal(pd.estado, "dado_de_baja"); assert.equal(pd.resuelto_por, eq.recepcion);
  const c = await como(u.socio, async () => (await t.q(`select public.constancia_baja($1) as r`, [alDia]))[0].r);
  assert.equal(c.estado, "dado_de_baja"); assert.equal(c.resuelto_por, "Ana"); assert.equal(c.codigo, pd.codigo);
  await como(u.recepcion, () => t.falla(() => t.q(`select public.resolver_pedido_baja($1, true)`, [pedido]), /ya se resolvió/));
  // Ya no hay aviso de "sin responder".
  assert.equal((await campana()).filter((i) => /^pedido_baja_tarde:/.test(i.clave)).length, 0);
});

test("la baja dada en el mostrador también deja su código; “se queda” no da la baja; Control lista las bajas", async () => {
  const socio = t.ctx.socios.por_vencer;
  const r = await como(u.encargado, async () => (await t.q(`select public.dar_de_baja($1, 'mudanza') as r`, [socio]))[0].r);
  assert.match(r.codigo, /^BAJA-[0-9A-F]{8}$/);
  assert.ok(r.pagos_anulados === 0 && r.turnos_quitados === 0 && r.reservas_canceladas === 0);
  const [pd] = await t.q(`select estado, motivo, resuelto_por from public.pedidos_baja where codigo = $1`, [r.codigo]);
  assert.equal(pd.estado, "dado_de_baja"); assert.equal(pd.motivo, "mudanza"); assert.equal(pd.resuelto_por, eq.encargado);
  // Un motivo fuera de la lista queda como "otro".
  const r2 = await como(u.dueno, async () => (await t.q(`select public.dar_de_baja($1, 'cualquier cosa') as r`, [t.ctx.socios.vence_hoy]))[0].r);
  assert.equal((await t.q(`select motivo from public.pedidos_baja where codigo = $1`, [r2.codigo]))[0].motivo, "otro");

  // Se habló y se queda.
  const otro = t.ctx.socios.en_tolerancia;
  const [{ id: pid }] = await t.q(`insert into public.pedidos_baja (gimnasio_id, socio_id, motivo, pedido_por) values ($1,$2,'horario',$3) returning id`, [t.g, otro, u.dueno]);
  await como(u.encargado, () => t.q(`select public.resolver_pedido_baja($1, false)`, [pid]));
  assert.equal((await t.q(`select dado_de_baja_en from public.socios where id = $1`, [otro]))[0].dado_de_baja_en, null);
  assert.equal((await t.q(`select estado from public.pedidos_baja where id = $1`, [pid]))[0].estado, "se_queda");

  const c = await como(u.dueno, async () => (await t.q(`select public.moderacion_control($1, $2::date, $3::date) as r`, [t.g, desde, hoy]))[0].r);
  const bajas = c.items.filter((i) => i.tipo === "baja");
  assert.ok(bajas.length >= 3, `hay ${bajas.length} bajas`);
  assert.ok(bajas.some((i) => i.quien === "Martín" && /mudanza · BAJA-/.test(i.detalle)));
  assert.ok(bajas.some((i) => i.quien === "Ana" && /precio · BAJA-/.test(i.detalle)));
});
