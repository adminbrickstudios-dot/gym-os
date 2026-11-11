// Hacete socio online (migración 0032): apagado por defecto y sin reglamento
// no se prende; el visitante se anota con plan, datos, reglamento y medio;
// queda socio sin cobertura (no puede entrar hasta pagar, con su motivo); no
// duplica DNI ni celular; menores al gimnasio; transferencia solo si el
// gimnasio la recibe; nadie lee reglamentos ni aceptaciones sin ser del equipo.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir } from "./_comun.mjs";

let t, u = {}, plan;
const HOST = `alta-${Date.now()}.ejemplo.invalid`;
const REGLAMENTO = "1. Traé toalla. 2. Dejá los discos en su lugar. 3. Respetá los horarios de las clases.";
async function persona(rol) {
  const [{ id }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`${rol}${Math.random()}@ejemplo.invalid`]);
  await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,$3,$4)`, [t.g, id, rol, rol]);
  return id;
}
before(async () => {
  t = await abrir("prueba-alta-online");
  for (const r of ["dueno", "encargado"]) u[r] = await persona(r);
  await t.q(`insert into public.dominios_gimnasio (gimnasio_id, host, tipo) values ($1, $2, 'propio')`, [t.g, HOST]);
  await t.q(`update public.landing_gimnasio set publicada = true where gimnasio_id = $1`, [t.g]);
  [{ id: plan }] = await t.q(`select id from public.planes where gimnasio_id = $1 and tipo = 'membresia' and activo and visible_en_landing
                              and privado.precio_para(id, now(), null, null, false) is not null order by orden limit 1`, [t.g]);
});
after(async () => t && t.cerrar());

const anon = async (fn) => { await t.q(`set local role anon`); const r = await fn(); await t.q(`reset role`); return r; };
const alta = (datos, medio = "mostrador", version = 1, planId = plan) =>
  t.q(`select public.alta_online($1, $2, $3, $4, $5) as r`, [HOST, planId, datos, version, medio]).then((x) => x[0].r);
const DATOS = { nombre: "Ana", apellido: "Online", dni: "30111222", telefono: "387 555 7777", email: "ana@ejemplo.invalid", fecha_nacimiento: "1990-05-01" };

test("apagado por defecto; no se prende sin reglamento; el dueño lo prende, el encargado no", async () => {
  await t.falla(() => anon(() => alta(DATOS)), /no está aceptando altas online/);
  assert.equal((await anon(() => t.q(`select public.alta_publica($1) as a`, [HOST])))[0].a.abierta, false);
  await t.comoUsuario(u.dueno, async () => {
    await t.falla(() => t.q(`select public.guardar_altas($1, true, null)`, [t.g]), /Escribí el reglamento antes/);
    await t.falla(() => t.q(`select public.guardar_altas($1, false, 'corto')`, [t.g]), /muy corto/);
  });
  await t.comoUsuario(u.encargado, async () => t.falla(() => t.q(`select public.guardar_altas($1, true, $2)`, [t.g, REGLAMENTO]), /Sin permiso/));
});

test("el visitante se anota: socio con plan, sin cobertura, reglamento aceptado y aviso en Prospectos", async () => {
  await t.q(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: u.dueno, role: "authenticated" })]);
  await t.q(`set local role authenticated`);
  const p = (await t.q(`select public.guardar_altas($1, true, $2) as p`, [t.g, REGLAMENTO]))[0].p;
  await t.q(`reset role`);
  assert.equal(p.altas_online, true);
  assert.equal(p.reglamento.version, 1);
  const pub = (await anon(() => t.q(`select public.alta_publica($1) as a`, [HOST])))[0].a;
  assert.equal(pub.abierta, true);
  assert.ok(pub.planes.some((x) => x.id === plan), "los planes traen su id para elegir");
  assert.equal(pub.reglamento.version, 1);

  await t.falla(() => anon(() => alta(DATOS, "mostrador", 0)), /El reglamento cambió/);
  await t.falla(() => anon(() => alta({ ...DATOS, dni: "12" })), /DNI/);
  await t.falla(() => anon(() => alta({ ...DATOS, fecha_nacimiento: "" })), /fecha de nacimiento/);
  await t.falla(() => anon(() => alta({ ...DATOS, fecha_nacimiento: "2015-05-01" })), /menor de 18.*adulto responsable/);
  // H3b: el menor se anota con un adulto responsable; el DNI sigue sin repetirse.
  const menorOk = await anon(() => alta({ ...DATOS, dni: "50111222", telefono: "387 555 8888", fecha_nacimiento: "2015-05-01", responsable_nombre: "Mamá Prueba", responsable_telefono: "387 555 9999" }));
  assert.equal(menorOk.ya_socio, false);
  assert.equal(menorOk.menor, true);
  const [{ rt }] = await t.q(`select responsable_telefono rt from public.socios where id = $1`, [menorOk.socio_id]);
  assert.equal(rt, "+5493875559999");
  const repetido = await anon(() => alta({ ...DATOS, dni: "50111222", telefono: "387 555 1010" }));
  assert.deepEqual({ ya: repetido.ya_socio, por: repetido.por }, { ya: true, por: "dni" });
  await t.falla(() => anon(() => alta(DATOS, "mostrador", 1, "00000000-0000-0000-0000-000000000000")), /Elegí uno de los planes/);

  const r = await anon(() => alta(DATOS));
  assert.equal(r.ya_socio, false);
  const [s] = await t.q(`select origen, telefono, dni from public.socios where id = $1`, [r.socio_id]);
  assert.deepEqual(s, { origen: "alta_web", telefono: "+5493875557777", dni: "30111222" });
  const [{ n: subs }] = await t.q(`select count(*)::int n from public.suscripciones where socio_id = $1 and baja_en is null`, [r.socio_id]);
  assert.equal(subs, 1, "queda con el plan elegido");
  const [{ n: cob }] = await t.q(`select count(*)::int n from public.coberturas where socio_id = $1`, [r.socio_id]);
  assert.equal(cob, 0, "sin cobertura: nadie entra gratis por anotarse");
  const [e] = await t.q(`select (x).color, (x).texto from (select privado.calcular_acceso($1, now()) as x) y`, [r.socio_id]);
  assert.ok(e.color !== "verde", `la entrada no lo deja pasar sin pagar (sale ${e.color}: ${e.texto})`);
  const [{ n: ac }] = await t.q(`select count(*)::int n from public.aceptaciones_reglamento where socio_id = $1`, [r.socio_id]);
  assert.equal(ac, 1, "el reglamento queda aceptado con su versión");
  const [pr] = await t.q(`select estado, socio_id, interes, nota from public.prospectos where gimnasio_id = $1 and telefono = '+5493875557777'`, [t.g]);
  assert.equal(pr.estado, "socio");
  assert.match(pr.nota, /paga en el mostrador/);

  const otra = await anon(() => alta({ ...DATOS, nombre: "Otra", telefono: "387 555 8888" }));
  assert.equal(otra.ya_socio, true, "mismo DNI: no se duplica");
  const otra2 = await anon(() => alta({ ...DATOS, dni: "30999888" }));
  assert.equal(otra2.ya_socio, true, "mismo celular: no se duplica");
});

test("transferencia solo si el gimnasio la recibe; muestra alias y CBU", async () => {
  await t.q(`update public.configuracion_gimnasio set alias_transferencia = null, cbu = null where gimnasio_id = $1`, [t.g]);
  await t.falla(() => anon(() => alta({ ...DATOS, dni: "31222333", telefono: "387 555 9999" }, "transferencia")), /no recibe transferencias/);
  await t.q(`update public.configuracion_gimnasio set alias_transferencia = 'GYM.PRUEBA.ALTA' where gimnasio_id = $1`, [t.g]);
  const r = await anon(() => alta({ ...DATOS, dni: "31222333", telefono: "387 555 9999" }, "transferencia"));
  assert.equal(r.transferencia.alias, "GYM.PRUEBA.ALTA");
  await t.q(`update public.configuracion_gimnasio set secciones_apagadas = array['transferencias'] where gimnasio_id = $1`, [t.g]);
  await t.falla(() => anon(() => alta({ ...DATOS, dni: "32333444", telefono: "387 555 6666" }, "transferencia")), /no recibe transferencias/);
});

test("un reglamento nuevo es otra versión; nadie de afuera lee reglamentos ni aceptaciones", async () => {
  await t.comoUsuario(u.dueno, async () => {
    const p = (await t.q(`select public.guardar_altas($1, true, $2) as p`, [t.g, REGLAMENTO + " 4. Sin celular en la sala de clases."]))[0].p;
    assert.equal(p.reglamento.version, 2);
    await t.falla(() => t.q(`select public.guardar_altas($1, true, '')`, [t.g]), /no se puede borrar/);
  });
  await t.falla(() => anon(() => t.q(`select * from public.reglamentos`)), /permission|denied/);
  await t.falla(() => anon(() => t.q(`select * from public.aceptaciones_reglamento`)), /permission|denied/);
});
