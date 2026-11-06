// VD-20: biblioteca con equipo, plantillas (copiar sin tocar la original), asignar una rutina a varios socios,
// "la de hoy" calculada, marcar lo hecho (uno por día), y lo que ve el profe: quién la hizo.
// Un socio ve solo lo suyo; la recepción no toca rutinas.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir } from "./_comun.mjs";

let t, u = {}, us = {}, sentadilla, remo, rutina;
async function como(usuario, fn) {
  await t.db.query("set role authenticated");
  await t.q(`select set_config('request.jwt.claims', $1, false)`, [JSON.stringify({ sub: usuario, role: "authenticated" })]);
  try { return await fn(); } finally { await t.db.query("reset role"); await t.q(`select set_config('request.jwt.claims', '', false)`); }
}
const hoy = async () => (await t.q(`select to_char((now() at time zone $1::text)::date, 'YYYY-MM-DD') d`, [t.ctx.zona]))[0].d;
const S = () => t.ctx.socios;

before(async () => {
  t = await abrir("prueba-rutinas-completas");
  for (const rol of ["profe", "recepcion"]) {
    const [{ id }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`${rol}${Math.random()}@ejemplo.invalid`]);
    await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,$3,$4)`, [t.g, id, rol, rol]);
    u[rol] = id;
  }
  let i = 0;
  for (const clave of ["al_dia", "por_vencer", "vencida"]) {
    const [{ id }] = await t.q(`insert into auth.users (phone) values ($1) returning id`, [`+549000077700${++i}`]);
    await t.q(`update public.socios set usuario_id = $2 where id = $1`, [S()[clave], id]);
    us[clave] = id;
  }
  // Un socio dado de baja: la asignación lo saltea.
  await t.q(`update public.socios set dado_de_baja_en = now(), motivo_baja = 'otro' where id = $1`, [S().pack_vencido]);
});
after(async () => t && t.cerrar());

test("biblioteca: equipo para filtrar; recepción no la toca", async () => {
  await como(u.profe, async () => {
    sentadilla = (await t.q(`select public.guardar_ejercicio($1, null, 'Sentadilla', 'piernas', null, true, 'barra') id`, [t.g]))[0].id;
    remo = (await t.q(`select public.guardar_ejercicio($1, null, 'Remo con mancuerna', 'espalda', null, true, 'mancuernas') id`, [t.g]))[0].id;
    await t.falla(() => t.q(`select public.guardar_ejercicio($1, null, 'Plancha', 'core', null, true, 'cualquiera')`, [t.g]), /equipo/);
    const [{ l }] = await t.q(`select public.ejercicios_gimnasio($1) l`, [t.g]);
    assert.deepEqual(l.map((e) => [e.nombre, e.equipo]).sort(), [["Remo con mancuerna", "mancuernas"], ["Sentadilla", "barra"]]);
    // La firma vieja (sin equipo) sigue andando: el equipo queda en "otro".
    const viejo = (await t.q(`select public.guardar_ejercicio($1, null, 'Plancha', 'core') id`, [t.g]))[0].id;
    assert.equal((await t.q(`select equipo from public.ejercicios where id = $1`, [viejo]))[0].equipo, "otro");
  });
  await como(u.recepcion, () => t.falla(() => t.q(`select public.guardar_ejercicio($1, null, 'Press', 'pecho', null, true, 'barra')`, [t.g]), /permiso|rol|acceso/i));
});

test("plantilla: se copia y la copia se edita sin tocar la original", async () => {
  await como(u.profe, async () => {
    const items = [{ dia: 1, ejercicio_id: sentadilla, series: 4, repeticiones: "8-10" }, { dia: 1, ejercicio_id: remo, series: 3, repeticiones: "12" },
                   { dia: 2, ejercicio_id: remo, series: 5, repeticiones: "5" }];
    rutina = (await t.q(`select public.guardar_rutina($1, null, 'Fuerza 2 días', null, $2) id`, [t.g, JSON.stringify(items)]))[0].id;
    await t.q(`select public.marcar_plantilla($1, true)`, [rutina]);
    await t.falla(() => t.q(`select public.marcar_plantilla($1, true)`, [rutina]), /ya estaba/);
    const copia = (await t.q(`select public.copiar_rutina($1, 'Fuerza de Ana') id`, [rutina]))[0].id;
    assert.notEqual(copia, rutina);
    const [{ l }] = await t.q(`select public.rutinas_gimnasio($1) l`, [t.g]);
    const o = l.find((r) => r.id === rutina), c = l.find((r) => r.id === copia);
    assert.equal(o.plantilla, true); assert.equal(c.plantilla, false);
    assert.equal(c.ejercicios, 3); assert.equal(c.dias, 2); assert.equal(c.nombre, "Fuerza de Ana");
    // Editar la copia deja la plantilla como estaba.
    await t.q(`select public.guardar_rutina($1, $2, 'Fuerza de Ana', null, $3)`, [t.g, copia, JSON.stringify([items[0]])]);
    const [{ l: l2 }] = await t.q(`select public.rutinas_gimnasio($1) l`, [t.g]);
    assert.equal(l2.find((r) => r.id === rutina).ejercicios, 3, "la plantilla no cambió");
    assert.equal(l2.find((r) => r.id === copia).ejercicios, 1);
  });
  await como(u.recepcion, () => t.falla(() => t.q(`select public.copiar_rutina($1, 'x')`, [rutina]), /permiso|rol|acceso/i));
});

test("asignar a varios: una rutina activa por socio, los dados de baja se saltean, fecha de cambio", async () => {
  await como(u.recepcion, () => t.falla(() => t.q(`select public.asignar_rutina_varios($1, array[$2]::uuid[])`, [rutina, S().al_dia]), /permiso|rol|acceso/i));
  await como(u.profe, async () => {
    await t.falla(() => t.q(`select public.asignar_rutina_varios($1, '{}'::uuid[])`, [rutina]), /al menos un socio/);
    await t.falla(() => t.q(`select public.asignar_rutina_varios($1, array[$2]::uuid[], (now() at time zone $3::text)::date - 1)`, [rutina, S().al_dia, t.ctx.zona]), /anterior a hoy/);
    const [{ r }] = await t.q(`select public.asignar_rutina_varios($1, array[$2::uuid, $3::uuid, $4::uuid, $5::uuid, $2::uuid], (now() at time zone $6::text)::date) r`,
      [rutina, S().al_dia, S().por_vencer, S().vencida, S().pack_vencido, t.ctx.zona]);
    assert.equal(r.asignados, 3, "tres socios (el repetido cuenta una vez)"); assert.equal(r.omitidos, 1, "el dado de baja se saltea");
    // Volver a asignar cierra la anterior: sigue habiendo una sola activa por socio.
    await t.q(`select public.asignar_rutina_varios($1, array[$2]::uuid[], (now() at time zone $3::text)::date)`, [rutina, S().al_dia, t.ctx.zona]);
    const n = (await t.q(`select count(*)::int n from public.rutinas_socio where socio_id = $1 and quitada_en is null`, [S().al_dia]))[0].n;
    assert.equal(n, 1);
    const [{ l }] = await t.q(`select public.rutinas_gimnasio($1) l`, [t.g]);
    assert.equal(l.find((x) => x.id === rutina).asignados, 3);
  });
});

test("cada socio ve solo la suya; la de hoy se calcula; marcar lo hecho una vez por día", async () => {
  // Un socio no ve la rutina de otro ni marca por otro.
  await como(us.por_vencer, async () => {
    await t.falla(() => t.q(`select public.rutina_de_socio($1)`, [S().al_dia]), /permiso|rol|acceso/i);
    await t.falla(() => t.q(`select public.marcar_dia_rutina($1, 1)`, [S().al_dia]), /permiso|rol|acceso/i);
  });
  // Al principio le toca el Día 1.
  const antes = await como(us.al_dia, async () => (await t.q(`select public.rutina_de_socio($1) r`, [S().al_dia]))[0].r);
  assert.equal(antes.nombre, "Fuerza 2 días"); assert.deepEqual(antes.hoy, { dia: 1, hecho: false }); assert.ok(antes.cambiar_en, "con fecha de cambio");
  assert.equal(antes.items.length, 3);
  await como(us.al_dia, async () => {
    await t.falla(() => t.q(`select public.marcar_dia_rutina($1, 5)`, [S().al_dia]), /no existe en tu rutina/);
    const r1 = (await t.q(`select public.marcar_dia_rutina($1, 1) r`, [S().al_dia]))[0].r;
    assert.equal(r1.ya_estaba, false);
    const r2 = (await t.q(`select public.marcar_dia_rutina($1, 1) r`, [S().al_dia]))[0].r;
    assert.equal(r2.ya_estaba, true, "tocarlo dos veces no duplica");
    const ya = (await t.q(`select public.rutina_de_socio($1) r`, [S().al_dia]))[0].r;
    assert.deepEqual(ya.hoy, { dia: 1, hecho: true }); assert.equal(ya.hechos.length, 1);
    await t.q(`select public.desmarcar_dia_rutina($1, 1)`, [S().al_dia]);
    await t.falla(() => t.q(`select public.desmarcar_dia_rutina($1, 1)`, [S().al_dia]), /No tenías ese día/);
    await t.q(`select public.marcar_dia_rutina($1, 1)`, [S().al_dia]);
  });
  // "Hoy" = el día que sigue al último hecho; al terminar la vuelta, vuelve al Día 1.
  const dia = await hoy();
  const marca = (socio, d, atras) => t.q(`insert into public.rutina_dias_hechos (gimnasio_id, socio_id, rutina_id, dia, fecha) values ($1,$2,$3,$4, $5::date - $6::int)`, [t.g, socio, rutina, d, dia, atras]);
  await marca(S().por_vencer, 1, 2);
  assert.equal((await como(us.por_vencer, async () => (await t.q(`select public.rutina_de_socio($1) r`, [S().por_vencer]))[0].r)).hoy.dia, 2, "hizo el 1: le toca el 2");
  await marca(S().por_vencer, 2, 1);
  const vuelta = await como(us.por_vencer, async () => (await t.q(`select public.rutina_de_socio($1) r`, [S().por_vencer]))[0].r);
  assert.deepEqual(vuelta.hoy, { dia: 1, hecho: false }, "hizo el 2: vuelve al 1");
  // Un socio sin rutina no marca nada.
  await como(us.vencida, async () => {
    await t.q(`select public.marcar_dia_rutina($1, 1)`, [S().vencida]);
  });
  await t.q(`update public.rutinas_socio set quitada_en = now() where socio_id = $1 and quitada_en is null`, [S().vencida]);
  await como(us.vencida, () => t.falla(() => t.q(`select public.marcar_dia_rutina($1, 1)`, [S().vencida]), /No tenés una rutina/));
});

test("el profe ve quién la hizo; la recepción y los socios no", async () => {
  const lista = await como(u.profe, async () => (await t.q(`select public.rutinas_progreso_equipo($1) l`, [t.g]))[0].l);
  assert.equal(lista.length, 2, "al_dia y por_vencer (vencida ya no la tiene y el de baja no cuenta)");
  const a = lista.find((x) => x.socio_id === S().al_dia), p = lista.find((x) => x.socio_id === S().por_vencer);
  assert.equal(a.hoy, true); assert.equal(a.veces_30, 1);
  assert.equal(p.hoy, false); assert.equal(p.veces_30, 2); assert.ok(p.ultima);
  assert.equal(a.toca_cambiar, true, "la fecha de cambio era hoy");
  await como(u.recepcion, () => t.falla(() => t.q(`select public.rutinas_progreso_equipo($1)`, [t.g]), /permiso|rol|acceso/i));
  await como(us.al_dia, () => t.falla(() => t.q(`select public.rutinas_progreso_equipo($1)`, [t.g]), /permiso|rol|acceso/i));
});
