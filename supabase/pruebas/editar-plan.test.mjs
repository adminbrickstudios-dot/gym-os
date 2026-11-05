// Editar un plan (0055): cambia solo lo que viene. "Dejar de vender" ya no
// borra la descripción ni las veces por semana (que deciden si entra).
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir } from "./_comun.mjs";

let t, u = {};
before(async () => {
  t = await abrir("prueba-editar-plan");
  for (const r of ["dueno", "recepcion"]) {
    const [{ id }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`${r}${Math.random()}@ejemplo.invalid`]);
    await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,$3,$4)`, [t.g, id, r, r]);
    u[r] = id;
  }
});
after(async () => t && t.cerrar());

test("dejar de vender y volver no toca lo demás; editar cambia solo lo pedido", async () => {
  await t.comoUsuario(u.dueno, async () => {
    const [{ id }] = await t.q(`select public.guardar_plan($1, null, $2) as id`, [t.g,
      { tipo: "membresia", nombre: "2 veces", descripcion: "Martes y jueves", max_ingresos_semana: 2, hora_desde: "07:00", hora_hasta: "16:00" }]);
    const leer = async () => (await t.q(`select nombre, descripcion, max_ingresos_semana, hora_desde::text, hora_hasta::text, activo from public.planes where id = $1`, [id]))[0];
    await t.q(`select public.guardar_plan($1, $2, $3)`, [t.g, id, { nombre: "2 veces", activo: false }]);
    await t.q(`select public.guardar_plan($1, $2, $3)`, [t.g, id, { activo: true }]);
    assert.deepEqual(await leer(), { nombre: "2 veces", descripcion: "Martes y jueves", max_ingresos_semana: 2, hora_desde: "07:00:00", hora_hasta: "16:00:00", activo: true });
    await t.q(`select public.guardar_plan($1, $2, $3)`, [t.g, id, { nombre: "Dos por semana", descripcion: "" }]);
    const p = await leer();
    assert.equal(p.nombre, "Dos por semana"); assert.equal(p.descripcion, null); assert.equal(p.max_ingresos_semana, 2);
    await t.q(`select public.guardar_plan($1, $2, $3)`, [t.g, id, { max_ingresos_semana: "" }]);
    assert.equal((await leer()).max_ingresos_semana, null);
    await t.falla(() => t.q(`select public.guardar_plan($1, $2, $3)`, [t.g, id, { nombre: "  " }]), /nombre del plan/);
  });
  await t.comoUsuario(u.recepcion, () => t.falla(() => t.q(`select public.guardar_plan($1, null, $2)`, [t.g, { tipo: "pack", nombre: "X", cantidad_clases: 4 }]), /Sin permiso/));
});
