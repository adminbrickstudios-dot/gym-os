#!/usr/bin/env node
// VD-47X / VD-30 · explain analyze de las funciones de las pantallas principales contra el demo.
//   node scripts/medir/explain.mjs --url postgres://... [--gimnasio demo] [--plan] [--md salida.md] [--json salida.json]
// Corre cada función como el rol que la usa (dueño del gimnasio, o recepción en lo de recepción), en rol
// authenticated con sus claims, dentro de una transacción que se revierte, y muestra el tiempo de ejecución
// (se descarta la primera vuelta, que calienta cachés: se anota la segunda).
// Presupuesto: función de pantalla < 300 ms; pendientes_panel (corre en cada pantalla) < 50 ms.
// No corta: marca las que pasan y sale con 0 (la tabla es lo que se compara antes / después).
import { writeFileSync } from "node:fs";
import pg from "pg";

const arg = (n) => { const i = process.argv.indexOf(`--${n}`); return i > -1 ? process.argv[i + 1] : undefined; };
const url = arg("url") ?? process.env.DB_PRUEBAS_URL ?? process.env.SUPABASE_DB_URL;
const slug = arg("gimnasio") ?? "demo";
const verPlan = process.argv.includes("--plan");
const anidado = process.argv.includes("--anidado");
const planes = process.argv.includes("--planes");
if (!url) { console.error("Falta --url o DB_PRUEBAS_URL"); process.exit(1); }
if (/supabase\.(co|com)/.test(url)) { console.error("explain.mjs no corre contra Supabase real"); process.exit(1); }

const PRESUPUESTO_PANTALLA = 300, PRESUPUESTO_PENDIENTES = 50;
const db = new pg.Client({ connectionString: url });
await db.connect();
const filas = [];
let cuantosSocios = 0, cuantosGimnasios = 0;
try {
  const { rows: [g] } = await db.query("select id from public.gimnasios where slug = $1", [slug]);
  if (!g) throw new Error(`No hay gimnasio "${slug}" (sembrar el demo: npm run sembrar:demo)`);
  const usuario = async (rol) => (await db.query("select usuario_id from public.equipo where gimnasio_id = $1 and rol = $2 and usuario_id is not null limit 1", [g.id, rol])).rows[0]?.usuario_id;
  const duenio = await usuario("dueno");
  if (!duenio) throw new Error("El gimnasio no tiene dueño con usuario");
  const recepcion = (await usuario("recepcion")) ?? duenio;
  cuantosSocios = (await db.query("select count(*)::int n from public.socios where gimnasio_id = $1", [g.id])).rows[0].n;
  cuantosGimnasios = (await db.query("select count(*)::int n from public.gimnasios")).rows[0].n;
  const sede = (await db.query("select id from public.sedes where gimnasio_id = $1 order by id limit 1", [g.id])).rows[0].id;
  // Un socio al día (para estado_acceso / ficha / registrar un ingreso).
  const socio = (await db.query(`select s.id from public.socios s where s.gimnasio_id = $1 and s.dado_de_baja_en is null
    and exists (select 1 from public.coberturas c where c.socio_id = s.id and c.hasta > now()) order by s.creado_en limit 1`, [g.id])).rows[0]?.id;

  // [nombre, quién, sql ($1 = gimnasio, $2 = socio, $3 = sede), presupuesto]
  const LLAMADAS = [
    ["pendientes_panel", "dueno", "select public.pendientes_panel($1)", PRESUPUESTO_PENDIENTES],
    ["pendientes_panel (recepción)", "recepcion", "select public.pendientes_panel($1)", PRESUPUESTO_PENDIENTES],
    ["panel_gimnasio", "dueno", "select public.panel_gimnasio($1)"],
    ["numeros_inicio", "dueno", "select public.numeros_inicio($1)"],
    ["panel_inicio", "dueno", "select public.panel_inicio($1)"],
    ["para_hacer_hoy", "dueno", "select public.para_hacer_hoy($1)"],
    ["ultimas_entradas", "recepcion", "select public.ultimas_entradas($1)"],
    ["buscar_socios (sin filtro)", "dueno", "select * from public.buscar_socios($1, '', 60)"],
    ["buscar_socios (texto)", "dueno", "select * from public.buscar_socios($1, 'mar', 60)"],
    ["buscar_socios (al día)", "dueno", "select * from public.buscar_socios($1, '', 60, null, 'al_dia')"],
    ["buscar_socios (nuevos)", "dueno", "select * from public.buscar_socios($1, '', 60, null, 'nuevos')"],
    ["buscar_socios (bajas)", "dueno", "select * from public.buscar_socios($1, '', 60, null, 'bajas')"],
    ["filtros_socios", "dueno", "select public.filtros_socios($1)"],
    ["ficha_socio", "dueno", "select public.ficha_socio($2)"],
    ["estado_acceso (calcular_acceso)", "recepcion", "select * from public.estado_acceso($2, $3)"],
    ["registrar_ingreso", "recepcion", "select public.registrar_ingreso($2, $3, 'recepcion')"],
    ["vencen_hoy", "dueno", "select * from public.vencen_hoy($1)"],
    ["vencen_pestanas", "dueno", "select public.vencen_pestanas($1)"],
    ["retencion", "dueno", "select * from public.retencion($1)"],
    ["retencion_resumen", "dueno", "select public.retencion_resumen($1)"],
    ["retencion_periodo (mes)", "dueno", "select public.retencion_periodo($1, 'mes')"],
    ["retencion_numeros", "dueno", "select public.retencion_numeros($1)"],
    ["tablero_retencion", "dueno", "select public.tablero_retencion($1)"],
    ["resumen_dueno", "dueno", "select public.resumen_dueno($1)"],
    ["resultado_mes", "dueno", "select public.resultado_mes($1)"],
    ["ganancia_mes", "dueno", "select public.ganancia_mes($1)"],
    ["linea_de_control (30 días)", "dueno", "select public.linea_de_control($1, current_date - 30, current_date)"],
    ["campana_panel", "dueno", "select public.campana_panel($1)"],
    ["ingresos_del_dia", "recepcion", "select * from public.ingresos_del_dia($1)"],
    ["exportar_socios", "dueno", "select * from public.exportar_socios($1)"],
  ];
  for (const [nombre, quien, sql, presupuesto = PRESUPUESTO_PANTALLA] of LLAMADAS) {
    // El driver exige exactamente los parámetros que el texto usa.
    // Los ids van como literales (son nuestros, uuid): el driver no deja parámetros sin usar.
    const sqlFinal = sql.replace("$1", `'${g.id}'`).replace("$2", `'${socio}'`).replace("$3", `'${sede}'`);
    let ms = NaN, error, texto = "";
    for (let vuelta = 0; vuelta < 2; vuelta++) {
      await db.query("begin");
      try {
        await db.query("set local role authenticated");
        await db.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: quien === "recepcion" ? recepcion : duenio, role: "authenticated" })]);
        // auto_explain no ve adentro de las funciones: se mide la llamada entera, que es lo que paga la pantalla.
        const { rows } = await db.query(`explain (analyze, buffers, format text) ${sqlFinal}`);
        texto = rows.map((r) => r["QUERY PLAN"]).join("\n");
        ms = Number(/Execution Time: ([\d.]+) ms/.exec(texto)?.[1] ?? NaN);
      } catch (e) {
        error = String(e.message).split("\n")[0];
      } finally {
        await db.query("rollback");
      }
      if (error) break;
    }
    filas.push({ nombre, quien, ms, error, presupuesto });
    if (verPlan && !error) console.log(`\n── ${nombre}\n${texto}`);
    // --anidado: cuánto gastó cada función de ADENTRO (track_functions), de las que pasan del presupuesto.
    // --planes: además, los planes de las consultas de adentro (auto_explain; sale muchísimo texto).
    const detalle = /estado_acceso|registrar_ingreso/.test(nombre);
    if ((anidado || planes) && !error && (ms > presupuesto || detalle)) {
      const avisos = [];
      const alAviso = (m) => avisos.push(m.message);
      db.on("notice", alAviso);
      let tabla = "";
      await db.query("select pg_stat_reset()");
      await db.query("begin");
      try {
        await db.query("set track_functions = 'all'");
        if (planes) {
          await db.query("load 'auto_explain'");
          await db.query(`set auto_explain.log_min_duration = ${detalle ? 0 : 20}; set auto_explain.log_analyze = on; set auto_explain.log_nested_statements = on; set auto_explain.log_timing = on; set client_min_messages = log`);
        }
        await db.query("set local role authenticated");
        await db.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: quien === "recepcion" ? recepcion : duenio, role: "authenticated" })]);
        await db.query(sqlFinal);
      } catch (e) { avisos.push(`error: ${e.message}`); }
      finally { await db.query("rollback"); db.off("notice", alAviso); }
      // Las estadísticas de funciones se vuelcan cuando la sesión queda libre y pasó más de un segundo desde el último volcado:
      await new Promise((r) => setTimeout(r, 1300)); await db.query("select 1"); await new Promise((r) => setTimeout(r, 300));
      const { rows } = await db.query("select schemaname || '.' || funcname as f, calls, round(total_time::numeric, 1) as total, round(self_time::numeric, 1) as propio from pg_stat_user_functions where calls > 0 order by total_time desc limit 14");
      tabla = rows.map((r) => `  ${r.f}  llamadas ${r.calls}  total ${r.total} ms  propio ${r.propio} ms`).join("\n");
      console.log(`\n::group::por dentro de ${nombre}\n${tabla}${planes ? "\n" + avisos.join("\n").slice(0, 60000) : ""}\n::endgroup::`);
    }
  }
} finally {
  await db.end();
}

const md = [];
md.push(`explain analyze · gimnasio "${slug}" (${cuantosSocios} socios, ${cuantosGimnasios} gimnasios en la base)\n`);
md.push("| función | rol | ms | presupuesto | |", "|---|---|---:|---:|---|");
for (const f of filas) {
  const pasa = !f.error && f.ms <= f.presupuesto;
  md.push(`| ${f.nombre} | ${f.quien} | ${f.error ? `error: ${f.error}` : f.ms.toFixed(1)} | ${f.presupuesto} | ${f.error ? "ERROR" : pasa ? "ok" : "PASADO"} |`);
}
const lentas = filas.filter((f) => f.error || f.ms > f.presupuesto);
md.push("", lentas.length ? `Pasan del presupuesto o fallan: ${lentas.map((f) => f.nombre).join(", ")}` : "Todas dentro del presupuesto.");
const salida = md.join("\n");
console.log("\n" + salida);
if (arg("md")) writeFileSync(arg("md"), salida + "\n");
if (arg("json")) writeFileSync(arg("json"), JSON.stringify({ socios: cuantosSocios, gimnasios: cuantosGimnasios, filas }, null, 1));
