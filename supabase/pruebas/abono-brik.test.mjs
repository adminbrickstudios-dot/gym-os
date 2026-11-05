// ADM-3 (0110) y ADM-2 (0111): el abono de BRIK. Sin plan, nada cambia. Con
// plan: 14 días antes del primer pago, aviso 7 días antes, vencido = el panel
// en solo lectura (no vende ni edita), pero la puerta y el socio siguen; el
// admin puede igual. Los montos los ve el dueño, no la recepción.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir } from "./_comun.mjs";

let t, admin, uDueno, uRec, plan, agua;
async function como(usuario, fn) {
  await t.db.query("set role authenticated");
  await t.q(`select set_config('request.jwt.claims', $1, false)`, [JSON.stringify({ sub: usuario, role: "authenticated" })]);
  try { return await fn(); } finally { await t.db.query("reset role"); await t.q(`select set_config('request.jwt.claims', '', false)`); }
}
before(async () => {
  t = await abrir("prueba-abono-brik");
  [{ id: admin }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`a${Math.random()}@ejemplo.invalid`]);
  await t.q(`insert into public.administradores_plataforma (usuario_id) values ($1)`, [admin]);
  for (const [rol, v] of [["dueno", "uDueno"], ["recepcion", "uRec"]]) {
    const [{ id }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`${rol}${Math.random()}@ejemplo.invalid`]);
    await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,$3,$4)`, [t.g, id, rol, rol]);
    if (v === "uDueno") uDueno = id; else uRec = id;
  }
  [{ id: agua }] = await t.q(`insert into public.productos (gimnasio_id, nombre, precio) values ($1,'Agua',1000) returning id`, [t.g]);
});
after(async () => t && t.cerrar());
const estado = (u) => como(u, async () => (await t.q(`select public.estado_abono_panel($1) e`, [t.g]))[0].e);
const vender = () => t.q(`select public.vender($1, $2, $3, null, null)`, [t.sede, JSON.stringify([{ tipo: "producto", producto_id: agua }]), JSON.stringify([{ medio: "transferencia", monto: 1000 }])]);

test("planes de BRIK y asignar: sin plan nada cambia; con plan, 14 días de gracia", async () => {
  assert.equal((await estado(uDueno)).estado, "sin_abono");
  await como(uDueno, () => t.falla(() => t.q(`select public.admin_guardar_plan_brik(null, 'Básico', 30000)`), /administradores/));
  await como(admin, async () => {
    [{ id: plan }] = await t.q(`select public.admin_guardar_plan_brik(null, 'Básico', 30000) id`);
    await t.falla(() => t.q(`select public.admin_registrar_pago_brik($1, 30000, current_date + 30)`, [t.g]), /Primero asignale un plan/);
    await t.q(`select public.admin_asignar_plan_brik($1, $2)`, [t.g, plan]);
  });
  const e = await estado(uDueno);
  assert.equal(e.estado, "al_dia"); assert.equal(e.dias, 14); assert.equal(Number(e.precio_mensual), 30000);
  assert.deepEqual(await estado(uRec), { estado: "al_dia" }, "la recepción no ve montos");
});

test("vencido: el panel no vende ni edita; el admin sí; pagar lo destraba; por vencer avisa", async () => {
  await t.q(`update public.gimnasios set plataforma_desde = current_date - 30 where id = $1`, [t.g]);
  assert.equal((await estado(uDueno)).estado, "vencido");
  await como(uRec, () => t.falla(() => vender(), /solo lectura/));
  await como(uDueno, () => t.falla(() => t.q(`select public.guardar_producto($1, null, 'Barrita', 800, true)`, [t.g]), /solo lectura/));
  // La puerta sigue: la recepción anota una entrada.
  const [{ id: socio }] = await t.q(`select id from public.socios where gimnasio_id = $1 and nombre = 'Testigo' and apellido = 'Al Día'`, [t.g]);
  await t.q(`insert into public.ingresos (gimnasio_id, sede_id, socio_id, momento, via_acceso, resultado, via_habilitante, color, motivo, texto, registrado_por)
    values ($1,$2,$3, now(), 'recepcion', 'entro', 'membresia', 'verde', 'al_dia', 'x', (select id from public.equipo where usuario_id = $4))`, [t.g, t.sede, socio, uRec]);
  await como(admin, async () => {
    await t.q(`select public.admin_registrar_pago_brik($1, 30000, current_date + 3, 'Transferencia')`, [t.g]);
  });
  assert.equal((await estado(uDueno)).estado, "por_vencer");
  await como(uRec, () => vender());
  const [{ a }] = await como(admin, () => t.q(`select public.admin_abonos() a`));
  assert.equal(a[t.g].pagos.length, 1);
});
