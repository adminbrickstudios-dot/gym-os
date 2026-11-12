// N2 (20261111200400): apto físico en la entrada. Cambia privado.calcular_acceso, así que la prueba es VIEJO CONTRA NUEVO con momentos fijos:
// la función anterior (20261107005100, prueba gratis) se vuelve a crear acá, con otro nombre, desde el archivo de esa migración.
//   · apagada (función, pide_apto o modo "nada"): el veredicto es idéntico al viejo para todos los socios testigo en 6 momentos fijos
//   · prendida y sin apto: "avisa" suma el aviso y pone amarillo al verde; "frena" pone rojo a quien podía pasar; quien ya no podía pasar no cambia
//   · con apto vigente: idéntico; por vencer: aviso amarillo; vencido: frena
// Solo se guarda la fecha en que vence el apto; el certificado y los datos de salud no existen en la base.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { HORA_TESTIGO, sumarDias } from "../../scripts/datos/casos-testigo.mjs";
import { abrir, HOY } from "./_comun.mjs";

let t, momentos, uDueno, uEnc, uRec;
const crear = async (rol) => {
  const [{ id }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`${rol}${Math.random()}@ejemplo.invalid`]);
  await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,$3,$4)`, [t.g, id, rol, rol]);
  return id;
};
async function como(usuario, fn) {
  await t.db.query("set role authenticated");
  await t.q(`select set_config('request.jwt.claims', $1, false)`, [JSON.stringify({ sub: usuario, role: "authenticated" })]);
  try { return await fn(); } finally { await t.db.query("reset role"); await t.q(`select set_config('request.jwt.claims', '', false)`); }
}
before(async () => {
  t = await abrir("prueba-n2-apto");
  uDueno = await crear("dueno"); uEnc = await crear("encargado"); uRec = await crear("recepcion");
  // La versión anterior de la puerta, intacta, con otro nombre.
  const mig = readFileSync(new URL("../migrations/20261107005100_prueba_gratis.sql", import.meta.url), "utf8");
  const ini = mig.indexOf("create or replace function privado.calcular_acceso(");
  const fin = mig.indexOf("revoke all on function privado.calcular_acceso", ini);
  assert.ok(ini > 0 && fin > ini, "no se encontró la puerta vieja en la migración");
  await t.db.query(mig.slice(ini, fin).replace("privado.calcular_acceso(", "privado.calcular_acceso_viejo_n2("));
  momentos = [await t.en(HOY, `${HORA_TESTIGO}:00`), await t.en(HOY, "03:00:00"), await t.en(sumarDias(HOY, -20)), await t.en(sumarDias(HOY, 5)),
              await t.en(sumarDias(HOY, 40)), await t.en(sumarDias(HOY, 100))];
});
after(async () => t && t.cerrar());

const cfg = (pide, modo, dias = 15) => t.q(`update public.configuracion_gimnasio set pide_apto = $2, apto_en_entrada = $3, apto_aviso_dias = $4 where gimnasio_id = $1`, [t.g, pide, modo, dias]);
async function prenderFuncion(activa) {
  // La prende el dueño, como en la pantalla.
  await como(uDueno, () => t.q(`select public.cambiar_funcion_nueva($1, 'apto_vencimiento', $2)`, [t.g, activa]));
}
const par = async (socio, m) => {
  const [{ v }] = await t.q(`select to_jsonb(privado.calcular_acceso_viejo_n2($1, $2, $3)) v`, [socio, m, t.sede]);
  const [{ n }] = await t.q(`select to_jsonb(privado.calcular_acceso($1, $2, $3)) n`, [socio, m, t.sede]);
  return { v, n };
};
const todos = () => Object.entries(t.ctx.socios);
async function identicos(etiqueta) {
  let n = 0;
  for (const [clave, id] of todos()) for (const m of momentos) {
    const { v, n: nuevo } = await par(id, m);
    assert.deepEqual(nuevo, v, `${etiqueta}: ${clave} en ${m.toISOString()} cambió`);
    n++;
  }
  assert.ok(n >= 6 * 20, `se compararon ${n} veredictos`);
}
const apto = (socio, dia) => t.q(`insert into public.aptos_fisicos (gimnasio_id, socio_id, vale_hasta) values ($1,$2, privado.medianoche($3::date, $4)) returning id`, [t.g, socio, sumarDias(dia, 1), t.ctx.zona]);

test("apagada, de cualquiera de las tres formas, el veredicto es idéntico al de antes para todos los testigos en 6 momentos", async () => {
  await cfg(true, "frena");               // función apagada (nunca prendida), pide apto y frena
  await identicos("función apagada");
  await prenderFuncion(true);
  await cfg(true, "nada");                // función prendida, modo "nada"
  await identicos("modo nada");
  await cfg(false, "frena");              // función prendida, el gimnasio no pide apto
  await identicos("no pide apto");
  await cfg(true, "frena");
  await prenderFuncion(false);            // apagada otra vez
  await identicos("apagada otra vez");
});

test("prendida y sin ningún apto: avisa suma el aviso; frena frena solo a quien podía pasar", async () => {
  await prenderFuncion(true);
  let cambiados = 0;
  await cfg(true, "avisa");
  for (const [clave, id] of todos()) for (const m of momentos) {
    const { v, n } = await par(id, m);
    if (!v.puede || n.motivo === "se_fue") { assert.deepEqual(n, v, `${clave}: quien no puede pasar no cambia`); continue; }
    cambiados++;
    assert.equal(n.puede, true); assert.equal(n.motivo, v.motivo);
    assert.equal(n.color, v.color === "verde" ? "amarillo" : v.color, `${clave}: el verde pasa a amarillo`);
    assert.ok(n.avisos.includes("Apto físico: no presentó el apto"), `${clave}: dice que falta el apto`);
  }
  assert.ok(cambiados > 10, "hubo veredictos que pasar a prueba");
  await cfg(true, "frena");
  for (const [clave, id] of todos()) for (const m of momentos) {
    const { v, n } = await par(id, m);
    if (!v.puede) { assert.deepEqual(n, v, `${clave}: quien no podía pasar no cambia`); continue; }
    assert.equal(n.puede, false); assert.equal(n.color, "rojo"); assert.equal(n.motivo, "apto_vencido"); assert.equal(n.consume, "nada");
    assert.equal(n.texto, "Apto físico: no presentó el apto");
  }
  await prenderFuncion(false);
});

test("con apto: vigente lejos no cambia nada, por vencer avisa en amarillo, vencido frena, anulado vale como no presentado", async () => {
  await prenderFuncion(true);
  await cfg(true, "frena", 15);
  const socio = t.ctx.socios.al_dia;          // verde con cobertura hasta el 24/11 (hoy 14/11)
  const m = momentos[0];
  await apto(socio, sumarDias(HOY, 90));
  let r = await par(socio, m);
  assert.deepEqual(r.n, r.v, "apto vigente por 90 días: igual que antes");
  await t.q(`update public.aptos_fisicos set anulado_en = now() where socio_id = $1`, [socio]);
  r = await par(socio, m); assert.equal(r.n.motivo, "apto_vencido", "anulado = sin apto");
  await apto(socio, sumarDias(HOY, 5));                      // vence en 5 días: dentro de los 15 de aviso
  r = await par(socio, m);
  assert.equal(r.n.puede, true); assert.equal(r.n.color, "amarillo"); assert.equal(r.n.motivo, r.v.motivo);
  assert.ok(r.n.avisos.some((a) => /^Apto físico: vence el \d\d\/\d\d$/.test(a)), JSON.stringify(r.n.avisos));
  await cfg(true, "frena", 3);                               // con 3 días de aviso, 5 días queda lejos
  r = await par(socio, m); assert.deepEqual(r.n, r.v);
  // El mismo apto, visto después de que vence: el último día todavía vale, el siguiente frena.
  const ultimo = await t.en(sumarDias(HOY, 5), "19:00:00"), despues = await t.en(sumarDias(HOY, 6), "09:00:00");
  r = await par(socio, ultimo); assert.notEqual(r.n.motivo, "apto_vencido", "el día que vence todavía vale");
  r = await par(socio, despues);
  assert.equal(r.n.motivo, "apto_vencido"); assert.match(r.n.texto, /^Apto físico vencido el \d\d\/\d\d$/);
  // Modo aviso de la primera semana: el aviso sigue mandando (deja pasar y lo dice).
  await t.q(`update public.configuracion_gimnasio set avisar_sin_bloquear_hasta = $2 where gimnasio_id = $1`, [t.g, await t.en(sumarDias(HOY, 30))]);
  r = await par(socio, despues); assert.equal(r.n.puede, true); assert.equal(r.n.modo_aviso, true);
  await t.q(`update public.configuracion_gimnasio set avisar_sin_bloquear_hasta = null where gimnasio_id = $1`, [t.g]);
  await prenderFuncion(false);
  r = await par(socio, despues); assert.deepEqual(r.n, r.v, "apagada otra vez, vuelve a ser idéntico");
});

test("configuración: la ve el equipo de gestión, solo el dueño la cambia, valida y exige la función y 'pedir apto'", async () => {
  await cfg(false, "nada", 15);
  await prenderFuncion(false);
  await como(uDueno, async () => {
    await t.falla(() => t.q(`select public.guardar_apto_config($1, 'avisa', 15)`, [t.g]), /no está prendida/);
    assert.equal((await t.q(`select public.apto_config($1) c`, [t.g]))[0].c.activa, false);
  });
  await prenderFuncion(true);
  await como(uDueno, async () => {
    await t.falla(() => t.q(`select public.guardar_apto_config($1, 'avisa', 15)`, [t.g]), /Pedir apto físico/);
  });
  await cfg(true, "nada", 15);
  await como(uDueno, async () => {
    await t.falla(() => t.q(`select public.guardar_apto_config($1, 'raro', 15)`, [t.g]), /nada, avisar o frenar/);
    await t.falla(() => t.q(`select public.guardar_apto_config($1, 'frena', 0)`, [t.g]), /entre 1 y 60/);
    const [{ c }] = await t.q(`select public.guardar_apto_config($1, 'frena', 20) c`, [t.g]);
    assert.deepEqual(c, { modo: "frena", dias: 20 });
    assert.deepEqual((await t.q(`select public.apto_config($1) c`, [t.g]))[0].c, { activa: true, pide_apto: true, modo: "frena", dias: 20 });
  });
  await como(uEnc, async () => {
    assert.equal((await t.q(`select public.apto_config($1) c`, [t.g]))[0].c.modo, "frena");
    await t.falla(() => t.q(`select public.guardar_apto_config($1, 'nada', 15)`, [t.g]), /Sin permiso/);
  });
  await como(uRec, async () => {
    await t.falla(() => t.q(`select public.apto_config($1)`, [t.g]), /Sin permiso/);
    await t.falla(() => t.q(`select public.guardar_apto_config($1, 'nada', 15)`, [t.g]), /Sin permiso/);
  });
  await prenderFuncion(false);
});

test("aptos_por_vencer: quién vence pronto, quién ya venció y cuántos no tienen apto (solo cuota al día); apagada es un error", async () => {
  await cfg(true, "nada", 15);
  await prenderFuncion(false);
  await como(uRec, () => t.falla(() => t.q(`select public.aptos_por_vencer($1)`, [t.g]), /no está prendida/));
  await prenderFuncion(true);
  const ahora = (await t.q(`select (now() at time zone $1)::date d`, [t.ctx.zona]))[0].d;
  const dia = (n) => { const d = new Date(ahora); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
  const [a, b, c, d] = [t.ctx.socios.al_dia, t.ctx.socios.por_vencer, t.ctx.socios.vence_hoy, t.ctx.socios.sin_pago];
  await t.q(`update public.socios set cubierto_hasta = now() + interval '30 days' where id = any($1::uuid[])`, [[a, b, c]]);
  await t.q(`delete from public.aptos_fisicos where gimnasio_id = $1`, [t.g]);
  await apto(a, dia(5));        // por vencer
  await apto(b, dia(-3));       // ya venció
  // c: sin apto ; d: sin cobertura (no cuenta)
  await apto(d, dia(2));
  await como(uRec, async () => {
    const [{ r }] = await t.q(`select public.aptos_por_vencer($1) r`, [t.g]);
    assert.deepEqual(r.por_vencer.map((x) => x.socio_id), [a]);
    assert.equal(r.por_vencer[0].vence, dia(5));
    assert.deepEqual(r.vencidos.map((x) => x.socio_id), [b]);
    assert.ok(r.sin_apto >= 1);
    assert.ok(!r.por_vencer.some((x) => x.socio_id === d), "sin cuota al día no se avisa");
  });
  await cfg(false, "nada", 15);
  await como(uDueno, () => t.falla(() => t.q(`select public.aptos_por_vencer($1)`, [t.g]), /no pide apto/));
  await prenderFuncion(false);
});
