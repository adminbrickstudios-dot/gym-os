// VD-8 (D19): dejar pasar sin pagar en tres modos. Cada modo con la recepción y con el dueño (PIN válido,
// PIN inválido, pasado el tope de días); sin configurar sigue libre; todo queda en promesas_pago con quién pidió,
// quién autorizó y "promete pagar el …"; aparece en Prometieron pagar; solo el dueño cambia el modo.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir } from "./_comun.mjs";

let t, uDueno, uEnc, uAna, eAna, eDueno, uPc, n = 0, tokenDueno;
before(async () => {
  t = await abrir("prueba-dejar-pasar-modos");
  const crear = async (rol, nombre) => {
    const [{ id: u }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`${rol}${Math.random()}@ejemplo.invalid`]);
    const [{ id: e }] = await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,$3,$4) returning id`, [t.g, u, nombre, rol]);
    return [u, e];
  };
  [uDueno, eDueno] = await crear("dueno", "Sofía"); [uEnc] = await crear("encargado", "Beto");
  [uAna, eAna] = await crear("recepcion", "Ana"); [uPc] = await crear("recepcion", "PC Recepción");
  await t.q(`update public.configuracion_gimnasio set tope_dejar_pasar = 50, tolerancia_dias = 0 where gimnasio_id = $1`, [t.g]);
  // El PIN de la dueña (para ponerlo en la sesión de la recepción).
  await como(uDueno, () => t.q(`select public.guardar_mi_pin($1, '9051')`, [t.g]), null, true);
  tokenDueno = (await como(uAna, async () => (await t.q(`select public.entrar_con_pin($1, '9051') as r`, [t.g]))[0].r, null, true)).token;
});
after(async () => t && t.cerrar());

// Con la sesión de `u` y, si hay, el encabezado del operador (el PIN de otro). `fijo` = lo que hace se queda.
// Todo lo que se prepara (socios, fechas) se hace ANTES, como superusuario: adentro solo se usa la función.
async function como(u, fn, token = null, fijo = false) {
  await t.db.query("savepoint pm");
  try {
    await t.db.query("set role authenticated");
    await t.q(`select set_config('request.jwt.claims', $1, false), set_config('request.headers', $2, false)`,
      [JSON.stringify({ sub: u, role: "authenticated" }), JSON.stringify(token ? { "x-gymos-operador": token } : {})]);
    return await fn();
  } finally {
    if (!fijo) await t.db.query("rollback to savepoint pm");
    await t.db.query("reset role");
    await t.q(`select set_config('request.jwt.claims', '', false), set_config('request.headers', '', false)`);
    await t.db.query("release savepoint pm");
  }
}
// Un socio con la cuota vencida hace 20 días (le debe plata a la puerta): sin gracia, no puede entrar.
async function deudor() {
  n++;
  const [{ id: s }] = await t.q(`insert into public.socios (gimnasio_id, nombre, apellido) values ($1,'Debe','Plata ' || $2) returning id`, [t.g, n]);
  const [{ id: su }] = await t.q(`insert into public.suscripciones (gimnasio_id, socio_id, plan_id, inicio) values ($1,$2,$3, now() - interval '200 days') returning id`, [t.g, s, t.ctx.planes.full]);
  await t.q(`insert into public.coberturas (gimnasio_id, suscripcion_id, socio_id, desde, hasta, origen, motivo)
             values ($1,$2,$3, now() - interval '50 days', now() - interval '20 days', 'cortesia', 'prueba')`, [t.g, su, s]);
  return s;
}
const modo = (m, dias = 3) => t.q(`insert into public.configuracion_dejar_pasar (gimnasio_id, modo, dias_max) values ($1,$2,$3)
                                   on conflict (gimnasio_id) do update set modo = excluded.modo, dias_max = excluded.dias_max`, [t.g, m, dias]);
const en = (dias) => t.q(`select (privado.dia_local(now(), (select zona_horaria from public.gimnasios where id = $1)) + $2::int)::text as d`, [t.g, dias]).then((x) => x[0].d);
const dejar = async (socio, promete = null) =>
  (await t.q(`select public.registrar_ingreso($1, $2, 'recepcion', 'Paga mañana', null, $3::date) as r`, [socio, t.sede, promete]))[0].r;
const promesa = async (ingresoId) => (await t.q(`select p.promete_el::text as promete, p.modo, p.dias_max, qp.nombre as pidio, qa.nombre as autorizo
                                                   from public.promesas_pago p left join public.equipo qp on qp.id = p.pedido_por left join public.equipo qa on qa.id = p.autorizado_por
                                                  where p.ingreso_id = $1`, [ingresoId]))[0];

test("sin configurar sigue libre: la recepción deja pasar con o sin día, y queda la promesa", async () => {
  const [s, s2, d2] = [await deudor(), await deudor(), await en(2)];
  const r = await como(uAna, () => dejar(s), null, true);
  assert.equal(r.resultado, "forzado");
  const r2 = await como(uAna, () => dejar(s2, d2), null, true);
  assert.equal(r2.resultado, "forzado");
  assert.equal((await promesa(r2.ingreso_id)).promete, d2);
  const s3 = await deudor();
  await t.falla(() => como(uAna, () => dejar(s3, "2020-01-01")), /anterior a hoy/);
  await t.falla(() => como(uAna, () => dejar(s3, "2099-01-01")), /hasta 90 días/);
});

test("recepción hasta N días: dentro de N decide sola; más lejos o sin día, no; con el PIN del dueño, sí", async () => {
  await modo("recepcion_hasta_dias", 3);
  const [s, s5, sSin, sPin, d3, d5, d10] = [await deudor(), await deudor(), await deudor(), await deudor(), await en(3), await en(5), await en(10)];
  const ok = await como(uAna, () => dejar(s, d3), null, true);
  assert.equal(ok.resultado, "forzado");
  const p = await promesa(ok.ingreso_id);
  assert.deepEqual([p.pidio, p.autorizo, p.modo, p.dias_max], ["Ana", null, "recepcion_hasta_dias", 3]);
  await t.falla(() => como(uAna, () => dejar(s5, d5)), /5 días y la recepción deja pasar hasta 3.*PIN/);
  await t.falla(() => como(uAna, () => dejar(sSin)), /qué día promete pagar/);
  // Pasado el tope, con el PIN del dueño: queda a nombre del dueño, y se ve que lo pidió Ana.
  const con = await como(uAna, () => dejar(sPin, d10), tokenDueno, true);
  assert.equal(con.resultado, "forzado");
  const pc = await promesa(con.ingreso_id);
  assert.deepEqual([pc.pidio, pc.autorizo, pc.promete], ["Ana", "Sofía", d10]);
  const [{ por }] = await t.q(`select registrado_por as por from public.ingresos where id = $1`, [con.ingreso_id]);
  assert.equal(por, eDueno);
});

test("PIN inválido: error, nunca se anota a otro en silencio; el PIN de otra recepción no alcanza", async () => {
  await modo("recepcion_hasta_dias", 3);
  const [s, s2, d10] = [await deudor(), await deudor(), await en(10)];
  const [id, vence, firma] = tokenDueno.split(".");
  await t.falla(() => como(uAna, () => dejar(s, d10), `${id}.${Number(vence) + 999}.${firma}`), /no es válido/);
  // Un PIN equivocado no autoriza nada: entrar_con_pin devuelve el error y no hay token.
  const mal = await como(uAna, async () => (await t.q(`select public.entrar_con_pin($1, '0001') as r`, [t.g]))[0].r);
  assert.ok(mal.error && !mal.token);
  // El PIN de una recepción vale como operador, pero sigue siendo recepción: pasado el tope, no.
  await como(uPc, () => t.q(`select public.guardar_mi_pin($1, '4827')`, [t.g]), null, true);
  const otraRec = await como(uAna, async () => (await t.q(`select public.entrar_con_pin($1, '4827') as r`, [t.g]))[0].r);
  await t.falla(() => como(uAna, () => dejar(s2, d10), otraRec.token), /dueño o el encargado con su PIN/);
});

test("siempre con PIN: la recepción no; el dueño y el encargado con su sesión sí; la recepción con el PIN del dueño sí", async () => {
  await modo("siempre_pin");
  const [a, b, c, d, e, d1] = [await deudor(), await deudor(), await deudor(), await deudor(), await deudor(), await en(1)];
  await t.falla(() => como(uAna, () => dejar(a, d1)), /que ponga su PIN/);
  await t.falla(() => como(uAna, () => dejar(a)), /que ponga su PIN/);
  assert.equal((await como(uDueno, () => dejar(b, d1), null, true)).resultado, "forzado");
  assert.equal((await como(uEnc, () => dejar(c, d1), null, true)).resultado, "forzado");
  const r = await como(uAna, () => dejar(d, d1), tokenDueno, true);
  assert.equal(r.resultado, "forzado");
  const p = await promesa(r.ingreso_id);
  assert.deepEqual([p.pidio, p.autorizo], ["Ana", "Sofía"]);
  void e;
});

test("libre con registro: la recepción decide, queda anotado", async () => {
  await modo("libre");
  const [s, d30] = [await deudor(), await en(30)];
  const r = await como(uAna, () => dejar(s, d30), null, true);
  assert.equal(r.resultado, "forzado");
  const p = await promesa(r.ingreso_id);
  assert.deepEqual([p.pidio, p.autorizo, p.modo], ["Ana", null, "libre"]);
});

test("lo que no es plata no cambia: un socio sin plan se deja pasar con las reglas de siempre aunque el modo sea siempre con PIN", async () => {
  await modo("siempre_pin");
  const [{ id: s }] = await t.q(`insert into public.socios (gimnasio_id, nombre, apellido) values ($1,'Sin','Plan') returning id`, [t.g]);
  const r = await como(uAna, () => dejar(s));
  assert.equal(r.resultado, "forzado");
});

test("el día de la promesa va con el motivo", async () => {
  await modo("libre");
  const [s, d1] = [await deudor(), await en(1)];
  await t.falla(() => como(uAna, async () => (await t.q(`select public.registrar_ingreso($1, $2, 'recepcion', null, null, $3::date) as r`, [s, t.sede, d1]))[0].r), /va con el motivo/);
});

test("la pantalla de Configuración: solo el dueño guarda; el encargado lee; queda escrito quién cambió qué", async () => {
  await t.falla(() => como(uAna, () => t.q(`select public.config_dejar_pasar($1)`, [t.g])), /Sin permiso/);
  await t.falla(() => como(uEnc, () => t.q(`select public.guardar_config_dejar_pasar($1, 'libre', 3)`, [t.g])), /Sin permiso/);
  await t.falla(() => como(uDueno, () => t.q(`select public.guardar_config_dejar_pasar($1, 'a_ojo', 3)`, [t.g])), /Dejar pasar sin pagar/);
  await t.falla(() => como(uDueno, () => t.q(`select public.guardar_config_dejar_pasar($1, 'libre', 31)`, [t.g])), /entre 0 y 30/);
  await t.q(`delete from public.configuracion_dejar_pasar where gimnasio_id = $1`, [t.g]);
  assert.equal((await como(uEnc, async () => (await t.q(`select public.config_dejar_pasar($1) as c`, [t.g]))[0].c)).configurado, false);
  await como(uDueno, async () => {
    const [{ c }] = await t.q(`select public.guardar_config_dejar_pasar($1, 'siempre_pin', 3) as c`, [t.g]);
    assert.deepEqual([c.modo, c.configurado, c.ultimo_cambio.por], ["siempre_pin", true, "Sofía"]);
    const [h] = await t.q(`select despues from public.cambios_cobro where gimnasio_id = $1 and tema = 'dejar_pasar'`, [t.g]);
    assert.equal(h.despues.modo, "siempre_pin");
    const [{ cupo }] = await t.q(`select public.cupo_dejar_pasar($1) as cupo`, [t.g]);
    assert.equal(cupo.modo, "siempre_pin");
  });
});

test("Prometieron pagar suma el día prometido; la Entrada del día prometido lo recuerda", async () => {
  await modo("libre");
  // Lo dejaron pasar hace tres días con promesa para hoy: el rango "ayer y hoy" ya no lo ve, la promesa sí.
  const s = await deudor();
  const [{ g: hoyLocal }] = await t.q(`select privado.dia_local(now(), (select zona_horaria from public.gimnasios where id = $1))::text as g`, [t.g]);
  const [{ r }] = await t.q(`select privado.registrar_ingreso($1, $2, 'recepcion', $3, null, 'Paga el viernes', now() - interval '3 days') as r`, [s, t.sede, eAna]);
  await t.q(`insert into public.promesas_pago (gimnasio_id, ingreso_id, socio_id, promete_el, modo, pedido_por) values ($1,$2,$3,$4::date,'libre',$5)`,
    [t.g, r.ingreso_id, s, hoyLocal, eAna]);
  const lista = await como(uDueno, async () => (await t.q(`select public.prometieron_pagar($1) as l`, [t.g]))[0].l);
  const fila = lista.find((x) => x.socio_id === s);
  assert.ok(fila, "el que prometió pagar hoy aparece");
  assert.equal(fila.promete_el, hoyLocal);
  // La recepción ve las que pidió ella, no las de otra persona.
  const suyas = await como(uAna, async () => (await t.q(`select public.prometieron_pagar($1) as l`, [t.g]))[0].l);
  assert.ok(suyas.some((x) => x.socio_id === s));
  const otra = await como(uPc, async () => (await t.q(`select public.prometieron_pagar($1) as l`, [t.g]))[0].l);
  assert.ok(!otra.some((x) => x.socio_id === s), "la recepción no ve las de otra persona");
  // El chip de la Entrada: una promesa de ayer para hoy.
  const s2 = await deudor();
  const [{ r: r2 }] = await t.q(`select privado.registrar_ingreso($1, $2, 'recepcion', $3, null, 'Paga mañana', now() - interval '1 day') as r`, [s2, t.sede, eAna]);
  await t.q(`insert into public.promesas_pago (gimnasio_id, ingreso_id, socio_id, promete_el, modo, pedido_por) values ($1,$2,$3,$4::date,'libre',$5)`,
    [t.g, r2.ingreso_id, s2, hoyLocal, eAna]);
  const [{ g }] = await t.q(`select privado.guia_entrada($1, now(), $2) as g`, [s2, t.sede]);
  assert.ok(g.chips.some((c) => c.clave === "prometio" && /Ayer dijo que pagaba hoy/.test(c.texto)), JSON.stringify(g.chips));
});

test("la promesa es un registro fijo: no se edita ni se borra", async () => {
  await modo("libre");
  const s = await deudor();
  const r = await como(uAna, () => dejar(s, null), null, true);
  await t.falla(() => t.q(`update public.promesas_pago set promete_el = current_date where ingreso_id = $1`, [r.ingreso_id]), /no se modifican ni se borran/);
  await t.falla(() => t.q(`delete from public.promesas_pago where ingreso_id = $1`, [r.ingreso_id]), /no se modifican ni se borran/);
});
