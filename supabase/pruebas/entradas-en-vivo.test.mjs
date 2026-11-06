// VD-4 (4201): lo que pasó en la puerta desde un momento, para que todas las pantallas se enteren solas.
//   Sin cursor devuelve solo desde cuándo mirar; con cursor, las entradas e intentos nuevos (también los rechazos,
//   con `cobrar`); el aviso de préstamo lo ve el dueño y no la recepción; se apaga por gimnasio; otro gimnasio no lo pide.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir, HOY } from "./_comun.mjs";

let t, uDueno, uRec, uOtro, g2;
async function como(usuario, fn) {
  await t.db.query("set role authenticated");
  await t.q(`select set_config('request.jwt.claims', $1, false)`, [JSON.stringify({ sub: usuario, role: "authenticated" })]);
  try { return await fn(); } finally { await t.db.query("reset role"); await t.q(`select set_config('request.jwt.claims', '', false)`); }
}
before(async () => {
  t = await abrir("prueba-entradas-en-vivo");
  for (const rol of ["dueno", "recepcion"]) {
    const [{ id }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`${rol}${Math.random()}@ejemplo.invalid`]);
    await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,$3,$4)`, [t.g, id, rol, rol]);
    if (rol === "dueno") uDueno = id; else uRec = id;
  }
  [{ id: g2 }] = await t.q(`insert into public.gimnasios (slug, nombre) values ('prueba-entradas-en-vivo-2', 'Otro Gimnasio') returning id`);
  const [{ id }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`otro${Math.random()}@ejemplo.invalid`]);
  await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,'Otro','dueno')`, [g2, id]);
  uOtro = id;
});
after(async () => t && t.cerrar());

const reg = async (socio, m, via) =>
  (await t.q(`select privado.registrar_ingreso($1, $2, $3, null, null, null, $4) as r`, [socio, t.sede, via, m]))[0].r;
const desde = (usuario, d = null, g = () => t.g) => como(usuario, async () =>
  (await t.q(`select public.entradas_desde($1, null, coalesce($2::timestamptz, now() - interval '1 minute')) as r`, [g(), d]))[0].r);

test("sin cursor devuelve solo desde cuándo mirar, y con ese cursor no llega lo anterior", async () => {
  const r = await como(uRec, async () => (await t.q(`select public.entradas_desde($1, null, null) as r`, [t.g]))[0].r);
  assert.deepEqual(r.entradas, []);
  assert.deepEqual(r.alertas, []);
  assert.equal(r.avisar, true);
  assert.ok(r.hasta);
  await reg(t.ctx.socios.al_dia, await t.en(HOY, "09:00:00"), "qr_pared");
  const despues = await como(uRec, async () => (await t.q(`select public.entradas_desde($1, null, $2::timestamptz) as r`, [t.g, r.hasta]))[0].r);
  assert.deepEqual(despues.entradas, [], "lo que se anotó antes del cursor no vuelve");
});

test("las entradas y los rechazos llegan, y el rechazo trae Cobrar", async () => {
  await reg(t.ctx.socios.vencida, await t.en(HOY, "09:05:00"), "kiosco");
  const r = await desde(uRec);
  assert.ok(r.entradas.length >= 2, "llegan las dos (el caso testigo trae además sus entradas sembradas)");
  const ok = r.entradas.find((x) => x.socio_id === t.ctx.socios.al_dia);
  const no = r.entradas.find((x) => x.socio_id === t.ctx.socios.vencida);
  assert.equal(ok.resultado, "entro");
  assert.equal(ok.via_acceso, "qr_pared");
  assert.equal(ok.cobrar, false);
  assert.equal(no.resultado, "rechazado");
  assert.equal(no.cobrar, true);
  assert.match(no.socio, /Vencida/);
  assert.ok(no.texto);
});

test("el aviso de préstamo lo ve el dueño y no la recepción", async () => {
  const s = t.ctx.socios.por_vencer;
  const m = await t.en(HOY, "10:00:00");
  await reg(s, m, "recepcion");
  await reg(s, new Date(new Date(m).getTime() + 4 * 60_000), "qr_pared");
  const d = await desde(uDueno);
  assert.equal(d.alertas.length, 1);
  assert.equal(d.alertas[0].socio_id, s);
  assert.equal(d.alertas[0].minutos, 4);
  const r = await desde(uRec);
  assert.deepEqual(r.alertas, []);
  assert.equal(d.entradas.filter((x) => x.socio_id === s).length, 1, "el repetido no es una entrada más");
});

test("se apaga por gimnasio y solo el dueño o el encargado lo cambia", async () => {
  await como(uRec, () => t.falla(() => t.q(`select public.guardar_config_visita($1, '{"avisar_en_vivo": false}'::jsonb)`, [t.g]), /permiso|rol|acceso/i));
  await como(uDueno, () => t.falla(() => t.q(`select public.guardar_config_visita($1, '{"avisar_en_vivo": "no"}'::jsonb)`, [t.g]), /sí o no/));
  await como(uDueno, () => t.q(`select public.guardar_config_visita($1, '{"avisar_en_vivo": false}'::jsonb)`, [t.g]));
  assert.equal((await desde(uRec)).avisar, false);
  await como(uDueno, () => t.q(`select public.guardar_config_visita($1, '{"avisar_en_vivo": true}'::jsonb)`, [t.g]));
  assert.equal((await desde(uRec)).avisar, true);
});

test("otro gimnasio no pide las entradas de este, y sin sesión tampoco", async () => {
  await como(uOtro, () => t.falla(() => t.q(`select public.entradas_desde($1, null, now() - interval '1 minute')`, [t.g]), /permiso|rol|acceso/i));
  await t.db.query("set role anon");
  try {
    await t.falla(() => t.q(`select public.entradas_desde($1, null, now() - interval '1 minute')`, [t.g]), /permission denied|permiso/i);
  } finally { await t.db.query("reset role"); }
});
