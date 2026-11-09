// BASE-8 (migración 202611090400): tope de formularios públicos y Ley 25.326 (política, consentimiento, pedidos de datos).
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir } from "./_comun.mjs";

let t, dueno, recepcion, socioUsuario, socioId, otroSocio;
before(async () => {
  t = await abrir("prueba-topes-datos");
  for (const rol of ["dueno", "recepcion"]) {
    const [{ id }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`${rol}${Math.random()}@ejemplo.invalid`]);
    await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,$3,$4)`, [t.g, id, rol, rol]);
    if (rol === "dueno") dueno = id; else recepcion = id;
  }
  [{ id: socioUsuario }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`soc${Math.random()}@ejemplo.invalid`]);
  [{ id: socioId }] = await t.q(`insert into public.socios (gimnasio_id, nombre, apellido, telefono, usuario_id) values ($1,'Pedro','Datos','+5490000111222',$2) returning id`, [t.g, socioUsuario]);
  [{ id: otroSocio }] = await t.q(`insert into public.socios (gimnasio_id, nombre, apellido, telefono) values ($1,'Otra','Persona','+5490000333444') returning id`, [t.g]);
});
after(async () => t && t.cerrar());
const servidor = async (fn) => {
  await t.db.query("savepoint s1");
  await t.db.query("set local role service_role");
  await t.q(`select set_config('request.jwt.claims', '{"role":"service_role"}', true)`);
  try { return await fn(); } finally { await t.db.query("reset role"); await t.db.query("release savepoint s1"); }
};

test("formularios públicos: 10 por conexión y 3 por persona por hora; guarda el hash; solo el servidor", async () => {
  await servidor(async () => {
    for (let i = 0; i < 3; i++) await t.q(`select public.registrar_envio_publico('alta_online', '10.9.0.1', '30111222')`);
    await t.falla(() => t.q(`select public.registrar_envio_publico('alta_online', '10.9.0.2', '30111222')`), /varias veces/);
    for (let i = 0; i < 7; i++) await t.q(`select public.registrar_envio_publico('alta_online', '10.9.0.1', $1)`, [`dni-${i}`]);
    await t.falla(() => t.q(`select public.registrar_envio_publico('alta_online', '10.9.0.1', 'otro')`), /esta conexión/);
    await t.q(`select public.registrar_envio_publico('consulta', '10.9.0.1', 'otro')`);   // otro formulario, otro contador
    await t.falla(() => t.q(`select public.registrar_envio_publico('inventado', '10.9.0.9', null)`), /desconocido/);
  });
  const [{ n }] = await t.q(`select count(*)::int n from public.envios_publicos where clave_hash = '30111222'`);
  assert.equal(n, 0, "no se guarda el DNI, solo el hash");
  await t.comoUsuario(socioUsuario, () => t.falla(() => t.q(`select public.registrar_envio_publico('consulta', null, null)`), /permission denied|servidor/));
  await t.comoUsuario(socioUsuario, () => t.falla(() => t.q(`select * from public.envios_publicos`), /permission denied/));
});

test("política de privacidad: solo el dueño la escribe; la página la lee sin sesión", async () => {
  const texto = "Guardamos tu nombre, DNI y teléfono para darte el acceso al gimnasio. Podés pedir verlos, corregirlos o borrarlos desde tu app.";
  await t.comoUsuario(recepcion, () => t.falla(() => t.q(`select public.guardar_politica_privacidad($1, $2)`, [t.g, texto]), /Sin permiso/));
  await t.q(`insert into public.dominios_gimnasio (gimnasio_id, host, tipo) values ($1, 'datos.ejemplo.invalid', 'subdominio') on conflict do nothing`, [t.g]);
  let p;
  await t.comoUsuario(dueno, async () => {
    await t.falla(() => t.q(`select public.guardar_politica_privacidad($1, 'corta')`, [t.g]), /muy corta/);
    await t.q(`select public.guardar_politica_privacidad($1, $2)`, [t.g, texto]);
    await t.db.query("reset role"); await t.db.query("set local role anon");   // la página, sin sesión
    [{ p }] = await t.q(`select public.politica_privacidad_publica('datos.ejemplo.invalid') p`);
  });
  assert.equal(p.texto, texto);
});

test("consentimiento: aceptar el reglamento lo anota en el socio, una sola vez", async () => {
  const [{ id: r }] = await t.q(`insert into public.reglamentos (gimnasio_id, version, texto) values ($1, 1, 'Reglas del gimnasio: respetar los horarios y cuidar el equipo. Texto de prueba suficientemente largo.') returning id`, [t.g]);
  const [{ c }] = await t.q(`select consentimiento_datos_en c from public.socios where id = $1`, [socioId]);
  assert.equal(c, null);
  await t.q(`insert into public.aceptaciones_reglamento (gimnasio_id, socio_id, reglamento_id) values ($1,$2,$3)`, [t.g, socioId, r]);
  const [{ c: c2 }] = await t.q(`select consentimiento_datos_en c from public.socios where id = $1`, [socioId]);
  assert.ok(c2, "quedó anotado");
});

test("pedidos de datos: el socio pide los suyos (no los de otro) y no repite", async () => {
  await t.comoUsuario(socioUsuario, async () => {
    await t.falla(() => t.q(`select public.pedir_mis_datos($1, 'borrar')`, [otroSocio]), /Sin permiso/);
    await t.falla(() => t.q(`select public.pedir_mis_datos($1, 'corregir', 'x')`, [socioId]), /qué dato/);
    await t.q(`select public.pedir_mis_datos($1, 'borrar', 'Me mudé de ciudad')`, [socioId]);
    await t.falla(() => t.q(`select public.pedir_mis_datos($1, 'borrar')`, [socioId]), /Ya hiciste/);
    const mios = await t.q(`select tipo from public.pedidos_datos`);
    assert.deepEqual(mios.map((x) => x.tipo), ["borrar"]);
  });
});

test("pedidos de datos: la recepción no los ve; el dueño los lista y los resuelve una sola vez", async () => {
  await t.q(`insert into public.pedidos_datos (gimnasio_id, socio_id, tipo, detalle) values ($1,$2,'borrar','Me mudé')`, [t.g, socioId]);
  await t.comoUsuario(recepcion, () => t.falla(() => t.q(`select public.pedidos_datos_panel($1)`, [t.g]), /Sin permiso/));
  await t.comoUsuario(dueno, async () => {
    const [{ l }] = await t.q(`select public.pedidos_datos_panel($1) l`, [t.g]);
    assert.equal(l.length, 1);
    assert.equal(l[0].socio, "Pedro Datos");
    await t.falla(() => t.q(`select public.resolver_pedido_datos($1, '')`, [l[0].id]), /Escribí qué se hizo/);
    await t.q(`select public.resolver_pedido_datos($1, 'Se dio de baja y se anonimizó')`, [l[0].id]);
    await t.falla(() => t.q(`select public.resolver_pedido_datos($1, 'otra vez')`, [l[0].id]), /ya está resuelto/);
  });
});
