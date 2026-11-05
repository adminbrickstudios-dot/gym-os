// Bandeja de avisos (0072): vence pronto, venció hace poco, no viene,
// cumpleaños y comprobante rechazado, con su mensaje; "avisado ✓" lo deja con
// ✓ hoy y no vuelve otro día; la recepción también avisa.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir } from "./_comun.mjs";

let t, uRec;
before(async () => {
  t = await abrir("prueba-bandeja");
  const [{ id: u }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`rec${Math.random()}@ejemplo.invalid`]);
  await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,'Ana','recepcion')`, [t.g, u]);
  uRec = u;
  // Un cumpleañero de hoy.
  await t.q(`insert into public.socios (gimnasio_id, nombre, apellido, telefono, fecha_nacimiento)
             values ($1,'Cumple','Hoy','+5490001234567', (privado.dia_local(now(), $2) - interval '30 years')::date)`, [t.g, t.ctx.zona]);
});
after(async () => t && t.cerrar());
async function como(u, fn) {
  await t.db.query("set role authenticated");
  await t.q(`select set_config('request.jwt.claims', $1, false)`, [JSON.stringify({ sub: u, role: "authenticated" })]);
  try { return await fn(); } finally { await t.db.query("reset role"); await t.q(`select set_config('request.jwt.claims', '', false)`); }
}
const bandeja = () => como(uRec, async () => (await t.q(`select public.bandeja_avisos($1) as b`, [t.g]))[0].b);

test("arma la lista con el mensaje y el avisado ✓ queda", async () => {
  const b = await bandeja();
  const cumple = b.find((x) => x.clave === "cumpleanos" && x.nombre === "Cumple Hoy");
  assert.ok(cumple); assert.match(cumple.mensaje, /Cumple/); assert.equal(cumple.avisado_en, null);
  assert.ok(b.every((x) => x.mensaje && x.referencia));
  await como(uRec, () => t.q(`select public.marcar_avisado($1, 'cumpleanos', $2)`, [cumple.socio_id, cumple.referencia]));
  await como(uRec, () => t.q(`select public.marcar_avisado($1, 'cumpleanos', $2)`, [cumple.socio_id, cumple.referencia]));   // no duplica
  const b2 = await bandeja();
  const c2 = b2.find((x) => x.clave === "cumpleanos" && x.nombre === "Cumple Hoy");
  assert.ok(c2.avisado_en); assert.equal(c2.avisado_por, "Ana");
  // Lo avisado va al final: después de todo lo que falta avisar.
  assert.ok(b2.findIndex((x) => x.avisado_en) > b2.map((x) => !x.avisado_en).lastIndexOf(true));
  const [{ n }] = await t.q(`select count(*)::int as n from public.avisos_enviados where socio_id = $1`, [cumple.socio_id]);
  assert.equal(n, 1);
  // Otro día: no vuelve.
  await t.q(`update public.avisos_enviados set creado_en = now() - interval '1 day' where socio_id = $1`, [cumple.socio_id]);
  assert.ok(!(await bandeja()).some((x) => x.clave === "cumpleanos" && x.nombre === "Cumple Hoy"));
  await como(uRec, () => t.falla(() => t.q(`select public.marcar_avisado($1, 'cualquiera', 'x')`, [cumple.socio_id]), /desconocido/));
});
