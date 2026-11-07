// VD-53: fichaje del equipo con PIN. Momentos fijos (privado.fichar_en recibe la hora): entrada y salida con horas exactas,
// salida sin entrada que no rompe, entrada olvidada que queda "sin salida" y no suma, corrección del dueño con motivo y
// con historia, nada se borra, quién ve qué, el PIN (token y PIN directo) y la integración con la liquidación de profes.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir } from "./_comun.mjs";

let t, u = {}, eq = {}, mes;
async function crear(rol, nombre) {
  const [{ id }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`${rol}${Math.random()}@ejemplo.invalid`]);
  const [{ e }] = await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,$3,$4) returning id as e`, [t.g, id, nombre, rol]);
  return [id, e];
}
async function como(usuario, fn, token = null) {
  await t.db.query("set role authenticated");
  await t.q(`select set_config('request.jwt.claims', $1, false), set_config('request.headers', $2, false)`,
    [JSON.stringify({ sub: usuario, role: "authenticated" }), JSON.stringify(token ? { "x-gymos-operador": token } : {})]);
  try { return await fn(); } finally {
    await t.db.query("reset role").catch(() => {});
    await t.q(`select set_config('request.jwt.claims', '', false), set_config('request.headers', '', false)`).catch(() => {});
  }
}
/** Día `d` del mes de prueba a las `h` horas (hora del gimnasio). */
const at = async (d, h) => (await t.q(`select privado.medianoche($1::date + $2::int, 'America/Argentina/Buenos_Aires') + ($3 || ' hours')::interval as m`, [mes, d - 1, String(h)]))[0].m;
/** El mismo instante escrito como lo escribe el dueño: día y hora del gimnasio. */
const loc = async (d, h) => (await t.q(`select to_char($1::timestamptz at time zone 'America/Argentina/Buenos_Aires', 'YYYY-MM-DD"T"HH24:MI') as m`, [await at(d, h)]))[0].m;
const fichar = async (quien, accion, momento) => (await t.q(`select privado.fichar_en($1, (select q from public.equipo q where q.id = $2), $3, $4::timestamptz) as r`, [t.g, eq[quien], accion, momento]))[0].r;
const mesTotal = async (quien) => (await t.q(`select * from privado.fichaje_mes($1, $2, $3::date, now())`, [t.g, eq[quien], mes]))[0];

before(async () => {
  t = await abrir("prueba-fichaje");
  [mes] = (await t.q(`select to_char(date_trunc('month', now() - interval '1 month'), 'YYYY-MM-DD') as m`)).map((r) => r.m);
  for (const [rol, nombre] of [["dueno", "Sofía"], ["encargado", "Enzo"], ["recepcion", "Rita"], ["recepcion", "Ramiro"], ["profe", "Pablo"], ["profe", "Paula"]]) {
    const [usuario, equipo] = await crear(rol, nombre);
    u[nombre] = usuario; eq[nombre] = equipo;
  }
});
after(async () => t && t.cerrar());

test("por defecto el gimnasio no usa fichaje; lo prende solo el dueño y el tope va de 1 a 24", async () => {
  await como(u["Rita"], async () => {
    await t.falla(() => t.q(`select public.fichar($1, 'entrada')`, [t.g]), /no usa fichaje/);
    assert.equal((await t.q(`select public.config_fichaje($1) as c`, [t.g]))[0].c.usa, false);
    await t.falla(() => t.q(`select public.guardar_config_fichaje($1, true, 12)`, [t.g]), /Sin permiso/);
  });
  await como(u["Enzo"], () => t.falla(() => t.q(`select public.guardar_config_fichaje($1, true, 12)`, [t.g]), /Sin permiso/));
  await como(u["Sofía"], async () => {
    await t.falla(() => t.q(`select public.guardar_config_fichaje($1, true, 0)`, [t.g]), /1 a 24/);
    await t.falla(() => t.q(`select public.guardar_config_fichaje($1, true, 25)`, [t.g]), /1 a 24/);
    const c = (await t.q(`select public.guardar_config_fichaje($1, true, 12) as c`, [t.g]))[0].c;
    assert.deepEqual(c, { usa: true, tope_horas: 12 });
  });
});

test("entrada y salida con horas exactas; la salida sin entrada y la entrada repetida no rompen ni escriben", async () => {
  const sinEntrada = await fichar("Rita", "salida", await at(2, 8));
  assert.equal(sinEntrada.accion, "sin_entrada");
  assert.equal((await t.q(`select count(*)::int n from public.fichajes where equipo_id = $1`, [eq["Rita"]]))[0].n, 0);
  assert.equal((await fichar("Rita", "entrada", await at(2, 9))).accion, "entrada");
  const otra = await fichar("Rita", "entrada", await at(2, 9.5));
  assert.equal(otra.accion, "ya_en_turno");
  assert.equal((await t.q(`select count(*)::int n from public.fichajes where equipo_id = $1`, [eq["Rita"]]))[0].n, 1);
  const sal = await fichar("Rita", "salida", await at(2, 13.5));
  assert.equal(sal.accion, "salida");
  assert.equal(sal.minutos, 270);
  assert.equal((await fichar("Rita", "entrada", await at(3, 14))).accion, "entrada");
  assert.equal((await fichar("Rita", "salida", await at(3, 22))).minutos, 480);
  const m = await mesTotal("Rita");
  assert.equal(m.minutos, 750);          // 4,5 h + 8 h
  assert.equal(m.sin_salida, 0);
  assert.equal(m.hay, true);
});

test("una entrada olvidada se cierra sola en el tope, queda 'sin salida' y no suma horas", async () => {
  await fichar("Ramiro", "entrada", await at(5, 8));
  // Al otro día ficha de nuevo: la de ayer queda cerrada a las 12 h, marcada sin salida.
  const nueva = await fichar("Ramiro", "entrada", await at(6, 8));
  assert.equal(nueva.accion, "entrada");
  const [v] = await t.q(`select entrada_en, salida_en, cierre from public.fichajes where equipo_id = $1 order by entrada_en limit 1`, [eq["Ramiro"]]);
  assert.equal(v.cierre, "automatico");
  assert.equal(new Date(v.salida_en) - new Date(v.entrada_en), 12 * 3600 * 1000);
  await fichar("Ramiro", "salida", await at(6, 12));
  const m = await mesTotal("Ramiro");
  assert.equal(m.minutos, 240);          // solo el turno del día 6
  assert.equal(m.sin_salida, 1);
  // El turno abierto de hoy, visto a una hora fija: dentro del tope es 'abierto'; pasado el tope es 'sin_salida'.
  await fichar("Ramiro", "entrada", await at(9, 8));
  const estado = async (ahora) => (await t.q(`select estado, minutos from privado.fichajes_efectivos($1, $2, $3::timestamptz - interval '1 day', $3::timestamptz + interval '1 day', $4::timestamptz) where entrada_en = $3::timestamptz`,
    [t.g, eq["Ramiro"], await at(9, 8), ahora]))[0];
  const a = await estado(await at(9, 15)), b = await estado(await at(9, 21));
  assert.equal(`${a.estado}:${a.minutos}`, "abierto:0");
  assert.equal(`${b.estado}:${b.minutos}`, "sin_salida:0");
  // Una salida cuando la entrada ya pasó el tope no la usa: avisa y no suma.
  const tarde = await fichar("Ramiro", "salida", await at(9, 21));
  assert.equal(tarde.accion, "sin_entrada");
  assert.equal((await mesTotal("Ramiro")).sin_salida, 2);
});

test("hecho inmutable: la salida se pone una vez, nada se borra ni se cambia a mano, y las tablas no se leen directo", async () => {
  const [{ id }] = await t.q(`select id from public.fichajes where equipo_id = $1 order by entrada_en limit 1`, [eq["Rita"]]);
  await t.falla(() => t.q(`update public.fichajes set salida_en = salida_en + interval '1 hour' where id = $1`, [id]), /no se cambia|solo se puede cambiar/);
  await t.falla(() => t.q(`update public.fichajes set entrada_en = entrada_en - interval '1 hour' where id = $1`, [id]), /solo se puede cambiar/);
  await t.falla(() => t.q(`delete from public.fichajes where id = $1`, [id]), /no se borran/);
  await t.falla(() => t.q(`insert into public.fichajes (gimnasio_id, equipo_id, entrada_en) values ($1, $2, now()), ($1, $2, now() + interval '1 minute')`, [t.g, eq["Pablo"]]), /fichajes_uno_abierto|duplicate|unique/);
  await como(u["Sofía"], async () => {
    await t.falla(() => t.q(`select * from public.fichajes`), /permission denied/);
    await t.falla(() => t.q(`select * from public.correcciones_fichaje`), /permission denied/);
    await t.falla(() => t.q(`select * from public.configuracion_fichaje`), /permission denied/);
  });
});

test("el dueño corrige con motivo y queda la historia; el encargado no; nunca se borra", async () => {
  const [{ id }] = await t.q(`select id from public.fichajes where equipo_id = $1 and cierre = 'automatico'`, [eq["Ramiro"]]);
  const ent = await loc(5, 8), sal = await loc(5, 17), largo = await loc(6, 12), sal16 = await loc(5, 16);
  await como(u["Enzo"], () => t.falla(() => t.q(`select public.corregir_fichaje($1, $2, $3, 'se fue tarde')`, [id, ent, sal]), /Sin permiso/));
  await como(u["Rita"], () => t.falla(() => t.q(`select public.anular_fichaje($1, 'x')`, [id]), /Sin permiso/));
  await como(u["Sofía"], async () => {
    await t.falla(() => t.q(`select public.corregir_fichaje($1, $2, $3, '  ')`, [id, ent, sal]), /motivo/);
    await t.falla(() => t.q(`select public.corregir_fichaje($1, $3, $2, 'al revés')`, [id, ent, sal]), /después de la entrada/);

    await t.falla(() => t.q(`select public.corregir_fichaje($1, $2, $3, 'muy largo')`, [id, ent, largo]), /24 horas/);
    await t.q(`select public.corregir_fichaje($1, $2, $3, 'Se olvidó de fichar la salida: se fue a las 17')`, [id, ent, sal]);
  });
  const m = await mesTotal("Ramiro");
  assert.equal(m.minutos, 240 + 540);
  assert.equal(m.sin_salida, 1);       // queda solo la del día 9
  const [c] = await t.q(`select * from public.correcciones_fichaje where fichaje_id = $1`, [id]);
  assert.equal(c.corregido_por, eq["Sofía"]);
  assert.equal(c.salida_antes.getTime() - c.entrada_antes.getTime(), 12 * 3600 * 1000);   // lo que decía antes queda
  await como(u["Sofía"], async () => {
    await t.q(`select public.corregir_fichaje($1, $2, $3, 'En realidad salió a las 16')`, [id, ent, sal16]);
  });
  assert.equal((await mesTotal("Ramiro")).minutos, 240 + 480);
  assert.equal((await t.q(`select count(*)::int n from public.correcciones_fichaje where fichaje_id = $1`, [id]))[0].n, 2);
  await t.falla(() => t.q(`delete from public.correcciones_fichaje where id = $1`, [c.id]), /no se borran/);
  // Anular: queda con motivo y deja de sumar.
  const [{ id: otro }] = await t.q(`select id from public.fichajes where equipo_id = $1 and salida_en = $2::timestamptz`, [eq["Rita"], await at(3, 22)]);
  await como(u["Sofía"], async () => {
    await t.falla(() => t.q(`select public.anular_fichaje($1, '')`, [otro]), /motivo/);
    await t.q(`select public.anular_fichaje($1, 'Lo fichó por error')`, [otro]);
    await t.falla(() => t.q(`select public.anular_fichaje($1, 'otra vez')`, [otro]), /ya estaba anulado/);
  });
  assert.equal((await mesTotal("Rita")).minutos, 270);
});

test("quién ve qué: cada uno solo sus horas; dueño y encargado las de todos; el dueño no ficha", async () => {
  const mias = await como(u["Rita"], async () => (await t.q(`select public.mis_horas($1, $2::date) as r`, [t.g, mes]))[0].r);
  assert.equal(mias.minutos, 270);
  assert.equal(mias.turnos.length, 2);   // el anulado se ve marcado, no desaparece
  assert.ok(mias.turnos.some((x) => x.estado === "anulado"));
  const deRamiro = await como(u["Ramiro"], async () => (await t.q(`select public.mis_horas($1, $2::date) as r`, [t.g, mes]))[0].r);
  assert.equal(deRamiro.minutos, 240 + 480);
  for (const quien of ["Rita", "Pablo"]) {
    await como(u[quien], async () => {
      await t.falla(() => t.q(`select public.horas_equipo($1, $2::date)`, [t.g, mes]), /Sin permiso/);
      await t.falla(() => t.q(`select public.fichajes_persona($1, $2, $3::date)`, [t.g, eq["Ramiro"], mes]), /Sin permiso/);
    });
  }
  for (const quien of ["Sofía", "Enzo"]) {
    const todos = await como(u[quien], async () => (await t.q(`select public.horas_equipo($1, $2::date) as r`, [t.g, mes]))[0].r);
    const rita = todos.personas.find((p) => p.nombre === "Rita");
    assert.equal(rita.minutos, 270);
    assert.equal(todos.personas.find((p) => p.nombre === "Ramiro").sin_salida, 1);
    assert.ok(!todos.personas.some((p) => p.nombre === "Sofía"));   // el dueño no ficha
  }
  const det = await como(u["Enzo"], async () => (await t.q(`select public.fichajes_persona($1, $2, $3::date) as r`, [t.g, eq["Ramiro"], mes]))[0].r);
  assert.equal(det.correcciones.length, 2);
  await como(u["Sofía"], () => t.falla(() => t.q(`select public.fichar($1, 'entrada')`, [t.g]), /Sin permiso/));
  // Otro gimnasio: nada.
  const [{ g2 }] = await t.q(`insert into public.gimnasios (slug, nombre) values ('otro-fichaje', 'Otro') returning id as g2`);
  await como(u["Rita"], () => t.falla(() => t.q(`select public.mis_horas($1, $2::date)`, [g2, mes]), /Sin permiso/));
  await como(u["Sofía"], () => t.falla(() => t.q(`select public.horas_equipo($1, $2::date)`, [g2, mes]), /Sin permiso/));
});

test("fichar de verdad (hora actual): con la sesión y con el PIN puesto en la compu", async () => {
  const [{ id: uPc }] = await t.q(`insert into auth.users (email) values ('pc-fichaje@ejemplo.invalid') returning id`);
  await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,'PC Recepción','recepcion')`, [t.g, uPc]);
  await como(u["Paula"], async () => { await t.q(`select public.guardar_mi_pin($1, '4827')`, [t.g]); });
  await como(u["Rita"], async () => { await t.q(`select public.guardar_mi_pin($1, '9051')`, [t.g]); });
  // PIN directo: equivocado no rompe y cuenta intentos; correcto ficha a quien lo puso, no a la sesión de la PC.
  const mal = await como(uPc, async () => (await t.q(`select public.fichar_con_pin($1, '0001', 'entrada') as r`, [t.g]))[0].r);
  assert.equal(mal.error, "PIN equivocado");
  const bien = await como(uPc, async () => (await t.q(`select public.fichar_con_pin($1, '4827', 'entrada') as r`, [t.g]))[0].r);
  assert.equal(bien.accion, "entrada");
  assert.equal(bien.nombre, "Paula");
  const [{ n }] = await t.q(`select count(*)::int n from public.fichajes where equipo_id = $1 and salida_en is null`, [eq["Paula"]]);
  assert.equal(n, 1);
  const estado = await como(u["Paula"], async () => (await t.q(`select public.mi_fichaje($1) as r`, [t.g]))[0].r);
  assert.equal(estado.en_turno, true);
  const alternar = await como(uPc, async () => (await t.q(`select public.fichar_con_pin($1, '4827') as r`, [t.g]))[0].r);   // sin acción: alterna
  assert.equal(alternar.accion, "salida");
  // Con el token del PIN en la compu: la entrada queda a nombre de quien puso el PIN.
  const ana = await como(uPc, async () => (await t.q(`select public.entrar_con_pin($1, '9051') as r`, [t.g]))[0].r);
  const f = await como(uPc, async () => (await t.q(`select public.fichar($1, 'entrada') as r`, [t.g]))[0].r, ana.token);
  assert.equal(f.nombre, "Rita");
  const [{ por }] = await t.q(`select equipo_id as por from public.fichajes where entrada_en = $1::timestamptz`, [f.momento]);
  assert.equal(por, eq["Rita"]);
  // Con el PIN de la dueña en la compu de la recepción no se ficha (la dueña no ficha).
  await como(u["Sofía"], async () => { await t.q(`select public.guardar_mi_pin($1, '7316')`, [t.g]); });
  const dueno = await como(uPc, async () => (await t.q(`select public.fichar_con_pin($1, '7316', 'entrada') as r`, [t.g]))[0].r);
  assert.match(dueno.error, /no ficha/);
  // Cinco errores bloquean.
  await como(uPc, async () => {
    for (let i = 0; i < 4; i++) await t.q(`select public.fichar_con_pin($1, '0002') as r`, [t.g]);
    await t.falla(() => t.q(`select public.fichar_con_pin($1, '4827') as r`, [t.g]), /Demasiados PIN/);
  });
});

test("liquidación de profes: si el profe fichó, sus horas salen del fichaje (aunque haya horas cargadas); si no, mandan las cargadas", async () => {
  await t.q(`insert into public.reglas_pago_profe (gimnasio_id, profe_id, modo, monto, vigente_desde, creado_por) values ($1,$2,'por_hora',2000,$3::date,$2), ($1,$4,'por_hora',2000,$3::date,$4)`,
    [t.g, eq["Pablo"], mes, eq["Paula"]]);
  // Pablo fichó 4 h 30 + 8 h; además alguien le cargó 3 h a mano: manda el fichaje.
  await fichar("Pablo", "entrada", await at(10, 9)); await fichar("Pablo", "salida", await at(10, 13.5));
  await fichar("Pablo", "entrada", await at(11, 14)); await fichar("Pablo", "salida", await at(11, 22));
  await t.q(`insert into public.horas_profe (gimnasio_id, profe_id, fecha, minutos, creado_por) values ($1,$2,$3::date + 3,180,$2)`, [t.g, eq["Pablo"], mes]);
  // Paula (que fichó en otro mes, hoy) no tiene fichajes en el mes liquidado: valen sus 2 h cargadas.
  await t.q(`insert into public.horas_profe (gimnasio_id, profe_id, fecha, minutos, creado_por) values ($1,$2,$3::date + 3,120,$2)`, [t.g, eq["Paula"], mes]);
  const r = await como(u["Sofía"], async () => (await t.q(`select public.liquidacion_profes($1, $2::date) as r`, [t.g, mes]))[0].r);
  const pablo = r.profes.find((p) => p.nombre === "Pablo"), paula = r.profes.find((p) => p.nombre === "Paula");
  assert.equal(pablo.horas_fuente, "fichaje");
  assert.equal(Number(pablo.horas_cargadas), 12.5);
  assert.equal(Number(pablo.total), 25000);
  assert.equal(paula.horas_fuente, "carga");
  assert.equal(Number(paula.total), 4000);
  // Mi liquidación (el profe) ve lo mismo que el dueño.
  const mia = await como(u["Pablo"], async () => (await t.q(`select public.mi_liquidacion($1, $2::date) as r`, [t.g, mes]))[0].r);
  assert.equal(Number(mia.resumen.total), 25000);
  // Una entrada sin salida del profe en el mes: no suma (y se avisa en la liquidación).
  await fichar("Pablo", "entrada", await at(12, 9));
  const r2 = await como(u["Sofía"], async () => (await t.q(`select public.liquidacion_profes($1, $2::date) as r`, [t.g, mes]))[0].r);
  const pablo2 = r2.profes.find((p) => p.nombre === "Pablo");
  assert.equal(Number(pablo2.total), 25000);
  assert.equal(pablo2.fichajes_sin_salida, 1);
});
