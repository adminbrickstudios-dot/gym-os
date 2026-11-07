// VD-38 (D27): mensajes de los socios al gimnasio. Un socio no ve los de otro; el dueño y el
// encargado los ven, la recepción solo si el dueño lo prende, el profe nunca; contestar cambia el estado
// y deja el aviso; sin permiso es error (no una lista vacía); la foto va por la ruta que arma la base.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir } from "./_comun.mjs";

let t, u = {}, socioA, socioB, hilo, mensaje;
async function persona(rol, nombre) {
  const [{ id }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`${rol}${Math.random()}@ejemplo.invalid`]);
  await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,$3,$4)`, [t.g, id, nombre, rol]);
  return id;
}
async function socio(nombre) {
  const [{ id }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`s${Math.random()}@ejemplo.invalid`]);
  const [{ id: sid }] = await t.q(`insert into public.socios (gimnasio_id, nombre, apellido, usuario_id) values ($1,$2,'Mensajera',$3) returning id`, [t.g, nombre, id]);
  return { usuario: id, id: sid };
}
before(async () => {
  t = await abrir("prueba-mensajes");
  u.dueno = await persona("dueno", "Sofía");
  u.encargado = await persona("encargado", "Martín");
  u.recepcion = await persona("recepcion", "Ana");
  u.profe = await persona("profe", "Diego");
  socioA = await socio("Lucía");
  socioB = await socio("Bruno");
});
after(async () => t && t.cerrar());
async function como(usuario, fn) {
  await t.db.query("set role authenticated");
  await t.q(`select set_config('request.jwt.claims', $1, false)`, [JSON.stringify({ sub: usuario, role: "authenticated" })]);
  try { return await fn(); } finally { await t.db.query("reset role"); await t.q(`select set_config('request.jwt.claims', '', false)`); }
}
const rpc = async (usuario, sql, args) => como(usuario, async () => (await t.q(`select ${sql} as r`, args))[0].r);

test("el socio escribe: queda un hilo nuevo con su mensaje", async () => {
  const r = await rpc(socioA.usuario, `public.escribir_al_gimnasio($1, 'objeto_perdido', '  Perdí una campera negra  ')`, [socioA.id]);
  hilo = r.hilo_id; mensaje = r.mensaje_id;
  const [h] = await t.q(`select estado, motivo, ultimo_autor from public.hilos_socio where id = $1`, [hilo]);
  assert.deepEqual(h, { estado: "nuevo", motivo: "objeto_perdido", ultimo_autor: "socio" });
  const [m] = await t.q(`select texto, autor from public.mensajes_socio where id = $1`, [mensaje]);
  assert.deepEqual(m, { texto: "Perdí una campera negra", autor: "socio" });
});

test("motivo y texto inválidos son error", async () => {
  await como(socioA.usuario, () => t.falla(() => t.q(`select public.escribir_al_gimnasio($1, 'chisme', 'hola')`, [socioA.id]), /Elegí sobre qué/));
  await como(socioA.usuario, () => t.falla(() => t.q(`select public.escribir_al_gimnasio($1, 'consulta', '   ')`, [socioA.id]), /Escribí tu mensaje/));
  await como(socioA.usuario, () => t.falla(() => t.q(`select public.escribir_al_gimnasio($1, 'consulta', $2)`, [socioA.id, "x".repeat(2001)]), /muy largo/));
});

test("un socio no puede escribir por otro ni ver el hilo de otro", async () => {
  await como(socioB.usuario, () => t.falla(() => t.q(`select public.escribir_al_gimnasio($1, 'consulta', 'me hago pasar')`, [socioA.id]), /Sin permiso/));
  await como(socioB.usuario, () => t.falla(() => t.q(`select public.mi_hilo($1)`, [hilo]), /Sin permiso/));
  await como(socioB.usuario, () => t.falla(() => t.q(`select public.responder_hilo_socio($1, 'intruso')`, [hilo]), /Sin permiso/));
  await como(socioB.usuario, () => t.falla(() => t.q(`select public.mis_mensajes($1)`, [socioA.id]), /Sin permiso/));
  assert.deepEqual(await rpc(socioB.usuario, `public.mis_mensajes($1)`, [socioB.id]), [], "el suyo está vacío (es propio, no ajeno)");
  // Y por la tabla directa (RLS): no ve nada del otro.
  const hilos = await como(socioB.usuario, () => t.q(`select id from public.hilos_socio`));
  assert.equal(hilos.length, 0);
  const msjs = await como(socioB.usuario, () => t.q(`select id from public.mensajes_socio`));
  assert.equal(msjs.length, 0);
  // Y el socio A sí ve el suyo por la tabla.
  const propios = await como(socioA.usuario, () => t.q(`select id from public.hilos_socio`));
  assert.deepEqual(propios.map((x) => x.id), [hilo]);
});

test("nadie escribe directo en las tablas", async () => {
  await como(socioA.usuario, () => t.falla(() => t.q(`insert into public.mensajes_socio (gimnasio_id, hilo_id, autor, texto) values ($1,$2,'socio','directo')`, [t.g, hilo]), /permission denied|denegado/i));
  await como(u.dueno, () => t.falla(() => t.q(`update public.hilos_socio set estado = 'resuelto', resuelto_en = now() where id = $1`, [hilo]), /permission denied|denegado/i));
});

test("dueño y encargado ven la bandeja; la recepción, no, hasta que el dueño lo prende; el profe nunca", async () => {
  for (const rol of ["dueno", "encargado"]) {
    const b = await rpc(u[rol], `public.bandeja_mensajes($1)`, [t.g]);
    assert.equal(b.items.length, 1, rol);
    assert.equal(b.items[0].socio, "Lucía Mensajera");
    assert.equal(b.items[0].sin_responder, true);
    assert.equal(b.conteos.nuevo, 1);
  }
  for (const rol of ["recepcion", "profe"]) {
    await como(u[rol], () => t.falla(() => t.q(`select public.bandeja_mensajes($1)`, [t.g]), /no le dio acceso|Sin permiso/));
    await como(u[rol], () => t.falla(() => t.q(`select public.hilo_mensajes($1)`, [hilo]), /no le dio acceso|Sin permiso/));
    await como(u[rol], () => t.falla(() => t.q(`select public.responder_mensaje($1, 'hola')`, [hilo]), /no le dio acceso|Sin permiso/));
    assert.equal((await como(u[rol], () => t.q(`select id from public.hilos_socio`))).length, 0, `${rol}: RLS no le muestra hilos`);
    assert.equal(await rpc(u[rol], `public.ver_mensajes_equipo($1)`, [t.g]), false);
    assert.equal(await rpc(u[rol], `public.mensajes_sin_responder($1)`, [t.g]), 0, `${rol}: el contador da 0, no rompe`);
  }
  // Solo el dueño decide.
  await como(u.encargado, () => t.falla(() => t.q(`select public.guardar_permisos_mensajes($1, true)`, [t.g]), /Sin permiso/));
  await como(u.recepcion, () => t.falla(() => t.q(`select public.guardar_permisos_mensajes($1, true)`, [t.g]), /Sin permiso/));
  assert.deepEqual(await rpc(u.encargado, `public.permisos_mensajes($1)`, [t.g]), { recepcion_ve: false });
  await rpc(u.dueno, `public.guardar_permisos_mensajes($1, true)`, [t.g]);
  const b = await rpc(u.recepcion, `public.bandeja_mensajes($1)`, [t.g]);
  assert.equal(b.items.length, 1, "con el interruptor prendido la recepción la ve");
  assert.equal((await como(u.recepcion, () => t.q(`select id from public.hilos_socio`))).length, 1);
  assert.equal(await rpc(u.recepcion, `public.ver_mensajes_equipo($1)`, [t.g]), true);
  assert.equal(await rpc(u.recepcion, `public.mensajes_sin_responder($1)`, [t.g]), 1);
  // El profe sigue sin verlos.
  await como(u.profe, () => t.falla(() => t.q(`select public.bandeja_mensajes($1)`, [t.g]), /no le dio acceso|Sin permiso/));
});

test("responder cambia el estado a en curso, queda quién y el socio tiene la respuesta sin leer", async () => {
  const antes = await rpc(socioA.usuario, `public.mensajes_estado_socio($1)`, [socioA.id]);
  assert.deepEqual(antes, { activo: true, sin_leer: 0 });
  const r = await rpc(u.recepcion, `public.responder_mensaje($1, 'Encontramos tu campera, pasá por recepción')`, [hilo]);
  const [h] = await t.q(`select estado, ultimo_autor from public.hilos_socio where id = $1`, [hilo]);
  assert.deepEqual(h, { estado: "en_curso", ultimo_autor: "equipo" });
  const [m] = await t.q(`select m.autor, e.nombre as quien from public.mensajes_socio m join public.equipo e on e.id = m.equipo_id where m.id = $1`, [r.mensaje_id]);
  assert.deepEqual(m, { autor: "equipo", quien: "Ana" });
  assert.equal(await rpc(u.dueno, `public.mensajes_sin_responder($1)`, [t.g]), 0, "contestado: ya no espera respuesta");
  assert.deepEqual(await rpc(socioA.usuario, `public.mensajes_estado_socio($1)`, [socioA.id]), { activo: true, sin_leer: 1 });
  const lista = await rpc(socioA.usuario, `public.mis_mensajes($1)`, [socioA.id]);
  assert.equal(lista[0].sin_leer, true);
  // Al abrir el hilo queda leído.
  const abierto = await rpc(socioA.usuario, `public.mi_hilo($1)`, [hilo]);
  assert.equal(abierto.mensajes.length, 2);
  assert.deepEqual(await rpc(socioA.usuario, `public.mensajes_estado_socio($1)`, [socioA.id]), { activo: true, sin_leer: 0 });
  // Texto vacío: error.
  await como(u.recepcion, () => t.falla(() => t.q(`select public.responder_mensaje($1, '  ')`, [hilo]), /Escribí la respuesta/));
});

test("el aviso por push: una vez por mensaje, al socio la respuesta y al equipo el mensaje nuevo", async () => {
  const [{ id: respuesta }] = await t.q(`select id from public.mensajes_socio where hilo_id = $1 and autor = 'equipo'`, [hilo]);
  await t.q(`insert into public.suscripciones_push (gimnasio_id, usuario_id, endpoint, p256dh, auth, tipos)
             values ($1,$2,'https://push.ejemplo.invalid/socio','p256dh-de-prueba-0000000','auth-de-prueba',array['pagos'])`, [t.g, socioA.usuario]);
  await t.q(`insert into public.suscripciones_push (gimnasio_id, usuario_id, endpoint, p256dh, auth, tipos)
             values ($1,$2,'https://push.ejemplo.invalid/rec','p256dh-de-prueba-0000000','auth-de-prueba',array['comprobantes'])`, [t.g, u.recepcion]);
  const d = (await t.q(`select public.destinos_push_mensajes('mensaje_respuesta', $1) as r`, [respuesta]))[0].r;
  assert.match(d.titulo, /respondió/);
  assert.equal(d.destinos.length, 1);
  assert.equal(d.destinos[0].endpoint, "https://push.ejemplo.invalid/socio");
  assert.equal((await t.q(`select public.destinos_push_mensajes('mensaje_respuesta', $1) as r`, [respuesta]))[0].r, null, "no se manda dos veces");
  // El mensaje del socio avisa al equipo que los ve (recepción prendida) y a nadie más.
  const n = (await t.q(`select public.destinos_push_mensajes('mensaje_nuevo', $1) as r`, [mensaje]))[0].r;
  assert.equal(n.destinos.length, 1);
  assert.equal(n.destinos[0].endpoint, "https://push.ejemplo.invalid/rec");
  // Un evento al revés (la respuesta como "nuevo") no aplica.
  assert.equal((await t.q(`select public.destinos_push_mensajes('mensaje_nuevo', $1) as r`, [respuesta]))[0].r, null);
  // Solo la clave de servicio: el socio no puede pedirlo.
  await como(socioA.usuario, () => t.falla(() => t.q(`select public.destinos_push_mensajes('mensaje_respuesta', $1)`, [respuesta]), /permission denied|denegado/i));
});

test("estados: resolver, volver a abrir; si el socio vuelve a escribir, pasa a nuevo", async () => {
  await rpc(u.encargado, `public.cambiar_estado_hilo($1, 'resuelto')`, [hilo]);
  let [h] = await t.q(`select estado, resuelto_en is not null as con_fecha, resuelto_por is not null as con_quien from public.hilos_socio where id = $1`, [hilo]);
  assert.deepEqual(h, { estado: "resuelto", con_fecha: true, con_quien: true });
  assert.equal((await rpc(u.dueno, `public.bandeja_mensajes($1, 'abiertos')`, [t.g])).items.length, 0);
  assert.equal((await rpc(u.dueno, `public.bandeja_mensajes($1, 'resuelto')`, [t.g])).items.length, 1);
  await como(u.dueno, () => t.falla(() => t.q(`select public.cambiar_estado_hilo($1, 'archivado')`, [hilo]), /no existe/));
  await rpc(socioA.usuario, `public.responder_hilo_socio($1, 'Gracias, paso mañana')`, [hilo]);
  [h] = await t.q(`select estado, ultimo_autor, resuelto_en from public.hilos_socio where id = $1`, [hilo]);
  assert.deepEqual(h, { estado: "nuevo", ultimo_autor: "socio", resuelto_en: null });
  assert.equal(await rpc(u.dueno, `public.mensajes_sin_responder($1)`, [t.g]), 1);
});

test("historial en la ficha: el equipo con permiso lo ve; sin permiso, error", async () => {
  const hist = await rpc(u.dueno, `public.historial_mensajes_socio($1)`, [socioA.id]);
  assert.equal(hist.length, 1);
  assert.equal(hist[0].sin_responder, true);
  assert.deepEqual(await rpc(u.dueno, `public.historial_mensajes_socio($1)`, [socioB.id]), []);
  await como(u.profe, () => t.falla(() => t.q(`select public.historial_mensajes_socio($1)`, [socioA.id]), /no le dio acceso|Sin permiso/));
});

test("la foto: la base arma la ruta del mensaje del socio y solo él la confirma", async () => {
  const ruta = await rpc(socioA.usuario, `public.preparar_foto_mensaje($1, 'jpg')`, [mensaje]);
  assert.match(ruta, new RegExp(`^${t.g}/${hilo}/${mensaje}-[0-9a-f]{32}\\.jpg$`));
  await como(socioB.usuario, () => t.falla(() => t.q(`select public.preparar_foto_mensaje($1, 'jpg')`, [mensaje]), /Sin permiso/));
  await como(socioA.usuario, () => t.falla(() => t.q(`select public.preparar_foto_mensaje($1, 'exe')`, [mensaje]), /JPG, PNG o WEBP/));
  await como(socioA.usuario, () => t.falla(() => t.q(`select public.confirmar_foto_mensaje($1, 'cualquier/cosa.jpg')`, [mensaje]), /Ruta de foto inválida/));
  await rpc(socioA.usuario, `public.confirmar_foto_mensaje($1, $2)`, [mensaje, ruta]);
  await como(socioA.usuario, () => t.falla(() => t.q(`select public.preparar_foto_mensaje($1, 'jpg')`, [mensaje]), /ya tiene su foto/));
  assert.equal(await rpc(u.recepcion, `public.foto_mensaje($1)`, [mensaje]), ruta);
  assert.equal(await rpc(socioA.usuario, `public.foto_mensaje($1)`, [mensaje]), ruta);
  await como(socioB.usuario, () => t.falla(() => t.q(`select public.foto_mensaje($1)`, [mensaje]), /Sin permiso/));
  await como(u.profe, () => t.falla(() => t.q(`select public.foto_mensaje($1)`, [mensaje]), /Sin permiso/));
  // La respuesta del equipo no lleva foto.
  const [{ id: delEquipo }] = await t.q(`select id from public.mensajes_socio where hilo_id = $1 and autor = 'equipo'`, [hilo]);
  await como(socioA.usuario, () => t.falla(() => t.q(`select public.preparar_foto_mensaje($1, 'jpg')`, [delEquipo]), /Sin permiso/));
});

test("respuestas rápidas: dueño y encargado las arman; la recepción con permiso las usa", async () => {
  const antes = await rpc(u.recepcion, `public.respuestas_rapidas($1)`, [t.g]);
  const id = await rpc(u.encargado, `public.guardar_respuesta_rapida($1, null, 'Feriado', 'En feriados abrimos de 10 a 14.')`, [t.g]);
  const despues = await rpc(u.recepcion, `public.respuestas_rapidas($1)`, [t.g]);
  assert.equal(despues.length, antes.length + 1);
  await rpc(u.dueno, `public.guardar_respuesta_rapida($1, $2, 'Feriado', 'En feriados abrimos de 9 a 13.')`, [t.g, id]);
  assert.equal((await rpc(u.recepcion, `public.respuestas_rapidas($1)`, [t.g])).find((x) => x.id === id).texto, "En feriados abrimos de 9 a 13.");
  await como(u.recepcion, () => t.falla(() => t.q(`select public.guardar_respuesta_rapida($1, null, 'X', 'Y')`, [t.g]), /Sin permiso/));
  await como(u.dueno, () => t.falla(() => t.q(`select public.guardar_respuesta_rapida($1, null, '', 'Y')`, [t.g]), /nombre de la respuesta/));
  await rpc(u.dueno, `public.quitar_respuesta_rapida($1, $2)`, [t.g, id]);
  await como(u.dueno, () => t.falla(() => t.q(`select public.quitar_respuesta_rapida($1, $2)`, [t.g, id]), /ya no existe/));
  await como(u.profe, () => t.falla(() => t.q(`select public.respuestas_rapidas($1)`, [t.g]), /no le dio acceso|Sin permiso/));
});

test("la sección se apaga: el socio ya no puede escribir; lo escrito se conserva", async () => {
  await t.q(`update public.configuracion_gimnasio set secciones_apagadas = array['mensajes'] where gimnasio_id = $1`, [t.g]);
  assert.equal((await rpc(socioA.usuario, `public.mensajes_estado_socio($1)`, [socioA.id])).activo, false);
  await como(socioA.usuario, () => t.falla(() => t.q(`select public.escribir_al_gimnasio($1, 'consulta', 'hola')`, [socioA.id]), /no recibe mensajes/));
  assert.equal((await rpc(u.dueno, `public.bandeja_mensajes($1, null)`, [t.g])).items.length, 1);
  await t.q(`update public.configuracion_gimnasio set secciones_apagadas = '{}' where gimnasio_id = $1`, [t.g]);
});

test("otro gimnasio no ve ni cuenta nada de este", async () => {
  const [{ id: g2 }] = await t.q(`insert into public.gimnasios (slug, nombre) values ('prueba-mensajes-2', 'Otro gimnasio') returning id`);
  const [{ id: uExtra }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`dueno2${Math.random()}@ejemplo.invalid`]);
  await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,'Dueño 2','dueno')`, [g2, uExtra]);
  await como(uExtra, () => t.falla(() => t.q(`select public.bandeja_mensajes($1)`, [t.g]), /Sin permiso/));
  assert.equal((await como(uExtra, () => t.q(`select id from public.hilos_socio`))).length, 0);
  assert.equal((await rpc(uExtra, `public.bandeja_mensajes($1)`, [g2])).items.length, 0);
});
