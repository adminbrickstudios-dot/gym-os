// Convenios (0066, D14): el dueño los crea y los asigna; Vender los aplica
// solos a la cuota (aunque el navegador no los mande), fuera del tope de la
// recepción; vencen; la recepción no los asigna.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir } from "./_comun.mjs";

let t, uDueno, uRec, conv, socio;
before(async () => {
  t = await abrir("prueba-convenios");
  const crear = async (rol) => {
    const [{ id: u }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`${rol}${Math.random()}@ejemplo.invalid`]);
    await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,$3,$4)`, [t.g, u, rol, rol]);
    return u;
  };
  uDueno = await crear("dueno"); uRec = await crear("recepcion");
  socio = t.ctx.socios.vencida;
});
after(async () => t && t.cerrar());
async function como(u, fn) {
  await t.db.query("set role authenticated");
  await t.q(`select set_config('request.jwt.claims', $1, false)`, [JSON.stringify({ sub: u, role: "authenticated" })]);
  try { return await fn(); } finally { await t.db.query("reset role"); await t.q(`select set_config('request.jwt.claims', '', false)`); }
}
const precios = async () => (await t.q(`select public.precios_venta($1, $2) as p`, [t.sede, socio]))[0].p;

test("crear y asignar: solo dueño y encargado, con reglas claras", async () => {
  await como(uDueno, async () => {
    await t.falla(() => t.q(`select public.guardar_convenio($1, null, 'Estudiantes', 'porcentaje', 150)`, [t.g]), /hasta 100/);
    [{ id: conv }] = await t.q(`select public.guardar_convenio($1, null, 'Estudiantes', 'porcentaje', 20) as id`, [t.g]);
    await t.falla(() => t.q(`select public.guardar_convenio($1, null, 'estudiantes', 'monto', 10)`, [t.g]), /Ya hay un convenio/);
    await t.q(`select public.asignar_convenio($1, $2, null)`, [socio, conv]);
  });
  await como(uRec, async () => {
    await t.falla(() => t.q(`select public.asignar_convenio($1, $2, null)`, [socio, conv]), /Sin permiso/);
    assert.equal((await t.q(`select public.convenio_socio($1) as c`, [socio]))[0].c.nombre, "Estudiantes");
  });
});

test("Vender lo aplica solo a la cuota, fuera del tope de la recepción", async () => {
  const r = await como(uRec, async () => {
    const p = await precios();
    assert.equal(p.convenio.nombre, "Estudiantes");
    const lista = Number(p.cuota.precios.transferencia);
    const esperado = lista - Math.round(lista * 0.2 * 100) / 100;
    const [{ r }] = await t.q(`select public.vender($1, $2, $3, $4, null) as r`, [t.sede, JSON.stringify([{ tipo: "cuota" }]),
      JSON.stringify([{ medio: "transferencia", monto: esperado }]), socio]);
    assert.equal(Number(r.total), esperado);
    return r;
  });
  const [{ m }] = await t.q(`select descuento_motivo as m from public.venta_items where venta_id = $1`, [r.venta_id]);
  assert.equal(m, "Convenio Estudiantes");
});

test("vencido o quitado, ya no aplica", async () => {
  await como(uDueno, async () => {
    await t.q(`select public.quitar_convenio($1)`, [socio]);
    await t.falla(() => t.q(`select public.quitar_convenio($1)`, [socio]), /No tenía convenio/);
  });
  await como(uRec, async () => assert.equal((await precios()).convenio, null));
  await t.q(`insert into public.socio_convenios (gimnasio_id, socio_id, convenio_id, desde, hasta, creado_por)
             select $1, $2, $3, now() - interval '40 days', now() - interval '1 day', e.id from public.equipo e where e.usuario_id = $4`, [t.g, socio, conv, uDueno]);
  await como(uRec, async () => assert.equal((await precios()).convenio, null));
});
