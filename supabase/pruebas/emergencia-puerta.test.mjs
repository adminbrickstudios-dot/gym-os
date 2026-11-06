// VD-46M: modo emergencia de la puerta (situaciones 8 y 63). Arranca apagado; solo el dueño lo prende; el dueño y el
// encargado la activan con motivo y duración; vence sola (se calcula, sin cron); mientras dura la puerta deja pasar al que
// no podía con el ingreso marcado; no abre a suspendidos ni dados de baja; al cerrar se lista quiénes entraron;
// el reingreso por visita y el anti-préstamo siguen andando. Los momentos son fijos (14/11/2026) salvo en las funciones
// públicas, que miran now().
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir, HOY } from "./_comun.mjs";

let t, uDueno, uEnc, uRec, eDueno;
async function como(usuario, fn) {
  // Con un savepoint: si la función falla (a propósito, en los casos de permisos) se vuelve atrás y el error real llega al test.
  await t.db.query("savepoint como");
  await t.db.query("set role authenticated");
  await t.q(`select set_config('request.jwt.claims', $1, false)`, [JSON.stringify({ sub: usuario, role: "authenticated" })]);
  let bien = false;
  try { const r = await fn(); bien = true; return r; }
  finally {
    if (!bien) await t.db.query("rollback to savepoint como");
    await t.db.query("reset role");
    await t.q(`select set_config('request.jwt.claims', '', false)`);
    await t.db.query("release savepoint como");
  }
}
before(async () => {
  t = await abrir("prueba-emergencia-puerta");
  for (const rol of ["dueno", "encargado", "recepcion"]) {
    const [{ id }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`${rol}${Math.random()}@ejemplo.invalid`]);
    const [{ id: e }] = await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,$3,$4) returning id`, [t.g, id, rol, rol]);
    if (rol === "dueno") { uDueno = id; eDueno = e; } else if (rol === "encargado") uEnc = id; else uRec = id;
  }
});
after(async () => t && t.cerrar());

const reg = async (socio, m, via = "recepcion", forzar = null) =>
  (await t.q(`select privado.registrar_ingreso($1, $2, $3, null, null, $4, $5) as r`, [socio, t.sede, via, forzar, m]))[0].r;
const guia = async (socio, m) => (await t.q(`select privado.guia_entrada($1, $2, $3) g`, [socio, m, t.sede]))[0].g;
const fila = async (id) => (await t.q(`select * from public.ingresos where id = $1`, [id]))[0];
async function emergencia(desde, hasta, extra = {}) {
  const [{ id }] = await t.q(
    `insert into public.emergencias_puerta (gimnasio_id, sede_id, motivo, iniciada_en, iniciada_por, vence_en, cerrada_en, cerrada_por)
     values ($1,$2,'Molinete trabado',$3,$4,$5,$6,$7) returning id`,
    [t.g, t.sede, desde, eDueno, hasta, extra.cerrada ?? null, extra.cerrada ? eDueno : null]);
  return id;
}

test("dentro de la emergencia el rojo pasa marcado; antes, después de vencer y después de cerrar, no", async () => {
  const [antes, dentro, justo, ya] = [await t.en(HOY, "17:59:00"), await t.en(HOY, "19:00:00"), await t.en(HOY, "21:00:00"), await t.en(HOY, "21:05:00")];
  const e = await emergencia(await t.en(HOY, "18:00:00"), await t.en(HOY, "21:00:00"));
  const s = t.ctx.socios;
  assert.equal((await reg(s.vencida, antes)).resultado, "rechazado", "antes de arrancar no pasa");
  const r = await reg(s.sin_pago, dentro);
  assert.equal(r.resultado, "entro_modo_aviso");
  assert.equal(r.emergencia, true);
  assert.equal(r.veredicto.color, "amarillo", "la puerta ve amarillo y 'pasá'");
  assert.equal(r.veredicto.puede, true);
  assert.match(r.veredicto.texto, /emergencia/i);
  const i = await fila(r.ingreso_id);
  assert.equal(i.emergencia_id, e);
  assert.equal(i.forzado_motivo, "Emergencia de la puerta");
  assert.notEqual(i.color, "amarillo", "el color real (rojo) queda guardado, no el de la puerta");
  // El que estaba al día entra normal, pero también queda atado a la emergencia (para listar quiénes pasaron en ese rato).
  const ok = await reg(s.al_dia, dentro);
  assert.equal(ok.resultado, "entro");
  const iok = await fila(ok.ingreso_id);
  assert.equal(iok.emergencia_id, e);
  assert.equal(iok.forzado_motivo, null, "no estaba bloqueado: no es 'no al día'");
  // El segundo toque dentro de la visita sigue siendo un repetido (no crea otra entrada).
  const otra = await reg(s.sin_pago, await t.en(HOY, "19:10:00"));
  assert.equal(otra.repetido, true);
  // Vence sola: a las 21:00 en punto ya no rige, sin que nadie la cierre.
  assert.equal((await reg(s.vencida, justo)).resultado, "rechazado");
  assert.equal((await reg(s.vencida_tres_meses, ya)).resultado, "rechazado");
});

test("cerrada a mano: desde ese momento no rige; suspendidos y dados de baja nunca pasan; el 'dejar pasar' a mano manda", async () => {
  const s = t.ctx.socios;
  await emergencia(await t.en(HOY, "08:00:00"), await t.en(HOY, "12:00:00"), { cerrada: await t.en(HOY, "09:30:00") });
  assert.equal((await reg(s.vencida, await t.en(HOY, "09:00:00"))).resultado, "entro_modo_aviso");
  assert.equal((await reg(s.vencida_tres_meses, await t.en(HOY, "09:30:00"))).resultado, "rechazado", "cerrada: a las 09:30 ya no");
  await emergencia(await t.en(HOY, "14:00:00"), await t.en(HOY, "16:00:00"));
  const m = await t.en(HOY, "15:00:00");
  assert.equal((await reg(s.suspendido, m)).resultado, "rechazado", "el suspendido no pasa por una emergencia");
  assert.equal((await reg(s.se_fue, m)).resultado, "rechazado", "el dado de baja tampoco");
  const f = await reg(s.sin_plan, m, "recepcion", "Paga mañana");
  assert.equal(f.resultado, "forzado", "con motivo a mano sigue siendo un dejar pasar de una persona");
  assert.equal((await fila(f.ingreso_id)).forzado_motivo, "Paga mañana");
});

test("otra sede o otro gimnasio no se enteran; la guía muestra el chip y pone Anotar en vez de Cobrar", async () => {
  const s = t.ctx.socios;
  const m = await t.en(HOY, "22:30:00");   // fuera de las ventanas de los otros casos (comparten transacción)
  const sinEmergencia = await guia(s.vencida, m);
  assert.equal(sinEmergencia.emergencia, false);
  assert.equal(sinEmergencia.boton, "cobrar");
  await emergencia(await t.en(HOY, "22:00:00"), await t.en(HOY, "23:30:00"));
  const g = await guia(s.vencida, m);
  assert.equal(g.emergencia, true);
  assert.equal(g.boton, "anotar");
  assert.match(g.decile, /EMERGENCIA/);
  assert.ok(g.chips.find((c) => c.clave === "emergencia"));
  assert.equal(g.puede, false, "el cálculo de la puerta no cambia: la emergencia no es un hecho de pago");
  const susp = await guia(s.suspendido, m);
  assert.equal(susp.emergencia, false);
  assert.equal((await guia(s.al_dia, m)).emergencia, false);
  // Otra sede del mismo gimnasio: sin emergencia.
  const [{ id: sede2 }] = await t.q(`insert into public.sedes (gimnasio_id, nombre) values ($1, 'Sucursal') returning id`, [t.g]);
  const r = (await t.q(`select privado.registrar_ingreso($1, $2, 'recepcion', null, null, null, $3) as r`, [s.vencida_tres_meses, sede2, m]))[0].r;
  assert.equal(r.resultado, "rechazado");
});

test("encendido, permisos y el ciclo completo con las funciones públicas (now)", async () => {
  const s = t.ctx.socios;
  const est = () => como(uRec, async () => (await t.q(`select public.estado_emergencia_puerta($1, $2) e`, [t.g, t.sede]))[0].e);
  const activar = (u, motivo = "Corte de luz en la puerta", horas = 3) =>
    como(u, async () => (await t.q(`select public.activar_emergencia_puerta($1, $2, $3, $4) e`, [t.g, t.sede, motivo, horas]))[0].e);
  assert.equal((await est()).habilitada, false, "arranca apagado");
  await t.falla(() => activar(uDueno), /apagado/);
  await t.falla(() => como(uEnc, () => t.q(`select public.habilitar_emergencia_puerta($1, true)`, [t.g])), /Sin permiso/);
  await t.falla(() => como(uRec, () => t.q(`select public.habilitar_emergencia_puerta($1, true)`, [t.g])), /Sin permiso/);
  assert.equal(await como(uDueno, async () => (await t.q(`select public.habilitar_emergencia_puerta($1, true) r`, [t.g]))[0].r), true);
  assert.equal((await est()).habilitada, true);

  await t.falla(() => activar(uRec), /Sin permiso/);
  await t.falla(() => activar(uDueno, "corto"), /motivo/);
  await t.falla(() => activar(uDueno, "Corte de luz en la puerta", 0), /1 a 12 horas/);
  await t.falla(() => activar(uDueno, "Corte de luz en la puerta", 13), /1 a 12 horas/);
  const a = await activar(uEnc, "Molinete en libre desde las 18", 2);
  assert.equal(a.activa.motivo, "Molinete en libre desde las 18");
  assert.equal(a.activa.entradas, 0);
  await t.falla(() => activar(uDueno), /Ya hay una emergencia activa/);
  assert.ok((await est()).activa, "la recepción también ve que hay emergencia");
  assert.equal((await est()).puede_activar, false);

  // La recepción anota al vencido por la función pública: pasa marcado.
  const sinPlazo = await como(uRec, async () => (await t.q(`select public.registrar_ingreso($1, $2) r`, [s.sin_plan, t.sede]))[0].r);
  assert.equal(sinPlazo.resultado, "entro_modo_aviso");
  assert.equal(sinPlazo.veredicto.color, "amarillo");
  assert.equal((await est()).activa.entradas, 1);

  // Quiénes entraron: solo dueño y encargado.
  const lista = await como(uEnc, async () => (await t.q(`select public.entradas_de_emergencia($1, $2) l`, [t.g, a.activa.id]))[0].l);
  assert.equal(lista.length, 1);
  assert.equal(lista[0].no_al_dia, true);
  await t.falla(() => como(uRec, () => t.q(`select public.entradas_de_emergencia($1, $2)`, [t.g, a.activa.id])), /Sin permiso/);
  await t.falla(() => como(uRec, () => t.q(`select public.cerrar_emergencia_puerta($1, $2)`, [t.g, a.activa.id])), /Sin permiso/);

  const cierre = await como(uDueno, async () => (await t.q(`select public.cerrar_emergencia_puerta($1, $2) r`, [t.g, a.activa.id]))[0].r);
  assert.equal(cierre.entradas.length, 1);
  assert.equal(cierre.entradas[0].socio, "Testigo Sin Plan");
  await t.falla(() => como(uDueno, () => t.q(`select public.cerrar_emergencia_puerta($1, $2)`, [t.g, a.activa.id])), /ya estaba cerrada/);
  assert.equal((await est()).activa, null, "cerrada: la puerta vuelve a lo de siempre");
  const despues = await como(uRec, async () => (await t.q(`select public.registrar_ingreso($1, $2) r`, [s.sin_pago, t.sede]))[0].r);
  assert.notEqual(despues.emergencia, true);

  const h = await como(uDueno, async () => (await t.q(`select public.historial_emergencias_puerta($1) h`, [t.g]))[0].h);
  const mia = h.find((x) => x.id === a.activa.id);
  assert.deepEqual([mia.estado, mia.entradas, mia.no_al_dia, mia.por, mia.cerro], ["cerrada", 1, 1, "encargado", "dueno"]);

  // Apagarla del todo corta la que estuviera corriendo.
  await activar(uDueno);
  await como(uDueno, () => t.q(`select public.habilitar_emergencia_puerta($1, false)`, [t.g]));
  assert.equal((await est()).activa, null);
  assert.equal((await est()).habilitada, false);
});

test("la tablet pregunta si hay emergencia con su token", async () => {
  await t.q(`update public.configuracion_gimnasio set accesos_activos = array['recepcion','kiosco'], emergencia_puerta_habilitada = true where gimnasio_id = $1`, [t.g]);
  const { token } = await como(uDueno, async () => (await t.q(`select public.autorizar_tablet($1, $2, 'Puerta') as r`, [t.g, t.sede]))[0].r);
  const tablet = async () => {
    await t.q(`set local role anon`);
    await t.q(`select set_config('request.jwt.claims', '{"role":"anon"}', true)`);
    try { return (await t.q(`select public.kiosco_emergencia($1) r`, [token]))[0].r; } finally { await t.q(`reset role`); }
  };
  assert.equal((await tablet()).activa, false);
  await como(uDueno, () => t.q(`select public.activar_emergencia_puerta($1, $2, 'Molinete trabado', 1)`, [t.g, t.sede]));
  assert.equal((await tablet()).activa, true);
  // Sin token válido no responde.
  await t.falla(async () => {
    await t.q(`set local role anon`);
    try { await t.q(`select public.kiosco_emergencia('nada')`); } finally { await t.q(`reset role`); }
  });
});
