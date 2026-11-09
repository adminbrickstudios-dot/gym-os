// BASE-1 / F1.6 · REGLA DURA: Retención con socios.cubierto_hasta no cambia ningún veredicto.
// Compara, con momentos FIJOS (nunca now()), la función de antes (privado.retencion_referencia, copia de la vigente) contra la nueva
// (privado.retencion_con / retencion_listas) para los casos testigo y para socios armados a propósito (huecos, coberturas futuras,
// encimadas, anuladas, bajas, sin pagos, nuevos y que dejaron de venir). Falla si difiere UNA fila, una columna o el orden.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir, HOY } from "./_comun.mjs";
import { sumarDias } from "../../scripts/datos/casos-testigo.mjs";

let t, plan, sede;
const MOMENTOS = [-45, -20, -10, -3, 0, 1, 5, 20, 45];   // días respecto de HOY, a las 19:00 y a las 00:00

before(async () => {
  t = await abrir("prueba-retencion-cubierto");
  [{ id: plan }] = await t.q(`select id from public.planes where gimnasio_id = $1 and tipo = 'membresia' order by creado_en limit 1`, [t.g]);
  sede = t.sede;
  const dia = async (n, hora = "00:00:00") => (await t.q(`select privado.medianoche($1::date, $2) + $3::interval as m`, [sumarDias(HOY, n), t.ctx.zona, hora]))[0].m;

  let k = 0;
  const socio = async (nombre, { inicio = -100, cob = [], anuladas = [], baja = null, ingresos = [] } = {}) => {
    k++;
    const [{ id }] = await t.q(`insert into public.socios (gimnasio_id, nombre, apellido, telefono, email) values ($1,$2,'Variante',$3,$4) returning id`,
      [t.g, nombre, `+5490000900${String(k).padStart(3, "0")}`, `variante.${k}@ejemplo.invalid`]);
    const [{ id: su }] = await t.q(`insert into public.suscripciones (gimnasio_id, socio_id, plan_id, inicio) values ($1,$2,$3,$4) returning id`, [t.g, id, plan, await dia(inicio)]);
    for (const [d, h] of cob) await t.q(`insert into public.coberturas (gimnasio_id, suscripcion_id, socio_id, desde, hasta, origen, motivo) values ($1,$2,$3,$4,$5,'cortesia','prueba')`, [t.g, su, id, await dia(d), await dia(h)]);
    for (const [d, h] of anuladas) await t.q(`insert into public.coberturas (gimnasio_id, suscripcion_id, socio_id, desde, hasta, origen, motivo, anulada_en, anulada_motivo) values ($1,$2,$3,$4,$5,'cortesia','prueba', now(), 'prueba')`, [t.g, su, id, await dia(d), await dia(h)]);
    for (const d of ingresos) await t.q(`insert into public.ingresos (gimnasio_id, sede_id, socio_id, momento, via_acceso, resultado, color, motivo, texto) values ($1,$2,$3,$4,'recepcion','entro','verde','al_dia','ok')`, [t.g, sede, id, await dia(d, "19:00:00")]);
    if (baja !== null) await t.q(`update public.suscripciones set baja_en = $2, motivo_baja = 'otro' where id = $1`, [su, await dia(baja)]);
    return id;
  };
  await socio("Hueco", { cob: [[-60, -30], [10, 40]] });                       // pasado, hueco y una isla futura
  await socio("Cadena", { cob: [[-30, 0], [0, 3]] });                           // dos coberturas pegadas
  await socio("Vence hoy", { cob: [[-29, 1]], ingresos: [-1] });                // el último día cubierto es hoy
  await socio("Vence manana", { cob: [[-28, 2]], ingresos: [-2] });
  await socio("Encimadas", { cob: [[-20, 5], [-10, 30]], ingresos: [-1] });
  await socio("Sin pagos reciente", { inicio: -10 });
  await socio("Sin pagos viejo", { inicio: -100 });
  await socio("Muy viejo", { cob: [[-200, -170]] });
  await socio("Solo anulada", { anuladas: [[-30, 30]] });
  await socio("Anulada y vigente", { cob: [[-30, 3]], anuladas: [[-30, 60]], ingresos: [-1] });
  await socio("Con baja", { cob: [[-30, 30]], baja: -2 });
  await socio("Nuevo sin venir", { inicio: -12, cob: [[-12, 18]] });
  await socio("Nuevo que vino", { inicio: -12, cob: [[-12, 18]], ingresos: [-1] });
  await socio("No viene", { inicio: -90, cob: [[-30, 30]], ingresos: [-40] });
  await socio("No viene nunca", { inicio: -90, cob: [[-30, 30]] });
  await socio("Futuro puro", { cob: [[7, 37]] });
});
after(async () => t && t.cerrar());

const SQL_DIF = (a, b) => `select count(*)::int n from (select * from ${a} except all select * from ${b}) x`;

async function comparar(g, m, { liviano = false, listas = null } = {}) {
  const ref = `privado.retencion_referencia('${g}', '${m}', null, ${liviano})`;
  const refFiltrada = listas ? `(select * from ${ref} r where r.lista = any ('{${listas.join(",")}}'::text[]))` : ref;
  const nuevo = listas
    ? `privado.retencion_listas('${g}', '${m}', '{${listas.join(",")}}'::text[], ${liviano})`
    : `privado.retencion_con('${g}', '${m}', null, ${liviano})`;
  const [{ n: sobra }] = await t.q(SQL_DIF(refFiltrada, nuevo));
  const [{ n: falta }] = await t.q(SQL_DIF(nuevo, refFiltrada));
  const orden = async (f) => (await t.q(`select coalesce(string_agg(r.lista || '|' || coalesce(r.dias::text, '') || '|' || r.nombre, ';'), '') s from ${f} r`))[0].s;
  return { sobra, falta, mismoOrden: (await orden(refFiltrada)) === (await orden(nuevo)), filas: (await t.q(`select count(*)::int n from ${nuevo}`))[0].n };
}

test("retencion_con (completa) devuelve exactamente lo de antes, en 18 momentos fijos", async () => {
  let total = 0;
  for (const d of MOMENTOS) for (const hora of ["00:00:00", "19:00:00"]) {
    const m = (await t.q(`select privado.medianoche($1::date, $2) + $3::interval as m`, [sumarDias(HOY, d), t.ctx.zona, hora]))[0].m.toISOString();
    const r = await comparar(t.g, m);
    assert.deepEqual([r.sobra, r.falta, r.mismoOrden], [0, 0, true], `día ${d} ${hora}: la lista nueva difiere de la de antes`);
    total += r.filas;
  }
  assert.ok(total > 100, `la prueba tiene que mirar filas de verdad (miró ${total})`);
});

test("retencion_con liviana devuelve exactamente lo de antes", async () => {
  for (const d of MOMENTOS) {
    const m = (await t.q(`select privado.medianoche($1::date, $2) + interval '19 hours' as m`, [sumarDias(HOY, d), t.ctx.zona]))[0].m.toISOString();
    const r = await comparar(t.g, m, { liviano: true });
    assert.deepEqual([r.sobra, r.falta, r.mismoOrden], [0, 0, true], `día ${d}: la lista liviana difiere`);
  }
});

test("retencion_listas devuelve, para cada combinación de listas, exactamente las mismas filas que la de antes filtradas", async () => {
  const combos = [["por_vencer"], ["por_vencer", "no_viene", "nuevo"], ["vencido", "por_vencer"], ["vencido", "por_vencer", "nuevo", "no_viene"], ["se_fue"], ["vencido"], ["no_viene"], ["nuevo"]];
  for (const d of MOMENTOS) {
    const m = (await t.q(`select privado.medianoche($1::date, $2) + interval '19 hours' as m`, [sumarDias(HOY, d), t.ctx.zona]))[0].m.toISOString();
    for (const listas of combos) for (const liviano of [false, true]) {
      const r = await comparar(t.g, m, { liviano, listas });
      assert.deepEqual([r.sobra, r.falta, r.mismoOrden], [0, 0, true], `día ${d} listas ${listas} liviano ${liviano}: difiere`);
    }
  }
});

test("retencion_pendientes (lo de Pendientes y Para hacer hoy) devuelve las mismas filas, días y orden que la de antes para por_vencer, nuevo y no_viene", async () => {
  const cols = `socio_id, nombre, lista, dias`;
  let filas = 0;
  for (const d of MOMENTOS) for (const hora of ["00:00:00", "19:00:00"]) {
    const m = (await t.q(`select privado.medianoche($1::date, $2) + $3::interval as m`, [sumarDias(HOY, d), t.ctx.zona, hora]))[0].m.toISOString();
    const ref = `(select ${cols} from privado.retencion_referencia('${t.g}', '${m}', null, true) where lista in ('por_vencer', 'nuevo', 'no_viene'))`;
    const nue = `(select ${cols} from privado.retencion_pendientes('${t.g}', '${m}'))`;
    const [{ n: a }] = await t.q(SQL_DIF(ref, nue));
    const [{ n: b }] = await t.q(SQL_DIF(nue, ref));
    const orden = async (f) => (await t.q(`select coalesce(string_agg(lista || '|' || coalesce(dias::text, '') || '|' || nombre, ';'), '') s from ${f} x`))[0].s;
    assert.deepEqual([a, b, (await orden(ref)) === (await orden(nue))], [0, 0, true], `día ${d} ${hora}: Pendientes difiere de la cuenta de antes`);
    filas += (await t.q(`select count(*)::int n from ${nue}`))[0].n;
  }
  assert.ok(filas > 50, `tiene que mirar filas de verdad (miró ${filas})`);
});

test("pendientes_panel cuenta lo mismo que la cuenta de antes (vencen hoy)", async () => {
  const [{ id: u }] = await t.q(`insert into auth.users (email) values ('dueno-ret@ejemplo.invalid') returning id`);
  await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,'Dueno','dueno')`, [t.g, u]);
  await t.db.query("set role authenticated");
  await t.q(`select set_config('request.jwt.claims', $1, false)`, [JSON.stringify({ sub: u, role: "authenticated" })]);
  let p;
  try { p = (await t.q(`select public.pendientes_panel($1) r`, [t.g]))[0].r; } finally { await t.db.query("reset role"); await t.q(`select set_config('request.jwt.claims', '', false)`); }
  const [{ n }] = await t.q(`select count(*)::int n from privado.retencion_referencia($1, now(), null, true) r where r.lista = 'por_vencer' and r.dias = 0`, [t.g]);
  assert.equal(p.vencen_hoy ?? 0, n);
});

test("un socio cuyo cubierto_hasta quedó mal NO pasa desapercibido: el chequeo de cubierto_hasta y esta prueba comparten la misma verdad", async () => {
  const [{ n }] = await t.q(`select count(*)::int n from public.socios s where s.gimnasio_id = $1 and s.cubierto_hasta is distinct from privado.calcular_cubierto_hasta(s.id)`, [t.g]);
  assert.equal(n, 0, "cubierto_hasta guardado = recalculado");
});

test("los casos testigo están en las listas de siempre (la prueba no compara listas vacías)", async () => {
  const m = (await t.q(`select privado.medianoche($1::date, $2) + interval '19 hours' as m`, [HOY, t.ctx.zona]))[0].m.toISOString();
  const por = (await t.q(`select lista, count(*)::int n from privado.retencion_con($1, $2, null) group by 1 order by 1`, [t.g, m])).map((r) => r.lista);
  for (const l of ["vencido", "por_vencer", "nuevo", "no_viene", "se_fue"]) assert.ok(por.includes(l), `ningún socio cae en la lista ${l}: la prueba no la estaría mirando`);
});
