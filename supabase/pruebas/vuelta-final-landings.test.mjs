// Vuelta final (22/11) · las dos landings detrás de su llave (migración 20261122100000).
//  - landing_nueva: apagada en un gimnasio real; landing_publica la devuelve; prendida, la devuelve true. Solo el dueño la prende.
//  - landing_venta_nueva: apagada; contacto_plataforma_publico la devuelve; solo el super admin la cambia (dueño, socio y anon: error).
//  - planes de Pase: descripción y módulos, solo el super admin; planes_brik_publicos los devuelve con los límites.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir } from "./_comun.mjs";

const HOST = `vuelta-final-${Math.random().toString(36).slice(2, 8)}.ejemplo.invalid`;
let t, admin, uDueno, uRec;
async function como(usuario, fn, rol = "authenticated") {
  await t.db.query("savepoint c");
  try {
    await t.db.query(`set local role ${rol}`);
    await t.q(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify(usuario ? { sub: usuario, role: rol } : { role: rol })]);
    return await fn();
  } finally { await t.db.query("rollback to savepoint c"); }
}
before(async () => {
  t = await abrir("prueba-vuelta-final");
  await t.q(`insert into public.dominios_gimnasio (gimnasio_id, host, tipo) values ($1, $2, 'subdominio')`, [t.g, HOST]);
  await t.q(`update public.landing_gimnasio set publicada = true where gimnasio_id = $1`, [t.g]);
  [{ id: admin }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`a${Math.random()}@ejemplo.invalid`]);
  await t.q(`insert into public.administradores_plataforma (usuario_id) values ($1)`, [admin]);
  for (const rol of ["dueno", "recepcion"]) {
    const [{ id }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`${rol}${Math.random()}@ejemplo.invalid`]);
    await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,$3,$4)`, [t.g, id, rol, rol]);
    if (rol === "dueno") uDueno = id; else uRec = id;
  }
});
after(async () => t && t.cerrar());
const landing = () => como(null, async () => (await t.q(`select public.landing_publica($1) l`, [HOST]))[0].l, "anon");

test("landing_nueva: apagada en un gimnasio real; prendida por el dueño, la página la ve; la recepción no la puede prender", async () => {
  const l = await landing();
  assert.equal(l.publicada, true);
  assert.equal(l.landing_nueva, false, "apagada por defecto");
  assert.equal(l.tiene_terminos, false, "sin términos publicados");
  await como(uRec, () => t.falla(() => t.q(`select public.cambiar_funcion_nueva($1, 'landing_nueva', true)`, [t.g])));
  await t.q(`insert into public.funciones_nuevas_gimnasio (gimnasio_id, clave, activa, prendida_en, cambiada_en) values ($1, 'landing_nueva', true, now(), now())
             on conflict (gimnasio_id, clave) do update set activa = true`, [t.g]);
  assert.equal((await landing()).landing_nueva, true);
  assert.ok((await t.q(`select privado.funciones_nuevas_catalogo() c`))[0].c.some((x) => x.clave === "landing_nueva"));
});

test("landing_venta_nueva: apagada; solo el super admin la cambia (dueño, recepción y anon dan error)", async () => {
  const pub = async () => (await t.q(`select public.contacto_plataforma_publico() c`))[0].c;
  assert.equal((await pub()).landing_nueva, false);
  await como(uDueno, () => t.falla(() => t.q(`select public.admin_guardar_landing_venta(true)`), /administradores/));
  await como(uRec, () => t.falla(() => t.q(`select public.admin_landing_venta()`), /administradores/));
  await como(null, () => t.falla(() => t.q(`select public.admin_guardar_landing_venta(true)`), /permission denied|permiso/), "anon");
  await como(admin, async () => {
    assert.equal((await t.q(`select public.admin_guardar_landing_venta(true) v`))[0].v, true);
    assert.equal((await t.q(`select public.admin_landing_venta() v`))[0].v, true);
    assert.equal((await pub()).landing_nueva, true);
    await t.q(`select public.admin_guardar_landing_venta(false)`);
    assert.equal((await pub()).landing_nueva, false);
  });
});

test("planes de Pase: descripción y módulos solo del super admin; la página pública los ve con los límites", async () => {
  const [{ id: plan }] = await como(admin, () => t.q(`select public.admin_guardar_plan_brik(null, 'Barrio', 45000) id`));
  const [{ id }] = await t.q(`insert into public.plataforma_planes (nombre, precio_mensual, max_socios) values ('Barrio prueba', 45000, 300) returning id`);
  await como(uDueno, () => t.falla(() => t.q(`select public.admin_guardar_detalle_plan_brik($1, 'x', '{a}')`, [id]), /administradores/));
  // El como() revierte al salir: la escritura y la lectura van dentro de la misma vuelta.
  const publicos = await como(admin, async () => {
    await t.q(`select public.admin_guardar_detalle_plan_brik($1, $2, $3)`, [id, "Para arrancar", ["Recepción", "App del socio", " Recepción ", ""]]);
    await t.falla(() => t.q(`select public.admin_guardar_detalle_plan_brik($1, $2, null)`, [id, "x".repeat(201)]), /200/);
    await t.falla(() => t.q(`select public.admin_guardar_detalle_plan_brik(gen_random_uuid(), null, null)`), /no existe/);
    const lista = (await t.q(`select public.admin_planes_con_limites() l`))[0].l;
    assert.equal(lista.find((x) => x.id === id)?.descripcion, "Para arrancar", "el super admin ve la descripción en su lista");
    return (await t.q(`select public.planes_brik_publicos() p`))[0].p;
  });
  const p = publicos.find((x) => x.nombre === "Barrio prueba");
  assert.equal(p.descripcion, "Para arrancar");
  assert.deepEqual([...p.modulos].sort(), ["App del socio", "Recepción"]);
  assert.equal(p.max_socios, 300);
  assert.ok(plan);
});
