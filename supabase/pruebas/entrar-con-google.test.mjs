// VD-22 (0162): entrar con Google. El Google se vincula a un socio SOLO con su DNI + un código verificado en el
// celular o mail que el gimnasio cargó; nunca por nombre ni por un mail suelto. Un Google vinculado a un socio no
// entra a otro; el que ya tiene a otra persona, o un socio que ya tiene otro Google, piden confirmar; el código
// del celular recupera al socio que sostiene un Google; el vínculo es solo del servidor y la RLS lo cuida.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir } from "./_comun.mjs";

let t;
before(async () => { t = await abrir("prueba-entrar-google"); });
after(async () => t && t.cerrar());
async function comoServidor(fn) {
  await t.db.query("savepoint v");
  await t.db.query("set local role service_role");
  await t.q(`select set_config('request.jwt.claims', '{"role":"service_role"}', true)`);
  try { return await fn(); } finally { await t.db.query("reset role"); await t.db.query("release savepoint v"); }
}
const sufijo = () => String(Date.now() % 100000) + Math.floor(Math.random() * 90 + 10);
const usuarioGoogle = async (mail) => (await t.q(
  `insert into auth.users (email, email_confirmed_at, raw_app_meta_data, last_sign_in_at)
   values ($1, now(), '{"provider":"google","providers":["google"]}', now()) returning id`, [mail]))[0].id;
const usuarioCelular = async (tel, opciones = {}) => (await t.q(
  `insert into auth.users (phone, phone_confirmed_at, last_sign_in_at) values ($1, $2, $3) returning id`,
  [tel.replace("+", ""), opciones.sinConfirmar ? null : new Date(), opciones.ingreso ?? new Date()]))[0].id;
const socio = async (nombre, apellido, dni, tel, extra = "") => (await t.q(
  `insert into public.socios (gimnasio_id, nombre, apellido, dni, telefono, email) values ($1,$2,$3,$4,$5,$6) returning id`,
  [t.g, nombre, apellido, dni, tel, extra || null]))[0].id;
const vincular = (g, dni, p, confirmar = false) => comoServidor(async () =>
  (await t.q(`select public.vincular_google($1, $2, $3, $4, $5) r`, [t.g, g, dni, p, confirmar]))[0].r);
const sesion = (u) => t.comoUsuario(u, async () => (await t.q(`select public.mi_sesion() r`))[0].r);

test("vincula con DNI + código; sin una de las dos cosas, no", async () => {
  const k = sufijo();
  const telA = `+54900008${k.padStart(7, "0").slice(-7)}`;
  const a = await socio("Gabi", `Google ${k}`, `31${k.padStart(6, "0").slice(-6)}`, telA);
  const dniA = (await t.q(`select dni from public.socios where id = $1`, [a]))[0].dni;
  const g = await usuarioGoogle(`g-${k}@ejemplo.invalid`);
  const pA = await usuarioCelular(telA);
  const pOtro = await usuarioCelular(`+54900009${k.padStart(7, "0").slice(-7)}`);
  const pSinConfirmar = await usuarioCelular(telA.replace("+54900008", "+54900007"), { sinConfirmar: true });
  const pViejo = await usuarioCelular(`+54900006${k.padStart(7, "0").slice(-7)}`, { ingreso: new Date(Date.now() - 3600_000) });
  const noGoogle = (await t.q(`insert into auth.users (email, email_confirmed_at, last_sign_in_at) values ($1, now(), now()) returning id`, [`n-${k}@ejemplo.invalid`]))[0].id;

  await t.comoUsuario(g, () => t.falla(() => t.q(`select public.vincular_google($1, $2, $3, $4, false)`, [t.g, g, dniA, pA]), /permission denied|servidor/));
  await comoServidor(() => t.falla(() => t.q(`select public.vincular_google($1, $2, $3, $4, false)`, [t.g, g, "00000000", pA]), /no son correctos/));
  await comoServidor(() => t.falla(() => t.q(`select public.vincular_google($1, $2, $3, $4, false)`, [t.g, g, dniA, pOtro]), /no son correctos/));
  await comoServidor(() => t.falla(() => t.q(`select public.vincular_google($1, $2, $3, $4, false)`, [t.g, g, dniA, pSinConfirmar]), /no son correctos/));
  await comoServidor(() => t.falla(() => t.q(`select public.vincular_google($1, $2, $3, $4, false)`, [t.g, g, dniA, pViejo]), /no son correctos/));
  await comoServidor(() => t.falla(() => t.q(`select public.vincular_google($1, $2, $3, $4, false)`, [t.g, noGoogle, dniA, pA]), /no entró con Google/));
  assert.equal((await t.q(`select usuario_id from public.socios where id = $1`, [a]))[0].usuario_id, null, "ninguno de los intentos vinculó");

  const r = await vincular(g, dniA, pA);
  assert.equal(r.estado, "vinculado");
  assert.equal(r.metodo, "celular");
  assert.equal((await t.q(`select usuario_id from public.socios where id = $1`, [a]))[0].usuario_id, g);
  const v = await t.q(`select * from public.vinculos_google where socio_id = $1`, [a]);
  assert.equal(v.length, 1);
  assert.equal(v[0].usuario_id, g);
  assert.equal(v[0].revocado_en, null);
  assert.equal((await sesion(g)).socios.length, 1, "el Google vinculado ve a su socio");
});

test("no vincula por nombre ni por un mail suelto, y un Google vinculado no entra al socio ajeno", async () => {
  const k = sufijo();
  const telA = `+54900005${k.padStart(7, "0").slice(-7)}`;
  const telB = `+54900004${k.padStart(7, "0").slice(-7)}`;
  const mailB = `bea-${k}@ejemplo.invalid`;
  const a = await socio("Ana", `Propia ${k}`, `32${k.padStart(6, "0").slice(-6)}`, telA);
  const b = await socio("Bea", `Ajena ${k}`, `33${k.padStart(6, "0").slice(-6)}`, telB, mailB);
  const gA = await usuarioGoogle(`ana-${k}@ejemplo.invalid`);
  await vincular(gA, (await t.q(`select dni from public.socios where id = $1`, [a]))[0].dni, await usuarioCelular(telA));
  // Un Google con el MISMO mail (y hasta el mismo nombre) que la ficha de Bea: sin DNI + código no es Bea.
  const intruso = (await t.q(
    `insert into auth.users (email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, last_sign_in_at)
     values ($1, now(), '{"provider":"google","providers":["google"]}', '{"full_name":"Bea Ajena"}', now()) returning id`, [`otro-${k}@ejemplo.invalid`]))[0].id;
  const n = await comoServidor(async () => (await t.q(`select public.entrar_con_google($1, $2) n`, [t.g, intruso]))[0].n);
  assert.equal(n, 0, "entrar con Google sin vínculo no da ningún socio");
  assert.equal((await sesion(intruso)).socios.length, 0);
  // El Google de Ana entra solo a Ana, aunque pida entrar al gimnasio de Bea.
  const entra = await comoServidor(async () => (await t.q(`select public.entrar_con_google($1, $2) n`, [t.g, gA]))[0].n);
  assert.equal(entra, 1);
  const socios = (await sesion(gA)).socios.map((s) => s.socio_id);
  assert.deepEqual(socios, [a]);
  assert.equal((await t.q(`select usuario_id from public.socios where id = $1`, [b]))[0].usuario_id, null, "Bea sigue sin cuenta");
  // El mail de Bea, confirmado en un Google, tampoco alcanza para vincularla: hace falta su DNI y el código de SU celular.
  const gMail = (await t.q(
    `insert into auth.users (email, email_confirmed_at, raw_app_meta_data, last_sign_in_at)
     values ($1, now(), '{"provider":"google","providers":["google"]}', now()) returning id`, [`distinto-${k}@ejemplo.invalid`]))[0].id;
  const dniB = (await t.q(`select dni from public.socios where id = $1`, [b]))[0].dni;
  await comoServidor(() => t.falla(() => t.q(`select public.vincular_google($1, $2, $3, $4, false)`, [t.g, gMail, dniB, gA]), /no son correctos/));
});

test("pide confirmar si el Google ya tiene a otra persona o el socio ya tiene otro Google; el código del celular recupera al socio", async () => {
  const k = sufijo();
  const telA = `+54900003${k.padStart(7, "0").slice(-7)}`;
  const telB = `+54900002${k.padStart(7, "0").slice(-7)}`;
  const a = await socio("Carla", `Uno ${k}`, `34${k.padStart(6, "0").slice(-6)}`, telA);
  const b = await socio("Dario", `Dos ${k}`, `35${k.padStart(6, "0").slice(-6)}`, telB);
  const dniA = (await t.q(`select dni from public.socios where id = $1`, [a]))[0].dni;
  const dniB = (await t.q(`select dni from public.socios where id = $1`, [b]))[0].dni;
  const g = await usuarioGoogle(`c-${k}@ejemplo.invalid`);
  const pA = await usuarioCelular(telA);
  const pB = await usuarioCelular(telB);
  await vincular(g, dniA, pA);

  // El mismo Google quiere sumar a Darío, que es otra persona (otro celular): pide confirmar y no cambia nada.
  const c1 = await vincular(g, dniB, pB);
  assert.equal(c1.estado, "confirmar");
  assert.deepEqual(c1.otros, [`Carla Uno ${k}`]);
  assert.equal((await t.q(`select usuario_id from public.socios where id = $1`, [b]))[0].usuario_id, null);
  assert.equal((await vincular(g, dniB, pB, true)).estado, "vinculado");
  assert.deepEqual((await sesion(g)).socios.map((s) => s.socio_id).sort(), [a, b].sort());

  // Otro Google quiere quedarse con Carla (prueba el celular de Carla): pide confirmar; al confirmar, el viejo la pierde.
  const g2 = await usuarioGoogle(`c2-${k}@ejemplo.invalid`);
  const c2 = await vincular(g2, dniA, pA);
  assert.equal(c2.estado, "confirmar");
  assert.equal(c2.otra_cuenta, true);
  assert.equal((await vincular(g2, dniA, pA, true)).estado, "vinculado");
  const activos = await t.q(`select usuario_id from public.vinculos_google where socio_id = $1 and revocado_en is null`, [a]);
  assert.deepEqual(activos.map((x) => x.usuario_id), [g2], "un solo Google activo por socio");
  const vuelve = await comoServidor(async () => (await t.q(`select public.entrar_con_google($1, $2) n`, [t.g, g]))[0].n);
  assert.equal(vuelve, 1, "el Google viejo conserva solo a Darío");
  assert.deepEqual((await sesion(g)).socios.map((s) => s.socio_id), [b]);

  // Darío entra con el código de su celular: recupera su cuenta (si no, quien vinculó Google no podría usar el celular).
  const recuperados = await comoServidor(async () => (await t.q(`select public.vincular_socios_por_telefono($1, $2) n`, [t.g, pB]))[0].n);
  assert.equal(recuperados, 1);
  assert.equal((await t.q(`select usuario_id from public.socios where id = $1`, [b]))[0].usuario_id, pB);
  // ...y al volver con Google, vuelve a su cuenta de Google.
  assert.equal(await comoServidor(async () => (await t.q(`select public.entrar_con_google($1, $2) n`, [t.g, g]))[0].n), 1);
  assert.equal((await t.q(`select usuario_id from public.socios where id = $1`, [b]))[0].usuario_id, g);
  // Una cuenta que NO es del Google vinculado no se lleva al socio con el código de otro celular.
  const intruso = await usuarioCelular(`+54900001${k.padStart(7, "0").slice(-7)}`);
  assert.equal(await comoServidor(async () => (await t.q(`select public.vincular_socios_por_telefono($1, $2) n`, [t.g, intruso]))[0].n), 0);
});

test("el menor se prueba con el celular del responsable; el mail es solo de adultos", async () => {
  const k = sufijo();
  const telR = `+54900010${k.padStart(6, "0").slice(-6)}`;
  const menor = (await t.q(
    `insert into public.socios (gimnasio_id, nombre, apellido, dni, fecha_nacimiento, email, responsable_nombre, responsable_telefono)
     values ($1,'Mini',$2,$3, now()::date - 3650, $4, 'Mamá', $5) returning id`,
    [t.g, `Menor ${k}`, `36${k.padStart(6, "0").slice(-6)}`, `mini-${k}@ejemplo.invalid`, telR]))[0].id;
  const dni = (await t.q(`select dni from public.socios where id = $1`, [menor]))[0].dni;
  const contacto = await comoServidor(async () => (await t.q(`select public.socio_para_vincular_google($1, $2) r`, [t.g, dni]))[0].r);
  assert.equal(contacto.telefono, telR);
  assert.equal(contacto.email, null, "al menor no se le manda código al mail");
  const g = await usuarioGoogle(`m-${k}@ejemplo.invalid`);
  const porMail = (await t.q(`insert into auth.users (email, email_confirmed_at, last_sign_in_at) values ($1, now(), now()) returning id`, [`mini-${k}@ejemplo.invalid`]))[0].id;
  await comoServidor(() => t.falla(() => t.q(`select public.vincular_google($1, $2, $3, $4, false)`, [t.g, g, dni, porMail]), /no son correctos/));
  assert.equal((await vincular(g, dni, await usuarioCelular(telR))).estado, "vinculado");
  assert.equal(await comoServidor(async () => (await t.q(`select public.socio_para_vincular_google($1, '99999999') r`, [t.g]))[0].r), null);
  await t.comoUsuario(g, () => t.falla(() => t.q(`select public.socio_para_vincular_google($1, $2)`, [t.g, dni]), /permission denied|servidor/));
});

test("RLS: cada uno ve solo sus vínculos y nadie escribe la tabla", async () => {
  const k = sufijo();
  const telA = `+54900011${k.padStart(6, "0").slice(-6)}`;
  const a = await socio("Eva", `Rls ${k}`, `37${k.padStart(6, "0").slice(-6)}`, telA);
  const g = await usuarioGoogle(`e-${k}@ejemplo.invalid`);
  const otro = await usuarioGoogle(`f-${k}@ejemplo.invalid`);
  await vincular(g, (await t.q(`select dni from public.socios where id = $1`, [a]))[0].dni, await usuarioCelular(telA));
  assert.equal((await t.comoUsuario(g, () => t.q(`select id from public.vinculos_google`))).length, 1);
  assert.equal((await t.comoUsuario(otro, () => t.q(`select id from public.vinculos_google`))).length, 0, "el otro no ve el vínculo ajeno");
  await t.comoUsuario(g, () => t.falla(() => t.q(`update public.vinculos_google set revocado_en = now()`), /permission denied/));
  await t.comoUsuario(g, () => t.falla(() => t.q(`delete from public.vinculos_google`), /permission denied/));
  await t.comoUsuario(g, () => t.falla(() => t.q(`insert into public.vinculos_google (gimnasio_id, usuario_id, socio_id, metodo) values ($1,$2,$3,'mail')`, [t.g, g, a]), /permission denied/));
});
