// SEG-1 (0112): hasta 5 códigos por destino y 20 por IP en una hora; el
// destino se guarda como hash; solo el servidor lo llama.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir } from "./_comun.mjs";

let t;
before(async () => { t = await abrir("prueba-limite-codigos"); });
after(async () => t && t.cerrar());
const servidor = async (fn) => {
  await t.db.query("savepoint s1");
  await t.db.query("set local role service_role");
  await t.q(`select set_config('request.jwt.claims', '{"role":"service_role"}', true)`);
  try { return await fn(); } finally { await t.db.query("reset role"); await t.db.query("release savepoint s1"); }
};

test("5 por destino, 20 por IP; guarda el hash; no lo llama un usuario", async () => {
  const tel = `+5490000${Date.now() % 1000000}`;
  await servidor(async () => {
    for (let i = 0; i < 5; i++) await t.q(`select public.registrar_pedido_codigo($1, '10.0.0.1')`, [tel]);
    await t.falla(() => t.q(`select public.registrar_pedido_codigo($1, '10.0.0.1')`, [tel]), /muchos códigos/);
    for (let i = 0; i < 15; i++) await t.q(`select public.registrar_pedido_codigo($1, '10.0.0.1')`, [`otro${i}@ejemplo.invalid`]);
    await t.falla(() => t.q(`select public.registrar_pedido_codigo('nuevo@ejemplo.invalid', '10.0.0.1')`), /esta conexión/);
    await t.q(`select public.registrar_pedido_codigo('nuevo@ejemplo.invalid', '10.0.0.2')`);
  });
  const [{ n }] = await t.q(`select count(*)::int n from public.pedidos_codigo where destino_hash = $1 or destino_hash like '%+549%'`, [tel]);
  assert.equal(n, 0, "no se guarda el celular, solo el hash");
  const [{ id: u }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`u${Math.random()}@ejemplo.invalid`]);
  await t.comoUsuario(u, () => t.falla(() => t.q(`select public.registrar_pedido_codigo('x@ejemplo.invalid', null)`), /permission denied|servidor/));
});

test("0118: el celular del ingreso se normaliza como la ficha (el importado con 000 entra); no lo llama un usuario", async () => {
  const [{ id: s }] = await t.q(`insert into public.socios (gimnasio_id, nombre, apellido, telefono) values ($1, 'Imp', 'Tel', privado.telefono_normalizado('000 8330311', 'x')) returning id`, [t.g]);
  const [{ telefono }] = await t.q(`select telefono from public.socios where id = $1`, [s]);
  await servidor(async () => {
    for (const escrito of ["000 8330311", "0008330311", "000-833-0311"]) {
      const [{ r }] = await t.q(`select public.telefono_para_ingresar($1) r`, [escrito]);
      assert.equal(r, telefono, `"${escrito}" tiene que dar el de la ficha`);
    }
    const [{ r }] = await t.q(`select public.telefono_para_ingresar('0387 15 555-1234') r`);
    assert.equal(r, "+5493875551234");
    await t.falla(() => t.q(`select public.telefono_para_ingresar('12')`), /característica/);
  });
  const [{ id: u }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`u${Math.random()}@ejemplo.invalid`]);
  await t.comoUsuario(u, () => t.falla(() => t.q(`select public.telefono_para_ingresar('3875551234')`), /permission denied/));
});
