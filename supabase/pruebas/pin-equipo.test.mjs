// PIN del equipo (0071, D15): queda anotado quien puso el PIN; nunca da más
// permisos que la sesión; token vencido, adulterado o de otro gimnasio: error;
// 5 errores bloquean 10 minutos; el hash no se lee.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir } from "./_comun.mjs";

let t, uPc, uAna, uDueno, caja, eAna;
before(async () => {
  t = await abrir("prueba-pin");
  [{ id: caja }] = await t.q(`insert into public.cajas (gimnasio_id, sede_id, nombre) values ($1,$2,'Mostrador') returning id`, [t.g, t.sede]);
  const crear = async (rol, n) => {
    const [{ id: u }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`${rol}${Math.random()}@ejemplo.invalid`]);
    const [{ id: e }] = await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,$3,$4) returning id`, [t.g, u, n, rol]);
    return [u, e];
  };
  [uPc] = await crear("recepcion", "PC Recepción"); [uAna, eAna] = await crear("recepcion", "Ana"); [uDueno] = await crear("dueno", "Sofía");
});
after(async () => t && t.cerrar());
async function como(u, fn, token = null) {
  await t.db.query("set role authenticated");
  await t.q(`select set_config('request.jwt.claims', $1, false), set_config('request.headers', $2, false)`,
    [JSON.stringify({ sub: u, role: "authenticated" }), JSON.stringify(token ? { "x-gymos-operador": token } : {})]);
  try { return await fn(); } finally { await t.db.query("reset role"); await t.q(`select set_config('request.jwt.claims', '', false), set_config('request.headers', '', false)`); }
}

test("cada uno pone su PIN; distinto y no trivial", async () => {
  await como(uAna, async () => {
    await t.falla(() => t.q(`select public.guardar_mi_pin($1, '12a4')`, [t.g]), /4 números/);
    await t.falla(() => t.q(`select public.guardar_mi_pin($1, '1234')`, [t.g]), /fácil de adivinar/);
    await t.q(`select public.guardar_mi_pin($1, '4827')`, [t.g]);
  });
  await como(uDueno, async () => {
    await t.falla(() => t.q(`select public.guardar_mi_pin($1, '4827')`, [t.g]), /ya lo usa otra persona/);
    await t.q(`select public.guardar_mi_pin($1, '9051')`, [t.g]);
  });
  await como(uAna, () => t.falla(() => t.q(`select * from privado.pines_equipo`), /permission denied/));
});

test("en la PC: queda anotado quien puso el PIN, y nunca con más permisos que la sesión", async () => {
  const ana = await como(uPc, async () => (await t.q(`select public.entrar_con_pin($1, '4827') as r`, [t.g]))[0].r);
  assert.equal(ana.nombre, "Ana");
  const turno = await como(uPc, async () => (await t.q(`select public.abrir_caja($1, 0) as id`, [caja]))[0].id, ana.token);
  const [{ por }] = await t.q(`select abierto_por as por from public.turnos_caja where id = $1`, [turno]);
  assert.equal(por, eAna);
  assert.equal((await como(uPc, async () => (await t.q(`select public.operador_actual($1) as o`, [t.g]))[0].o, ana.token)).nombre, "Ana");
  // La dueña pone su PIN en la PC de la recepción: sigue sin poder lo de dueña.
  const sofia = await como(uPc, async () => (await t.q(`select public.entrar_con_pin($1, '9051') as r`, [t.g]))[0].r);
  await como(uPc, () => t.falla(() => t.q(`select public.alertas_caja($1)`, [t.g]), /Sin permiso/), sofia.token);
  // Y una recepcionista con la sesión de la dueña tampoco hace cosas de dueña.
  await como(uDueno, () => t.falla(() => t.q(`select public.alertas_caja($1)`, [t.g]), /Ana \(puso su PIN\) no puede/), ana.token);
});

test("token adulterado o vencido: error, nunca se anota a otro en silencio; 5 errores bloquean", async () => {
  const ana = await como(uPc, async () => (await t.q(`select public.entrar_con_pin($1, '4827') as r`, [t.g]))[0].r);
  const [id, vence, firma] = ana.token.split(".");
  const malo = `${id}.${Number(vence) + 999}.${firma}`;
  await como(uPc, () => t.falla(() => t.q(`select * from public.caja_abierta($1)`, [t.sede]), /no es válido/), malo);
  await como(uPc, async () => {
    for (let i = 0; i < 5; i++) {
      const [{ r }] = await t.q(`select public.entrar_con_pin($1, '0001') as r`, [t.g]);
      assert.equal(r.error, "PIN equivocado"); assert.equal(r.quedan, 4 - i);
    }
    await t.falla(() => t.q(`select public.entrar_con_pin($1, '4827')`, [t.g]), /esperá 10 minutos/);
  });
});
