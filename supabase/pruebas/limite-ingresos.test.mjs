// BASE-8 · Tope de ingresos fallidos: 8 por mail cada 15 min; otro mail no se ve afectado; solo el servidor lo llama.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir } from "./_comun.mjs";

let t;
before(async () => { t = await abrir("prueba-limite-ingresos"); });
after(async () => t && t.cerrar());
const servicio = async (fn) => { await t.q(`select set_config('request.jwt.claims', $1, false)`, [JSON.stringify({ role: "service_role" })]); try { return await fn(); } finally { await t.q(`select set_config('request.jwt.claims', '', false)`); } };

test("después de 8 fallos del mismo mail deja de permitir; otro mail sigue permitido", async () => {
  await servicio(async () => {
    assert.equal((await t.q(`select public.ingreso_permitido('uno@ejemplo.invalid', '1.2.3.4') as p`))[0].p, true);
    for (let i = 0; i < 8; i++) await t.q(`select public.registrar_ingreso_fallido('Uno@ejemplo.invalid ', '1.2.3.4')`);
    assert.equal((await t.q(`select public.ingreso_permitido('uno@ejemplo.invalid', '9.9.9.9') as p`))[0].p, false);
    assert.equal((await t.q(`select public.ingreso_permitido('otro@ejemplo.invalid', '9.9.9.9') as p`))[0].p, true);
  });
});

test("20 fallos desde una misma conexión frenan a cualquier mail", async () => {
  await servicio(async () => {
    for (let i = 0; i < 20; i++) await t.q(`select public.registrar_ingreso_fallido($1, '5.5.5.5')`, [`m${i}@ejemplo.invalid`]);
    assert.equal((await t.q(`select public.ingreso_permitido('nuevo@ejemplo.invalid', '5.5.5.5') as p`))[0].p, false);
  });
});

test("el navegador (anon o autenticado) no puede llamarlo", async () => {
  await t.db.query("set role anon");
  try { await t.falla(() => t.q(`select public.ingreso_permitido('x@ejemplo.invalid', null)`), /permission|permiso|Solo el servidor/i); } finally { await t.db.query("reset role"); }
});
