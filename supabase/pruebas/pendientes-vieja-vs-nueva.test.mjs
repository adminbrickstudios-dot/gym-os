// F0.3 · REGLA DURA: bajar el tiempo de pendientes_panel (dueño) no cambia ningún resultado.
// Se arma en la transacción de la prueba una COPIA de las funciones de antes (leídas de las migraciones que las definieron) y se las compara con
// las vigentes, con momentos FIJOS (nunca now()):
//   · privado.retencion_pendientes (20261111130100) contra la nueva de 20261112031732: mismas filas, mismas columnas, mismo orden;
//   · privado.avisos_moderacion_base (20261106007203) contra la nueva: mismos avisos (incluye cortesías repetidas con quienes las dieron).
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { abrir, HOY } from "./_comun.mjs";
import { sumarDias } from "../../scripts/datos/casos-testigo.mjs";

const cuerpo = (archivo, firma, nuevoNombre) => {
  const src = readFileSync(new URL(`../migrations/${archivo}`, import.meta.url), "utf8");
  const ini = src.indexOf(`create or replace function ${firma}(`);
  assert.ok(ini >= 0, `no está ${firma} en ${archivo}`);
  const fin = src.indexOf("$$;", ini) + 3;
  return src.slice(ini, fin).replace(`${firma}(`, `${nuevoNombre}(`);
};
const MOMENTOS = [-45, -20, -10, -3, 0, 1, 5, 20, 45];   // días respecto de HOY, a las 19:00 y a las 00:00

let t, plan, sede, dueno;
before(async () => {
  t = await abrir("prueba-pendientes-vieja-nueva");
  await t.q(cuerpo("20261111130100_pendientes_prefiltro.sql", "privado.retencion_pendientes", "privado.retencion_pendientes_vieja"));
  await t.q(cuerpo("20261106007203_devolucion_baja.sql", "privado.avisos_moderacion", "privado.avisos_moderacion_base_vieja"));
  [{ id: plan }] = await t.q(`select id from public.planes where gimnasio_id = $1 and tipo = 'membresia' order by creado_en limit 1`, [t.g]);
  sede = t.sede;
  const dia = async (n, hora = "00:00:00") => (await t.q(`select privado.medianoche($1::date, $2) + $3::interval as m`, [sumarDias(HOY, n), t.ctx.zona, hora]))[0].m;
  const usuario = async (nombre) => {
    const [{ id }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`${nombre.toLowerCase()}.${Math.random()}@ejemplo.invalid`]);
    await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,$3,'recepcion')`, [t.g, id, nombre]);
    return id;
  };
  dueno = await usuario("Dueno");
  const [ana, beto] = [await usuario("Ana"), await usuario("Beto")];

  let k = 0;
  const socio = async (nombre, { inicio = -100, cob = [], anuladas = [], baja = null, ingresos = [], bajaSocio = null, creadoPor = null, origen = "cortesia", creadoEn = null } = {}) => {
    k++;
    const [{ id }] = await t.q(`insert into public.socios (gimnasio_id, nombre, apellido, telefono, email) values ($1,$2,'Variante',$3,$4) returning id`,
      [t.g, nombre, `+5490000900${String(k).padStart(3, "0")}`, `variante.${k}@ejemplo.invalid`]);
    const [{ id: su }] = await t.q(`insert into public.suscripciones (gimnasio_id, socio_id, plan_id, inicio) values ($1,$2,$3,$4) returning id`, [t.g, id, plan, await dia(inicio)]);
    for (const [d, h, quien] of cob) await t.q(`insert into public.coberturas (gimnasio_id, suscripcion_id, socio_id, desde, hasta, origen, motivo, creado_por, creado_en) values ($1,$2,$3,$4,$5,$6,'prueba',$7, coalesce($8::timestamptz, now()))`, [t.g, su, id, await dia(d), await dia(h), origen, quien ?? creadoPor, creadoEn]);
    for (const [d, h] of anuladas) await t.q(`insert into public.coberturas (gimnasio_id, suscripcion_id, socio_id, desde, hasta, origen, motivo, anulada_en, anulada_motivo) values ($1,$2,$3,$4,$5,'cortesia','prueba', now(), 'prueba')`, [t.g, su, id, await dia(d), await dia(h)]);
    for (const d of ingresos) await t.q(`insert into public.ingresos (gimnasio_id, sede_id, socio_id, momento, via_acceso, resultado, color, motivo, texto) values ($1,$2,$3,$4,'recepcion','entro','verde','al_dia','ok')`, [t.g, sede, id, await dia(d, "19:00:00")]);
    if (baja !== null) await t.q(`update public.suscripciones set baja_en = $2, motivo_baja = 'otro' where id = $1`, [su, await dia(baja)]);
    if (bajaSocio !== null) await t.q(`update public.socios set dado_de_baja_en = now() - $2::interval, motivo_baja = 'otro' where id = $1`, [id, `${bajaSocio} days`]);
    return id;
  };
  await socio("Hueco", { cob: [[-60, -30], [10, 40]] });
  await socio("Cadena", { cob: [[-30, 0], [0, 3]] });
  await socio("Vence hoy", { cob: [[-29, 1]], ingresos: [-1] });
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
  await socio("Vence en 6 y viene", { cob: [[-24, 6]], ingresos: [-1, -3] });
  await socio("Vence en 6 y no viene", { cob: [[-24, 6]], ingresos: [-20] });
  await socio("Vence lejos y viene", { cob: [[-10, 50]], ingresos: [-1] });
  await socio("Dos suscripciones", { inicio: -300, cob: [[-30, 3]], ingresos: [-2], baja: -200 });
  // Cortesías repetidas (más que el umbral), dadas por dos personas distintas, y otro socio con menos que el umbral.
  const [{ alerta }] = await t.q(`select cortesia_alerta_repetidas as alerta from public.configuracion_gimnasio where gimnasio_id = $1`, [t.g]);
  const muchas = Array.from({ length: alerta + 1 }, (_, i) => [-20 + i, -10 + i]);
  await socio("Cortesias muchas", { cob: muchas.map((c, i) => (i === 0 ? [...c, beto] : c)), creadoPor: ana });
  await socio("Cortesias pocas", { cob: [[-5, 5]], creadoPor: ana });
  await socio("Cortesias sin dador", { cob: muchas.map((c) => c) });
});
after(async () => t && t.cerrar());

const momento = async (d, hora) => (await t.q(`select privado.medianoche($1::date, $2) + $3::interval as m`, [sumarDias(HOY, d), t.ctx.zona, hora]))[0].m.toISOString();
const DIF = (a, b) => `select count(*)::int n from (select * from ${a} except all select * from ${b}) x`;

test("retencion_pendientes nueva devuelve las mismas filas, días y orden que la de antes, en 18 momentos fijos", async () => {
  let filas = 0;
  for (const d of MOMENTOS) for (const hora of ["00:00:00", "19:00:00"]) {
    const m = await momento(d, hora);
    const vie = `privado.retencion_pendientes_vieja('${t.g}', '${m}')`, nue = `privado.retencion_pendientes('${t.g}', '${m}')`;
    const [{ n: sobra }] = await t.q(DIF(vie, nue));
    const [{ n: falta }] = await t.q(DIF(nue, vie));
    const orden = async (f) => (await t.q(`select coalesce(string_agg(lista || '|' || coalesce(dias::text, '') || '|' || nombre, ';'), '') s from ${f} x`))[0].s;
    assert.deepEqual([sobra, falta, (await orden(vie)) === (await orden(nue))], [0, 0, true], `día ${d} ${hora}: la lista nueva difiere de la de antes`);
    filas += (await t.q(`select count(*)::int n from ${nue}`))[0].n;
  }
  assert.ok(filas > 100, `tiene que mirar filas de verdad (miró ${filas})`);
});

test("las tres listas aparecen en lo que se compara (por_vencer, nuevo y no_viene)", async () => {
  const por = (await t.q(`select distinct lista from privado.retencion_pendientes($1, $2)`, [t.g, await momento(0, "19:00:00")])).map((r) => r.lista);
  for (const l of ["por_vencer", "nuevo", "no_viene"]) assert.ok(por.includes(l), `ningún socio cae en ${l}: la prueba no la estaría mirando`);
});

test("avisos_moderacion_base nueva da los mismos avisos que la de antes (cortesías repetidas; el resto del cuerpo no cambió)", async () => {
  const [{ ok }] = await t.q(`select count(*)::int ok from jsonb_array_elements(privado.avisos_moderacion_base($1, $2)) x where x ->> 'clave' like 'cortesias_repetidas:%'`, [t.g, t.ctx.zona]);
  assert.ok(ok >= 1, "la prueba tiene que tener al menos un aviso de cortesías repetidas");
  const lista = (f) => `select x from jsonb_array_elements(${f}('${t.g}', '${t.ctx.zona}')) x`;
  const [{ a }] = await t.q(`select count(*)::int a from (${lista("privado.avisos_moderacion_base_vieja")} except all ${lista("privado.avisos_moderacion_base")}) z`);
  const [{ b }] = await t.q(`select count(*)::int b from (${lista("privado.avisos_moderacion_base")} except all ${lista("privado.avisos_moderacion_base_vieja")}) z`);
  assert.deepEqual([a, b], [0, 0]);
  const quienes = (await t.q(`select x ->> 'detalle' d from jsonb_array_elements(privado.avisos_moderacion_base($1, $2)) x where x ->> 'clave' like 'cortesias_repetidas:%' order by 1`, [t.g, t.ctx.zona])).map((r) => r.d);
  assert.ok(quienes.some((d) => /Ana, Beto/.test(d)), `el aviso tiene que decir quiénes dieron las cortesías (Ana, Beto): ${quienes.join(" | ")}`);
  assert.ok(quienes.some((d) => /alguien/.test(d)), "una cortesía sin dador figura como 'alguien'");
});

test("pendientes_panel del dueño sigue contando lo mismo que la cuenta de antes (vencen hoy)", async () => {
  await t.db.query("set role authenticated");
  await t.q(`select set_config('request.jwt.claims', $1, false)`, [JSON.stringify({ sub: dueno, role: "authenticated" })]);
  let p;
  try { p = (await t.q(`select public.pendientes_panel($1) r`, [t.g]))[0].r; } finally { await t.db.query("reset role"); await t.q(`select set_config('request.jwt.claims', '', false)`); }
  const [{ n }] = await t.q(`select count(*)::int n from privado.retencion_pendientes_vieja($1, now()) r where r.lista = 'por_vencer' and r.dias = 0`, [t.g]);
  assert.equal(p.vencen_hoy ?? 0, n);
});
