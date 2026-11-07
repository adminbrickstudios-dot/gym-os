// VD-43 (6500): los primeros pasos se tachan solos y los datos de ejemplo se cargan y se borran sin tocar lo real.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir } from "./_comun.mjs";

let t, uDueno, uEnc;
before(async () => {
  t = await abrir("prueba-onboarding");
  for (const [rol, nombre] of [["dueno", "Dueña Onb"], ["encargado", "Beto Onb"]]) {
    const [{ id }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`${rol}${Math.random()}@ejemplo.invalid`]);
    await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,$3,$4)`, [t.g, id, nombre, rol]);
    if (rol === "dueno") uDueno = id; else uEnc = id;
  }
});
after(async () => t && t.cerrar());
async function como(u, fn) {
  await t.db.query("set role authenticated");
  await t.q(`select set_config('request.jwt.claims', $1, false)`, [JSON.stringify({ sub: u, role: "authenticated" })]);
  try { return await fn(); } finally { await t.db.query("reset role"); await t.q(`select set_config('request.jwt.claims', '', false)`); }
}
const pasos = async () => (await t.q(`select public.primeros_pasos($1) as p`, [t.g]))[0].p;
const hecho = (p, k) => p.pasos.find((x) => x.clave === k).hecho;
const socios = async (ejemplo) => Number((await t.q(`select count(*) n from public.socios where gimnasio_id = $1 and es_ejemplo = $2`, [t.g, ejemplo]))[0].n);

test("el paso de la entrada se tacha solo cuando hubo una entrada de un socio real", async () => {
  await como(uDueno, async () => {
    const p = await pasos();
    assert.equal(p.total, 9);
    assert.ok(p.pasos.some((x) => x.clave === "entrada"));
  });
  const [{ n }] = await t.q(`select count(*)::int n from public.ingresos where gimnasio_id = $1`, [t.g]);
  const antes = await como(uDueno, async () => hecho(await pasos(), "entrada"));
  assert.equal(antes, n > 0, "se calcula de las entradas reales, no se guarda");
});

test("cargar los ejemplos no tacha 'Tus socios' y no toca los socios reales", async () => {
  const reales = await socios(false);
  assert.ok(reales > 0);
  await como(uEnc, () => t.falla(() => t.q(`select public.cargar_socios_ejemplo($1)`, [t.g]), /Sin permiso/));
  await como(uDueno, async () => {
    const [{ r }] = await t.q(`select public.cargar_socios_ejemplo($1) as r`, [t.g]);
    assert.equal(r.cargados, 10);
    assert.equal((await t.q(`select public.datos_ejemplo($1) as r`, [t.g]))[0].r.cargados, 10);
    await t.falla(() => t.q(`select public.cargar_socios_ejemplo($1)`, [t.g]), /Ya hay datos de ejemplo/);
  });
  assert.equal(await socios(true), 10);
  assert.equal(await socios(false), reales, "los reales siguen igual");
  const ej = await t.q(`select telefono, email from public.socios where gimnasio_id = $1 and es_ejemplo`, [t.g]);
  assert.ok(ej.every((s) => s.telefono.startsWith("+549000") && s.email.endsWith("@ejemplo.invalid")), "teléfonos 000 y mails .invalid");
  const [{ con_cobertura }] = await t.q(`select count(*)::int con_cobertura from public.coberturas c join public.socios s on s.id = c.socio_id where s.es_ejemplo and s.gimnasio_id = $1`, [t.g]);
  assert.ok(con_cobertura >= 1, "con un plan de membresía, los ejemplos traen distintos estados de cobertura");
});

test("con solo ejemplos, el paso de socios sigue pendiente", async () => {
  // Gimnasio aparte, vacío de socios reales.
  const [{ id: g2 }] = await t.q(`insert into public.gimnasios (slug, nombre) values ('onb-vacio', 'Vacío') returning id`);
  const [{ id: u }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`dueno${Math.random()}@ejemplo.invalid`]);
  await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,'Dueño Vacío','dueno')`, [g2, u]);
  await como(u, async () => {
    assert.equal(hecho((await t.q(`select public.primeros_pasos($1) as p`, [g2]))[0].p, "socios"), false);
    const [{ r }] = await t.q(`select public.cargar_socios_ejemplo($1) as r`, [g2]);
    assert.equal(r.cargados, 10);
    assert.equal(hecho((await t.q(`select public.primeros_pasos($1) as p`, [g2]))[0].p, "socios"), false, "los ejemplos no cuentan");
  });
  await t.q(`insert into public.socios (gimnasio_id, nombre, apellido) values ($1, 'Real', 'Persona')`, [g2]);
  await como(u, async () => assert.equal(hecho((await t.q(`select public.primeros_pasos($1) as p`, [g2]))[0].p, "socios"), true, "un socio real sí lo tacha"));
});

test("borrar los ejemplos: se van ellos, con su plan y cobertura, y solo ellos", async () => {
  const reales = await socios(false);
  const [{ n: sus0 }] = await t.q(`select count(*)::int n from public.suscripciones where gimnasio_id = $1`, [t.g]);
  const [{ n: sus_ej }] = await t.q(`select count(*)::int n from public.suscripciones su join public.socios s on s.id = su.socio_id where s.es_ejemplo and s.gimnasio_id = $1`, [t.g]);
  await como(uEnc, () => t.falla(() => t.q(`select public.borrar_socios_ejemplo($1)`, [t.g]), /Sin permiso/));
  await como(uDueno, async () => {
    const [{ r }] = await t.q(`select public.borrar_socios_ejemplo($1) as r`, [t.g]);
    assert.equal(r.borrados, 10);
    assert.equal(r.quedaron, 0);
    await t.falla(() => t.q(`select public.borrar_socios_ejemplo($1)`, [t.g]), /No hay datos de ejemplo/);
  });
  assert.equal(await socios(true), 0);
  assert.equal(await socios(false), reales, "los socios reales no se tocaron");
  const [{ n: sus1 }] = await t.q(`select count(*)::int n from public.suscripciones where gimnasio_id = $1`, [t.g]);
  assert.equal(sus1, sus0 - sus_ej, "solo se fueron las suscripciones de los ejemplos");
  // Se pueden volver a cargar.
  await como(uDueno, async () => assert.equal((await t.q(`select public.cargar_socios_ejemplo($1) as r`, [t.g]))[0].r.cargados, 10));
});

test("un ejemplo con un movimiento real (una entrada) se queda y se avisa; los demás se van", async () => {
  const [ej] = await t.q(`select id from public.socios where gimnasio_id = $1 and es_ejemplo order by numero limit 1`, [t.g]);
  await t.q(`insert into public.ingresos (gimnasio_id, sede_id, socio_id, via_acceso, resultado, color, motivo, texto)
             values ($1,$2,$3,'recepcion','entro','verde','prueba','prueba')`, [t.g, t.sede, ej.id]);
  await como(uDueno, async () => {
    const [{ r }] = await t.q(`select public.borrar_socios_ejemplo($1) as r`, [t.g]);
    assert.equal(r.borrados, 9);
    assert.equal(r.quedaron, 1);
  });
  assert.equal(await socios(true), 1);
  // Y con una entrada de un ejemplo, el paso "Probá la entrada" NO se tacha por eso.
  const [{ n }] = await t.q(`select count(*)::int n from public.ingresos i join public.socios s on s.id = i.socio_id where i.gimnasio_id = $1 and not s.es_ejemplo`, [t.g]);
  await como(uDueno, async () => assert.equal(hecho(await pasos(), "entrada"), n > 0));
});
