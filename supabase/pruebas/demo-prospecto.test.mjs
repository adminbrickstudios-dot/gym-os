// Cierre para vender (25/11, migración 20261125120000): la demo para un prospecto. Pasa por el alta única, queda [demo] en Pista con
// Semáforo, con los datos de ejemplo (000 y @ejemplo.invalid), un precio de ejemplo y su dirección; vence a los 14 días (calculado).
// Permisos en negativo: un dueño, la cuenta "lectura" de BRIK y alguien sin sesión reciben error. El logo solo se pone en una demo.
// Caracterización: cargar_socios_ejemplo del dueño sigue igual.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir } from "./_comun.mjs";

let t, admin, lectura, dueno;
const uno = async (sql, p) => (await t.q(sql, p))[0];
const usuario = async () => (await uno(`insert into auth.users (email) values ($1) returning id`, [`u${Math.random()}@ejemplo.invalid`])).id;
before(async () => {
  t = await abrir("prueba-demo-prospecto");
  admin = await usuario(); lectura = await usuario(); dueno = await usuario();
  await t.q(`insert into public.administradores_plataforma (usuario_id) values ($1)`, [admin]);
  await t.q(`insert into public.administradores_plataforma (usuario_id, rol) values ($1, 'lectura')`, [lectura]);
  await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,'Dueno','dueno')`, [t.g, dueno]);
});
after(async () => t && t.cerrar());

test("la demo para un prospecto: su nombre, su color, Pista con Semáforo, datos de ejemplo ficticios, un precio y 14 días", async () => {
  await t.comoUsuario(admin, async () => {
    const [{ r }] = await t.q(`select public.admin_crear_demo_prospecto('Olimpo Gym Prueba', 'ejemplo.invalid', '#e11d48', '#0e151c') r`);
    assert.match(r.slug, /^demo-olimpo-gym-prueba-[0-9a-f]{4}$/);
    const lista = (await t.q(`select public.admin_demos_prospectos() l`))[0].l;
    const fila = lista.find((x) => x.gimnasio_id === r.gimnasio_id);
    assert.ok(fila, "no está en la lista de prospectos");
    assert.equal(fila.vencida, false);
    assert.ok(fila.dias === 14 || fila.dias === 13, `vence en ${fila.dias} días`);
    assert.ok(fila.host?.startsWith(r.slug), `la dirección es ${fila.host}`);
    await t.db.query("reset role");
    const [g] = await t.q(`select g.nombre, g.es_demo, g.origen, g.demo_para, c.estilo, c.color_acento,
        (select f.activa from public.funciones_nuevas_gimnasio f where f.gimnasio_id = g.id and f.clave = 'pista_semaforo') semaforo
        from public.gimnasios g join public.configuracion_gimnasio c on c.gimnasio_id = g.id where g.id = $1`, [r.gimnasio_id]);
    assert.deepEqual([g.nombre, g.es_demo, g.origen, g.demo_para, g.estilo, g.color_acento, g.semaforo], ["Olimpo Gym Prueba", true, "demo_prospecto", "Olimpo Gym Prueba", "pista", "#e11d48", true]);
    const socios = await t.q(`select telefono, email from public.socios where gimnasio_id = $1`, [r.gimnasio_id]);
    assert.equal(socios.length, 10);
    assert.ok(socios.every((s) => s.telefono.startsWith("+549000") && s.email.endsWith("@ejemplo.invalid")), "un socio de ejemplo con datos que parecen reales");
    const [{ n }] = await t.q(`select count(*)::int n from public.precios_plan where gimnasio_id = $1`, [r.gimnasio_id]);
    assert.ok(n > 0, "sin precio de ejemplo");
    // La demo vencida se calcula: corrida la fecha, la lista la dice vencida (sin cron).
    await t.q(`update public.gimnasios set demo_hasta = now() - interval '1 minute' where id = $1`, [r.gimnasio_id]);
  });
});

test("el logo desde /super solo se pone en una demo; en un gimnasio real es error", async () => {
  await t.comoUsuario(admin, async () => {
    const [{ r }] = await t.q(`select public.admin_crear_demo_prospecto('Logo Prueba', 'ejemplo.invalid') r`);
    const [{ ruta }] = await t.q(`select public.admin_preparar_logo_demo($1, 'image/png', 1000) ruta`, [r.gimnasio_id]);
    assert.match(ruta, new RegExp(`^${r.gimnasio_id}/.+/logo-[0-9a-f]{32}\\.png$`));
    await t.q(`select public.admin_confirmar_logo_demo($1, $2)`, [r.gimnasio_id, ruta]);
    await t.falla(() => t.q(`select public.admin_confirmar_logo_demo($1, $2)`, [r.gimnasio_id, `${t.g}/x/logo-${"0".repeat(32)}.png`]), /no es de este gimnasio/);
    await t.falla(() => t.q(`select public.admin_preparar_logo_demo($1, 'image/png', 1000)`, [t.g]), /solo para una demo/);
    await t.falla(() => t.q(`select public.admin_preparar_logo_demo($1, 'application/pdf', 1000)`, [r.gimnasio_id]), /PNG, JPG, SVG o WEBP/);
  });
});

test("un dueño, la cuenta de lectura de BRIK y alguien sin sesión no crean demos (error, no un vacío)", async () => {
  await t.comoUsuario(dueno, () => t.falla(() => t.q(`select public.admin_crear_demo_prospecto('X Gym', 'ejemplo.invalid')`)));
  await t.comoUsuario(dueno, () => t.falla(() => t.q(`select public.admin_demos_prospectos()`)));
  await t.comoUsuario(lectura, () => t.falla(() => t.q(`select public.admin_crear_demo_prospecto('X Gym', 'ejemplo.invalid')`)));
  await t.comoUsuario(admin, () => t.falla(() => t.q(`select public.admin_crear_demo_prospecto('X', 'ejemplo.invalid')`), /de 2 a 60 letras/));
  await t.db.query("savepoint a"); await t.db.query("set local role anon");
  await assert.rejects(() => t.q(`select public.admin_demos_prospectos()`));
  await t.db.query("rollback to savepoint a");
});

test("caracterización: el dueño carga sus socios de ejemplo igual que antes, y otro rol no", async () => {
  await t.comoUsuario(dueno, async () => {
    const [{ r }] = await t.q(`select public.cargar_socios_ejemplo($1) r`, [t.g]);
    assert.equal(r.cargados, 10);
    await t.falla(() => t.q(`select public.cargar_socios_ejemplo($1)`, [t.g]), /Ya hay datos de ejemplo/);
  });
  const [{ id: recep }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`r${Math.random()}@ejemplo.invalid`]);
  await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,'Recep','recepcion')`, [t.g, recep]);
  await t.comoUsuario(recep, () => t.falla(() => t.q(`select public.cargar_socios_ejemplo($1)`, [t.g])));
});
