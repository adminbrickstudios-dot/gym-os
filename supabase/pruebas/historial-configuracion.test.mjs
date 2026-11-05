// Historial de cambios de configuración (migración 0028): una fila por
// campo que cambió, con quién; lo leen dueño, encargado y BRIK; nadie lo
// escribe desde el cliente.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir } from "./_comun.mjs";

let t, u = {};
async function persona(rol, nombre) {
  const [{ id: usuario }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`${rol}${Math.random()}@ejemplo.invalid`]);
  await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,$3,$4)`, [t.g, usuario, nombre, rol]);
  return usuario;
}
before(async () => {
  t = await abrir("prueba-historial");
  u.dueno = await persona("dueno", "Sofía Dueña");
  u.encargado = await persona("encargado", "Martín Encargado");
  u.recepcion = await persona("recepcion", "Rocío Recepción");
  [{ id: u.admin }] = await t.q(`insert into auth.users (email) values ('admin-hist@ejemplo.invalid') returning id`);
  await t.q(`insert into public.administradores_plataforma (usuario_id) values ($1)`, [u.admin]);
});
after(async () => t && t.cerrar());

const historial = async () => (await t.q(`select public.historial_configuracion($1) as h`, [t.g]))[0].h;

test("una fila por campo que cambió (no por campo enviado), con quién y en palabras", async () => {
  await t.comoUsuario(u.dueno, async () => {
    const [{ c }] = await t.q(`select public.configuracion_panel($1) as c`, [t.g]);
    // Se mandan tres campos; cambia uno solo.
    await t.q(`select public.guardar_configuracion($1, $2)`, [t.g, { tolerancia_dias: c.tolerancia_dias, dias_aviso: c.dias_aviso, descuento_max_recepcion: 25 }]);
    const h = await historial();
    assert.equal(h.length, 1);
    assert.equal(h[0].etiqueta, "Descuento máximo de la recepción (%)");
    assert.equal(h[0].despues, "25");
    assert.equal(h[0].quien, "Sofía Dueña");
    // Booleanos, listas, mensajes y datos del gimnasio, en palabras.
    await t.q(`select public.guardar_configuracion($1, $2)`, [t.g, { cobra_pase: false, secciones_apagadas: ["caja"] }]);
    await t.q(`select public.guardar_mensaje($1, 'cumpleanos', 'Feliz cumple {nombre}')`, [t.g]);
    await t.q(`select public.guardar_datos_gimnasio($1, $2)`, [t.g, { nombre: "Gimnasio Renombrado", whatsapp: "11 1234 5678" }]);
    const h2 = await historial();
    const de = (et) => h2.find((x) => x.etiqueta === et);
    assert.deepEqual([de("Cobra pase diario").antes, de("Cobra pase diario").despues], ["Sí", "No"]);
    assert.equal(de("Secciones apagadas").despues, "Caja");
    assert.equal(de("Mensaje “Cumpleaños”").despues, "Feliz cumple {nombre}");
    assert.equal(de("Nombre del gimnasio").despues, "Gimnasio Renombrado");
    assert.equal(de("WhatsApp").despues, "+5491112345678");
  });
  await t.comoUsuario(u.encargado, async () => {
    await t.q(`select public.guardar_mensaje($1, 'bienvenida', 'Hola {nombre}')`, [t.g]);
    const h = await historial();
    assert.equal(h[0].quien, "Martín Encargado", "el encargado lee y su cambio queda a su nombre");
  });
});

test("permisos: recepción recibe error; BRIK lee; nadie escribe ni borra desde el cliente", async () => {
  await t.comoUsuario(u.recepcion, async () => {
    await t.falla(() => historial(), /Sin permiso/);
    await t.falla(() => t.q(`insert into public.historial_configuracion (gimnasio_id, campo) values ($1, 'x')`, [t.g]), /row-level security|permission/);
  });
  await t.comoUsuario(u.dueno, async () => {
    await t.falla(() => t.q(`insert into public.historial_configuracion (gimnasio_id, campo) values ($1, 'falso')`, [t.g]), /row-level security|permission/);
    const borradas = await t.q(`delete from public.historial_configuracion where gimnasio_id = $1 returning id`, [t.g]);
    assert.equal(borradas.length, 0, "el dueño no puede borrar su historial");
  });
  await t.comoUsuario(u.admin, async () => assert.ok(Array.isArray(await historial())));
});
