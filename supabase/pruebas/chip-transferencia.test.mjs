// VD-46F: la guía de la Entrada suma el chip "Subió un comprobante hace X" al socio que no está al día y tiene una
// transferencia pendiente. Solo informa: no cambia el color, el motivo ni quién entra. Momento fijo: 14/11/2026 19:00.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir, HOY } from "./_comun.mjs";

let t, momento;
const guia = async (clave) => (await t.q(`select privado.guia_entrada($1, $2, $3) g`, [t.ctx.socios[clave], momento, t.sede]))[0].g;
const chip = (g) => g.chips.find((c) => c.clave === "transferencia_pendiente");
async function aparte(fn) {
  await t.db.query("savepoint aparte");
  try { return await fn(); } finally { await t.db.query("rollback to savepoint aparte"); }
}
async function pago(clave, monto, hace, estado = "pendiente", medio = "transferencia") {
  const [{ id: v }] = await t.q(`insert into public.ventas (gimnasio_id, sede_id, socio_id, origen) values ($1,$2,$3,'app') returning id`, [t.g, t.sede, t.ctx.socios[clave]]);
  const [{ id }] = await t.q(
    `insert into public.pagos (gimnasio_id, venta_id, medio, monto, estado, comprobante_path, creado_en, rechazado_en, rechazado_motivo, aprobado_en)
     values ($1,$2,$3,$4,$5,$6, $7::timestamptz - $8::interval,
             case when $5 = 'rechazado' then now() end, case when $5 = 'rechazado' then 'no llegó' end, case when $5 = 'aprobado' then now() end)
     returning id`,
    [t.g, v, medio, monto, estado, `x/${Math.random()}.jpg`, momento, hace]);
  return id;
}
before(async () => { t = await abrir("prueba-chip-transferencia"); momento = await t.en(HOY, "19:00:00"); });
after(async () => t && t.cerrar());

test("el vencido con una transferencia pendiente ve el chip con monto y antigüedad, y la puerta no cambia", async () => {
  const antes = await guia("vencida");
  assert.equal(chip(antes), undefined);
  await aparte(async () => {
    await pago("vencida", 15000, "26 hours");
    const g = await guia("vencida");
    const c = chip(g);
    assert.ok(c, "hay chip");
    assert.match(c.texto, /hace 1 día/);
    assert.match(c.texto, /15\.000/);
    assert.equal(c.href, "/transferencias");
    assert.equal(g.color, antes.color);
    assert.equal(g.puede, antes.puede);
    assert.equal(g.situacion, antes.situacion);
    assert.equal(g.boton, antes.boton);
    const v = (await t.q(`select (privado.calcular_acceso($1, $2, $3)).puede as p`, [t.ctx.socios.vencida, momento, t.sede]))[0].p;
    assert.equal(v, antes.puede, "el cálculo de la puerta no mira el pendiente");
  });
  await aparte(async () => {
    await pago("vencida", 8000, "40 minutes");
    assert.match(chip(await guia("vencida")).texto, /hace 40 min/);
  });
});

test("varias pendientes: la más nueva y 'y N más'; rechazada, aprobada, otro medio o futura no cuentan; al día no ve chip", async () => {
  await aparte(async () => {
    await pago("vencida", 1000, "3 hours");
    await pago("vencida", 2000, "30 minutes");
    const c = chip(await guia("vencida"));
    assert.match(c.texto, /hace 30 min/);
    assert.match(c.texto, /y 1 más/);
  });
  await aparte(async () => {
    await pago("vencida", 1000, "3 hours", "rechazado");
    await pago("vencida", 1000, "3 hours", "anulado");
    await pago("vencida", 1000, "3 hours", "pendiente", "debito");
    await pago("vencida", 1000, "-2 hours");
    assert.equal(chip(await guia("vencida")), undefined);
  });
  await aparte(async () => {
    await pago("al_dia", 1000, "1 hour");
    assert.equal(chip(await guia("al_dia")), undefined, "el que está al día no lo necesita");
  });
});
