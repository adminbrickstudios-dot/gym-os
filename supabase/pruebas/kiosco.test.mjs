// Tablet en la puerta (0050): el dueño la autoriza (token visible una vez),
// el socio entra con su DNI o QR; si no puede, ve por qué y no entra; la
// tablet revocada o con la forma apagada no anda; el token no se lee.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir } from "./_comun.mjs";

let t, dueno, enc;
before(async () => {
  t = await abrir("prueba-kiosco");
  for (const r of ["dueno", "encargado"]) {
    const [{ id }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`${r}${Math.random()}@ejemplo.invalid`]);
    await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,$3,$4)`, [t.g, id, r, r]);
    if (r === "dueno") dueno = id; else enc = id;
  }
  await t.q(`update public.configuracion_gimnasio set accesos_activos = array['recepcion','kiosco'] where gimnasio_id = $1`, [t.g]);
});
after(async () => t && t.cerrar());

async function comoDueno(fn) {
  await t.q(`set local role authenticated`);
  await t.q(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: dueno, role: "authenticated" })]);
  try { return await fn(); } finally { await t.q(`reset role`); }
}
async function comoTablet(fn) {
  await t.q(`set local role anon`);
  await t.q(`select set_config('request.jwt.claims', '{"role":"anon"}', true)`);
  try { return await fn(); } finally { await t.q(`reset role`); }
}
const entrar = (tok, codigo) => comoTablet(async () => (await t.q(`select public.kiosco_entrar($1, $2) as r`, [tok, codigo]))[0].r);

test("autorizar, entrar con DNI, rojo no entra, revocar", async () => {
  await t.comoUsuario(enc, () => t.falla(() => t.q(`select public.autorizar_tablet($1, $2, 'Puerta')`, [t.g, t.sede]), /Sin permiso/));
  const { token, id } = await comoDueno(async () => (await t.q(`select public.autorizar_tablet($1, $2, 'Puerta') as r`, [t.g, t.sede]))[0].r);
  assert.match(token, /^[A-Za-z0-9_-]{32}$/);
  const [{ h }] = await t.q(`select token_hash h from public.dispositivos_tokens where dispositivo_id = $1`, [id]);
  assert.notEqual(h, token, "se guarda el hash, no el token");
  await comoTablet(() => t.falla(() => t.q(`select * from public.dispositivos_tokens`), /permission denied/));

  await t.q(`update public.socios set dni = '30111222' where id = $1`, [t.ctx.socios.al_dia]);
  await t.q(`update public.socios set dni = '30111333' where id = $1`, [t.ctx.socios.vencida]);
  // Los casos testigo están armados para el 14/11; el kiosco mira ahora: alcanza con que cada uno dé lo que dice su veredicto.
  const verde = await entrar(token, "30.111.222");
  const [{ puede }] = await t.q(`select (privado.calcular_acceso($1, now())).puede`, [t.ctx.socios.al_dia]);
  assert.equal(verde.resultado, puede ? "entro" : "rechazado");
  assert.equal(verde.nombre, "Testigo");
  assert.ok(!("dni" in verde) && !("telefono" in verde));
  const rojo = await entrar(token, "30111333");
  assert.equal(rojo.resultado, "rechazado");
  assert.ok(rojo.texto.length > 0);
  assert.doesNotMatch(rojo.texto, /\$|debe/, "en la puerta no se muestra plata");
  await comoTablet(() => t.falla(() => t.q(`select public.kiosco_entrar($1, '99999999')`, [token]), /No encontramos ese DNI/));
  await comoTablet(() => t.falla(() => t.q(`select public.kiosco_entrar('inventado', '30111222')`), /no está autorizada/));
  const [{ via }] = await t.q(`select via_acceso via from public.ingresos where socio_id = $1 order by momento desc limit 1`, [t.ctx.socios.vencida]);
  assert.equal(via, "kiosco");

  await comoDueno(() => t.q(`select public.revocar_tablet($1)`, [id]));
  await comoTablet(() => t.falla(() => t.q(`select public.kiosco_estado($1)`, [token]), /no está autorizada/));
});

test("con la forma apagada la tablet no anda", async () => {
  const { token } = await comoDueno(async () => (await t.q(`select public.autorizar_tablet($1, $2, 'Otra') as r`, [t.g, t.sede]))[0].r);
  await t.q(`update public.configuracion_gimnasio set accesos_activos = array['recepcion'] where gimnasio_id = $1`, [t.g]);
  await comoTablet(() => t.falla(() => t.q(`select public.kiosco_estado($1)`, [token]), /apagada/));
});
