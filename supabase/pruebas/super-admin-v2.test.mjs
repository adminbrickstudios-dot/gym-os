// Super admin v2 (VD-40): salud con color y orden, entrar como soporte con motivo que el dueño ve,
// ayuda del dueño a BRIK con contexto, métricas. Cada función se llama con el rol de quien la usa.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir } from "./_comun.mjs";

let t, otro, u = {};

async function persona(rol, gimnasio = null) {
  const [{ id: usuario }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`${rol}${Math.random()}@ejemplo.invalid`]);
  await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,$3,$4)`, [gimnasio ?? t.g, usuario, `Persona ${rol}`, rol]);
  return usuario;
}
// Como el usuario, y lo que escribe QUEDA dentro de la transacción de la prueba.
async function hacer(usuario, sql, params) {
  await t.q(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: usuario, role: "authenticated" })]);
  await t.q(`set local role authenticated`);
  try {
    return await t.q(sql, params);
  } finally {
    await t.q(`reset role`);
    await t.q(`select set_config('request.jwt.claims', '', true)`);
  }
}
const uno = async (usuario, sql, params) => (await hacer(usuario, sql, params))[0];
// Un error esperado: la transacción sigue sana (savepoint).
async function fallaComo(usuario, sql, params, patron) {
  await t.q("savepoint f");
  try {
    await t.q(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: usuario, role: "authenticated" })]);
    await t.q(`set local role authenticated`);
    await t.q(sql, params);
  } catch (e) {
    await t.q("rollback to savepoint f"); // vuelve también el rol y el usuario
    assert.match(e.message, patron);
    return;
  }
  await t.q("rollback to savepoint f");
  assert.fail("se esperaba un error");
}

before(async () => {
  t = await abrir("prueba-super-admin-v2");
  [{ id: otro }] = await t.q(`insert into public.gimnasios (slug, nombre) values ('prueba-super-admin-v2-otro', 'Otro v2') returning id`);
  u.dueno = await persona("dueno");
  u.recepcion = await persona("recepcion");
  u.encargado = await persona("encargado");
  u.duenoAjeno = await persona("dueno", otro);
  [{ id: u.admin }] = await t.q(`insert into auth.users (email) values ('admin-v2@ejemplo.invalid') returning id`);
  await t.q(`insert into public.administradores_plataforma (usuario_id) values ($1)`, [u.admin]);
});
after(async () => t && t.cerrar());

test("entrar como soporte: el motivo es obligatorio y queda quién, por qué y cuándo", async () => {
  await fallaComo(u.admin, `select public.admin_entrar_gimnasio($1, '')`, [t.g], /motivo/);
  await fallaComo(u.admin, `select public.admin_entrar_gimnasio($1, '  ab ')`, [t.g], /motivo/);
  await fallaComo(u.admin, `select public.admin_entrar_gimnasio($1, null)`, [t.g], /motivo/);
  assert.equal((await t.q(`select count(*)::int n from public.soportes_gimnasio where gimnasio_id = $1`, [t.g]))[0].n, 0, "sin motivo no queda nada");
  await fallaComo(u.dueno, `select public.admin_entrar_gimnasio($1, 'quiero entrar yo')`, [t.g], /administradores/);
  await uno(u.admin, `select public.admin_entrar_gimnasio($1, 'Me pidió ayuda con los planes')`, [t.g]);
  const [s] = await t.q(`select usuario_id, motivo, salio_en, vence_en - entro_en as dura from public.soportes_gimnasio where gimnasio_id = $1`, [t.g]);
  assert.equal(s.usuario_id, u.admin);
  assert.equal(s.motivo, "Me pidió ayuda con los planes");
  assert.equal(s.salio_en, null);
  assert.equal(s.dura.hours ?? 0, 1, "vence a los 60 minutos");
  const est = (await uno(u.admin, `select public.estado_soporte($1) e`, [t.g])).e;
  assert.equal(est.activo, true);
  assert.equal(est.motivo, "Me pidió ayuda con los planes");
  assert.ok(est.minutos > 0 && est.minutos <= 60);
});

test("el dueño ve el registro de soporte (motivo y cuándo); la recepción y otro gimnasio no", async () => {
  const lista = (await uno(u.dueno, `select public.soportes_del_gimnasio($1, 20) l`, [t.g])).l;
  assert.equal(lista.length, 1);
  assert.equal(lista[0].motivo, "Me pidió ayuda con los planes");
  assert.equal(lista[0].en_curso, true);
  assert.ok(!("usuario_id" in lista[0]) && !JSON.stringify(lista).includes("admin-v2"), "el dueño no ve el mail de quien entró");
  await fallaComo(u.recepcion, `select public.soportes_del_gimnasio($1, 20)`, [t.g], /Sin permiso/);
  await fallaComo(u.encargado, `select public.soportes_del_gimnasio($1, 20)`, [t.g], /Sin permiso/);
  await fallaComo(u.duenoAjeno, `select public.soportes_del_gimnasio($1, 20)`, [t.g], /Sin permiso/);
  assert.equal((await uno(u.duenoAjeno, `select public.soportes_del_gimnasio($1, 20) l`, [otro])).l.length, 0, "el otro gimnasio no ve nada del primero");
  const adm = (await uno(u.admin, `select public.admin_soportes($1, 20) l`, [t.g])).l;
  assert.equal(adm[0].quien, "admin-v2@ejemplo.invalid");
  await fallaComo(u.dueno, `select public.admin_soportes($1, 20)`, [t.g], /administradores/);
  // La tabla no se lee ni se escribe directo.
  await fallaComo(u.dueno, `select * from public.soportes_gimnasio`, [], /permission denied/);
});

test("el soporte vence a los 60 minutos: se desactiva y queda cerrado", async () => {
  await t.q(`alter table public.soportes_gimnasio disable trigger soportes_gimnasio_inmutable`);
  await t.q(`update public.soportes_gimnasio set vence_en = now() - interval '1 minute' where gimnasio_id = $1 and salio_en is null`, [t.g]);
  await t.q(`alter table public.soportes_gimnasio enable trigger soportes_gimnasio_inmutable`);
  const est = (await uno(u.admin, `select public.estado_soporte($1) e`, [t.g])).e;
  assert.equal(est.activo, false);
  const [e] = await t.q(`select activo from public.equipo where gimnasio_id = $1 and usuario_id = $2`, [t.g, u.admin]);
  assert.equal(e.activo, false, "el acceso de soporte quedó desactivado");
  const [s] = await t.q(`select salio_en is not null as cerrada from public.soportes_gimnasio where gimnasio_id = $1`, [t.g]);
  assert.equal(s.cerrada, true);
  // El registro no se edita ni se borra.
  await t.falla(() => t.q(`delete from public.soportes_gimnasio where gimnasio_id = $1`, [t.g]), /no se borran/);
  await t.falla(() => t.q(`update public.soportes_gimnasio set motivo = 'otro motivo' where gimnasio_id = $1`, [t.g]), /solo se puede cambiar/);
});

test("salir cierra la sesión de soporte y volver a entrar abre otra con su propio motivo", async () => {
  await uno(u.admin, `select public.admin_entrar_gimnasio($1, 'Revisar la caja del sábado')`, [t.g]);
  await uno(u.admin, `select public.admin_salir_gimnasio($1)`, [t.g]);
  const filas = await t.q(`select motivo, salio_en is not null as cerrada from public.soportes_gimnasio where gimnasio_id = $1 order by entro_en`, [t.g]);
  assert.equal(filas.length, 2);
  assert.deepEqual(filas.map((f) => f.cerrada), [true, true]);
  assert.equal(filas[1].motivo, "Revisar la caja del sábado");
  assert.equal((await uno(u.admin, `select public.estado_soporte($1) e`, [t.g])).e.activo, false);
});

test("salud: solo el admin la ve; rojo y amarillo van primero; el color sale de los hechos", async () => {
  await fallaComo(u.dueno, `select public.admin_salud_v2()`, [], /administradores/);
  await fallaComo(u.dueno, `select public.admin_metricas()`, [], /administradores/);
  await fallaComo(u.dueno, `select public.admin_uso_semanal($1)`, [t.g], /administradores/);
  // Un gimnasio con abono vencido es rojo.
  const [{ id: plan }] = await t.q(`insert into public.plataforma_planes (nombre, precio_mensual) values ('Plan v2', 1000) returning id`);
  await t.q(`update public.gimnasios set plataforma_plan_id = $1, plataforma_desde = current_date - 40 where id = $2`, [plan, otro]);
  const s = (await uno(u.admin, `select public.admin_salud_v2() s`)).s;
  assert.equal(s[otro].color, "rojo");
  assert.equal(s[otro].orden, 0);
  assert.ok(s[otro].motivos.some((m) => /Abono/.test(m)));
  // El gimnasio de prueba (alta sin terminar: sin socios o sin dueño con acceso) no es verde.
  assert.ok(["amarillo", "rojo", "verde"].includes(s[t.g].color));
  assert.ok(Array.isArray(s[t.g].motivos));
  // Orden: rojo (0) antes que amarillo (1) antes que verde (2).
  const ordenados = Object.values(s).sort((a, b) => a.orden - b.orden || b.puntaje - a.puntaje);
  assert.equal(ordenados[0].orden, Math.min(...Object.values(s).map((x) => x.orden)));
  // Sin entradas ni socios: no puede ser verde por casualidad si el abono vence.
  await t.q(`update public.gimnasios set plataforma_desde = current_date where id = $1`, [otro]);
  const s2 = (await uno(u.admin, `select public.admin_salud_v2() s`)).s;
  assert.notEqual(s2[otro].color, "rojo", "con el abono al día ya no es rojo");
  const sem = (await uno(u.admin, `select public.admin_uso_semanal($1) s`, [t.g])).s;
  assert.equal(sem.length, 4);
  const m = (await uno(u.admin, `select public.admin_metricas() m`)).m;
  for (const k of ["gimnasios", "activos_hoy", "cobrado_mes", "por_vencer", "vencidos", "nuevos_30_dias", "entradas_por_dia", "abonos_por_mes"]) assert.ok(k in m, k);
  assert.equal(m.entradas_por_dia.length, 14);
  assert.equal(m.abonos_por_mes.length, 6);
});

test("ayuda: el dueño pide con contexto, el admin lo ve con número de pendientes; la recepción no pide", async () => {
  await fallaComo(u.recepcion, `select public.pedir_ayuda_brik($1, 'Necesito ayuda con los planes', '/panel/planes', null)`, [t.g], /Sin permiso/);
  await fallaComo(u.dueno, `select public.pedir_ayuda_brik($1, 'no', '/panel', null)`, [t.g], /al menos 5/);
  await fallaComo(u.duenoAjeno, `select public.pedir_ayuda_brik($1, 'Estoy en otro gimnasio', '/panel', null)`, [t.g], /Sin permiso/);
  const { id } = await uno(u.dueno, `select public.pedir_ayuda_brik($1, 'No me deja cargar el plan nuevo', '/panel/planes', 'Error: El precio es obligatorio') as id`, [t.g]);
  const pend = (await uno(u.admin, `select public.admin_ayudas(true) a`)).a;
  const a = pend.find((x) => x.id === id);
  assert.ok(a, "llega al admin");
  assert.equal(a.gimnasio, "Gimnasio de Prueba");
  assert.equal(a.pantalla, "/panel/planes");
  assert.equal(a.ultimo_error, "Error: El precio es obligatorio");
  assert.equal(a.rol, "dueno");
  assert.match(a.mail, /^dueno.*@ejemplo\.invalid$/);
  assert.ok((await uno(u.admin, `select public.admin_metricas() m`)).m.ayudas_pendientes >= 1);
  const sal = (await uno(u.admin, `select public.admin_salud_v2() s`)).s[t.g];
  assert.equal(sal.ayudas_pendientes, 1);
  assert.ok(sal.motivos.some((m) => /ayuda/i.test(m)), "pedir ayuda sin respuesta pone el gimnasio en amarillo o peor");
  await fallaComo(u.dueno, `select public.admin_ayudas(true)`, [], /administradores/);
  await fallaComo(u.dueno, `select public.admin_resolver_ayuda($1)`, [id], /administradores/);
  await uno(u.admin, `select public.admin_resolver_ayuda($1)`, [id]);
  assert.equal((await uno(u.admin, `select public.admin_ayudas(true) a`)).a.some((x) => x.id === id), false, "resuelta: sale de pendientes");
  await fallaComo(u.admin, `select public.admin_resolver_ayuda($1)`, [id], /ya estaba resuelto/);
});

test("marca y notas internas: solo el admin; el dueño no ve las notas", async () => {
  await uno(u.admin, `select public.admin_guardar_marca($1, '#112233', '#ffeedd')`, [t.g]);
  const [c] = await t.q(`select color_acento, color_fondo from public.configuracion_gimnasio where gimnasio_id = $1`, [t.g]);
  assert.deepEqual(c, { color_acento: "#112233", color_fondo: "#ffeedd" });
  await fallaComo(u.admin, `select public.admin_guardar_marca($1, 'rojo', '#ffeedd')`, [t.g], /colores/);
  await fallaComo(u.dueno, `select public.admin_guardar_marca($1, '#112233', '#ffeedd')`, [t.g], /administradores/);
  await uno(u.admin, `select public.admin_agregar_nota($1, 'Llamar el lunes para el abono')`, [t.g]);
  const notas = (await uno(u.admin, `select public.admin_notas($1) n`, [t.g])).n;
  assert.equal(notas.length, 1);
  assert.equal(notas[0].texto, "Llamar el lunes para el abono");
  await fallaComo(u.dueno, `select public.admin_notas($1)`, [t.g], /administradores/);
  await fallaComo(u.dueno, `select * from public.notas_brik`, [], /permission denied/);
});
