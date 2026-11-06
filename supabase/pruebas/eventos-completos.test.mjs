// VD-19: eventos completos. Cupo y lista de espera derivada (sin dobles), precio de socio / no socio,
// anotarse desde la app y desde la página, check-in el día del evento, cerrar con asistentes,
// borrador, varias fechas y permisos por rol.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir } from "./_comun.mjs";

let t, u = {}, host, us = {};
async function como(usuario, fn) {
  await t.db.query("set role authenticated");
  await t.q(`select set_config('request.jwt.claims', $1, false)`, [JSON.stringify({ sub: usuario, role: "authenticated" })]);
  try { return await fn(); } finally { await t.db.query("reset role"); await t.q(`select set_config('request.jwt.claims', '', false)`); }
}
async function comoAnon(fn) {
  await t.db.query("set role anon");
  try { return await fn(); } finally { await t.db.query("reset role"); }
}
const panel = async (usuario) => (await como(usuario, () => t.q(`select public.eventos_panel($1) p`, [t.g])))[0].p;
const crear = (usuario, sql, params = []) => como(usuario, async () => (await t.q(sql, [t.g, ...params]))[0].id);

before(async () => {
  t = await abrir("prueba-eventos-completos");
  for (const rol of ["dueno", "encargado", "recepcion"]) {
    const [{ id }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`${rol}${Math.random()}@ejemplo.invalid`]);
    await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,$3,$4)`, [t.g, id, rol, rol]);
    u[rol] = id;
  }
  host = `eventos-completos-${Date.now()}.localhost`;
  await t.q(`insert into public.dominios_gimnasio (gimnasio_id, host, tipo) values ($1, $2, 'subdominio')`, [t.g, host]);
  const n = (await t.q(`update public.landing_gimnasio set publicada = true where gimnasio_id = $1 returning 1`, [t.g])).length;
  if (!n) await t.q(`insert into public.landing_gimnasio (gimnasio_id, publicada) values ($1, true)`, [t.g]);
  let i = 0;
  for (const clave of ["al_dia", "por_vencer", "vencida"]) {
    const [{ id }] = await t.q(`insert into auth.users (phone) values ($1) returning id`, [`+549000099900${++i}`]);
    await t.q(`update public.socios set usuario_id = $2 where id = $1`, [t.ctx.socios[clave], id]);
    us[clave] = id;
  }
});
after(async () => t && t.cerrar());

const S = () => t.ctx.socios;
const inscribir = (clave, ev) => como(us[clave], async () => (await t.q(`select public.inscribirse_evento($1, $2) r`, [S()[clave], ev]))[0].r);

test("crear: validaciones, permisos y datos nuevos", async () => {
  await como(u.dueno, async () => {
    await t.falla(() => t.q(`select public.crear_evento($1, 'Taller', now() + interval '3 days', 10, 5000, null, 'todos', null, '{}', null, null, 6000)`, [t.g]), /precio de socio no puede ser más caro/);
    await t.falla(() => t.q(`select public.crear_evento($1, 'Taller', now() + interval '3 days', 10, 5000, null, 'todos', null, array[now() + interval '1 day']::timestamptz[])`, [t.g]), /después de la primera/);
    await t.falla(() => t.q(`select public.crear_evento($1, 'Taller', now() + interval '3 days', 10, 5000, null, 'todos', now() + interval '2 days')`, [t.g]), /fin tiene que ser después/);
  });
  await como(u.recepcion, () => t.falla(() => t.q(`select public.crear_evento($1, 'Otro', now() + interval '3 days', 2, 0)`, [t.g]), /permiso|rol|acceso/i));
  const ev = await crear(u.dueno, `select public.crear_evento($1, 'Ciclo de movilidad', now() + interval '3 days', 5, 5000, 'Tres encuentros', 'todos', now() + interval '3 days 2 hours',
    array[now() + interval '10 days', now() + interval '17 days']::timestamptz[], 'Sala 2', 'Laura', 3000) id`);
  const e = (await panel(u.recepcion)).find((x) => x.evento_id === ev);
  assert.equal(e.fechas.length, 3, "tres fechas: la primera y dos más, en orden");
  assert.equal(e.lugar, "Sala 2"); assert.equal(e.responsable, "Laura");
  assert.equal(Number(e.precio), 5000); assert.equal(Number(e.precio_socio), 3000);
  assert.equal(e.borrador, false); assert.equal(e.quedan, 5);
});

test("precio de socio y de no socio; anotarse desde la app y desde la página", async () => {
  const ev = await crear(u.dueno, `select public.crear_evento($1, 'Seminario de precio', now() + interval '3 days', 5, 5000, null, 'todos', null, '{}', null, null, 3000) id`);
  const socio = await inscribir("al_dia", ev);
  assert.equal(socio.estado, "anotado"); assert.equal(Number(socio.precio), 3000, "el socio paga el precio de socio");
  const pub = await comoAnon(async () => (await t.q(`select public.inscribirse_evento_publico($1, $2, 'Visitante Uno', '30111222', '+5490001112223') r`, [host, ev]))[0].r);
  assert.equal(pub.estado, "anotado"); assert.equal(Number(pub.precio), 5000, "quien no es socio paga el general");
  const l = await como(us.al_dia, async () => (await t.q(`select public.eventos_socio($1) a`, [S().al_dia]))[0].a.find((x) => x.evento_id === ev));
  assert.equal(l.anotado, true); assert.equal(Number(l.mi_precio), 3000); assert.equal(l.puede_cancelar, true);
  const p = (await panel(u.recepcion)).find((x) => x.evento_id === ev);
  assert.equal(p.anotados.length, 2); assert.equal(p.quedan, 3);
  assert.ok(p.anotados.every((a) => a.pago === false), "ninguno pagó todavía: se cobra en recepción");
  // Datos mal escritos desde la página
  await comoAnon(async () => {
    await t.falla(() => t.q(`select public.inscribirse_evento_publico($1, $2, 'X', '30111223', '+5490001112224')`, [host, ev]), /nombre/);
    await t.falla(() => t.q(`select public.inscribirse_evento_publico($1, $2, 'Visitante Dos', 'abc', '+5490001112224')`, [host, ev]), /DNI/);
    await t.falla(() => t.q(`select public.inscribirse_evento_publico($1, $2, 'Visitante Dos', '30111223', '1234')`, [host, ev]), /teléfono/);
  });
});

test("lista de espera y cupo: sin dobles, la que sigue sube sola, pagar no cuenta dos veces", async () => {
  const ev = await crear(u.dueno, `select public.crear_evento($1, 'Cupo chico', now() + interval '3 days', 2, 4000) id`);
  assert.equal((await inscribir("al_dia", ev)).estado, "anotado");
  assert.equal((await inscribir("al_dia", ev)).estado, "anotado", "anotarse dos veces devuelve lo mismo");
  assert.equal((await t.q(`select count(*)::int n from public.evento_inscripciones where evento_id = $1 and cancelada_en is null`, [ev]))[0].n, 1, "una sola reserva");
  assert.equal((await inscribir("por_vencer", ev)).estado, "anotado");
  const e3 = await inscribir("vencida", ev);
  assert.equal(e3.estado, "espera"); assert.equal(e3.posicion, 1);
  const visita = await comoAnon(async () => (await t.q(`select public.inscribirse_evento_publico($1, $2, 'Visitante Tres', '30222333', '+5490001113334') r`, [host, ev]))[0].r);
  assert.equal(visita.estado, "espera"); assert.equal(visita.posicion, 2);
  // La misma persona otra vez desde la página: no se repite.
  const otra = await comoAnon(async () => (await t.q(`select public.inscribirse_evento_publico($1, $2, 'Visitante Tres', '30222333', '+5490001113334') r`, [host, ev]))[0].r);
  assert.equal(otra.posicion, 2);
  let e = (await panel(u.recepcion)).find((x) => x.evento_id === ev);
  assert.equal(e.quedan, 0); assert.equal(e.en_espera, 2); assert.equal(e.anotados.length, 2);
  // La primera se baja: sube la de la espera, sin que nadie toque nada.
  await como(us.al_dia, () => t.q(`select public.cancelar_inscripcion_evento($1, $2)`, [S().al_dia, ev]));
  e = (await panel(u.recepcion)).find((x) => x.evento_id === ev);
  assert.equal(e.anotados.length, 2); assert.equal(e.en_espera, 1);
  assert.ok(e.anotados.some((a) => a.socio_id === S().vencida), "la de la espera subió");
  assert.equal(e.espera[0].nombre, "Visitante Tres"); assert.equal(e.espera[0].posicion, 1);
  // Quien ya no está no puede bajarse otra vez.
  await como(us.al_dia, () => t.falla(() => t.q(`select public.cancelar_inscripcion_evento($1, $2)`, [S().al_dia, ev]), /No estabas anotado/));
  // Pagar en Vender: la venta reemplaza a la reserva (no cuenta doble) y el cupo no cambia.
  await como(u.recepcion, () => t.q(`select public.vender($1, $2::jsonb, $3::jsonb, $4)`,
    [t.sede, JSON.stringify([{ tipo: "producto", producto_id: e.producto_id }]), JSON.stringify([{ medio: "transferencia", monto: 4000 }]), S().por_vencer]));
  e = (await panel(u.recepcion)).find((x) => x.evento_id === ev);
  const mio = e.anotados.filter((a) => a.socio_id === S().por_vencer);
  assert.equal(mio.length, 1, "pagó y sigue siendo uno solo"); assert.equal(mio[0].pago, true);
  assert.equal(e.anotados.length, 2); assert.equal(e.quedan, 0); assert.equal(e.en_espera, 1);
  // No hay dos reservas activas del mismo socio ni del mismo DNI.
  await t.falla(() => t.q(`insert into public.evento_inscripciones (gimnasio_id, evento_id, socio_id, nombre, origen) values ($1, $2, $3, 'Repetida Doble', 'app')`, [t.g, ev, S().vencida]), /duplicate|unique/i);
  // Sin lista de espera: al llenarse se avisa.
  const sin = await crear(u.dueno, `select public.crear_evento($1, 'Sin espera', now() + interval '3 days', 1, 0, null, 'todos', null, '{}', null, null, null, false, false) id`);
  assert.equal((await inscribir("al_dia", sin)).estado, "anotado");
  await como(us.por_vencer, () => t.falla(() => t.q(`select public.inscribirse_evento($1, $2)`, [S().por_vencer, sin]), /no tiene lista de espera/));
});

test("solo socios, pasados, cerrados y de otro socio", async () => {
  const soloSocios = await crear(u.dueno, `select public.crear_evento($1, 'Solo socios', now() + interval '3 days', 5, 0, null, 'socios') id`);
  await comoAnon(() => t.falla(() => t.q(`select public.inscribirse_evento_publico($1, $2, 'Visitante Cuatro', '30333444', '+5490001114445')`, [host, soloSocios]), /solo para socios/));
  assert.equal((await inscribir("al_dia", soloSocios)).estado, "anotado", "un socio sí");
  // No puede anotar a otro socio.
  await como(us.por_vencer, () => t.falla(() => t.q(`select public.inscribirse_evento($1, $2)`, [S().al_dia, soloSocios]), /Sin permiso/));
  // Anon no entra a lo del equipo ni a la app.
  await comoAnon(async () => {
    await t.falla(() => t.q(`select public.inscribirse_evento($1, $2)`, [S().al_dia, soloSocios]), /permission denied|permiso/i);
    await t.falla(() => t.q(`select public.evento_marcar_presente($1, $2)`, [soloSocios, S().al_dia]), /permission denied|permiso/i);
  });
  // Un socio no lee el panel; la recepción no cierra ni publica.
  await como(us.al_dia, () => t.falla(() => t.q(`select public.eventos_panel($1)`, [t.g]), /permiso|rol|acceso/i));
  await como(u.recepcion, async () => {
    await t.falla(() => t.q(`select public.cerrar_evento($1)`, [soloSocios]), /permiso|rol|acceso/i);
    await t.falla(() => t.q(`select public.publicar_evento($1)`, [soloSocios]), /permiso|rol|acceso/i);
  });
  // Cerrado: nadie se anota.
  await como(u.dueno, () => t.q(`select public.cerrar_evento($1)`, [soloSocios]));
  await como(us.vencida, () => t.falla(() => t.q(`select public.inscribirse_evento($1, $2)`, [S().vencida, soloSocios]), /ya no está abierto/));
});

test("borrador: no se ve ni se vende hasta publicarlo", async () => {
  const ev = await crear(u.dueno, `select public.crear_evento($1, 'Borrador de prueba', now() + interval '3 days', 5, 1000, null, 'todos', null, '{}', null, null, null, true) id`);
  let e = (await panel(u.dueno)).find((x) => x.evento_id === ev);
  assert.equal(e.borrador, true);
  assert.equal((await t.q(`select activo from public.productos where id = $1`, [e.producto_id]))[0].activo, false, "no se vende");
  const visibles = await comoAnon(async () => (await t.q(`select public.eventos_publicos($1) p`, [host]))[0].p);
  assert.equal(visibles.find((x) => x.evento_id === ev), undefined, "la página no lo muestra");
  const deLaApp = await como(us.al_dia, async () => (await t.q(`select public.eventos_socio($1) a`, [S().al_dia]))[0].a);
  assert.equal(deLaApp.find((x) => x.evento_id === ev), undefined, "la app tampoco");
  await como(us.al_dia, () => t.falla(() => t.q(`select public.inscribirse_evento($1, $2)`, [S().al_dia, ev]), /ya no está abierto/));
  await como(u.encargado, () => t.q(`select public.publicar_evento($1)`, [ev]));
  e = (await panel(u.dueno)).find((x) => x.evento_id === ev);
  assert.equal(e.borrador, false);
  assert.equal((await t.q(`select activo from public.productos where id = $1`, [e.producto_id]))[0].activo, true);
  const ahora = await comoAnon(async () => (await t.q(`select public.eventos_publicos($1) p`, [host]))[0].p);
  assert.ok(ahora.find((x) => x.evento_id === ev), "publicado, se ve");
});

test("check-in el día del evento y cerrar con asistentes; cancelar avisa", async () => {
  // Hoy es día del evento (empieza dentro de un segundo; dentro de la transacción now() no avanza).
  const hoy = await crear(u.dueno, `select public.crear_evento($1, 'Clase especial de hoy', now() + interval '1 second', 3, 0) id`);
  const futuro = await crear(u.dueno, `select public.crear_evento($1, 'Taller para dentro de unos días', now() + interval '4 days', 3, 0) id`);
  await inscribir("al_dia", hoy); await inscribir("por_vencer", hoy); await inscribir("vencida", hoy);
  await como(us.al_dia, () => t.q(`select public.inscribirse_evento($1, $2)`, [S().al_dia, futuro]));
  const visita = await comoAnon(async () => (await t.q(`select public.inscribirse_evento_publico($1, $2, 'Visitante Cinco', '30444555', '+5490001115556') r`, [host, hoy]))[0].r);
  assert.equal(visita.estado, "espera", "el cupo era 3: la cuarta persona espera");
  // La ventana de Entrada reconoce al anotado (por socio) y no a los de otros días.
  const delDia = await como(u.recepcion, async () => (await t.q(`select public.eventos_del_dia_socio($1) r`, [S().al_dia]))[0].r);
  assert.equal(delDia.length, 1); assert.equal(delDia[0].evento_id, hoy); assert.equal(delDia[0].presente, false); assert.equal(delDia[0].espera, false);
  // Marcar presente: una vez, y la segunda dice que ya estaba.
  const r1 = await como(u.recepcion, async () => (await t.q(`select public.evento_marcar_presente($1, $2) r`, [hoy, S().al_dia]))[0].r);
  assert.equal(r1.ya_estaba, false); assert.equal(r1.asistieron, 1);
  const r2 = await como(u.recepcion, async () => (await t.q(`select public.evento_marcar_presente($1, $2) r`, [hoy, S().al_dia]))[0].r);
  assert.equal(r2.ya_estaba, true); assert.equal(r2.asistieron, 1);
  assert.equal((await como(u.recepcion, async () => (await t.q(`select public.eventos_del_dia_socio($1) r`, [S().al_dia]))[0].r))[0].presente, true);
  const enEspera = (await panel(u.recepcion)).find((x) => x.evento_id === hoy).espera[0];
  await como(u.recepcion, async () => {
    // El de la espera no tiene lugar; el que no se anotó, tampoco; y un evento de otro día no admite check-in hoy.
    await t.falla(() => t.q(`select public.evento_marcar_presente($1, null, $2)`, [hoy, enEspera.inscripcion_id]), /lista de espera/);
    await t.falla(() => t.q(`select public.evento_marcar_presente($1, $2)`, [hoy, t.ctx.socios.congelada]), /No está anotado/);
    await t.falla(() => t.q(`select public.evento_marcar_presente($1, $2)`, [futuro, S().al_dia]), /Hoy no es un día/);
  });
  // Un anotado por la página (no socio) también se marca, por su reserva.
  await como(us.al_dia, () => t.q(`select public.cancelar_inscripcion_evento($1, $2)`, [S().al_dia, hoy]));
  const e2 = (await panel(u.recepcion)).find((x) => x.evento_id === hoy);
  const subio = e2.anotados.find((a) => a.nombre === "Visitante Cinco");
  assert.ok(subio, "al bajarse uno, subió el de la página");
  const r3 = await como(u.recepcion, async () => (await t.q(`select public.evento_marcar_presente($1, null, $2) r`, [hoy, subio.inscripcion_id]))[0].r);
  assert.equal(r3.ya_estaba, false);
  // Deshacer un error de recepción.
  await como(u.recepcion, async () => {
    await t.q(`select public.evento_quitar_presente($1, null, $2)`, [hoy, subio.inscripcion_id]);
    await t.falla(() => t.q(`select public.evento_quitar_presente($1, null, $2)`, [hoy, subio.inscripcion_id]), /No tenía la presencia/);
    await t.q(`select public.evento_marcar_presente($1, null, $2)`, [hoy, subio.inscripcion_id]);
  });
  // Cerrar: terminado, con el resumen de asistentes.
  await como(u.dueno, () => t.q(`select public.cerrar_evento($1)`, [hoy]));
  const cerrado = (await panel(u.dueno)).find((x) => x.evento_id === hoy);
  assert.equal(cerrado.cerrado, true); assert.equal(cerrado.cerrado_motivo, "terminado"); assert.equal(cerrado.asistieron, 1);
  assert.equal(cerrado.anotados.filter((a) => a.presente).length, 1);
  await como(u.dueno, () => t.falla(() => t.q(`select public.cerrar_evento($1)`, [hoy]), /ya estaba cerrado/));
  // Cancelar un evento futuro: queda "cancelado" y el socio anotado lo ve en la app.
  await como(u.dueno, () => t.q(`select public.cerrar_evento($1)`, [futuro]));
  assert.equal((await panel(u.dueno)).find((x) => x.evento_id === futuro).cerrado_motivo, "cancelado");
  const app = await como(us.al_dia, async () => (await t.q(`select public.eventos_socio($1) a`, [S().al_dia]))[0].a);
  assert.equal(app.find((x) => x.evento_id === futuro)?.cancelado, true, "la app avisa que se canceló");
  assert.equal(app.find((x) => x.evento_id === hoy), undefined);
});
