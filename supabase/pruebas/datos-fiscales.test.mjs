// F2.10 (SA-3) · CUIT y razón social para la factura de BRIK: validación del CUIT (11 cifras y dígito verificador), quién puede cargarlos
// (Principal y Ventas; Soporte y un dueño no), el registro de quién lo cambió y qué había antes, y que anon no pueda ni leerlos.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir } from "./_comun.mjs";

let t, admin, uVentas, uSoporte, uDueno;
async function como(usuario, fn) {
  await t.db.query("set role authenticated");
  await t.q(`select set_config('request.jwt.claims', $1, false)`, [JSON.stringify({ sub: usuario, role: "authenticated" })]);
  try { return await fn(); } finally { await t.db.query("reset role"); await t.q(`select set_config('request.jwt.claims', '', false)`); }
}
const uno = async (sql, p) => (await t.q(sql, p))[0];
const mk = async (pref) => (await uno(`insert into auth.users (email) values ($1) returning id, email`, [`${pref}${Math.random().toString().slice(2)}@ejemplo.invalid`]));

before(async () => {
  t = await abrir("prueba-datos-fiscales");
  const a = await mk("principal");
  admin = a.id;
  await t.q(`insert into public.administradores_plataforma (usuario_id) values ($1)`, [admin]);
  const v = await mk("ventas"), s = await mk("soporte"), d = await mk("dueno");
  uVentas = v.id; uSoporte = s.id; uDueno = d.id;
  await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,'Dueña','dueno')`, [t.g, uDueno]);
  for (const [u, rol] of [[v, "ventas"], [s, "soporte"]]) await como(admin, () => t.q(`select public.admin_dar_rol_brik($1, $2)`, [u.email, rol]));
});
after(async () => t && t.cerrar());

const guardar = (cuit, razon) => t.q(`select public.admin_guardar_datos_fiscales($1, $2, $3)`, [t.g, cuit, razon]);
const leer = async () => (await uno(`select public.admin_datos_fiscales($1) x`, [t.g])).x;

test("el dígito verificador: un CUIT bueno entra, uno malo o corto no", async () => {
  await como(admin, async () => {
    await guardar("20-12345678-6", "Gimnasio Ficticio SRL");
    const d = await leer();
    assert.equal(d.cuit, "20123456786", "se guarda sin guiones");
    assert.equal(d.razon_social, "Gimnasio Ficticio SRL");
    await t.falla(() => guardar("20-12345678-7", "Gimnasio Ficticio SRL"), /no es válido/);
    await t.falla(() => guardar("2012345678", "Gimnasio Ficticio SRL"), /no es válido/);
    await t.falla(() => guardar("abcdefghijk", "Gimnasio Ficticio SRL"), /no es válido/);
    await t.falla(() => guardar("20-12345678-6", "A"), /entre 2 y 120/);
    assert.equal((await leer()).cuit, "20123456786", "lo inválido no pisó lo guardado");
  });
});

test("registro: quién lo cambió y qué había antes", async () => {
  await como(uVentas, async () => { await guardar("30-71234567-1", "Otra Razón SA").catch(() => null); });
  const filas = await t.q(`select usuario_id, detalle from public.registro_brik where gimnasio_id = $1 and accion = 'guardar_datos_fiscales' order by creado_en`, [t.g]);
  assert.ok(filas.length >= 1);
  assert.equal(filas[0].usuario_id, admin);
  assert.equal(filas[0].detalle.cuit, "20123456786");
  assert.equal(filas[0].detalle.cuit_antes, null);
  const d = await como(admin, leer);
  assert.ok(d.cambiado_por, "dice quién fue");
  assert.ok(d.cambiado_en, "y cuándo");
});

test("vaciar los dos campos los deja en null (y queda en el registro)", async () => {
  await como(admin, async () => {
    await guardar("20-12345678-6", "Gimnasio Ficticio SRL");
    await guardar("", "");
    const d = await leer();
    assert.equal(d.cuit, null);
    assert.equal(d.razon_social, null);
  });
});

test("permisos: Principal y Ventas cargan; Soporte, un dueño y quien no es de BRIK, no", async () => {
  await como(uVentas, async () => { await guardar("20-12345678-6", "Cargado por Ventas"); assert.equal((await leer()).razon_social, "Cargado por Ventas"); });
  await como(uSoporte, async () => { await t.falla(() => guardar("20-12345678-6", "No debería"), /no puede hacer esto/); });
  await como(uDueno, async () => {
    await t.falla(() => guardar("20-12345678-6", "No debería"), /administradores de la plataforma/);
    await t.falla(() => leer(), /administradores de la plataforma/);
  });
  assert.equal((await como(admin, leer)).razon_social, "Cargado por Ventas");
});

test("anon no puede ejecutar ni leer ni guardar; una columna sin formato no entra por la tabla", async () => {
  const [{ a, b }] = await t.q(`select has_function_privilege('anon', 'public.admin_guardar_datos_fiscales(uuid, text, text)', 'execute') a, has_function_privilege('anon', 'public.admin_datos_fiscales(uuid)', 'execute') b`);
  assert.equal(a, false);
  assert.equal(b, false);
  await t.falla(() => t.q(`update public.configuracion_gimnasio set cuit_facturacion = '123' where gimnasio_id = $1`, [t.g]), /configuracion_cuit_formato|check/);
});
