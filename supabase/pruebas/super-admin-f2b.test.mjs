// Carril B · F2 (segunda parte): roles de BRIK, 2FA, ciudad y módulos, errores, pausa, baja, lanzamiento, demo y datos personales.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir } from "./_comun.mjs";

let t, admin, uSoporte, uVentas, uLectura, uDueno, socio;
// Como el usuario (con claims extra), conservando lo escrito.
async function como(usuario, fn, extra = {}) {
  await t.db.query("set role authenticated");
  await t.q(`select set_config('request.jwt.claims', $1, false)`, [JSON.stringify({ sub: usuario, role: "authenticated", ...extra })]);
  try { return await fn(); } catch (e) { console.log("INTERNO", e.message); throw e; } finally { await t.db.query("reset role"); await t.q(`select set_config('request.jwt.claims', '', false)`); }
}
// Pregunta por solo_lectura como dueño de la base (authenticated no la ve) y vuelve al rol.
const sl = async () => { await t.db.query("reset role"); const r = (await t.q(`select privado.solo_lectura($1) x`, [t.g]))[0].x; await t.db.query("set role authenticated"); return r; };
const uno = async (sql, p) => (await t.q(sql, p))[0];
const usuario = async (pref) => (await uno(`insert into auth.users (email) values ($1) returning id`, [`${pref}${Math.random().toString().slice(2)}@ejemplo.invalid`])).id;

before(async () => {
  t = await abrir("prueba-sa-f2b");
  admin = await usuario("principal");
  await t.q(`insert into public.administradores_plataforma (usuario_id) values ($1)`, [admin]);
  uSoporte = await usuario("soporte"); uVentas = await usuario("ventas"); uLectura = await usuario("lectura"); uDueno = await usuario("dueno");
  await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,'Dueña','dueno')`, [t.g, uDueno]);
  // Los roles los da el principal por mail (las cuentas se leen como servicio para armar la prueba).
  for (const [u, rol] of [[uSoporte, "soporte"], [uVentas, "ventas"], [uLectura, "lectura"]]) {
    const { email } = await uno(`select email from auth.users where id = $1`, [u]);
    await como(admin, () => t.q(`select public.admin_dar_rol_brik($1, $2)`, [email, rol]));
  }
  socio = (await uno(`insert into public.socios (gimnasio_id, nombre, apellido, dni, email, telefono) values ($1,'Pedro','Borrable','30111222','pedro@ejemplo.invalid','+5490001112233') returning id`, [t.g])).id;
});
after(async () => t && t.cerrar());

test("F2.8 roles de BRIK: cada uno hace solo lo suyo y queda al menos un principal", async () => {
  await como(uLectura, async () => {
    await t.falla(() => t.q(`select public.admin_entrar_gimnasio($1, 'quiero mirar', 'recepcion')`, [t.g]), /no puede hacer esto/);
    await t.falla(() => t.q(`select public.admin_buscar_persona('pedro@ejemplo.invalid', 'busco a alguien')`), /no puede hacer esto/);
    await t.falla(() => t.q(`select public.admin_pausar_gimnasio($1, 'una pausa cualquiera')`, [t.g]), /no puede hacer esto/);
    assert.ok((await t.q(`select public.admin_tablero() x`))[0].x.numeros, "lectura ve el tablero");
    assert.ok(Array.isArray((await t.q(`select public.admin_registro_brik() x`))[0].x), "lectura ve el registro");
  });
  await como(uVentas, async () => {
    await t.falla(() => t.q(`select public.admin_entrar_gimnasio($1, 'quiero mirar', 'recepcion')`, [t.g]), /no puede hacer esto/);
    await t.q(`select public.admin_guardar_ciudad($1, 'Rosario')`, [t.g]);
    await t.falla(() => t.q(`select public.admin_registro_brik()`), /no puede hacer esto/);
  });
  await como(uSoporte, async () => {
    await t.q(`select public.admin_entrar_gimnasio($1, 'Revisar los planes', 'profe')`, [t.g]);
    await t.falla(() => t.q(`select public.admin_dar_rol_brik('x@ejemplo.invalid', 'principal')`), /no puede hacer esto/);
    await t.falla(() => t.q(`select public.admin_dar_de_baja($1, 'quiero darlo de baja')`, [t.g]), /no puede hacer esto/);
  });
  await como(uDueno, () => t.falla(() => t.q(`select public.admin_estado_seguridad()`), /administradores/));
  const { email } = await uno(`select email from auth.users where id = $1`, [admin]);
  await como(admin, async () => {
    await t.falla(() => t.q(`select public.admin_quitar_rol_brik($1)`, [admin]), /a vos mismo/);
    await t.falla(() => t.q(`select public.admin_dar_rol_brik($1, 'lectura')`, [email]), /al menos un principal/);
    const e = (await t.q(`select public.admin_estado_seguridad() x`))[0].x;
    assert.equal(e.mi_rol, "principal"); assert.equal(e.equipo.length, 4);
  });
});

test("F2.8 segundo factor: se puede exigir solo con el código confirmado, y después sin él no hay acceso", async () => {
  await como(admin, async () => {
    await t.falla(() => t.q(`select public.admin_exigir_2fa(true)`), /dos pasos/);
  });
  await como(admin, async () => {
    await t.q(`select public.admin_exigir_2fa(true)`);
  }, { aal: "aal2" });
  await como(admin, () => t.falla(() => t.q(`select public.admin_tablero()`), /administradores/));
  await como(admin, async () => {
    assert.ok((await t.q(`select public.admin_tablero() x`))[0].x.numeros);
    await t.q(`select public.admin_exigir_2fa(false)`);
  }, { aal: "aal2" });
  await como(admin, async () => { assert.ok((await t.q(`select public.admin_tablero() x`))[0].x.numeros); });
});

test("F2.4 lista: ciudad y módulo; las bajas no aparecen", async () => {
  await como(admin, async () => {
    const n = async (args) => (await uno(`select jsonb_array_length(public.admin_lista_gimnasios(${args})) n`)).n;
    assert.equal(await n(`p_ciudad => 'rosario'`), 1);
    assert.equal(await n(`p_ciudad => 'cordoba'`), 0);
    assert.equal(await n(`'prueba-sa-f2b', p_modulo => 'clases'`), 1);
    await t.q(`select public.admin_guardar_modulos($1, array['clases'])`, [t.g]);
    assert.equal(await n(`'prueba-sa-f2b', p_modulo => 'clases'`), 0, "con Clases apagado no entra en el filtro de módulo");
    await t.falla(() => t.q(`select public.admin_lista_gimnasios(p_modulo => 'inventado')`), /no existe/);
    const f = (await uno(`select public.admin_lista_gimnasios('prueba-sa-f2b') l`)).l[0];
    assert.equal(f.ciudad, "Rosario"); assert.deepEqual(f.modulos_apagados, ["clases"]);
  });
});

test("F2.5 errores: se registran, se agrupan por pantalla y entran al tablero", async () => {
  await como(uDueno, async () => {
    for (let i = 0; i < 3; i++) await t.q(`select public.registrar_error_app($1, '/panel/caja', 'Algo falló')`, [t.g]);
    await t.q(`select public.registrar_error_app($1, '/panel/socios', 'Otro fallo')`, [t.g]);
  });
  await como(uDueno, () => t.falla(() => t.q(`select public.registrar_error_app($1, '/x', 'y')`, [(t.g.replace(/.$/, (c) => (c === "0" ? "1" : "0")))]), /No sos parte|violates/));
  await como(admin, async () => {
    const e = (await uno(`select public.admin_errores($1) x`, [t.g])).x;
    assert.equal(e.find((x) => x.pantalla === "/panel/caja").cantidad, 3);
    const tab = (await uno(`select public.admin_tablero() x`)).x;
    assert.ok(tab.necesitan_atencion.some((a) => a.gimnasio_id === t.g && a.tipo === "errores" && /4 errores/.test(a.motivo)));
  });
  await t.falla(() => t.q(`delete from public.errores_app where true`), /no se borran/);
});

test("F2.6 pausa, baja y restauración: el panel queda en solo lectura y se puede volver", async () => {
  await como(admin, async () => {
    assert.equal(await sl(), false);
    await t.falla(() => t.q(`select public.admin_pausar_gimnasio($1, 'no')`, [t.g]), /motivo/);
    await t.q(`select public.admin_pausar_gimnasio($1, 'Pausa por pedido del dueño')`, [t.g]);
    assert.equal(await sl(), true);
    await t.q(`select public.admin_reanudar_gimnasio($1)`, [t.g]);
    assert.equal(await sl(), false);
    await t.q(`select public.admin_dar_de_baja($1, 'Cerró el gimnasio')`, [t.g]);
    assert.equal((await uno(`select jsonb_array_length(public.admin_lista_gimnasios('prueba-sa-f2b')) n`)).n, 0, "la baja sale de la lista");
    assert.equal((await uno(`select jsonb_array_length(public.admin_lista_gimnasios('prueba-sa-f2b', p_con_bajas => true)) n`)).n, 1);
    assert.equal(await sl(), true);
    await t.falla(() => t.q(`select public.admin_reanudar_gimnasio($1)`, [t.g]), /dado de baja/);
    await t.q(`select public.admin_restaurar_baja($1)`, [t.g]);
    assert.equal(await sl(), false);
    await t.q(`update public.gimnasios set baja_en = now() - interval '31 days' where id = $1`, [t.g]);
    await t.falla(() => t.q(`select public.admin_restaurar_baja($1)`, [t.g]), /30 días/);
    await t.q(`update public.gimnasios set baja_en = null, baja_motivo = null, suspension_manual_en = null, suspension_manual_motivo = null where id = $1`, [t.g]);
  });
});

test("F2.6 lista de lanzamiento: marca lo hecho y dice qué falta", async () => {
  await como(admin, async () => {
    const l = (await uno(`select public.admin_lanzamiento($1) x`, [t.g])).x;
    assert.equal(l.length, 7);
    assert.equal(l.find((p) => p.clave === "primer_socio").hecho, true);
    assert.equal(l.find((p) => p.clave === "mercadopago").hecho, false);
    assert.ok(l.filter((p) => !p.hecho).every((p) => p.falta));
  });
});

test("F2.9 demo para una reunión: gimnasio [demo] aparte que vence a los 7 días (se calcula)", async () => {
  await como(admin, async () => {
    const r = (await uno(`select public.admin_crear_demo('Juan Gimnasio Pérez', null, 'base.ejemplo.invalid') r`)).r;
    const g = await uno(`select es_demo, nombre, demo_para from public.gimnasios where id = $1`, [r.gimnasio_id]);
    assert.equal(g.es_demo, true); assert.match(g.nombre, /^\[demo\] /);
    assert.equal((await uno(`select jsonb_array_length(public.admin_demos_vencidas()) n`)).n, 0);
    await t.q(`update public.gimnasios set demo_hasta = now() - interval '1 hour' where id = $1`, [r.gimnasio_id]);
    assert.equal((await uno(`select jsonb_array_length(public.admin_demos_vencidas()) n`)).n, 1);
    assert.equal((await uno(`select public.admin_borrar_demos_vencidas() n`)).n, 1);
    assert.equal((await uno(`select jsonb_array_length(public.admin_demos_vencidas()) n`)).n, 0);
  });
});

test("F2.7 datos personales: exportar y borrar a un socio; el gimnasio se exporta sin claves", async () => {
  await como(uVentas, () => t.falla(() => t.q(`select public.admin_exportar_socio($1, $2)`, [t.g, socio]), /no puede hacer esto/));
  await como(admin, async () => {
    const x = (await uno(`select public.admin_exportar_socio($1, $2) x`, [t.g, socio])).x;
    assert.equal(x.socio.dni, "30111222");
    await t.falla(() => t.q(`select public.admin_borrar_socio($1, $2, 'x')`, [t.g, socio]), /motivo/);
    await t.q(`select public.admin_borrar_socio($1, $2, 'Lo pidió el socio por mail')`, [t.g, socio]);
    const s = await uno(`select nombre, dni, email, telefono, dado_de_baja_en from public.socios where id = $1`, [socio]);
    assert.equal(s.nombre, "Socio borrado"); assert.equal(s.dni, null); assert.equal(s.email, null); assert.equal(s.telefono, null); assert.ok(s.dado_de_baja_en);
    const g = (await uno(`select public.admin_exportar_gimnasio($1) x`, [t.g])).x;
    assert.ok(g.socios.length > 0 && g.pagos && g.ingresos && g.planes);
    assert.ok(!JSON.stringify(g).includes("30111222"));
  });
  const reg = await t.q(`select accion from public.registro_brik where gimnasio_id = $1 and accion in ('exportar_socio','borrar_socio','exportar_gimnasio')`, [t.g]);
  assert.equal(reg.length, 3);
});

test("SA-4 la campana del dueño avisa que BRIK entró y por qué", async () => {
  const c = await como(uDueno, async () => (await uno(`select public.campana_control($1) x`, [t.g])).x);
  const aviso = c.items.find((i) => /BRIK entró a ayudarte/.test(i.titulo));
  assert.ok(aviso, "hay aviso");
  assert.match(aviso.titulo, /como profe/);
  assert.equal(aviso.detalle, "Revisar los planes");
});
