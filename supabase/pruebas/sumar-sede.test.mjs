// REV-2a (0119): el dueño suma una sede y la caja de esa sede aparece sola;
// nombre vacío o repetido avisa; la recepción y el encargado no pueden.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir } from "./_comun.mjs";

let t, u = {};
before(async () => {
  t = await abrir("prueba-sumar-sede");
  for (const rol of ["dueno", "encargado", "recepcion"]) {
    const [{ id }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`${rol}${Math.random()}@ejemplo.invalid`]);
    await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,$3,$4)`, [t.g, id, rol, rol]);
    u[rol] = id;
  }
});
after(async () => t && t.cerrar());

test("el dueño suma una sede con su caja; vacía o repetida avisa; los demás no", async () => {
  await t.comoUsuario(u.dueno, async () => {
    const [{ id }] = await t.q(`select public.sumar_sede($1, '  Barrio Norte ') as id`, [t.g]);
    const [sede] = await t.q(`select nombre, es_principal from public.sedes where id = $1`, [id]);
    assert.deepEqual(sede, { nombre: "Barrio Norte", es_principal: false });
    const [{ n }] = await t.q(`select count(*)::int n from public.cajas where sede_id = $1`, [id]);
    assert.equal(n, 1, "la caja de la sede nueva se crea sola");
    await t.falla(() => t.q(`select public.sumar_sede($1, 'barrio norte')`, [t.g]), /Ya hay una sede/);
    await t.falla(() => t.q(`select public.sumar_sede($1, '   ')`, [t.g]), /Escribí el nombre/);
  });
  for (const rol of ["encargado", "recepcion"])
    await t.comoUsuario(u[rol], () => t.falla(() => t.q(`select public.sumar_sede($1, 'Otra')`, [t.g]), /permiso|rol|acceso/i));
});
