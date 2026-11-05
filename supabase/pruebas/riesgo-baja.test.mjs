// COM-1 (0121): riesgo de baja de los que todavía pagan, con el porqué.
// Venía y dejó de venir; reservaba y dejó; pidió pausa o baja; vence sin
// renovar (solo si ya hay otra señal). Alto con dos señales o pedido de baja.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir } from "./_comun.mjs";

let t, u = {}, plan;
before(async () => {
  t = await abrir("prueba-riesgo-baja");
  for (const rol of ["dueno", "recepcion"]) {
    const [{ id }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`${rol}${Math.random()}@ejemplo.invalid`]);
    await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,$3,$4)`, [t.g, id, rol, rol]);
    u[rol] = id;
  }
  [{ id: plan }] = await t.q(`insert into public.planes (gimnasio_id, tipo, nombre, duracion_meses, renovacion) values ($1,'membresia','Riesgo',1,'continua') returning id`, [t.g]);
});
after(async () => t && t.cerrar());

async function socio(nombre, { cubre = [-20, 10], vino = [] } = {}) {
  const [{ id: s }] = await t.q(`insert into public.socios (gimnasio_id, nombre, apellido) values ($1,$2,'Riesgo') returning id`, [t.g, nombre]);
  const [{ id: su }] = await t.q(`insert into public.suscripciones (gimnasio_id, socio_id, plan_id, inicio) values ($1,$2,$3, now() - interval '120 days') returning id`, [t.g, s, plan]);
  if (cubre) await t.q(`insert into public.coberturas (gimnasio_id, suscripcion_id, socio_id, desde, hasta, origen, motivo)
                        values ($1,$2,$3, now() + make_interval(days => $4), now() + make_interval(days => $5), 'cortesia', 'riesgo')`, [t.g, su, s, cubre[0], cubre[1]]);
  for (const d of vino) await t.q(`insert into public.ingresos (gimnasio_id, sede_id, socio_id, momento, via_acceso, resultado, color, motivo, texto)
                                   values ($1,$2,$3, now() - make_interval(days => $4), 'recepcion', 'entro', 'verde', 'al_dia', 'Al día')`, [t.g, t.sede, s, d]);
  return s;
}
const dias = (desde, hasta, cada) => Array.from({ length: Math.floor((hasta - desde) / cada) + 1 }, (_, i) => desde + i * cada);

test("dejó de venir y vence: alto; viene igual: nada; pidió la baja: alto; vencido: no (ya está en su lista)", async () => {
  const dejo = await socio("Dejó", { cubre: [-25, 5], vino: dias(16, 68, 2) });          // ~3,5 por semana, nada en 2 semanas, vence en 5 días
  const igual = await socio("Igual", { vino: dias(1, 68, 2) });
  const baja = await socio("Baja", { vino: dias(1, 68, 3) });
  await t.q(`insert into public.pedidos_baja (gimnasio_id, socio_id, motivo, pedido_por) values ($1,$2,'precio',$3)`, [t.g, baja, u.dueno]);
  const vencido = await socio("Vencido", { cubre: [-40, -10], vino: dias(16, 68, 2) });
  await t.comoUsuario(u.recepcion, async () => {
    const [{ r }] = await t.q(`select public.riesgo_baja($1) r`, [t.g]);
    const de = (id) => r.find((x) => x.socio_id === id);
    assert.equal(de(dejo)?.nivel, "alto");
    assert.match(de(dejo).porque[0], /^Venía \d veces por semana y hace \d+ días que no viene$/);
    assert.match(de(dejo).porque[1], /^Vence el \d\d\/\d\d y no renovó$/);
    assert.match(de(dejo).mensaje, /Hola Dejó!/);
    assert.equal(de(igual), undefined, "el que viene igual no está");
    assert.equal(de(baja)?.nivel, "alto");
    assert.match(de(baja).porque.join(" "), /Pidió la baja/);
    assert.equal(de(vencido), undefined, "el vencido está en Vencidos, no acá");
    const [{ r: uno }] = await t.q(`select public.riesgo_baja($1, $2) r`, [t.g, dejo]);
    assert.equal(uno.length, 1, "para la ficha: un solo socio");
  });
  const [{ id: x }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`x${Math.random()}@ejemplo.invalid`]);
  await t.comoUsuario(x, () => t.falla(() => t.q(`select public.riesgo_baja($1)`, [t.g]), /permiso|rol|acceso/i));
});
