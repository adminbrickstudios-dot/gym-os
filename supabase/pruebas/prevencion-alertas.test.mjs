// D4 (PREVENCION.md): aviso de tamaño de base/Storage al 70 % y DNIs repetidos por gimnasio, visibles en el super admin (admin_alertas).
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir } from "./_comun.mjs";

let t, admin, uLectura, uComun;
async function como(usuario, fn) {
  await t.db.query("set role authenticated");
  await t.q(`select set_config('request.jwt.claims', $1, false)`, [JSON.stringify({ sub: usuario, role: "authenticated" })]);
  try { return await fn(); } finally { await t.db.query("reset role"); await t.q(`select set_config('request.jwt.claims', '', false)`); }
}
const uno = async (sql, p) => (await t.q(sql, p))[0];
const mk = async (pref) => (await uno(`insert into auth.users (email) values ($1) returning id, email`, [`${pref}${Math.random().toString().slice(2)}@ejemplo.invalid`]));
const alertas = (u) => como(u, async () => (await uno(`select public.admin_alertas() x`)).x);

before(async () => {
  t = await abrir("prueba-prevencion");
  admin = (await mk("principal")).id;
  await t.q(`insert into public.administradores_plataforma (usuario_id) values ($1)`, [admin]);
  const l = await mk("lectura"); uLectura = l.id;
  await como(admin, () => t.q(`select public.admin_dar_rol_brik($1, 'lectura')`, [l.email]));
  uComun = (await mk("comun")).id;
});
after(async () => t && t.cerrar());

test("admin_almacenamiento: tamaño de la base y del Storage contra el tope, con el porcentaje y el aviso al 70 %", async () => {
  const a = await como(uLectura, async () => (await uno(`select public.admin_almacenamiento() x`)).x);
  for (const k of ["base_mb", "base_tope_mb", "base_pct", "storage_mb", "storage_tope_mb", "storage_pct"]) assert.equal(typeof Number(a[k]), "number", k);
  assert.equal(Number(a.base_tope_mb), 500);
  assert.equal(Number(a.storage_tope_mb), 1024);
  assert.ok(Number(a.base_mb) > 0, "la base pesa algo");
  assert.ok(Math.abs(Number(a.base_pct) - Math.round((Number(a.base_mb) * 100 / 500) * 10) / 10) < 0.2, "el % es tamaño sobre tope");
  assert.equal(a.aviso, Math.max(Number(a.base_pct), Number(a.storage_pct)) >= 70);
  // Si hubiera aviso, la alerta sale; si no, no sale (con la base de prueba el caso normal es que no).
  const al = await alertas(uLectura);
  assert.equal(al.alertas.some((x) => x.clave === "almacenamiento"), a.aviso);
});

test("el aviso aparece al pasar el 70 %: Storage lleno al 75 % da alerta amarilla y al 95 % roja", async () => {
  const [{ existe }] = await t.q(`select to_regclass('storage.objects') is not null as existe`);
  if (!existe) return;
  const [{ n }] = await t.q(`select count(*)::int as n from information_schema.columns where table_schema = 'storage' and table_name = 'objects' and column_name in ('bucket_id', 'name', 'metadata')`);
  const [{ b }] = await t.q(`select count(*)::int as b from storage.buckets`);
  if (n < 3 || b < 1) return;   // la simulación local de Storage no trae esas columnas: se prueba en la base con Storage real
  await t.q(`insert into storage.objects (bucket_id, name, metadata) values ((select id from storage.buckets limit 1), 'prueba-70-por-ciento', jsonb_build_object('size', ${Math.round(0.75 * 1024 * 1048576)}))`);
  const a = await alertas(uLectura);
  const x = a.alertas.find((v) => v.clave === "almacenamiento");
  assert.ok(x, "75 % del Storage: hay alerta");
  assert.equal(x.nivel, "amarillo");
  await t.q(`update storage.objects set metadata = jsonb_build_object('size', ${Math.round(0.95 * 1024 * 1048576)}) where name = 'prueba-70-por-ciento'`);
  assert.equal((await alertas(uLectura)).alertas.find((v) => v.clave === "almacenamiento").nivel, "rojo");
});

test("DNIs repetidos: sin repetidos no hay alerta; con dos socios del mismo gimnasio con el mismo DNI aparece tapado y la alerta es roja", async () => {
  const antes = await como(uLectura, async () => (await uno(`select public.admin_dnis_repetidos() x`)).x);
  assert.deepEqual(antes, []);
  assert.equal((await alertas(uLectura)).alertas.some((x) => x.clave === "dnis_repetidos"), false);
  // La base lo impide con un índice único por gimnasio: para probar el chequeo se saca el índice (todo dentro de la transacción que revierte).
  await t.q(`drop index public.socios_dni_por_gimnasio`);
  for (const ap of ["Repetido Uno", "Repetido Dos"]) await t.q(`insert into public.socios (gimnasio_id, nombre, apellido, dni) values ($1, 'Dni', $2, '31999888')`, [t.g, ap]);
  const r = await como(uLectura, async () => (await uno(`select public.admin_dnis_repetidos() x`)).x);
  assert.equal(r.length, 1);
  assert.deepEqual([r[0].gimnasio_id, r[0].tipo, r[0].dni, r[0].cantidad], [t.g, "socios", "***888", 2]);
  assert.ok(!JSON.stringify(r).includes("31999888"), "el DNI completo no sale");
  const al = (await alertas(uLectura)).alertas.find((x) => x.clave === "dnis_repetidos");
  assert.equal(al.nivel, "rojo");
});

test("un Interesado con el DNI de un socio vigente se avisa; uno ya convertido en socio, no", async () => {
  await t.q(`insert into public.prospectos (gimnasio_id, nombre, telefono, dni) values ($1, 'Interesado Uno', '+5490001110001', '31999888')`, [t.g]);
  await t.q(`insert into public.prospectos (gimnasio_id, nombre, telefono, dni, estado) values ($1, 'Interesado Dos', '+5490001110002', '31999777', 'socio')`, [t.g]);
  await t.q(`insert into public.socios (gimnasio_id, nombre, apellido, dni) values ($1, 'Dni', 'Ya Socio', '31999777')`, [t.g]);
  const r = await como(uLectura, async () => (await uno(`select public.admin_dnis_repetidos() x`)).x);
  assert.ok(r.some((x) => x.tipo === "interesado_ya_socio" && x.dni === "***888"));
  assert.ok(!r.some((x) => x.tipo === "interesado_ya_socio" && x.dni === "***777"));
});

test("solo el equipo de BRIK las ve: una cuenta común recibe error, no una lista vacía", async () => {
  for (const f of ["admin_almacenamiento()", "admin_dnis_repetidos()", "admin_alertas()"]) {
    await como(uComun, () => t.falla(() => t.q(`select public.${f}`), /administradores de la plataforma|no puede hacer esto|Sin permiso|permission denied/i));
  }});
