// VD-48 (20261107004800): la salida es opcional, configurable y un hecho. Todo con momentos fijos.
//   entrar -> salir -> "adentro" baja; salida sin entrada abierta no rompe; obligatoria avisa; sin salida la visita se cierra sola;
//   reingreso tras la salida no consume; otro gimnasio no puede; permisos por rol; la tablet y el QR de la pared.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir, HOY } from "./_comun.mjs";

let t, uDueno, uRec, uProfe, uOtro, gOtro, sedeOtra, token;
const crear = async (g, rol) => {
  const [{ id }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`${rol}${Math.random()}@ejemplo.invalid`]);
  await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,$3,$4)`, [g, id, rol, rol]);
  return id;
};
async function como(usuario, fn) {
  await t.db.query("set role authenticated");
  await t.q(`select set_config('request.jwt.claims', $1, false)`, [JSON.stringify({ sub: usuario, role: "authenticated" })]);
  try { return await fn(); } finally { await t.db.query("reset role"); await t.q(`select set_config('request.jwt.claims', '', false)`); }
}
async function comoTablet(fn) {
  await t.db.query("set role anon");
  await t.q(`select set_config('request.jwt.claims', '{"role":"anon"}', false)`);
  try { return await fn(); } finally { await t.db.query("reset role"); await t.q(`select set_config('request.jwt.claims', '', false)`); }
}
async function comoServidor(fn) {
  await t.db.query("set role service_role");
  await t.q(`select set_config('request.jwt.claims', '{"role":"service_role"}', false)`);
  try { return await fn(); } finally { await t.db.query("reset role"); await t.q(`select set_config('request.jwt.claims', '', false)`); }
}
before(async () => {
  t = await abrir("prueba-salida-opcional");
  uDueno = await crear(t.g, "dueno"); uRec = await crear(t.g, "recepcion"); uProfe = await crear(t.g, "profe");
  const [{ id }] = await t.q(`insert into public.gimnasios (slug, nombre) values ('otro-salida', 'Otro Gimnasio') returning id`);
  gOtro = id;
  sedeOtra = (await t.q(`select id from public.sedes where gimnasio_id = $1`, [gOtro]))[0].id;
  uOtro = await crear(gOtro, "recepcion");
  await t.q(`update public.configuracion_gimnasio set accesos_activos = array['recepcion','kiosco','qr_socio','qr_pared'] where gimnasio_id = $1`, [t.g]);
  token = (await como(uDueno, async () => (await t.q(`select public.autorizar_tablet($1, $2, 'Puerta') as r`, [t.g, t.sede]))[0].r)).token;
});
after(async () => t && t.cerrar());

const sumar = (m, minutos) => new Date(new Date(m).getTime() + minutos * 60_000);
const modo = (m) => t.q(`insert into public.configuracion_visita (gimnasio_id, registrar_salida) values ($1, $2)
                         on conflict (gimnasio_id) do update set registrar_salida = $2`, [t.g, m]);
const entrar = async (socio, m, via = "recepcion") =>
  (await t.q(`select privado.registrar_ingreso($1, $2, $3, null, null, null, $4) as r`, [socio, t.sede, via, m]))[0].r;
const salir = async (socio, m, via = "recepcion") =>
  (await t.q(`select privado.registrar_salida($1, $2, $3, null, null, $4) as r`, [socio, t.sede, via, m]))[0].r;
const adentro = async (m) => (await t.q(`select privado.adentro_ahora($1, $2, $3) as n`, [t.g, t.sede, m]))[0].n;
const salidas = async (socio) => (await t.q(`select count(*)::int n from public.salidas where socio_id = $1`, [socio]))[0].n;
const packs = async (socio) => (await t.q(`select count(*)::int n from public.consumos_pack where socio_id = $1 and anulado_en is null`, [socio]))[0].n;

test("por defecto la salida está apagada: registrarla es un error y 'adentro' sigue aproximado", async () => {
  const s = t.ctx.socios.al_dia;
  const m = await t.en(HOY, "10:00:00");
  await entrar(s, m);
  await t.falla(() => salir(s, sumar(m, 80)), /no registra la salida/);
  const d = await como(uDueno, async () => (await t.q(`select public.numeros_inicio($1) as n`, [t.g]))[0].n);
  const a = d.numeros.find((n) => n.clave === "adentro");
  assert.equal(a.etiqueta, "Adentro (aprox.)");
  assert.equal(d.adentro_exacto, false);
});

test("opcional: entrar -> salir -> 'adentro' baja, y dice 'Chau, estuviste 1 h 20'", async () => {
  await modo("opcional");
  const s = t.ctx.socios.en_tolerancia;
  const m = await t.en(HOY, "15:00:00");
  const antes = await adentro(sumar(m, 10));
  await entrar(s, m);
  assert.equal(await adentro(sumar(m, 10)), antes + 1);
  const r = await salir(s, sumar(m, 80));
  assert.equal(r.registrada, true);
  assert.equal(r.texto, "Chau Testigo, estuviste 1 h 20");
  assert.equal(r.minutos, 80);
  assert.equal(await adentro(sumar(m, 81)), antes, "al salir, 'adentro' baja");
  assert.equal(await adentro(sumar(m, 79)), antes + 1, "antes de la salida seguía adentro (la cuenta es por momento)");
  assert.equal(await salidas(s), 1);
});

test("la duración se dice corta: 45 min, 2 h, 1 h 05", async () => {
  const [a, b, c] = ["al_dia", "por_vencer", "en_tolerancia"].map((k) => t.ctx.socios[k]);
  const m = await t.en(HOY, "02:00:00");
  for (const [s, min, esperado] of [[a, 45, "45 min"], [b, 120, "2 h"], [c, 65, "1 h 05"]]) {
    await entrar(s, m, "recepcion");
    const r = await salir(s, sumar(m, min));
    assert.equal(r.registrada, true);
    assert.match(r.texto, new RegExp(`estuviste ${esperado}$`));
  }
});

test("una salida sin entrada abierta no rompe nada: 'no tenía entrada abierta'", async () => {
  const s = t.ctx.socios.vence_hoy;
  const m = await t.en(HOY, "12:00:00");
  const r1 = await salir(s, m);   // nunca entró
  assert.equal(r1.registrada, false);
  assert.match(r1.texto, /No tenía entrada abierta/);
  assert.equal(await salidas(s), 0);
  await entrar(s, m);
  const r2 = await salir(s, sumar(m, 30));
  assert.equal(r2.registrada, true);
  const r3 = await salir(s, sumar(m, 31));   // ya salió
  assert.equal(r3.registrada, false);
  assert.equal(await salidas(s), 1, "una sola salida por entrada");
  const r4 = await salir(s, sumar(m, 6 * 60));   // la visita ya se había cerrado sola
  assert.equal(r4.registrada, false);
});

test("sin salida marcada, la visita se cierra sola a las N horas (visita_horas)", async () => {
  const s = t.ctx.socios.en_tolerancia;
  const m = await t.en(HOY, "08:00:00");
  const a = sumar(m, 4 * 60 + 59), b = sumar(m, 5 * 60 + 1), c = sumar(m, 2 * 60 + 1);
  const antes = [await adentro(a), await adentro(b)];
  await entrar(s, m);
  assert.equal(await adentro(a), antes[0] + 1);
  assert.equal(await adentro(b), antes[1], "a las 5 h ya no cuenta");
  const antes2 = await adentro(c);
  await t.q(`update public.configuracion_visita set visita_horas = 2 where gimnasio_id = $1`, [t.g]);
  assert.equal(await adentro(c), antes2 - 1, "con visita de 2 h se cierra a las 2 h");
  await t.q(`update public.configuracion_visita set visita_horas = 5 where gimnasio_id = $1`, [t.g]);
});

test("obligatoria: entrar de nuevo sin haber salido avisa y ofrece salir; opcional solo lo ofrece", async () => {
  const s = t.ctx.socios.por_vencer;
  const m = await t.en(HOY, "21:10:00");
  await modo("obligatoria");
  const r1 = await entrar(s, m);
  assert.equal(r1.repetido, false);
  const r2 = await entrar(s, sumar(m, 90));
  assert.equal(r2.repetido, true);
  assert.equal(r2.texto, "Ya entró a las 21:10 y no marcó la salida: ¿se va?");
  assert.equal(r2.avisar_salida, true);
  assert.equal(r2.puede_salir, true);
  const r3 = await entrar(s, sumar(m, 91), "qr_socio");
  assert.match(r3.texto, /^Ya entraste a las 21:10 y no marcaste la salida/);
  // con 'opcional' el texto es el de siempre, pero igual se ofrece
  const s2 = t.ctx.socios.al_dia;
  await modo("opcional");
  await entrar(s2, m);
  const o = await entrar(s2, sumar(m, 90));
  assert.equal(o.texto, "Ya entró a las 21:10");
  assert.equal(o.puede_salir, true);
  assert.equal(o.avisar_salida, false);
  // con 'no' no ofrece nada
  const s3 = t.ctx.socios.vence_hoy;
  await modo("no");
  await entrar(s3, m);
  const n = await entrar(s3, sumar(m, 90));
  assert.equal(n.puede_salir, false);
});

test("reingreso: después de salir, volver dentro de la visita es entrada nueva y NO consume otra clase", async () => {
  await modo("opcional");
  const s = t.ctx.socios.pack_con_clases;
  const m = await t.en(HOY, "10:00:00");
  const antes = await packs(s);
  const r1 = await entrar(s, m);
  assert.equal(r1.repetido, false);
  assert.equal(await packs(s), antes + 1);
  await salir(s, sumar(m, 30));
  const r2 = await entrar(s, sumar(m, 60));
  assert.equal(r2.repetido, false);
  assert.equal(r2.reingreso, true);
  assert.notEqual(r2.ingreso_id, r1.ingreso_id);
  assert.equal(await packs(s), antes + 1, "la clase de esta visita ya estaba usada");
  assert.match(r2.veredicto.texto, /^Volvió a entrar \(había salido a las 10:30\)$/);
  assert.equal(r2.veredicto.color, r1.veredicto.color);
  // y la nueva entrada queda abierta: adentro cuenta una vez
  const base = await adentro(sumar(m, 61));
  await salir(s, sumar(m, 100));
  assert.equal(await adentro(sumar(m, 101)), base - 1);
  assert.equal(await salidas(s), 2);
});

test("nunca cambia quién puede entrar: el veredicto de calcular_acceso es el mismo con la salida prendida o apagada", async () => {
  const m = await t.en(HOY, "20:00:00");
  const ver = async () => (await t.q(`select to_jsonb(privado.calcular_acceso(id, $2, $3)) v, id from public.socios where gimnasio_id = $1 order by id`, [t.g, m, t.sede])).map((x) => x.v);
  await modo("no");
  const a = await ver();
  await modo("obligatoria");
  const b = await ver();
  assert.deepEqual(b, a);
  await modo("no");
});

test("permisos: la recepción del gimnasio marca la salida; el profe y la recepción de otro gimnasio, no", async () => {
  await modo("opcional");
  const s = t.ctx.socios.al_dia;
  const [{ id: nuevo }] = await t.q(`select id from public.socios where gimnasio_id = $1 and id <> $2 limit 1`, [t.g, s]);
  void nuevo;
  const r = await como(uRec, async () => (await t.q(`select public.registrar_salida($1, $2, 'recepcion') as r`, [s, t.sede]))[0].r);
  assert.equal(typeof r.registrada, "boolean");
  await como(uProfe, () => t.falla(() => t.q(`select public.registrar_salida($1, $2, 'recepcion')`, [s, t.sede]), /Sin permiso/));
  await como(uOtro, () => t.falla(() => t.q(`select public.registrar_salida($1, $2, 'recepcion')`, [s, t.sede]), /Sin permiso/));
  await como(uOtro, () => t.falla(() => t.q(`select public.registrar_salida($1, $2, 'recepcion')`, [s, sedeOtra]), /Sin permiso/));
  // un usuario sin sesión (anon) tampoco, ni elegir una vía de dispositivo desde una sesión de persona
  await comoTablet(() => t.falla(() => t.q(`select public.registrar_salida($1, $2, 'recepcion')`, [s, t.sede]), /permission denied|Sin permiso/));
  await como(uRec, () => t.falla(() => t.q(`select public.registrar_salida($1, $2, 'kiosco')`, [s, t.sede]), /por la vía recepción/));
});

test("las salidas son un hecho: no se escriben ni se borran directo, y el otro gimnasio no las lee", async () => {
  const s = t.ctx.socios.vence_hoy;
  const m = await t.en(HOY, "06:00:00");
  await modo("opcional");
  const n0 = await salidas(s);
  await entrar(s, m);
  await salir(s, sumar(m, 20));
  await como(uRec, () => t.falla(() => t.q(`delete from public.salidas where socio_id = $1`, [s]), /permission denied/));
  await como(uRec, () => t.falla(() => t.q(`update public.salidas set momento = now() where socio_id = $1`, [s]), /permission denied/));
  await como(uRec, () => t.falla(() => t.q(`insert into public.salidas (gimnasio_id, sede_id, ingreso_id, socio_id, momento, via_acceso) select gimnasio_id, sede_id, id, socio_id, now(), 'recepcion' from public.ingresos limit 1`), /permission denied/));
  assert.equal(await como(uRec, async () => (await t.q(`select count(*)::int n from public.salidas where socio_id = $1`, [s]))[0].n), n0 + 1);
  assert.equal(await como(uOtro, async () => (await t.q(`select count(*)::int n from public.salidas`))[0].n), 0, "RLS: el otro gimnasio no ve nada");
  await t.falla(() => t.q(`delete from public.salidas where socio_id = $1`, [s]), /no se borran/);
});

test("configuración: solo dueño y encargado la cambian, y solo no / opcional / obligatoria", async () => {
  const c = await como(uDueno, async () => (await t.q(`select public.guardar_config_visita($1, '{"registrar_salida":"obligatoria"}') as c`, [t.g]))[0].c);
  assert.equal(c.registrar_salida, "obligatoria");
  await como(uDueno, () => t.falla(() => t.q(`select public.guardar_config_visita($1, '{"registrar_salida":"siempre"}')`, [t.g]), /no, opcional u obligatoria/));
  await como(uRec, () => t.falla(() => t.q(`select public.guardar_config_visita($1, '{"registrar_salida":"no"}')`, [t.g]), /Sin permiso/));
  const lee = await como(uRec, async () => (await t.q(`select public.config_visita($1) as c`, [t.g]))[0].c);
  assert.equal(lee.registrar_salida, "obligatoria", "la recepción lo lee para saber si muestra el botón");
  await como(uDueno, () => t.q(`select public.guardar_config_visita($1, '{"registrar_salida":"opcional"}')`, [t.g]));
});

test("inicio con salida prendida: 'Adentro ahora' exacto", async () => {
  await modo("opcional");
  const d = await como(uDueno, async () => (await t.q(`select public.numeros_inicio($1) as n`, [t.g]))[0].n);
  assert.equal(d.adentro_exacto, true);
  assert.equal(d.numeros.find((n) => n.clave === "adentro").etiqueta, "Adentro ahora");
  assert.equal(d.disponibles.find((n) => n.clave === "adentro").etiqueta, "Adentro ahora");
});

test("tablet 'Me voy': con DNI; no dice si el DNI existe y no lleva nombre si no registró nada", async () => {
  await modo("opcional");
  assert.equal(await comoTablet(async () => (await t.q(`select public.kiosco_salida_activa($1) as a`, [token]))[0].a), true);
  const s = t.ctx.socios.al_dia;
  const dni = "30111222";
  await t.q(`update public.socios set dni = $2 where id = $1`, [s, dni]);
  const [{ ahora }] = await t.q(`select now() as ahora`);
  await entrar(s, sumar(ahora, -30), "kiosco");
  const r = await comoTablet(async () => (await t.q(`select public.kiosco_salir($1, $2) as r`, [token, dni]))[0].r);
  assert.equal(r.registrada, true);
  assert.match(r.texto, /^Chau Testigo, estuviste (29|30) min$/);
  const otra = await comoTablet(async () => (await t.q(`select public.kiosco_salir($1, $2) as r`, [token, dni]))[0].r);
  const noExiste = await comoTablet(async () => (await t.q(`select public.kiosco_salir($1, '99999999') as r`, [token]))[0].r);
  assert.deepEqual(otra, noExiste, "ya salió y el DNI inexistente contestan igual");
  assert.equal(otra.nombre, undefined);
  await comoTablet(() => t.falla(() => t.q(`select public.kiosco_salir('token-que-no-existe', $1)`, [dni]), /no está autorizada/));
  await modo("no");
  await comoTablet(() => t.falla(() => t.q(`select public.kiosco_salir($1, $2)`, [token, dni]), /no registra la salida/));
  assert.equal(await comoTablet(async () => (await t.q(`select public.kiosco_salida_activa($1) as a`, [token]))[0].a), false);
});

test("servidor (kiosco / QR): registra la salida con el dispositivo de su sede; uno de otra sede no", async () => {
  await modo("opcional");
  const s = t.ctx.socios.por_vencer;
  const [{ ahora }] = await t.q(`select now() as ahora`);
  const [{ id: disp }] = await t.q(`select id from public.dispositivos where gimnasio_id = $1 limit 1`, [t.g]);
  await entrar(s, sumar(ahora, -10), "qr_pared");
  const r = await comoServidor(async () => (await t.q(`select public.registrar_salida($1, $2, 'qr_pared', $3) as r`, [s, t.sede, disp]))[0].r);
  assert.equal(r.registrada, true);
  const [{ via_acceso, dispositivo_id }] = await t.q(`select via_acceso, dispositivo_id from public.salidas where ingreso_id = $1`, [r.ingreso_id]);
  assert.equal(via_acceso, "qr_pared");
  assert.equal(dispositivo_id, disp);
  await comoServidor(() => t.falla(() => t.q(`select public.registrar_salida($1, $2, 'kiosco', $3)`, [s, sedeOtra, disp]), /Sede inválida|Dispositivo revocado/));
});

test("QR de la pared: el socio con sesión se va con el código de la tablet; con un código inválido no", async () => {
  await modo("opcional");
  const [{ usuario }] = await t.q(`insert into auth.users (email) values ('socio-salida@ejemplo.invalid') returning id as usuario`);
  const s = t.ctx.socios.vence_hoy;
  await t.q(`update public.socios set usuario_id = $2 where id = $1`, [s, usuario]);
  assert.equal(await como(usuario, async () => (await t.q(`select public.registra_salida($1) as m`, [t.g]))[0].m), "opcional");
  const { codigo } = await comoTablet(async () => (await t.q(`select public.kiosco_qr($1) as r`, [token]))[0].r);
  const [{ ahora }] = await t.q(`select now() as ahora`);
  await entrar(s, sumar(ahora, -45), "qr_pared");
  const r = await como(usuario, async () => (await t.q(`select public.salir_por_qr_pared($1, $2, $3) as r`, [t.g, s, codigo]))[0].r);
  assert.equal(r.registrada, true);
  assert.match(r.texto, /^Chau Testigo, estuviste 4[45] min$/);
  await como(usuario, () => t.falla(() => t.q(`select public.salir_por_qr_pared($1, $2, 'GYMOSP1.basura')`, [t.g, s]), /no es el QR/));
  await como(uRec, () => t.falla(() => t.q(`select public.salir_por_qr_pared($1, $2, $3)`, [t.g, s, codigo]), /Sin permiso para ese socio/));
});
