// FA-14 · Recomendación con regla clara, insignias y resumen del año de la app del socio. Todo calculado, con un momento fijo
// (nunca depende de now()). Solo lo pide el socio de ese gimnasio.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir } from "./_comun.mjs";

let t, socioU, otroU, ahora, tardeMomento;
async function como(usuario, fn) {
  await t.db.query("set role authenticated");
  await t.q(`select set_config('request.jwt.claims', $1, false)`, [JSON.stringify({ sub: usuario, role: "authenticated" })]);
  try { return await fn(); } finally { await t.db.query("reset role"); await t.q(`select set_config('request.jwt.claims', '', false)`); }
}
const S = () => t.ctx.socios;
const visita = (dia, hora = "19:00:00", resultado = "entro") => t.q(
  `insert into public.ingresos (gimnasio_id, sede_id, socio_id, momento, via_acceso, resultado, color, motivo, texto)
   values ($1,$2,$3, privado.medianoche($4::date, $5) + $6::interval, 'recepcion', $7, 'verde', 'al_dia', 'Pasá')`,
  [t.g, t.sede, S().al_dia, dia, t.ctx.zona, hora, resultado]);
const resumen = async (momento = ahora) => (await t.q(`select public.resumen_app_socio($1, $2) r`, [S().al_dia, momento]))[0].r;

before(async () => {
  t = await abrir("prueba-resumen-app");
  [{ id: socioU }] = await t.q(`insert into auth.users (phone) values ('+549000077900001') returning id`);
  [{ id: otroU }] = await t.q(`insert into auth.users (phone) values ('+549000077900002') returning id`);
  await t.q(`update public.socios set usuario_id = $2 where id = $1`, [S().al_dia, socioU]);
  await t.q(`update public.socios set usuario_id = $2 where id = $1`, [S().por_vencer, otroU]);
  await t.q(`update public.ingresos set anulado_en = now(), anulado_motivo = 'prueba' where socio_id = $1 and anulado_en is null`, [S().al_dia]);
  await t.q(`delete from public.asistencias where socio_id = $1`, [S().al_dia]);
  ahora = await t.en("2026-11-14", "12:00:00");   // sábado
  tardeMomento = await t.en("2026-11-14", "20:30:00");
});
after(async () => t && t.cerrar());

test("sin visitas: no recomienda nada y no hay insignias logradas", async () => {
  await como(socioU, async () => {
    const r = await resumen();
    assert.equal(r.recomendacion, null);
    assert.equal(r.insignias.filter((x) => x.lograda).length, 0);
    assert.equal(r.anio.visitas, 0);
    assert.equal(r.anio.mes_top, null);
  });
});

test("vino hace menos de 7 días: no recomienda; hace 10: lo dice con los días", async () => {
  await visita("2026-11-10");
  await como(socioU, async () => { assert.equal((await resumen()).recomendacion, null); });
  await t.q(`update public.ingresos set anulado_en = now(), anulado_motivo = 'prueba' where socio_id = $1 and anulado_en is null`, [S().al_dia]);
  await visita("2026-11-04");
  await como(socioU, async () => {
    const r = (await resumen()).recomendacion;
    assert.equal(r.regla, "sin_venir_7_dias");
    assert.equal(r.dias, 10);
    assert.match(r.texto, /^Hace 10 días que no venís\./);
  });
});

test("con clases en el gimnasio le suma la próxima de hoy; si ya pasó, no", async () => {
  const [{ id: act }] = await t.q(`insert into public.actividades (gimnasio_id, nombre) values ($1, 'Funcional') returning id`, [t.g]);
  await t.q(`update public.configuracion_gimnasio set modo_clases = 'sin_reserva' where gimnasio_id = $1`, [t.g]);
  await t.q(`insert into public.horarios_clase (gimnasio_id, sede_id, actividad_id, dia_semana, hora_inicio, duracion_min, vigente_desde) values ($1,$2,$3, 6, '19:00', 60, '2026-01-01')`, [t.g, t.sede, act]);
  await como(socioU, async () => {
    const r = (await resumen()).recomendacion;
    assert.match(r.texto, /Hoy hay Funcional a las 19:00\./);
    assert.deepEqual(r.clase, { nombre: "Funcional", hora: "19:00" });
    const tarde = (await resumen(tardeMomento)).recomendacion;
    assert.equal(tarde.clase, null);
    assert.match(tarde.texto, /Te esperamos/);
  });
  await t.q(`update public.configuracion_gimnasio set modo_clases = 'ninguno' where gimnasio_id = $1`, [t.g]);
  await como(socioU, async () => { assert.equal((await resumen()).recomendacion.clase, null); });
});

test("insignias: 10 visitas y 4 semanas seguidas salen de contar; un ingreso rechazado o anulado no cuenta", async () => {
  await t.q(`update public.ingresos set anulado_en = now(), anulado_motivo = 'prueba' where socio_id = $1 and anulado_en is null`, [S().al_dia]);
  for (const d of ["2026-10-20", "2026-10-27", "2026-11-03", "2026-11-10"]) await visita(d);       // 4 martes seguidos
  for (const d of ["2026-10-21", "2026-10-22", "2026-10-23", "2026-10-24", "2026-10-28", "2026-10-29"]) await visita(d);
  await visita("2026-11-11", "19:00:00", "rechazado");
  const [{ id: anul }] = await t.q(`select id from public.ingresos where socio_id = $1 and anulado_en is null and resultado = 'entro' order by momento limit 1 offset 1`, [S().al_dia]);   // la del 21/10: no rompe la racha de martes
  await t.q(`update public.ingresos set anulado_en = now(), anulado_motivo = 'prueba' where id = $1`, [anul]);
  await como(socioU, async () => {
    const r = await resumen();
    const por = Object.fromEntries(r.insignias.map((x) => [x.clave, x]));
    assert.equal(por.primera_visita.lograda, true);
    assert.equal(por.diez_visitas.lograda, false);        // 10 menos la anulada = 9
    assert.equal(por.diez_visitas.avance, 9);
    assert.equal(por.racha_4_semanas.lograda, true);
    assert.equal(por.cien_visitas.lograda, false);
    assert.equal(por.primera_clase.lograda, false);
  });
  await visita("2026-11-12");
  await como(socioU, async () => { assert.equal((await resumen()).insignias.find((x) => x.clave === "diez_visitas").lograda, true); });
});

test("resumen del año: visitas, mes y día más fuertes; lo de otro año no cuenta", async () => {
  await visita("2025-12-30");
  await como(socioU, async () => {
    const a = (await resumen()).anio;
    assert.equal(a.anio, 2026);
    assert.equal(a.visitas, 10);        // 10 de 2026 (la de 2025 no)
    assert.equal(a.mes_top, 10);        // octubre tiene 9 de las 10
    assert.ok(a.mejor_racha_semanas >= 4);
  });
});

test("otro socio no puede pedir el resumen, ni el navegador sin sesión", async () => {
  await como(otroU, () => t.falla(() => t.q(`select public.resumen_app_socio($1)`, [S().al_dia]), /Sin permiso/));
  await t.db.query("set role anon");
  try { await t.falla(() => t.q(`select public.resumen_app_socio($1)`, [S().al_dia]), /permission|permiso/i); } finally { await t.db.query("reset role"); }
});
