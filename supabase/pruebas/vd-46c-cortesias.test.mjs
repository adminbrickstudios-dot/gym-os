// VD-46C (20261106007201): cortesías con motivo de una lista y tope bajo por rol y por mes.
// La recepción da 1 día por cortesía y 5 por mes (por defecto), el encargado 7 y 30, el dueño hasta 31; sin motivo de la lista no hay cortesía;
// a un suspendido no se le da; anular es del dueño o el encargado; Control suma descuentos y cortesías del mes; la campana avisa las repetidas.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir } from "./_comun.mjs";

let t, u = {}, eq = {}, motivos, hoy, desde, otroGim;
async function como(usuario, fn) {
  await t.db.query("set role authenticated");
  await t.q(`select set_config('request.jwt.claims', $1, false)`, [JSON.stringify({ sub: usuario, role: "authenticated" })]);
  try { return await fn(); } finally { await t.db.query("reset role"); await t.q(`select set_config('request.jwt.claims', '', false)`); }
}
const cortesia = (usuario, socio, dias, motivo, nota = null) =>
  como(usuario, async () => (await t.q(`select public.dar_cortesia($1, $2, $3, $4) as r`, [socio, dias, motivo ?? motivos[0].id, nota]))[0].r);
const intento = (usuario, socio, dias, motivo, patron) =>
  como(usuario, () => t.falla(() => t.q(`select public.dar_cortesia($1, $2, $3, null)`, [socio, dias, motivo ?? motivos[0].id]), patron));

before(async () => {
  t = await abrir("prueba-vd46c");
  for (const [rol, nombre] of [["dueno", "Sofía"], ["encargado", "Martín"], ["recepcion", "Ana"]]) {
    const [{ id }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`${rol}${Math.random()}@ejemplo.invalid`]);
    const [{ id: e }] = await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,$3,$4) returning id`, [t.g, id, nombre, rol]);
    u[rol] = id; eq[rol] = e;
  }
  motivos = await como(u.recepcion, async () => (await t.q(`select public.motivos_beneficio_gimnasio($1) as r`, [t.g]))[0].r);
  [{ hoy, desde }] = await t.q(`select (now() at time zone zona_horaria)::date::text as hoy, ((now() at time zone zona_horaria)::date - 3)::text as desde from public.gimnasios where id = $1`, [t.g]);
  const [{ id: gx }] = await t.q(`insert into public.gimnasios (slug, nombre) values ('prueba-vd46c-otro', 'Otro Gimnasio') returning id`);
  const [{ id: mx }] = await t.q(`select id from public.motivos_beneficio where gimnasio_id = $1 limit 1`, [gx]);
  otroGim = { id: gx, motivo: mx };
});
after(async () => t && t.cerrar());

test("cada gimnasio nace con su lista de motivos y con topes bajos", async () => {
  assert.equal(motivos.length, 6);
  assert.ok(motivos.every((m) => m.activo));
  const [c] = await t.q(`select cortesia_max_dias_recepcion a, cortesia_max_dias_encargado b, cortesia_dias_mes_recepcion c, cortesia_dias_mes_encargado d, cortesia_alerta_repetidas e
                           from public.configuracion_gimnasio where gimnasio_id = $1`, [t.g]);
  assert.deepEqual([c.a, c.b, c.c, c.d, c.e], [1, 7, 5, 30, 2]);
});

test("la recepción da un día con motivo; queda quién, cuándo y por qué, y el socio entra", async () => {
  const socio = t.ctx.socios.vencida;
  const r = await cortesia(u.recepcion, socio, 1, motivos[0].id, "Se le cayó la tarjeta");
  assert.equal(r.dias, 1);
  assert.equal(r.veredicto.puede, true, `veredicto ${r.veredicto.motivo}`);
  const [c] = await t.q(`select origen, motivo, creado_por, anulada_en, (hasta - desde) as dur from public.coberturas where id = $1`, [r.cobertura_id]);
  assert.equal(c.origen, "cortesia"); assert.equal(c.creado_por, u.recepcion); assert.equal(c.anulada_en, null);
  assert.equal(c.motivo, `${motivos[0].nombre}: Se le cayó la tarjeta`);
});

test("topes por rol: la recepción no pasa de 1 día, el encargado de 7, el dueño de 31", async () => {
  const socio = t.ctx.socios.vencida_tres_meses;
  await intento(u.recepcion, socio, 2, null, /hasta 1 día por cortesía/);
  await intento(u.encargado, socio, 8, null, /hasta 7 días por cortesía/);
  await intento(u.dueno, socio, 32, null, /1 a 31 días/);
  await intento(u.dueno, socio, 0, null, /1 a 31 días/);
  const r = await cortesia(u.encargado, socio, 7);
  assert.equal(r.dias, 7);
  await cortesia(u.dueno, t.ctx.socios.en_tolerancia, 31);
});

test("motivo: de la lista y de este gimnasio; sin motivo, con motivo apagado o de otro gimnasio, no hay cortesía", async () => {
  const socio = t.ctx.socios.sin_pago;
  await como(u.recepcion, () => t.falla(() => t.q(`select public.dar_cortesia($1, 1, null, 'a')`, [socio]), /motivo de la lista/));
  await intento(u.recepcion, socio, 1, otroGim.motivo, /motivo de la lista/);
  await intento(u.recepcion, socio, 1, "00000000-0000-0000-0000-000000000000", /motivo de la lista/);
  // El dueño apaga uno: ya no se puede elegir; la recepción tampoco lo ve.
  const apagado = motivos[5];
  await como(u.recepcion, () => t.falla(() => t.q(`select public.guardar_motivo_beneficio($1, $2, 'X motivo', false)`, [t.g, apagado.id]), /Sin permiso/));
  await como(u.dueno, () => t.q(`select public.guardar_motivo_beneficio($1, $2, $3, false)`, [t.g, apagado.id, apagado.nombre]));
  await intento(u.recepcion, socio, 1, apagado.id, /motivo de la lista/);
  const visibles = await como(u.recepcion, async () => (await t.q(`select public.motivos_beneficio_gimnasio($1) as r`, [t.g]))[0].r);
  assert.equal(visibles.length, 5);
  // Agregar uno nuevo y repetido.
  await como(u.dueno, async () => {
    const nuevo = (await t.q(`select public.guardar_motivo_beneficio($1, null, 'Pasó un amigo del barrio', true) as id`, [t.g]))[0].id;
    assert.ok(nuevo);
    await t.falla(() => t.q(`select public.guardar_motivo_beneficio($1, null, ' pasó un AMIGO del barrio ', true)`, [t.g]), /Ya hay un motivo/);
    await t.falla(() => t.q(`select public.guardar_motivo_beneficio($1, null, 'ab', true)`, [t.g]), /3 a 60/);
  });
});

test("tope por mes: la recepción llega a 5 días y la sexta cortesía se rechaza con el número", async () => {
  // Ana ya dio 1 día; suma 4 más a socios distintos.
  const otros = ["vence_hoy", "por_vencer", "al_dia", "fuera_de_franja"].map((k) => t.ctx.socios[k]);
  for (const s of otros) await cortesia(u.recepcion, s, 1);
  await intento(u.recepcion, t.ctx.socios.tope_semanal, 1, null, /Este mes ya diste 5 días de cortesía y tu tope es 5/);
  const ficha = await como(u.recepcion, async () => (await t.q(`select public.cortesias_socio($1) as r`, [t.ctx.socios.tope_semanal]))[0].r);
  assert.equal(ficha.usados_mes, 5); assert.equal(ficha.tope_mes, 5); assert.equal(ficha.puede_dar, false);
  // El encargado no se lleva la cuenta de Ana.
  const fichaEnc = await como(u.encargado, async () => (await t.q(`select public.cortesias_socio($1) as r`, [t.ctx.socios.tope_semanal]))[0].r);
  assert.equal(fichaEnc.puede_dar, true); assert.equal(fichaEnc.tope_dias, 7);
  // El dueño sube el tope y entonces sí.
  await como(u.recepcion, () => t.falla(() => t.q(`select public.guardar_topes_beneficios($1, 2, 7, 10, 30, 2)`, [t.g]), /Sin permiso/));
  await como(u.dueno, async () => {
    await t.falla(() => t.q(`select public.guardar_topes_beneficios($1, 40, 7, 10, 30, 2)`, [t.g]), /0 a 31/);
    await t.falla(() => t.q(`select public.guardar_topes_beneficios($1, 2, 7, 10, 30, 1)`, [t.g]), /2 a 10/);
    await t.q(`select public.guardar_topes_beneficios($1, 2, 7, 10, 30, 2)`, [t.g]);
  });
  const r = await cortesia(u.recepcion, t.ctx.socios.tope_semanal, 2);
  assert.equal(r.dias, 2);
});

test("a un suspendido, a un dado de baja o sin membresía no se le da; sin plan, tampoco", async () => {
  // El testigo "suspendido" arranca ayer según HOY (fijo); acá se suspende a uno ahora, con la función nueva.
  await como(u.dueno, () => t.q(`select public.suspender_socio($1, 'Pelea en el vestuario')`, [t.ctx.socios.pack_con_clases]));
  await intento(u.dueno, t.ctx.socios.pack_con_clases, 1, null, /suspendido/);
  await intento(u.dueno, t.ctx.socios.se_fue, 1, null, /dado de baja/);
  await intento(u.dueno, t.ctx.socios.sin_plan, 1, null, /asignale un plan/);
  await como(ajenoUsuario(), () => t.falla(() => t.q(`select public.dar_cortesia($1, 1, $2, null)`, [t.ctx.socios.al_dia, motivos[0].id]), /Sin permiso/));
});
function ajenoUsuario() { return "00000000-0000-0000-0000-0000000000aa"; }

test("anular una cortesía es del dueño o el encargado, con motivo, y deja de contar", async () => {
  const socio = t.ctx.socios.vencida;
  const [{ id }] = await t.q(`select id from public.coberturas where socio_id = $1 and origen = 'cortesia' and anulada_en is null`, [socio]);
  await como(u.recepcion, () => t.falla(() => t.q(`select public.anular_cortesia($1, 'Me equivoqué')`, [id]), /Sin permiso/));
  await como(u.encargado, async () => {
    await t.falla(() => t.q(`select public.anular_cortesia($1, ' ')`, [id]), /por qué se anula/);
    await t.q(`select public.anular_cortesia($1, 'Era otro socio')`, [id]);
    await t.falla(() => t.q(`select public.anular_cortesia($1, 'otra vez')`, [id]), /ya estaba anulada/);
  });
  const [c] = await t.q(`select anulada_por, anulada_motivo from public.coberturas where id = $1`, [id]);
  assert.equal(c.anulada_por, u.encargado); assert.equal(c.anulada_motivo, "Era otro socio");
  // Una cobertura de pago no se anula por acá.
  const [{ id: pago }] = await t.q(`select id from public.coberturas where origen = 'pago' and gimnasio_id = $1 limit 1`, [t.g]);
  await como(u.dueno, () => t.falla(() => t.q(`select public.anular_cortesia($1, 'Intento')`, [pago]), /Sin permiso o cortesía inexistente/));
});

test("Control: cortesías en la lista, total del mes por persona, y la campana avisa las repetidas una vez por cantidad", async () => {
  // Dos cortesías al mismo socio en poco tiempo.
  await t.q(`update public.configuracion_gimnasio set cortesia_alerta_repetidas = 2 where gimnasio_id = $1`, [t.g]);
  const alertas = async () => (await como(u.dueno, async () => (await t.q(`select public.campana_control($1) as r`, [t.g]))[0].r)).items.filter((i) => /^cortesias_repetidas:/.test(i.clave));
  const antes = (await alertas()).length;
  await cortesia(u.dueno, t.ctx.socios.congelada, 1);
  assert.equal((await alertas()).length, antes, "una sola cortesía no alerta");
  await cortesia(u.dueno, t.ctx.socios.congelada, 1);
  const a = (await alertas()).filter((i) => /Testigo Congelada/.test(i.titulo));
  assert.equal(a.length, 1); assert.match(a[0].titulo, /recibió 2 cortesías en 60 días/);

  const c = await como(u.dueno, async () => (await t.q(`select public.moderacion_control($1, $2::date, $3::date) as r`, [t.g, desde, hoy]))[0].r);
  const cort = c.items.filter((i) => i.tipo === "cortesia");
  assert.ok(cort.length >= 8, `hay ${cort.length} cortesías`);
  assert.ok(cort.some((i) => i.quien === "Ana" && /1 día/.test(i.detalle)));
  assert.ok(cort.some((i) => /ANULADA: Era otro socio/.test(i.detalle)), "la anulada sigue estando");

  // Un descuento del mes y el resumen por persona.
  const [{ id: v }] = await t.q(`insert into public.ventas (gimnasio_id, sede_id, socio_id, estado, origen, confirmada_en, creado_por)
    values ($1,$2,$3,'confirmada','recepcion', now(), $4) returning id`, [t.g, t.sede, t.ctx.socios.al_dia, eq.encargado]);
  await t.q(`insert into public.venta_items (gimnasio_id, venta_id, tipo, descripcion, precio_unitario, descuento, descuento_motivo) values ($1,$2,'otro','Cuota',25000,5000,'Convenio o canje')`, [t.g, v]);
  const b = await como(u.dueno, async () => (await t.q(`select public.beneficios_mes($1) as r`, [t.g]))[0].r);
  assert.ok(Number(b.descuentos_total) >= 5000 && b.descuentos_cantidad >= 1);
  assert.ok(b.cortesias_dias >= 40, `cortesías ${b.cortesias_dias} días`);
  const ana = b.por_persona.find((p) => p.nombre === "Ana"), mar = b.por_persona.find((p) => p.nombre === "Martín");
  assert.equal(ana.cortesias_dias, 6); assert.equal(Number(mar.descuentos), 5000); assert.equal(mar.cortesias_dias, 7);
  assert.equal(b.puede_editar, true); assert.equal(b.topes.max_dias_recepcion, 2);
  await como(u.recepcion, () => t.falla(() => t.q(`select public.beneficios_mes($1)`, [t.g]), /Sin permiso/));
  await como(u.recepcion, () => t.falla(() => t.q(`select public.moderacion_control($1, $2::date, $3::date)`, [t.g, desde, hoy]), /Sin permiso/));
});
