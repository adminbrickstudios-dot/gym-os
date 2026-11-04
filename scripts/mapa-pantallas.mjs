#!/usr/bin/env node
// Mapa de pantallas de Gym OS, sacado del código (no se escribe a mano):
// ruta · quién la ve · qué sección la apaga · qué funciones de la base llama ·
// a qué otras pantallas lleva. Escribe docs/paneles/README.md.
//
//   node scripts/mapa-pantallas.mjs              arma el mapa
//   node scripts/mapa-pantallas.mjs --verificar  además falla si una pantalla llama
//                                                 a una función que no existe en la base
// Base: DB_PRUEBAS_URL (scripts/local/entorno.sh la carga).
import { readdirSync, readFileSync, statSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
const app = join(raiz, "src", "app");
const verificar = process.argv.includes("--verificar");

// ── Pantallas y rutas ───────────────────────────────────────────────
function recorrer(dir, salida = []) {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) recorrer(p, salida);
    else if (n === "page.tsx" || n === "route.ts") salida.push(p);
  }
  return salida;
}
// Archivos que pertenecen a una ruta: los de su carpeta (sin subcarpetas que sean otras rutas),
// y las carpetas sin page/route adentro (componentes privados).
function archivosDe(dir) {
  const fuera = [];
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) {
      const tieneRuta = readdirSync(p).some((x) => x === "page.tsx" || x === "route.ts");
      if (!tieneRuta) fuera.push(...archivosDe(p));
    } else if (/\.(tsx?|mjs)$/.test(n) && !n.endsWith(".test.ts") && n !== "loading.tsx" && n !== "error.tsx") fuera.push(p);
  }
  return fuera;
}
// Componentes compartidos que usan RPC (para sumar sus funciones a quien los importa).
const compartidos = {};
for (const base of [join(raiz, "src", "components"), join(raiz, "src", "lib")]) {
  (function r(d) {
    for (const n of readdirSync(d)) {
      const p = join(d, n);
      if (statSync(p).isDirectory()) r(p);
      else if (/\.tsx?$/.test(n)) compartidos[p] = readFileSync(p, "utf8");
    }
  })(base);
}

const RPC = /(?:rpc(?:<[^>]*>)?\(\s*|\.rpc\(\s*)"([a-z_]+)"/g;
const unico = (a) => [...new Set(a)].sort();

const pantallas = recorrer(app).map((archivo) => {
  const dir = dirname(archivo);
  let ruta = "/" + relative(app, dir).replaceAll("\\", "/");
  if (ruta === "/.") ruta = "/";
  ruta = ruta.replace(/\/$/, "") || "/";
  const tipo = archivo.endsWith("route.ts") ? "acción (POST/GET)" : "pantalla";
  const fuentes = archivosDe(dir);
  let texto = fuentes.map((f) => readFileSync(f, "utf8")).join("\n");
  // Funciones que llaman los componentes compartidos que esta pantalla importa.
  for (const [p, t] of Object.entries(compartidos)) {
    const nombre = relative(join(raiz, "src"), p).replace(/\.tsx?$/, "");
    if (texto.includes(`@/${nombre}"`)) texto += "\n" + t;
  }
  const rpcs = unico([...texto.matchAll(RPC)].map((m) => m[1]));
  const roles = unico([...texto.matchAll(/exigirRol\([^,]+,\s*\[([^\]]*)\]/g)].flatMap((m) => m[1].match(/[a-z]+/g) ?? []));
  const secciones = unico([...texto.matchAll(/exigirSeccion\([^,]+,\s*"([a-z_]+)"/g)].map((m) => m[1]));
  const lleva = unico([...texto.matchAll(/href=(?:"|\{`)(\/[a-z0-9/_?=-]*)/gi)].map((m) => m[1].replace(/\?.*/, "")).filter((h) => h !== ruta));
  return { ruta, tipo, rpcs, roles, secciones, lleva };
}).sort((a, b) => a.ruta.localeCompare(b.ruta));
// El middleware no es una pantalla, pero resuelve el gimnasio de cada pedido.
const mw = readFileSync(join(raiz, "src", "middleware.ts"), "utf8");
pantallas.unshift({
  ruta: "(middleware)", tipo: "cada pedido", roles: [], secciones: [], lleva: [],
  rpcs: unico([...mw.matchAll(/resolver\(\s*"([a-z_]+)"/g), ...mw.matchAll(RPC)].map((m) => m[1])),
});

// ── Funciones que existen en la base ────────────────────────────────
let enBase = null;
const url = process.env.DB_PRUEBAS_URL || process.env.SUPABASE_DB_URL;
if (url) {
  const db = new pg.Client({ connectionString: url });
  await db.connect();
  const filas = (await db.query(`
    select p.proname as nombre,
           has_function_privilege('authenticated', p.oid, 'execute') as auth,
           has_function_privilege('anon', p.oid, 'execute') as anon
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'`)).rows;
  await db.end();
  enBase = new Map(filas.map((f) => [f.nombre, f]));
}

const faltan = [];
for (const p of pantallas) for (const r of p.rpcs) if (enBase && !enBase.has(r)) faltan.push(`${p.ruta} llama a ${r}()`);
const llamadas = new Set(pantallas.flatMap((p) => p.rpcs));
const sinUso = enBase ? [...enBase.values()].filter((f) => f.auth && !llamadas.has(f.nombre)).map((f) => f.nombre).sort() : [];

// ── Markdown ────────────────────────────────────────────────────────
const ROL = { dueno: "👑", encargado: "🧭", recepcion: "🛎️", profe: "💪" };
const lineas = [
  "# Mapa de pantallas",
  "",
  "**Generado por `node scripts/mapa-pantallas.mjs`** a partir del código: no se edita a mano.",
  "Se vuelve a generar cada vez que una vuelta cambia una pantalla.",
  "",
  "Quién la ve: los roles que exige la pantalla (👑 dueño · 🧭 encargado · 🛎️ recepción · 💪 profe); vacío = todo el equipo o lo decide la función de la base.",
  "",
  "| Ruta | Tipo | Quién la ve | Se apaga con | Funciones de la base | Lleva a |",
  "|---|---|---|---|---|---|",
  ...pantallas.map((p) => `| \`${p.ruta}\` | ${p.tipo} | ${p.roles.map((r) => ROL[r] ?? r).join(" ")} | ${p.secciones.join(", ")} | ${p.rpcs.map((r) => `\`${r}\``).join(", ")} | ${p.lleva.map((l) => `\`${l}\``).join(" ")} |`),
  "",
  "## Funciones que ninguna pantalla llama",
  "",
  enBase
    ? (sinUso.length ? "Habilitadas para el equipo o el socio pero sin pantalla que las use (candidatas a pantalla nueva o a revisar):\n\n" + sinUso.map((s) => `- \`${s}\``).join("\n") : "Ninguna.")
    : "(Sin base conectada: no se pudo revisar.)",
  "",
];
mkdirSync(join(raiz, "docs", "paneles"), { recursive: true });
writeFileSync(join(raiz, "docs", "paneles", "README.md"), lineas.join("\n"));
console.log(`✓ Mapa: ${pantallas.length} rutas, ${llamadas.size} funciones usadas${enBase ? `, ${sinUso.length} sin pantalla` : ""}`);
if (faltan.length) {
  console.log(`✗ Pantallas que llaman a funciones que no existen:\n  ${faltan.join("\n  ")}`);
  if (verificar) process.exit(1);
}
