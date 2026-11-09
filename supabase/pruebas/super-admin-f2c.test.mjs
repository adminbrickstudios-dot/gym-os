// Carril B · F2 (tercera parte): novedades por destino, mantenimiento, prueba y descuentos, plataforma, papelera, clonar, borrado y webhooks.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir } from "./_comun.mjs";

let t, admin, uVentas, uSoporte, uDueno, eDueno;
async function como(usuario, fn) {
  await t.db.query("set role authenticated");
  await t.q(`select set_config('request.jwt.claims', $1, false)`, [JSON.stringify({ sub: usuario, role: "authenticated" })]);
  try { return await fn(); } catch (e) { console.log("INTERNO", e.message); throw e; } finally { await t.db.query("reset role"); await t.q(`select set_config('request.jwt.claims', '', false)`); }
}
const uno = async (sql, p) => (await t.q(sql, p))[0];
const mk = async (pref) => (await uno(`insert into auth.users (email) values ($1) returning id, email`, [`${pref}${Math.random().toString().slice(2)}@ejemplo.invalid`]));

before(async () => {
  t = await abrir("prueba-sa-f2c");
  admin = (await mk("principal")).id;
  await t.q(`insert into public.administradores_plataforma (usuario_id) values ($1)`, [admin]);
  const v = await mk("ventas"), s = await mk("soporte"), d = await mk("dueno");
  uVentas = v.id; uSoporte = s.id; uDueno = d.id;
  eDueno = (await uno(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,'Dueña','dueno') returning id`, [t.g, uDueno])).id;
  for (const [u, rol] of [[v, "ventas"], [s, "soporte"]]) await como(admin, () => t.q(`select public.admin_dar_rol_brik($1, $2)`, [u.email, rol]));
});
after(async () => t && t.cerrar());

test("SA-8 novedades: llegan solo a quien corresponde (ciudad y módulo), con historial y conteo", async () => {
  await t.q(`update public.configuracion_gimnasio set ciudad = 'Rosario' where gimnasio_id = $1`, [t.g]);
  await como(uVentas, async () => {
    await t.q(`select public.admin_publicar_novedad('Para todos', 'Una novedad general para todos los gimnasios')`);
    await t.q(`select public.admin_publicar_novedad('Solo Rosario', 'Una novedad solo para Rosario', null, null, 'rosario')`);
    await t.q(`select public.admin_publicar_novedad('Solo Córdoba', 'Una novedad solo para Córdoba', null, null, 'Córdoba')`);
    await t.q(`select public.admin_publicar_novedad('Con Clases', 'Una novedad solo para quienes usan Clases', null, null, null, 'clases')`);
    await t.falla(() => t.q(`select public.admin_publicar_novedad('Mal módulo', 'Una novedad con módulo que no existe', null, null, null, 'inventado')`), /no existe/);
  });
  const titulos = async () => (await como(uDueno, async () => (await uno(`select public.novedades_dueno($1) x`, [t.g])).x)).map((n) => n.titulo).sort();
  assert.deepEqual(await titulos(), ["Con Clases", "Para todos", "Solo Rosario"]);
  await t.q(`update public.configuracion_gimnasio set secciones_apagadas = array['clases'] where gimnasio_id = $1`, [t.g]);
  assert.deepEqual(await titulos(), ["Para todos", "Solo Rosario"]);
  const h = await como(uDueno, async () => (await uno(`select public.novedades_historial($1) x`, [t.g])).x);
  assert.equal(h.length, 2);
  const lista = await como(uSoporte, async () => (await uno(`select public.admin_novedades() x`)).x);
  const cba = lista.find((n) => n.titulo === "Solo Córdoba");
  assert.equal(cba.alcanza, 0, "no le toca a ningún gimnasio de la prueba");
  assert.ok(lista.find((n) => n.titulo === "Para todos").alcanza >= 1);
  await como(uSoporte, () => t.falla(() => t.q(`select public.admin_publicar_novedad('No puede', 'Soporte no publica novedades')`), /no puede hacer esto/));
});

test("SA-8 mantenimiento: lo programa el principal y lo ve cualquiera mientras esté cerca", async () => {
  await como(uVentas, () => t.falla(() => t.q(`select public.admin_programar_mantenimiento(now() + interval '1 hour', now() + interval '2 hours', 'Mantenimiento de la base')`), /no puede hacer esto/));
  const id = await como(admin, async () => {
    await t.falla(() => t.q(`select public.admin_programar_mantenimiento(now() + interval '2 hours', now() + interval '1 hour', 'Mantenimiento de la base')`), /después/);
    return (await uno(`select public.admin_programar_mantenimiento(now() + interval '1 hour', now() + interval '2 hours', 'Mantenimiento de la base') id`)).id;
  });
  await t.db.query("set role anon");
  const v = (await uno(`select public.mantenimiento_vigente() x`)).x;
  await t.db.query("reset role");
  assert.equal(v.texto, "Mantenimiento de la base"); assert.equal(v.ahora, false);
  await como(admin, () => t.q(`select public.admin_cancelar_mantenimiento($1)`, [id]));
  assert.equal((await uno(`select public.mantenimiento_vigente() x`)).x, null);
});

test("SA-7 prueba gratis y descuentos: se calculan sobre el abono", async () => {
  await como(admin, async () => {
    const plan = (await uno(`select public.admin_guardar_plan_brik(null, 'Plan F2c', 40000) id`)).id;
    await t.q(`select public.admin_asignar_plan_brik($1, $2)`, [t.g, plan]);
  });
  const abono = async () => (await uno(`select privado.estado_abono($1) x`, [t.g])).x;
  let a = await abono();
  assert.equal(a.en_prueba, true); assert.equal(a.dias, 14);
  await como(uVentas, async () => {
    await t.falla(() => t.q(`select public.admin_guardar_prueba($1, 120)`, [t.g]), /0 a 90/);
    await t.q(`select public.admin_guardar_prueba($1, 30)`, [t.g]);
  });
  a = await abono(); assert.equal(a.dias, 30);
  await como(uVentas, async () => {
    await t.falla(() => t.q(`select public.admin_guardar_descuento($1, 20, 'x', current_date + 30)`, [t.g]), /motivo/);
    await t.falla(() => t.q(`select public.admin_guardar_descuento($1, 20, 'Amigo de la casa', current_date - 1)`, [t.g]), /fecha/);
    await t.q(`select public.admin_guardar_descuento($1, 25, 'Amigo de la casa', current_date + 60)`, [t.g]);
  });
  a = await abono();
  assert.equal(Number(a.precio_con_descuento), 30000); assert.equal(Number(a.descuento.porcentaje), 25); assert.equal(Number(a.precio_mensual), 40000);
  await como(uVentas, () => t.q(`select public.admin_quitar_descuento($1)`, [t.g]));
  a = await abono(); assert.equal(a.descuento, null); assert.equal(Number(a.precio_con_descuento), 40000);
  await como(uVentas, async () => {
    await t.falla(() => t.q(`select public.admin_guardar_link_pago('http://inseguro')`), /https/);
    await t.q(`select public.admin_guardar_link_pago('https://pago.ejemplo.invalid/brik')`);
    assert.equal((await uno(`select public.admin_link_pago() x`)).x, "https://pago.ejemplo.invalid/brik");
  });
});

test("SA-9 plataforma: estado, uso por gimnasio y funciones a prueba", async () => {
  await como(uSoporte, async () => {
    const e = (await uno(`select public.admin_plataforma_estado() x`)).x;
    assert.ok(e.migraciones > 50); assert.ok(e.ultima_migracion);
    const uso = (await uno(`select public.admin_uso_gimnasios() x`)).x.find((g) => g.gimnasio_id === t.g);
    assert.ok(uso.socios > 0); assert.equal(typeof uso.ingresos_30_dias, "number");
    await t.falla(() => t.q(`select public.admin_prender_funcion($1, 'tv_nueva', true)`, [t.g]), /no puede hacer esto/);
  });
  await como(admin, async () => {
    await t.falla(() => t.q(`select public.admin_prender_funcion($1, 'Mala Clave', true)`, [t.g]), /clave/);
    await t.q(`select public.admin_prender_funcion($1, 'tv_nueva', true)`, [t.g]);
  });
  assert.equal(await como(uDueno, async () => (await uno(`select public.funcion_prendida($1, 'tv_nueva') x`, [t.g])).x), true);
  assert.equal(await como(uDueno, async () => (await uno(`select public.funcion_prendida($1, 'otra') x`, [t.g])).x), false);
  await como(admin, () => t.q(`select public.admin_prender_funcion($1, 'tv_nueva', false)`, [t.g]));
  assert.equal(await como(uDueno, async () => (await uno(`select public.funcion_prendida($1, 'tv_nueva') x`, [t.g])).x), false);
});

test("SA-6 papelera: restaurar un socio dado de baja y un plan archivado (30 días)", async () => {
  const s = (await uno(`insert into public.socios (gimnasio_id, nombre, apellido, dado_de_baja_en, motivo_baja) values ($1,'Beto','Papelera', now() - interval '2 days', 'otro') returning id`, [t.g])).id;
  const vieja = (await uno(`insert into public.socios (gimnasio_id, nombre, apellido, dado_de_baja_en, motivo_baja) values ($1,'Vieja','Baja', now() - interval '40 days', 'otro') returning id`, [t.g])).id;
  const plan = (await uno(`select id from public.planes where gimnasio_id = $1 limit 1`, [t.g])).id;
  await t.q(`update public.planes set activo = false where id = $1`, [plan]);
  await como(uSoporte, async () => {
    const p = (await uno(`select public.admin_papelera($1) x`, [t.g])).x;
    assert.ok(p.socios.some((x) => x.id === s)); assert.ok(!p.socios.some((x) => x.id === vieja), "pasados los 30 días ya no");
    assert.ok(p.planes.some((x) => x.id === plan));
    await t.q(`select public.admin_restaurar_socio($1, $2)`, [t.g, s]);
    await t.falla(() => t.q(`select public.admin_restaurar_socio($1, $2)`, [t.g, vieja]), /papelera/);
    await t.q(`select public.admin_restaurar_plan($1, $2)`, [t.g, plan]);
  });
  assert.equal((await uno(`select dado_de_baja_en from public.socios where id = $1`, [s])).dado_de_baja_en, null);
  assert.equal((await uno(`select activo from public.planes where id = $1`, [plan])).activo, true);
});

test("SA-6 clonar la configuración: planes con precio y actividades, sin socios; solo a un gimnasio sin planes", async () => {
  const dest = (await uno(`insert into public.gimnasios (slug, nombre) values ('clon-f2c', 'Clon') returning id`)).id;
  const antes = (await uno(`select count(*)::int n from public.planes where gimnasio_id = $1 and activo`, [t.g])).n;
  assert.ok(antes > 0);
  await como(uSoporte, () => t.falla(() => t.q(`select public.admin_clonar_configuracion($1, $2)`, [t.g, dest]), /no puede hacer esto/));
  const r = await como(admin, async () => {
    await t.falla(() => t.q(`select public.admin_clonar_configuracion($1, $1)`, [t.g]), /mismo/);
    const x = (await uno(`select public.admin_clonar_configuracion($1, $2) x`, [t.g, dest])).x;
    await t.falla(() => t.q(`select public.admin_clonar_configuracion($1, $2)`, [t.g, dest]), /ya tiene planes/);
    return x;
  });
  assert.equal(r.planes, antes);
  assert.equal((await uno(`select count(*)::int n from public.socios where gimnasio_id = $1`, [dest])).n, 0);
  const sinPrecio = (await uno(`select count(*)::int n from public.planes p where p.gimnasio_id = $1 and not exists (select 1 from public.precios_plan x where x.plan_id = p.id)`, [dest])).n;
  assert.equal(sinPrecio, (await uno(`select count(*)::int n from public.planes p where p.gimnasio_id = $1 and activo and not exists (select 1 from public.precios_plan x where x.plan_id = p.id)`, [t.g])).n);
});

test("SA-6 borrado definitivo = anonimizar: solo el principal, con 30 días de baja y el nombre escrito", async () => {
  const g = (await uno(`insert into public.gimnasios (slug, nombre) values ('borrar-f2c', 'Gimnasio A Borrar') returning id`)).id;
  await t.q(`insert into public.socios (gimnasio_id, nombre, apellido, dni, email) values ($1,'Carla','Datos','28111222','carla@ejemplo.invalid')`, [g]);
  await t.q(`insert into public.dominios_gimnasio (gimnasio_id, host, tipo) values ($1, 'borrar-f2c.ejemplo.invalid', 'subdominio')`, [g]);
  await como(uSoporte, () => t.falla(() => t.q(`select public.admin_borrar_definitivo($1, 'Gimnasio A Borrar')`, [g]), /no puede hacer esto/));
  await como(admin, async () => {
    await t.falla(() => t.q(`select public.admin_borrar_definitivo($1, 'Gimnasio A Borrar')`, [g]), /dado de baja hace más de 30/);
    await t.q(`select public.admin_dar_de_baja($1, 'Cerró el gimnasio')`, [g]);
    await t.falla(() => t.q(`select public.admin_borrar_definitivo($1, 'Gimnasio A Borrar')`, [g]), /dado de baja hace más de 30/);
  });
  await t.q(`update public.gimnasios set baja_en = now() - interval '31 days' where id = $1`, [g]);
  await como(admin, async () => {
    await t.falla(() => t.q(`select public.admin_borrar_definitivo($1, 'otro nombre')`, [g]), /exactamente/);
    const r = (await uno(`select public.admin_borrar_definitivo($1, 'Gimnasio A Borrar') x`, [g])).x;
    assert.equal(r.socios, 1);
    await t.falla(() => t.q(`select public.admin_borrar_definitivo($1, 'Gimnasio borrado')`, [g]), /ya fue borrado/);
  });
  const s = await uno(`select nombre, dni, email from public.socios where gimnasio_id = $1`, [g]);
  assert.deepEqual(s, { nombre: "Socio borrado", dni: null, email: null });
  const gim = await uno(`select nombre, borrado_en is not null as borrado from public.gimnasios where id = $1`, [g]);
  assert.deepEqual(gim, { nombre: "Gimnasio borrado", borrado: true });
  assert.equal((await uno(`select count(*)::int n from public.dominios_gimnasio where gimnasio_id = $1`, [g])).n, 0);
});

test("Webhooks: leer un evento fallido para reprocesarlo; uno procesado o ajeno no", async () => {
  const w = (await uno(`insert into public.eventos_webhook (origen, tipo, id_externo, gimnasio_id, error, payload) values ('mp_cobros','payment','123:lectura',$1,'no se pudo leer','{"data":{"id":"123"}}') returning id`, [t.g])).id;
  const ok = (await uno(`insert into public.eventos_webhook (origen, tipo, id_externo, gimnasio_id, procesado_en) values ('mp_cobros','payment','124:approved',$1, now()) returning id`, [t.g])).id;
  await como(uVentas, () => t.falla(() => t.q(`select public.admin_evento_webhook($1)`, [w]), /no puede hacer esto/));
  await como(uSoporte, async () => {
    const e = (await uno(`select public.admin_evento_webhook($1) x`, [w])).x;
    assert.equal(e.gimnasio_id, t.g); assert.equal(e.id_externo, "123:lectura");
    await t.falla(() => t.q(`select public.admin_evento_webhook($1)`, [ok]), /no está fallido/);
  });
  assert.equal((await uno(`select count(*)::int n from public.registro_brik where accion = 'reprocesar_webhook'`)).n, 1);
});
