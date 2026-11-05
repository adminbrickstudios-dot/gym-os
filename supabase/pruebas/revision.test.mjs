// Regresión de la revisión independiente del 29/10/2026: cada prueba es
// un error que se encontró ejecutando, y exige el comportamiento correcto.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir, HOY } from "./_comun.mjs";
import { sumarDias } from "../../scripts/datos/casos-testigo.mjs";

let t, momento;
before(async () => {
  t = await abrir("prueba-revision");
  momento = await t.en(HOY);
});
after(async () => t && t.cerrar());

const D = (n) => sumarDias(HOY, n);
const acc = async (socio, m = momento, sede = null) =>
  (await t.q(`select (privado.calcular_acceso($1, $2, $3)).*`, [socio, m, sede]))[0];
const cobrar = async (socio, cuotas = 1, m = momento, medio = "transferencia") =>
  (await t.q(`select privado.cobrar_cuota($1, $2, $3, $4, null, null, $5) as r`, [socio, t.sede, medio, cuotas, m]))[0].r;
const congelar = (su, d, h, pasado = true) =>
  t.q(`select privado.congelar($1, $2::date, $3::date, 'viaje', null, null, $4)`, [su, d, h, pasado]);
const coberturas = async (socio) =>
  (await t.q(`select to_char(desde at time zone $2, 'DD/MM/YYYY') d, to_char(hasta at time zone $2, 'DD/MM/YYYY') h, origen
                from public.coberturas where socio_id = $1 and anulada_en is null order by desde`, [socio, t.ctx.zona]))
    .map((c) => `${c.origen}[${c.d}→${c.h})`);
const sp = (n) => t.db.query(`savepoint ${n}`);
const rb = (n) => t.db.query(`rollback to savepoint ${n}`);

async function socioNuevo(apellido, planId, cobs = []) {
  const [{ id: s }] = await t.q(`insert into public.socios (gimnasio_id, nombre, apellido) values ($1,'Rev',$2) returning id`, [t.g, apellido]);
  const [{ id: su }] = await t.q(`insert into public.suscripciones (gimnasio_id, socio_id, plan_id, inicio)
      values ($1,$2,$3,'2026-01-01T03:00:00Z') returning id`, [t.g, s, planId]);
  for (const [d, h] of cobs)
    await t.q(`insert into public.coberturas (gimnasio_id, suscripcion_id, socio_id, desde, hasta, origen, motivo)
               values ($1,$2,$3,privado.medianoche($4::date,$6),privado.medianoche($5::date,$6),'cortesia','rev')`,
      [t.g, su, s, d, h, t.ctx.zona]);
  return { s, su };
}
async function usuario(rol, sedeId = null) {
  const [{ id: u }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`${rol}${Math.random()}@ejemplo.invalid`]);
  await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol, sede_id) values ($1,$2,$3,$4,$5)`, [t.g, u, rol, rol, sedeId]);
  return u;
}
async function como(u) {
  await t.db.query(`set local role authenticated`);
  await t.q(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: u, role: "authenticated" })]);
}
const ingreso = (s, dia) => t.q(
  `insert into public.ingresos (gimnasio_id, sede_id, socio_id, momento, via_acceso, resultado, via_habilitante, color, motivo, texto)
   values ($1,$2,$3,privado.medianoche($4::date,$5)+interval '19 hours','recepcion','entro','membresia','verde','al_dia','x')`,
  [t.g, t.sede, s, dia, t.ctx.zona]);

// ── Acceso ───────────────────────────────────────────────────────────
test("A1 en tolerancia también rige la franja horaria", async () => {
  const { s } = await socioNuevo("Franja Tol", t.ctx.planes.manana, [[D(-32), D(-2)]]);
  const v = await acc(s);
  assert.equal(v.puede, false);
  assert.equal(v.motivo, "fuera_de_franja");
});

test("A2 en tolerancia también rige el tope semanal", async () => {
  const { s } = await socioNuevo("Tope Tol", t.ctx.planes.tres, [[D(-32), D(-2)]]);
  for (const d of [-5, -4, -3]) await ingreso(s, D(d));
  const v = await acc(s);
  assert.equal(v.motivo, "tope_semanal");
});

test("A3 el modo aviso no deja pasar a un suspendido", async () => {
  await sp("a3");
  await t.q(`update public.configuracion_gimnasio set avisar_sin_bloquear_hasta = $2 where gimnasio_id = $1`, [t.g, await t.en(D(7), "00:00:00")]);
  const v = await acc(t.ctx.socios.suspendido);
  const r = (await t.q(`select privado.registrar_ingreso($1,$2,'recepcion',null,null,null,$3) as r`, [t.ctx.socios.suspendido, t.sede, momento]))[0].r;
  const vf = await acc(t.ctx.socios.vencida);
  await rb("a3");
  assert.equal(v.puede, false);
  assert.equal(r.resultado, "rechazado");
  assert.equal(vf.puede, true, "un dato mal importado (vencida) sí pasa en modo aviso");
});

test("A4 un socio dado de baja no entra por una membresía que quedó abierta", async () => {
  await sp("a4");
  await t.q(`update public.socios set dado_de_baja_en = $2, motivo_baja = 'mudanza' where id = $1`, [t.ctx.socios.al_dia, await t.en(D(-5), "00:00:00")]);
  const v = await acc(t.ctx.socios.al_dia);
  await rb("a4");
  assert.equal(v.puede, false);
  assert.equal(v.motivo, "se_fue");
});

test("C1 el pack respeta las sedes de su plan", async () => {
  const [{ id: sedeB }] = await t.q(`insert into public.sedes (gimnasio_id, nombre) values ($1,'Sede B') returning id`, [t.g]);
  await sp("c1");
  await t.q(`update public.planes set todas_las_sedes = false where id = any($1)`, [[t.ctx.planes.pack10]]);
  await t.q(`insert into public.plan_sedes (gimnasio_id, plan_id, sede_id) values ($1,$2,$3)`, [t.g, t.ctx.planes.pack10, t.sede]);
  const enB = await acc(t.ctx.socios.pack_con_clases, momento, sedeB);
  const enA = await acc(t.ctx.socios.pack_con_clases, momento, t.sede);
  await rb("c1");
  assert.equal(enB.puede, false);
  assert.equal(enB.motivo, "fuera_de_sede");
  assert.equal(enA.puede, true);
});

test("B5 quien pagó un período que todavía no empezó no figura como deudor", async () => {
  const { s } = await socioNuevo("Pagó Adelantado", t.ctx.planes.full, [[D(2), D(32)]]);
  const v = await acc(s);
  assert.equal(v.motivo, "todavia_no_arranca");
  assert.equal(v.para_regularizar, null);
  assert.match(v.texto, /arranca el 16\/11/);
});

// ── Congelamientos y cierres ─────────────────────────────────────────
test("A5 la recepción no congela hacia atrás; el dueño sí, sin devolver días en que entró", async () => {
  const { s, su } = await socioNuevo("Retro", t.ctx.planes.full, [[D(-20), D(11)]]); // vence 24/11
  for (let d = -19; d <= -1; d += 2) await ingreso(s, D(d));                        // 10 días con ingreso
  const u = await usuario("recepcion");
  await sp("a5");
  await como(u);
  await t.falla(() => t.q(`select public.congelar($1, $2::date, $3::date, 'viaje')`, [su, D(-20), D(0)]), /Pedir pausa/);
  await t.db.query("reset role");
  await rb("a5");
  await congelar(su, D(-20), D(0));                                                 // el dueño: 20 días, 10 usados
  const v = await acc(s);
  assert.match(v.texto, /vence el 04\/12$/);                                       // 24/11 + 10
});

test("A6 congelamiento y cierre en las mismas fechas devuelven esos días una sola vez", async () => {
  const { s, su } = await socioNuevo("Doble", t.ctx.planes.full, [[D(-20), D(11)]]);
  await congelar(su, D(1), D(4));
  await sp("a6");
  await t.q(`insert into public.cierres (gimnasio_id, desde, hasta, motivo) values ($1,$2,$3,'Feriado')`,
    [t.g, await t.en(D(1), "00:00:00"), await t.en(D(4), "00:00:00")]);
  const v = await acc(s);
  await rb("a6");
  assert.match(v.texto, /vence el 27\/11$/);
});

test("A7 un cierre no se puede reaplicar ni editar a mano", async () => {
  const u = await usuario("encargado");
  await sp("a7");
  await como(u);
  const [{ c }] = await t.q(`select public.crear_cierre($1, $2::date, $3::date, 'Vacaciones') as c`, [t.g, D(1), D(4)]);
  const upd = await t.db.query(`update public.cierres set compensa = false where id = $1`, [c]);
  await t.db.query("reset role");
  const v = await acc(t.ctx.socios.al_dia);
  await rb("a7");
  assert.equal(upd.rowCount, 0, "sin política de escritura: el UPDATE directo no toca nada");
  assert.match(v.texto, /vence el 27\/11$/);
});

test("A8 pagar durante un congelamiento no pierde el mes pagado", async () => {
  const { s, su } = await socioNuevo("Paga Congelado", t.ctx.planes.full, [[D(-20), D(11)]]); // vence 24/11
  await congelar(su, D(5), D(40));                                                            // 19/11 → 24/12
  await cobrar(s, 1, await t.en(D(6), "10:00:00"));                                          // paga el 20/11
  const v = await acc(s, await t.en(D(42), "10:00:00"));                                     // 26/12
  assert.equal(v.color, "verde", (await coberturas(s)).join(" "));
  assert.match(v.texto, /vence el 29\/01$/);
});

test("A9 congelar antes de pagar el mes congelado igual devuelve los días", async () => {
  const { s, su } = await socioNuevo("Congela Futuro", t.ctx.planes.full, [[D(-20), D(11)]]); // vence 24/11
  await congelar(su, D(11), D(30));                                                           // 25/11 → 14/12
  await cobrar(s, 1, await t.en(D(2), "10:00:00"));                                          // [25/11, 25/12)
  const v = await acc(s, await t.en(D(31), "10:00:00"));                                     // 15/12
  assert.match(v.texto, /vence el 12\/01$/, (await coberturas(s)).join(" "));
});

test("A10 un cierre cargado antes compensa también a quien paga después", async () => {
  const { s } = await socioNuevo("Cierre Futuro", t.ctx.planes.full, [[D(-20), D(11)]]);
  await sp("a10");
  await t.q(`insert into public.cierres (gimnasio_id, desde, hasta, motivo) values ($1,$2,$3,'Obra')`,
    [t.g, await t.en(D(20), "00:00:00"), await t.en(D(25), "00:00:00")]);              // 4/12 → 9/12
  await cobrar(s, 1, await t.en(D(5), "10:00:00"));                                    // [25/11, 25/12)
  const v = await acc(s, await t.en(D(30), "10:00:00"));
  await rb("a10");
  assert.match(v.texto, /vence el 29\/12$/);
});

test("A11 anular la venta se lleva los días devueltos", async () => {
  const { s, su } = await socioNuevo("Anula Comp", t.ctx.planes.full, []);
  const r = await cobrar(s);                                                            // [14/11, 14/12)
  await congelar(su, D(1), D(11));
  const [{ id: eq }] = await t.q(`insert into public.equipo (gimnasio_id, nombre, rol) values ($1,'Dueño','dueno') returning id`, [t.g]);
  await t.q(`select privado.anular_venta($1, 'Cobro por error', $2, null)`, [r.venta_id, eq]);
  const v = await acc(s, await t.en(D(31), "10:00:00"));
  assert.equal(v.puede, false, (await coberturas(s)).join(" "));
  assert.deepEqual(await coberturas(s), []);
});

test("descongelar: volvió antes, entra hoy y recupera solo los días congelados", async () => {
  const { s, su } = await socioNuevo("Vuelve Antes", t.ctx.planes.full, [[D(-20), D(11)]]);
  const [{ c }] = await t.q(`select privado.congelar($1, $2::date, $3::date, 'viaje', null, null, true) as c`, [su, D(-4), D(6)]);
  assert.equal((await acc(s)).motivo, "congelada");
  await t.q(`select privado.descongelar($1, $2)`, [c, momento]);
  const v = await acc(s);
  assert.equal(v.puede, true);
  assert.match(v.texto, /vence el 28\/11$/);                                            // 4 días congelados devueltos
});

// ── Cobro y períodos ─────────────────────────────────────────────────
test("B1 día fijo: la deuda que muestra la recepción es lo que se cobra", async () => {
  const [{ id: p }] = await t.q(`insert into public.planes (gimnasio_id, tipo, nombre, duracion_meses, renovacion, dia_fijo)
      values ($1,'membresia','Rev día 10',1,'dia_fijo',10) returning id`, [t.g]);
  await t.q(`insert into public.precios_plan (gimnasio_id, plan_id, monto, vigente_desde) values ($1,$2,20000,'2020-01-01')`, [t.g, p]);
  const { s } = await socioNuevo("DiaFijo Deuda", p, [[D(-65), D(-35)]]);
  const v = await acc(s);
  const r = await cobrar(s, 1);
  assert.equal(Number(v.para_regularizar), 20000);
  assert.equal(r.veredicto.color, "verde");
});

test("B2 día fijo: la primera cuota se alinea al día fijo", async () => {
  const [{ id: p }] = await t.q(`insert into public.planes (gimnasio_id, tipo, nombre, duracion_meses, renovacion, dia_fijo)
      values ($1,'membresia','Rev día 1',1,'dia_fijo',1) returning id`, [t.g]);
  await t.q(`insert into public.precios_plan (gimnasio_id, plan_id, monto, vigente_desde) values ($1,$2,20000,'2020-01-01')`, [t.g, p]);
  const { s } = await socioNuevo("DiaFijo Alta", p, []);
  await cobrar(s, 2);
  assert.deepEqual(await coberturas(s), ["pago[01/11/2026→01/12/2026)", "pago[01/12/2026→01/01/2027)"]);
});

test("B3 continua: el ancla del 31 se mantiene (31/01 → 28/02 → 31/03 → 30/04)", async () => {
  const { s } = await socioNuevo("Fin de mes", t.ctx.planes.full, [["2026-12-31", "2027-01-31"]]);
  await cobrar(s, 3, await t.en("2027-01-20", "10:00:00"));
  const c = await coberturas(s);
  assert.deepEqual(c.slice(1), ["pago[31/01/2027→28/02/2027)", "pago[28/02/2027→31/03/2027)", "pago[31/03/2027→30/04/2027)"]);
});

test("B4 precio: el socio paga el menor de los precios que le aplican", async () => {
  const [{ id: p }] = await t.q(`insert into public.planes (gimnasio_id, tipo, nombre, duracion_meses, renovacion)
      values ($1,'membresia','Rev precios',1,'continua') returning id`, [t.g]);
  for (const [monto, medio, dia] of [[25000, null, null], [22000, "efectivo", null], [18000, null, 10]])
    await t.q(`insert into public.precios_plan (gimnasio_id, plan_id, monto, vigente_desde, medio_pago, pago_hasta_dia)
               values ($1,$2,$3,'2026-01-01T03:00:00Z',$4,$5)`, [t.g, p, monto, medio, dia]);
  const pr = async (medio, dia) => Number((await t.q(`select privado.precio_para($1,$2,$3,null,true) as v`, [p, await t.en(dia, "12:00:00"), medio]))[0].v);
  assert.equal(await pr("efectivo", "2026-11-05"), 18000);
  assert.equal(await pr("credito", "2026-11-05"), 18000);
  assert.equal(await pr("efectivo", "2026-11-14"), 22000);
  assert.equal(await pr("credito", "2026-11-14"), 25000);
});

// ── Membresía y permisos ─────────────────────────────────────────────
test("D1 la recepción no puede cambiar el plan con un UPDATE directo", async () => {
  const u = await usuario("recepcion");
  const s = t.ctx.socios.fuera_de_franja;
  await sp("d1");
  await como(u);
  const r = await t.db.query(`update public.suscripciones set plan_id = $2 where socio_id = $1 and baja_en is null`, [s, t.ctx.planes.full]);
  await t.db.query("reset role");
  const despues = await acc(s);
  await rb("d1");
  assert.equal(r.rowCount, 0);
  assert.equal(despues.motivo, "fuera_de_franja");
});

test("D2 cambiar de plan conserva lo pagado", async () => {
  const s = t.ctx.socios.al_dia;
  await sp("d2");
  await t.q(`select privado.cambiar_plan($1, $2, $3, null)`, [s, t.ctx.planes.tres, momento]);
  const v = await acc(s);
  await rb("d2");
  assert.equal(v.color, "verde");
  assert.match(v.texto, /Plan 3 veces · vence el 24\/11$/);
});

test("dar de baja cierra la membresía", async () => {
  await sp("baja");
  await t.q(`select privado.dar_de_baja($1, 'precio', $2)`, [t.ctx.socios.por_vencer, momento]);
  const [{ n }] = await t.q(`select count(*)::int n from public.suscripciones where socio_id = $1 and baja_en is null`, [t.ctx.socios.por_vencer]);
  await rb("baja");
  assert.equal(n, 0);
});

test("D3 ni anon ni authenticated tienen TRUNCATE", async () => {
  const [{ a, b }] = await t.q(`select has_table_privilege('anon','public.coberturas','TRUNCATE') a,
                                       has_table_privilege('authenticated','public.ingresos','TRUNCATE') b`);
  assert.equal(a, false);
  assert.equal(b, false);
});

test("el hash del PIN no lo lee nadie del equipo", async () => {
  const [{ id: eq }] = await t.q(`insert into public.equipo (gimnasio_id, nombre, rol) values ($1,'Dueño PIN','dueno') returning id`, [t.g]);
  await t.q(`insert into public.equipo_pines (gimnasio_id, equipo_id, pin_hash) values ($1,$2,'hash-de-prueba')`, [t.g, eq]);
  const u = await usuario("recepcion");
  await sp("pin");
  await como(u);
  const filas = await t.q(`select pin_hash from public.equipo_pines`);
  await rb("pin");
  assert.equal(filas.length, 0);
});

test("la recepción no vincula un login a un socio; el dueño sí", async () => {
  const [{ id: login }] = await t.q(`insert into auth.users (phone) values ('+5490000555555') returning id`);
  const rec = await usuario("recepcion");
  const due = await usuario("dueno");
  await sp("vin");
  await como(rec);
  await t.falla(() => t.q(`update public.socios set usuario_id = $2 where id = $1`, [t.ctx.socios.sin_plan, login]), /Solo el dueño/);
  await t.db.query("reset role");
  await como(due);
  const r = await t.db.query(`update public.socios set usuario_id = $2 where id = $1`, [t.ctx.socios.sin_plan, login]);
  await t.db.query("reset role");
  await rb("vin");
  assert.equal(r.rowCount, 1);
});

test("la recepción asignada a una sede no opera en otra", async () => {
  const [{ id: sedeC }] = await t.q(`insert into public.sedes (gimnasio_id, nombre) values ($1,'Sede C') returning id`, [t.g]);
  const u = await usuario("recepcion", t.sede);
  await sp("sede");
  await como(u);
  await t.falla(() => t.q(`select public.registrar_ingreso($1, $2)`, [t.ctx.socios.al_dia, sedeC]), /Sin permiso/);
  const [{ r }] = await t.q(`select public.registrar_ingreso($1, $2) as r`, [t.ctx.socios.al_dia, t.sede]);
  await t.db.query("reset role");
  await rb("sede");
  assert.ok(r.ingreso_id);
});

test("un dispositivo revocado no registra ingresos", async () => {
  const [{ id: disp }] = await t.q(`insert into public.dispositivos (gimnasio_id, sede_id, nombre, tipo, revocado_en)
                                    values ($1,$2,'Tablet','kiosco', now()) returning id`, [t.g, t.sede]);
  await sp("disp");
  await t.db.query(`set local role service_role`);
  await t.q(`select set_config('request.jwt.claims', '{"role":"service_role"}', true)`);
  await t.falla(() => t.q(`select public.registrar_ingreso($1, $2, 'kiosco', null, $3)`, [t.ctx.socios.al_dia, t.sede, disp]), /revocado/);
  await t.db.query("reset role");
  await rb("disp");
});

test("confirmar una cuota de la membresía de otro socio falla", async () => {
  const [{ id: su }] = await t.q(`select id from public.suscripciones where socio_id = $1`, [t.ctx.socios.al_dia]);
  const [{ id: v }] = await t.q(`insert into public.ventas (gimnasio_id, sede_id, socio_id, origen) values ($1,$2,$3,'recepcion') returning id`,
    [t.g, t.sede, t.ctx.socios.sin_plan]);
  await t.q(`insert into public.venta_items (gimnasio_id, venta_id, tipo, plan_id, suscripcion_id, descripcion, precio_unitario)
             values ($1,$2,'cuota',$3,$4,'Cuota',25000)`, [t.g, v, t.ctx.planes.full, su]);
  await t.q(`insert into public.pagos (gimnasio_id, venta_id, medio, monto, estado, aprobado_en) values ($1,$2,'transferencia',25000,'aprobado',now())`, [t.g, v]);
  await t.falla(() => t.q(`select privado.confirmar_venta($1, $2)`, [v, momento]), /otro socio/);
});
