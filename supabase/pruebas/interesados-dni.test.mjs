// VD-15 / VD-6b (0151): el Interesado con DNI se ofrece por DNI, el DNI no se repite, y Socios marca
// (y filtra) a los que se registraron solos por la web.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir } from "./_comun.mjs";

let t, recepcion, profe;
async function persona(rol) {
  const [{ id }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`${rol}${Math.random()}@ejemplo.invalid`]);
  await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,$3,$4)`, [t.g, id, rol, rol]);
  return id;
}
async function como(usuario, fn) {
  await t.db.query("set role authenticated");
  await t.q(`select set_config('request.jwt.claims', $1, false)`, [JSON.stringify({ sub: usuario, role: "authenticated" })]);
  try { return await fn(); } finally { await t.db.query("reset role"); await t.q(`select set_config('request.jwt.claims', '', false)`); }
}
before(async () => {
  t = await abrir("prueba-interesados-dni");
  recepcion = await persona("recepcion"); profe = await persona("profe");
});
after(async () => t && t.cerrar());

test("crear_prospecto con DNI: se ofrece por DNI, no se repite, y un DNI roto se rechaza", async () => {
  const id = await como(recepcion, async () => (await t.q(`select public.crear_prospecto($1, 'Ana Interesada', '000 555 0101', null, 'recepcion', '30.111.222') id`, [t.g]))[0].id);
  const [{ dni }] = await t.q(`select dni from public.prospectos where id = $1`, [id]);
  assert.equal(dni, "30111222", "se guarda solo con números");
  const r = await como(recepcion, async () => (await t.q(`select public.prospecto_por_dni($1, '30111222') r`, [t.g]))[0].r);
  assert.equal(r.nombre, "Ana Interesada");
  assert.equal(r.id, id);
  const corto = await como(recepcion, async () => (await t.q(`select public.prospecto_por_dni($1, '301') r`, [t.g]))[0].r);
  assert.equal(corto, null, "un DNI a medio escribir no coincide con nadie");
  await como(recepcion, () => t.falla(() => t.q(`select public.crear_prospecto($1, 'Otra', '000 555 0102', null, 'recepcion', '30111222')`, [t.g]), /ese DNI/));
  await como(recepcion, () => t.falla(() => t.q(`select public.crear_prospecto($1, 'Rota', '000 555 0103', null, 'recepcion', '123')`, [t.g]), /DNI/));
  const lista = await como(recepcion, async () => (await t.q(`select public.prospectos_panel($1) r`, [t.g]))[0].r);
  assert.equal(lista.find((x) => x.id === id).dni, "30111222", "la lista trae el DNI");
  const [{ socio }] = await t.q(`select id socio from public.socios where gimnasio_id = $1 limit 1`, [t.g]);
  await t.q(`update public.prospectos set estado = 'socio', socio_id = $2 where id = $1`, [id, socio]);
  const ya = await como(recepcion, async () => (await t.q(`select public.prospecto_por_dni($1, '30111222') r`, [t.g]))[0].r);
  assert.equal(ya, null, "si ya es socio no se ofrece");
});

test("sin DNI el Interesado sigue entrando (el DNI es opcional) y la profe no ve nada", async () => {
  await como(recepcion, async () => (await t.q(`select public.crear_prospecto($1, 'Sin DNI', '000 555 0104') id`, [t.g]))[0].id);
  await como(profe, () => t.falla(() => t.q(`select public.prospecto_por_dni($1, '30111222')`, [t.g]), /permiso|equipo|acceso/i));
  await como(profe, () => t.falla(() => t.q(`select public.autoaltas_web($1)`, [t.g]), /permiso|equipo|acceso/i));
});

test("buscar_socios marca y filtra a los que se registraron solos", async () => {
  const antes = await como(recepcion, async () => (await t.q(`select public.autoaltas_web($1) n`, [t.g]))[0].n);
  const [{ id }] = await t.q(`insert into public.socios (gimnasio_id, nombre, apellido, origen) values ($1, 'Web', 'Solo', 'alta_web') returning id`, [t.g]);
  const despues = await como(recepcion, async () => (await t.q(`select public.autoaltas_web($1) n`, [t.g]))[0].n);
  assert.equal(despues, antes + 1);
  const web = await como(recepcion, () => t.q(`select * from public.buscar_socios($1, '', 100, null, null, null, 'web')`, [t.g]));
  assert.ok(web.length >= 1 && web.every((x) => x.autoalta), "el filtro trae solo autoaltas");
  assert.ok(web.some((x) => x.socio_id === id));
  const todos = await como(recepcion, () => t.q(`select * from public.buscar_socios($1, 'Solo', 100)`, [t.g]));
  assert.equal(todos.find((x) => x.socio_id === id)?.autoalta, true);
  const otros = await como(recepcion, () => t.q(`select * from public.buscar_socios($1, '', 100)`, [t.g]));
  assert.ok(otros.some((x) => x.autoalta === false), "los demás no llevan la marca");
  await como(recepcion, () => t.falla(() => t.q(`select * from public.buscar_socios($1, '', 10, null, null, null, 'otro')`, [t.g]), /Filtro desconocido/));
});
