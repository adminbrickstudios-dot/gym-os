// F2.10 (CUIT y razón social para la factura de BRIK) y F2.11 (sesiones abiertas de un gimnasio y "Cerrar todas").
//   DB_PRUEBAS_URL=postgres://... node --test supabase/pruebas/super-admin-fiscales-sesiones.test.mjs
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir } from "./_comun.mjs";

let t;
const brik = {};
let dueno, recep, otroGim, uOtro;
const uno = async (sql, p) => (await t.q(sql, p))[0];
const usuario = async (pref) => (await uno(`insert into auth.users (email) values ($1) returning id, email`, [`${pref}${Math.random().toString().slice(2, 10)}@ejemplo.invalid`])).id;
// Como en super-admin-f2c: el rol y el JWT se ponen y se sacan, pero lo escrito adentro SE QUEDA (comoUsuario de _comun lo revierte).
async function como(usuarioId, fn) {
  await t.db.query("set role authenticated");
  await t.q(`select set_config('request.jwt.claims', $1, false)`, [JSON.stringify({ sub: usuarioId, role: "authenticated" })]);
  try { return await fn(); } finally { await t.db.query("reset role"); await t.q(`select set_config('request.jwt.claims', '', false)`); }
}
const sesion = (u, agente = "Chrome de prueba") => t.q(`insert into auth.sessions (user_id, user_agent) values ($1, $2)`, [u, agente]);
const cuantas = async (u) => (await uno(`select count(*)::int n from auth.sessions where user_id = $1`, [u])).n;

before(async () => {
  t = await abrir("prueba-fiscal-sesiones");
  for (const rol of ["principal", "soporte", "ventas", "lectura"]) {
    brik[rol] = await usuario(`brik-${rol}`);
    await t.q(`insert into public.administradores_plataforma (usuario_id, rol) values ($1, $2)`, [brik[rol], rol]);
  }
  dueno = await usuario("dueno"); recep = await usuario("recep");
  await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,'Dueña Prueba','dueno'), ($1,$3,'Recepción Prueba','recepcion')`, [t.g, dueno, recep]);
  [{ id: otroGim }] = await t.q(`insert into public.gimnasios (slug, nombre) values ('prueba-fiscal-otro', 'Otro gimnasio') returning id`);
  uOtro = await usuario("otro");
  await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,'Del otro','recepcion')`, [otroGim, uOtro]);
});
after(async () => t && t.cerrar());

// ── F2.10 ───────────────────────────────────────────────────────────
test("cuit_valido: 11 cifras, prefijo y dígito verificador (números fijos)", async () => {
  const v = async (c) => (await uno(`select privado.cuit_valido($1) ok`, [c])).ok;
  assert.equal(await v("20-12345678-6"), true);
  assert.equal(await v("20123456786"), true);
  assert.equal(await v("30-50001091-2"), true);
  assert.equal(await v("20-12345678-5"), false, "dígito verificador malo");
  assert.equal(await v("10-12345678-6"), false, "prefijo que no existe");
  assert.equal(await v("2012345678"), false, "10 cifras");
  assert.equal(await v(""), false);
  assert.equal(await v(null), false);
});

test("F2.10: sin datos cargados devuelve vacío; guardar con CUIT con guiones lo deja con 11 cifras y la razón social limpia", async () => {
  const vacio = await como(brik.lectura, async () => (await uno(`select public.admin_datos_fiscales($1) x`, [t.g])).x);
  assert.equal(vacio.cuit, null); assert.equal(vacio.razon_social, null);
  const r = await como(brik.ventas, async () => (await uno(`select public.admin_guardar_datos_fiscales($1, '20-12345678-6', '  Gimnasio   Prueba  SRL ') x`, [t.g])).x);
  assert.equal(r.cuit, "20123456786"); assert.equal(r.razon_social, "Gimnasio Prueba SRL"); assert.equal(r.repetido_en_otro_gimnasio, false);
  const leido = await como(brik.soporte, async () => (await uno(`select public.admin_datos_fiscales($1) x`, [t.g])).x);
  assert.equal(leido.cuit, "20123456786"); assert.equal(leido.razon_social, "Gimnasio Prueba SRL");
  assert.match(leido.actualizado_por, /^brik-ventas/);
});

test("F2.10: un CUIT inválido o una razón social corta son error y no cambian nada", async () => {
  await como(brik.principal, async () => {
    await t.falla(() => t.q(`select public.admin_guardar_datos_fiscales($1, '20-12345678-5', 'Otra razón')`, [t.g]), /CUIT no es válido/);
    await t.falla(() => t.q(`select public.admin_guardar_datos_fiscales($1, '20-12345678-6', 'X')`, [t.g]), /razón social/);
    await t.falla(() => t.q(`select public.admin_guardar_datos_fiscales('00000000-0000-0000-0000-000000000000', '20-12345678-6', 'Fantasma')`), /no existe/);
  });
  const f = await uno(`select cuit, razon_social from public.datos_fiscales_gimnasio where gimnasio_id = $1`, [t.g]);
  assert.equal(f.cuit, "20123456786"); assert.equal(f.razon_social, "Gimnasio Prueba SRL");
});

test("F2.10: quién y qué cambió queda en el registro de BRIK (lo de antes y lo de ahora)", async () => {
  await como(brik.principal, () => t.q(`select public.admin_guardar_datos_fiscales($1, '30-50001091-2', 'Gimnasio Prueba SA')`, [t.g]));
  const reg = await t.q(`select usuario_id, detalle from public.registro_brik where gimnasio_id = $1 and accion = 'guardar_datos_fiscales' order by creado_en, id`, [t.g]);
  assert.equal(reg.length, 2);
  assert.equal(reg[1].usuario_id, brik.principal);
  assert.equal(reg[1].detalle.antes.cuit, "20123456786");
  assert.equal(reg[1].detalle.despues.cuit, "30500010912");
  assert.equal(reg[1].detalle.despues.razon_social, "Gimnasio Prueba SA");
});

test("F2.10: el mismo CUIT en otro gimnasio se avisa pero no se frena; vaciar los dos campos borra la fila", async () => {
  const r = await como(brik.ventas, async () => (await uno(`select public.admin_guardar_datos_fiscales($1, '30-50001091-2', 'Otro Gimnasio SA') x`, [otroGim])).x);
  assert.equal(r.repetido_en_otro_gimnasio, true);
  await como(brik.ventas, () => t.q(`select public.admin_guardar_datos_fiscales($1, '', '')`, [otroGim]));
  assert.equal((await uno(`select count(*)::int n from public.datos_fiscales_gimnasio where gimnasio_id = $1`, [otroGim])).n, 0);
});

test("F2.10 permisos: soporte y solo lectura pueden mirar pero no guardar; el dueño y el que no es de BRIK, ni mirar ni guardar", async () => {
  for (const rol of ["soporte", "lectura"]) {
    await como(brik[rol], () => t.falla(() => t.q(`select public.admin_guardar_datos_fiscales($1, '20-12345678-6', 'No puede')`, [t.g]), /no puede hacer esto/));
  }
  for (const u of [dueno, recep]) {
    await como(u, async () => {
      await t.falla(() => t.q(`select public.admin_datos_fiscales($1)`, [t.g]), /administradores de la plataforma/);
      await t.falla(() => t.q(`select public.admin_guardar_datos_fiscales($1, '20-12345678-6', 'No puede')`, [t.g]), /administradores de la plataforma/);
    });
  }
  await como(dueno, () => t.falla(() => t.q(`select count(*) from public.datos_fiscales_gimnasio`), /permission denied|permiso/i));
});

// ── F2.11 ───────────────────────────────────────────────────────────
test("F2.11: el principal ve quién tiene sesiones abiertas, y cuántas", async () => {
  await sesion(dueno, "Chrome del dueño"); await sesion(recep, "Safari del mostrador"); await sesion(recep, "Chrome del celu"); await sesion(uOtro);
  const r = await como(brik.principal, async () => (await uno(`select public.admin_sesiones_gimnasio($1) x`, [t.g])).x);
  assert.equal(r.total, 3, "no cuenta las del otro gimnasio");
  const rec = r.personas.find((p) => p.nombre === "Recepción Prueba");
  assert.equal(rec.sesiones, 2); assert.equal(rec.rol, "recepcion"); assert.equal(rec.es_brik, false);
  assert.deepEqual([...rec.equipos].sort(), ["Chrome del celu", "Safari del mostrador"]);
  assert.equal(r.personas.find((p) => p.nombre === "Dueña Prueba").sesiones, 1);
});

test("F2.11: una sesión vencida no cuenta", async () => {
  const u = await usuario("vencida");
  await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,'Con sesión vencida','profe')`, [t.g, u]);
  await t.q(`insert into auth.sessions (user_id, not_after) values ($1, now() - interval '1 hour')`, [u]);
  const r = await como(brik.principal, async () => (await uno(`select public.admin_sesiones_gimnasio($1) x`, [t.g])).x);
  assert.equal(r.personas.find((p) => p.nombre === "Con sesión vencida").sesiones, 0);
});

test("F2.11 permisos: solo el principal; soporte, ventas, solo lectura, el dueño y la recepción son error (no una lista vacía)", async () => {
  for (const rol of ["soporte", "ventas", "lectura"]) {
    await como(brik[rol], async () => {
      await t.falla(() => t.q(`select public.admin_sesiones_gimnasio($1)`, [t.g]), /no puede hacer esto/);
      await t.falla(() => t.q(`select public.admin_cerrar_sesiones_gimnasio($1, 'se fue mal el empleado')`, [t.g]), /no puede hacer esto/);
    });
  }
  for (const u of [dueno, recep]) {
    await como(u, async () => {
      await t.falla(() => t.q(`select public.admin_sesiones_gimnasio($1)`, [t.g]), /administradores de la plataforma/);
      await t.falla(() => t.q(`select public.admin_cerrar_sesiones_gimnasio($1, 'se fue mal el empleado')`, [t.g]), /administradores de la plataforma/);
    });
  }
  assert.equal(await cuantas(recep), 2, "ninguno de los intentos cerró nada");
});

test("F2.11: sin motivo no se cierra nada", async () => {
  await como(brik.principal, async () => {
    await t.falla(() => t.q(`select public.admin_cerrar_sesiones_gimnasio($1, '   ')`, [t.g]), /motivo/);
    await t.falla(() => t.q(`select public.admin_cerrar_sesiones_gimnasio($1, 'abc')`, [t.g]), /motivo/);
  });
  assert.equal(await cuantas(recep), 2);
});

test("F2.11: Cerrar todas corta las del equipo de ESE gimnasio, no las de BRIK ni las de otro gimnasio, y queda en el registro", async () => {
  await sesion(brik.principal, "Mi equipo de BRIK");
  const r = await como(brik.principal, async () => (await uno(`select public.admin_cerrar_sesiones_gimnasio($1, 'Se fue mal la recepcionista') x`, [t.g])).x);
  assert.equal(r.sesiones, 4, "dueño 1 + recepción 2 + la profe de sesión vencida 1 (también es del equipo)");
  assert.equal(await cuantas(dueno), 0); assert.equal(await cuantas(recep), 0);
  assert.equal(await cuantas(uOtro), 1, "el otro gimnasio no se toca");
  assert.equal(await cuantas(brik.principal), 1, "la sesión de BRIK sigue");
  const reg = await uno(`select usuario_id, detalle from public.registro_brik where gimnasio_id = $1 and accion = 'cerrar_sesiones'`, [t.g]);
  assert.equal(reg.usuario_id, brik.principal);
  assert.equal(reg.detalle.motivo, "Se fue mal la recepcionista");
  assert.equal(reg.detalle.sesiones, 4);
  const despues = await como(brik.principal, async () => (await uno(`select public.admin_sesiones_gimnasio($1) x`, [t.g])).x);
  assert.equal(despues.total, 0);
});

test("F2.11: el registro de BRIK no se puede borrar ni cambiar", async () => {
  await t.falla(() => t.q(`delete from public.registro_brik where accion = 'cerrar_sesiones'`));
  await t.falla(() => t.q(`update public.registro_brik set accion = 'otra' where accion = 'cerrar_sesiones'`));
});
