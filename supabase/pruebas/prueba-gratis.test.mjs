// VD-51 (20261107005100): prueba gratis, una vez por DNI y gimnasio. Cuenta como entrada pero no como socio activo.
//   La puerta dice verde "En prueba" ese día (o esa clase); la segunda vez dice el motivo; quien paga no cambia; los permisos.
//   Los momentos de la puerta son fijos (relativos a una clase o a un día); lo único que usa now() es el mostrador (dar_prueba_gratis).
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir } from "./_comun.mjs";

let t, uDueno, uEnc, uRec, uProfe, uOtro, gOtro, actividad;
const HOST = `prueba-${Date.now()}.ejemplo.invalid`;
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
async function comoAnonimo(fn) {
  await t.db.query("set role anon");
  await t.q(`select set_config('request.jwt.claims', '{"role":"anon"}', false)`);
  try { return await fn(); } finally { await t.db.query("reset role"); await t.q(`select set_config('request.jwt.claims', '', false)`); }
}
before(async () => {
  t = await abrir("prueba-prueba-gratis");
  uDueno = await crear(t.g, "dueno"); uEnc = await crear(t.g, "encargado"); uRec = await crear(t.g, "recepcion"); uProfe = await crear(t.g, "profe");
  const [{ id }] = await t.q(`insert into public.gimnasios (slug, nombre) values ('otro-prueba', 'Otro Gimnasio') returning id`);
  gOtro = id;
  uOtro = await crear(gOtro, "recepcion");
  actividad = (await t.q(`insert into public.actividades (gimnasio_id, nombre) values ($1, 'Funcional') returning id`, [t.g]))[0].id;
  await t.q(`insert into public.dominios_gimnasio (gimnasio_id, host, tipo) values ($1, $2, 'propio')`, [t.g, HOST]);
});
after(async () => t && t.cerrar());

const modo = (m) => t.q(`update public.configuracion_gimnasio set prueba_gratis = $2 where gimnasio_id = $1`, [t.g, m]);
const clase = async (inicioSql, cupo = null) => (await t.q(
  `insert into public.clases (gimnasio_id, sede_id, actividad_id, inicio, fin, cupo) select $1,$2,$3, m, m + interval '1 hour', $4::int from (select ${inicioSql} as m) s returning id, inicio, fin`,
  [t.g, t.sede, actividad, cupo]))[0];
const darSql = (args) => t.q(`select public.dar_prueba_gratis($1, $2, $3, $4, $5, $6, $7, $8) as r`, [t.g, t.sede, args.dni ?? null, args.nombre ?? null, args.apellido ?? null, args.tel ?? null, args.clase ?? null, args.socio ?? null]);
const mostrador = (usuario, args) => como(usuario, async () => (await darSql(args))[0].r);
const malMostrador = (usuario, args, patron) => como(usuario, () => t.falla(() => darSql(args), patron));
const acceso = async (socio, m) => (await t.q(`select to_jsonb(privado.calcular_acceso($1, $2, $3)) v`, [socio, m, t.sede]))[0].v;
const sumar = (m, minutos) => new Date(new Date(m).getTime() + minutos * 60_000);
const ahora = async () => (await t.q(`select now() as n`))[0].n;
const cuenta = async (sql, p = []) => (await t.q(sql, p))[0].n;

test("por defecto está apagada: nadie la da ni la reserva, y solo el dueño la prende", async () => {
  assert.equal((await como(uRec, async () => (await t.q(`select public.config_prueba_gratis($1) as c`, [t.g]))[0].c)).modo, "no");
  await malMostrador(uRec, { dni: "31000001", nombre: "Lola" }, /no da prueba gratis/);
  assert.deepEqual(await comoAnonimo(async () => (await t.q(`select public.clases_para_probar($1) as c`, [HOST]))[0].c), []);
  await como(uEnc, () => t.falla(() => t.q(`select public.guardar_prueba_gratis($1, 'dia')`, [t.g]), /Sin permiso|permiso/i));
  await como(uRec, () => t.falla(() => t.q(`select public.guardar_prueba_gratis($1, 'dia')`, [t.g]), /Sin permiso|permiso/i));
  await como(uDueno, () => t.falla(() => t.q(`select public.guardar_prueba_gratis($1, 'gratis')`, [t.g]), /1 día o 1 clase/));
  const c = await como(uDueno, async () => (await t.q(`select public.guardar_prueba_gratis($1, 'dia') as c`, [t.g]))[0].c);
  assert.equal(c.modo, "dia");
  await modo("no");
});

test("1 día: la recepción la da, entra en verde 'En prueba', cuenta como entrada y NO como socio activo", async () => {
  await modo("dia");
  const activosAntes = await cuenta(`select count(distinct socio_id)::int n from public.coberturas where gimnasio_id = $1 and anulada_en is null and desde <= now() and hasta > now()`, [t.g]);
  const sociosAntes = await cuenta(`select count(*)::int n from public.socios where gimnasio_id = $1`, [t.g]);
  const r = await mostrador(uRec, { dni: "31.000.002", nombre: "Lola", apellido: "Prueba", tel: "387 555 0102" });
  assert.ok(r.socio_id && r.prueba_id);
  assert.equal(await cuenta(`select count(*)::int n from public.socios where gimnasio_id = $1`, [t.g]), sociosAntes + 1, "queda como socio sin plan");
  const m = await ahora();
  const v = await acceso(r.socio_id, m);
  assert.equal(v.puede, true); assert.equal(v.color, "verde"); assert.equal(v.motivo, "en_prueba"); assert.equal(v.via, "prueba");
  assert.match(v.texto, /^En prueba gratis/);
  // entra: queda en ingresos con la vía "prueba", sin consumir nada
  const e = (await t.q(`select privado.registrar_ingreso($1, $2, 'recepcion', null, null, null, null) as r`, [r.socio_id, t.sede]))[0].r;
  assert.equal(e.resultado, "entro");
  const [fila] = await t.q(`select via_habilitante, resultado from public.ingresos where socio_id = $1`, [r.socio_id]);
  assert.deepEqual(fila, { via_habilitante: "prueba", resultado: "entro" });
  assert.equal(await cuenta(`select count(*)::int n from public.consumos_pack where socio_id = $1`, [r.socio_id]), 0);
  assert.equal(await cuenta(`select count(*)::int n from public.suscripciones where socio_id = $1`, [r.socio_id]), 0, "no tiene plan");
  assert.equal(await cuenta(`select count(distinct socio_id)::int n from public.coberturas where gimnasio_id = $1 and anulada_en is null and desde <= now() and hasta > now()`, [t.g]), activosAntes, "no suma a los socios activos");
  // la guía muestra la situación definitiva
  const g = (await t.q(`select privado.guia_entrada($1, $2, $3) as g`, [r.socio_id, m, t.sede]))[0].g;
  assert.ok(g.chips.some((c) => c.clave === "en_prueba"), "chip En prueba");
  assert.equal(g.boton, "anotar");
  // el Interesado, si lo había, quedó atado al socio; y aparece el hecho con quién la dio
  const [h] = await t.q(`select dada_por is not null as dada, origen, modo from public.pruebas_gratis where id = $1`, [r.prueba_id]);
  assert.deepEqual(h, { dada: true, origen: "entrada", modo: "dia" });
  await modo("no");
});

test("la segunda vez con el mismo DNI dice el motivo, y al día siguiente la puerta lo dice en rojo con 'Hacete socio'", async () => {
  await modo("dia");
  const r = await mostrador(uRec, { dni: "31000003", nombre: "Gus", tel: "387 555 0103" });
  const m = await ahora();
  await malMostrador(uRec, { dni: "31000003", nombre: "Gus" }, /Ya usó su prueba gratis el \d\d\/\d\d · Hacete socio/);
  await malMostrador(uDueno, { socio: r.socio_id }, /Ya usó su prueba gratis el \d\d\/\d\d/);
  assert.equal(await cuenta(`select count(*)::int n from public.pruebas_gratis where dni = '31000003'`), 1, "una sola por DNI");
  const manana = sumar(m, 24 * 60);
  const v = await acceso(r.socio_id, manana);
  assert.equal(v.puede, false); assert.equal(v.color, "rojo"); assert.equal(v.motivo, "prueba_usada");
  assert.match(v.texto, /^Ya usó su prueba gratis el \d\d\/\d\d · Hacete socio$/);
  const g = (await t.q(`select privado.guia_entrada($1, $2, $3) as g`, [r.socio_id, manana, t.sede]))[0].g;
  assert.equal(g.boton, "cobrar");
  assert.equal(g.chips.some((c) => c.clave === "en_prueba"), false);
  // y entrar rechazado queda anotado como tal
  const e = (await t.q(`select privado.registrar_ingreso($1, $2, 'recepcion', null, null, null, $3) as r`, [r.socio_id, t.sede, manana]))[0].r;
  assert.equal(e.resultado, "rechazado");
  await modo("no");
});

test("quien paga no cambia, y quien ya es o fue socio no puede pedir la prueba", async () => {
  await modo("dia");
  const m = await t.en("2026-11-14", "19:00:00");
  const antes = await acceso(t.ctx.socios.al_dia, m);
  assert.equal(antes.motivo, "al_dia");
  await malMostrador(uRec, { socio: t.ctx.socios.al_dia }, /Ya es o fue socio|cargale primero el DNI/);
  await t.q(`update public.socios set dni = '31000004' where id = $1`, [t.ctx.socios.al_dia]);
  await malMostrador(uRec, { dni: "31000004", nombre: "X" }, /Ya es o fue socio/);
  await t.q(`update public.socios set dni = '31000005' where id = $1`, [t.ctx.socios.vencida]);
  await malMostrador(uRec, { dni: "31000005", nombre: "X" }, /Ya es o fue socio/);
  await t.q(`update public.socios set dni = '31000006' where id = $1`, [t.ctx.socios.pase_hoy]);
  await malMostrador(uRec, { dni: "31000006", nombre: "X" }, /Ya es o fue socio/);
  // la prueba de alguien más no toca el veredicto de quien está al día
  const despues = await acceso(t.ctx.socios.al_dia, m);
  assert.deepEqual(despues, antes);
  // y un socio sin ningún plan sigue en 'sin_plan' mientras no tenga prueba
  const sp = await acceso(t.ctx.socios.sin_plan, m);
  assert.equal(sp.motivo, "sin_plan");
  await modo("no");
});

test("1 clase: sin una clase empezando no hay prueba; con una, vale desde 1 h antes hasta que termina", async () => {
  await modo("clase");
  await malMostrador(uRec, { dni: "31000007", nombre: "Ana" }, /ahora no hay ninguna clase empezando/);
  const c = await clase(`now() + interval '20 minutes'`);
  const r = await mostrador(uRec, { dni: "31000007", nombre: "Ana", tel: "387 555 0107" });
  const v1 = await acceso(r.socio_id, sumar(c.inicio, -30));
  assert.equal(v1.motivo, "en_prueba"); assert.match(v1.texto, /^En prueba gratis · clase de las \d\d:\d\d$/);
  assert.equal((await acceso(r.socio_id, sumar(c.inicio, -61))).motivo, "prueba_fuera_de_hora");
  assert.equal((await acceso(r.socio_id, sumar(c.inicio, 59))).motivo, "en_prueba", "dentro de la clase");
  const tarde = await acceso(r.socio_id, sumar(c.inicio, 61));
  assert.equal(tarde.motivo, "prueba_usada"); assert.match(tarde.texto, /Hacete socio$/);
  // pedirle una clase de otra sede o inexistente no sirve
  await malMostrador(uRec, { dni: "31000008", nombre: "Beto", clase: "00000000-0000-0000-0000-000000000000" }, /ahora no hay ninguna clase/);
  await modo("no");
});

test("permisos: la da el equipo de la puerta; el profe, otro gimnasio y un visitante no; la anula solo el dueño y libera el DNI", async () => {
  await modo("dia");
  await malMostrador(uProfe, { dni: "31000009", nombre: "Pepe" }, /Sin permiso/);
  await malMostrador(uOtro, { dni: "31000009", nombre: "Pepe" }, /Sin permiso/);
  await comoAnonimo(() => t.falla(() => t.q(`select public.dar_prueba_gratis($1, $2, '31000009', 'Pepe')`, [t.g, t.sede]), /permission denied/));
  const r = await mostrador(uEnc, { dni: "31000009", nombre: "Pepe", tel: "387 555 0109" });
  const [{ prueba_id }] = [{ prueba_id: r.prueba_id }];
  assert.equal(await como(uOtro, async () => (await t.q(`select count(*)::int n from public.pruebas_gratis`))[0].n), 0, "RLS: el otro gimnasio no ve nada");
  assert.equal((await como(uRec, async () => (await t.q(`select public.prueba_por_dni($1, '31000009') as r`, [t.g]))[0].r)).usada, true);
  await como(uRec, () => t.falla(() => t.q(`select public.anular_prueba_gratis($1, 'Se la di por error')`, [prueba_id]), /Sin permiso/));
  await como(uOtro, () => t.falla(() => t.q(`select public.anular_prueba_gratis($1, 'Se la di por error')`, [prueba_id]), /Sin permiso/));
  await como(uDueno, () => t.falla(() => t.q(`select public.anular_prueba_gratis($1, 'ya')`, [prueba_id]), /al menos 5 letras/));
  await como(uRec, () => t.falla(() => t.q(`delete from public.pruebas_gratis where id = $1`, [prueba_id]), /permission denied/));
  await como(uDueno, () => t.q(`select public.anular_prueba_gratis($1, 'Se la di por error')`, [prueba_id]));
  await t.falla(() => t.q(`delete from public.pruebas_gratis where id = $1`, [prueba_id]), /no se borran/);
  await como(uDueno, () => t.falla(() => t.q(`select public.anular_prueba_gratis($1, 'Se la di por error')`, [prueba_id]), /ya estaba anulada/));
  // anulada: ya no cuenta como usada; el socio sin plan puede recibir otra (es el mismo DNI y nunca fue socio de verdad)
  const otra = await mostrador(uRec, { socio: r.socio_id });
  assert.ok(otra.prueba_id && otra.prueba_id !== prueba_id);
  await modo("no");
});

test("la página: Probá una clase deja al Interesado con la reserva, respeta el cupo y no da entrada por sí sola", async () => {
  await t.q(`update public.landing_gimnasio set publicada = true where gimnasio_id = $1`, [t.g]);
  const sinPrueba = await comoAnonimo(async () => (await t.q(`select public.clases_para_probar($1) as c`, [HOST]))[0].c);
  assert.deepEqual(sinPrueba, [], "apagada: no ofrece clases");
  await comoAnonimo(() => t.falla(() => t.q(`select public.reservar_prueba_publica($1, $2, 'Eva', '32000001', '387 555 0201')`, [HOST, "00000000-0000-0000-0000-000000000000"]), /no da clase de prueba/));
  await modo("clase");
  const c1 = await clase(`now() + interval '3 hours'`, 1);
  const c2 = await clase(`now() + interval '1 day'`, null);
  const lista = await comoAnonimo(async () => (await t.q(`select public.clases_para_probar($1) as c`, [HOST]))[0].c);
  assert.equal(lista.length >= 2, true);
  assert.ok(lista.every((x) => x.clase_id && x.texto && !("dni" in x) && !("socios" in x)), "solo lo público");
  const reservar = (clase_id, nombre, dni, tel) => comoAnonimo(async () => (await t.q(`select public.reservar_prueba_publica($1, $2, $3, $4, $5) as r`, [HOST, clase_id, nombre, dni, tel]))[0].r);
  const r = await reservar(c1.id, "Eva Gómez", "32.000.001", "387 555 0201");
  assert.equal(r.ok, true);
  // queda Interesado con su DNI y la reserva; todavía no es socio
  const [p] = await t.q(`select nombre, dni, origen, estado, socio_id, interes from public.prospectos where gimnasio_id = $1 and dni = '32000001'`, [t.g]);
  assert.equal(p.origen, "pagina"); assert.equal(p.estado, "nuevo"); assert.equal(p.socio_id, null); assert.match(p.interes, /^Clase de prueba gratis: Funcional · \d\d\/\d\d \d\d:\d\d$/);
  assert.equal(await cuenta(`select count(*)::int n from public.socios where gimnasio_id = $1 and dni = '32000001'`, [t.g]), 0);
  // cupo 1: ahora está completa
  await comoAnonimo(() => t.falla(() => t.q(`select public.reservar_prueba_publica($1, $2, 'Otro', '32000002', '387 555 0202')`, [HOST, c1.id]), /está completa/));
  const lista2 = await comoAnonimo(async () => (await t.q(`select public.clases_para_probar($1) as c`, [HOST]))[0].c);
  assert.equal(lista2.some((x) => x.clase_id === c1.id), false, "la completa no se ofrece");
  // una vez por DNI, aunque cambie el celular; no a quien ya es socio; DNI y celular válidos
  await comoAnonimo(() => t.falla(() => t.q(`select public.reservar_prueba_publica($1, $2, 'Eva', '32000001', '387 555 0299')`, [HOST, c2.id]), /ya se pidió la prueba gratis/));
  await t.q(`update public.socios set dni = '32000003' where id = $1`, [t.ctx.socios.al_dia]);
  await comoAnonimo(() => t.falla(() => t.q(`select public.reservar_prueba_publica($1, $2, 'Él', '32000003', '387 555 0203')`, [HOST, c2.id]), /ya está registrado/));
  await comoAnonimo(() => t.falla(() => t.q(`select public.reservar_prueba_publica($1, $2, 'Él', '12', '387 555 0203')`, [HOST, c2.id]), /DNI/));
  await comoAnonimo(() => t.falla(() => t.q(`select public.reservar_prueba_publica($1, $2, 'Él', '32000004', 'abc')`, [HOST, c2.id]), /WhatsApp/));
  // la recepción la ve y lo deja pasar: el DNI aparece como reservada, y al dársela se crea el socio y se ata la MISMA prueba
  const pd = await como(uRec, async () => (await t.q(`select public.prueba_por_dni($1, '32000001') as r`, [t.g]))[0].r);
  assert.equal(pd.reservada, true); assert.equal(pd.usada, false); assert.equal(pd.nombre, "Eva Gómez");
  const dada = await mostrador(uRec, { dni: "32000001" });
  assert.ok(dada.socio_id);
  assert.equal(await cuenta(`select count(*)::int n from public.pruebas_gratis where dni = '32000001'`), 1, "no se duplica: es la misma prueba");
  const [pr] = await t.q(`select socio_id, origen from public.pruebas_gratis where dni = '32000001'`);
  assert.equal(pr.socio_id, dada.socio_id); assert.equal(pr.origen, "pagina");
  const [p2] = await t.q(`select estado, socio_id from public.prospectos where gimnasio_id = $1 and dni = '32000001'`, [t.g]);
  assert.deepEqual(p2, { estado: "socio", socio_id: dada.socio_id });
  // en su clase: verde; antes de la hora, rojo con el porqué; después, "Hacete socio"
  assert.equal((await acceso(dada.socio_id, sumar(c1.inicio, -20))).motivo, "en_prueba");
  assert.equal((await acceso(dada.socio_id, sumar(c1.inicio, -120))).motivo, "prueba_fuera_de_hora");
  const noche = await acceso(dada.socio_id, sumar(c1.fin, 60 * 24));
  assert.equal(noche.motivo, "prueba_usada"); assert.match(noche.texto, /Hacete socio$/);
  await modo("no");
});

test("modo 1 día desde la página: vale todo el día de la clase reservada", async () => {
  await modo("dia");
  await t.q(`update public.landing_gimnasio set publicada = true where gimnasio_id = $1`, [t.g]);
  const c = await clase(`now() + interval '2 days'`);
  await comoAnonimo(() => t.q(`select public.reservar_prueba_publica($1, $2, 'Fede', '32000010', '387 555 0210')`, [HOST, c.id]));
  const dada = await mostrador(uRec, { dni: "32000010" });
  const [{ desde, hasta }] = await t.q(`select desde, hasta from public.pruebas_gratis where dni = '32000010'`);
  assert.equal((new Date(hasta) - new Date(desde)) % (60 * 60_000), 0);
  assert.ok(new Date(hasta) - new Date(desde) >= 23 * 60 * 60_000 && new Date(hasta) - new Date(desde) <= 25 * 60 * 60_000, "un día calendario");
  assert.equal((await acceso(dada.socio_id, sumar(desde, 5))).motivo, "en_prueba");
  assert.equal((await acceso(dada.socio_id, sumar(hasta, 5))).motivo, "prueba_usada");
  await modo("no");
});

test("el estado de acceso sigue siendo un cálculo: ninguna columna guarda 'en prueba'", async () => {
  const cols = await t.q(`select column_name from information_schema.columns where table_schema = 'public' and table_name in ('socios', 'pruebas_gratis') and column_name ~ '(en_prueba|estado|vencid|al_dia)'`);
  assert.deepEqual(cols, []);
});
