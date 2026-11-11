// FA-12 · Avisos en la app del socio: solo avisan. La clase que empieza en menos de 1 h (solo si el socio lo quiere) y el evento de mañana
// (al que está anotado). Todo con un momento fijo; solo lo pide el socio de ese gimnasio.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir } from "./_comun.mjs";

let t, socioU, otroU, clase, momento, tempranoM, despuesM;
async function como(usuario, fn) {
  await t.db.query("set role authenticated");
  await t.q(`select set_config('request.jwt.claims', $1, false)`, [JSON.stringify({ sub: usuario, role: "authenticated" })]);
  try { return await fn(); } finally { await t.db.query("reset role"); await t.q(`select set_config('request.jwt.claims', '', false)`); }
}
const S = () => t.ctx.socios;
const avisos = async (m = momento) => (await t.q(`select public.avisos_app_socio($1, $2) a`, [S().al_dia, m]))[0].a;

before(async () => {
  t = await abrir("prueba-avisos-app");
  [{ id: socioU }] = await t.q(`insert into auth.users (phone) values ('+549000078100001') returning id`);
  [{ id: otroU }] = await t.q(`insert into auth.users (phone) values ('+549000078100002') returning id`);
  await t.q(`update public.socios set usuario_id = $2 where id = $1`, [S().al_dia, socioU]);
  await t.q(`update public.socios set usuario_id = $2 where id = $1`, [S().por_vencer, otroU]);
  momento = await t.en("2026-11-14", "17:30:00");
  tempranoM = await t.en("2026-11-14", "10:00:00");
  despuesM = await t.en("2026-11-14", "19:00:00");
  const [{ id: act }] = await t.q(`insert into public.actividades (gimnasio_id, nombre, emoji) values ($1,'Spinning','S') returning id`, [t.g]);
  [{ id: clase }] = await t.q(`insert into public.clases (gimnasio_id, sede_id, actividad_id, inicio, fin, cupo) values ($1,$2,$3, $4::timestamptz + interval '40 minutes', $4::timestamptz + interval '100 minutes', 10) returning id`, [t.g, t.sede, act, momento]);
  await t.q(`insert into public.reservas (gimnasio_id, clase_id, socio_id, estado) values ($1,$2,$3,'confirmada')`, [t.g, clase, S().al_dia]);
});
after(async () => t && t.cerrar());

test("por defecto el aviso de la clase está apagado: no avisa nada", async () => {
  await como(socioU, async () => { assert.deepEqual(await avisos(), []); });
});

test("lo prende el socio: avisa la clase que empieza en menos de 1 hora, y no la que está más lejos", async () => {
  await como(socioU, async () => {
    await t.q(`select public.guardar_aviso_clase($1, true)`, [S().al_dia]);
    const a = await avisos();
    assert.equal(a.length, 1);
    assert.equal(a[0].tipo, "clase_pronto");
    assert.match(a[0].texto, /^Tu clase de Spinning empieza a las /);
    const temprano = tempranoM;
    assert.deepEqual(await avisos(temprano), [], "con la clase a más de 1 hora no avisa");
    const despues = despuesM;
    assert.deepEqual(await avisos(despues), [], "una clase que ya empezó no avisa");
  });
});

test("el evento de mañana avisa al anotado, y no al que no está anotado", async () => {
  // El evento lo crea el dueño como siempre (crear_evento exige un inicio futuro): se arma mañana a las 10 del gimnasio, respecto de ahora.
  const [{ id: dueno }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`d${Math.random()}@ejemplo.invalid`]);
  await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,'Dueno','dueno')`, [t.g, dueno]);
  const [{ m: ahora, i: inicio }] = await t.q(`select now() as m, privado.medianoche(privado.dia_local(now(), $1) + 1, $1) + interval '10 hours' as i`, [t.ctx.zona]);
  const ev = await como(dueno, async () => (await t.q(`select public.crear_evento($1, 'Clase abierta', $2, 20, 0) id`, [t.g, inicio]))[0].id);
  await t.q(`insert into public.evento_inscripciones (gimnasio_id, evento_id, socio_id, nombre, origen) values ($1,$2,$3,'Socio Uno','app')`, [t.g, ev, S().al_dia]);
  await como(socioU, async () => {
    const a = (await avisos(ahora)).filter((x) => x.tipo === "evento_manana");
    assert.equal(a.length, 1);
    assert.match(a[0].texto, /^Mañana: .*Clase abierta.*\.$/);
  });
  await como(otroU, async () => {
    const o = (await t.q(`select public.avisos_app_socio($1, $2) a`, [S().por_vencer, ahora]))[0].a;
    assert.equal(o.filter((x) => x.tipo === "evento_manana").length, 0);
  });
});

test("otro socio no puede pedir ni cambiar los avisos de este", async () => {
  await como(otroU, async () => {
    await t.falla(() => t.q(`select public.avisos_app_socio($1, $2)`, [S().al_dia, momento]), /permiso/i);
    await t.falla(() => t.q(`select public.guardar_aviso_clase($1, true)`, [S().al_dia]), /permiso/i);
  });
});
