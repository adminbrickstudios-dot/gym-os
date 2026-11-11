#!/usr/bin/env node
// Copia de los datos de los clientes (C8). Dos modos:
//
//   node scripts/db/copia.mjs exportar  --salida <carpeta> [--url <postgres://...>]
//       Exporta el esquema (public + privado) y los datos de esas tablas, anota los
//       conteos de cada gimnasio REAL (es_demo = false) y deja un solo archivo
//       CIFRADO: <carpeta>/base-copia-AAAA-MM-DD.tar.gz.enc. Necesita COPIAS_CLAVE.
//       Solo lee: pg_dump y selects. Nunca escribe en la base de origen.
//
//   node scripts/db/copia.mjs verificar --carpeta <carpeta con conteos.json> --url <base restaurada> [--origen <url de producción>]
//       Compara los conteos de la base restaurada con los que se anotaron al exportar.
//
// El repo y los logs de Actions son PÚBLICOS: por la salida estándar salen solo números
// ("gimnasio 1: socios 80"), nunca nombres, mails ni la dirección de la base.
// La clave se pasa a openssl por una variable de entorno (-pass env:), nunca en la línea de comandos.
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import pg from "pg";

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] : d; };
const modo = process.argv[2];
const TABLAS_CONTEO = ["socios", "pagos", "coberturas", "ingresos"];
const ESQUEMAS = ["public", "privado"];

function fallar(msg) { console.error(`ERROR: ${msg}`); process.exit(1); }

// Corre un programa sin mostrar nunca su salida de error completa (puede traer la dirección de la base).
function correr(cmd, args, { env = {}, entrada, cwd } = {}) {
  const r = spawnSync(cmd, args, { cwd, env: { ...process.env, ...env }, input: entrada, encoding: "utf8", maxBuffer: 1 << 28 });
  if (r.error) fallar(`no pude ejecutar ${cmd}: ${r.error.code === "ENOENT" ? "no está instalado" : r.error.message}`);
  if (r.status !== 0) {
    const limpio = (r.stderr || "").split("\n").slice(0, 3).join(" | ").replace(/postgres(ql)?:\/\/\S+/g, "<url>");
    fallar(`${cmd} terminó con error (código ${r.status}): ${limpio}`);
  }
  return r;
}

async function conteos(url) {
  const db = new pg.Client({ connectionString: url });
  await db.connect();
  try {
    const gs = (await db.query(`select id, slug from public.gimnasios where not es_demo order by creado_en, id`)).rows;
    const out = [];
    for (const g of gs) {
      const fila = { id: g.id, slug: g.slug };
      for (const t of TABLAS_CONTEO) {
        // t viene de una lista cerrada de arriba, no de afuera.
        fila[t] = (await db.query(`select count(*)::int as n from public.${t} where gimnasio_id = $1`, [g.id])).rows[0].n;
      }
      out.push(fila);
    }
    return out;
  } finally { await db.end(); }
}

if (modo === "exportar") {
  const url = arg("url", process.env.SUPABASE_DB_URL);
  const salida = resolve(arg("salida", "copias-salida"));
  if (!url) fallar("falta la dirección de la base (SUPABASE_DB_URL o --url)");
  if (!process.env.COPIAS_CLAVE) fallar("falta COPIAS_CLAVE: la clave con la que se cifra la copia");
  if (process.env.COPIAS_CLAVE.length < 16) fallar("COPIAS_CLAVE es muy corta: usá 16 caracteres o más (mejor 32 al azar)");

  const trabajo = mkdtempSync(join(tmpdir(), "copia-"));
  try {
    const flagsEsq = ESQUEMAS.flatMap((e) => ["--schema", e]);
    const comunes = ["--no-owner", "--dbname", url];
    correr("pg_dump", ["--schema-only", ...flagsEsq, ...comunes, "--file", join(trabajo, "esquema.sql")]);
    correr("pg_dump", ["--data-only", ...flagsEsq, ...comunes, "--file", join(trabajo, "datos.sql")]);

    const reales = await conteos(url);
    writeFileSync(join(trabajo, "conteos.json"), JSON.stringify({ generada: new Date().toISOString(), gimnasios: reales }, null, 2));
    console.log(`Gimnasios reales: ${reales.length}`);
    reales.forEach((g, i) => console.log(`  gimnasio ${i + 1}: ` + TABLAS_CONTEO.map((t) => `${t} ${g[t]}`).join(" · ")));

    mkdirSync(salida, { recursive: true });
    const tgz = join(trabajo, "copia.tar.gz");
    correr("tar", ["-czf", "copia.tar.gz", "esquema.sql", "datos.sql", "conteos.json"], { cwd: trabajo }); // rutas relativas: tar de Windows toma "C:" por una máquina remota
    const fecha = new Date().toISOString().slice(0, 10);
    const cifrado = join(salida, `base-copia-${fecha}.tar.gz.enc`);
    const cifrar = (extra) => correr("openssl", ["enc", "-aes-256-cbc", "-pbkdf2", "-iter", "600000", "-salt", "-pass", "env:COPIAS_CLAVE", ...extra]);
    cifrar(["-in", tgz, "-out", cifrado]);

    // Prueba de ida y vuelta: descifrar y comparar. Una copia que no se puede abrir no es una copia.
    const prueba = join(trabajo, "prueba.tar.gz");
    correr("openssl", ["enc", "-d", "-aes-256-cbc", "-pbkdf2", "-iter", "600000", "-pass", "env:COPIAS_CLAVE", "-in", cifrado, "-out", prueba]);
    if (!readFileSync(prueba).equals(readFileSync(tgz))) fallar("la copia cifrada no descifra igual que el original");
    console.log(`Copia cifrada: ${cifrado.split(/[\\/]/).pop()} (${statSync(cifrado).size} bytes). Descifrado de prueba: ok.`);
  } finally { rmSync(trabajo, { recursive: true, force: true }); }
} else if (modo === "verificar") {
  const url = arg("url", process.env.DB_PRUEBAS_URL);
  const carpeta = arg("carpeta");
  if (!url || !carpeta) fallar("uso: verificar --carpeta <carpeta> --url <base restaurada>");
  const esperado = JSON.parse(readFileSync(join(resolve(carpeta), "conteos.json"), "utf8")).gimnasios;
  const real = await conteos(url);
  let mal = 0;
  if (esperado.length === 0) { console.log("La copia no trae gimnasios reales: no hay conteos que comparar."); }
  esperado.forEach((g, i) => {
    const r = real.find((x) => x.id === g.id);
    for (const t of TABLAS_CONTEO) {
      const ok = r && r[t] === g[t];
      if (!ok) mal++;
      console.log(`  gimnasio ${i + 1} · ${t}: copia ${g[t]} · restaurado ${r ? r[t] : "falta el gimnasio"} · ${ok ? "ok" : "NO COINCIDE"}`);
    }
  });
  // Contra la base de origen de ahora (solo lectura): informativo, porque el origen sigue recibiendo pagos e ingresos.
  const origen = arg("origen");
  if (origen) {
    const ahora = await conteos(origen);
    esperado.forEach((g, i) => {
      const o = ahora.find((x) => x.id === g.id);
      for (const t of TABLAS_CONTEO) {
        const bajo = !o || o[t] < g[t];
        console.log(`  gimnasio ${i + 1} · ${t}: origen ahora ${o ? o[t] : "falta"} · copia ${g[t]}${bajo ? " · AVISO: el origen tiene menos que la copia" : ""}`);
        if (bajo && process.env.GITHUB_ACTIONS) console.log(`::warning::gimnasio ${i + 1}, ${t}: el origen tiene menos filas que la copia (¿se borró algo desde la copia?)`);
      }
    });
  }
  if (mal) fallar(`${mal} conteo(s) no coinciden`);
  console.log("Conteos de la restauración coinciden con los de la copia.");
} else {
  fallar("uso: copia.mjs exportar|verificar (ver el encabezado del archivo)");
}
