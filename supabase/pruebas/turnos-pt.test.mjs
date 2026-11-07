// VD-58 (5800): turnos con personal trainer. El pack se cobra con Vender (producto con pt_sesiones) y su saldo se calcula; el socio reserva
// una franja libre gastando UNA sesión; cancelar con la antelación la devuelve; la sesión dada queda como hecho; nada se reserva dos veces.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir } from "./_comun.mjs";

let t, uDueno, uEnc, uRec, uPt1, uPt2, ePt1, ePt2, eDueno, packAny, packPt1, socioA, socioB, uSocioA, uSocioB;
async function como(u, fn) {
  await t.db.query("savepoint co");
  await t.db.query("set role authenticated");
  await t.q(`select set_config('request.jwt.claims', $1, false)`, [JSON.stringify({ sub: u, role: "authenticated" })]);
  try {
    const r = await fn();
    await t.db.query("reset role");
    await t.q(`select set_config('request.jwt.claims', '', false)`);
    await t.db.query("release savepoint co");
    return r;
  } catch (e) {
    await t.db.query("rollback to savepoint co");
    throw e;
  }
}
before(async () => {
  t = await abrir("prueba-turnos-pt");
  const crear = async (rol, nombre) => {
    const [{ id }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`${nombre}${Math.random()}@ejemplo.invalid`]);
    const [{ id: eid }] = await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,$3,$4) returning id`, [t.g, id, nombre, rol]);
    return [id, eid];
  };
  [uDueno, eDueno] = await crear("dueno", "Duena"); [uEnc] = await crear("encargado", "Enco"); [uRec] = await crear("recepcion", "Sofi");
  [uPt1, ePt1] = await crear("profe", "Pablo"); [uPt2, ePt2] = await crear("profe", "Paula");
  socioA = t.ctx.socios.al_dia; socioB = t.ctx.socios.vencida;
  // Cada socio puede entrar a la app con su propio usuario.
  for (const [socio, nombre] of [[socioA, "A"], [socioB, "B"]]) {
    const [{ id }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`socio${nombre}${Math.random()}@ejemplo.invalid`]);
    await t.q(`update public.socios set usuario_id = $2 where id = $1`, [socio, id]);
    if (nombre === "A") uSocioA = id; else uSocioB = id;
  }
  [{ r: packAny }] = await como(uEnc, () => t.q(`select public.guardar_pack_pt($1, null, '10 sesiones de PT', 90000, 10, 90, null) as r`, [t.g]));
  [{ r: packPt1 }] = await como(uDueno, () => t.q(`select public.guardar_pack_pt($1, null, '3 sesiones con Pablo', 30000, 3, null, $2) as r`, [t.g, ePt1]));
});
after(async () => t && t.cerrar());

const vender = async (socio, producto, monto, cant = 1) => {
  const r = await como(uRec, () => t.q(`select public.vender($1, $2, $3, $4, null) as r`,
    [t.sede, JSON.stringify([{ tipo: "producto", producto_id: producto, cantidad: cant }]), JSON.stringify([{ medio: "transferencia", monto: monto * cant }]), socio]));
  return r[0].r.venta_id;
};
// Un día y hora como los escribe una persona en el formulario ("2026-11-20T10:00", hora del gimnasio), N días desde hoy.
const local = async (dias, hora) => (await t.q(`select to_char((privado.dia_local(now(), $1) + $2::int)::timestamp + $3::interval, 'YYYY-MM-DD"T"HH24:MI') as l`, [t.ctx.zona, dias, hora]))[0].l;
// Una franja futura cargada por el PT (días desde hoy, a las 10:00 locales), devuelve su id.
async function franja(uPt, ePt, dias, minutos = 60) {
  const loc = await local(dias, '10:00');
  await como(uPt, () => t.q(`select public.cargar_franjas_pt($1, $2, $3, $4, $5, 1)`, [t.g, t.sede, ePt, loc, minutos]));
  const [{ id }] = await t.q(`select id from public.pt_franjas where entrenador_id = $1 and inicio = ($2::timestamp at time zone $3) and cancelada_en is null`, [ePt, loc, t.ctx.zona]);
  return id;
}
// Una franja que arranca dentro de N horas, puesta por la base (para probar plazos y marcas).
const franjaEn = async (ePt, horas, minutos = 60) =>
  (await t.q(`insert into public.pt_franjas (gimnasio_id, sede_id, entrenador_id, inicio, fin, creada_por) values ($1,$2,$3, now() + make_interval(hours => $4), now() + make_interval(hours => $4) + make_interval(mins => $5), $3) returning id`,
    [t.g, t.sede, ePt, horas, minutos]))[0].id;
const reservar = (u, socio, f) => como(u, () => t.q(`select public.reservar_sesion_pt($1, $2) as r`, [socio, f])).then((x) => x[0].r);
const pt = async (u, socio) => (await como(u, () => t.q(`select public.pt_socio($1) as r`, [socio])))[0].r;

test("el pack es un producto del mostrador; sólo dueño y encargado lo guardan; vendido, no cambia", async () => {
  const [p] = await t.q(`select precio, pt_sesiones, pt_validez_dias, recurrente from public.productos where id = $1`, [packAny]);
  assert.equal(Number(p.precio), 90000); assert.equal(p.pt_sesiones, 10); assert.equal(p.pt_validez_dias, 90); assert.equal(p.recurrente, false);
  await como(uRec, () => t.falla(() => t.q(`select public.guardar_pack_pt($1, null, 'x', 100, 1, null, null)`, [t.g]), /Sin permiso/));
  await como(uPt1, () => t.falla(() => t.q(`select public.guardar_pack_pt($1, null, 'x', 100, 1, null, null)`, [t.g]), /Sin permiso/));
  await como(uEnc, () => t.falla(() => t.q(`select public.guardar_pack_pt($1, null, 'x', 100, 101, null, null)`, [t.g]), /1 a 100 sesiones/));
  await como(uEnc, () => t.falla(() => t.q(`select public.guardar_pack_pt($1, null, 'x', 0, 5, null, null)`, [t.g]), /mayor a cero/));
  await vender(socioB, packAny, 90000);
  await como(uEnc, () => t.falla(() => t.q(`select public.guardar_pack_pt($1, $2, '10 sesiones de PT', 95000, 12, 90, null)`, [t.g, packAny]), /ya se vendió/));
  await como(uEnc, () => t.q(`select public.guardar_pack_pt($1, $2, '10 sesiones de PT', 95000, 10, 90, null)`, [t.g, packAny]));   // el precio sí
  await como(uEnc, () => t.q(`select public.guardar_pack_pt($1, $2, '10 sesiones de PT', 90000, 10, 90, null)`, [t.g, packAny]));
});

test("cargar franjas: cada PT las suyas, el dueño las de cualquiera; repetir semanas; no se pisan; a futuro", async () => {
  const ini = await local(20, '09:00'), tardeIni = await local(20, '14:00'), pisado = await local(20, '09:30');
  await como(uPt1, () => t.falla(() => t.q(`select public.cargar_franjas_pt($1, $2, $3, $4, 60, 1)`, [t.g, t.sede, ePt2, ini]), /sus propios horarios/));
  await como(uRec, () => t.falla(() => t.q(`select public.cargar_franjas_pt($1, $2, $3, $4, 60, 1)`, [t.g, t.sede, ePt1, ini]), /Sin permiso/));
  const [{ n }] = await como(uPt1, () => t.q(`select public.cargar_franjas_pt($1, $2, $3, $4, 60, 4) as n`, [t.g, t.sede, ePt1, ini]));
  assert.equal(n, 4);
  const filas = await t.q(`select inicio from public.pt_franjas where entrenador_id = $1 and inicio >= ($2::timestamp at time zone $3) order by inicio`, [ePt1, ini, t.ctx.zona]);
  assert.equal(filas.length, 4);
  const horasEntre = (new Date(filas[1].inicio) - new Date(filas[0].inicio)) / 3600000;
  assert.ok(Math.abs(horasEntre - 168) <= 1, `cada semana, a la misma hora (${horasEntre} h)`);
  await como(uPt1, () => t.falla(() => t.q(`select public.cargar_franjas_pt($1, $2, $3, $4, 60, 1)`, [t.g, t.sede, ePt1, pisado]), /se pisa/));
  await como(uPt2, () => t.q(`select public.cargar_franjas_pt($1, $2, $3, $4, 60, 1)`, [t.g, t.sede, ePt2, ini]));        // otro PT a la misma hora: bien
  await como(uDueno, () => t.q(`select public.cargar_franjas_pt($1, $2, $3, $4, 45, 1)`, [t.g, t.sede, ePt2, tardeIni]));   // el dueño carga la de otro
  await como(uPt1, () => t.falla(() => t.q(`select public.cargar_franjas_pt($1, $2, $3, '2020-01-01T10:00', 60, 1)`, [t.g, t.sede, ePt1]), /a futuro/));
  await como(uPt1, () => t.falla(() => t.q(`select public.cargar_franjas_pt($1, $2, $3, $4, 5, 1)`, [t.g, t.sede, ePt1, ini]), /15 y 180/));
  await t.falla(() => t.q(`update public.pt_franjas set inicio = inicio + interval '1 day' where entrenador_id = $1`, [ePt1]), /sólo se completa la cancelación/);
  await t.falla(() => t.q(`delete from public.pt_franjas where entrenador_id = $1`, [ePt1]), /no se borran/);
});

test("sin pack no se reserva; con el pack se reserva y el saldo baja; el pack es de ese PT o de cualquiera", async () => {
  const f = await franja(uPt1, ePt1, 5);
  await como(uSocioA, () => t.falla(() => t.q(`select public.reservar_sesion_pt($1, $2)`, [socioA, f]), /No tiene un pack/));
  await vender(socioA, packPt1, 30000);                                   // 3 sesiones, sólo con Pablo
  const r = await reservar(uSocioA, socioA, f);
  assert.equal(r.restantes, 2);
  const p = await pt(uSocioA, socioA);
  assert.equal(p.packs[0].restantes, 2); assert.equal(p.packs[0].usadas, 1);
  assert.equal(p.sesiones[0].estado, "reservada");
  // El pack de Pablo no vale con Paula.
  const fPaula = await franja(uPt2, ePt2, 6);
  await como(uSocioA, () => t.falla(() => t.q(`select public.reservar_sesion_pt($1, $2)`, [socioA, fPaula]), /otro PT/));
  assert.ok(!(await pt(uSocioA, socioA)).libres.some((x) => x.franja_id === fPaula), "no le ofrece la franja de otro PT");
  assert.ok((await pt(uSocioA, socioA)).libres.some((x) => x.entrenador_id === ePt1), "sí le ofrece las de Pablo");
});

test("una franja no se reserva dos veces; otro socio no reserva por vos; el mostrador sí; dos sesiones a la misma hora no", async () => {
  const f = await franja(uPt1, ePt1, 7);
  const f2 = await franja(uPt2, ePt2, 7);          // mismo horario que f, otro PT
  await vender(socioB, packAny, 90000);
  await reservar(uSocioB, socioB, f);
  await como(uSocioA, () => t.falla(() => t.q(`select public.reservar_sesion_pt($1, $2)`, [socioA, f]), /ya está reservado/));
  await como(uSocioA, () => t.falla(() => t.q(`select public.reservar_sesion_pt($1, $2)`, [socioB, f2]), /Sin permiso/));      // A no reserva por B
  await como(uSocioB, () => t.falla(() => t.q(`select public.reservar_sesion_pt($1, $2)`, [socioB, f2]), /otra sesión reservada a esa hora/));
  // La recepción reserva por el socio A (queda anotado quién la hizo).
  const f3 = await franja(uPt1, ePt1, 8);
  const r = await reservar(uRec, socioA, f3);
  const [s] = await t.q(`select reservada_por is not null as por_equipo from public.sesiones_pt where id = $1`, [r.sesion_id]);
  assert.equal(s.por_equipo, true);
  // Y por la base, sin pasar por la función, tampoco hay dos sesiones vivas en la misma franja.
  await t.falla(() => t.q(`insert into public.sesiones_pt (gimnasio_id, franja_id, socio_id, venta_item_id) select gimnasio_id, franja_id, $2, venta_item_id from public.sesiones_pt where franja_id = $1`, [f, socioA]), /sesiones_pt_una_por_franja|duplicate/);
  // Un PT no reserva por un socio (no es del mostrador).
  await como(uPt1, () => t.falla(() => t.q(`select public.reservar_sesion_pt($1, $2)`, [socioB, f2]), /Sin permiso/));
});

test("no se reserva sin sesiones: se acaba el pack, y un pack vencido no sirve", async () => {
  const sx = t.ctx.socios.por_vencer;
  const [{ id: uSx }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`sx${Math.random()}@ejemplo.invalid`]);
  await t.q(`update public.socios set usuario_id = $2 where id = $1`, [sx, uSx]);
  await vender(sx, packPt1, 30000);            // 3 sesiones con Pablo
  const fs = [];
  for (let i = 0; i < 4; i++) fs.push(await franja(uPt1, ePt1, 30 + i));
  for (let i = 0; i < 3; i++) await reservar(uSx, sx, fs[i]);
  await como(uSx, () => t.falla(() => t.q(`select public.reservar_sesion_pt($1, $2)`, [sx, fs[3]]), /No le quedan sesiones/));
  assert.equal((await pt(uSx, sx)).tiene_saldo, false);
  // Vencido: se pone la compra hace 100 días (el pack de 90 días ya venció).
  const venta = await vender(socioB, packAny, 90000);
  await t.q(`update public.ventas set creado_en = now() - interval '100 days', confirmada_en = now() - interval '100 days' where id = $1`, [venta]);
  const [{ n }] = await t.q(`select count(*)::int n from privado.saldo_pt($1) where vence_en < now()`, [socioB]);
  assert.ok(n >= 1, "hay un pack vencido");
});

test("cancelar con antelación devuelve la sesión y deja la franja libre; tarde, el socio no puede", async () => {
  const sc = t.ctx.socios.pack_con_clases ?? t.ctx.socios.cumple;
  const [{ id: uSc }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`sc${Math.random()}@ejemplo.invalid`]);
  await t.q(`update public.socios set usuario_id = $2 where id = $1`, [sc, uSc]);
  await vender(sc, packAny, 90000);
  const f = await franja(uPt1, ePt1, 12);
  const r = await reservar(uSc, sc, f);
  assert.equal(r.restantes, 9);
  await como(uSocioA, () => t.falla(() => t.q(`select public.cancelar_sesion_pt($1)`, [r.sesion_id]), /Sin permiso/));
  await como(uSc, () => t.q(`select public.cancelar_sesion_pt($1)`, [r.sesion_id]));
  assert.equal((await pt(uSc, sc)).packs[0].restantes, 10, "la sesión se devolvió");
  // La franja quedó libre: otro socio la reserva.
  await reservar(uSocioB, socioB, f);
  // Tarde (dentro de las 12 h): la franja arranca en 5 horas.
  const tarde = await franjaEn(ePt1, 5);
  const rt = await t.q(`select privado.reservar_sesion_pt($1, $2, null) as r`, [sc, tarde]);
  const sesionTarde = rt[0].r.sesion_id;
  await como(uSc, () => t.falla(() => t.q(`select public.cancelar_sesion_pt($1)`, [sesionTarde]), /Ya pasó el plazo/));
  await como(uRec, () => t.falla(() => t.q(`select public.cancelar_sesion_pt($1)`, [sesionTarde]), /lo decide el encargado/));
  await como(uPt2, () => t.falla(() => t.q(`select public.cancelar_sesion_pt($1)`, [sesionTarde]), /Sin permiso/));
  await como(uEnc, () => t.falla(() => t.q(`select public.cancelar_sesion_pt($1)`, [sesionTarde]), /contá el motivo/));
  const antes = (await pt(uSc, sc)).packs[0].restantes;
  await como(uEnc, () => t.q(`select public.cancelar_sesion_pt($1, 'Se enfermó el PT')`, [sesionTarde]));
  assert.equal((await pt(uSc, sc)).packs[0].restantes, antes + 1, "el encargado la devolvió");
  // La antelación se configura.
  await como(uRec, () => t.falla(() => t.q(`select public.guardar_config_pt($1, 2)`, [t.g]), /Sin permiso/));
  await como(uEnc, () => t.falla(() => t.q(`select public.guardar_config_pt($1, 500)`, [t.g]), /0 a 168/));
  await como(uEnc, () => t.q(`select public.guardar_config_pt($1, 2)`, [t.g]));
  const rt2 = await t.q(`select privado.reservar_sesion_pt($1, $2, null) as r`, [sc, tarde]);
  await como(uSc, () => t.q(`select public.cancelar_sesion_pt($1)`, [rt2[0].r.sesion_id]));      // faltan 5 h y la antelación ahora es de 2
  await como(uEnc, () => t.q(`select public.guardar_config_pt($1, 12)`, [t.g]));
});

test("dictada y ausente: las marca el PT de esa sesión (o la gestión), ya empezada; gastan la sesión; el cierre no se reabre", async () => {
  const sc = t.ctx.socios.cumple;
  const [{ id: uSc }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`sd${Math.random()}@ejemplo.invalid`]);
  await t.q(`update public.socios set usuario_id = $2 where id = $1`, [sc, uSc]);
  await vender(sc, packAny, 90000);
  const base = (await pt(uSc, sc)).packs.find((p) => p.nombre === "10 sesiones de PT").restantes;
  // Dos franjas ya empezadas (se arman por la base: no se puede reservar el pasado).
  const mk = async (horasAtras) => {
    const [{ id }] = await t.q(`insert into public.pt_franjas (gimnasio_id, sede_id, entrenador_id, inicio, fin, creada_por) values ($1,$2,$3, now() + interval '1 day', now() + interval '1 day 1 hour', $3) returning id`, [t.g, t.sede, ePt1]);
    const [{ r }] = await t.q(`select privado.reservar_sesion_pt($1, $2, null) as r`, [sc, id]);
    await t.db.query("alter table public.pt_franjas disable trigger pt_franja_inmutable");
    await t.q(`update public.pt_franjas set inicio = now() - make_interval(hours => $2), fin = now() - make_interval(hours => $2) + interval '1 hour' where id = $1`, [id, horasAtras]);
    await t.db.query("alter table public.pt_franjas enable trigger pt_franja_inmutable");
    return r.sesion_id;
  };
  const s1 = await mk(3), s2 = await mk(5);
  // Todavía no empezó: una sesión futura no se marca.
  const fut = await franja(uPt1, ePt1, 40);
  const rf = await reservar(uSc, sc, fut);
  await como(uPt1, () => t.falla(() => t.q(`select public.marcar_sesion_pt($1, 'dictada')`, [rf.sesion_id]), /todavía no empezó/));
  await como(uPt2, () => t.falla(() => t.q(`select public.marcar_sesion_pt($1, 'dictada')`, [s1]), /Sólo el PT de esa sesión/));
  await como(uRec, () => t.falla(() => t.q(`select public.marcar_sesion_pt($1, 'dictada')`, [s1]), /Sin permiso/));
  await como(uSc, () => t.falla(() => t.q(`select public.marcar_sesion_pt($1, 'dictada')`, [s1]), /Sin permiso/));
  await como(uPt1, () => t.falla(() => t.q(`select public.marcar_sesion_pt($1, 'otra')`, [s1]), /dada o como ausente/));
  await como(uPt1, () => t.q(`select public.marcar_sesion_pt($1, 'dictada')`, [s1]));
  await como(uEnc, () => t.q(`select public.marcar_sesion_pt($1, 'ausente')`, [s2]));
  await como(uPt1, () => t.falla(() => t.q(`select public.marcar_sesion_pt($1, 'ausente')`, [s1]), /ya está dictada/));
  await t.falla(() => t.q(`update public.sesiones_pt set estado = 'reservada', marcada_en = null, marcada_por = null where id = $1`, [s1]), /ya está cerrada/);
  await t.falla(() => t.q(`delete from public.sesiones_pt where id = $1`, [s1]), /no se borran/);
  await como(uSc, () => t.falla(() => t.q(`select public.cancelar_sesion_pt($1)`, [s1]), /ya está dictada|ya empezó/));
  // Dictada y ausente gastaron la sesión (con la futura reservada son 3 menos).
  assert.equal((await pt(uSc, sc)).packs.find((p) => p.nombre === "10 sesiones de PT").restantes, base - 3);
  // Lo dictado por PT, para la liquidación.
  const hoy = (await t.q(`select privado.dia_local(now(), $1)::text d`, [t.ctx.zona]))[0].d;
  const r = (await como(uDueno, () => t.q(`select public.sesiones_dictadas_pt($1, ($2::date - 2), ($2::date + 1)) as r`, [t.g, hoy])))[0].r;
  const pablo = r.find((x) => x.entrenador_id === ePt1);
  assert.equal(pablo.dictadas, 1); assert.equal(pablo.ausentes, 1);
  const propio = (await como(uPt1, () => t.q(`select public.sesiones_dictadas_pt($1, ($2::date - 2), ($2::date + 1)) as r`, [t.g, hoy])))[0].r;
  assert.ok(propio.every((x) => x.entrenador_id === ePt1), "el PT ve sólo lo suyo");
  await como(uRec, () => t.falla(() => t.q(`select public.sesiones_dictadas_pt($1, ($2::date - 2), ($2::date + 1))`, [t.g, hoy]), /Sin permiso/));
});

test("quitar una franja con sesión reservada la cancela y devuelve el saldo; sólo el PT dueño de la franja o la gestión", async () => {
  const sc = t.ctx.socios.pack_con_clases ?? t.ctx.socios.cumple;
  const f = await franja(uPt2, ePt2, 25);
  const f0 = await franja(uPt2, ePt2, 26);
  await como(uPt1, () => t.falla(() => t.q(`select public.quitar_franja_pt($1)`, [f0]), /sus propios horarios/));
  await como(uRec, () => t.falla(() => t.q(`select public.quitar_franja_pt($1)`, [f0]), /Sin permiso/));
  await como(uPt2, () => t.q(`select public.quitar_franja_pt($1)`, [f0]));                  // libre: se quita sin vueltas
  await como(uPt2, () => t.falla(() => t.q(`select public.quitar_franja_pt($1)`, [f0]), /ya estaba quitado/));
  const [{ id: uS }] = await t.q(`select usuario_id as id from public.socios where id = $1`, [sc]);
  const antes = (await pt(uS, sc)).packs.reduce((a, p) => a + p.restantes, 0);
  const r = await reservar(uS, sc, f);
  await como(uPt2, () => t.falla(() => t.q(`select public.quitar_franja_pt($1)`, [f]), /contá el motivo/));
  const q = (await como(uPt2, () => t.q(`select public.quitar_franja_pt($1, 'Me surgió algo') as r`, [f])))[0].r;
  assert.equal(q.cancelo_sesion, true);
  assert.equal((await pt(uS, sc)).packs.reduce((a, p) => a + p.restantes, 0), antes, "el saldo volvió");
  const [h] = await t.q(`select estado, cancelada_origen from public.sesiones_pt where id = $1`, [r.sesion_id]);
  assert.equal(h.estado, "cancelada"); assert.equal(h.cancelada_origen, "franja");
});

test("la agenda: el PT ve sólo la suya; la recepción reserva por el socio pero no carga; anulada la venta, se pierde el saldo", async () => {
  const a1 = (await como(uPt1, () => t.q(`select public.agenda_pt($1, $2) as r`, [t.g, ePt2])))[0].r;      // pide la de Paula: igual ve la suya
  assert.ok(a1.franjas.every((x) => x.entrenador_id === ePt1), "Pablo no ve la agenda de Paula");
  assert.equal(a1.puede_gestionar, false);
  const aR = (await como(uRec, () => t.q(`select public.agenda_pt($1) as r`, [t.g])))[0].r;
  assert.equal(aR.puede_reservar_por_socio, true);
  assert.ok(new Set(aR.franjas.map((x) => x.entrenador_id)).size >= 2, "la recepción ve las de todos");
  const aD = (await como(uDueno, () => t.q(`select public.agenda_pt($1) as r`, [t.g])))[0].r;
  assert.equal(aD.puede_gestionar, true);
  assert.ok(aD.packs.length >= 2);
  // Anular la venta del pack le saca el saldo (no se guarda: se calcula).
  const s = t.ctx.socios.por_vencer;
  const venta = await vender(s, packAny, 90000);
  const [{ u }] = await t.q(`select count(*)::int u from privado.saldo_pt($1)`, [s]);
  assert.ok(u >= 1);
  await t.q(`update public.ventas set estado = 'anulada', anulada_en = now(), anulada_motivo = 'prueba', anulada_por = $2 where id = $1`, [venta, eDueno]);
  const antes = await t.q(`select count(*)::int u from privado.saldo_pt($1) where venta_item_id in (select id from public.venta_items where venta_id = $2)`, [s, venta]);
  assert.equal(antes[0].u, 0);
});

test("otro gimnasio y la sección apagada: error; el cuadro del socio dice que está apagado", async () => {
  const [{ id: forastero }] = await t.q(`insert into auth.users (email) values ('fuera@ejemplo.invalid') returning id`);
  await como(forastero, () => t.falla(() => t.q(`select public.agenda_pt($1)`, [t.g]), /Sin permiso/));
  await como(forastero, () => t.falla(() => t.q(`select public.pt_socio($1)`, [socioA]), /Sin permiso/));
  await t.q(`update public.configuracion_gimnasio set secciones_apagadas = array['pt'] where gimnasio_id = $1`, [t.g]);
  await como(uDueno, () => t.falla(() => t.q(`select public.agenda_pt($1)`, [t.g]), /apagados/));
  const f = (await t.q(`select id from public.pt_franjas where cancelada_en is null and inicio > now() limit 1`))[0].id;
  await como(uSocioA, () => t.falla(() => t.q(`select public.reservar_sesion_pt($1, $2)`, [socioA, f]), /apagados/));
  assert.equal((await pt(uSocioA, socioA)).prendido, false);
});
