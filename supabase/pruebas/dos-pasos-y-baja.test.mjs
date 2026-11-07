// VD-42 (6400): verificación en dos pasos en lo sensible, "Dar de baja" y alertas de seguridad.
// aal2 solo se exige a quien TIENE un factor TOTP verificado; quien no, sigue como siempre.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir } from "./_comun.mjs";

let t, uDueno, uEnc, uRec, eRec, eEnc, caja;
async function crear(rol, nombre) {
  const [{ id: u }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`${rol}${Math.random()}@ejemplo.invalid`]);
  const [{ id }] = await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,$3,$4) returning id`, [t.g, u, nombre, rol]);
  return [u, id];
}
before(async () => {
  t = await abrir("prueba-dos-pasos");
  [uDueno] = await crear("dueno", "Dueña Dos");
  [uEnc, eEnc] = await crear("encargado", "Beto Enc");
  [uRec, eRec] = await crear("recepcion", "Ana Rec");
  [{ id: caja }] = await t.q(`insert into public.cajas (gimnasio_id, sede_id, nombre) values ($1,$2,'Mostrador') returning id`, [t.g, t.sede]);
});
after(async () => t && t.cerrar());

async function como(u, fn, claims = {}) {
  await t.db.query("set role authenticated");
  await t.q(`select set_config('request.jwt.claims', $1, false)`, [JSON.stringify({ sub: u, role: "authenticated", ...claims })]);
  try { return await fn(); } finally { await t.db.query("reset role"); await t.q(`select set_config('request.jwt.claims', '', false)`); }
}
const ponerFactor = (u, status = "verified") =>
  t.q(`insert into auth.mfa_factors (user_id, factor_type, status) values ($1, 'totp', $2)`, [u, status]);
const exportar = () => t.q(`select public.exportar_gimnasio($1, 'socios') as r`, [t.g]);
const permiso = () => t.q(`select public.guardar_permisos_equipo($1, '{"profe_ve_telefono": true}'::jsonb)`, [t.g]);

test("sin 2FA activa, el dueño exporta y toca el equipo como siempre", async () => {
  await como(uDueno, async () => {
    const [{ r }] = await exportar();
    assert.ok(Array.isArray(r) && r.length > 0);
    await permiso();
    await t.q(`select public.guardar_equipo($1, $2, 'Ana Rec', 'recepcion', null, true)`, [t.g, eRec]);
  });
});

test("con 2FA activa y sesión sin aal2, el dueño no exporta ni toca el equipo ni los cobros", async () => {
  await ponerFactor(uDueno);
  await como(uDueno, async () => {
    await t.falla(() => exportar(), /dos pasos/);
    await t.falla(() => t.q(`select * from public.exportar_socios($1)`, [t.g]), /dos pasos/);
    await t.falla(() => permiso(), /dos pasos/);
    await t.falla(() => t.q(`select public.guardar_equipo($1, $2, 'Ana Rec', 'recepcion', null, true)`, [t.g, eRec]), /dos pasos/);
    await t.falla(() => t.q(`select public.dar_de_baja_equipo($1, $2)`, [t.g, eRec]), /dos pasos/);
    await t.falla(() => t.q(`select public.persona_para_dar_acceso($1)`, [eRec]), /dos pasos/);
    await t.falla(() => t.q(`select public.quitar_mercadopago($1)`, [t.g]), /dos pasos/);
    await t.falla(() => t.q(`select public.guardar_mercadopago($1, 'APP_USR-12345678901234567890', '1234567890123456', 'prueba')`, [t.g]), /dos pasos/);
  }, { aal: "aal1" });
  // Lo que no es sensible sigue andando con aal1.
  await como(uDueno, async () => { await t.q(`select public.seguridad_dueno($1)`, [t.g]); }, { aal: "aal1" });
});

test("con aal2 (código confirmado) vuelve a andar todo", async () => {
  await como(uDueno, async () => {
    const [{ r }] = await exportar();
    assert.ok(r.length > 0);
    await permiso();
    await t.q(`select public.guardar_equipo($1, $2, 'Ana Rec', 'recepcion', null, true)`, [t.g, eRec]);
  }, { aal: "aal2" });
});

test("un factor sin verificar no cuenta; el encargado con 2FA también necesita aal2 para exportar socios", async () => {
  await ponerFactor(uEnc, "unverified");
  await como(uEnc, async () => { const r = await t.q(`select * from public.exportar_socios($1)`, [t.g]); assert.ok(r.length > 0); }, { aal: "aal1" });
  await ponerFactor(uEnc, "verified");
  await como(uEnc, () => t.falla(() => t.q(`select * from public.exportar_socios($1)`, [t.g]), /dos pasos/), { aal: "aal1" });
  await como(uEnc, async () => { assert.ok((await t.q(`select * from public.exportar_socios($1)`, [t.g])).length > 0); }, { aal: "aal2" });
});

test("dar de baja: desactiva, borra el PIN, cierra el turno y corta las sesiones; el historial queda", async () => {
  await t.q(`insert into privado.secretos_operador (gimnasio_id) values ($1) on conflict do nothing`, [t.g]);
  await t.q(`insert into privado.pines_equipo (equipo_id, gimnasio_id, pin_hash) values ($1,$2,extensions.crypt('4829', extensions.gen_salt('bf', 4)))`, [eRec, t.g]);
  const turno = await como(uRec, async () => (await t.q(`select public.abrir_caja($1, 0) as id`, [caja]))[0].id);
  await t.q(`insert into auth.sessions (user_id, user_agent) values ($1, 'Chrome Windows'), ($1, 'Safari iPhone')`, [uRec]);

  await como(uEnc, () => t.falla(() => t.q(`select public.dar_de_baja_equipo($1, $2)`, [t.g, eRec]), /Sin permiso/), { aal: "aal2" });
  await como(uDueno, async () => {
    await t.falla(() => t.q(`select public.dar_de_baja_equipo($1, (select id from public.equipo where usuario_id = $2))`, [t.g, uDueno]), /No podés darte de baja/);
    const [{ r }] = await t.q(`select public.dar_de_baja_equipo($1, $2, 'Se fue') as r`, [t.g, eRec]);
    assert.equal(r.sesiones_cerradas, 2);
    assert.equal(r.turnos_cerrados, 1);
    assert.equal(r.pin_borrado, true);
  }, { aal: "aal2" });

  const [e] = await t.q(`select activo from public.equipo where id = $1`, [eRec]);
  assert.equal(e.activo, false);
  assert.equal((await t.q(`select count(*)::int n from privado.pines_equipo where equipo_id = $1`, [eRec]))[0].n, 0);
  assert.equal((await t.q(`select count(*)::int n from auth.sessions where user_id = $1`, [uRec]))[0].n, 0);
  const [tc] = await t.q(`select cerrado_en, sin_contar, abierto_por from public.turnos_caja where id = $1`, [turno]);
  assert.ok(tc.cerrado_en && tc.sin_contar && tc.abierto_por === eRec, "el turno queda cerrado sin contar y a su nombre (el historial queda)");
  const [al] = await t.q(`select tipo, datos from public.alertas_seguridad where gimnasio_id = $1 and equipo_id = $2`, [t.g, eRec]);
  assert.equal(al.tipo, "baja_equipo");
  assert.equal(al.datos.motivo, "Se fue");
  // Con una sesión que todavía no venció, la base igual le niega todo.
  await como(uRec, () => t.falla(() => t.q(`select public.abrir_caja($1, 0)`, [caja]), /Sin permiso/));
});

test("guardar_equipo con activo = false corta lo mismo que dar de baja", async () => {
  const [uP, eP] = await crear("profe", "Profe Baja");
  await t.q(`insert into privado.pines_equipo (equipo_id, gimnasio_id, pin_hash) values ($1,$2,extensions.crypt('7351', extensions.gen_salt('bf', 4)))`, [eP, t.g]);
  await t.q(`insert into auth.sessions (user_id, user_agent) values ($1, 'Firefox Linux')`, [uP]);
  await como(uDueno, () => t.q(`select public.guardar_equipo($1, $2, 'Profe Baja', 'profe', null, false)`, [t.g, eP]), { aal: "aal2" });
  assert.equal((await t.q(`select count(*)::int n from privado.pines_equipo where equipo_id = $1`, [eP]))[0].n, 0);
  assert.equal((await t.q(`select count(*)::int n from auth.sessions where user_id = $1`, [uP]))[0].n, 0);
});

test("la cuenta que sigue siendo parte de otro equipo conserva sus sesiones", async () => {
  const [uX, eX] = await crear("recepcion", "Doble Cuenta");
  const [{ id: g2 }] = await t.q(`insert into public.gimnasios (slug, nombre) values ('otro-gym-dos-pasos', 'Otro') returning id`);
  await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,'Doble Cuenta','recepcion')`, [g2, uX]);
  await t.q(`insert into auth.sessions (user_id, user_agent) values ($1, 'Chrome Mac')`, [uX]);
  await como(uDueno, () => t.q(`select public.dar_de_baja_equipo($1, $2)`, [t.g, eX]), { aal: "aal2" });
  assert.equal((await t.q(`select count(*)::int n from auth.sessions where user_id = $1`, [uX]))[0].n, 1);
  assert.equal((await t.q(`select activo from public.equipo where id = $1`, [eX]))[0].activo, false);
});

test("alerta de dispositivo nuevo del equipo: el primero no avisa, uno nuevo sí, el mismo no, el dueño no", async () => {
  const [uP] = await crear("recepcion", "Nueva Rec");
  const sesion = async (u, ua) => (await t.q(`insert into auth.sessions (user_id, user_agent) values ($1,$2) returning id`, [u, ua]))[0].id;
  const registrar = (u, sid) => como(u, async () => (await t.q(`select public.registrar_sesion_equipo($1) as r`, [t.g]))[0].r, { session_id: sid });
  assert.equal((await registrar(uP, await sesion(uP, "Chrome en la compu del mostrador"))).nuevo, false);
  assert.equal((await registrar(uP, await sesion(uP, "Chrome en la compu del mostrador"))).nuevo, false);
  assert.equal((await registrar(uP, await sesion(uP, "Safari de un iPhone que nadie conoce"))).nuevo, true);
  assert.equal((await registrar(uP, await sesion(uP, "Safari de un iPhone que nadie conoce"))).nuevo, false);
  // Al dueño no se le avisa de sus propios dispositivos.
  await registrar(uDueno, await sesion(uDueno, "Chrome del dueño"));
  assert.equal((await registrar(uDueno, await sesion(uDueno, "Firefox del dueño"))).nuevo, false);

  await como(uDueno, async () => {
    const [{ r }] = await t.q(`select public.seguridad_dueno($1) as r`, [t.g]);
    assert.equal(r.dos_pasos, true);
    const nuevos = r.alertas.filter((a) => a.tipo === "dispositivo_nuevo");
    assert.equal(nuevos.length, 1);
    assert.equal(nuevos[0].quien, "Nueva Rec");
    assert.ok(r.sin_ver >= 2, "la del dispositivo nuevo y las bajas");
    const [{ n }] = await t.q(`select public.marcar_alertas_vistas($1) as n`, [t.g]);
    assert.ok(n >= 2);
    assert.equal((await t.q(`select public.seguridad_dueno($1) as r`, [t.g]))[0].r.sin_ver, 0);
  }, { aal: "aal2" });
  // Solo el dueño ve las alertas.
  await como(uEnc, () => t.falla(() => t.q(`select public.seguridad_dueno($1)`, [t.g]), /Sin permiso/), { aal: "aal2" });
});
