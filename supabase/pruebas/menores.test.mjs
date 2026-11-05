// Menores (0043, D10): un menor de 18 se carga con un adulto responsable;
// la cuenta que verifica el celular del responsable queda vinculada al menor
// y el celular del menor no vincula nada.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir } from "./_comun.mjs";

let t, recepcion;
before(async () => {
  t = await abrir("prueba-menores");
  [{ id: recepcion }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`recepcion${Math.random()}@ejemplo.invalid`]);
  await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,'Rece','recepcion')`, [t.g, recepcion]);
});
after(async () => t && t.cerrar());

const hace = (anios) => `${new Date().getFullYear() - anios}-01-15`;

test("menor sin responsable no se guarda; con responsable sí, y la ficha lo dice", async () => {
  await t.comoUsuario(recepcion, async () => {
    await t.falla(() => t.q(`select public.guardar_socio($1, null, $2)`, [t.g, { nombre: "Tomi", fecha_nacimiento: hace(12) }]), /adulto responsable/);
    const [{ id }] = await t.q(`select public.guardar_socio($1, null, $2) as id`, [t.g,
      { nombre: "Tomi", apellido: "Menor", fecha_nacimiento: hace(12), telefono: "000 777 1001", responsable_nombre: "Laura Menor", responsable_telefono: "000 777 1002" }]);
    const [{ f }] = await t.q(`select public.ficha_socio($1) as f`, [id]);
    assert.equal(f.socio.es_menor, true);
    assert.equal(f.socio.responsable_telefono, "+5490007771002");
    // Un adulto no necesita responsable.
    await t.q(`select public.guardar_socio($1, null, $2)`, [t.g, { nombre: "Grande", fecha_nacimiento: hace(30) }]);
    await t.falla(() => t.q(`select public.guardar_socio($1, null, $2)`, [t.g, { nombre: "Futuro", fecha_nacimiento: `${new Date().getFullYear() + 1}-01-01` }]), /no puede ser futura/);
  });
});

test("la app: el celular del responsable trae al menor; el del menor no", async () => {
  const [{ id: menor }] = await t.q(`insert into public.socios (gimnasio_id, nombre, apellido, fecha_nacimiento, telefono, responsable_nombre, responsable_telefono)
      values ($1,'Nico','Menor',$2,'+5490007772001','Papá','+5490007772002') returning id`, [t.g, hace(10)]);
  const [{ id: delMenor }] = await t.q(`insert into auth.users (phone, phone_confirmed_at) values ('5490007772001', now()) returning id`);
  const [{ id: delPapa }] = await t.q(`insert into auth.users (phone, phone_confirmed_at) values ('5490007772002', now()) returning id`);
  await t.db.query("savepoint v");
  await t.db.query("set local role service_role");
  await t.q(`select set_config('request.jwt.claims', '{"role":"service_role"}', true)`);
  const [{ n: n1 }] = await t.q(`select public.vincular_socios_por_telefono($1, $2) as n`, [t.g, delMenor]);
  const [{ n: n2 }] = await t.q(`select public.vincular_socios_por_telefono($1, $2) as n`, [t.g, delPapa]);
  await t.db.query("reset role");
  assert.equal(n1, 0, "el menor no entra a la app");
  assert.equal(n2, 1);
  const [{ u }] = await t.q(`select usuario_id u from public.socios where id = $1`, [menor]);
  assert.equal(u, delPapa);
  await t.db.query("rollback to savepoint v");
});
