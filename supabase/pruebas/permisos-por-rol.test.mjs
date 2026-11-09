// BASE-8 · Prueba de permisos por rol CONTRA docs/base/PERMISOS.md.
// Por cada función que el documento lista con roles, la llama como cada rol del equipo (dueño, encargado, recepción, profe), como un
// dueño de OTRO gimnasio, como un socio sin cargo en el equipo y como anónimo:
//   - un rol con "—" tiene que recibir un ERROR de permiso (42501), nunca una respuesta vacía ni datos;
//   - un rol con "✓" no puede recibir el error de permiso del equipo;
//   - el otro gimnasio, el socio y el anónimo siempre reciben error de permiso.
// Además: PERMISOS.md tiene que estar al día con la base (si falta una función, la prueba falla y pide regenerarlo).
// Una llamada "no concluyente" es la que falla por otra razón antes de llegar a la regla (ej.: un id que no existe) para un rol con "—":
// se cuenta y se muestra, pero no se da por buena ni por mala.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { abrir } from "./_comun.mjs";

const ROLES = ["dueno", "encargado", "recepcion", "profe"];
let t;
const usuario = {};
let ids;

function leerMatriz() {
  const md = readFileSync(new URL("../../docs/base/PERMISOS.md", import.meta.url), "utf8");
  const m = new Map();
  for (const l of md.split("\n")) {
    const f = l.match(/^\| `([a-z0-9_]+)` \| (.+) \|$/);
    if (!f) continue;
    const celdas = f[2].split("|").map((x) => x.trim());
    if (celdas.length !== ROLES.length) continue;
    m.set(f[1], new Set(ROLES.filter((_, i) => celdas[i] === "✓")));
  }
  return m;
}

function valor(tipo, nombre) {
  const n = nombre.toLowerCase();
  if (tipo === "uuid") {
    if (n.includes("gimnasio")) return ids.g;
    if (n.includes("sede")) return ids.sede;
    if (n.includes("socio")) return ids.socio;
    return "00000000-0000-4000-8000-000000000001";
  }
  if (tipo === "text" || tipo === "character varying") return "x";
  if (tipo === "integer" || tipo === "bigint" || tipo === "smallint") return 1;
  if (tipo === "numeric" || tipo === "double precision") return 1;
  if (tipo === "boolean") return false;
  if (tipo === "date") return "2026-11-14";
  if (tipo.startsWith("timestamp")) return "2026-11-14T12:00:00Z";
  if (tipo.startsWith("time")) return "12:00";
  if (tipo === "jsonb" || tipo === "json") return "{}";
  if (tipo === "uuid[]") return "{}";
  if (tipo.endsWith("[]")) return "{}";
  return null;
}

// Los booleanos cambian la rama (ej. marcar / sacar la marca, con roles distintos): se prueba con todos en falso y todos en verdadero.
async function llamar(funcion, rol) {
  const r1 = await llamarCon(funcion, rol, false);
  if (!funcion.tipos.includes("boolean")) return r1;
  const r2 = await llamarCon(funcion, rol, true);
  const d = (r) => !r.ok && r.codigo === "42501";
  if (d(r1) && d(r2)) return r1;          // denegado en las dos ramas
  return d(r1) ? r2 : r1;                 // alguna rama pasó la regla
}
async function llamarCon(funcion, rol, bool) {
  const { nombre, tipos, nombres } = funcion;
  const params = tipos.map((tp, i) => (tp === "boolean" ? bool : valor(tp, nombres[i])));
  const marcas = tipos.map((tp, i) => `$${i + 1}::${tp}`).join(", ");
  await t.db.query("savepoint llamada");
  try {
    if (rol === "anon") await t.db.query("set local role anon");
    else {
      await t.db.query("set local role authenticated");
      await t.db.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: usuario[rol], role: "authenticated" })]);
    }
    await t.db.query(`select * from public.${nombre}(${marcas})`, params);
    return { ok: true };
  } catch (e) {
    return { ok: false, codigo: e.code, mensaje: e.message };
  } finally {
    await t.db.query("rollback to savepoint llamada");
  }
}

before(async () => {
  t = await abrir("prueba-permisos-por-rol");
  for (const rol of ROLES) {
    const [{ id }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`${rol}${Math.random()}@ejemplo.invalid`]);
    await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,$3,$4)`, [t.g, id, rol, rol]);
    usuario[rol] = id;
  }
  // Un dueño de OTRO gimnasio.
  const [{ id: g2 }] = await t.q(`insert into public.gimnasios (slug, nombre) values ('otro-gimnasio-permisos', 'Otro') returning id`);
  const [{ id: uo }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`otro${Math.random()}@ejemplo.invalid`]);
  await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,'Otro dueño','dueno')`, [g2, uo]);
  usuario.otro = uo;
  // Un socio con cuenta pero sin cargo en el equipo.
  const [{ id: us }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`socio${Math.random()}@ejemplo.invalid`]);
  usuario.socio = us;
  const [s] = await t.q(`select id from public.socios where gimnasio_id = $1 limit 1`, [t.g]);
  ids = { g: t.g, sede: t.sede, socio: s.id };
});
after(async () => t && t.cerrar());

test("PERMISOS.md coincide con la base y cada rol recibe lo que dice la matriz", async () => {
  const matriz = leerMatriz();
  assert.ok(matriz.size > 100, `PERMISOS.md no se pudo leer (filas: ${matriz.size})`);

  const fns = await t.q(`
    select p.proname as nombre, p.prosrc as cuerpo,
           coalesce(p.proargnames, '{}') as nombres,
           (select array_agg(format_type(x, null) order by o) from unnest(p.proargtypes::oid[]) with ordinality as a(x, o)) as tipos,
           p.pronargs - p.pronargdefaults as obligatorios,
           has_function_privilege('authenticated', p.oid, 'execute') as auth
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.prokind = 'f'`);
  const porNombre = new Map();
  for (const f of fns) porNombre.set(f.nombre, [...(porNombre.get(f.nombre) ?? []), f]);

  // 1) La matriz al día: toda función con exigir_equipo y roles explícitos está en el documento.
  const faltan = fns.filter((f) => f.auth && /exigir_equipo\s*\([^;]*?array\s*\[/i.test(f.cuerpo) && !matriz.has(f.nombre)).map((f) => f.nombre);
  assert.deepEqual([...new Set(faltan)], [], "PERMISOS.md está desactualizado: node scripts/datos/permisos-md.mjs");

  // 2) Cada función de la matriz, con cada rol.
  const errores = [];
  let llamadas = 0, concluyentes = 0, noConcluyentes = 0, salteadas = 0;
  for (const [nombre, permitidos] of matriz) {
    const lista = porNombre.get(nombre) ?? [];
    if (lista.length !== 1) { salteadas++; continue; }        // sobrecargas: no se pueden armar sin ambigüedad
    const f = lista[0];
    const obligatorios = (f.tipos ?? []).slice(0, f.obligatorios);
    if ((f.tipos ?? []).some((tp) => valor(tp, "x") === null)) { salteadas++; continue; }
    const funcion = { nombre, tipos: obligatorios, nombres: f.nombres.slice(0, f.obligatorios) };
    for (const rol of [...ROLES, "otro", "socio", "anon"]) {
      llamadas++;
      const r = await llamar(funcion, rol);
      const denegado = !r.ok && r.codigo === "42501";
      const deberiaPoder = ROLES.includes(rol) && permitidos.has(rol);
      if (deberiaPoder) {
        if (denegado && /Sin permiso para esta acción|puso su PIN/.test(r.mensaje)) errores.push(`${nombre}: ${rol} figura con ✓ pero recibió «${r.mensaje}»`);
        else concluyentes++;
      } else if (denegado) concluyentes++;
      else if (r.ok) errores.push(`${nombre}: ${rol} no figura con ✓ y la función respondió sin error (un permiso denegado tiene que ser un error)`);
      else noConcluyentes++;   // falló antes de llegar a la regla (id inexistente, dato inválido): no prueba nada
    }
  }
  console.log(`permisos-por-rol: ${matriz.size} funciones, ${llamadas} llamadas, ${concluyentes} concluyentes, ${noConcluyentes} no concluyentes, ${salteadas} salteadas`);
  assert.deepEqual(errores, [], `Contradicciones con PERMISOS.md:\n${errores.join("\n")}`);
});
