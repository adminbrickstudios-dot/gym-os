// BASE-5 · socios.cubierto_hasta (D36): lo guardado es lo que dan los hechos, siempre, y ningún veredicto cambia.
//   DB_PRUEBAS_URL=postgres://... node --test supabase/pruebas/cubierto-hasta.test.mjs
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import pg from "pg";
import { CASOS_TESTIGO, HORA_TESTIGO, sembrarCasos, sumarDias } from "../../scripts/datos/casos-testigo.mjs";

const URL = process.env.DB_PRUEBAS_URL;
const HOY = "2026-11-14";
let db, g, sede, ctx;
const q = async (sql, params) => (await db.query(sql, params)).rows;
const en = async (dia, hora = `${HORA_TESTIGO}:00`) => (await q(`select privado.medianoche($1::date, $2) + $3::interval as t`, [dia, ctx.zona, hora]))[0].t;
const acceso = async (socio, m) => (await q(`select (privado.calcular_acceso($1, $2, $3)).*`, [socio, m, sede]))[0];

before(async () => {
  if (!URL) throw new Error("Falta DB_PRUEBAS_URL");
  db = new pg.Client({ connectionString: URL }); await db.connect(); await db.query("begin");
  [{ id: g }] = await q(`insert into public.gimnasios (slug, nombre) values ('prueba-cubierto', 'Prueba cubierto') returning id`);
  [{ id: sede }] = await q(`select id from public.sedes where gimnasio_id = $1`, [g]);
  ctx = await sembrarCasos(db, { gimnasioId: g, sedeId: sede, hoy: HOY });
});
after(async () => { if (db) { await db.query("rollback"); await db.end(); } });

test("lo guardado es lo recalculado para todos los socios del escenario", async () => {
  const malos = await q(`select s.id from public.socios s where s.gimnasio_id = $1 and s.cubierto_hasta is distinct from privado.calcular_cubierto_hasta(s.id)`, [g]);
  assert.equal(malos.length, 0);
  const [{ n }] = await q(`select count(*)::int as n from public.socios where gimnasio_id = $1 and cubierto_hasta is not null`, [g]);
  assert.ok(n > 5, "hay socios con cobertura guardada");
});

test("los veredictos de cada caso testigo en 6 momentos fijos son los de siempre (la vigencia guardada no toca la puerta)", async () => {
  const momentos = [];
  for (const d of [-40, -10, -1, 0, 3, 40]) momentos.push(await en(sumarDias(HOY, d)));
  for (const m of momentos) {
    for (const caso of CASOS_TESTIGO) {
      const antes = await acceso(ctx.socios[caso.clave], m);
      await q(`update public.socios set cubierto_hasta = null where id = $1`, [ctx.socios[caso.clave]]);   // sin la columna…
      const sin = await acceso(ctx.socios[caso.clave], m);
      await q(`select privado.recalcular_cubierto_hasta($1)`, [ctx.socios[caso.clave]]);                    // …y con ella de nuevo
      const con = await acceso(ctx.socios[caso.clave], m);
      assert.deepEqual([sin.color, sin.motivo, sin.puede, sin.texto], [antes.color, antes.motivo, antes.puede, antes.texto]);
      assert.deepEqual([con.color, con.motivo, con.puede, con.texto], [antes.color, antes.motivo, antes.puede, antes.texto]);
    }
  }
});

test("anular una cobertura la baja y volver a cubrir la sube, en la misma transacción", async () => {
  const s = ctx.socios.al_dia;
  const [{ antes }] = await q(`select cubierto_hasta as antes from public.socios where id = $1`, [s]);
  const [ultima] = await q(`select id from public.coberturas where socio_id = $1 and anulada_en is null order by hasta desc limit 1`, [s]);
  await q(`update public.coberturas set anulada_en = now(), anulada_motivo = 'prueba' where id = $1`, [ultima.id]);
  const [{ despues }] = await q(`select cubierto_hasta as despues from public.socios where id = $1`, [s]);
  assert.ok(!despues || new Date(despues) < new Date(antes), "baja al anular");
  await q(`update public.coberturas set anulada_en = null, anulada_motivo = null where id = $1`, [ultima.id]);
  const [{ vuelve }] = await q(`select cubierto_hasta as vuelve from public.socios where id = $1`, [s]);
  assert.equal(new Date(vuelve).getTime(), new Date(antes).getTime());
});

test("un socio sin cobertura queda sin fecha; con índice por gimnasio", async () => {
  const [{ n }] = await q(`select count(*)::int as n from pg_indexes where indexname = 'socios_cubierto_hasta_idx'`);
  assert.equal(n, 1);
  const [{ k }] = await q(`select count(*)::int as k from public.socios s where s.gimnasio_id = $1 and not exists (select 1 from public.coberturas c where c.socio_id = s.id and c.anulada_en is null) and s.cubierto_hasta is not null`, [g]);
  assert.equal(k, 0);
});
