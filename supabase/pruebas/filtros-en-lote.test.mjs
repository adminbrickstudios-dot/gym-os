// F0.3 / F1.6 · REGLA DURA: filtros_socios en lote no cambia ningún veredicto.
// Compara, con momentos FIJOS (nunca now()), (1) el grupo de CADA socio (privado.filtros_socios_grupos) contra
// privado.grupo_estado(calcular_acceso(...)), y (2) el JSON completo de privado.filtros_socios_calc contra una COPIA de la
// función de antes (la de 20261104004500 con el momento como parámetro, creada acá en pg_temp). Los socios son los casos testigo más
// un conjunto grande y variado armado a propósito: al día, por vencer, vencidos, en tolerancia, sin pago, nuevos, congelados,
// suspendidos, con pack, con pase diario, con prueba gratis, con deuda a cuenta, con cobertura adelantada, con plan de franja/sede/tope,
// de baja y de plan familiar. Con y sin sede, con y sin modo aviso, con y sin plan familiar. UNA diferencia = prueba roja.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir, HOY } from "./_comun.mjs";
import { sumarDias, sembrarFamilia } from "../../scripts/datos/casos-testigo.mjs";

let t, planFull, planSedes, planTol;
const VIEJA = `
create function pg_temp.filtros_viejo(p_gimnasio_id uuid, p_momento timestamptz, p_sede_id uuid) returns jsonb
language plpgsql stable set search_path = '' as $f$
declare r jsonb;
begin
  with activos as (
    select s.id, s.creado_en, privado.grupo_estado(v.color, v.motivo) as grupo
      from public.socios s cross join lateral privado.calcular_acceso(s.id, p_momento, p_sede_id) v
     where s.gimnasio_id = p_gimnasio_id and s.dado_de_baja_en is null
  )
  select jsonb_build_object(
    'todos', (select count(*) from activos),
    'al_dia', count(*) filter (where grupo = 'al_dia'), 'por_vencer', count(*) filter (where grupo = 'por_vencer'),
    'vencidos', count(*) filter (where grupo = 'vencidos'), 'en_pausa', count(*) filter (where grupo = 'en_pausa'),
    'sin_plan', count(*) filter (where grupo = 'sin_plan'), 'nuevos', count(*) filter (where creado_en > p_momento - interval '30 days'),
    'bajas', (select count(*) from public.socios s where s.gimnasio_id = p_gimnasio_id and s.dado_de_baja_en is not null),
    'planes', coalesce((select jsonb_agg(jsonb_build_object('plan_id', pl.id, 'nombre', pl.nombre, 'socios', x.n) order by x.n desc, pl.nombre)
                         from (select su.plan_id, count(distinct su.socio_id) n from public.suscripciones su
                                join public.socios s on s.id = su.socio_id and s.dado_de_baja_en is null
                               where su.gimnasio_id = p_gimnasio_id and su.baja_en is null group by su.plan_id) x
                         join public.planes pl on pl.id = x.plan_id), '[]'))
    into r from activos;
  return r;
end $f$`;

const MOMENTOS = [-70, -45, -20, -10, -3, 0, 1, 5, 20, 45];   // días respecto de HOY, a las 19:00 y a las 00:00

before(async () => {
  t = await abrir("prueba-filtros-lote");
  await t.q(VIEJA);
  [{ id: planFull }] = await t.q(`select id from public.planes where gimnasio_id = $1 and tipo = 'membresia' and nombre = 'Plan Full'`, [t.g]);
  const dia = async (n, hora = "00:00:00") => (await t.q(`select privado.medianoche($1::date, $2) + $3::interval as m`, [sumarDias(HOY, n), t.ctx.zona, hora]))[0].m;
  const [{ id: sede2 }] = await t.q(`insert into public.sedes (gimnasio_id, nombre) values ($1, 'Otra sede') returning id`, [t.g]);
  // Un plan solo de otra sede y un plan con tolerancia propia.
  [{ id: planSedes }] = await t.q(`insert into public.planes (gimnasio_id, tipo, nombre, duracion_meses, renovacion, todas_las_sedes)
    values ($1,'membresia','Solo otra sede',1,'continua',false) returning id`, [t.g]);
  await t.q(`insert into public.plan_sedes (gimnasio_id, plan_id, sede_id) values ($1,$2,$3)`, [t.g, planSedes, sede2]);
  [{ id: planTol }] = await t.q(`insert into public.planes (gimnasio_id, tipo, nombre, duracion_meses, renovacion, tolerancia_dias)
    values ($1,'membresia','Tolerancia 12',1,'continua',12) returning id`, [t.g]);
  await t.q(`insert into public.precios_plan (gimnasio_id, plan_id, monto, vigente_desde) values ($1,$2,9000,'2020-01-01'), ($1,$3,9000,'2020-01-01')`, [t.g, planSedes, planTol]);
  const [{ id: pPack }] = await t.q(`select id from public.planes where gimnasio_id = $1 and tipo = 'pack' order by creado_en limit 1`, [t.g]);

  let k = 0;
  const socio = async (nombre, { plan = planFull, inicio = -100, cob = [], baja = null, creado = null, sinSusc = false } = {}) => {
    k++;
    const [{ id }] = await t.q(`insert into public.socios (gimnasio_id, nombre, apellido, telefono, email, creado_en) values ($1,$2,'Lote',$3,$4, coalesce($5::timestamptz, now())) returning id`,
      [t.g, nombre, `+5490000600${String(k).padStart(3, "0")}`, `lote.${k}@ejemplo.invalid`, creado === null ? null : await dia(creado)]);
    if (sinSusc) return { id, su: null };
    const [{ id: su }] = await t.q(`insert into public.suscripciones (gimnasio_id, socio_id, plan_id, inicio) values ($1,$2,$3,$4) returning id`, [t.g, id, plan, await dia(inicio)]);
    for (const [d, h, anulada] of cob) await t.q(`insert into public.coberturas (gimnasio_id, suscripcion_id, socio_id, desde, hasta, origen, motivo, anulada_en, anulada_motivo)
      values ($1,$2,$3,$4,$5,'cortesia','prueba',$6,$7)`, [t.g, su, id, await dia(d), await dia(h), anulada ? new Date() : null, anulada ? "prueba" : null]);
    if (baja !== null) await t.q(`update public.suscripciones set baja_en = $2, motivo_baja = 'otro' where id = $1`, [su, await dia(baja)]);
    return { id, su };
  };

  // Variedad generada: vencimientos a todo alrededor de dias_aviso, tolerancia y vencidos, con y sin hueco.
  for (let h = -50; h <= 45; h += 1) await socio(`Vence ${h}`, { cob: [[Math.min(-40, h - 10), h]], creado: h % 3 === 0 ? -5 : -90 });
  for (let h = -50; h <= 45; h += 7) await socio(`Tol propia ${h}`, { plan: planTol, cob: [[Math.min(-40, h - 10), h]] });
  await socio("Hueco", { cob: [[-60, -30], [-5, 20]] });
  await socio("Cadena", { cob: [[-30, 0], [0, 3]] });
  await socio("Encimadas", { cob: [[-20, 5], [-10, 30]] });
  await socio("Solo anulada", { cob: [[-30, 30, true]] });
  await socio("Anulada y vigente", { cob: [[-30, 3], [-30, 60, true]] });
  await socio("Futura pura", { cob: [[7, 37]] });
  await socio("Vencida y futura", { cob: [[-60, -20], [10, 40]] });
  await socio("Sin pagos", {});
  await socio("Sin pagos reciente", { inicio: -3, creado: -3 });
  await socio("Suscripcion futura", { inicio: 10, cob: [[10, 40]] });
  await socio("Sin suscripcion", { sinSusc: true });
  await socio("Con baja", { cob: [[-30, 30]], baja: -2 });
  await socio("Baja futura", { cob: [[-30, 30]], baja: 8 });
  await socio("Otra sede", { plan: planSedes, cob: [[-30, 20]] });
  await socio("Otra sede vencida", { plan: planSedes, cob: [[-60, -20]] });
  // Congelados (la cobertura sigue vigente) y suspendidos.
  const c1 = await socio("Congelado", { cob: [[-30, 30]] });
  await t.q(`select privado.congelar($1, $2::date, $3::date, 'viaje', null, null, true)`, [c1.su, sumarDias(HOY, -3), sumarDias(HOY, 12)]);
  const c2 = await socio("Congelado futuro", { cob: [[-30, 30]] });
  await t.q(`select privado.congelar($1, $2::date, $3::date, 'viaje', null, null, true)`, [c2.su, sumarDias(HOY, 6), sumarDias(HOY, 20)]);
  const s1 = await socio("Suspendido", { cob: [[-30, 30]] });
  await t.q(`insert into public.suspensiones (gimnasio_id, socio_id, desde, motivo) values ($1,$2,$3,'Conducta')`, [t.g, s1.id, await dia(-4)]);
  const s2 = await socio("Suspension vencida", { cob: [[-30, 30]] });
  await t.q(`insert into public.suspensiones (gimnasio_id, socio_id, desde, hasta, motivo) values ($1,$2,$3,$4,'Conducta')`, [t.g, s2.id, await dia(-12), await dia(-6)]);
  const s3 = await socio("Suspension vencida sin pago", {});
  await t.q(`insert into public.suspensiones (gimnasio_id, socio_id, desde, motivo) values ($1,$2,$3,'Deuda')`, [t.g, s3.id, await dia(-2)]);
  // Pase diario, packs, prueba gratis, deuda a cuenta.
  const p1 = await socio("Pase vigente", { cob: [[-60, -20]] });
  await t.q(`insert into public.pases_diarios (gimnasio_id, socio_id, plan_id, desde, hasta) values ($1,$2,$3,$4,$5)`, [t.g, p1.id, t.ctx.planes.pase, await dia(0), await dia(1)]);
  const p2 = await socio("Pase de ayer", { cob: [[-60, -20]] });
  await t.q(`insert into public.pases_diarios (gimnasio_id, socio_id, plan_id, desde, hasta) values ($1,$2,$3,$4,$5)`, [t.g, p2.id, t.ctx.planes.pase, await dia(-1), await dia(0)]);
  const k1 = await socio("Con pack", { cob: [[-60, -20]] });
  await t.q(`insert into public.packs (gimnasio_id, socio_id, plan_id, cantidad, desde, vence_en) values ($1,$2,$3,4,$4,$5)`, [t.g, k1.id, pPack, await dia(-10), await dia(30)]);
  const k2 = await socio("Pack futuro", { cob: [[-30, 30]] });
  await t.q(`insert into public.packs (gimnasio_id, socio_id, plan_id, cantidad, desde, vence_en) values ($1,$2,$3,4,$4,$5)`, [t.g, k2.id, pPack, await dia(5), await dia(40)]);
  const g1 = await socio("Prueba gratis", { sinSusc: true });
  await t.q(`insert into public.pruebas_gratis (gimnasio_id, dni, nombre, modo, sede_id, desde, hasta, origen, socio_id) values ($1,'30111222','Prueba','dia',$2,$3,$4,'pagina',$5)`,
    [t.g, t.sede, await dia(0), await dia(1), g1.id]);
  const g2 = await socio("Prueba pasada con plan vencido", { cob: [[-50, -20]] });
  await t.q(`insert into public.pruebas_gratis (gimnasio_id, dni, nombre, modo, sede_id, desde, hasta, origen, socio_id) values ($1,'30111223','Prueba','dia',$2,$3,$4,'pagina',$5)`,
    [t.g, t.sede, await dia(-30), await dia(-29), g2.id]);
  for (const [nombre, cob] of [["Debe al dia", [[-20, 11]]], ["Debe vencido", [[-50, -20]]], ["Debe sin plan", null]]) {
    const d = await socio(nombre, cob ? { cob } : { sinSusc: true });
    const [{ id: v }] = await t.q(`insert into public.ventas (gimnasio_id, sede_id, socio_id, estado, origen, confirmada_en, creado_en) values ($1,$2,$3,'confirmada','recepcion',now(),now()) returning id`, [t.g, t.sede, d.id]);
    await t.q(`insert into public.venta_items (gimnasio_id, venta_id, tipo, plan_id, descripcion, precio_unitario) values ($1,$2,'pase',$3,'Pase fiado',12000)`, [t.g, v, t.ctx.planes.pase]);
    await t.q(`insert into public.pagos (gimnasio_id, venta_id, medio, monto, estado, aprobado_en) values ($1,$2,'cuenta_corriente',12000,'aprobado',now())`, [t.g, v]);
  }
  // Deuda cargada como ítem (sin pago a cuenta): también va por la puerta.
  const sd = await socio("Deuda por item", { cob: [[-20, 11]] });
  const [{ id: va }] = await t.q(`insert into public.ventas (gimnasio_id, sede_id, socio_id, estado, origen, confirmada_en, creado_en) values ($1,$2,$3,'confirmada','recepcion',now(),now()) returning id`, [t.g, t.sede, sd.id]);
  await t.q(`insert into public.venta_items (gimnasio_id, venta_id, tipo, descripcion, precio_unitario) values ($1,$2,'deuda','Deuda vieja',5000)`, [t.g, va]);
  await t.q(`analyze public.socios`);
  await t.q(`analyze public.coberturas`);
});
after(async () => t && t.cerrar());

async function momento(n, hora) {
  return (await t.q(`select privado.medianoche($1::date, $2) + $3::interval as m`, [sumarDias(HOY, n), t.ctx.zona, hora]))[0].m;
}

async function comparar(rotulo, sedes) {
  let porSocio = 0, rapidos = 0, lentos = 0;
  for (const n of MOMENTOS) for (const hora of ["00:00:00", "19:00:00"]) {
    const m = await momento(n, hora);
    for (const sede of sedes) {
      const { rows } = await t.db.query(`
        select a.socio_id, a.grupo, a.por_puerta, privado.grupo_estado(v.color, v.motivo) as esperado, s.nombre
          from privado.filtros_socios_grupos($1, $2, $3) a
          join public.socios s on s.id = a.socio_id
          cross join lateral privado.calcular_acceso(a.socio_id, $2, $3) v`, [t.g, m, sede]);
      for (const r of rows) {
        porSocio++; if (r.por_puerta) lentos++; else rapidos++;
        assert.equal(r.grupo, r.esperado, `${rotulo} · ${r.nombre} · día ${n} ${hora}: grupo ${r.grupo} != ${r.esperado}`);
      }
      const [{ nuevo, viejo }] = await t.q(`select privado.filtros_socios_calc($1,$2,$3) as nuevo, pg_temp.filtros_viejo($1,$2,$3) as viejo`, [t.g, m, sede]);
      assert.deepEqual(nuevo, viejo, `${rotulo} · día ${n} ${hora}: el JSON de filtros_socios cambió`);
    }
  }
  return { porSocio, rapidos, lentos };
}

test("filtros_socios en lote == la de antes, socio por socio y en el JSON completo (20 momentos fijos, con y sin sede)", async () => {
  const r = await comparar("base", [null, t.sede]);
  assert.ok(r.porSocio > 3000, `se compararon ${r.porSocio} veredictos`);
  assert.ok(r.rapidos > r.lentos, "la mayoría tiene que ir por el camino rápido (si no, la prueba no prueba nada)");
  assert.ok(r.lentos > 200, "y tiene que haber casos especiales por el camino de la puerta");
  console.log(`  filtros_socios: ${r.porSocio} veredictos comparados (${r.rapidos} por el camino rápido, ${r.lentos} por la puerta), todos iguales`);
});

test("con el plan familiar prendido y miembros vinculados, sigue igual", async () => {
  await sembrarFamilia(t.db, { gimnasioId: t.g, socios: t.ctx.socios });
  const r = await comparar("familiar", [null]);
  assert.ok(r.porSocio > 1500);
});

test("con el modo aviso vigente, sigue igual (nadie va por el camino rápido)", async () => {
  await t.q(`update public.configuracion_gimnasio set avisar_sin_bloquear_hasta = $2 where gimnasio_id = $1`, [t.g, await momento(8, "00:00:00")]);
  const r = await comparar("modo aviso", [null]);
  assert.ok(r.porSocio > 1500);
  assert.equal(r.rapidos > 0, true, "pasado el modo aviso, el camino rápido vuelve (los momentos de después del día 8)");
});

test("con otra tolerancia y otros días de aviso en la configuración, sigue igual", async () => {
  await t.q(`update public.configuracion_gimnasio set avisar_sin_bloquear_hasta = null, tolerancia_dias = 2, dias_aviso = 9 where gimnasio_id = $1`, [t.g]);
  const r = await comparar("config", [null, t.sede]);
  assert.ok(r.porSocio > 3000);
});

test("la función pública da lo mismo para el dueño que la copia de antes con now()", async () => {
  const [{ id: u }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`dueno${Math.random()}@ejemplo.invalid`]);
  await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,'dueno','dueno')`, [t.g, u]);
  const r = await t.comoUsuario(u, async () => (await t.q(`select public.filtros_socios($1) as r`, [t.g]))[0].r);
  assert.equal(typeof r.todos, "number");
  const viejo = (await t.q(`select pg_temp.filtros_viejo($1, now(), null) as r`, [t.g]))[0].r;
  assert.deepEqual(r, viejo);
});
