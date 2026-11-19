// Paneles completos (19/11) · migración 20261119120000:
//  1) clases_del_dia devuelve profe_id al equipo (el panel decide "clase ajena" por id) y null al socio.
//  2) Aviso "te quedan N días" en avisos_app_socio: apagado por defecto (llave aviso_vencimiento); prendido, solo a 3 días o menos, con momento fijo.
//  En negativo: otro gimnasio y un rol sin permiso dan error, nunca una lista vacía.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir, HOY } from "./_comun.mjs";

let t, u = {}, profeA, profeB, B, socioU, otroU, clase;
const S = () => t.ctx.socios;

before(async () => {
  t = await abrir("prueba-profe-id");
  for (const [clave, rol, nombre] of [["dueno", "dueno", "Dueno"], ["recepcion", "recepcion", "Rita"], ["profeA", "profe", "Ana Profe"], ["profeB", "profe", "Ana Profe"]]) {
    const [{ id }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`${clave}${Math.random()}@ejemplo.invalid`]);
    const [{ id: eid }] = await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,$3,$4) returning id`, [t.g, id, nombre, rol]);
    u[clave] = id;
    if (clave === "profeA") profeA = eid;
    if (clave === "profeB") profeB = eid;
  }
  // Dos profes con el MISMO nombre: el caso que el nombre no distinguía.
  const [{ id: act }] = await t.q(`insert into public.actividades (gimnasio_id, nombre) values ($1,'Funcional') returning id`, [t.g]);
  const m = await t.en(HOY, "10:00:00");
  [{ id: clase }] = await t.q(`insert into public.clases (gimnasio_id, sede_id, actividad_id, inicio, fin, profe_id, cupo) values ($1,$2,$3,$4::timestamptz,$4::timestamptz + interval '1 hour',$5,10) returning id`, [t.g, t.sede, act, m, profeA]);
  [{ id: socioU }] = await t.q(`insert into auth.users (phone) values ('+549000078200001') returning id`);
  [{ id: otroU }] = await t.q(`insert into auth.users (phone) values ('+549000078200002') returning id`);
  await t.q(`update public.socios set usuario_id = $2 where id = $1`, [S().al_dia, socioU]);
  // Un gimnasio ajeno con un dueño.
  const [{ id: gB }] = await t.q(`insert into public.gimnasios (slug, nombre) values ('prueba-profe-id-b', 'Gimnasio B') returning id`);
  const [{ id: dB }] = await t.q(`insert into auth.users (email) values ('duenob@ejemplo.invalid') returning id`);
  await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,'Dueno B','dueno')`, [gB, dB]);
  B = { g: gB, dueno: dB };
});
after(async () => t && t.cerrar());

const clases = () => t.q(`select * from public.clases_del_dia($1, $2::date)`, [t.sede, HOY]);

test("el equipo recibe profe_id y dos profes con el mismo nombre se distinguen por id", async () => {
  for (const quien of ["profeB", "profeA", "dueno", "recepcion"]) {
    await t.comoUsuario(u[quien], async () => {
      const c = (await clases()).find((x) => x.clase_id === clase);
      assert.ok(c, `${quien} ve la clase`);
      assert.equal(c.profe_id, profeA, `${quien}: profe_id es el de la clase`);
      assert.equal(c.profe, "Ana Profe");
    });
  }
  assert.notEqual(profeA, profeB);
});

test("el socio no recibe el profe_id (null)", async () => {
  await t.comoUsuario(socioU, async () => {
    const [c] = await t.q(`select * from public.clases_del_dia($1, $2::date, $3)`, [t.sede, HOY, S().al_dia]);
    assert.ok(c, "el socio ve la clase");
    assert.equal(c.profe_id, null);
  });
});

test("en negativo: el dueño de otro gimnasio y un socio ajeno dan error, no una lista vacía", async () => {
  await t.comoUsuario(B.dueno, async () => { await t.falla(() => clases(), /Sin permiso/); });
  await t.comoUsuario(otroU, async () => { await t.falla(() => clases(), /Sin permiso/); });
});

test("aviso de vencimiento: apagado por defecto, no avisa aunque falten 2 días", async () => {
  await t.q(`update public.socios set cubierto_hasta = $2::timestamptz + interval '2 days' where id = $1`, [S().al_dia, await t.en(HOY, "12:00:00")]);
  const m = await t.en(HOY, "12:00:00");
  await t.comoUsuario(socioU, async () => {
    const a = (await t.q(`select public.avisos_app_socio($1, $2) a`, [S().al_dia, m]))[0].a;
    assert.deepEqual(a.filter((x) => x.tipo === "vence_pronto"), []);
  });
});

test("prendida la llave: avisa a 3 días o menos con su texto, y no a 5", async () => {
  await t.q(`insert into public.funciones_nuevas_gimnasio (gimnasio_id, clave, activa, prendida_en) values ($1,'aviso_vencimiento',true,now())`, [t.g]);
  const m = await t.en(HOY, "12:00:00");
  const aviso = async (dias) => {
    await t.q(`update public.socios set cubierto_hasta = $2::timestamptz + ($3 || ' days')::interval where id = $1`, [S().al_dia, m, String(dias)]);
    return t.comoUsuario(socioU, async () => (await t.q(`select public.avisos_app_socio($1, $2) a`, [S().al_dia, m]))[0].a.filter((x) => x.tipo === "vence_pronto"));
  };
  const a2 = await aviso(2);
  assert.equal(a2.length, 1);
  assert.equal(a2[0].texto, "Te quedan 2 días de cuota.");
  assert.equal((await aviso(1))[0].texto, "Te queda 1 día de cuota.");
  assert.deepEqual(await aviso(5), []);
});

test("el aviso es solo del propio socio: otro socio y otro usuario dan error", async () => {
  const m = await t.en(HOY, "12:00:00");
  await t.comoUsuario(otroU, async () => { await t.falla(() => t.q(`select public.avisos_app_socio($1, $2)`, [S().al_dia, m]), /Sin permiso/); });
  await t.comoUsuario(B.dueno, async () => { await t.falla(() => t.q(`select public.avisos_app_socio($1, $2)`, [S().al_dia, m]), /Sin permiso/); });
});
