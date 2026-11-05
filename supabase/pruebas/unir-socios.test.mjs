// Unir socios (0040): encuentra el duplicado por celular y por nombre; al
// unir, pagos, cuotas, entradas, notas y etiquetas pasan al que queda y su
// estado de acceso es el de las cuotas de los dos; el que se va desaparece y
// queda registrado; solo el dueño; lo que no puede quedar doble lo frena; los
// hechos siguen sin poder cambiarse fuera de unir.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir } from "./_comun.mjs";

let t, u = {};
async function persona(rol) {
  const [{ id }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`${rol}${Math.random()}@ejemplo.invalid`]);
  await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,$3,$4)`, [t.g, id, rol, rol]);
  return id;
}
before(async () => { t = await abrir("prueba-unir"); u.dueno = await persona("dueno"); u.encargado = await persona("encargado"); });
after(async () => t && t.cerrar());

// Como el dueño, sin volver atrás al terminar (para ver el resultado como la base).
async function comoDueno(fn) {
  await t.q(`set local role authenticated`);
  await t.q(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: u.dueno, role: "authenticated" })]);
  try { return await fn(); } finally { await t.q(`reset role`).catch(() => {}); }
}
const nuevo = async (nombre, apellido, tel, dni = null) =>
  (await t.q(`insert into public.socios (gimnasio_id, nombre, apellido, telefono, dni) values ($1,$2,$3,$4,$5) returning id`, [t.g, nombre, apellido, tel, dni]))[0].id;

test("encuentra duplicados y une moviendo todo; el estado sale de los hechos de los dos", async () => {
  // El que tiene la cuota paga es un duplicado cargado sin DNI.
  const pago = t.ctx.socios.al_dia;
  await t.q(`update public.socios set nombre = 'Ramiro', apellido = 'Duplicado', telefono = '+5490000888001', dni = null where id = $1`, [pago]);
  const otro = await nuevo("Ramiro", "Duplicado", "+5490000888001", "33444555");
  const [{ n: ingresosAntes }] = await t.q(`select count(*)::int n from public.ingresos where socio_id = $1`, [pago]);
  await comoDueno(async () => {
    await t.q(`select public.agregar_nota($1, 'nota del duplicado')`, [pago]);
    await t.q(`select public.poner_etiqueta($1, 'mañana')`, [pago]);
    await t.q(`select public.poner_etiqueta($1, 'Mañana')`, [otro]);
    const d = (await t.q(`select public.posibles_duplicados($1) as d`, [t.g]))[0].d;
    const par = d.find((x) => [x.a, x.b].includes(otro) && [x.a, x.b].includes(pago));
    assert.equal(par?.motivo, "Mismo celular");
    await t.q(`select public.unir_socios($1, $2, $3)`, [t.g, otro, pago]);
  });
  const [{ n: quedan }] = await t.q(`select count(*)::int n from public.socios where id = $1`, [pago]);
  assert.equal(quedan, 0, "el duplicado desaparece");
  const [{ n: ingresos }] = await t.q(`select count(*)::int n from public.ingresos where socio_id = $1`, [otro]);
  assert.equal(ingresos, ingresosAntes, "las entradas pasan al que queda");
  const [{ c }] = await t.q(`select (x).color as c from (select privado.calcular_acceso($1, $2::timestamptz) as x) y`, [otro, await t.en("2026-11-14")]);
  assert.equal(c, "verde", "la cuota paga del duplicado ahora es del que queda");
  const [{ n: notas }] = await t.q(`select count(*)::int n from public.notas_socio where socio_id = $1`, [otro]);
  assert.equal(notas, 1);
  const [{ n: etq }] = await t.q(`select count(*)::int n from public.socio_etiquetas where socio_id = $1`, [otro]);
  assert.equal(etq, 1, "la misma etiqueta no se duplica");
  const [{ se_fue }] = await t.q(`select se_fue from public.uniones_socios where queda_id = $1`, [otro]);
  assert.equal(se_fue.nombre, "Ramiro");
  const [{ dni }] = await t.q(`select dni from public.socios where id = $1`, [otro]);
  assert.equal(dni, "33444555");
});

test("frena lo que no puede quedar doble; solo el dueño; los hechos siguen fijos", async () => {
  const a = t.ctx.socios.vencida;
  const [{ n }] = await t.q(`select count(*)::int n from public.suscripciones where socio_id = $1 and baja_en is null`, [a]);
  const b = await nuevo("Otra", "Persona", "+5490000888002");
  if (n > 0) {
    const [{ plan }] = await t.q(`select plan_id as plan from public.suscripciones where socio_id = $1 and baja_en is null`, [a]);
    await t.q(`select privado.asignar_plan($1, $2, now(), null)`, [b, plan]);
    await t.comoUsuario(u.dueno, async () => t.falla(() => t.q(`select public.unir_socios($1, $2, $3)`, [t.g, a, b]), /los dos tienen una membresía activa/i));
  }
  const c2 = await nuevo("Con", "Dni", null, "40111222"), d2 = await nuevo("Con", "Dni", null, "40111333");
  await t.comoUsuario(u.dueno, async () => t.falla(() => t.q(`select public.unir_socios($1, $2, $3)`, [t.g, c2, d2]), /DNI distinto/));
  await t.comoUsuario(u.encargado, async () => t.falla(() => t.q(`select public.unir_socios($1, $2, $3)`, [t.g, c2, d2]), /Sin permiso/));
  // Fuera de unir, el socio de un hecho no se cambia.
  await t.falla(() => t.q(`update public.ingresos set socio_id = $1 where id = (select id from public.ingresos where gimnasio_id = $2 limit 1)`, [c2, t.g]), /solo se puede cambiar/);
});
