// ADM-1 (0107): al crear un gimnasio, la plantilla del tipo prende el modo de
// clases y lo que cobra, crea actividades y planes de ejemplo SIN precio
// (no se venden hasta que el dueño los pone); solo el admin, solo una vez.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir } from "./_comun.mjs";

let t, admin, dueno;
before(async () => {
  t = await abrir("prueba-plantillas");
  [{ id: admin }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`a${Math.random()}@ejemplo.invalid`]);
  await t.q(`insert into public.administradores_plataforma (usuario_id) values ($1)`, [admin]);
  [{ id: dueno }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`d${Math.random()}@ejemplo.invalid`]);
});
after(async () => t && t.cerrar());
const crear = async (slug) => (await t.q(`select public.admin_crear_gimnasio($1, 'Prueba', 'ejemplo.invalid', 'Dueño') r`, [slug]))[0].r;

test("box: reserva, packs y actividades; planes sin precio", async () => {
  await t.comoUsuario(admin, async () => {
    const [{ r }] = await t.q(`select public.admin_crear_gimnasio($1, 'Box Prueba', 'ejemplo.invalid', 'Dueño') r`, [`box-${Date.now()}`]);
    await t.q(`select public.admin_aplicar_plantilla($1, 'box')`, [r.gimnasio_id]);
    const [c] = await t.q(`select modo_clases, cobra_pack, cobra_membresia from public.configuracion_gimnasio where gimnasio_id = $1`, [r.gimnasio_id]);
    assert.deepEqual([c.modo_clases, c.cobra_pack, c.cobra_membresia], ["reserva", true, true]);
    const planes = await t.q(`select nombre, tipo, consume_en, (select count(*)::int from public.precios_plan pp where pp.plan_id = p.id) precios from public.planes p where gimnasio_id = $1 order by orden`, [r.gimnasio_id]);
    assert.deepEqual(planes.map((p) => [p.nombre, p.tipo, p.precios]), [["Libre mensual", "membresia", 0], ["Pack 8 clases", "pack", 0], ["Pack 12 clases", "pack", 0]]);
    assert.equal(planes[1].consume_en, "asistencia");
    const acts = await t.q(`select nombre from public.actividades where gimnasio_id = $1 order by nombre`, [r.gimnasio_id]);
    assert.deepEqual(acts.map((a) => a.nombre), ["CrossFit", "Funcional"]);
    await t.falla(() => t.q(`select public.admin_aplicar_plantilla($1, 'yoga')`, [r.gimnasio_id]), /ya tiene planes/);
    await t.falla(() => t.q(`select public.admin_aplicar_plantilla($1, 'bowling')`, [r.gimnasio_id]), /desconocido/);
  });
});

test("todas las plantillas se aplican; alguien que no es admin no", async () => {
  const tipos = (await t.q(`select jsonb_object_keys(privado.plantillas_gimnasio()) k`)).map((x) => x.k);
  assert.equal(tipos.length, 8);
  await t.comoUsuario(admin, async () => {
    for (const tipo of tipos) {
      const r = await crear(`p-${tipo.replace(/\W/g, "")}-${Date.now()}`);
      await t.q(`select public.admin_aplicar_plantilla($1, $2)`, [r.gimnasio_id, tipo]);
    }
  });
  await t.comoUsuario(dueno, () => t.falla(() => t.q(`select public.admin_aplicar_plantilla($1, 'box')`, [t.g]), /administradores/));
});

test("ADM-4: salud de cada gimnasio (último acceso del equipo, ventas y entradas de 7 días, sin uso)", async () => {
  const [{ id: u }] = await t.q(`insert into auth.users (email, last_sign_in_at) values ($1, now() - interval '2 days') returning id`, [`e${Math.random()}@ejemplo.invalid`]);
  await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,'Rec','recepcion')`, [t.g, u]);
  await t.q(`update public.gimnasios set creado_en = now() - interval '30 days' where id = $1`, [t.g]);
  const [{ s }] = await t.comoUsuario(admin, () => t.q(`select public.admin_salud_gimnasios() s`));
  const mio = s[t.g];
  assert.ok(mio.ultimo_acceso_equipo, "tiene el último acceso");
  assert.equal(typeof mio.ventas_7_dias, "number");
  await t.comoUsuario(dueno, () => t.falla(() => t.q(`select public.admin_salud_gimnasios()`), /administradores/));
});

test("ADM-6: BRIK publica una novedad, el dueño la ve hasta cerrarla; retirada no se ve; la recepción no", async () => {
  const [{ id: eqDueno }] = await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,'Dueño','dueno') returning id`, [t.g, dueno]);
  void eqDueno;
  const [{ id: rec }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`r${Math.random()}@ejemplo.invalid`]);
  await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,'Rec','recepcion')`, [t.g, rec]);
  await t.db.query("savepoint nov");
  await t.q(`set local role authenticated`);
  await t.q(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: admin, role: "authenticated" })]);
  const [{ id }] = await t.q(`select public.admin_publicar_novedad('MercadoPago', 'Ya podés cobrar online', 'https://ejemplo.invalid/mp') id`);
  await t.falla(() => t.q(`select public.admin_publicar_novedad('x', 'y')`), /3 a 80/);
  await t.q(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: dueno, role: "authenticated" })]);
  await t.falla(() => t.q(`select public.admin_publicar_novedad('Hola dueños', 'Texto largo')`), /administradores/);
  assert.deepEqual((await t.q(`select public.novedades_dueno($1) n`, [t.g]))[0].n.map((x) => x.titulo), ["MercadoPago"]);
  await t.q(`select public.cerrar_novedad_plataforma($1, $2)`, [t.g, id]);
  assert.deepEqual((await t.q(`select public.novedades_dueno($1) n`, [t.g]))[0].n, []);
  await t.q(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: rec, role: "authenticated" })]);
  await t.falla(() => t.q(`select public.novedades_dueno($1)`, [t.g]), /permiso|rol|acceso/i);
  await t.q(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: admin, role: "authenticated" })]);
  const [{ l }] = await t.q(`select public.admin_novedades() l`);
  assert.equal(l[0].cerraron, 1);
  await t.q(`select public.admin_retirar_novedad($1)`, [id]);
  assert.deepEqual((await t.q(`select public.admin_novedades() l`))[0].l, []);
  await t.db.query("rollback to savepoint nov");
});
