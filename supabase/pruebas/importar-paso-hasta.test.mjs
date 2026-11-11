// C2 · Importar socios: "pagó hasta" es un hecho (cobertura), también vencido.
// El veredicto de la puerta se mide con privado.calcular_acceso y un momento
// fijo (nunca now()): quien venció hace meses "debe", quien paga hasta más
// adelante "puede entrar"; volver a subir el mismo archivo no duplica.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir } from "./_comun.mjs";

let t, dueno, recepcion, plan;
const MOMENTO = "2026-11-14T19:00:00-03:00"; // fijo: ni now() ni el día de la corrida

before(async () => {
  t = await abrir("prueba-importar-hasta");
  const mk = async (rol) => {
    const [{ id }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`${rol}${Math.random()}@ejemplo.invalid`]);
    await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,$3,$4)`, [t.g, id, rol, rol]);
    return id;
  };
  dueno = await mk("dueno"); recepcion = await mk("recepcion");
  [{ nombre: plan }] = await t.q(`select nombre from public.planes where gimnasio_id = $1 and tipo = 'membresia' and activo order by orden limit 1`, [t.g]);
});
after(async () => t && t.cerrar());

// Como t.comoUsuario, pero lo que se carga queda (hasta el rollback final) para verificarlo como superusuario.
const como = async (usuarioId, fn) => {
  await t.db.query("set local role authenticated");
  await t.db.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: usuarioId, role: "authenticated" })]);
  try { return await fn(); } finally { await t.db.query("reset role"); }
};

const veredicto = async (dni) => {
  const [s] = await t.q(`select id from public.socios where gimnasio_id = $1 and dni = $2`, [t.g, dni]);
  assert.ok(s, `no existe el socio ${dni}`);
  return (await t.q(`select (privado.calcular_acceso($1, $2::timestamptz, $3)).* from (select 1) x`, [s.id, MOMENTO, t.sede]))[0];
};

const archivo = () => [
  { nombre: "Vera", apellido: "Vencida", dni: "31000001", telefono: "+54 9 000 1000001", plan, alta: "10/02/2025", vence: "31/03/2025" },
  { nombre: "Alba", apellido: "Aldia", dni: "31000002", telefono: "+54 9 000 1000002", plan, alta: "2025-06-01", vence: "31/12/2027" },
  { nombre: "Sol", apellido: "SinPagar", dni: "31000003", plan },
  { nombre: "Vera", apellido: "Repetida", dni: "31000001", plan },
  { nombre: "", dni: "31000009" },
];

test("el primer día la puerta ya dice quién debe y quién puede entrar", async () => {
  await como(dueno, async () => {
    const r = (await t.q(`select public.importar_socios($1, $2, 'socios.xlsx') as r`, [t.g, JSON.stringify(archivo())]))[0].r;
    assert.equal(r.importados, 3);
    assert.equal(r.salteados, 2);
    assert.equal(r.repetidas_en_archivo, 1);
    assert.equal(r.con_cobertura, 2);
  });
  const vencida = await veredicto("31000001");
  assert.equal(vencida.puede, false);
  assert.equal(vencida.motivo, "vencida", "pagó hasta el 31/03/2025: debe");
  assert.equal(vencida.color, "rojo");
  const aldia = await veredicto("31000002");
  assert.equal(aldia.puede, true, "pagó hasta fines de 2027: puede entrar");
  assert.equal(aldia.motivo, "al_dia");
  const sinpago = await veredicto("31000003");
  assert.equal(sinpago.puede, false);
  assert.equal(sinpago.motivo, "sin_pago");
});

test("la cobertura es un hecho [desde, hasta) a medianoche local; cubierto_hasta lo pone el trigger", async () => {
  const [c] = await t.q(`select c.origen, c.desde, c.hasta, privado.medianoche(date '2025-02-10', g.zona_horaria) as m1, privado.medianoche(date '2025-04-01', g.zona_horaria) as m2,
      (select s.cubierto_hasta from public.socios s where s.id = c.socio_id) as cub
    from public.coberturas c join public.gimnasios g on g.id = c.gimnasio_id
    join public.socios s on s.id = c.socio_id where s.gimnasio_id = $1 and s.dni = '31000001'`, [t.g]);
  assert.equal(c.origen, "importacion");
  assert.equal(c.desde.getTime(), c.m1.getTime());
  assert.equal(c.hasta.getTime(), c.m2.getTime(), "pagó hasta el 31/03 inclusive: hasta es el 01/04 a las 00:00");
  assert.equal(c.cub.getTime(), c.m2.getTime());
  const [{ n }] = await t.q(`select count(*)::int n from public.socios where gimnasio_id = $1 and dni = '31000001' and creado_en = privado.medianoche(date '2025-02-10', (select zona_horaria from public.gimnasios where id = $1))`, [t.g]);
  assert.equal(n, 1, "la fecha de alta queda como antigüedad del socio");
});

test("volver a subir el mismo archivo no duplica y lo informa", async () => {
  await como(dueno, async () => {
    const rev = (await t.q(`select public.revisar_importacion($1, $2) as r`, [t.g, JSON.stringify(archivo())]))[0].r;
    assert.equal(rev.validas, 0);
    assert.equal(rev.ya_existian, 4, "los 3 que entraron y la fila repetida (mismo DNI que uno que ya entró) ya existen");
    assert.equal(rev.repetidas_en_archivo, 1);
    const r = (await t.q(`select public.importar_socios($1, $2, 'socios.xlsx') as r`, [t.g, JSON.stringify(archivo())]))[0].r;
    assert.equal(r.importados, 0);
  });
  const [{ n }] = await t.q(`select count(*)::int n from public.socios where gimnasio_id = $1 and dni like '3100000%'`, [t.g]);
  assert.equal(n, 3);
  const [{ c }] = await t.q(`select count(*)::int c from public.coberturas where gimnasio_id = $1 and origen = 'importacion' and socio_id in (select id from public.socios where dni like '3100000%' and gimnasio_id = $1)`, [t.g]);
  assert.equal(c, 2, "cada pagó-hasta es una sola cobertura");
});

test("errores en palabras: fecha de alta futura, pagó hasta anterior al alta, sin plan", async () => {
  await como(dueno, async () => {
    const filas = [
      { nombre: "A", dni: "32000001", plan, alta: "01/01/2099" },
      { nombre: "B", dni: "32000002", plan, alta: "01/05/2025", vence: "01/04/2025" },
      { nombre: "C", dni: "32000003", vence: "01/04/2027" },
      { nombre: "D", dni: "32000004", plan, vence: "pronto" },
    ];
    const r = (await t.q(`select public.revisar_importacion($1, $2) as r`, [t.g, JSON.stringify(filas)]))[0].r;
    assert.equal(r.validas, 0);
    const e = r.filas.map((f) => f.errores.join(" | "));
    assert.match(e[0], /Fecha de alta: fecha imposible/);
    assert.match(e[1], /Pagó hasta es anterior a la fecha de alta/);
    assert.match(e[2], /pagó hasta” pero no plan/);
    assert.match(e[3], /Pagó hasta “pronto”/);
  });
});

test("permiso denegado es error, no lista vacía; otro gimnasio no entra", async () => {
  await como(recepcion, async () => {
    await t.falla(() => t.q(`select public.importar_socios($1, '[{"nombre":"x"}]')`, [t.g]), /Sin permiso/);
  });
  const [{ id: otro }] = await t.q(`insert into public.gimnasios (slug, nombre) values ('otro-importar', 'Otro') returning id`);
  await como(dueno, async () => {
    await t.falla(() => t.q(`select public.importar_socios($1, '[{"nombre":"x"}]')`, [otro]), /Sin permiso/);
  });
});
