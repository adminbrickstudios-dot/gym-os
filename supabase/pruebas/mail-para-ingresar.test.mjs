// F1.2 · "Ese mail no tiene cuenta en Gimnasio X": el servidor distingue mail con ficha, mail sin nada y gimnasio inexistente; el navegador no puede preguntarlo.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir } from "./_comun.mjs";

let t;
before(async () => { t = await abrir("prueba-mail-ingresar"); });
after(async () => t && t.cerrar());
const servicio = async (fn) => { await t.q(`select set_config('request.jwt.claims', $1, false)`, [JSON.stringify({ role: "service_role" })]); try { return await fn(); } finally { await t.q(`select set_config('request.jwt.claims', '', false)`); } };
const pregunta = async (g, mail) => (await t.q(`select public.mail_para_ingresar($1, $2) as r`, [g, mail]))[0].r;

test("un socio con ese mail existe (sin importar mayúsculas); un mail cualquiera no, y devuelve el nombre del gimnasio", async () => {
  const [s] = await t.q(`select id from public.socios where gimnasio_id = $1 and dado_de_baja_en is null limit 1`, [t.g]);
  await t.q(`update public.socios set email = 'Socia.Prueba@Ejemplo.invalid' where id = $1`, [s.id]);
  await servicio(async () => {
    const si = await pregunta(t.g, " socia.prueba@ejemplo.invalid ");
    assert.equal(si.existe, true);
    assert.equal(si.gimnasio, "Gimnasio de Prueba");
    assert.equal((await pregunta(t.g, "nadie@ejemplo.invalid")).existe, false);
    assert.equal((await pregunta(t.g, "")).existe, false);
  });
});

test("el mail de un socio de OTRO gimnasio no cuenta, y un socio dado de baja tampoco", async () => {
  const [{ id: g2 }] = await t.q(`insert into public.gimnasios (slug, nombre) values ('prueba-mail-otro', 'Otro Gym') returning id`);
  await servicio(async () => {
    assert.equal((await pregunta(g2, "socia.prueba@ejemplo.invalid")).existe, false);
    assert.equal((await pregunta("00000000-0000-0000-0000-000000000000", "socia.prueba@ejemplo.invalid")).existe, null);
  });
  await t.q(`update public.socios set dado_de_baja_en = now(), motivo_baja = 'otro' where gimnasio_id = $1 and lower(email) = 'socia.prueba@ejemplo.invalid'`, [t.g]);
  await servicio(async () => { assert.equal((await pregunta(t.g, "socia.prueba@ejemplo.invalid")).existe, false); });
});

test("el navegador (anon o autenticado) no puede llamarlo", async () => {
  for (const rol of ["anon", "authenticated"]) {
    await t.db.query(`set role ${rol}`);
    try { await t.falla(() => t.q(`select public.mail_para_ingresar($1, 'x@ejemplo.invalid')`, [t.g]), /permission|permiso|Solo el servidor/i); } finally { await t.db.query("reset role"); }
  }
});
