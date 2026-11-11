// P8 / P8b · Estilo de la página (colores y letra), "Restaurar por defecto" y clases de la semana.
// El dueño guarda; el encargado lee lo por defecto pero no guarda; recepción ni lee; sin sesión no se guarda nada.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir } from "./_comun.mjs";

let t, u = {};
const HOST = `estilo-${Date.now()}.ejemplo.invalid`;
async function persona(rol) {
  const [{ id }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`${rol}${Math.random()}@ejemplo.invalid`]);
  await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,$3,$4)`, [t.g, id, rol, rol]);
  return id;
}
before(async () => {
  t = await abrir("prueba-estilo-pagina");
  for (const r of ["dueno", "encargado", "recepcion"]) u[r] = await persona(r);
  await t.q(`insert into public.dominios_gimnasio (gimnasio_id, host, tipo) values ($1, $2, 'propio')`, [t.g, HOST]);
});
after(async () => t && t.cerrar());

const estilo = (...a) => t.q(`select public.guardar_estilo_pagina($1, $2, $3, $4) as p`, [t.g, ...a]);

test("el dueño guarda colores y letra; la página pública y la vista previa los traen", async () => {
  await t.comoUsuario(u.dueno, async () => {
    const [{ p }] = await estilo("#C2410C", "#FFFFFF", "clasica");
    assert.equal(p.vista.marca.color_acento, "#c2410c");
    assert.equal(p.vista.marca.color_fondo, "#ffffff");
    assert.equal(p.vista.marca.tipografia, "clasica");
  });
});

test("la página pública trae la letra y sigue trayendo lo que ya traía", async () => {
  await t.q(`update public.landing_gimnasio set tipografia = 'ancha' where gimnasio_id = $1`, [t.g]);
  const [{ r }] = await t.q(`select public.landing_publica($1) r`, [HOST]);
  assert.equal(r.marca.tipografia, "ancha");
  assert.ok(r.portada.titulo && Array.isArray(r.secciones), "lo que ya traía la página sigue");
});

test("la letra nace condensada", async () => {
  const [{ d }] = await t.q(`select column_default d from information_schema.columns where table_schema = 'public' and table_name = 'landing_gimnasio' and column_name = 'tipografia'`);
  assert.match(d, /condensada/);
});

test("colores y letra inválidos dicen cuál es el problema y no guardan nada", async () => {
  await t.comoUsuario(u.dueno, async () => {
    await t.falla(() => estilo("rojo", "#ffffff", "condensada"), /Color principal/);
    await t.falla(() => estilo("#c2410c", "blanco", "condensada"), /Color de fondo/);
    await t.falla(() => estilo("#c2410c", "#ffffff", "comic"), /Letra/);
  });
});

test("solo el dueño guarda el estilo: encargado y recepción reciben error, no un éxito vacío", async () => {
  const antes = (await t.q(`select tipografia from public.landing_gimnasio where gimnasio_id = $1`, [t.g]))[0].tipografia;
  for (const rol of ["encargado", "recepcion"]) {
    await t.comoUsuario(u[rol], async () => { await t.falla(() => estilo("#c2410c", "#ffffff", "condensada")); });
  }
  const [{ tipografia }] = await t.q(`select tipografia from public.landing_gimnasio where gimnasio_id = $1`, [t.g]);
  assert.equal(tipografia, antes, "el intento fallido no cambió la letra");
});

test("pagina_por_defecto: dueño y encargado la leen; trae las secciones de este gimnasio y sin textos propios", async () => {
  for (const rol of ["dueno", "encargado"]) {
    await t.comoUsuario(u[rol], async () => {
      const [{ p }] = await t.q(`select public.pagina_por_defecto($1) as p`, [t.g]);
      assert.equal(p.portada.titulo, "Gimnasio de Prueba");
      assert.equal(p.portada.bajada, null);
      assert.equal(p.portada.mostrar_precios, true);
      assert.deepEqual(p.secciones.map((s) => s.tipo), ["sobre_nosotros", "actividades", "planes", "horarios", "galeria", "equipo", "preguntas", "ubicacion", "probar"]);
      assert.ok(p.secciones.every((s) => s.visible && Object.keys(s.contenido).length === 0));
      assert.equal(p.estilo.tipografia, "condensada");
    });
  }
  await t.comoUsuario(u.recepcion, async () => { await t.falla(() => t.q(`select public.pagina_por_defecto($1)`, [t.g])); });
});

test("lo por defecto se guarda tal cual con guardar_pagina (la base no lo rechaza)", async () => {
  await t.comoUsuario(u.dueno, async () => {
    const [{ p: d }] = await t.q(`select public.pagina_por_defecto($1) as p`, [t.g]);
    const [{ p }] = await t.q(`select public.guardar_pagina($1, $2, $3) as p`, [t.g, d.portada, JSON.stringify(d.secciones)]);
    assert.equal(p.portada.titulo, d.portada.titulo);
    assert.equal(p.secciones.length, d.secciones.length);
  });
});

test("clases de la semana: solo con la página publicada y Horarios visible; sin eso, lista vacía", async () => {
  const [{ r: lista }] = await t.q(`select public.clases_semana_publica($1) r`, [HOST]);
  assert.ok(Array.isArray(lista));
  const [{ r: otro }] = await t.q(`select public.clases_semana_publica('no-existe.ejemplo.invalid') r`);
  assert.deepEqual(otro, []);
  await t.q(`update public.landing_secciones set visible = false where gimnasio_id = $1 and tipo = 'horarios'`, [t.g]);
  const [{ r: oculta }] = await t.q(`select public.clases_semana_publica($1) r`, [HOST]);
  assert.deepEqual(oculta, []);
  await t.q(`update public.landing_secciones set visible = true where gimnasio_id = $1 and tipo = 'horarios'`, [t.g]);
  await t.q(`update public.landing_gimnasio set publicada = false where gimnasio_id = $1`, [t.g]);
  const [{ r: sinPublicar }] = await t.q(`select public.clases_semana_publica($1) r`, [HOST]);
  assert.deepEqual(sinPublicar, []);
});

test("las clases de los próximos 7 días salen con día y hora del gimnasio", async () => {
  await t.q(`update public.landing_gimnasio set publicada = true where gimnasio_id = $1`, [t.g]);
  let [a] = await t.q(`select id from public.actividades where gimnasio_id = $1 limit 1`, [t.g]);
  if (!a) [a] = await t.q(`insert into public.actividades (gimnasio_id, nombre) values ($1, 'Funcional') returning id`, [t.g]);
  const [s] = await t.q(`select id from public.sedes where gimnasio_id = $1 limit 1`, [t.g]);
  await t.q(`insert into public.clases (gimnasio_id, actividad_id, sede_id, inicio, fin, cupo) values ($1, $2, $3, now() + interval '2 days', now() + interval '2 days 1 hour', 10)`, [t.g, a.id, s.id]);
  const [{ r }] = await t.q(`select public.clases_semana_publica($1) r`, [HOST]);
  assert.equal(r.length, 1);
  assert.match(r[0].hora, /^\d\d:\d\d$/);
  assert.match(r[0].dia, /^\d{4}-\d\d-\d\d$/);
});
