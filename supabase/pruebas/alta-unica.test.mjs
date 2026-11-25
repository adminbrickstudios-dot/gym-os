// Cierre para vender (25/11, migración 20261125110000): el alta única de un gimnasio, el celular con +54 y sin el 9, y el importador con
// el archivo típico (columnas en otro orden, DNI con puntos, celulares sin el 9, fechas dd/mm/aaaa). Permisos en negativo: un dueño y
// alguien sin sesión de BRIK reciben error. Ninguna de estas funciones mueve plata.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir } from "./_comun.mjs";

let t, admin, dueno;
const uno = async (sql, p) => (await t.q(sql, p))[0];
const usuario = async () => (await uno(`insert into auth.users (email) values ($1) returning id`, [`u${Math.random()}@ejemplo.invalid`])).id;
before(async () => {
  t = await abrir("prueba-alta-unica");
  admin = await usuario();
  await t.q(`insert into public.administradores_plataforma (usuario_id) values ($1)`, [admin]);
  dueno = await usuario();
  await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,'Dueno','dueno')`, [t.g, dueno]);
});
after(async () => t && t.cerrar());

test("el alta única deja todo en una transacción: plantilla, tipo, marca, Pista con Semáforo, origen y el registro de BRIK", async () => {
  const slug = `alta-unica-${Date.now()}`;
  await t.comoUsuario(admin, async () => {
    const [{ r }] = await t.q(`select public.admin_alta_gimnasio($1, 'Alta Única', 'ejemplo.invalid', 'Dueña Única', 'musculacion', '#16a34a', '#0e151c') r`, [slug]);
    assert.ok(r.gimnasio_id && r.equipo_id && r.host);
    await t.db.query("reset role");
    const [c] = await t.q(`select estilo, color_acento, color_fondo, modo_clases from public.configuracion_gimnasio where gimnasio_id = $1`, [r.gimnasio_id]);
    assert.deepEqual([c.estilo, c.color_acento, c.color_fondo, c.modo_clases], ["pista", "#16a34a", "#0e151c", "ninguno"]);
    const [{ n }] = await t.q(`select count(*)::int n from public.planes where gimnasio_id = $1`, [r.gimnasio_id]);
    assert.ok(n > 0, "la plantilla no creó planes");
    const [g] = await t.q(`select origen, tipo_plantilla from public.gimnasios where id = $1`, [r.gimnasio_id]);
    assert.deepEqual([g.origen, g.tipo_plantilla], ["alta_super", "musculacion"]);
    const [f] = await t.q(`select activa from public.funciones_nuevas_gimnasio where gimnasio_id = $1 and clave = 'pista_semaforo'`, [r.gimnasio_id]);
    assert.equal(f.activa, true);
    const [{ k }] = await t.q(`select count(*)::int k from public.registro_brik where gimnasio_id = $1 and accion = 'alta_gimnasio'`, [r.gimnasio_id]);
    assert.equal(k, 1);
  });
});

test("si algo falla a la mitad no queda nada a medias (un tipo que no existe)", async () => {
  const slug = `alta-mal-${Date.now()}`;
  await t.comoUsuario(admin, () => t.falla(() => t.q(`select public.admin_alta_gimnasio($1, 'Mal', 'ejemplo.invalid', 'Dueño', 'no-existe')`, [slug]), /Tipo de gimnasio desconocido/));
  const [{ n }] = await t.q(`select count(*)::int n from public.gimnasios where slug = $1`, [slug]);
  assert.equal(n, 0);
  await t.comoUsuario(admin, () => t.falla(() => t.q(`select public.admin_alta_gimnasio($1, 'Mal', 'ejemplo.invalid', 'Dueño', null, '#16a34a', null)`, [slug]), /los dos colores/));
});

test("un dueño de un gimnasio y alguien sin sesión reciben error, nunca un alta", async () => {
  await t.comoUsuario(dueno, () => t.falla(() => t.q(`select public.admin_alta_gimnasio('alta-dueno', 'X', 'ejemplo.invalid', 'Y')`), /administradores de la plataforma/));
  await t.db.query("savepoint a"); await t.db.query("set local role anon");
  await assert.rejects(() => t.q(`select public.admin_alta_gimnasio('alta-anon', 'X', 'ejemplo.invalid', 'Y')`));
  await t.db.query("rollback to savepoint a");
});

test("el celular con +54 y sin el 9 se entiende; los que ya se entendían no cambian", async () => {
  const norm = async (x) => (await uno(`select privado.telefono_normalizado($1, 'Celular') v`, [x])).v;
  assert.equal(await norm("+54 387 412-3456"), "+5493874123456");
  assert.equal(await norm("+54 11 1234 5678"), "+5491112345678");
  assert.equal(await norm("+54 000 400 1111"), "+5490004001111");   // el ficticio del demo
  // Caracterización: lo que ya andaba.
  assert.equal(await norm("+54 9 387 412-3456"), "+5493874123456");
  assert.equal(await norm("387 15 412-3456"), "+5493874123456");
  assert.equal(await norm("0387 4123456"), "+5493874123456");
  assert.equal(await norm("3874123456"), "+5493874123456");
  assert.equal(await norm("543874123456"), "+5493874123456");
  assert.equal(await norm("+1 415 555 0100"), "+14155550100");
  await t.falla(() => t.q(`select privado.telefono_normalizado('123', 'Celular')`), /característica/);
});

test("las fechas importadas: dd/mm/aaaa, aaaa-mm-dd y el año de dos cifras (hasta 50 es 20xx)", async () => {
  const f = async (x) => (await uno(`select to_char(privado.fecha_importada($1), 'YYYY-MM-DD') v`, [x])).v;
  assert.equal(await f("05/03/2025"), "2025-03-05");
  assert.equal(await f("2025-03-05"), "2025-03-05");
  assert.equal(await f("5-3-25"), "2025-03-05");
  assert.equal(await f("1/2/90"), "1990-02-01");
  assert.equal(await f("30.11.26"), "2026-11-30");
});

test("el importador entiende el archivo típico y dice fila por fila lo que no pudo leer", async () => {
  const [{ nombre: plan }] = await t.q(`select nombre from public.planes where gimnasio_id = $1 and tipo = 'membresia' and activo order by orden limit 1`, [t.g]);
  const filas = [
    // columnas en otro orden (las ordena la pantalla por el título); lo que llega a la base ya son campos
    { nombre: "Ana Prueba Típica", dni: "40.111.222", telefono: "+54 387 400-1111", alta: "05/03/2025", plan: plan.toUpperCase(), vence: "30/11/2026" },
    { nombre: "Beto", apellido: "Típico", dni: "40111223", telefono: "387 15 400-2222", nacimiento: "1/2/90" },
    { nombre: "Caro Típica", dni: "40.111.224", telefono: "3874003333", alta: "2025-04-01" },
    { nombre: "", dni: "40.111.225" },                                   // sin nombre
    { nombre: "Dani Mal", dni: "12", telefono: "12" },                   // DNI y celular que no se entienden
    { nombre: "Eli Mal", alta: "31/02/2025" },                           // fecha imposible
  ];
  await t.comoUsuario(dueno, async () => {
    const [{ r }] = await t.q(`select public.revisar_importacion($1, $2::jsonb) r`, [t.g, JSON.stringify(filas)]);
    const errores = r.filas.map((f) => f.errores);
    assert.deepEqual(errores.slice(0, 3), [[], [], []], `las tres buenas tienen errores: ${JSON.stringify(errores.slice(0, 3))}`);
    assert.equal(r.filas[0].datos.dni, "40111222");
    assert.equal(r.filas[0].datos.telefono, "+5493874001111");
    assert.equal(r.filas[0].datos.alta, "2025-03-05");
    assert.equal(r.filas[1].datos.telefono, "+5493874002222");
    assert.ok(errores[3].some((e) => /Falta el nombre/.test(e)));
    assert.ok(errores[4].some((e) => /DNI/.test(e)) && errores[4].some((e) => /Celular/.test(e)));
    assert.ok(errores[5].length > 0);
    assert.equal(r.validas, 3);
    const [{ x }] = await t.q(`select public.importar_socios($1, $2::jsonb, 'tipico.csv') x`, [t.g, JSON.stringify(filas)]);
    assert.equal(x.importados, 3);
    assert.equal(x.salteados, 3, "las 3 con errores quedan afuera y se dice cuántas");
  });
});
