// VD-2b (0140): la guía de la Entrada suma el chip "Tiene clase hoy" (reserva confirmada de hoy)
// y "En prueba" (primera vez con un pase o pack). Momento fijo: sábado 14/11/2026, 19:00.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir, HOY } from "./_comun.mjs";

let t, momento;
const guia = async (clave) => (await t.q(`select privado.guia_entrada($1, $2, $3) g`, [t.ctx.socios[clave], momento, t.sede]))[0].g;
const chip = (g, clave) => g.chips.find((c) => c.clave === clave);
async function aparte(fn) {
  await t.db.query("savepoint aparte");
  try { return await fn(); } finally { await t.db.query("rollback to savepoint aparte"); }
}
before(async () => { t = await abrir("prueba-guia-clase-hoy"); momento = await t.en(HOY, "19:00:00"); });
after(async () => t && t.cerrar());

test("una reserva confirmada de hoy muestra 'Tiene clase hoy' con la hora; la de otro día o la cancelada no", async () => {
  assert.equal(chip(await guia("al_dia"), "clase_hoy"), undefined, "sin reserva no hay chip");
  const [{ id: act }] = await t.q(`insert into public.actividades (gimnasio_id, nombre) values ($1, 'Funcional 2b') returning id`, [t.g]);
  const clase = async (dia, hora) => (await t.q(
    `insert into public.clases (gimnasio_id, sede_id, actividad_id, inicio, fin)
       select $1,$2,$3, m + $5::interval, m + $5::interval + interval '1 hour' from (select privado.medianoche($4::date, $6) m) s returning id`,
    [t.g, t.sede, act, dia, hora, t.ctx.zona]))[0].id;
  await aparte(async () => {
    const c = await clase(HOY, "21:00:00");
    await t.q(`insert into public.reservas (gimnasio_id, clase_id, socio_id, estado) values ($1,$2,$3,'confirmada')`, [t.g, c, t.ctx.socios.al_dia]);
    const ch = chip(await guia("al_dia"), "clase_hoy");
    assert.ok(ch, "hay chip");
    assert.equal(ch.texto, "Tiene clase hoy a las 21:00");
  });
  await aparte(async () => {
    const c = await clase("2026-11-15", "10:00:00");
    await t.q(`insert into public.reservas (gimnasio_id, clase_id, socio_id, estado) values ($1,$2,$3,'confirmada')`, [t.g, c, t.ctx.socios.al_dia]);
    assert.equal(chip(await guia("al_dia"), "clase_hoy"), undefined, "mañana no es hoy");
  });
  await aparte(async () => {
    const c = await clase(HOY, "21:00:00");
    await t.q(`insert into public.reservas (gimnasio_id, clase_id, socio_id, estado, cancelada_en, cancelada_por) values ($1,$2,$3,'cancelada', now(), 'socio')`, [t.g, c, t.ctx.socios.al_dia]);
    assert.equal(chip(await guia("al_dia"), "clase_hoy"), undefined, "cancelada no cuenta");
  });
});

test("'En prueba' solo con pase o pack y primera vez; quien está al día con cuota no", async () => {
  assert.equal(chip(await guia("al_dia"), "en_prueba"), undefined);
  const g = await guia("pack_con_clases");
  assert.equal(g.puede, true, "el testigo del pack puede entrar");
  assert.ok(chip(g, "en_prueba"), "pack y sin entradas: en prueba");
  await aparte(async () => {
    await t.q(`insert into public.ingresos (gimnasio_id, sede_id, socio_id, momento, via_acceso, resultado, via_habilitante, color, motivo, texto)
               values ($1,$2,$3, $4::timestamptz - interval '3 days', 'recepcion', 'entro', 'pack', 'verde', 'pack', 'Pack')`, [t.g, t.sede, t.ctx.socios.pack_con_clases, momento]);
    assert.equal(chip(await guia("pack_con_clases"), "en_prueba"), undefined, "ya vino antes");
  });
});
