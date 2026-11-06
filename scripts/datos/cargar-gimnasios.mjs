#!/usr/bin/env node
// VD-30 · Carga de escala: siembra N gimnasios chicos con datos fijos (los mismos siempre), para ver cómo
// responden las funciones cuando la base tiene cientos de gimnasios y no solo el demo.
//
//   node scripts/datos/cargar-gimnasios.mjs --url postgres://... [--gimnasios 200] [--socios 15]
//
// Cada gimnasio "carga-0001" … tiene un plan, N socios (cobertura de cortesía vencida, por vencer o al día)
// y ingresos de los últimos 30 días. Teléfonos +549000…, mails @ejemplo.invalid. Idempotente: salta los
// gimnasios que ya existen. Todo por SQL de a un gimnasio, así que tarda segundos, no minutos.
// Solo para bases locales / de prueba (se niega contra Supabase).
import pg from "pg";

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] : d; };
const url = arg("url", process.env.DB_PRUEBAS_URL || process.env.SUPABASE_DB_URL);
const cuantos = Number(arg("gimnasios", "200"));
const porGimnasio = Number(arg("socios", "15"));
if (!url) { console.error("Falta --url o DB_PRUEBAS_URL"); process.exit(1); }
if (/supabase\.(co|com)/.test(url)) { console.error("cargar-gimnasios.mjs no corre contra Supabase real"); process.exit(1); }
if (!(cuantos > 0 && porGimnasio > 0)) { console.error("--gimnasios y --socios deben ser números positivos"); process.exit(1); }

const ZONA = "America/Argentina/Buenos_Aires";
const db = new pg.Client({ connectionString: url });
await db.connect();
const t0 = Date.now();
let nuevos = 0;
try {
  for (let i = 1; i <= cuantos; i++) {
    const slug = `carga-${String(i).padStart(4, "0")}`;
    if ((await db.query("select 1 from public.gimnasios where slug = $1", [slug])).rowCount) continue;
    await db.query("begin");
    try {
      const { rows: [{ id: g }] } = await db.query(
        "insert into public.gimnasios (slug, nombre, es_demo) values ($1, $2, true) returning id", [slug, `Gimnasio de carga ${i}`]);
      const { rows: [{ id: sede }] } = await db.query("select id from public.sedes where gimnasio_id = $1", [g]);
      const { rows: [{ id: plan }] } = await db.query(
        `insert into public.planes (gimnasio_id, tipo, nombre, duracion_meses, renovacion) values ($1, 'membresia', 'Plan Mensual', 1, 'continua') returning id`, [g]);
      await db.query(`insert into public.precios_plan (gimnasio_id, plan_id, monto, vigente_desde) values ($1, $2, 20000, '2020-01-01')`, [g, plan]);
      // Socios: teléfonos +549000 y número de gimnasio+socio, siempre los mismos.
      await db.query(
        `insert into public.socios (gimnasio_id, nombre, apellido, telefono, email, creado_en)
         select $1, 'Carga', 'Socio ' || n, '+549000' || lpad(($2::int * 1000 + n)::text, 7, '0'), 'carga' || $2 || '-' || n || '@ejemplo.invalid',
                now() - make_interval(days => 60 + n)
           from generate_series(1, $3::int) n`, [g, i, porGimnasio]);
      // Suscripción y cobertura de cortesía: cada socio termina entre hace 40 y dentro de 29 días.
      await db.query(
        `insert into public.suscripciones (gimnasio_id, socio_id, plan_id, inicio)
         select $1, s.id, $2, now() - interval '100 days' from public.socios s where s.gimnasio_id = $1`, [g, plan]);
      await db.query(
        `insert into public.coberturas (gimnasio_id, suscripcion_id, socio_id, desde, hasta, origen, motivo)
         select $1, su.id, su.socio_id, now() - interval '100 days',
                privado.medianoche((current_date + (((s.numero * 7) % 70) - 40))::date, $2), 'cortesia', 'Carga de escala'
           from public.suscripciones su join public.socios s on s.id = su.socio_id where su.gimnasio_id = $1`, [g, ZONA]);
      // Ingresos: 20 por socio en los últimos 30 días, en horas del día variadas.
      await db.query(
        `insert into public.ingresos (gimnasio_id, sede_id, socio_id, momento, via_acceso, resultado, via_habilitante, color, motivo, texto)
         select $1, $2, s.id, now() - make_interval(days => d, hours => (s.numero + d) % 12), 'recepcion', 'entro', 'membresia', 'verde', 'al_dia', 'Al día'
           from public.socios s cross join generate_series(1, 20) d where s.gimnasio_id = $1`, [g, sede]);
      await db.query("commit");
      nuevos++;
    } catch (e) {
      await db.query("rollback");
      throw new Error(`${slug}: ${e.message}`);
    }
  }
  const { rows: [t] } = await db.query("select count(*)::int g, (select count(*)::int from public.socios) s, (select count(*)::int from public.ingresos) i from public.gimnasios");
  console.log(`Carga de escala en ${((Date.now() - t0) / 1000).toFixed(1)} s: ${nuevos} gimnasios nuevos. La base tiene ${t.g} gimnasios, ${t.s} socios, ${t.i} ingresos.`);
} catch (e) {
  console.error("Falló la carga:", e.message);
  process.exitCode = 1;
}
await db.end();
