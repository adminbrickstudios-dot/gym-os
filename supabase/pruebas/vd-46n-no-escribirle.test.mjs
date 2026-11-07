// VD-46N (7800): "No escribirle" por socio.
// El marcado no aparece en ninguna lista de aviso masivo (retención, bandeja, cumpleaños, avisar a la clase)
// pero SÍ sigue en "Vencen para cobrar". La recepción marca; solo dueño y encargado sacan la marca (con motivo).
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir, HOY } from "./_comun.mjs";

let t, u = {}, momento;
async function persona(rol) {
  const [{ id }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`${rol}${Math.random()}@ejemplo.invalid`]);
  await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,$3,$4)`, [t.g, id, `P ${rol}`, rol]);
  return id;
}
async function como(usuario, fn) {
  await t.db.query("set role authenticated");
  await t.q(`select set_config('request.jwt.claims', $1, false)`, [JSON.stringify({ sub: usuario, role: "authenticated" })]);
  try { return await fn(); } finally { await t.db.query("reset role"); await t.q(`select set_config('request.jwt.claims', '', false)`); }
}
const lista = async (socio) => (await t.q(`select lista from privado.retencion($1, $2) where socio_id = $3`, [t.g, momento, socio]))[0]?.lista ?? null;
const marcar = (socio, motivo = 'Lo pidió en la recepción') => como(u.recepcion, () => t.q(`select public.marcar_no_escribirle($1, true, $2)`, [socio, motivo]));

before(async () => {
  t = await abrir("prueba-no-escribirle");
  momento = await t.en(HOY);
  u.dueno = await persona("dueno"); u.recepcion = await persona("recepcion"); u.profe = await persona("profe");
});
after(async () => t && t.cerrar());

test("marcar: la recepción puede, el profe no, hace falta un motivo y no se marca dos veces", async () => {
  const s = t.ctx.socios.al_dia;
  await como(u.profe, () => t.falla(() => t.q(`select public.marcar_no_escribirle($1, true, 'x pidió')`, [s]), /Sin permiso/));
  await como(u.recepcion, () => t.falla(() => t.q(`select public.marcar_no_escribirle($1, true, '  ')`, [s]), /motivo/));
  assert.equal(await lista(s), "no_viene");
  await marcar(s);
  await como(u.recepcion, () => t.falla(() => t.q(`select public.marcar_no_escribirle($1, true, 'otra vez')`, [s]), /ya tiene la marca/));
  const [{ f }] = await como(u.recepcion, () => t.q(`select public.no_escribirle_socio($1) as f`, [s]));
  assert.equal(f.marcado, true);
  assert.equal(f.motivo, "Lo pidió en la recepción");
  assert.equal(f.por, "P recepcion");
  assert.equal(f.puede_sacar, false);
});

test("el marcado sale de las listas de re-enganche (no viene, se fue) pero sigue en vencidos y por vencer", async () => {
  assert.equal(await lista(t.ctx.socios.al_dia), null, "no_viene: ya no aparece");
  await marcar(t.ctx.socios.vencida_tres_meses);
  assert.equal(await lista(t.ctx.socios.vencida_tres_meses), null, "se_fue: ya no aparece");
  await marcar(t.ctx.socios.vencida);
  await marcar(t.ctx.socios.por_vencer);
  assert.equal(await lista(t.ctx.socios.vencida), "vencido", "a un vencido se le sigue cobrando");
  assert.equal(await lista(t.ctx.socios.por_vencer), "por_vencer");
  // "Vencen para cobrar" (la pantalla de la recepción, con la hora de verdad) los sigue mostrando.
  const [{ id: real }] = await t.q(`insert into public.socios (gimnasio_id, nombre, apellido, telefono) values ($1,'Vencido','Real','+5490000999108') returning id`, [t.g]);
  const [{ id: su }] = await t.q(`insert into public.suscripciones (gimnasio_id, socio_id, plan_id, inicio) values ($1,$2,$3, now() - interval '60 days') returning id`, [t.g, real, t.ctx.planes.full]);
  await t.q(`insert into public.coberturas (gimnasio_id, suscripcion_id, socio_id, desde, hasta, origen, motivo)
             values ($1,$2,$3, now() - interval '40 days', now() - interval '10 days', 'cortesia', 'prueba')`, [t.g, su, real]);
  await marcar(real);
  const [{ v }] = await como(u.recepcion, () => t.q(`select public.vencen_pestanas($1) as v`, [t.g]));
  const ids = [...v.vencidos.filas, ...v.por_vencer.filas, ...v.hoy.filas].map((x) => x.socio_id);
  assert.ok(ids.includes(real), "el vencido marcado sigue en Vencen para cobrar");
});

test("la pantalla de Retención no lo lista, ni siquiera vencido", async () => {
  const filas = await como(u.dueno, () => t.q(`select * from public.retencion($1)`, [t.g]));
  for (const k of ["vencida", "por_vencer", "al_dia", "vencida_tres_meses"])
    assert.ok(!filas.some((f) => f.socio_id === t.ctx.socios[k]), `${k} no está en Retención`);
});

test("la bandeja de avisos no incluye al marcado, y sí al que no lo está", async () => {
  const [{ id: libre }] = await t.q(`insert into public.socios (gimnasio_id, nombre, apellido, telefono) values ($1,'Libre','Aviso','+5490000999101') returning id`, [t.g]);
  const [{ id: marcado }] = await t.q(`insert into public.socios (gimnasio_id, nombre, apellido, telefono) values ($1,'Marcado','Aviso','+5490000999102') returning id`, [t.g]);
  for (const s of [libre, marcado]) {
    const [{ id: su }] = await t.q(`insert into public.suscripciones (gimnasio_id, socio_id, plan_id, inicio) values ($1,$2,$3, now() - interval '60 days') returning id`, [t.g, s, t.ctx.planes.full]);
    await t.q(`insert into public.coberturas (gimnasio_id, suscripcion_id, socio_id, desde, hasta, origen, motivo)
               values ($1,$2,$3, now() - interval '30 days', now() + interval '12 hours', 'cortesia', 'prueba')`, [t.g, su, s]);
  }
  await marcar(marcado);
  const [{ b }] = await como(u.dueno, () => t.q(`select public.bandeja_avisos($1) as b`, [t.g]));
  assert.ok(b.some((x) => x.socio_id === libre), "el socio libre sí está en la bandeja");
  assert.ok(!b.some((x) => x.socio_id === marcado), "el marcado no está");
});

test("cumpleaños: el marcado no figura; el otro sí", async () => {
  const [{ id: a }] = await t.q(`insert into public.socios (gimnasio_id, nombre, apellido, telefono, fecha_nacimiento) values ($1,'Cumple','Libre','+5490000999103','1990-11-14') returning id`, [t.g]);
  const [{ id: b }] = await t.q(`insert into public.socios (gimnasio_id, nombre, apellido, telefono, fecha_nacimiento) values ($1,'Cumple','Marcado','+5490000999104','1991-11-14') returning id`, [t.g]);
  await marcar(b);
  const [{ c }] = await como(u.dueno, () => t.q(`select public.cumplen_hoy($1, $2) as c`, [t.g, momento]));
  assert.ok(c.some((x) => x.socio_id === a));
  assert.ok(!c.some((x) => x.socio_id === b));
});

test("avisar a la clase: el marcado queda fuera del aviso", async () => {
  const [{ id: act }] = await t.q(`insert into public.actividades (gimnasio_id, nombre) values ($1, 'Funcional') returning id`, [t.g]);
  const [{ id: clase }] = await t.q(`insert into public.clases (gimnasio_id, sede_id, actividad_id, inicio, fin, cupo)
    values ($1,$2,$3, now() + interval '1 day', now() + interval '1 day 1 hour', 10) returning id`, [t.g, t.sede, act]);
  const [{ id: x }] = await t.q(`insert into public.socios (gimnasio_id, nombre, apellido, telefono) values ($1,'Anotado','Uno','+5490000999105') returning id`, [t.g]);
  const [{ id: y }] = await t.q(`insert into public.socios (gimnasio_id, nombre, apellido, telefono) values ($1,'Anotado','Dos','+5490000999106') returning id`, [t.g]);
  for (const s of [x, y]) await t.q(`insert into public.reservas (gimnasio_id, clase_id, socio_id, estado) values ($1,$2,$3,'confirmada')`, [t.g, clase, s]);
  await marcar(y);
  const [{ r }] = await como(u.dueno, () => t.q(`select public.avisar_clase($1, 'Mañana traigan agua') as r`, [clase]));
  assert.equal(r.mensajes.length, 1);
  assert.equal(r.mensajes[0].socio_id, x);
});

test("sacar la marca: solo dueño y encargado, con motivo; queda el historial inmutable", async () => {
  const s = t.ctx.socios.al_dia;
  await como(u.recepcion, () => t.falla(() => t.q(`select public.marcar_no_escribirle($1, false, 'ya puede')`, [s]), /Sin permiso/));
  await como(u.dueno, () => t.falla(() => t.q(`select public.marcar_no_escribirle($1, false, '')`, [s]), /motivo/));
  await como(u.dueno, () => t.q(`select public.marcar_no_escribirle($1, false, 'Pidió volver a recibir mensajes')`, [s]));
  assert.equal(await lista(s), "no_viene", "vuelve a la lista");
  await como(u.dueno, () => t.falla(() => t.q(`select public.marcar_no_escribirle($1, false, 'otra vez')`, [s]), /no tiene la marca/));
  const [{ f }] = await como(u.dueno, () => t.q(`select public.no_escribirle_socio($1) as f`, [s]));
  assert.equal(f.marcado, false);
  assert.equal(Number(f.veces_sacada), 1);
  const h = await t.q(`select * from public.no_escribirle_historial where socio_id = $1`, [s]);
  assert.equal(h.length, 1);
  assert.equal(h[0].motivo_levantar, "Pidió volver a recibir mensajes");
  await t.falla(() => t.q(`update public.no_escribirle_historial set motivo = 'x' where socio_id = $1`, [s]), /queda escrito/);
  await t.falla(() => t.q(`delete from public.no_escribirle_historial where socio_id = $1`, [s]), /queda escrito/);
});

test("no cruza gimnasios", async () => {
  const [{ id: g2 }] = await t.q(`insert into public.gimnasios (slug, nombre) values ('otro-no-escribirle', 'Otro') returning id`);
  const [{ id: ajeno }] = await t.q(`insert into public.socios (gimnasio_id, nombre, apellido, telefono) values ($1,'Ajeno','X','+5490000999107') returning id`, [g2]);
  await como(u.dueno, () => t.falla(() => t.q(`select public.marcar_no_escribirle($1, true, 'no corresponde')`, [ajeno]), /Sin permiso/));
});
