// EQU-1 (0100, D4): los interruptores del dueño. Por defecto todo como antes;
// apagados o prendidos cambian lo que la base deja hacer: la recepción vende
// productos, ve lo cobrado del día, el profe ve el teléfono en su lista y el
// encargado ve el Resultado. Solo el dueño los cambia.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir } from "./_comun.mjs";

let t, u = {}, profeId, agua, clase;
async function como(usuario, fn) {
  await t.db.query("set role authenticated");
  await t.q(`select set_config('request.jwt.claims', $1, false)`, [JSON.stringify({ sub: usuario, role: "authenticated" })]);
  try { return await fn(); } finally { await t.db.query("reset role"); await t.q(`select set_config('request.jwt.claims', '', false)`); }
}
before(async () => {
  t = await abrir("prueba-permisos-equipo");
  for (const rol of ["dueno", "encargado", "recepcion", "profe"]) {
    const [{ id }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`${rol}${Math.random()}@ejemplo.invalid`]);
    const [{ id: eid }] = await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,$3,$4) returning id`, [t.g, id, rol, rol]);
    u[rol] = id; if (rol === "profe") profeId = eid;
  }
  [{ id: agua }] = await t.q(`insert into public.productos (gimnasio_id, nombre, precio) values ($1,'Agua',1000) returning id`, [t.g]);
  const [{ id: act }] = await t.q(`insert into public.actividades (gimnasio_id, nombre) values ($1,'Funcional') returning id`, [t.g]);
  [{ id: clase }] = await t.q(`insert into public.clases (gimnasio_id, sede_id, actividad_id, inicio, fin, profe_id) values ($1,$2,$3, now() + interval '1 hour', now() + interval '2 hours', $4) returning id`, [t.g, t.sede, act, profeId]);
  const [{ id: s }] = await t.q(`insert into public.socios (gimnasio_id, nombre, apellido, telefono) values ($1,'Con','Teléfono','+5490000123456') returning id`, [t.g]);
  await t.q(`insert into public.reservas (gimnasio_id, clase_id, socio_id, estado) values ($1,$2,$3,'confirmada')`, [t.g, clase, s]);
});
after(async () => t && t.cerrar());
const guardar = (datos) => t.q(`select public.guardar_permisos_equipo($1, $2)`, [t.g, JSON.stringify(datos)]);
const vender = () => t.q(`select public.vender($1, $2, $3, null, null)`, [t.sede, JSON.stringify([{ tipo: "producto", producto_id: agua }]), JSON.stringify([{ medio: "transferencia", monto: 1000 }])]);
const numeros = async () => (await t.q(`select public.panel_inicio($1) i`, [t.g]))[0].i.numeros.map((n) => n.clave);

test("por defecto: como antes; solo el dueño los cambia", async () => {
  const [{ p }] = await como(u.dueno, () => t.q(`select public.permisos_equipo($1) p`, [t.g]));
  assert.deepEqual([p.recepcion_ve_cobrado, p.recepcion_vende_productos, p.profe_ve_telefono, p.encargado_ve_resultado], [false, true, false, true]);
  await como(u.encargado, () => t.falla(() => guardar({ profe_ve_telefono: true }), /permiso|rol/i));
  await como(u.dueno, () => t.falla(() => guardar({ todo: true }), /desconocido/));
  await como(u.dueno, () => t.falla(() => guardar({ profe_ve_telefono: "si" }), /prendido o apagado/));
});

test("la recepción vende productos (o no) y ve lo cobrado (o no)", async () => {
  await como(u.recepcion, async () => { await vender(); assert.ok(!(await numeros()).includes("cobrado")); });
  await como(u.dueno, () => guardar({ recepcion_vende_productos: false, recepcion_ve_cobrado: true }));
  await como(u.recepcion, async () => {
    await t.falla(() => vender(), /la recepción no vende productos/);
    assert.ok((await numeros()).includes("cobrado"));
  });
  await como(u.encargado, () => vender());   // al encargado no lo toca
});

test("el profe ve el teléfono solo si se prende; el encargado pierde el Resultado si se apaga", async () => {
  const tel = () => como(u.profe, async () => (await t.q(`select telefono from public.lista_clase($1)`, [clase]))[0].telefono);
  assert.equal(await tel(), null);
  await como(u.dueno, () => guardar({ profe_ve_telefono: true, encargado_ve_resultado: false }));
  assert.equal(await tel(), "+5490000123456");
  await como(u.encargado, async () => {
    await t.falla(() => t.q(`select public.resultado_mes($1)`, [t.g]), /no le dio acceso al Resultado/);
    await t.falla(() => t.q(`select public.exportar_mes($1, date_trunc('month', now())::date, 'pagos')`, [t.g]), /no le dio acceso al Resultado/);
    const [{ p }] = await t.q(`select public.panel_gimnasio($1) p`, [t.g]);
    assert.ok(p.secciones_apagadas.includes("resultado"), "el menú del encargado no lo muestra");
  });
  await como(u.dueno, async () => {
    await t.q(`select public.resultado_mes($1)`, [t.g]);
    const [{ p }] = await t.q(`select public.panel_gimnasio($1) p`, [t.g]);
    assert.ok(!p.secciones_apagadas.includes("resultado"));
  });
});
