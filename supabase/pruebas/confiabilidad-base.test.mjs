// VD-34 (3400): nada pasa dos veces y nada se pisa en silencio.
// La misma clave de operación = una sola venta; claves distintas = dos ventas;
// la versión de un registro avisa quién lo cambió; la recepción no ve la de planes.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir } from "./_comun.mjs";

let t, uDueno, uRec, uOtro, agua;
async function como(usuario, fn) {
  await t.db.query("set role authenticated");
  await t.q(`select set_config('request.jwt.claims', $1, false)`, [JSON.stringify({ sub: usuario, role: "authenticated" })]);
  try { return await fn(); } finally { await t.db.query("reset role"); await t.q(`select set_config('request.jwt.claims', '', false)`); }
}
before(async () => {
  t = await abrir("prueba-confiabilidad");
  for (const [rol, nombre] of [["dueno", "Dueña"], ["recepcion", "Sofi"], ["encargado", "Beto"]]) {
    const [{ id }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`${rol}${Math.random()}@ejemplo.invalid`]);
    await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,$3,$4)`, [t.g, id, nombre, rol]);
    if (rol === "dueno") uDueno = id; else if (rol === "recepcion") uRec = id; else uOtro = id;
  }
  [{ id: agua }] = await t.q(`insert into public.productos (gimnasio_id, nombre, precio) values ($1,'Agua',1000) returning id`, [t.g]);
});
after(async () => t && t.cerrar());

const vender = (clave) => t.q(`select public.vender($1, $2, $3, null, null, $4) as r`,
  [t.sede, JSON.stringify([{ tipo: "producto", producto_id: agua }]), JSON.stringify([{ medio: "transferencia", monto: 1000 }]), clave]);
const ventas = async () => Number((await t.q(`select count(*) n from public.ventas where gimnasio_id = $1`, [t.g]))[0].n);

test("la misma clave de operación es una sola venta; la repetida devuelve la ya hecha", async () => {
  const clave = "11111111-1111-4111-8111-111111111111";
  const antes = await ventas();
  const [{ r: a }] = await como(uDueno, () => vender(clave));
  const [{ r: b }] = await como(uDueno, () => vender(clave));
  assert.equal(await ventas(), antes + 1);
  assert.equal(b.venta_id, a.venta_id);
  assert.equal(Number(b.total), 1000);
  assert.equal(b.repetida, true);
  assert.ok(!a.repetida);
});

test("claves distintas o sin clave son ventas distintas", async () => {
  const antes = await ventas();
  await como(uDueno, () => vender("22222222-2222-4222-8222-222222222222"));
  await como(uDueno, () => vender("33333333-3333-4333-8333-333333333333"));
  await como(uDueno, () => vender(null));
  assert.equal(await ventas(), antes + 3);
});

test("dos envíos simultáneos con la misma clave dejan una sola venta", async () => {
  const clave = "44444444-4444-4444-8444-444444444444";
  const antes = await ventas();
  // Una sola conexión de prueba: se lanzan juntos y la base los turna.
  const res = await Promise.allSettled([como(uDueno, () => vender(clave)), como(uDueno, () => vender(clave))]);
  assert.ok(res.some((x) => x.status === "fulfilled"));
  assert.equal(await ventas(), antes + 1);
});

test("la versión de la ficha avisa quién la cambió y la recepción no ve la de planes", async () => {
  const socio = t.ctx.socios.vencida;
  const v0 = await como(uRec, async () => (await t.q(`select public.version_registro($1, 'socios', $2) as v`, [t.g, socio]))[0].v);
  const sin = await como(uRec, async () => (await t.q(`select public.verificar_version($1, 'socios', $2, $3) as v`, [t.g, socio, v0.version]))[0].v);
  assert.equal(sin.cambio, false);
  // Otra persona edita la ficha después de que se abrió el formulario.
  await como(uOtro, () => t.q(`update public.socios set notas = 'cambio de Beto' where id = $1`, [socio]));
  const con = await como(uRec, async () => (await t.q(`select public.verificar_version($1, 'socios', $2, $3) as v`, [t.g, socio, v0.version]))[0].v);
  assert.equal(con.cambio, true);
  assert.equal(con.por, "Beto");
  assert.ok(con.hace_segundos >= 0);
  await como(uRec, () => t.falla(() => t.q(`select public.version_registro($1, 'configuracion', $1)`, [t.g]), /Sin permiso/));
  await como(uDueno, async () => { const [{ v }] = await t.q(`select public.version_registro($1, 'configuracion', $1) as v`, [t.g]); assert.ok(v.version); });
  await como(uDueno, () => t.falla(() => t.q(`select public.version_registro($1, 'otra', $1)`, [t.g]), /Tabla desconocida/));
});
