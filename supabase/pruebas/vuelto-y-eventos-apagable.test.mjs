// Z-resto · (1) Vuelto en efectivo: interruptor por gimnasio, apagado por defecto, solo el dueño lo cambia y solo en su gimnasio.
// Prendido o apagado NO cambia ningún monto: el total cobrado y la caja dan lo mismo, con números fijos.
// (2) Eventos apagable: con la sección apagada, la página, la app, el panel y la Entrada no ven nada de eventos; al prender vuelven.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir } from "./_comun.mjs";

let t, otro, uDueno, uRecep, uDuenoOtro, cajaId, agua, host, uSocio, ev;
async function como(u, fn) {
  await t.db.query("set role authenticated");
  await t.q(`select set_config('request.jwt.claims', $1, false)`, [JSON.stringify({ sub: u, role: "authenticated" })]);
  try { return await fn(); } finally { await t.db.query("reset role"); await t.q(`select set_config('request.jwt.claims', '', false)`); }
}
const crear = async (tt, rol) => {
  const [{ id }] = await tt.q(`insert into auth.users (email) values ($1) returning id`, [`${rol}${Math.random()}@ejemplo.invalid`]);
  await tt.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,$3,$4)`, [tt.g, id, rol, rol]);
  return id;
};
before(async () => {
  t = await abrir("prueba-vuelto-eventos");
  otro = await abrir("prueba-vuelto-eventos-otro");
  uDueno = await crear(t, "dueno");
  uRecep = await crear(t, "recepcion");
  uDuenoOtro = await crear(otro, "dueno");
  [{ id: cajaId }] = await t.q(`insert into public.cajas (gimnasio_id, sede_id, nombre) values ($1,$2,'Recepción') returning id`, [t.g, t.sede]);
  [{ id: agua }] = await t.q(`insert into public.productos (gimnasio_id, nombre, precio) values ($1,'Agua 500 ml',1500) returning id`, [t.g]);
  host = `vuelto-${Date.now()}.localhost`;
  await t.q(`insert into public.dominios_gimnasio (gimnasio_id, host, tipo) values ($1, $2, 'subdominio')`, [t.g, host]);
  if (!(await t.q(`update public.landing_gimnasio set publicada = true where gimnasio_id = $1 returning 1`, [t.g])).length)
    await t.q(`insert into public.landing_gimnasio (gimnasio_id, publicada) values ($1, true)`, [t.g]);
  [{ id: uSocio }] = await t.q(`insert into auth.users (phone) values ('+5490000888222') returning id`);
  await t.q(`update public.socios set usuario_id = $2 where id = $1`, [t.ctx.socios.al_dia, uSocio]);
});
after(async () => { if (t) await t.cerrar(); if (otro) await otro.cerrar(); });

test("el vuelto arranca apagado; solo el dueño lo prende y solo en su gimnasio", async () => {
  const [{ v }] = await t.q(`select mostrar_vuelto_efectivo v from public.configuracion_gimnasio where gimnasio_id = $1`, [t.g]);
  assert.equal(v, false, "apagado por defecto");
  await como(uRecep, async () => {
    assert.equal((await t.q(`select public.vuelto_efectivo_activo($1) r`, [t.g]))[0].r, false, "la recepción lo lee");
    await t.falla(() => t.q(`select public.guardar_vuelto_efectivo($1, true)`, [t.g]), /permiso|rol|acceso/i);
  });
  await como(uDuenoOtro, () => t.falla(() => t.q(`select public.guardar_vuelto_efectivo($1, true)`, [t.g]), /permiso|rol|acceso/i));
  await como(uDuenoOtro, () => t.falla(() => t.q(`select public.vuelto_efectivo_activo($1)`, [t.g]), /permiso|rol|acceso/i));
  assert.equal((await t.q(`select mostrar_vuelto_efectivo v from public.configuracion_gimnasio where gimnasio_id = $1`, [t.g]))[0].v, false, "nadie de afuera lo cambió");
  await como(uDueno, async () => {
    assert.equal((await t.q(`select public.guardar_vuelto_efectivo($1, true) r`, [t.g]))[0].r, true);
    await t.falla(() => t.q(`select public.guardar_vuelto_efectivo($1, null)`, [t.g]), /inválidos/i);
  });
  assert.equal((await t.q(`select mostrar_vuelto_efectivo v from public.configuracion_gimnasio where gimnasio_id = $1`, [t.g]))[0].v, true);
  assert.equal((await t.q(`select count(*)::int n from public.configuracion_gimnasio where gimnasio_id = $1 and mostrar_vuelto_efectivo`, [otro.g]))[0].n, 0, "el otro gimnasio sigue apagado");
  await como(uDueno, () => t.q(`select public.guardar_vuelto_efectivo($1, false)`, [t.g]));
});

test("con el vuelto apagado o prendido el total cobrado y la caja son los mismos (números fijos)", async () => {
  const turno = await como(uDueno, async () => (await t.q(`select public.abrir_caja($1, 10000) as id`, [cajaId]))[0].id);
  const items = JSON.stringify([{ tipo: "producto", producto_id: agua, cantidad: 2 }]);
  const pagos = JSON.stringify([{ medio: "efectivo", monto: 3000 }]);
  const vender = () => como(uDueno, async () => (await t.q(`select public.vender($1, $2::jsonb, $3::jsonb, null, $4) as r`, [t.sede, items, pagos, turno]))[0].r);
  await como(uDueno, () => t.q(`select public.guardar_vuelto_efectivo($1, false)`, [t.g]));
  const a = await vender();
  const caja1 = (await t.q(`select privado.resumen_turno($1) as r`, [turno]))[0].r;
  await como(uDueno, () => t.q(`select public.guardar_vuelto_efectivo($1, true)`, [t.g]));
  const b = await vender();
  const caja2 = (await t.q(`select privado.resumen_turno($1) as r`, [turno]))[0].r;
  assert.equal(Number(a.total), 3000);
  assert.equal(Number(b.total), 3000, "prendido, el total cobrado es el mismo");
  assert.equal(Number(caja1.esperado), 13000, "fondo 10.000 + 3.000 de efectivo");
  assert.equal(Number(caja2.esperado), 16000, "la segunda venta suma 3.000 y nada más (el vuelto no entra a la caja)");
  await como(uDueno, () => t.q(`select public.guardar_vuelto_efectivo($1, false)`, [t.g]));
});

test("Eventos apagado: la página, la app, el panel y la Entrada no ven nada; al prender vuelven", async () => {
  ev = await como(uDueno, async () => (await t.q(`select public.crear_evento($1, 'Seminario de prueba', now() + interval '3 days', 5, 0, 'Uno solo', 'todos') id`, [t.g]))[0].id);
  const ver = async () => ({
    pub: (await t.q(`select public.eventos_publicos($1) r`, [host]))[0].r,
    app: await como(uSocio, async () => (await t.q(`select public.eventos_socio($1) r`, [t.ctx.socios.al_dia]))[0].r),
    panel: await como(uDueno, async () => (await t.q(`select public.eventos_panel($1) r`, [t.g]))[0].r),
    hoy: await como(uDueno, async () => (await t.q(`select public.eventos_del_dia_socio($1) r`, [t.ctx.socios.al_dia]))[0].r),
  });
  let r = await ver();
  assert.ok(r.pub.some((x) => x.evento_id === ev) && r.app.some((x) => x.evento_id === ev) && r.panel.some((x) => x.evento_id === ev), "prendido, se ve en los tres");
  await t.q(`update public.configuracion_gimnasio set secciones_apagadas = array['eventos'] where gimnasio_id = $1`, [t.g]);
  r = await ver();
  assert.deepEqual([r.pub, r.app, r.panel, r.hoy], [[], [], [], []], "apagado, no se ve ninguno");
  assert.equal((await t.q(`select count(*)::int n from public.eventos where id = $1`, [ev]))[0].n, 1, "no se borró nada");
  await t.q(`update public.configuracion_gimnasio set secciones_apagadas = '{}' where gimnasio_id = $1`, [t.g]);
  r = await ver();
  assert.ok(r.pub.some((x) => x.evento_id === ev) && r.panel.some((x) => x.evento_id === ev), "al prender de nuevo vuelven");
  await t.falla(() => t.q(`update public.configuracion_gimnasio set secciones_apagadas = array['inventada'] where gimnasio_id = $1`, [t.g]), /configuracion_secciones_validas|check/i);
});
