// Llavero (0052): se asigna desde la ficha (normalizado, único por gimnasio);
// la recepción lo lee solo si la forma está prendida; la tablet también; el
// profe no.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir } from "./_comun.mjs";

let t, u = {};
before(async () => {
  t = await abrir("prueba-llavero");
  for (const r of ["dueno", "recepcion", "profe"]) {
    const [{ id }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`${r}${Math.random()}@ejemplo.invalid`]);
    await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,$3,$4)`, [t.g, id, r, r]);
    u[r] = id;
  }
});
after(async () => t && t.cerrar());

async function como(sub, rol, fn) {
  await t.q(`set local role ${rol}`);
  await t.q(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify(sub ? { sub, role: rol } : { role: rol })]);
  try { return await fn(); } finally { await t.q(`reset role`); }
}

test("asignar, único, leer solo prendido, la tablet también", async () => {
  const [a, b] = [t.ctx.socios.al_dia, t.ctx.socios.vencida];
  await como(u.recepcion, "authenticated", () => t.q(`select public.asignar_llavero($1, ' 0012-ab ')`, [a]));
  const [{ l }] = await t.q(`select llavero l from public.socios where id = $1`, [a]);
  assert.equal(l, "0012AB");
  await t.comoUsuario(u.recepcion, async () => {
    await t.falla(() => t.q(`select public.asignar_llavero($1, '0012AB')`, [b]), /ya es de Testigo Al Día/);
    await t.falla(() => t.q(`select public.asignar_llavero($1, 'a')`, [b]), /de 4 a 30/);
    assert.equal((await t.q(`select public.leer_llavero($1, '0012AB') as r`, [t.g]))[0].r, null, "apagado: no lee");
  });
  await t.q(`update public.configuracion_gimnasio set accesos_activos = array['recepcion','nfc','kiosco'] where gimnasio_id = $1`, [t.g]);
  await t.comoUsuario(u.recepcion, async () => {
    assert.equal((await t.q(`select public.leer_llavero($1, '0012ab') as r`, [t.g]))[0].r.socio_id, a);
    assert.equal((await t.q(`select public.leer_llavero($1, '9999') as r`, [t.g]))[0].r, null);
  });
  await t.comoUsuario(u.profe, () => t.falla(() => t.q(`select public.leer_llavero($1, '0012AB')`, [t.g]), /Sin permiso/));
  const { token } = await como(u.dueno, "authenticated", async () => (await t.q(`select public.autorizar_tablet($1, $2, 'Puerta') as r`, [t.g, t.sede]))[0].r);
  const r = await como(null, "anon", async () => (await t.q(`select public.kiosco_entrar($1, '0012AB') as r`, [token]))[0].r);
  assert.equal(r.nombre, "Testigo");
  const [{ via }] = await t.q(`select via_acceso via from public.ingresos where socio_id = $1 order by momento desc limit 1`, [a]);
  assert.equal(via, "kiosco");
  await como(u.recepcion, "authenticated", () => t.q(`select public.quitar_llavero($1)`, [a]));
  await t.comoUsuario(u.recepcion, async () => assert.equal((await t.q(`select public.leer_llavero($1, '0012AB') as r`, [t.g]))[0].r, null));
});
