// Landing pública: qué se publica, qué no, y quién la edita.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir } from "./_comun.mjs";

let t;
const HOST = "landing-prueba.localhost";
before(async () => {
  t = await abrir("prueba-landing");
  await t.q(`insert into public.dominios_gimnasio (gimnasio_id, host, tipo) values ($1, $2, 'subdominio')`, [t.g, HOST]);
});
after(async () => t && t.cerrar());

const landing = async (host = HOST) => (await t.q(`select public.landing_publica($1) as l`, [host]))[0].l;
const comoAnon = async (fn) => {
  await t.db.query("savepoint anon");
  try { await t.db.query("set local role anon"); return await fn(); }
  finally { await t.db.query("rollback to savepoint anon"); }
};
async function usuario(rol) {
  const [{ id: u }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`${rol}${Math.random()}@ejemplo.invalid`]);
  await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,$3,$4)`, [t.g, u, rol, rol]);
  return u;
}

test("un gimnasio nuevo nace con su landing PUBLICADA (U4) y sus 9 secciones (con “Probá una clase”); oculta, queda solo la marca", async () => {
  const [{ n }] = await t.q(`select count(*)::int n from public.landing_secciones where gimnasio_id = $1`, [t.g]);
  assert.equal(n, 9);
  const l = await landing();
  assert.equal(l.publicada, true);
  assert.equal(l.portada.titulo.length > 0, true);
  await t.q(`update public.landing_gimnasio set publicada = false where gimnasio_id = $1`, [t.g]);
  const oculta = await landing();
  assert.equal(oculta.publicada, false);
  assert.equal(l.marca.nombre, "Gimnasio de Prueba");
  assert.equal(oculta.planes, undefined, "oculta no muestra nada más que la marca");
});

test("un host desconocido devuelve null, no otro gimnasio", async () => {
  assert.equal(await landing("no-existe.localhost"), null);
});

test("publicada: planes con su precio de lista y sus variantes, secciones en orden", async () => {
  await t.q(`update public.landing_gimnasio set publicada = true, whatsapp = '+5490000123456' where gimnasio_id = $1`, [t.g]);
  await t.q(`insert into public.precios_plan (gimnasio_id, plan_id, monto, vigente_desde, medio_pago)
             values ($1, $2, 22000, '2020-01-01', 'efectivo')`, [t.g, t.ctx.planes.full]);
  await t.q(`update public.landing_secciones set orden = 1 where gimnasio_id = $1 and tipo = 'preguntas'`, [t.g]);
  await t.q(`update public.landing_secciones set visible = false where gimnasio_id = $1 and tipo = 'equipo'`, [t.g]);
  const l = await landing();
  assert.equal(l.publicada, true);
  assert.equal(l.contacto.whatsapp, "+5490000123456");
  assert.equal(l.secciones[0].tipo, "preguntas");
  assert.ok(!l.secciones.some((s) => s.tipo === "equipo"));
  const full = l.planes.find((p) => p.nombre === "Plan Full");
  assert.equal(Number(full.precio), 25000);
  assert.deepEqual(full.variantes.map((v) => [Number(v.monto), v.medio_pago]), [[22000, "efectivo"]]);
});

test("planes ocultos o sin precio no aparecen; sin precios, se muestran solo los nombres", async () => {
  await t.q(`update public.planes set visible_en_landing = false where id = $1`, [t.ctx.planes.manana]);
  await t.q(`insert into public.planes (gimnasio_id, tipo, nombre, duracion_meses, renovacion) values ($1,'membresia','Sin precio',1,'continua')`, [t.g]);
  let l = await landing();
  assert.ok(!l.planes.some((p) => p.nombre === "Plan Mañana"));
  assert.ok(!l.planes.some((p) => p.nombre === "Sin precio"));
  await t.db.query("savepoint sp");
  await t.q(`update public.landing_gimnasio set mostrar_precios = false where gimnasio_id = $1`, [t.g]);
  l = await landing();
  await t.db.query("rollback to savepoint sp");
  assert.ok(l.planes.length > 0);
  assert.ok(l.planes.every((p) => p.precio === undefined));
});

test("la landing no filtra datos de socios", async () => {
  const texto = JSON.stringify(await landing());
  const socios = await t.q(`select telefono, email from public.socios where gimnasio_id = $1`, [t.g]);
  for (const s of socios) {
    if (s.telefono) assert.ok(!texto.includes(s.telefono), "aparece un teléfono de socio");
    if (s.email) assert.ok(!texto.includes(s.email), "aparece un mail de socio");
  }
});

test("el contenido inválido se rechaza con un mensaje claro", async () => {
  await t.falla(() => t.q(`update public.landing_secciones set contenido = '{"items":[{"pregunta":"¿Hay duchas?"}]}' where gimnasio_id = $1 and tipo = 'preguntas'`, [t.g]), /falta pregunta o respuesta/);
  await t.falla(() => t.q(`update public.landing_secciones set contenido = '{"fotos":[1,2]}' where gimnasio_id = $1 and tipo = 'galeria'`, [t.g]), /ruta de texto/);
  await t.falla(() => t.q(`update public.landing_secciones set contenido = '{"filas":"lunes"}' where gimnasio_id = $1 and tipo = 'horarios'`, [t.g]), /tiene que ser una lista/);
  await t.q(`update public.landing_secciones set contenido = '{"filas":[{"dias":"Lunes a viernes","horas":"7 a 23"}]}' where gimnasio_id = $1 and tipo = 'horarios'`, [t.g]);
});

test("anon lee la landing por la función, pero no las tablas", async () => {
  await comoAnon(async () => {
    const [{ l }] = await t.q(`select public.landing_publica($1) as l`, [HOST]);
    assert.equal(l.publicada, true);
    const filas = await t.q(`select * from public.landing_gimnasio`);
    assert.equal(filas.length, 0);
    const socios = await t.q(`select * from public.socios`);
    assert.equal(socios.length, 0);
  });
});

test("la recepción no edita la landing; el encargado sí", async () => {
  const rec = await usuario("recepcion");
  const enc = await usuario("encargado");
  const editar = async (u) => {
    await t.db.query("savepoint ed");
    try {
      await t.db.query("set local role authenticated");
      await t.q(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: u, role: "authenticated" })]);
      return (await t.db.query(`update public.landing_gimnasio set bajada = 'Nueva bajada' where gimnasio_id = $1`, [t.g])).rowCount;
    } finally { await t.db.query("rollback to savepoint ed"); }
  };
  assert.equal(await editar(rec), 0);
  assert.equal(await editar(enc), 1);
});
