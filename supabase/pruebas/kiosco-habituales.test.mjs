// COM-7 (0127): la tablet muestra a los que suelen venir a esta hora (si el
// dueño lo prende; viene apagado). Tocar el nombre pide los últimos 3 números
// del DNI; con otros, no entra. El que ya entró hoy no aparece.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir } from "./_comun.mjs";

let t, dueno, token, habitual, raro;
before(async () => {
  t = await abrir("prueba-kiosco-habituales");
  const [{ id }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`dueno${Math.random()}@ejemplo.invalid`]);
  await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,'Dueño','dueno')`, [t.g, id]);
  dueno = id;
  await t.q(`update public.configuracion_gimnasio set accesos_activos = array['recepcion','kiosco'] where gimnasio_id = $1`, [t.g]);
  await t.q(`set local role authenticated`);
  await t.q(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: dueno, role: "authenticated" })]);
  ({ token } = (await t.q(`select public.autorizar_tablet($1, $2, 'Puerta') as r`, [t.g, t.sede]))[0].r);
  await t.q(`reset role`);
  // El "Al Día" de los casos testigo vino 4 días a esta hora; otro, una sola vez.
  [{ id: habitual }] = await t.q(`select id from public.socios where gimnasio_id = $1 and nombre = 'Testigo' and apellido = 'Al Día'`, [t.g]);
  [{ id: raro }] = await t.q(`select id from public.socios where gimnasio_id = $1 and nombre = 'Testigo' and apellido = 'Por Vencer'`, [t.g]);
  await t.q(`update public.socios set dni = '30111222' where id = $1`, [habitual]);
  for (const [s, dias] of [[habitual, [1, 2, 3, 8]], [raro, [2]]])
    for (const d of dias) await t.q(`insert into public.ingresos (gimnasio_id, sede_id, socio_id, momento, via_acceso, resultado, color, motivo, texto)
      values ($1,$2,$3, now() - make_interval(days => $4), 'recepcion', 'entro', 'verde', 'al_dia', 'Al día')`, [t.g, t.sede, s, d]);
});
after(async () => t && t.cerrar());

async function comoTablet(fn) {
  await t.q(`set local role anon`);
  await t.q(`select set_config('request.jwt.claims', '{"role":"anon"}', true)`);
  try { return await fn(); } finally { await t.q(`reset role`); }
}

test("apagado no muestra nada; prendido muestra al habitual con inicial; con el DNI mal no entra; bien, entra", async () => {
  const lista = () => comoTablet(async () => (await t.q(`select public.kiosco_habituales($1) r`, [token]))[0].r);
  assert.deepEqual(await lista(), [], "viene apagado");
  await comoTablet(() => t.falla(() => t.q(`select public.kiosco_entrar_habitual($1, $2, '222')`, [token, habitual]), /no muestra habituales/));
  await t.q(`update public.configuracion_gimnasio set kiosco_habituales = true where gimnasio_id = $1`, [t.g]);
  const l = await lista();
  assert.deepEqual(l.map((x) => x.nombre), ["Testigo A."], "solo el que viene seguido, con la inicial del apellido");
  await comoTablet(() => t.falla(() => t.q(`select public.kiosco_entrar_habitual($1, $2, '999')`, [token, habitual]), /últimos números/));
  const r = await comoTablet(async () => (await t.q(`select public.kiosco_entrar_habitual($1, $2, '222') r`, [token, habitual]))[0].r);
  assert.equal(r.nombre, "Testigo");
  assert.ok(["entro", "entro_modo_aviso", "rechazado"].includes(r.resultado));
  if (r.resultado !== "rechazado") assert.deepEqual(await lista(), [], "el que ya entró hoy no aparece más");
});
