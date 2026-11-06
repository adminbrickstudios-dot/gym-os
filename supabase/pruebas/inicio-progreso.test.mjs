// VD-23 (2300): el progreso del inicio sale de los ingresos (semana, meta, hito, "entraste")
// y la bienvenida de la primera vez se marca una sola vez y solo por el socio.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir } from "./_comun.mjs";

let t, socio, uSocio, uOtro;
before(async () => {
  t = await abrir("prueba-progreso");
  [{ id: uSocio }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`socio${Math.random()}@ejemplo.invalid`]);
  [{ id: uOtro }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`otro${Math.random()}@ejemplo.invalid`]);
  [{ id: socio }] = await t.q(`insert into public.socios (gimnasio_id, nombre, apellido, usuario_id) values ($1,'Progreso','Prueba',$2) returning id`, [t.g, uSocio]);
});
after(async () => t && t.cerrar());

// Un error dentro de la transacción de prueba la aborta: cada llamada va en su savepoint, y si falla se vuelve atrás.
const como = async (usuario, fn) => {
  await t.db.query("savepoint c");
  await t.db.query("set role authenticated");
  await t.q(`select set_config('request.jwt.claims', $1, false)`, [JSON.stringify({ sub: usuario, role: "authenticated" })]);
  try {
    const r = await fn();
    await t.db.query("reset role"); await t.q(`select set_config('request.jwt.claims', '', false)`);
    await t.db.query("release savepoint c");
    return r;
  } catch (e) {
    await t.db.query("rollback to savepoint c");
    await t.db.query("reset role");
    throw e;
  }
};
const progreso = () => como(uSocio, async () => (await t.q(`select public.progreso_inicio($1) as r`, [socio]))[0].r);
const entrar = (minutosAtras, resultado = "entro") => t.q(`insert into public.ingresos (gimnasio_id, sede_id, socio_id, momento, via_acceso, resultado, via_habilitante, color, motivo, texto)
  values ($1,$2,$3, now() - make_interval(mins => $4), 'recepcion', $5, 'membresia', 'verde', 'al_dia', 'x')`, [t.g, t.sede, socio, minutosAtras, resultado]);

test("socio nuevo: sin entradas, siete días en la semana, meta del gimnasio, bienvenida pendiente", async () => {
  const p = await progreso();
  assert.equal(p.semana.length, 7);
  assert.equal(p.semana.filter((d) => d.hoy).length, 1);
  assert.equal(p.entradas_mes, 0);
  assert.equal(p.total_entradas, 0);
  assert.equal(p.entro_hoy, null);
  assert.equal(p.hito, null);
  assert.equal(p.meta_mes, 12);
  assert.equal(p.bienvenida_pendiente, true);
});

test("la meta es dato del gimnasio: si cambia, el inicio la sigue", async () => {
  await t.q(`update public.configuracion_gimnasio set meta_visitas_mes = 8 where gimnasio_id = $1`, [t.g]);
  assert.equal((await progreso()).meta_mes, 8);
});

test("entrar hoy: aparece 'entró hoy' y el día marcado; un rechazado no cuenta", async () => {
  await entrar(1, "rechazado");
  assert.equal((await progreso()).entro_hoy, null);
  await entrar(2);
  const p = await progreso();
  assert.ok(p.entro_hoy);
  assert.equal(p.total_entradas, 1);
  assert.equal(p.semana.find((d) => d.hoy).vino, true);
});

test("la décima entrada es un hito; la undécima ya no", async () => {
  for (let i = 0; i < 8; i++) await entrar(3 + i);
  assert.equal((await progreso()).total_entradas, 9);
  assert.equal((await progreso()).hito, null);
  await entrar(0);
  const p = await progreso();
  assert.equal(p.total_entradas, 10);
  assert.equal(p.hito, 10);
  await entrar(0);
  assert.equal((await progreso()).hito, null);
});

test("la bienvenida se marca una vez, solo la marca el socio, y ya no vuelve", async () => {
  await assert.rejects(() => como(uOtro, () => t.q(`select public.marcar_bienvenida($1)`, [socio])), /Sin permiso/);
  assert.equal((await progreso()).bienvenida_pendiente, true);
  await como(uSocio, () => t.q(`select public.marcar_bienvenida($1)`, [socio]));
  const [{ v1 }] = await t.q(`select bienvenida_vista_en v1 from public.socios where id = $1`, [socio]);
  assert.ok(v1);
  await como(uSocio, () => t.q(`select public.marcar_bienvenida($1)`, [socio]));
  const [{ v2 }] = await t.q(`select bienvenida_vista_en v2 from public.socios where id = $1`, [socio]);
  assert.equal(String(v2), String(v1), "marcarla otra vez no cambia la fecha");
  assert.equal((await progreso()).bienvenida_pendiente, false);
});

test("quien no es el socio ni del equipo no ve su progreso: error, no ceros", async () => {
  await assert.rejects(() => como(uOtro, () => t.q(`select public.progreso_inicio($1)`, [socio])), /permiso|Sin acceso|42501/i);
});
