// N10 · "Cuánto deja un socio": dos números calculados de lo guardado (pagos aprobados y coberturas no anuladas), con momentos fijos,
// solo para dueño y encargado, y sin guardar nada. Los números se comparan contra una cuenta hecha a mano con las mismas filas.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir } from "./_comun.mjs";

let t, u = {};
before(async () => {
  t = await abrir("prueba-valor-del-socio");
  for (const rol of ["dueno", "encargado", "recepcion", "profe"]) {
    const [{ id }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`${rol}${Math.random()}@ejemplo.invalid`]);
    await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,$3,$4)`, [t.g, id, rol, rol]);
    u[rol] = id;
  }
});
after(async () => t && t.cerrar());

const valor = (momento) => t.q(`select public.valor_del_socio($1, $2::timestamptz) r`, [t.g, momento]).then((r) => r[0].r);

test("los números salen de las filas guardadas: lo cobrado entre los que pagaron, y los meses de cobertura", async () => {
  // La cuenta a mano, con el mismo criterio (pago aprobado de una venta confirmada con socio; cobertura no anulada).
  const [esp] = await t.q(`
    with pagado as (select v.socio_id, sum(p.monto) total from public.pagos p join public.ventas v on v.gimnasio_id = p.gimnasio_id and v.id = p.venta_id
                     where p.gimnasio_id = $1 and p.estado = 'aprobado' and v.estado = 'confirmada' and v.socio_id is not null group by v.socio_id)
    select count(*)::int n, coalesce(sum(total), 0)::float total from pagado where total > 0`, [t.g]);
  const [cob] = await t.q(`select count(distinct socio_id)::int n from public.coberturas where gimnasio_id = $1 and anulada_en is null`, [t.g]);
  await t.comoUsuario(u.dueno, async () => {
    const r = await valor("2100-01-01T12:00:00Z");
    assert.equal(r.socios_que_pagaron, esp.n);
    assert.equal(Number(r.cobrado_total), esp.total);
    if (esp.n > 0) assert.equal(Number(r.deja_por_socio), Math.round((esp.total / esp.n) * 100) / 100);
    assert.equal(r.con_cobertura, cob.n);
    // Dentro de 74 años todas las coberturas terminaron: todos son "ex socios" y los dos promedios coinciden.
    assert.equal(r.ex_socios, cob.n);
    assert.equal(r.meses_ex_socios, r.meses_todos);
  });
});

test("momentos fijos: antes de que nadie tuviera cobertura no hay ex socios y el promedio de ex socios queda vacío", async () => {
  await t.comoUsuario(u.dueno, async () => {
    const r = await valor("2000-01-01T12:00:00Z");
    assert.equal(r.ex_socios, 0);
    assert.equal(r.meses_ex_socios, null);
    assert.ok(r.con_cobertura >= 1 && r.meses_todos > 0, "los de ahora igual cuentan en el promedio de todos");
  });
});

test("un gimnasio sin pagos da null en lo que deja un socio, no un cero inventado", async () => {
  const [{ id: g2 }] = await t.q(`insert into public.gimnasios (slug, nombre) values ('vacio-valor-socio', 'Vacío') returning id`);
  const [{ id }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`dueno-vacio${Math.random()}@ejemplo.invalid`]);
  await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,'Dueña','dueno')`, [g2, id]);
  await t.comoUsuario(id, async () => {
    const [{ r }] = await t.q(`select public.valor_del_socio($1, now()) r`, [g2]);
    assert.equal(r.socios_que_pagaron, 0);
    assert.equal(r.deja_por_socio, null);
    assert.equal(r.meses_todos, null);
  });
});

test("permisos: dueño y encargado sí; recepción, profe, otro gimnasio y anon no (error, nunca un cero)", async () => {
  await t.comoUsuario(u.encargado, async () => { assert.ok(await valor("2100-01-01T12:00:00Z")); });
  for (const rol of ["recepcion", "profe"]) {
    await t.comoUsuario(u[rol], async () => { await t.falla(() => valor("2100-01-01T12:00:00Z"), /./); });
  }
  const [{ id }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`nadie${Math.random()}@ejemplo.invalid`]);
  await t.comoUsuario(id, async () => { await t.falla(() => valor("2100-01-01T12:00:00Z"), /./); });
  const [{ a }] = await t.q(`select has_function_privilege('anon', 'public.valor_del_socio(uuid, timestamptz)', 'execute') a`);
  assert.equal(a, false);
});

test("es una función nueva apagada por defecto: el catálogo la trae y el gimnasio no la tiene prendida", async () => {
  const [{ c }] = await t.q(`select privado.funciones_nuevas_catalogo()::text c`);
  assert.match(c, /valor_socio/);
  await t.comoUsuario(u.dueno, async () => {
    const [{ r }] = await t.q(`select public.funciones_nuevas_activas($1::uuid) r`, [t.g]);
    assert.ok(!r.includes("valor_socio"), "nace apagada");
  });
});
