// VD-46D · Aumento con aviso previo y constancia por socio (0074):
// con menos de 30 días no pasa; el encargado no puede saltearlo; el dueño sí, con motivo
// (queda registrado); cada socio activo recibe su aviso una sola vez, lo ve solo él y lo marca leído;
// el mínimo es configurable solo por el dueño.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir } from "./_comun.mjs";

let t, u = {}, plan, otro, s1, s2, sBaja, sOtroPlan, uSocio, uAjeno;
before(async () => {
  t = await abrir("prueba-aumento-aviso");
  const usuario = async () => (await t.q(`insert into auth.users (email) values ($1) returning id`, [`u${Math.random()}@ejemplo.invalid`]))[0].id;
  for (const r of ["dueno", "encargado", "recepcion"]) {
    u[r] = await usuario();
    await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,$3,$4)`, [t.g, u[r], r, r]);
  }
  const mk = async (n) => (await t.q(`insert into public.planes (gimnasio_id, tipo, nombre, duracion_meses, renovacion) values ($1,'membresia',$2,1,'continua') returning id`, [t.g, n]))[0].id;
  plan = await mk("Mensual aviso"); otro = await mk("Otro aviso");
  await t.q(`insert into public.precios_plan (gimnasio_id, plan_id, monto, vigente_desde) values ($1,$2,30000, now() - interval '9 days'), ($1,$3,10000, now() - interval '9 days')`, [t.g, plan, otro]);
  const socio = async (n, p, baja = false) => {
    const [{ id }] = await t.q(`insert into public.socios (gimnasio_id, nombre, apellido) values ($1,$2,'Aviso') returning id`, [t.g, n]);
    await t.q(`insert into public.suscripciones (gimnasio_id, socio_id, plan_id, inicio) values ($1,$2,$3, now() - interval '20 days')`, [t.g, id, p]);
    if (baja) await t.q(`update public.socios set dado_de_baja_en = now(), motivo_baja = 'otro' where id = $1`, [id]);
    return id;
  };
  s1 = await socio("Uno", plan); s2 = await socio("Dos", plan); sBaja = await socio("Baja", plan, true); sOtroPlan = await socio("Otro", otro);
  uSocio = await usuario(); uAjeno = await usuario();
  await t.q(`update public.socios set usuario_id = $2 where id = $1`, [s1, uSocio]);
  await t.q(`update public.socios set usuario_id = $2 where id = $1`, [s2, uAjeno]);
});
after(async () => t && t.cerrar());
async function como(sub, fn) {
  await t.q(`set local role authenticated`);
  await t.q(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub, role: "authenticated" })]);
  try { return await fn(); } finally { await t.q(`reset role`).catch(() => {}); }
}
const dia = async (mas) => (await t.q(`select (privado.dia_local(now(), $1) + $2::int)::text as d`, [t.ctx.zona, mas]))[0].d;
const aplicar = (planes, desde, motivo = null) => t.q(`select public.aplicar_aumento($1, $2, 'porcentaje', 10, 100, $3::date, $4) as n`, [t.g, planes, desde, motivo]);

test("con menos de 30 días no pasa: ni el encargado ni el dueño sin motivo", async () => {
  const d10 = await dia(10);
  await como(u.encargado, async () => {
    await t.falla(() => aplicar([plan], d10), /Hace falta avisar con 30 días/);
    await t.falla(() => aplicar([plan], d10, "es urgente, de verdad"), /Hace falta avisar con 30 días/);
  });
  await como(u.dueno, async () => {
    await t.falla(() => aplicar([plan], d10), /escribas el motivo/);
    await t.falla(() => aplicar([plan], d10, "corto"), /escribas el motivo/);
    await t.falla(() => aplicar([plan], null, "  "), /escribas el motivo/);
  });
  const [{ c }] = await t.q(`select count(*)::int as c from public.aumentos_precio where gimnasio_id = $1`, [t.g]);
  assert.equal(c, 0);
});

test("aviso_previo_aumento cuenta los días y los socios activos (sin los dados de baja)", async () => {
  await como(u.encargado, async () => {
    const [{ v }] = await t.q(`select public.aviso_previo_aumento($1, $2, $3::date) as v`, [t.g, [plan], await dia(10)]);
    assert.equal(v.cumple, false); assert.equal(v.dias_de_aviso, 10); assert.equal(v.aviso_dias, 30); assert.equal(v.socios_a_avisar, 2); assert.equal(v.puede_excepcion, false);
    const [{ v: ok }] = await t.q(`select public.aviso_previo_aumento($1, $2, $3::date) as v`, [t.g, [plan, otro], await dia(30)]);
    assert.equal(ok.cumple, true); assert.equal(ok.socios_a_avisar, 3);
  });
  await como(u.dueno, async () => {
    const [{ v }] = await t.q(`select public.aviso_previo_aumento($1, $2, null) as v`, [t.g, [plan]]);
    assert.equal(v.puede_excepcion, true);
  });
  await como(u.recepcion, () => t.falla(() => t.q(`select public.aviso_previo_aumento($1, $2, null)`, [t.g, [plan]]), /Sin permiso/));
});

test("el dueño con motivo puede: queda quién, por qué y los avisos a cada socio activo", async () => {
  const d5 = await dia(5);
  await como(u.dueno, async () => {
    const [{ n }] = await aplicar([plan], d5, "Subió el alquiler y el proveedor");
    assert.equal(n, 1);
  });
  const [r] = await t.q(`select * from public.aumentos_precio where gimnasio_id = $1`, [t.g]);
  assert.equal(r.excepcion_motivo, "Subió el alquiler y el proveedor"); assert.equal(r.creado_por_rol, "dueno");
  assert.equal(r.aviso_dias_reales, 5); assert.equal(r.aviso_dias_exigido, 30); assert.equal(r.socios_avisados, 2);
  const av = await t.q(`select socio_id, texto from public.avisos_socio where aumento_id = $1 order by 1`, [r.id]);
  assert.deepEqual(av.map((x) => x.socio_id).sort(), [s1, s2].sort());
  assert.match(av[0].texto, /\$30\.000,00 a \$33\.000,00/); assert.match(av[0].texto, /no cambia/);
  // El precio de hoy sigue; el nuevo rige desde el día elegido.
  const precio = async (cuando) => Number((await t.q(`select privado.precio_para($1, ${cuando}, null, null, true) as p`, [plan]))[0].p);
  assert.equal(await precio("now()"), 30000);
  assert.equal(await precio("now() + interval '6 days'"), 33000);
});

test("con 30 días o más lo hace también el encargado, sin motivo; un solo aviso por socio", async () => {
  const d31 = await dia(31);
  await como(u.encargado, async () => { const [{ n }] = await aplicar([otro], d31, "esto se ignora"); assert.equal(n, 1); });
  const [r] = await t.q(`select * from public.aumentos_precio where gimnasio_id = $1 and excepcion_motivo is null`, [t.g]);
  assert.equal(r.aviso_dias_reales, 31); assert.equal(r.socios_avisados, 1);
  const [{ c }] = await t.q(`select count(*)::int as c from public.avisos_socio where gimnasio_id = $1 and socio_id = $2`, [t.g, sOtroPlan]);
  assert.equal(c, 1);
});

test("cada socio ve solo su aviso; al marcarlo leído sale de la lista y queda la constancia", async () => {
  const mis = await como(uSocio, async () => (await t.q(`select public.mis_avisos($1) as v`, [s1]))[0].v);
  assert.equal(mis.length, 1); assert.equal(mis[0].tipo, "aumento");
  await como(uAjeno, () => t.falla(() => t.q(`select public.mis_avisos($1)`, [s1]), /Sin permiso/));
  await como(uAjeno, () => t.falla(() => t.q(`select public.marcar_aviso_leido($1)`, [mis[0].id]), /Sin permiso/));
  await como(uSocio, () => t.q(`select public.marcar_aviso_leido($1)`, [mis[0].id]));
  await como(uSocio, () => t.q(`select public.marcar_aviso_leido($1)`, [mis[0].id]));   // idempotente
  const otra = await como(uSocio, async () => (await t.q(`select public.mis_avisos($1) as v`, [s1]))[0].v);
  assert.equal(otra.length, 0);
  const hechos = await como(u.dueno, async () => (await t.q(`select public.aumentos_hechos($1) as v`, [t.g]))[0].v);
  const con = hechos.find((h) => h.excepcion_motivo);
  assert.equal(con.avisados, 2); assert.equal(con.vistos, 1); assert.equal(con.por, "dueno");
  await como(u.recepcion, () => t.falla(() => t.q(`select public.aumentos_hechos($1)`, [t.g]), /Sin permiso/));
});

test("el mínimo se configura (solo el dueño, de 7 a 90 días) y manda", async () => {
  await como(u.encargado, () => t.falla(() => t.q(`select public.guardar_config_aumento($1, 15)`, [t.g]), /Sin permiso/));
  await como(u.dueno, async () => {
    await t.falla(() => t.q(`select public.guardar_config_aumento($1, 3)`, [t.g]), /7 a 90/);
    await t.falla(() => t.q(`select public.guardar_config_aumento($1, 120)`, [t.g]), /7 a 90/);
    await t.q(`select public.guardar_config_aumento($1, 45)`, [t.g]);
    assert.equal((await t.q(`select public.config_aumento($1) as v`, [t.g]))[0].v.aviso_dias, 45);
  });
  await como(u.encargado, () => t.falla(() => aplicar([plan], null), /Hace falta avisar con 45 días/));
});
