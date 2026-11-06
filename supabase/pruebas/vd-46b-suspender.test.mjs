// VD-46B (20261106007200): suspender o expulsar a un socio, con motivo y fecha de revisión.
// La recepción suspende pero no expulsa; solo dueño o encargado levantan; el suspendido no entra (calcular_acceso),
// no entra de invitado (aunque su ficha esté dada de baja), aparece en Control y avisa en la campana cuando toca revisar.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir } from "./_comun.mjs";

let t, u = {}, ajeno, hoy, desde;
before(async () => {
  t = await abrir("prueba-vd46b");
  for (const [rol, nombre] of [["dueno", "Sofía"], ["encargado", "Martín"], ["recepcion", "Ana"]]) {
    const [{ id }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`${rol}${Math.random()}@ejemplo.invalid`]);
    await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,$3,$4)`, [t.g, id, nombre, rol]);
    u[rol] = id;
  }
  [{ id: ajeno }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`ajeno${Math.random()}@ejemplo.invalid`]);
  [{ hoy, desde }] = await t.q(`select (now() at time zone zona_horaria)::date::text as hoy, ((now() at time zone zona_horaria)::date - 3)::text as desde from public.gimnasios where id = $1`, [t.g]);
});
after(async () => t && t.cerrar());

async function como(usuario, fn) {
  await t.db.query("set role authenticated");
  await t.q(`select set_config('request.jwt.claims', $1, false)`, [JSON.stringify({ sub: usuario, role: "authenticated" })]);
  try { return await fn(); } finally { await t.db.query("reset role"); await t.q(`select set_config('request.jwt.claims', '', false)`); }
}
const bloqueo = async (socio) => (await t.q(`select (privado.bloqueo_persona($1, now())).texto as texto`, [socio]))[0].texto;

test("la recepción suspende con motivo; expulsar y levantar no es suyo", async () => {
  const socio = t.ctx.socios.al_dia;
  await como(u.recepcion, async () => {
    await t.falla(() => t.q(`select public.suspender_socio($1, 'x')`, [socio]), /motivo/);
    await t.falla(() => t.q(`select public.suspender_socio($1, 'Pelea en el vestuario', 'expulsion')`, [socio]), /Sin permiso/);
    await t.falla(() => t.q(`select public.suspender_socio($1, 'Pelea', 'suspension', current_date - 1)`, [socio]), /mañana o más adelante/);
    await t.falla(() => t.q(`select public.suspender_socio($1, 'Pelea', 'suspension', null, current_date - 1)`, [socio]), /revisión/);
  });
  assert.equal(await bloqueo(socio), null, "nada de eso suspendió");
  const sid = await como(u.recepcion, async () => (await t.q(`select public.suspender_socio($1, 'Pelea en el vestuario') as id`, [socio]))[0].id);
  assert.ok(sid);
  assert.equal(await bloqueo(socio), "Suspendido · Pelea en el vestuario");
  const v = (await t.q(`select (privado.calcular_acceso($1, now(), null)).motivo as m, (privado.calcular_acceso($1, now(), null)).puede as puede`, [socio]))[0];
  assert.equal(v.m, "suspendido"); assert.equal(v.puede, false);
  // Por defecto se revisa en 30 días.
  const [{ dias }] = await t.q(`select (revisar_en::date - desde::date) as dias from public.suspensiones where id = $1`, [sid]);
  assert.ok(dias >= 29 && dias <= 31, `revisión a ${dias} días`);
  await como(u.recepcion, async () => {
    await t.falla(() => t.q(`select public.suspender_socio($1, 'Otra vez')`, [socio]), /Ya está suspendido/);
    await t.falla(() => t.q(`select public.levantar_suspension($1, 'Se calmó')`, [sid]), /Sin permiso/);
    await t.falla(() => t.q(`select public.revisar_suspension($1, current_date + 10)`, [sid]), /Sin permiso/);
  });
  assert.ok(await bloqueo(socio), "la recepción no pudo levantarla");
  // Quien no es del equipo ni lo ve.
  await como(ajeno, () => t.falla(() => t.q(`select public.suspender_socio($1, 'Hola, soy de afuera')`, [t.ctx.socios.vencida]), /Sin permiso/));
  await como(ajeno, () => t.falla(() => t.q(`select public.suspension_socio($1)`, [socio]), /Sin permiso/));
});

test("el encargado levanta con motivo, queda quién y por qué; no se levanta dos veces", async () => {
  const socio = t.ctx.socios.al_dia;
  const [{ id: sid }] = await t.q(`select id from public.suspensiones where socio_id = $1 and levantada_en is null`, [socio]);
  await como(u.encargado, async () => {
    await t.falla(() => t.q(`select public.levantar_suspension($1, '  ')`, [sid]), /por qué/);
    await t.q(`select public.levantar_suspension($1, 'Pidió disculpas y se habló')`, [sid]);
    await t.falla(() => t.q(`select public.levantar_suspension($1, 'otra vez')`, [sid]), /ya estaba levantada/);
  });
  assert.equal(await bloqueo(socio), null);
  const [fila] = await t.q(`select levantada_por, levantada_motivo from public.suspensiones where id = $1`, [sid]);
  assert.equal(fila.levantada_por, u.encargado); assert.equal(fila.levantada_motivo, "Pidió disculpas y se habló");
  // Un hecho no se edita: solo se levanta y se mueve la revisión.
  await t.falla(() => t.q(`update public.suspensiones set motivo = 'cambiado' where id = $1`, [sid]), /solo se puede cambiar/);
  await t.falla(() => t.q(`delete from public.suspensiones where id = $1`, [sid]), /no se borran/);
});

test("expulsión: sin fecha de fin, la revisa el dueño, aparece en la ficha, en Control y en la campana", async () => {
  const socio = t.ctx.socios.vencida;
  const sid = await como(u.dueno, async () => (await t.q(`select public.suspender_socio($1, 'Agredió a un profe', 'expulsion', null, current_date + 20) as id`, [socio]))[0].id);
  assert.equal(await bloqueo(socio), "Expulsado · Agredió a un profe");
  await como(u.dueno, () => t.falla(() => t.q(`select public.suspender_socio($1, 'x con fin', 'expulsion', current_date + 5)`, [t.ctx.socios.sin_pago]), /sin fecha de fin/));
  const ficha = await como(u.recepcion, async () => (await t.q(`select public.suspension_socio($1) as r`, [socio]))[0].r);
  assert.equal(ficha.vigente.tipo, "expulsion"); assert.equal(ficha.vigente.por, "Sofía");
  assert.deepEqual([ficha.puede_suspender, ficha.puede_expulsar, ficha.puede_levantar], [true, false, false]);
  const fichaDueno = await como(u.dueno, async () => (await t.q(`select public.suspension_socio($1) as r`, [socio]))[0].r);
  assert.deepEqual([fichaDueno.puede_expulsar, fichaDueno.puede_levantar], [true, true]);

  // Control: lo ve el dueño; la recepción recibe un error, no una lista vacía.
  const c = await como(u.dueno, async () => (await t.q(`select public.moderacion_control($1, $2::date, $3::date) as r`, [t.g, desde, hoy]))[0].r);
  const tipos = c.items.map((i) => i.tipo);
  assert.ok(tipos.includes("expulsion") && tipos.includes("suspension") && tipos.includes("levantamiento"), `hay ${tipos.join(", ")}`);
  assert.ok(c.items.some((i) => i.tipo === "expulsion" && i.quien === "Sofía" && /Agredió/.test(i.detalle)));
  await como(u.recepcion, () => t.falla(() => t.q(`select public.moderacion_control($1, $2::date, $3::date)`, [t.g, desde, hoy]), /Sin permiso/));

  // La campana avisa recién cuando llega la fecha de revisión, y una sola vez por fecha.
  const avisos = async () => (await como(u.dueno, async () => (await t.q(`select public.campana_control($1) as r`, [t.g]))[0].r)).filter((i) => /^revisar_suspension:/.test(i.clave));
  assert.equal((await avisos()).length, 0);
  await t.q(`update public.suspensiones set revisar_en = now() - interval '1 day' where id = $1`, [sid]);
  const a = await avisos();
  assert.equal(a.length, 1); assert.match(a[0].titulo, /Revisar la expulsión de Testigo Vencida/);
  // "La revisé, sigue": se mueve la fecha y el aviso se va.
  await como(u.dueno, async () => {
    await t.falla(() => t.q(`select public.revisar_suspension($1, current_date - 2)`, [sid]), /mañana o más adelante/);
    await t.q(`select public.revisar_suspension($1, current_date + 60)`, [sid]);
  });
  assert.equal((await avisos()).length, 0);
  assert.ok(await bloqueo(socio), "sigue expulsada");
});

test("un suspendido no entra de invitado, ni con la ficha dada de baja", async () => {
  const exsocio = t.ctx.socios.se_fue;
  await t.q(`update public.socios set dni = '33444555' where id = $1`, [exsocio]);
  await t.q(`insert into public.suspensiones (gimnasio_id, socio_id, desde, motivo, tipo, revisar_en, creado_por)
             values ($1,$2, now() - interval '2 days', 'Robó en el vestuario', 'expulsion', now() + interval '30 days', $3)`, [t.g, exsocio, u.dueno]);
  await como(u.recepcion, async () => {
    await t.falla(() => t.q(`select public.registrar_invitado($1, $2, $3, 'Amigo Suspendido', '33444555')`, [t.g, t.sede, t.ctx.socios.pase_hoy]), /suspendida o expulsada/);
  });
  assert.equal((await t.q(`select count(*)::int as n from public.invitados where dni = '33444555'`))[0].n, 0, "no quedó anotado");
});
