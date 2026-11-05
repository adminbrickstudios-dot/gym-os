// Caja olvidada (0070): abierta de otro día u horas después del cierre; la
// recepción ve solo las suyas; no se abre otra con una abierta.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir } from "./_comun.mjs";

let t, uRec, uRec2, uDueno, caja1, caja2;
before(async () => {
  t = await abrir("prueba-caja-olvidada");
  [{ id: caja1 }] = await t.q(`insert into public.cajas (gimnasio_id, sede_id, nombre) values ($1,$2,'Mostrador') returning id`, [t.g, t.sede]);
  [{ id: caja2 }] = await t.q(`insert into public.cajas (gimnasio_id, sede_id, nombre) values ($1,$2,'Barra') returning id`, [t.g, t.sede]);
  const crear = async (rol, n) => {
    const [{ id: u }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`${rol}${Math.random()}@ejemplo.invalid`]);
    await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,$3,$4)`, [t.g, u, n, rol]);
    return u;
  };
  uRec = await crear("recepcion", "Ana"); uRec2 = await crear("recepcion", "Beto"); uDueno = await crear("dueno", "Sofía");
});
after(async () => t && t.cerrar());
async function como(u, fn) {
  await t.db.query("set role authenticated");
  await t.q(`select set_config('request.jwt.claims', $1, false)`, [JSON.stringify({ sub: u, role: "authenticated" })]);
  try { return await fn(); } finally { await t.db.query("reset role"); await t.q(`select set_config('request.jwt.claims', '', false)`); }
}

test("abierta de ayer: olvidada; no deja abrir otra; la ve quien la abrió y el dueño", async () => {
  const turno = await como(uRec, async () => (await t.q(`select public.abrir_caja($1, 0) as id`, [caja1]))[0].id);
  assert.equal((await t.q(`select privado.caja_olvidada($1, now()) as o`, [turno]))[0].o, false);
  await t.q(`update public.turnos_caja set abierto_en = now() - interval '1 day' where id = $1`, [turno]);
  assert.equal((await t.q(`select privado.caja_olvidada($1, now()) as o`, [turno]))[0].o, true);
  await como(uRec, async () => {
    await t.falla(() => t.q(`select public.abrir_caja($1, 0)`, [caja2]), /Tenés abierta la Mostrador desde el .*cerrala antes de abrir otra/);
    const [{ o }] = await t.q(`select public.cajas_olvidadas($1) as o`, [t.g]);
    assert.equal(o.length, 1); assert.equal(o[0].mia, true);
  });
  await como(uRec2, async () => {
    assert.equal((await t.q(`select public.cajas_olvidadas($1) as o`, [t.g]))[0].o.length, 0);
    await t.q(`select public.abrir_caja($1, 0)`, [caja2]);   // otra persona sí abre otra caja
  });
  await como(uDueno, async () => assert.equal((await t.q(`select public.cajas_olvidadas($1) as o`, [t.g]))[0].o.length, 1));
});

test("de hoy, después de la hora de cierre de la sede: olvidada", async () => {
  const [{ id: turno }] = await t.q(`select id from public.turnos_caja where caja_id = $1 and cerrado_en is null`, [caja2]);
  const [{ dia }] = await t.q(`select extract(isodow from privado.dia_local(now(), $1))::int as dia`, [t.ctx.zona]);
  await t.q(`insert into public.horarios_apertura (gimnasio_id, sede_id, dia, abre, cierra) values ($1,$2,$3,'00:00','00:01')`, [t.g, t.sede, dia]);
  assert.equal((await t.q(`select privado.caja_olvidada($1, now()) as o`, [turno]))[0].o, true);
});
