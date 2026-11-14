// E8 · lote_lecturas: varias lecturas en un viaje tienen que dar EXACTAMENTE lo mismo que cada una por separado,
// con los mismos permisos (sin permiso es un error, nunca una lista vacía) y sin dejar pedir nada que no sea de la lista.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { abrir } from "./_comun.mjs";

let t, u = {};
before(async () => {
  t = await abrir("prueba-lote-lecturas");
  for (const rol of ["dueno", "recepcion", "profe"]) {
    const [{ id }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`${rol}${Math.random()}@ejemplo.invalid`]);
    await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,$3,$4)`, [t.g, id, rol, rol]);
    u[rol] = id;
  }
});
after(async () => t && t.cerrar());

const lote = (llamadas) => t.q(`select public.lote_lecturas($1::jsonb) r`, [JSON.stringify(llamadas)]).then((r) => r[0].r);
const solo = async (f, args) => {
  const nombres = Object.keys(args), valores = Object.values(args);
  // valores en línea (ids y números de la propia prueba): con parámetros el driver los tipa como entero
  const llamada = `public.${f}(${nombres.map((n, i) => `${n} => '${String(valores[i]).replace(/'/g, "''")}'`).join(", ")})`;
  // lo que devuelve PostgREST: las funciones que devuelven filas dan un arreglo; las demás, el valor
  const [{ c }] = await t.q(`select coalesce(bool_or(proretset), false) c from pg_proc where pronamespace = 'public'::regnamespace and proname = $1`, [f]);
  const sql = c ? `select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) r from ${llamada} x` : `select to_jsonb(${llamada}) r`;
  return (await t.q(sql))[0].r;
};
const norm = (x) => JSON.parse(JSON.stringify(x));

test("toda función de la lista existe en public", async () => {
  const texto = readFileSync(new URL("../migrations/20261114130000_lote_lecturas_mas_pantallas.sql", import.meta.url), "utf8");
  const bloque = texto.slice(texto.indexOf("permitidas constant"), texto.indexOf("resultados jsonb[]"));
  const nombres = [...bloque.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]).filter((n) => n !== "text");
  assert.ok(nombres.length > 40, "se leyó la lista");
  for (const n of nombres) {
    const [{ c }] = await t.q(`select count(*)::int c from pg_proc where pronamespace = 'public'::regnamespace and proname = $1`, [n]);
    assert.ok(c >= 1, `falta public.${n}`);
  }
});

test("dueño: el lote da lo mismo que las lecturas por separado", async () => {
  await t.comoUsuario(u.dueno, async () => {
    const a = { p_gimnasio_id: t.g };
    const r = await lote([
      { f: "configuracion_panel", a }, { f: "planes_gimnasio", a }, { f: "formas_de_entrada", a },
      { f: "cumplen_hoy", a }, { f: "config_turnos_fijos", a }, { f: "ultimas_entradas", a: { ...a, p_limite: 8 } },
    ]);
    assert.equal(r.length, 6);
    assert.deepEqual(norm(r[0]), norm(await solo("configuracion_panel", a)));
    assert.deepEqual(norm(r[1]), norm(await solo("planes_gimnasio", a)));
    assert.deepEqual(norm(r[2]), norm(await solo("formas_de_entrada", a)));
    assert.deepEqual(norm(r[3]), norm(await solo("cumplen_hoy", a)));
    assert.deepEqual(norm(r[4]), norm(await solo("config_turnos_fijos", a)));
    assert.deepEqual(norm(r[5]), norm(await solo("ultimas_entradas", { ...a, p_limite: 8 })));
  });
});

test("'cada': una lectura por cada plan, con el plan como clave", async () => {
  await t.comoUsuario(u.dueno, async () => {
    const a = { p_gimnasio_id: t.g };
    const [planes, listas] = await lote([{ f: "planes_gimnasio", a }, { f: "lista_precios_plan", cada: { i: 0, campo: "plan_id", arg: "p_plan_id" } }]);
    assert.ok(Array.isArray(planes) && planes.length > 0, "hay planes de prueba");
    assert.deepEqual(Object.keys(listas).sort(), planes.map((p) => p.plan_id).sort());
    for (const p of planes) assert.deepEqual(norm(listas[p.plan_id]), norm(await solo("lista_precios_plan", { p_plan_id: p.plan_id })));
  });
});

test("solo lecturas de la lista: una escritura o un nombre raro es un error", async () => {
  await t.comoUsuario(u.dueno, async () => {
    await t.falla(() => lote([{ f: "vender", a: { p_gimnasio_id: t.g } }]), /no se puede pedir en lote/);
    await t.falla(() => lote([{ f: "pg_sleep", a: {} }]), /no se puede pedir en lote/);
    await t.falla(() => lote([{ f: "planes_gimnasio'; select 1; --" }]), /no se puede pedir en lote/);
    await t.falla(() => lote({ f: "planes_gimnasio" }), /inválido/);
    await t.falla(() => lote(Array.from({ length: 41 }, () => ({ f: "planes_gimnasio", a: { p_gimnasio_id: t.g } }))), /inválido/);
    // un parámetro que no es p_*: se ignora (no se puede colar SQL por el nombre)
    const r = await lote([{ f: "config_turnos_fijos", a: { p_gimnasio_id: t.g, "x; select 1": "1" } }]);
    assert.equal(r.length, 1);
  });
});

test("sin permiso es un error, nunca un lote vacío; la que se marca tolerante da null", async () => {
  await t.comoUsuario(u.profe, async () => {
    await t.falla(() => lote([{ f: "configuracion_panel", a: { p_gimnasio_id: t.g } }]), /./);
    const r = await lote([{ f: "configuracion_panel", a: { p_gimnasio_id: t.g }, t: true }, { f: "formas_de_entrada", a: { p_gimnasio_id: t.g }, t: true }]);
    assert.equal(r[0], null, "tolerante: null");
  });
  const [{ id }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`nadie${Math.random()}@ejemplo.invalid`]);
  await t.comoUsuario(id, async () => {
    await t.falla(() => lote([{ f: "planes_gimnasio", a: { p_gimnasio_id: t.g } }]), /./);
  });
});

test("anon no puede ejecutar lote_lecturas", async () => {
  const [{ p }] = await t.q(`select has_function_privilege('anon', 'public.lote_lecturas(jsonb)', 'execute') p`);
  assert.equal(p, false);
});
