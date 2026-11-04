// Horarios de apertura y cierres (migración 0024). La cuenta de "abierto
// ahora" se prueba con privado.agenda(gimnasio, momento) y momentos fijos:
// nunca depende de now().
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir } from "./_comun.mjs";

let t, otro, sedeOtro, u = {};
async function persona(rol, gimnasio = null) {
  const [{ id: usuario }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`${rol}${Math.random()}@ejemplo.invalid`]);
  await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,$3,$4)`, [gimnasio ?? t.g, usuario, `Persona ${rol}`, rol]);
  return usuario;
}
before(async () => {
  t = await abrir("prueba-horarios");
  [{ id: otro }] = await t.q(`insert into public.gimnasios (slug, nombre) values ('prueba-horarios-otro', 'Otro') returning id`);
  [{ id: sedeOtro }] = await t.q(`select id from public.sedes where gimnasio_id = $1`, [otro]);
  for (const rol of ["dueno", "encargado", "recepcion"]) u[rol] = await persona(rol);
});
after(async () => t && t.cerrar());

const SEMANA = [1, 2, 3, 4, 5].map((dia) => ({ dia, abre: "07:00", cierra: "22:00" }))
  .concat([{ dia: 6, abre: "09:00", cierra: "13:00" }, { dia: 6, abre: "16:00", cierra: "20:00" }]);
const guardar = (franjas, sede = t.sede) => t.q(`select public.guardar_horarios_apertura($1, $2, $3)`, [t.g, sede, JSON.stringify(franjas)]);
// HOY en las pruebas es el sábado 14/11/2026.
const agenda = async (dia, hora) => (await t.q(`select privado.agenda($1, $2) as a`, [t.g, await t.en(dia, hora)]))[0].a;
const texto = async (dia, hora) => (await agenda(dia, hora)).sedes[0].texto;

test("horarios: el dueño los guarda; los errores dicen qué día y qué arreglar", async () => {
  await t.comoUsuario(u.dueno, async () => {
    await t.falla(() => guardar([{ dia: 1, abre: "22:00", cierra: "07:00" }]), /El lunes: abre a las 22:00 y cierra a las 07:00/);
    await t.falla(() => guardar([{ dia: 2, abre: "07:00", cierra: "13:00" }, { dia: 2, abre: "12:00", cierra: "20:00" }]), /El martes tiene dos franjas que se pisan/);
    await t.falla(() => guardar([{ dia: 3, abre: "7 de la mañana", cierra: "22:00" }]), /se escriben como 07:00/);
    await t.falla(() => guardar([1, 2, 3, 4].map((h) => ({ dia: 4, abre: `0${h}:00`, cierra: `0${h}:30` }))), /Hasta 3 franjas por día \(el jueves\)/);
    await t.falla(() => guardar([], sedeOtro), /no es de este gimnasio/);
    await guardar([{ dia: 5, abre: "18:00", cierra: "00:00" }]);   // "hasta medianoche"
    const [{ h }] = await t.q(`select public.horarios_apertura_panel($1) as h`, [t.g]);
    assert.deepEqual(h.sedes[0].franjas, [{ dia: 5, abre: "18:00", cierra: "24:00" }], "cerrar a las 00:00 se guarda como medianoche");
  });
  // La cuenta con un momento fijo (fuera de la sesión: privado.* no es del cliente).
  await t.q(`insert into public.horarios_apertura (gimnasio_id, sede_id, dia, abre, cierra) values ($1,$2,5,'18:00','24:00')`, [t.g, t.sede]);
  const v = await agenda("2026-11-13", "23:30");
  assert.equal(v.sedes[0].abierto, true, "viernes 23:30 con cierre a medianoche: abierto");
  assert.match(v.sedes[0].texto, /cierra 24:00/);
  await t.comoUsuario(u.encargado, () => t.falla(() => guardar(SEMANA), /Sin permiso/));
});

test("abierto ahora: franjas, turno partido, día sin horario y próxima apertura", async () => {
  await t.q(`delete from public.horarios_apertura where gimnasio_id = $1`, [t.g]);
  for (const f of SEMANA) await t.q(`insert into public.horarios_apertura (gimnasio_id, sede_id, dia, abre, cierra) values ($1,$2,$3,$4,$5)`, [t.g, t.sede, f.dia, f.abre, f.cierra]);
  assert.equal(await texto("2026-11-14", "10:00"), "Abierto · cierra 13:00");
  assert.equal(await texto("2026-11-14", "14:00"), "Cerrado · abre hoy 16:00");
  assert.equal(await texto("2026-11-14", "21:00"), "Cerrado · abre el lunes 07:00");
  assert.equal(await texto("2026-11-15", "10:00"), "Cerrado · abre mañana 07:00");
  assert.equal((await agenda("2026-11-14", "10:00")).sedes[0].franjas.length, SEMANA.length);
});

test("cierres: un feriado cambia el 'abierto ahora' y aparece en la lista; los errores se entienden", async () => {
  await t.comoUsuario(u.encargado, async () => {
    await t.falla(() => t.q(`select public.crear_cierre($1, '2026-11-16', '2026-11-16', 'Feriado')`, [t.g]), /último día no puede ser antes/);
    await t.falla(() => t.q(`select public.crear_cierre($1, '2026-11-16', '2026-11-17', '  ')`, [t.g]), /Escribí el motivo/);
    await t.falla(() => t.q(`select public.crear_cierre($1, '2026-11-16', '2026-11-17', 'X', true, $2)`, [t.g, t.sede]), /gimnasio entero cerrado/);
    await t.falla(() => t.q(`select public.crear_cierre($1, '2026-01-01', '2026-06-01', 'Largo')`, [t.g]), /hasta 3 meses/);
    const [{ c }] = await t.q(`select public.crear_cierre($1, '2026-11-16', '2026-11-17', 'Feriado') as c`, [t.g]);
    assert.ok(c);
    await t.falla(() => t.q(`select public.crear_cierre($1, '2026-11-15', '2026-11-18', 'Otro')`, [t.g]), /Ya hay un cierre cargado/);
    const [{ l }] = await t.q(`select public.cierres_panel($1) as l`, [t.g]);
    const f = l.find((x) => x.cierre_id === c);
    assert.equal(f.desde, "2026-11-16");
    assert.equal(f.hasta, "2026-11-16", "el último día cerrado, no el exclusivo");
    assert.equal(f.motivo, "Feriado");
  });
  // Necesita el cierre guardado: se crea fuera de la sesión que revierte.
  await t.q(`insert into public.cierres (gimnasio_id, desde, hasta, motivo, compensa)
             values ($1, privado.medianoche('2026-11-16', 'America/Argentina/Buenos_Aires'), privado.medianoche('2026-11-17', 'America/Argentina/Buenos_Aires'), 'Feriado', false)`, [t.g]);
  assert.equal(await texto("2026-11-16", "10:00"), "Cerrado hoy: Feriado");
  assert.equal(await texto("2026-11-14", "21:00"), "Cerrado · abre el martes 07:00", "el lunes feriado se saltea");
  const a = await agenda("2026-11-14", "10:00");
  assert.deepEqual(a.cierres.map((x) => [x.desde, x.hasta, x.motivo]), [["2026-11-16", "2026-11-16", "Feriado"]]);
});

test("permisos: recepción ve los horarios pero no los cierres del panel; la página los ve sin sesión", async () => {
  await t.comoUsuario(u.recepcion, async () => {
    const [{ h }] = await t.q(`select public.horarios_apertura_panel($1) as h`, [t.g]);
    assert.ok(Array.isArray(h.sedes));
    await t.falla(() => t.q(`select public.cierres_panel($1)`, [t.g]), /Sin permiso/);
    await t.falla(() => t.q(`select public.crear_cierre($1, '2026-12-24', '2026-12-26', 'Navidad')`, [t.g]), /Sin permiso|permiso/i);
  });
  await t.q(`insert into public.dominios_gimnasio (gimnasio_id, host, tipo) values ($1, 'horarios-prueba.ejemplo.invalid', 'propio')`, [t.g]);
  await t.db.query("savepoint anon");
  try {
    await t.db.query("set local role anon");
    const [{ a }] = await t.q(`select public.agenda_publica('horarios-prueba.ejemplo.invalid') as a`);
    assert.ok(a.sedes.length >= 1);
    const [{ n }] = await t.q(`select public.agenda_publica('nadie.ejemplo.invalid') as n`);
    assert.equal(n, null);
    await t.falla(() => t.q(`select public.cierres_panel($1)`, [t.g]), /permission denied/);
  } finally { await t.db.query("rollback to savepoint anon"); }
});
