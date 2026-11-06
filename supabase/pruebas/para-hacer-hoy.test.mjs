// VD-13 (5000): Para hacer hoy. Cada automática aparece con su dato y desaparece sola al resolverse;
// se prende, se apaga y se asigna a una persona; el profe no entra y la recepción no ve lo de gestión;
// las manuales se repiten; el checklist de apertura y cierre se tilda por día.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir } from "./_comun.mjs";

let t, u = {}, eq = {};
async function como(usuario, fn) {
  await t.db.query("set role authenticated");
  await t.q(`select set_config('request.jwt.claims', $1, false)`, [JSON.stringify({ sub: usuario, role: "authenticated" })]);
  try { return await fn(); } finally { await t.db.query("reset role"); await t.q(`select set_config('request.jwt.claims', '', false)`); }
}
const hacer = (usuario) => como(usuario, async () => (await t.q(`select public.para_hacer_hoy($1) p`, [t.g]))[0].p);
const clave = (lista, k) => lista.find((x) => x.clave === k);

before(async () => {
  t = await abrir("prueba-para-hacer-hoy");
  for (const [k, rol] of [["dueno", "dueno"], ["enc", "encargado"], ["ana", "recepcion"], ["bea", "recepcion"], ["pablo", "profe"]]) {
    const [{ id }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`${k}${Math.random()}@ejemplo.invalid`]);
    const [{ id: e }] = await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,$3,$4) returning id`, [t.g, id, k, rol]);
    u[k] = id; eq[k] = e;
  }
});
after(async () => t && t.cerrar());

test("stock bajo: aparece con su dato para el dueño, no para la recepción, y se va al reponer", async () => {
  const [{ id: prod }] = await t.q(`insert into public.productos (gimnasio_id, nombre, precio, controla_stock, stock_minimo) values ($1,'Proteína',5000,true,5) returning id`, [t.g]);
  const dueno = clave(await hacer(u.dueno), "stock_bajo");
  assert.ok(dueno, "el dueño ve el stock bajo");
  assert.equal(dueno.cantidad, 1);
  assert.match(dueno.texto, /Reponer 1 producto/);
  assert.equal(clave(await hacer(u.ana), "stock_bajo"), undefined, "la recepción no ve lo de gestión");
  await t.q(`insert into public.movimientos_stock (gimnasio_id, producto_id, cantidad, tipo, creado_por) values ($1,$2,20,'entrada',$3)`, [t.g, prod, eq.dueno]);
  assert.equal(clave(await hacer(u.dueno), "stock_bajo"), undefined, "repuesto: sale solo");
});

test("cumpleaños: aparece con el nombre y sale cuando ya no es hoy", async () => {
  const [{ d }] = await t.q(`select privado.dia_local(now(), (select zona_horaria from public.gimnasios where id = $1))::text d`, [t.g]);
  const nac = `1990-${d.slice(5)}`;
  const [{ id: s }] = await t.q(`insert into public.socios (gimnasio_id, nombre, apellido, fecha_nacimiento) values ($1,'Cumple','Hoy',$2) returning id`, [t.g, nac]);
  const item = clave(await hacer(u.ana), "cumpleanos");
  assert.ok(item, "la recepción ve el cumpleaños");
  assert.ok(item.socios.some((x) => x.socio_id === s && /Cumple/.test(x.nombre)), "con el nombre del socio");
  await t.q(`update public.socios set fecha_nacimiento = '1990-01-01' where id = $1 and to_char(now(), 'MM-DD') <> '01-01'`, [s]);
  const queda = clave(await hacer(u.ana), "cumpleanos");
  if (d.slice(5) !== "01-01") assert.equal(queda, undefined, "ya no cumple hoy: sale solo");
});

test("asignación: a una persona la ve ella y el dueño, no su compañera; apagada no la ve nadie", async () => {
  const [{ d }] = await t.q(`select privado.dia_local(now(), (select zona_horaria from public.gimnasios where id = $1))::text d`, [t.g]);
  const [{ id: s }] = await t.q(`insert into public.socios (gimnasio_id, nombre, apellido, fecha_nacimiento) values ($1,'Asignada','Hoy',$2) returning id`, [t.g, `1990-${d.slice(5)}`]);
  assert.ok(s);
  await como(u.dueno, () => t.q(`select public.guardar_tarea_auto($1, 'cumpleanos', true, null, $2, null)`, [t.g, eq.bea]));
  assert.ok(clave(await hacer(u.bea), "cumpleanos"), "Bea, a quien se la asignaron, la ve");
  assert.equal(clave(await hacer(u.ana), "cumpleanos"), undefined, "Ana no");
  assert.ok(clave(await hacer(u.dueno), "cumpleanos"), "el dueño ve todo");
  await como(u.dueno, () => t.q(`select public.guardar_tarea_auto($1, 'cumpleanos', false, null, null, null)`, [t.g]));
  for (const k of ["dueno", "bea", "ana"]) assert.equal(clave(await hacer(u[k]), "cumpleanos"), undefined, `apagada: ${k} no la ve`);
  await como(u.dueno, () => t.q(`select public.guardar_tarea_auto($1, 'cumpleanos', true, null, null, null)`, [t.g]));
  assert.ok(clave(await hacer(u.ana), "cumpleanos"), "prendida de nuevo, vuelve a la recepción");
});

test("permisos: la recepción no configura ni recibe lo de gestión; el profe no entra; los días", async () => {
  await como(u.ana, () => t.falla(() => t.q(`select public.guardar_tarea_auto($1, 'cumpleanos', false, null, null, null)`, [t.g]), /Sin permiso/));
  await como(u.dueno, async () => {
    await t.falla(() => t.q(`select public.guardar_tarea_auto($1, 'stock_bajo', true, 'recepcion', null, null)`, [t.g]), /dueño o encargado/);
    await t.falla(() => t.q(`select public.guardar_tarea_auto($1, 'stock_bajo', true, null, $2, null)`, [t.g, eq.ana]), /dueño o encargado/);
    await t.falla(() => t.q(`select public.guardar_tarea_auto($1, 'cumpleanos', true, null, null, 5)`, [t.g]), /no tiene días/);
    await t.falla(() => t.q(`select public.guardar_tarea_auto($1, 'inventada', true, null, null, null)`, [t.g]), /no existe/);
    await t.q(`select public.guardar_tarea_auto($1, 'vencen_pronto', true, null, null, 7)`, [t.g]);
    const [{ c }] = await t.q(`select public.tareas_auto_config($1) c`, [t.g]);
    assert.equal(c.automaticas.length, 13);
    assert.equal(c.automaticas.find((a) => a.clave === "vencen_pronto").dias_actual, 7);
  });
  await como(u.pablo, async () => {
    await t.falla(() => t.q(`select public.para_hacer_hoy($1)`, [t.g]), /Sin permiso/);
    await t.falla(() => t.q(`select public.checklist_hoy($1)`, [t.g]), /Sin permiso/);
  });
});

test("repetición: al tildar una semanal nace la del lunes que viene, una sola vez", async () => {
  const [{ d }] = await t.q(`select privado.dia_local(now(), (select zona_horaria from public.gimnasios where id = $1))::text d`, [t.g]);
  const id = await como(u.dueno, async () => {
    await t.falla(() => t.q(`select public.crear_tarea($1, 'Limpiar', $2, $3::date, null, 'anual')`, [t.g, eq.ana, d]), /Repetir/);
    return (await t.q(`select public.crear_tarea($1, 'Limpiar los espejos', $2, $3::date, null, 'semanal') id`, [t.g, eq.ana, d]))[0].id;
  });
  await como(u.ana, async () => {
    await t.q(`select public.marcar_tarea($1, true)`, [id]);
    await t.q(`select public.marcar_tarea($1, false)`, [id]);
    await t.q(`select public.marcar_tarea($1, true)`, [id]);
  });
  const sig = await t.q(`select dia::text, repite, para, hecha_en from public.tareas where origen_id = $1`, [id]);
  assert.equal(sig.length, 1, "una sola siguiente");
  assert.equal(sig[0].repite, "semanal");
  assert.equal(sig[0].para, eq.ana);
  assert.equal(sig[0].hecha_en, null);
  const [{ mas }] = await t.q(`select ($1::date + 7)::text mas`, [d]);
  assert.equal(sig[0].dia, mas);
});

test("checklist: el dueño lo arma, la recepción lo tilda por día con su nombre, y se destilda", async () => {
  const item = await como(u.dueno, async () => (await t.q(`select public.guardar_checklist_item($1, 'apertura', 'Prender los aires') id`, [t.g]))[0].id);
  await como(u.dueno, () => t.q(`select public.guardar_checklist_item($1, 'cierre', 'Revisar los baños')`, [t.g]));
  await como(u.ana, () => t.falla(() => t.q(`select public.guardar_checklist_item($1, 'apertura', 'Algo')`, [t.g]), /Sin permiso/));
  await como(u.ana, async () => {
    let l = (await t.q(`select public.checklist_hoy($1) c`, [t.g]))[0].c;
    assert.equal(l.items.length, 2);
    assert.ok(l.items.every((i) => !i.hecho));
    await t.q(`select public.tildar_checklist($1, true)`, [item]);
    l = (await t.q(`select public.checklist_hoy($1) c`, [t.g]))[0].c;
    const i = l.items.find((x) => x.id === item);
    assert.ok(i.hecho && i.hecha_por === "ana");
    await t.q(`select public.tildar_checklist($1, false)`, [item]);
    l = (await t.q(`select public.checklist_hoy($1) c`, [t.g]))[0].c;
    assert.ok(!l.items.find((x) => x.id === item).hecho);
  });
});
