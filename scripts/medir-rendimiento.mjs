// SEG-4: mide cada función de pantalla como la dueña del demo. Para 3.000 socios:
//   createdb + simular + aplicar, después node scripts/datos/sembrar-demo.mjs --url URL --socios 3000
//   node scripts/medir-rendimiento.mjs URL
// Agrega a la base una dueña de medición (medir@ejemplo.invalid) si el demo no tiene.
import pg from "pg";
const db = new pg.Client({ connectionString: process.argv[2] }); await db.connect();
const q = async (s, p) => (await db.query(s, p)).rows;
const [{ g, sede, zona }] = await q(`select g.id g, (select id from public.sedes where gimnasio_id = g.id and es_principal) sede, g.zona_horaria zona from public.gimnasios g where slug = 'demo'`);
// La dueña de medición: si el demo no tiene una con usuario, se crea.
let [{ u } = {}] = await q(`select usuario_id u from public.equipo where gimnasio_id = $1 and rol = 'dueno' and activo and usuario_id is not null limit 1`, [g]);
if (!u) {
  [{ id: u }] = await q(`insert into auth.users (email) values ('medir@ejemplo.invalid') on conflict do nothing returning id`)
    .then((r) => (r.length ? r : q(`select id from auth.users where lower(email) = 'medir@ejemplo.invalid'`)));
  await q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1, $2, 'Medición', 'dueno')`, [g, u]);
}
const [{ socio }] = await q(`select id socio from public.socios where gimnasio_id = $1 and nombre = 'Testigo' limit 1`, [g]);
const [{ hoy }] = await q(`select privado.dia_local(now(), $1)::text hoy`, [zona]);
const F = [
  ["panel_gimnasio", `select public.panel_gimnasio($1)`, [g]],
  ["panel_inicio", `select public.panel_inicio($1)`, [g]],
  ["buscar_socios (vacío)", `select * from public.buscar_socios($1, '', 60)`, [g]],
  ["buscar_socios (texto)", `select * from public.buscar_socios($1, 'mar', 60)`, [g]],
  ["buscar_socios (al_dia)", `select * from public.buscar_socios($1, '', 60, null, 'al_dia')`, [g]],
  ["ficha_socio", `select public.ficha_socio($1)`, [socio]],
  ["vencen_hoy", `select public.vencen_hoy($1)`, [g]],
  ["retencion", `select public.retencion($1)`, [g]],
  ["retencion_resumen", `select public.retencion_resumen($1)`, [g]],
  ["tablero_retencion", `select public.tablero_retencion($1)`, [g]],
  ["bandeja_avisos", `select public.bandeja_avisos($1)`, [g]],
  ["campana", `select public.campana($1)`, [g]],
  ["resultado_mes", `select public.resultado_mes($1)`, [g]],
  ["resumen_dueno", `select public.resumen_dueno($1)`, [g]],
  ["actividad_equipo", `select public.actividad_equipo($1)`, [g]],
  ["ingresos_del_dia", `select public.ingresos_del_dia($1, $2, $3::date)`, [g, sede, hoy]],
  ["clases_del_dia", `select * from public.clases_del_dia($1, $2::date)`, [sede, hoy]],
  ["precios_venta", `select public.precios_venta($1, $2)`, [sede, socio]],
  ["estado_acceso", `select public.estado_acceso($1)`, [socio]],
  ["pagos_por_aprobar", `select public.pagos_por_aprobar($1)`, [g]],
  ["prospectos_panel", `select public.prospectos_panel($1)`, [g]],
  ["planes_gimnasio", `select * from public.planes_gimnasio($1)`, [g]],
  ["ventas_socio", `select public.ventas_socio($1)`, [socio]],
  ["exportar_gimnasio(ingresos)", `select jsonb_array_length(public.exportar_gimnasio($1, 'ingresos'))`, [g]],
];
await q(`set role authenticated`); await q(`select set_config('request.jwt.claims', $1, false)`, [JSON.stringify({ sub: u, role: "authenticated" })]);
const out = [];
for (const [n, s, p] of F) {
  try {
    await q(s, p); // calienta
    const t0 = performance.now(); await q(s, p); const ms = Math.round(performance.now() - t0);
    out.push([n, ms]);
  } catch (e) { out.push([n, `ERROR ${e.message.slice(0, 80)}`]); }
}
for (const [n, ms] of out.sort((a, b) => (typeof b[1] === "number" ? b[1] : 1e9) - (typeof a[1] === "number" ? a[1] : 1e9))) console.log(String(ms).padStart(6), n);
await db.end();
