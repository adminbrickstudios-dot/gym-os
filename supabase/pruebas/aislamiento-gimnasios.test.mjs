// U3 · Cada cuenta entra SOLO a su gimnasio.
// Se arman dos gimnasios con datos (A y B) y cuatro personas del A: dueño, recepción, profe y un socio con cuenta.
// Cada una llama TODAS las funciones public.* que reciben un id (de gimnasio, sede, socio, plan, venta, clase…) con el id de un dato del B.
// Lo único aceptable es un ERROR (42501 o un "no existe"): un resultado, aunque sea una lista vacía, es un fallo de aislamiento.
// Si una llamada falla por otra razón antes de llegar a la regla (dato inexistente) se cuenta aparte y se muestra: no prueba nada.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir, HOY } from "./_comun.mjs";
import { sembrarCasos } from "../../scripts/datos/casos-testigo.mjs";

let t, B, ids = {}, usuario = {};
const ROLES = ["dueno_a", "recepcion_a", "profe_a", "socio_a"];
const cacheTabla = new Map();
// Funciones que reciben el id del gimnasio pero solo hablan de LA PROPIA cuenta de quien llama, así que con un gimnasio ajeno no devuelven nada del otro:
//   borrar_suscripcion_push  borra solo las suscripciones push del propio usuario (no hay ninguna en el B)
//   estado_soporte           dice si EL propio usuario tiene una sesión de soporte abierta ahí: {activo:false}
//   registrar_sesion_equipo  si la persona no es del equipo de ese gimnasio, devuelve {nuevo:false} y no escribe nada
//   funcion_prendida         devuelve false si la persona no es del gimnasio (no revela si está prendida)
const PROPIAS = new Set(["borrar_suscripcion_push", "estado_soporte", "registrar_sesion_equipo", "funcion_prendida"]);

async function idDe(nombreParam) {
  const n = nombreParam.replace(/^p_/, "").replace(/_id$/, "");
  if (n === "gimnasio") return B.g;
  if (n === "sede") return B.sede;
  if (cacheTabla.has(n)) return cacheTabla.get(n);
  let id = null;
  for (const tabla of [n, `${n}s`, `${n}es`]) {
    const ok = await t.q(`select 1 from information_schema.columns where table_schema = 'public' and table_name = $1 and column_name = 'gimnasio_id'`, [tabla]);
    if (!ok.length) continue;
    const f = await t.q(`select id from public.${tabla} where gimnasio_id = $1 limit 1`, [B.g]).catch(() => []);
    if (f.length) { id = f[0].id; break; }
  }
  cacheTabla.set(n, id);
  return id;
}

function escalar(tipo) {
  if (tipo === "text" || tipo === "character varying") return "x";
  if (["integer", "bigint", "smallint", "numeric", "double precision"].includes(tipo)) return 1;
  if (tipo === "boolean") return false;
  if (tipo === "date") return HOY;
  if (tipo.startsWith("timestamp")) return "2026-11-14T12:00:00Z";
  if (tipo.startsWith("time")) return "12:00";
  if (tipo === "jsonb" || tipo === "json") return "{}";
  if (tipo.endsWith("[]")) return "{}";
  return undefined;
}

before(async () => {
  t = await abrir("aislamiento-a");
  // Gimnasio B con sus propios datos.
  const [{ id: gB }] = await t.q(`insert into public.gimnasios (slug, nombre) values ('aislamiento-b', 'Gimnasio B') returning id`);
  const [{ id: sedeB }] = await t.q(`select id from public.sedes where gimnasio_id = $1`, [gB]);
  await sembrarCasos(t.db, { gimnasioId: gB, sedeId: sedeB, hoy: HOY });
  B = { g: gB, sede: sedeB };
  const [{ id: act }] = await t.q(`insert into public.actividades (gimnasio_id, nombre) values ($1,'Funcional B') returning id`, [gB]);
  await t.q(`insert into public.clases (gimnasio_id, sede_id, actividad_id, inicio, fin) values ($1,$2,$3, now() + interval '1 hour', now() + interval '2 hours')`, [gB, sedeB, act]);
  await t.q(`insert into public.productos (gimnasio_id, nombre, precio) values ($1,'Agua B',1000)`, [gB]);
  // Personas del A.
  for (const [clave, rol] of [["dueno_a", "dueno"], ["recepcion_a", "recepcion"], ["profe_a", "profe"]]) {
    const [{ id }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`${clave}${Math.random()}@ejemplo.invalid`]);
    await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,$3,$4)`, [t.g, id, clave, rol]);
    usuario[clave] = id;
  }
  const [{ id: us }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`socio_a${Math.random()}@ejemplo.invalid`]);
  await t.q(`insert into public.socios (gimnasio_id, nombre, apellido, telefono, usuario_id) values ($1,'Socia','De A','+5490000121212',$2)`, [t.g, us]);
  usuario.socio_a = us;
});
after(async () => t && t.cerrar());

async function llamar(f, argumentos, rol) {
  const marcas = f.tipos.map((tp, i) => `$${i + 1}::${tp}`).join(", ");
  await t.db.query("savepoint aislar");
  try {
    await t.db.query("set local role authenticated");
    await t.db.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: usuario[rol], role: "authenticated" })]);
    await t.db.query(`select * from public.${f.nombre}(${marcas})`, argumentos);
    return { ok: true };
  } catch (e) {
    return { ok: false, codigo: e.code, mensaje: e.message };
  } finally {
    await t.db.query("rollback to savepoint aislar");
  }
}

test("ninguna función public.* con un id del gimnasio B responde a una cuenta del gimnasio A", async () => {
  const fns = await t.q(`
    select p.oid, p.proname as nombre, coalesce(p.proargnames, '{}') as nombres,
           (select array_agg(format_type(x, null) order by o) from unnest(p.proargtypes::oid[]) with ordinality as a(x, o)) as tipos,
           p.pronargs - p.pronargdefaults as obligatorios
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.prokind = 'f' and has_function_privilege('authenticated', p.oid, 'execute')
       and not has_function_privilege('anon', p.oid, 'execute')
     order by 2`);
  const fallas = [], inconcluyentes = new Map();
  let llamadas = 0, concluyentes = 0, funciones = 0;
  for (const f of fns) {
    const tipos = (f.tipos ?? []).slice(0, f.obligatorios);
    const nombres = f.nombres.slice(0, f.obligatorios);
    if (!tipos.includes("uuid")) continue;                       // sin ningún id: no hay nada del B que pasarle
    const args = [];
    let conIdDeB = false, imposible = false;
    for (let i = 0; i < tipos.length; i++) {
      if (tipos[i] === "uuid") {
        const id = await idDe(nombres[i] ?? "");
        if (id) { args.push(id); conIdDeB = true; } else args.push("00000000-0000-4000-8000-0000000000b1");
      } else if (tipos[i] === "uuid[]") { args.push("{}"); }
      else { const v = escalar(tipos[i]); if (v === undefined) { imposible = true; break; } args.push(v); }
    }
    if (imposible || !conIdDeB) continue;                        // sin un id real del B no se prueba aislamiento
    funciones++;
    const fn = { nombre: f.nombre, tipos };
    const variantes = tipos.includes("boolean") ? [false, true] : [null];
    for (const rol of ROLES) {
      for (const bool of variantes) {
        const a = args.map((v, i) => (tipos[i] === "boolean" && bool !== null ? bool : v));
        llamadas++;
        const r = await llamar(fn, a, rol);
        if (r.ok && PROPIAS.has(f.nombre)) concluyentes++;
        else if (r.ok) fallas.push(`${f.nombre}(${nombres.join(", ")}) como ${rol} con datos del B respondió sin error`);
        else if (r.codigo === "42501") concluyentes++;
        else { concluyentes++; inconcluyentes.set(`${f.nombre}: ${r.mensaje.slice(0, 70)}`, (inconcluyentes.get(`${f.nombre}: ${r.mensaje.slice(0, 70)}`) ?? 0) + 1); }
      }
    }
  }
  console.log(`aislamiento: ${funciones} funciones con un id del B, ${llamadas} llamadas, ${concluyentes} con error, ${fallas.length} respondieron`);
  console.log(`  errores que no son 42501 (se anotan, no son fuga): ${[...inconcluyentes.keys()].slice(0, 12).join(" | ")}`);
  assert.ok(funciones > 100, `pocas funciones probadas (${funciones})`);
  assert.deepEqual(fallas, [], `Fugas entre gimnasios:\n${fallas.join("\n")}`);
});

test("las vistas y tablas del gimnasio B no se leen con la sesión de una cuenta del A (RLS)", async () => {
  const tablas = await t.q(`select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r' and exists (select 1 from pg_attribute a where a.attrelid = c.oid and a.attname = 'gimnasio_id' and not a.attisdropped)
      and has_table_privilege('authenticated', c.oid, 'select') order by 1`);
  const fugas = [];
  for (const rol of ROLES) {
    for (const { relname } of tablas) {
      await t.db.query("savepoint rls");
      try {
        await t.db.query("set local role authenticated");
        await t.db.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: usuario[rol], role: "authenticated" })]);
        const r = await t.db.query(`select count(*)::int n from public.${relname} where gimnasio_id = $1`, [B.g]);
        if (r.rows[0].n > 0) fugas.push(`${relname} como ${rol}: ${r.rows[0].n} filas del B`);
      } catch { /* sin permiso: bien */ } finally { await t.db.query("rollback to savepoint rls"); }
    }
  }
  assert.deepEqual(fugas, [], `Tablas legibles entre gimnasios:\n${fugas.join("\n")}`);
});

test("mezclado: el gimnasio y la sede son del A pero el socio, la venta, el plan… son del B: error igual (el dueño de A no toca nada del B por la puerta del A)", async () => {
  const fns = await t.q(`
    select p.proname as nombre, coalesce(p.proargnames, '{}') as nombres,
           (select array_agg(format_type(x, null) order by o) from unnest(p.proargtypes::oid[]) with ordinality as a(x, o)) as tipos,
           p.pronargs - p.pronargdefaults as obligatorios
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.prokind = 'f' and has_function_privilege('authenticated', p.oid, 'execute') and not has_function_privilege('anon', p.oid, 'execute')
     order by 1`);
  const fallas = [];
  let probadas = 0;
  for (const f of fns) {
    const tipos = (f.tipos ?? []).slice(0, f.obligatorios), nombres = f.nombres.slice(0, f.obligatorios);
    if (!tipos.includes("uuid") || PROPIAS.has(f.nombre)) continue;
    const args = []; let ajeno = false, imposible = false;
    for (let i = 0; i < tipos.length; i++) {
      const n = (nombres[i] ?? "").replace(/^p_/, "").replace(/_id$/, "");
      if (tipos[i] === "uuid") {
        if (n === "gimnasio") args.push(t.g);
        else if (n === "sede") args.push(t.sede);
        else { const id = await idDe(nombres[i] ?? ""); if (id) { args.push(id); ajeno = true; } else args.push("00000000-0000-4000-8000-0000000000b1"); }
      } else if (tipos[i] === "uuid[]") args.push("{}");
      else { const v = escalar(tipos[i]); if (v === undefined) { imposible = true; break; } args.push(v); }
    }
    if (imposible || !ajeno) continue;
    probadas++;
    for (const rol of ["dueno_a", "recepcion_a"]) {
      const r = await llamar({ nombre: f.nombre, tipos }, args, rol);
      if (r.ok) fallas.push(`${f.nombre}(${nombres.join(", ")}) como ${rol}: gimnasio del A + id del B respondió sin error`);
    }
  }
  console.log(`aislamiento mezclado: ${probadas} funciones`);
  assert.deepEqual(fallas, [], "Fugas por la puerta del A: " + fallas.join(" | "));
});
