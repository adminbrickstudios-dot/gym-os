// Campana (0073): cada rol ve lo suyo, calculado de los hechos; "visto" es
// por usuario y no vuelve a contar como nuevo; el socio ve sus comprobantes y
// clases; nadie ve la campana de otro.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir } from "./_comun.mjs";

let t, u = {}, socio, pagoPend;
async function persona(rol, nombre) {
  const [{ id }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`${rol}${Math.random()}@ejemplo.invalid`]);
  await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,$3,$4)`, [t.g, id, nombre, rol]);
  return id;
}
before(async () => {
  t = await abrir("prueba-campana");
  u.dueno = await persona("dueno", "Sofía");
  u.recepcion = await persona("recepcion", "Ana");
  u.profe = await persona("profe", "Diego");
  const [{ id }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`socio${Math.random()}@ejemplo.invalid`]);
  u.socio = id;
  [{ id: socio }] = await t.q(`insert into public.socios (gimnasio_id, nombre, apellido, usuario_id) values ($1,'Lucía','Campana',$2) returning id`, [t.g, id]);
  // Un comprobante para revisar y uno rechazado.
  const venta = async () => (await t.q(`insert into public.ventas (gimnasio_id, sede_id, socio_id, origen) values ($1,$2,$3,'app') returning id`, [t.g, t.sede, socio]))[0].id;
  [{ id: pagoPend }] = await t.q(`insert into public.pagos (gimnasio_id, venta_id, medio, monto, estado, comprobante_path) values ($1,$2,'transferencia',15000,'pendiente','x/1.jpg') returning id`, [t.g, await venta()]);
  await t.q(`insert into public.pagos (gimnasio_id, venta_id, medio, monto, estado, comprobante_path, rechazado_en, rechazado_motivo)
             values ($1,$2,'transferencia',15000,'rechazado','x/2.jpg', now(), 'No se ve el monto')`, [t.g, await venta()]);
});
after(async () => t && t.cerrar());
async function como(usuario, fn) {
  await t.db.query("set role authenticated");
  await t.q(`select set_config('request.jwt.claims', $1, false)`, [JSON.stringify({ sub: usuario, role: "authenticated" })]);
  try { return await fn(); } finally { await t.db.query("reset role"); await t.q(`select set_config('request.jwt.claims', '', false)`); }
}
const campana = (usuario) => como(usuario, async () => (await t.q(`select public.campana($1) as c`, [t.g]))[0].c);
const delSocio = (usuario) => como(usuario, async () => (await t.q(`select public.campana_socio($1, $2) as c`, [t.g, socio]))[0].c);

test("la recepción ve el comprobante para revisar; leerlo lo saca de los nuevos (solo para ella)", async () => {
  const c = await campana(u.recepcion);
  const aviso = c.items.find((i) => i.clave === `pago:${pagoPend}`);
  assert.ok(aviso, "el comprobante está");
  assert.match(aviso.titulo, /Lucía Campana mandó un comprobante/);
  assert.match(aviso.detalle, /^\$15\.000/);
  assert.equal(aviso.href, "/transferencias");
  assert.equal(aviso.leido, false);
  const antes = c.sin_leer;
  await como(u.recepcion, () => t.q(`select public.leer_campana($1, $2)`, [t.g, [aviso.clave]]));
  const [{ n }] = await como(u.recepcion, () => t.q(`select public.leer_campana($1, $2) as n`, [t.g, [aviso.clave]]));
  assert.equal(n, 0, "leer dos veces no suma");
  const c2 = await campana(u.recepcion);
  assert.equal(c2.sin_leer, antes - 1);
  assert.equal(c2.items.find((i) => i.clave === aviso.clave).leido, true);
  // La dueña lo sigue teniendo como nuevo.
  assert.equal((await campana(u.dueno)).items.find((i) => i.clave === aviso.clave).leido, false);
});

test("cada rol lo suyo: la dueña ve los retiros de otros; el profe no ve plata", async () => {
  const [{ id: caja }] = await t.q(`select id from public.cajas where sede_id = $1 limit 1`, [t.sede]);
  const [{ id: rec }] = await t.q(`select id from public.equipo where usuario_id = $1`, [u.recepcion]);
  const [{ id: turno }] = await t.q(`insert into public.turnos_caja (gimnasio_id, caja_id, abierto_por, monto_inicial) values ($1,$2,$3,0) returning id`, [t.g, caja, rec]);
  await t.q(`insert into public.movimientos_caja (gimnasio_id, turno_caja_id, tipo, monto, motivo, creado_por) values ($1,$2,'retiro',2000,'Artículos de limpieza',$3)`, [t.g, turno, rec]);
  const d = await campana(u.dueno);
  const retiro = d.items.find((i) => i.clave.startsWith("caja:retiro:"));
  assert.ok(retiro); assert.match(retiro.titulo, /Salieron \$2\.000 de la caja/); assert.match(retiro.detalle, /Ana · Artículos de limpieza/);
  const p = await campana(u.profe);
  assert.ok(!p.items.some((i) => /^(pago|caja)/.test(i.clave)), "el profe no ve plata");
  assert.ok(!(await campana(u.recepcion)).items.some((i) => i.clave.startsWith("caja:retiro:")), "la recepción no ve las alertas de caja");
});

test("el socio ve sus comprobantes; nadie más lee su campana", async () => {
  const c = await delSocio(u.socio);
  const rech = c.items.find((i) => i.clave.endsWith(":rechazado"));
  assert.ok(rech); assert.equal(rech.titulo, "No pudimos aprobar tu comprobante"); assert.equal(rech.detalle, "No se ve el monto");
  await como(u.recepcion, () => t.falla(() => t.q(`select public.campana_socio($1, $2)`, [t.g, socio]), /Sin permiso/));
  await como(u.socio, () => t.falla(() => t.q(`select public.campana($1)`, [t.g]), /permiso/i));
  const [{ id: otro }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`nadie${Math.random()}@ejemplo.invalid`]);
  await como(otro, () => t.falla(() => t.q(`select public.leer_campana($1, $2)`, [t.g, ["x"]]), /Sin permiso/));
});
