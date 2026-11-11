// U4 · La página del gimnasio es siempre su landing: un gimnasio recién creado nace con su página publicada (con lo que tenga),
// y "Ocultar" (publicada = false) es una decisión explícita que se puede deshacer.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir } from "./_comun.mjs";

let t;
before(async () => { t = await abrir("prueba-pagina-u4"); });
after(async () => t && t.cerrar());

test("un gimnasio recién creado tiene su página y está publicada", async () => {
  const [l] = await t.q(`select publicada, titulo from public.landing_gimnasio where gimnasio_id = $1`, [t.g]);
  assert.equal(l.publicada, true);
  assert.ok(l.titulo.length > 0);
});

test("la página pública del host devuelve la landing completa, no la portada oculta, aunque no haya cargado nada", async () => {
  await t.q(`insert into public.dominios_gimnasio (gimnasio_id, host, tipo) values ($1, 'prueba-pagina-u4.ejemplo.invalid', 'subdominio') on conflict do nothing`, [t.g]);
  const [{ r }] = await t.q(`select public.landing_publica('prueba-pagina-u4.ejemplo.invalid') r`);
  assert.equal(r.publicada, true);
  assert.ok(r.portada && r.portada.titulo, "trae la portada");
  assert.ok(Array.isArray(r.secciones), "trae las secciones (las que no tienen datos las oculta la pantalla)");
});

test("ocultar deja solo la marca; mostrar de nuevo vuelve la landing", async () => {
  await t.q(`update public.landing_gimnasio set publicada = false where gimnasio_id = $1`, [t.g]);
  const [{ r: oculta }] = await t.q(`select public.landing_publica('prueba-pagina-u4.ejemplo.invalid') r`);
  assert.equal(oculta.publicada, false);
  assert.ok(oculta.marca.nombre, "la marca sigue");
  assert.equal(oculta.planes, undefined, "no trae planes");
  await t.q(`update public.landing_gimnasio set publicada = true where gimnasio_id = $1`, [t.g]);
  const [{ r }] = await t.q(`select public.landing_publica('prueba-pagina-u4.ejemplo.invalid') r`);
  assert.equal(r.publicada, true);
});

test("ningún gimnasio queda sin fila de página, y la columna nace en true", async () => {
  const [{ n }] = await t.q(`select count(*)::int n from public.gimnasios gi where not exists (select 1 from public.landing_gimnasio l where l.gimnasio_id = gi.id)`);
  assert.equal(n, 0);
  const [{ d }] = await t.q(`select column_default d from information_schema.columns where table_schema = 'public' and table_name = 'landing_gimnasio' and column_name = 'publicada'`);
  assert.equal(d, "true");
});
