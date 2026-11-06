// VD-1 (0136): cómo se comporta la ventana de Entrada en cada gimnasio.
// Sin fila valen los valores por defecto; cambian el dueño y el encargado; la
// recepción y la profe solo leen; cada campo se valida; otro gimnasio no lo ve.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir } from "./_comun.mjs";

let t, u = {}, otro;
async function como(usuario, fn) {
  await t.db.query("set role authenticated");
  await t.q(`select set_config('request.jwt.claims', $1, false)`, [JSON.stringify({ sub: usuario, role: "authenticated" })]);
  try { return await fn(); } finally { await t.db.query("reset role"); await t.q(`select set_config('request.jwt.claims', '', false)`); }
}
before(async () => {
  t = await abrir("prueba-config-entrada");
  for (const rol of ["dueno", "encargado", "recepcion", "profe"]) {
    const [{ id }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`${rol}${Math.random()}@ejemplo.invalid`]);
    await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,$3,$4)`, [t.g, id, rol, rol]);
    u[rol] = id;
  }
  const [{ id: g2 }] = await t.q(`insert into public.gimnasios (slug, nombre) values ('prueba-config-entrada-2', 'Otro Gimnasio') returning id`);
  otro = g2;
});
after(async () => t && t.cerrar());

const leer = (usuario, g = () => t.g) => como(usuario, async () => (await t.q(`select public.config_entrada($1) c`, [g()]))[0].c);
const guardar = (usuario, datos, g = () => t.g) => como(usuario, async () => (await t.q(`select public.guardar_config_entrada($1, $2::jsonb) c`, [g(), JSON.stringify(datos)]))[0].c);

test("sin fila valen los valores por defecto del doc v2/01", async () => {
  for (const rol of ["dueno", "encargado", "recepcion", "profe"]) {
    assert.deepEqual(await leer(u[rol]), { abrir_al_tipear: true, barra_fija: false, anotar_solo_en_verde: false, cerrar_sola_seg: 4 }, rol);
  }
});

test("el dueño y el encargado cambian lo que mandan; el resto queda como estaba", async () => {
  const a = await guardar(u.dueno, { barra_fija: true, cerrar_sola_seg: 6 });
  assert.deepEqual(a, { abrir_al_tipear: true, barra_fija: true, anotar_solo_en_verde: false, cerrar_sola_seg: 6 });
  const b = await guardar(u.encargado, { anotar_solo_en_verde: true, abrir_al_tipear: false, cerrar_sola_seg: 0 });
  assert.deepEqual(b, { abrir_al_tipear: false, barra_fija: true, anotar_solo_en_verde: true, cerrar_sola_seg: 0 });
  assert.deepEqual(await leer(u.recepcion), b, "la recepción ve lo guardado");
  assert.equal((await t.q(`select count(*)::int n from public.configuracion_entrada where gimnasio_id = $1`, [t.g]))[0].n, 1, "una sola fila por gimnasio");
});

test("la recepción y la profe no guardan (error, no un éxito vacío)", async () => {
  for (const rol of ["recepcion", "profe"]) {
    await como(u[rol], () => t.falla(() => t.q(`select public.guardar_config_entrada($1, '{"barra_fija": false}'::jsonb)`, [t.g]), /permiso|rol|acceso/i));
  }
  assert.equal((await leer(u.dueno)).barra_fija, true, "nada cambió");
});

test("cada campo se valida", async () => {
  await como(u.dueno, async () => {
    await t.falla(() => t.q(`select public.guardar_config_entrada($1, '{"cerrar_sola_seg": 5}'::jsonb)`, [t.g]), /Cerrar sola/);
    await t.falla(() => t.q(`select public.guardar_config_entrada($1, '{"cerrar_sola_seg": "4"}'::jsonb)`, [t.g]), /Cerrar sola/);
    await t.falla(() => t.q(`select public.guardar_config_entrada($1, '{"barra_fija": "si"}'::jsonb)`, [t.g]), /Barra fija/);
    await t.falla(() => t.q(`select public.guardar_config_entrada($1, '{"abrir_al_tipear": 1}'::jsonb)`, [t.g]), /Abrir al tipear/);
    await t.falla(() => t.q(`select public.guardar_config_entrada($1, '{"anotar_solo_en_verde": null}'::jsonb)`, [t.g]), /Anotar solo en verde/);
    await t.falla(() => t.q(`select public.guardar_config_entrada($1, '{"sonido": true}'::jsonb)`, [t.g]), /no se pueden cambiar/);
    await t.falla(() => t.q(`select public.guardar_config_entrada($1, '[1]'::jsonb)`, [t.g]), /inválidos/);
  });
});

test("otro gimnasio no ve ni cambia esta configuración", async () => {
  await como(u.dueno, () => t.falla(() => t.q(`select public.config_entrada($1)`, [otro]), /permiso|rol|acceso/i));
  await como(u.dueno, () => t.falla(() => t.q(`select public.guardar_config_entrada($1, '{"barra_fija": false}'::jsonb)`, [otro]), /permiso|rol|acceso/i));
  // Ni por la tabla: las políticas dejan leer solo el propio gimnasio y no escribir.
  const filas = await como(u.dueno, async () => await t.q(`select gimnasio_id from public.configuracion_entrada`));
  assert.deepEqual(filas.map((f) => f.gimnasio_id), [t.g]);
  await como(u.dueno, async () => {
    const r = await t.q(`update public.configuracion_entrada set barra_fija = false where gimnasio_id = $1 returning 1`, [t.g]);
    assert.equal(r.length, 0, "sin política de escritura: cero filas");
  });
});
