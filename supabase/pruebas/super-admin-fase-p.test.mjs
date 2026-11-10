// Carril B · Fase P (P4 a P7): probar acceso, confirmar, activar y desactivar, cambiar rol, mover de gimnasio y la barra de soporte.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir } from "./_comun.mjs";

let t, admin, uLectura, uSoporte, eDueno, eRec, eSinCuenta, uRec, otroG;
async function como(usuario, fn) {
  await t.db.query("set role authenticated");
  await t.q(`select set_config('request.jwt.claims', $1, false)`, [JSON.stringify({ sub: usuario, role: "authenticated" })]);
  try { return await fn(); } catch (e) { console.log("INTERNO", e.message); throw e; } finally { await t.db.query("reset role"); await t.q(`select set_config('request.jwt.claims', '', false)`); }
}
const uno = async (sql, p) => (await t.q(sql, p))[0];
const mk = async (pref, confirmado = true) => (await uno(`insert into auth.users (email, email_confirmed_at) values ($1, ${confirmado ? "now()" : "null"}) returning id, email`, [`${pref}${Math.random().toString().slice(2)}@ejemplo.invalid`]));
const paso = (x, clave) => x.pasos.find((p) => p.clave === clave);

before(async () => {
  t = await abrir("prueba-fase-p");
  admin = (await mk("principal")).id;
  await t.q(`insert into public.administradores_plataforma (usuario_id) values ($1)`, [admin]);
  const l = await mk("lectura"), s = await mk("soporte");
  uLectura = l.id; uSoporte = s.id;
  for (const [u, rol] of [[l, "lectura"], [s, "soporte"]]) await como(admin, () => t.q(`select public.admin_dar_rol_brik($1, $2)`, [u.email, rol]));
  const d = await mk("dueno"); const r = await mk("rec", false);
  uRec = r.id;
  eDueno = (await uno(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,'Dueña','dueno') returning id`, [t.g, d.id])).id;
  eRec = (await uno(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,'Recepción','recepcion') returning id`, [t.g, r.id])).id;
  eSinCuenta = (await uno(`insert into public.equipo (gimnasio_id, nombre, rol) values ($1,'Profe sin cuenta','profe') returning id`, [t.g])).id;
  otroG = (await uno(`insert into public.gimnasios (slug, nombre) values ('fase-p-otro', 'Otro Gimnasio') returning id`)).id;
});
after(async () => t && t.cerrar());

test("P6 probar acceso: cada paso en verde, amarillo o rojo, con su arreglo", async () => {
  await como(uLectura, async () => {
    const dueno = (await uno(`select public.admin_probar_acceso($1) x`, [eDueno])).x;
    assert.equal(dueno.ok, true);
    assert.equal(paso(dueno, "cuenta").estado, "ok"); assert.equal(paso(dueno, "confirmado").estado, "ok"); assert.equal(paso(dueno, "activo").estado, "ok");
    assert.equal(paso(dueno, "ingreso").estado, "aviso", "todavía no entró: amarillo, no rojo");
    const rec = (await uno(`select public.admin_probar_acceso($1) x`, [eRec])).x;
    assert.equal(rec.ok, false);
    assert.equal(paso(rec, "confirmado").estado, "falta"); assert.equal(paso(rec, "confirmado").arreglo, "confirmar");
    const sin = (await uno(`select public.admin_probar_acceso($1) x`, [eSinCuenta])).x;
    assert.equal(paso(sin, "cuenta").estado, "falta"); assert.equal(paso(sin, "cuenta").arreglo, "dar_acceso");
    assert.equal(paso(sin, "rol").detalle.includes("profe"), true);
    await t.falla(() => t.q(`select public.admin_confirmar_cuenta($1)`, [eRec]), /no puede hacer esto/);
  });
  await como(uSoporte, async () => {
    await t.falla(() => t.q(`select public.admin_confirmar_cuenta($1)`, [eSinCuenta]), /primero dale acceso/);
    await t.q(`select public.admin_confirmar_cuenta($1)`, [eRec]);
    const rec = (await uno(`select public.admin_probar_acceso($1) x`, [eRec])).x;
    assert.equal(rec.ok, true, "después de Arreglar queda en verde");
  });
});

test("P4 probar el gimnasio nuevo: lo que tiene que existir y la prueba de cada dueño", async () => {
  await como(admin, async () => {
    const g = (await uno(`select public.admin_probar_acceso_gimnasio($1) x`, [t.g])).x;
    assert.ok(g.pasos.length >= 6); assert.equal(paso(g, "dueno").estado, "ok"); assert.equal(paso(g, "landing").estado, "ok");
    assert.equal(g.duenos.length, 1); assert.equal(g.duenos[0].equipo_id, eDueno);
  });
  await t.q(`delete from public.dominios_gimnasio where gimnasio_id = $1`, [t.g]);
  await como(admin, async () => {
    const sinDir = (await uno(`select public.admin_probar_acceso_gimnasio($1) x`, [t.g])).x;
    assert.equal(paso(sinDir, "direccion").estado, "falta"); assert.equal(sinDir.ok, false);
  });
});

test("P7 desactivar, activar y cambiar rol: nunca sin dueño", async () => {
  await como(admin, async () => {
    await t.falla(() => t.q(`select public.admin_estado_persona($1, false)`, [eDueno]), /único dueño/);
    await t.falla(() => t.q(`select public.admin_cambiar_rol_persona($1, 'recepcion')`, [eDueno]), /único dueño/);
    await t.q(`select public.admin_estado_persona($1, false)`, [eRec]);
    assert.equal(paso((await uno(`select public.admin_probar_acceso($1) x`, [eRec])).x, "activo").arreglo, "activar");
    await t.falla(() => t.q(`select public.admin_estado_persona($1, false)`, [eRec]), /Ya estaba/);
    await t.q(`select public.admin_estado_persona($1, true)`, [eRec]);
    await t.falla(() => t.q(`select public.admin_cambiar_rol_persona($1, 'inventado')`, [eRec]), /Rol:/);
    await t.q(`select public.admin_cambiar_rol_persona($1, 'encargado')`, [eRec]);
    assert.equal((await uno(`select rol from public.equipo where id = $1`, [eRec])).rol, "encargado");
    await t.falla(() => t.q(`select public.admin_cambiar_rol_persona($1, 'encargado')`, [eRec]), /Ya tiene ese rol/);
  });
  await como(uLectura, () => t.falla(() => t.q(`select public.admin_estado_persona($1, false)`, [eRec]), /no puede hacer esto/));
});

test("P7 mover de gimnasio: la misma cuenta, historial en el origen, y solo el principal", async () => {
  await como(uSoporte, () => t.falla(() => t.q(`select public.admin_mover_persona($1, $2)`, [eRec, otroG]), /no puede hacer esto/));
  await como(admin, async () => {
    await t.falla(() => t.q(`select public.admin_mover_persona($1, $2)`, [eRec, t.g]), /Ya está en ese gimnasio/);
    await t.falla(() => t.q(`select public.admin_mover_persona($1, $2)`, [eDueno, otroG]), /único dueño/);
    const nuevo = (await uno(`select public.admin_mover_persona($1, $2, 'recepcion') n`, [eRec, otroG])).n;
    const n = await uno(`select gimnasio_id, usuario_id, rol, activo from public.equipo where id = $1`, [nuevo]);
    assert.equal(n.gimnasio_id, otroG); assert.equal(n.usuario_id, uRec); assert.equal(n.rol, "recepcion"); assert.equal(n.activo, true);
    assert.equal((await uno(`select activo from public.equipo where id = $1`, [eRec])).activo, false, "queda desactivada en el origen");
    // Volver a moverla al origen reactiva la fila vieja (no choca con el índice único)
    const vuelta = (await uno(`select public.admin_mover_persona($1, $2) n`, [nuevo, t.g])).n;
    assert.equal(vuelta, eRec);
    assert.equal((await uno(`select activo from public.equipo where id = $1`, [eRec])).activo, true);
  });
  const reg = await t.q(`select accion from public.registro_brik where accion in ('mover_persona','recibir_persona','desactivar_persona','activar_persona','cambiar_rol_persona','confirmar_cuenta')`);
  assert.ok(reg.length >= 8);
});

test("P7 la barra de soporte sabe con qué rol entró BRIK", async () => {
  await como(admin, async () => {
    await t.q(`select public.admin_entrar_gimnasio($1, 'Ver como la recepción', 'recepcion')`, [t.g]);
    const s = (await uno(`select public.estado_soporte($1) x`, [t.g])).x;
    assert.equal(s.activo, true); assert.equal(s.rol, "recepcion"); assert.equal(s.motivo, "Ver como la recepción");
  });
});
