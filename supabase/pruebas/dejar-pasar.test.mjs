// Dejar pasar (0049, D1): la recepción, con motivo y hasta el tope del día
// (por persona); a un suspendido o dado de baja, solo dueño o encargado;
// tope 0 = la recepción no deja pasar; el dueño ve la lista del día.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir } from "./_comun.mjs";

let t, u = {};
before(async () => {
  t = await abrir("prueba-dejar-pasar");
  for (const r of ["dueno", "encargado", "recepcion"]) {
    const [{ id }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`${r}${Math.random()}@ejemplo.invalid`]);
    await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,$3,$4)`, [t.g, id, r === "recepcion" ? "Ana" : r, r]);
    u[r] = id;
  }
});
after(async () => t && t.cerrar());

// Socios nuevos sin plan: no pueden entrar (rojo), sirven para dejar pasar.
const sinPlan = async (n) => (await t.q(`insert into public.socios (gimnasio_id, nombre, apellido) values ($1,'Sin','Plan ' || $2) returning id`, [t.g, n]))[0].id;
const dejar = (s) => t.q(`select public.registrar_ingreso($1, $2, 'recepcion', 'Paga mañana') as r`, [s, t.sede]);

test("la recepción hasta el tope; después, el encargado", async () => {
  await t.q(`update public.configuracion_gimnasio set tope_dejar_pasar = 2 where gimnasio_id = $1`, [t.g]);
  const ss = [await sinPlan(1), await sinPlan(2), await sinPlan(3)];
  await t.comoUsuario(u.recepcion, async () => {
    assert.equal((await dejar(ss[0]))[0].r.resultado, "forzado");
    assert.equal((await dejar(ss[1]))[0].r.resultado, "forzado");
    const [{ c }] = await t.q(`select public.cupo_dejar_pasar($1) as c`, [t.g]);
    assert.deepEqual([c.usados, c.tope, c.sin_tope], [2, 2, false]);
    await t.falla(() => dejar(ss[2]), /Ya dejaste pasar a 2 hoy \(el tope es 2\)/);
    // Sin motivo no es "dejar pasar": queda anotado que no pudo entrar.
    const [{ r }] = await t.q(`select public.registrar_ingreso($1, $2) as r`, [ss[2], t.sede]);
    assert.equal(r.resultado, "rechazado");
  });
  await t.comoUsuario(u.encargado, async () => assert.equal((await dejar(ss[2]))[0].r.resultado, "forzado"));
});

test("suspendido o dado de baja: solo dueño o encargado; tope 0", async () => {
  const s = await sinPlan(4);
  await t.q(`update public.socios set dado_de_baja_en = now() - interval '1 day', motivo_baja = 'precio' where id = $1`, [s]);
  await t.comoUsuario(u.recepcion, () => t.falla(() => dejar(s), /dado de baja lo deja pasar el dueño o el encargado/));
  await t.comoUsuario(u.dueno, async () => assert.equal((await dejar(s))[0].r.resultado, "forzado"));
  await t.q(`update public.configuracion_gimnasio set tope_dejar_pasar = 0 where gimnasio_id = $1`, [t.g]);
  const s2 = await sinPlan(5);
  await t.comoUsuario(u.recepcion, () => t.falla(() => dejar(s2), /la recepción no deja pasar/));
});

test("el dueño ve a quién dejaron pasar hoy, quién y por qué; la recepción no", async () => {
  const s = await sinPlan(6);
  await t.q(`update public.configuracion_gimnasio set tope_dejar_pasar = 5 where gimnasio_id = $1`, [t.g]);
  await t.q(`set local role authenticated`);
  await t.q(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: u.recepcion, role: "authenticated" })]);
  await dejar(s);
  await t.q(`reset role`);
  await t.comoUsuario(u.dueno, async () => {
    const [{ d }] = await t.q(`select public.dejados_pasar($1) as d`, [t.g]);
    const fila = d.find((x) => x.socio_id === s);
    assert.equal(fila.por, "Ana");
    assert.equal(fila.motivo, "Paga mañana");
  });
  await t.comoUsuario(u.recepcion, () => t.falla(() => t.q(`select public.dejados_pasar($1)`, [t.g]), /Sin permiso/));
});
