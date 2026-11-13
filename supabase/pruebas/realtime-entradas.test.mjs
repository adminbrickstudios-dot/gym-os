// E3 (20261112220000) · Realtime de la puerta: las tablas que escucha el panel están en la publicación (si el proyecto la tiene) y
// siguen con RLS, así que cada rol solo recibe lo de su gimnasio. Un socio ni el anónimo ven ingresos de otros.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir } from "./_comun.mjs";

let t;
before(async () => { t = await abrir("prueba-realtime-entradas"); });
after(async () => t && t.cerrar());

test("ingresos y alertas_prestamo tienen RLS y, si hay publicación de Realtime, están en ella", async () => {
  for (const tabla of ["ingresos", "alertas_prestamo"]) {
    const [{ rls }] = await t.q(`select relrowsecurity as rls from pg_class where oid = $1::regclass`, [`public.${tabla}`]);
    assert.equal(rls, true, `${tabla} con RLS`);
  }
  const [{ hay }] = await t.q(`select exists (select 1 from pg_publication where pubname = 'supabase_realtime') as hay`);
  if (!hay) return;   // base local de prueba: sin Realtime
  for (const tabla of ["ingresos", "alertas_prestamo"]) {
    const [{ esta }] = await t.q(`select exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = $1) as esta`, [tabla]);
    assert.equal(esta, true, `${tabla} en la publicación`);
  }
});

test("el anónimo no lee ingresos ni alertas (lo mismo que escucharía por Realtime)", async () => {
  await t.db.query("set role anon");
  try {
    for (const tabla of ["ingresos", "alertas_prestamo"]) {
      await t.db.query("savepoint s");
      let filas = null;
      try { filas = (await t.db.query(`select 1 from public.${tabla} limit 1`)).rowCount; } catch { await t.db.query("rollback to savepoint s"); filas = 0; }
      assert.equal(filas, 0, `anon sin ${tabla}`);
    }
  } finally { await t.db.query("reset role"); }
});
