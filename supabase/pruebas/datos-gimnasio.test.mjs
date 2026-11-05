// Pestaña Gimnasio de Configuración (migración 0021): datos de contacto y
// sedes. Cada función se llama con el rol de la persona logueada.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir } from "./_comun.mjs";

let t, otro, sedeOtro, u = {};

async function persona(rol, gimnasio = null) {
  const [{ id: usuario }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`${rol}${Math.random()}@ejemplo.invalid`]);
  await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,$3,$4)`, [gimnasio ?? t.g, usuario, `Persona ${rol}`, rol]);
  return usuario;
}

before(async () => {
  t = await abrir("prueba-datos-gimnasio");
  [{ id: otro }] = await t.q(`insert into public.gimnasios (slug, nombre) values ('prueba-datos-otro', 'Otro') returning id`);
  [{ id: sedeOtro }] = await t.q(`select id from public.sedes where gimnasio_id = $1`, [otro]);
  for (const rol of ["dueno", "encargado", "recepcion"]) u[rol] = await persona(rol);
  u.ajeno = await persona("dueno", otro);
});
after(async () => t && t.cerrar());

const leer = async () => (await t.q(`select public.datos_gimnasio_panel($1) as d`, [t.g]))[0].d;
const guardar = (datos) => t.q(`select public.guardar_datos_gimnasio($1, $2)`, [t.g, datos]);

test("el dueño guarda contacto y sedes; los teléfonos se aceptan como los escribe la gente", async () => {
  await t.comoUsuario(u.dueno, async () => {
    const antes = await leer();
    assert.equal(antes.sedes.length, 1);
    assert.ok(antes.sedes[0].es_principal);
    assert.ok(Array.isArray(antes.dominios));
    await guardar({
      nombre: "  Gimnasio Nuevo  ", whatsapp: "11 1234-5678", instagram: "https://www.instagram.com/gym.nuevo/",
      email_contacto: "Hola@Gym.Ejemplo.invalid",
      sedes: [{ id: t.sede, nombre: "Centro", direccion: "Calle Falsa 123", telefono: "011 4000-0000", mapa_url: "https://maps.app.goo.gl/x" }],
    });
    const d = await leer();
    assert.equal(d.nombre, "Gimnasio Nuevo");
    assert.equal(d.whatsapp, "+5491112345678");
    assert.equal(d.instagram, "gym.nuevo");
    assert.equal(d.email_contacto, "hola@gym.ejemplo.invalid");
    assert.equal(d.sedes[0].nombre, "Centro");
    assert.equal(d.sedes[0].telefono, "+5491140000000");
    // Vacío borra; "@usuario" queda sin la arroba.
    await guardar({ whatsapp: "", instagram: "@otro_user", email_contacto: "" });
    const d2 = await leer();
    assert.equal(d2.whatsapp, null);
    assert.equal(d2.instagram, "otro_user");
    assert.equal(d2.email_contacto, null);
  });
});

test("cada dato mal escrito dice cuál y cómo, y no guarda nada de lo demás", async () => {
  await t.comoUsuario(u.dueno, async () => {
    const casos = [
      [{ nombre: "" }, /nombre del gimnasio es obligatorio/],
      [{ whatsapp: "123" }, /WhatsApp: escribilo con característica/],
      [{ instagram: "con espacios" }, /Instagram: poné solo el usuario/],
      [{ email_contacto: "sin-arroba" }, /no parece un mail/],
      [{ sedes: [{ id: t.sede, nombre: "" }] }, /Sede 1: el nombre es obligatorio/],
      [{ sedes: [{ id: t.sede, nombre: "Centro", mapa_url: "maps.google.com/x" }] }, /link del mapa tiene que empezar con https/],
      [{ sedes: [{ id: t.sede, nombre: "Centro", telefono: "12" }] }, /Teléfono de Centro/],
      [{ inventado: 1 }, /no se pueden cambiar/],
    ];
    for (const [datos, patron] of casos) await t.falla(() => guardar(datos), patron);
    // Uno malo al final frena todo: el nombre válido de adelante no queda guardado.
    const antes = (await leer()).nombre;
    await t.falla(() => guardar({ nombre: "No Debería", whatsapp: "1" }), /WhatsApp/);
    assert.equal((await leer()).nombre, antes);
  });
});

test("permisos: el encargado lee y no guarda; recepción ni lee; nadie toca la sede de otro gimnasio", async () => {
  await t.comoUsuario(u.encargado, async () => {
    const d = await leer();
    assert.ok(d.nombre);
    await t.falla(() => guardar({ nombre: "X" }), /Sin permiso/);
  });
  await t.comoUsuario(u.recepcion, () => t.falla(() => leer(), /Sin permiso/));
  await t.comoUsuario(u.ajeno, () => t.falla(() => leer(), /Sin permiso/));
  await t.comoUsuario(u.dueno, () => t.falla(() => guardar({ sedes: [{ id: sedeOtro, nombre: "Robada" }] }), /no es de este gimnasio/));
});
