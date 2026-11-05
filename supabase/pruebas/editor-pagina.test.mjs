// Editor de la página (migración 0030): el dueño guarda portada y secciones
// (orden, mostrar u ocultar, contenido) con errores que dicen dónde; el
// encargado lee y no guarda; recepción ni lee; la foto de portada sale de la
// galería y se suelta sola si la foto se quita.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir } from "./_comun.mjs";

let t, u = {};
const HOST = `editor-${Date.now()}.ejemplo.invalid`;
async function persona(rol) {
  const [{ id }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`${rol}${Math.random()}@ejemplo.invalid`]);
  await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,$3,$4)`, [t.g, id, rol, rol]);
  return id;
}
before(async () => {
  t = await abrir("prueba-editor-pagina");
  for (const r of ["dueno", "encargado", "recepcion"]) u[r] = await persona(r);
  await t.q(`insert into public.dominios_gimnasio (gimnasio_id, host, tipo) values ($1, $2, 'propio')`, [t.g, HOST]);
});
after(async () => t && t.cerrar());

const leer = async () => (await t.q(`select public.pagina_panel($1) as p`, [t.g]))[0].p;
const guardar = async (portada, secciones) => (await t.q(`select public.guardar_pagina($1, $2, $3) as p`, [t.g, portada, JSON.stringify(secciones)]))[0].p;

test("el dueño guarda portada, orden, visibilidad y contenido; lo ve la página pública", async () => {
  await t.comoUsuario(u.dueno, async () => {
    const p = await leer();
    assert.equal(p.secciones.length, 9);
    const secciones = [...p.secciones].reverse().map((s) => ({ ...s }));
    const preguntas = secciones.find((s) => s.tipo === "preguntas");
    preguntas.titulo = "  Dudas  ";
    preguntas.contenido = { items: [{ pregunta: "¿Hay duchas?", respuesta: "Sí, con agua caliente." }] };
    secciones.find((s) => s.tipo === "equipo").visible = false;
    secciones.find((s) => s.tipo === "galeria").contenido = { fotos: ["inventada.png"] };   // se ignora
    const r = await guardar({ ...p.portada, titulo: "Entrená distinto", bajada: "", mostrar_precios: false }, secciones);
    assert.equal(r.portada.titulo, "Entrená distinto");
    assert.equal(r.portada.bajada, null, "una frase vacía queda vacía");
    assert.deepEqual(r.secciones.map((s) => s.tipo), secciones.map((s) => s.tipo), "el orden es el que se mandó");
    const pr = r.secciones.find((s) => s.tipo === "preguntas");
    assert.equal(pr.titulo, "Dudas");
    assert.equal(pr.contenido.items[0].respuesta, "Sí, con agua caliente.");
    assert.deepEqual(r.secciones.find((s) => s.tipo === "galeria").contenido, p.secciones.find((s) => s.tipo === "galeria").contenido, "la galería no se toca desde acá");
    await t.q(`select public.publicar_pagina($1, true)`, [t.g]);
    const [{ l }] = await t.q(`select public.landing_publica($1) as l`, [HOST]);
    assert.equal(l.portada.titulo, "Entrená distinto");
    assert.ok(!l.secciones.some((s) => s.tipo === "equipo"), "la sección oculta no sale en la página");
    assert.equal(l.secciones[0].tipo, "probar", "la página respeta el orden");
  });
});

test("errores que dicen dónde: título vacío, elemento sin respuesta, texto largo, foto que no es de la galería", async () => {
  await t.comoUsuario(u.dueno, async () => {
    const p = await leer();
    const con = (tipo, cambio) => p.secciones.map((s) => (s.tipo === tipo ? { ...s, ...cambio } : s));
    await t.falla(() => guardar({ ...p.portada, titulo: " " }, p.secciones), /Título de la portada: no puede quedar vacío/);
    await t.falla(() => guardar({ ...p.portada, boton_texto: "x".repeat(41) }, p.secciones), /Texto del botón: hasta 40 letras \(tiene 41\)/);
    await t.falla(() => guardar(p.portada, con("preguntas", { contenido: { items: [{ pregunta: "¿Abren feriados?", respuesta: "" }] } })),
      /Sección "[^"]+", respuesta 1: no puede quedar vacío/);
    await t.falla(() => guardar(p.portada, con("actividades", { titulo: "" })), /escribí un título/);
    await t.falla(() => guardar({ ...p.portada, foto_portada_path: "otro/galeria/foto-x.png" }, p.secciones), /elegila entre las fotos del gimnasio/);
  });
});

test("la foto de portada sale de la galería y se suelta sola si se quita", async () => {
  const ruta = `${t.g}/galeria/foto-${"a".repeat(32)}.png`;
  await t.q(`update public.landing_secciones set contenido = $2 where gimnasio_id = $1 and tipo = 'galeria'`, [t.g, { fotos: [ruta] }]);
  await t.comoUsuario(u.dueno, async () => {
    const p = await leer();
    const r = await guardar({ ...p.portada, foto_portada_path: ruta }, p.secciones);
    assert.equal(r.portada.foto_portada_path, ruta);
  });
  await t.q(`update public.landing_secciones set contenido = '{"fotos": []}' where gimnasio_id = $1 and tipo = 'galeria'`, [t.g]);
  const [{ f }] = await t.q(`select foto_portada_path as f from public.landing_gimnasio where gimnasio_id = $1`, [t.g]);
  assert.equal(f, null, "sin la foto en la galería, la portada queda sin foto");
});

test("permisos: el encargado lee y no guarda; recepción ni lee", async () => {
  await t.comoUsuario(u.encargado, async () => {
    const p = await leer();
    await t.falla(() => guardar(p.portada, p.secciones), /Sin permiso/);
  });
  await t.comoUsuario(u.recepcion, async () => t.falla(() => leer(), /Sin permiso/));
});
