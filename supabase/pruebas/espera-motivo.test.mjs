// VD-24 · Lista de espera automática y motivo de "no podés reservar".
// Se libera un lugar → el primero de la espera queda confirmado y avisado (aviso en la app + push, una vez);
// la base dice por qué no se puede reservar, en una frase y con el botón que corresponde.
// Las pruebas de lógica usan un momento fijo (nunca now()); las de permisos, un gimnasio aparte sembrado con
// la fecha real, para que no dependan de en qué día se corren.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir, HOY } from "./_comun.mjs";
import { sembrarCasos, sumarDias } from "../../scripts/datos/casos-testigo.mjs";

let t, momento, act, clase;
const MANIANA = sumarDias(HOY, 1); // domingo 15/11, 19:00, cupo 2

before(async () => {
  t = await abrir("prueba-espera");
  momento = await t.en(HOY, "12:00:00");
  await t.q(`update public.configuracion_gimnasio set modo_clases = 'reserva' where gimnasio_id = $1`, [t.g]);
  [{ id: act }] = await t.q(`insert into public.actividades (gimnasio_id, nombre, emoji) values ($1,'Spinning','🚴') returning id`, [t.g]);
  await t.q(`insert into public.horarios_clase (gimnasio_id, sede_id, actividad_id, dia_semana, hora_inicio, duracion_min, cupo, vigente_desde)
             values ($1,$2,$3,7,'19:00',50,2,'2026-01-01')`, [t.g, t.sede, act]);
  await t.q(`select privado.materializar_dia($1, $2::date)`, [t.sede, MANIANA]);
  [{ id: clase }] = await t.q(`select id from public.clases where gimnasio_id = $1`, [t.g]);
});
after(async () => t && t.cerrar());

// Sesión del usuario (sin revertir lo que hace: acá las cancelaciones tienen que quedar).
async function como(usuario, fn) {
  await t.db.query("set role authenticated");
  await t.q(`select set_config('request.jwt.claims', $1, false)`, [JSON.stringify({ sub: usuario, role: "authenticated" })]);
  try { return await fn(); } finally { await t.db.query("reset role"); await t.q(`select set_config('request.jwt.claims', '', false)`); }
}
const S = () => t.ctx.socios;
const motivo = async (socio, m = momento, c = clase) => (await t.q(`select privado.motivo_reserva($1, $2, $3, false) as m`, [c, socio, m]))[0].m;
const reservar = async (socio) => (await t.q(`select privado.reservar($1, $2, $3) as r`, [clase, socio, momento]))[0].r;
const reserva = async (socio) => (await t.q(`select * from public.reservas where clase_id = $1 and socio_id = $2 and estado <> 'cancelada'`, [clase, socio]))[0];

test("hay lugar: puede reservar, con el botón Reservar", async () => {
  const m = await motivo(S().al_dia);
  assert.deepEqual({ puede: m.puede, motivo: m.motivo, accion: m.accion, etiqueta: m.etiqueta }, { puede: true, motivo: "ok", accion: "reservar", etiqueta: "Reservar" });
  assert.equal(m.texto, "Quedan 2 lugares.");
});

test("cupo lleno: puede anotarse en espera y la frase cuenta cuántos hay antes; ya anotado, lo dice", async () => {
  await reservar(S().al_dia); await reservar(S().por_vencer);
  const lleno = await motivo(S().pack_con_clases);
  assert.deepEqual({ puede: lleno.puede, motivo: lleno.motivo, accion: lleno.accion, etiqueta: lleno.etiqueta }, { puede: true, motivo: "cupo_lleno", accion: "espera", etiqueta: "Anotarme en espera" });
  assert.match(lleno.texto, /^La clase está llena\. Anotate en la lista de espera/);
  assert.equal((await reservar(S().pack_con_clases)).estado, "espera");
  const ya = await motivo(S().pack_con_clases);
  assert.deepEqual({ puede: ya.puede, motivo: ya.motivo, accion: ya.accion }, { puede: false, motivo: "ya_reservada", accion: "ninguna" });
  assert.match(ya.texto, /lista de espera \(1°\)/);
  const otro = await motivo(S().cumple);
  assert.match(otro.texto, /Hay 1 persona esperando: si te anotás, quedás 2°\./);
  assert.equal(otro.en_espera, 1);
  assert.equal((await motivo(S().al_dia)).texto, "Ya tenés tu lugar en esta clase.");
});

test("no puede por la cuota, el pack, el plan o el límite: cada uno con su frase y su botón", async () => {
  const caso = async (socio) => { const m = await motivo(S()[socio]); return { puede: m.puede, motivo: m.motivo, accion: m.accion, etiqueta: m.etiqueta, texto: m.texto }; };
  const vencida = await caso("vencida");
  assert.deepEqual({ ...vencida, texto: undefined }, { puede: false, motivo: "vencido", accion: "pagar", etiqueta: "Pagar", texto: undefined });
  assert.match(vencida.texto, /^Venció el 24\/10.*: pagá para poder reservar\.$/);
  assert.equal((await caso("sin_pago")).motivo, "vencido");
  const susp = await caso("suspendido");
  assert.deepEqual({ motivo: susp.motivo, accion: susp.accion }, { motivo: "suspendido", accion: "ninguna" });
  assert.match(susp.texto, /^Suspendido/);
  const cong = await caso("congelada");
  assert.deepEqual({ motivo: cong.motivo, accion: cong.accion }, { motivo: "congelada", accion: "ninguna" });
  assert.match(cong.texto, /^Tu plan está congelado: congelada · vuelve el/);
  const pack = await caso("pack_agotado");
  assert.deepEqual({ motivo: pack.motivo, accion: pack.accion, etiqueta: pack.etiqueta }, { motivo: "pack_sin_clases", accion: "pagar", etiqueta: "Comprar clases" });
  assert.equal((await caso("pack_vencido")).motivo, "pack_sin_clases");
  const tope = await caso("tope_semanal");
  assert.deepEqual({ motivo: tope.motivo, accion: tope.accion, etiqueta: tope.etiqueta }, { motivo: "limite_semanal", accion: "cambiar_plan", etiqueta: "Cambiar de plan" });
  assert.match(tope.texto, /^Llegaste al límite de tu plan esta semana\./);
});

test("el plan no incluye la actividad: cambiar de plan", async () => {
  await t.db.query("savepoint pa");
  const [{ id: yoga }] = await t.q(`insert into public.actividades (gimnasio_id, nombre) values ($1,'Yoga') returning id`, [t.g]);
  await t.q(`insert into public.plan_actividades (gimnasio_id, plan_id, actividad_id) values ($1,$2,$3)`, [t.g, t.ctx.planes.full, yoga]);
  const m = await motivo(S().cumple);
  await t.db.query("rollback to savepoint pa");
  assert.deepEqual({ puede: m.puede, motivo: m.motivo, accion: m.accion, etiqueta: m.etiqueta }, { puede: false, motivo: "plan_no_incluye", accion: "cambiar_plan", etiqueta: "Cambiar de plan" });
  assert.equal(m.texto, "Tu plan no incluye Spinning.");
});

test("clase cerrada, cancelada, fuera de plazo y sin reserva: la frase correcta, sin botón", async () => {
  const empezada = await motivo(S().al_dia, await t.en(MANIANA, "20:00:00"));
  assert.deepEqual({ puede: empezada.puede, motivo: empezada.motivo, accion: empezada.accion }, { puede: false, motivo: "clase_cerrada", accion: "ninguna" });
  const lejos = await motivo(S().cumple, await t.en(sumarDias(HOY, -10), "12:00:00"));
  assert.equal(lejos.motivo, "fuera_de_plazo");
  assert.match(lejos.texto, /^Todavía no se puede reservar: se abre 7 días antes \(desde el \d\d\/\d\d\)\.$/);
  await t.db.query("savepoint cc");
  await t.q(`update public.clases set cancelada_en = now(), cancelada_motivo = 'Profe enfermo' where id = $1`, [clase]);
  const cancelada = await motivo(S().cumple);
  await t.q(`update public.configuracion_gimnasio set modo_clases = 'sin_reserva' where gimnasio_id = $1`, [t.g]);
  const libre = await motivo(S().cumple);
  await t.db.query("rollback to savepoint cc");
  assert.deepEqual({ motivo: cancelada.motivo, texto: cancelada.texto }, { motivo: "clase_cancelada", texto: "Esta clase se canceló: Profe enfermo" });
  assert.equal(libre.motivo, "sin_reserva");
});

test("se libera un lugar: sube el primero de la espera, queda avisado, y dos cancelaciones seguidas no repiten a nadie", async () => {
  const pack = await reserva(S().pack_con_clases);
  const cumple = await reservar(S().cumple);
  assert.equal(cumple.estado, "espera");
  assert.equal(cumple.posicion, 2);
  const a = await reserva(S().al_dia);
  const subio1 = (await t.q(`select privado.cancelar_reserva($1, 'socio', false, $2) as r`, [a.id, momento]))[0].r;
  assert.equal(subio1, pack.id, "sube el primero de la espera, no el segundo");
  assert.equal((await reserva(S().pack_con_clases)).estado, "confirmada");
  assert.equal((await reserva(S().cumple)).estado, "espera");
  const p = await reserva(S().por_vencer);
  const subio2 = (await t.q(`select privado.cancelar_reserva($1, 'socio', false, $2) as r`, [p.id, momento]))[0].r;
  assert.equal(subio2, cumple.reserva_id, "la segunda cancelación sube al que sigue");
  const confirmadas = await t.q(`select socio_id from public.reservas where clase_id = $1 and estado = 'confirmada' order by socio_id`, [clase]);
  assert.deepEqual(confirmadas.map((x) => x.socio_id).sort(), [S().pack_con_clases, S().cumple].sort(), "cupo 2, cada uno una sola vez");
  const avisos = await t.q(`select socio_id, tipo from public.avisos_pendientes where clase_id = $1 and tipo = 'lugar_liberado'`, [clase]);
  assert.deepEqual(avisos.map((x) => x.socio_id).sort(), [S().pack_con_clases, S().cumple].sort(), "cada uno recibe su aviso una vez");
  assert.notEqual(subio1, subio2);
});

test("el push de 'se liberó un lugar' sale una sola vez, solo para la reserva que subió, y solo a sus dispositivos", async () => {
  const r = await reserva(S().pack_con_clases);
  const [{ id: u }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`pack${Math.random()}@ejemplo.invalid`]);
  await t.q(`update public.socios set usuario_id = $2 where id = $1`, [S().pack_con_clases, u]);
  await t.q(`insert into public.suscripciones_push (gimnasio_id, usuario_id, endpoint, p256dh, auth, tipos) values ($1,$2,'https://push.ejemplo.invalid/abc','${"p".repeat(30)}','${"a".repeat(12)}',array['clases'])`, [t.g, u]);
  const d = (await t.q(`select public.destinos_push_clases('lugar_liberado', $1) as d`, [r.id]))[0].d;
  assert.equal(d.titulo, "✅ Se liberó un lugar: ya estás anotado");
  assert.match(d.cuerpo, /^Spinning del 15\/11 a las 19:00$/);
  assert.equal(d.url, "/app/clases");
  assert.equal(d.destinos.length, 1);
  assert.equal((await t.q(`select public.destinos_push_clases('lugar_liberado', $1) as d`, [r.id]))[0].d, null, "la segunda vez no se manda");
  await t.falla(() => t.q(`select public.destinos_push_clases('otra_cosa', $1)`, [r.id]), /Evento desconocido/);
});

test("permisos y fecha real: el socio pregunta por sí, no por otro; cancelar devuelve a quien subió; el aviso es solo del socio", async () => {
  // Un gimnasio aparte, sembrado con la fecha de hoy, para no depender del día en que se corre.
  const [{ id: g2 }] = await t.q(`insert into public.gimnasios (slug, nombre) values ('prueba-espera-real', 'Gimnasio Real') returning id`);
  const [{ id: sede2 }] = await t.q(`select id from public.sedes where gimnasio_id = $1`, [g2]);
  const hoyReal = (await t.q(`select (now() at time zone $1)::date::text as d`, [t.ctx.zona]))[0].d;
  const c2 = await sembrarCasos(t.db, { gimnasioId: g2, sedeId: sede2, hoy: hoyReal, telefonoBase: 5490000200000 });
  await t.q(`update public.configuracion_gimnasio set modo_clases = 'reserva' where gimnasio_id = $1`, [g2]);
  const [{ id: act2 }] = await t.q(`insert into public.actividades (gimnasio_id, nombre) values ($1,'Funcional') returning id`, [g2]);
  const [{ id: k }] = await t.q(`insert into public.clases (gimnasio_id, sede_id, actividad_id, inicio, fin, cupo)
    values ($1,$2,$3, now() + interval '3 hours', now() + interval '4 hours', 1) returning id`, [g2, sede2, act2]);
  const usuario = async (socio) => {
    const [{ id }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`s${Math.random()}@ejemplo.invalid`]);
    await t.q(`update public.socios set usuario_id = $2 where id = $1`, [socio, id]);
    return id;
  };
  const uA = await usuario(c2.socios.al_dia), uB = await usuario(c2.socios.por_vencer), uC = await usuario(c2.socios.cumple);
  const [{ id: resA }] = await t.q(`insert into public.reservas (gimnasio_id, clase_id, socio_id, estado) values ($1,$2,$3,'confirmada') returning id`, [g2, k, c2.socios.al_dia]);
  const [{ id: resB }] = await t.q(`insert into public.reservas (gimnasio_id, clase_id, socio_id, estado) values ($1,$2,$3,'espera') returning id`, [g2, k, c2.socios.por_vencer]);

  // Quien no es el socio ni del equipo no pregunta por él.
  await como(uC, () => t.falla(() => t.q(`select public.motivo_reserva($1, $2)`, [k, c2.socios.al_dia]), /Sin permiso/));
  await como(uC, () => t.falla(() => t.q(`select public.motivos_reserva($1, $2)`, [c2.socios.al_dia, [k]]), /Sin permiso/));
  // El socio sí, por sí mismo: la API pública da lo mismo que la privada.
  const propio = await como(uA, async () => (await t.q(`select public.motivo_reserva($1, $2) as m`, [k, c2.socios.al_dia]))[0].m);
  assert.equal(propio.motivo, "ya_reservada");
  const varios = await como(uC, async () => (await t.q(`select public.motivos_reserva($1, $2) as m`, [c2.socios.cumple, [k]]))[0].m);
  assert.equal(varios[k].motivo, "cupo_lleno");
  assert.equal(varios[k].accion, "espera");

  // Cancelar: la base devuelve a quien subió.
  await como(uC, () => t.falla(() => t.q(`select public.cancelar_reserva($1)`, [resA]), /Sin permiso/));
  const subio = await como(uA, async () => (await t.q(`select public.cancelar_reserva($1) as r`, [resA]))[0].r);
  assert.equal(subio, resB);
  assert.equal((await t.q(`select estado from public.reservas where id = $1`, [resB]))[0].estado, "confirmada");
  await como(uA, () => t.falla(() => t.q(`select public.cancelar_reserva($1)`, [resA]), /ya estaba cancelada/));

  // El aviso es de quien subió, y de nadie más.
  const aviso = await como(uB, async () => (await t.q(`select public.avisos_lugar_socio($1) as a`, [c2.socios.por_vencer]))[0].a);
  assert.equal(aviso.length, 1);
  assert.equal(aviso[0].tipo, "lugar_liberado");
  assert.match(aviso[0].texto, /^Se liberó un lugar: tenés confirmada Funcional del \d\d\/\d\d a las \d\d:\d\d\.$/);
  await como(uA, () => t.falla(() => t.q(`select public.avisos_lugar_socio($1)`, [c2.socios.por_vencer]), /Sin permiso/));
  assert.deepEqual(await como(uA, async () => (await t.q(`select public.avisos_lugar_socio($1) as a`, [c2.socios.al_dia]))[0].a), []);
  // Sin sesión no hay nada.
  await t.db.query("set role anon");
  try { await t.falla(() => t.q(`select public.motivo_reserva($1, $2)`, [k, c2.socios.al_dia]), /permission denied|permiso/i); } finally { await t.db.query("reset role"); }
});
