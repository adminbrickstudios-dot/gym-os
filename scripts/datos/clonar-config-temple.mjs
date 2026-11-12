#!/usr/bin/env node
// H4 · Clona la CONFIGURACIÓN de un gimnasio real (Temple Gym) a un gimnasio `[demo]` nuevo, para probar con su
// configuración real (planes, precios, reglas de vencimiento y de cobro, sedes, actividades, horarios) sin tocar
// nunca sus datos.
//
//   node scripts/datos/clonar-config-temple.mjs --origen <url de lectura> --destino <url local> [--slug-origen temple]
//        [--slug-destino demo-temple-clon] [--nombre "[demo] Temple clon"] [--dominio localhost]
//
// Reglas (están en el código, no en la memoria de nadie):
//   · El ORIGEN se abre en una transacción `read only`: el servidor se niega a escribir. Solo se leen las tablas de
//     configuración de la lista de abajo (nunca socios, pagos, ventas, ingresos, caja, equipo ni cuentas).
//   · El DESTINO tiene que ser una base local o de integración (localhost / socket): el script se niega a escribir en
//     una dirección remota, y no puede ser la misma base que el origen.
//   · Del origen no sale ningún dato personal ni secreto: las columnas con pinta de teléfono, mail, dirección,
//     alias/CBU, titular, token o clave NO se copian (queda el valor por defecto del destino).
//   · El gimnasio nuevo se llama `[demo] ...`, tiene es_demo = true y su slug empieza con "demo".
//   · Las referencias a personas del equipo (profe, creado_por…) quedan vacías: el clon no tiene equipo del origen.
// Sin --slug-origen: usa el único gimnasio real (no demo) del origen; si hay más de uno, lista los slugs y se frena.
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import pg from "pg";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
if (existsSync(join(raiz, ".env.local"))) process.loadEnvFile(join(raiz, ".env.local"));
const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] : d; };
const origenUrl = arg("origen", process.env.SUPABASE_DB_URL);
const destinoUrl = arg("destino", process.env.DB_PRUEBAS_URL);
const slugOrigen = arg("slug-origen", null);
const slugDestino = arg("slug-destino", "demo-temple-clon");
const nombreDestino = arg("nombre", "[demo] Temple clon");
const dominio = arg("dominio", "localhost").toLowerCase();

const falla = (m) => { console.error(`✗ ${m}`); process.exit(1); };
if (!origenUrl) falla("Falta --origen (o SUPABASE_DB_URL).");
if (!destinoUrl) falla("Falta --destino (o DB_PRUEBAS_URL).");
if (origenUrl === destinoUrl) falla("El origen y el destino son la misma base: el clon nunca se escribe donde se lee.");
if (!/^demo[a-z0-9-]*$/.test(slugDestino)) falla(`El slug del clon tiene que empezar con "demo" (recibí "${slugDestino}").`);
if (!/^\[demo\]/i.test(nombreDestino)) falla(`El nombre del clon tiene que empezar con "[demo]" (recibí "${nombreDestino}").`);
const esLocal = (u) => { try { const x = new URL(u); return ["localhost", "127.0.0.1", "::1", "[::1]", ""].includes(x.hostname) || x.searchParams.has("host") && x.searchParams.get("host").startsWith("/"); } catch { return false; } };
if (!esLocal(destinoUrl)) falla("El destino tiene que ser una base local o de integración (localhost). Este script no escribe en una dirección remota.");

// Fechas como texto y numéricos como texto: nada se re-interpreta en el viaje.
pg.types.setTypeParser(1082, (v) => v);

// Lo que se copia, en orden (cada tabla depende de las anteriores). `unica` = una fila por gimnasio (clave: gimnasio_id).
const UNICAS = ["configuracion_gimnasio", "configuracion_entrada", "configuracion_vencimiento", "configuracion_caja", "configuracion_cierres",
  "configuracion_cobro", "configuracion_dejar_pasar", "configuracion_fichaje", "configuracion_liquidacion", "configuracion_visita", "config_aumentos", "config_mensajes"];
const LISTAS = ["sedes", "actividades", "planes", "precios_plan", "plan_sedes", "plan_actividades", "horarios_apertura", "productos", "convenios", "motivos_beneficio", "horarios_clase"];
// Columnas que nunca se copian: datos de contacto, de cuenta bancaria, secretos y huellas de quién lo tocó.
const SENSIBLE = /(^|_)(token|secret|clave|credencial|webhook|cbu|cvu|alias|titular|telefono|celular|whatsapp|mail|email|direccion|cuit|dni|password|usuario|creado_por|actualizado_por)(_|$)/i;

const origen = new pg.Client({ connectionString: origenUrl });
const destino = new pg.Client({ connectionString: destinoUrl });
await origen.connect(); await destino.connect();
const resumen = [];
try {
  await origen.query("begin read only");
  const qo = async (s, p) => (await origen.query(s, p)).rows;
  const qd = async (s, p) => (await destino.query(s, p)).rows;

  let gO;
  if (slugOrigen) [gO] = await qo("select id, slug from public.gimnasios where slug = $1", [slugOrigen]);
  else {
    const reales = await qo("select id, slug from public.gimnasios where es_demo = false order by slug");
    if (reales.length > 1) falla(`Hay ${reales.length} gimnasios reales (${reales.map((r) => r.slug).join(", ")}): indicá cuál con --slug-origen.`);
    gO = reales[0];
  }
  if (!gO) falla("No encontré el gimnasio de origen.");
  console.log(`Origen: gimnasio "${gO.slug}" (solo configuración, en lectura). Destino: ${slugDestino}.`);

  await destino.query("begin");
  const [ya] = await qd("select id from public.gimnasios where slug = $1", [slugDestino]);
  if (ya) falla(`El clon "${slugDestino}" ya existe en el destino: nada se pisa. Para empezar de cero, base nueva.`);
  const [{ id: gD }] = await qd("insert into public.gimnasios (slug, nombre, es_demo) values ($1, $2, true) returning id", [slugDestino, nombreDestino]);
  await qd("insert into public.dominios_gimnasio (gimnasio_id, host, tipo) values ($1, $2, 'subdominio') on conflict do nothing", [gD, `${slugDestino}.${dominio}`]);

  const mapas = {};   // tabla → { idViejo: idNuevo }
  const columnasDe = async (db, tabla) => (await db.query(
    `select column_name, is_nullable = 'YES' as nulo, is_generated, data_type from information_schema.columns where table_schema = 'public' and table_name = $1 order by ordinal_position`, [tabla])).rows;
  const fks = async (tabla) => {
    // (gimnasio_id, x_id) → x(gimnasio_id, id): de cada FK, la columna que no es gimnasio_id y la tabla a la que apunta.
    const r = await qd(`select a.attname as col, c2.relname as ref, n2.nspname as esquema
        from pg_constraint k join pg_class c on c.oid = k.conrelid join pg_namespace n on n.oid = c.relnamespace
        join pg_class c2 on c2.oid = k.confrelid join pg_namespace n2 on n2.oid = c2.relnamespace
        join lateral unnest(k.conkey) as u(num) on true join pg_attribute a on a.attrelid = k.conrelid and a.attnum = u.num
        where k.contype = 'f' and n.nspname = 'public' and c.relname = $1 and a.attname <> 'gimnasio_id'`, [tabla]);
    return r;
  };

  async function copiar(tabla, unica) {
    const colsD = await columnasDe(destino, tabla);
    if (!colsD.length) { resumen.push(`${tabla}: no existe en el destino (omitida)`); return; }
    const colsO = new Set((await columnasDe(origen, tabla)).map((c) => c.column_name));
    const refs = Object.fromEntries((await fks(tabla)).map((f) => [f.col, f]));
    const filas = (await qo(`select to_jsonb(t) as fila from public.${tabla} t where gimnasio_id = $1`, [gO.id])).map((r) => r.fila);
    if (!filas.length) { resumen.push(`${tabla}: 0 filas en el origen`); return; }
    mapas[tabla] = {};
    let hechas = 0, omitidas = 0;
    await qd(`savepoint s_${tabla}`);
    try {
      for (const f of filas) {
        const valores = {};
        for (const c of colsD) {
          const n = c.column_name;
          if (!colsO.has(n) || c.is_generated === "ALWAYS" || n === "gimnasio_id" || n === "id") continue;
          if (SENSIBLE.test(n)) continue;
          const ref = refs[n];
          if (ref) {
            const nuevo = ref.esquema === "public" ? mapas[ref.ref]?.[f[n]] : undefined;
            if (nuevo) valores[n] = nuevo;
            else if (f[n] === null) valores[n] = null;
            else if (c.nulo) valores[n] = null;   // apunta a algo que no se copia (equipo, usuarios…): queda vacío
            // si no es nulable y no se copió: se omite la columna y manda el valor por defecto
            continue;
          }
          valores[n] = f[n];
        }
        const json = { ...valores };
        const cols = Object.keys(valores);
        if (!unica && colsD.some((c) => c.column_name === "id")) {
          const nuevoId = randomUUID();
          mapas[tabla][f.id] = nuevoId;
          json.id = nuevoId; cols.unshift("id");
        }
        json.gimnasio_id = gD; cols.unshift("gimnasio_id");
        const lista = cols.map((c) => `"${c}"`).join(", ");
        if (unica) {
          const sets = cols.filter((c) => c !== "gimnasio_id").map((c) => `"${c}" = excluded."${c}"`).join(", ");
          await qd(`insert into public.${tabla} (${lista}) select ${lista} from jsonb_populate_record(null::public.${tabla}, $1::jsonb)
                    on conflict (gimnasio_id) do ${sets ? `update set ${sets}` : "nothing"}`, [JSON.stringify(json)]);
        } else if (tabla === "sedes" && hechas === 0) {
          // El gimnasio nuevo ya nace con una sede: la primera del origen se vuelca sobre ella.
          const [sd] = await qd("select id from public.sedes where gimnasio_id = $1 order by creado_en limit 1", [gD]).catch(() => qd("select id from public.sedes where gimnasio_id = $1 limit 1", [gD]));
          if (sd) {
            mapas[tabla][f.id] = sd.id;
            const sets = cols.filter((c) => !["gimnasio_id", "id"].includes(c)).map((c) => `"${c}" = r."${c}"`).join(", ");
            if (sets) await qd(`update public.sedes s set ${sets} from jsonb_populate_record(null::public.sedes, $2::jsonb) r where s.id = $1`, [sd.id, JSON.stringify(json)]);
          } else await qd(`insert into public.${tabla} (${lista}) select ${lista} from jsonb_populate_record(null::public.${tabla}, $1::jsonb)`, [JSON.stringify(json)]);
        } else {
          // El gimnasio nuevo nace con algunas filas por defecto (p. ej. los motivos de beneficio): si ya está, no se duplica.
          await qd(`insert into public.${tabla} (${lista}) select ${lista} from jsonb_populate_record(null::public.${tabla}, $1::jsonb) on conflict do nothing`, [JSON.stringify(json)]);
        }
        hechas++;
      }
      await qd(`release savepoint s_${tabla}`);
      resumen.push(`${tabla}: ${hechas} copiada(s)${omitidas ? `, ${omitidas} omitida(s)` : ""}`);
    } catch (e) {
      await qd(`rollback to savepoint s_${tabla}`);
      resumen.push(`${tabla}: NO se copió (${String(e.message).split("\n")[0]})`);
      process.exitCode = 2;
    }
  }

  for (const t of UNICAS) await copiar(t, true);
  for (const t of LISTAS) await copiar(t, false);
  await destino.query("commit");
  await origen.query("rollback");
  console.log(resumen.map((r) => `  ${r}`).join("\n"));
  console.log(`Listo: "${nombreDestino}" (${slugDestino}) con la configuración de "${gO.slug}". Sin socios, sin pagos, sin equipo, sin datos personales.`);
} catch (e) {
  await destino.query("rollback").catch(() => {});
  console.error(`✗ ${String(e.message).split("\n")[0]}`);
  process.exitCode = 1;
} finally {
  await origen.end().catch(() => {}); await destino.end().catch(() => {});
}
