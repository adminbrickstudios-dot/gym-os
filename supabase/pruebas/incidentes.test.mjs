// VD-46I (7601): registro de incidentes en la sala, sin diagnóstico.
// Crea cualquiera del equipo; lista todo solo el dueño y el encargado; a las 24 h queda escrito y no cambia
// (el trigger propio frena el UPDATE y el DELETE aunque se vaya directo a la tabla).
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir } from "./_comun.mjs";

let t, uDueno, uProfe, uRec, eProfe;
// Como el usuario, SIN deshacer lo que escribe (lo que prueba cada test queda para el siguiente).
async function como(usuario, fn) {
  await t.db.query("set role authenticated");
  await t.q(`select set_config('request.jwt.claims', $1, false)`, [JSON.stringify({ sub: usuario, role: "authenticated" })]);
  try { return await fn(); } finally { await t.db.query("reset role"); await t.q(`select set_config('request.jwt.claims', '', false)`); }
}
before(async () => {
  t = await abrir("prueba-incidentes");
  for (const [rol, nombre] of [["dueno", "Dueña"], ["profe", "Prof"], ["recepcion", "Sofi"]]) {
    const [{ id }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`${rol}${Math.random()}@ejemplo.invalid`]);
    const [{ id: eid }] = await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,$3,$4) returning id`, [t.g, id, nombre, rol]);
    if (rol === "dueno") uDueno = id; else if (rol === "profe") { uProfe = id; eProfe = eid; } else uRec = id;
  }
});
after(async () => t && t.cerrar());

const crear = (donde = "Sala de pesas", socio = null) =>
  t.q(`select public.crear_incidente($1, $2, 'Se cayó una mancuerna y golpeó el piso', 'Sofi y Beto', 'Se despejó la zona', $3) as id`, [t.g, donde, socio]);

test("cualquiera del equipo carga un incidente; queda con quién lo cargó", async () => {
  const [{ id }] = await como(uProfe, () => crear("Sala de pesas", t.ctx.socios.vencida));
  const [f] = await t.q(`select creado_por, socio_id, donde from public.incidentes where id = $1`, [id]);
  assert.equal(f.creado_por, eProfe);
  assert.equal(f.socio_id, t.ctx.socios.vencida);
});

test("el dueño lista todos; el profe solo los suyos; el que no es del equipo, error", async () => {
  await como(uRec, () => crear("Vestuario"));
  const [{ r: dueno }] = await como(uDueno, () => t.q(`select public.incidentes_panel($1) as r`, [t.g]));
  const [{ r: profe }] = await como(uProfe, () => t.q(`select public.incidentes_panel($1) as r`, [t.g]));
  assert.equal(dueno.puede_ver_todo, true);
  assert.ok(dueno.items.length >= 2);
  assert.equal(profe.puede_ver_todo, false);
  assert.ok(profe.items.length >= 1 && profe.items.every((i) => i.autor === "Prof"));
  const [{ id: forastero }] = await t.q(`insert into auth.users (email) values ('fuera@ejemplo.invalid') returning id`);
  await t.falla(() => como(forastero, () => t.q(`select public.incidentes_panel($1)`, [t.g])), /Sin permiso/);
});

test("se corrige dentro de las 24 h, solo quien lo cargó o la gestión", async () => {
  const [{ id }] = await como(uProfe, () => crear());
  await como(uProfe, () => t.q(`select public.corregir_incidente($1, 'Sala de pesas 2', 'Se cayó una mancuerna', null, 'Se despejó')`, [id]));
  const [f] = await t.q(`select donde, corregido_en from public.incidentes where id = $1`, [id]);
  assert.equal(f.donde, "Sala de pesas 2");
  assert.ok(f.corregido_en);
  await t.falla(() => como(uRec, () => t.q(`select public.corregir_incidente($1, 'x', 'x', null, 'x')`, [id])), /Solo quien lo cargó/);
  await como(uDueno, () => t.q(`select public.corregir_incidente($1, 'Sala de pesas 3', 'Se cayó una mancuerna', null, 'Se despejó')`, [id]));
});

test("pasadas las 24 h no se corrige ni se borra, ni por la función ni yendo directo a la tabla", async () => {
  const [{ id }] = await t.q(`insert into public.incidentes (gimnasio_id, donde, que_paso, que_se_hizo, creado_por, creado_en)
    values ($1, 'Pileta', 'Resbaló', 'Se lo ayudó', $2, now() - interval '25 hours') returning id`, [t.g, eProfe]);
  await t.falla(() => como(uDueno, () => t.q(`select public.corregir_incidente($1, 'x', 'x', null, 'x')`, [id])), /24 horas/);
  await t.falla(() => t.q(`update public.incidentes set que_paso = 'otra cosa' where id = $1`, [id]), /24 horas/);
  await t.falla(() => t.q(`delete from public.incidentes where id = $1`, [id]), /no se borran/);
  // Dentro de las 24 h tampoco se borra, ni se cambia quién lo cargó.
  const [{ id: nuevo }] = await como(uProfe, () => crear());
  await t.falla(() => t.q(`delete from public.incidentes where id = $1`, [nuevo]), /no se borran/);
  await t.falla(() => t.q(`update public.incidentes set creado_por = (select id from public.equipo where usuario_id = $2) where id = $1`, [nuevo, uDueno]), /quién lo cargó/);
});

test("campos obligatorios, fecha futura y la sección apagada", async () => {
  await t.falla(() => como(uProfe, () => t.q(`select public.crear_incidente($1, '', 'x', null, 'x')`, [t.g])), /dónde/);
  await t.falla(() => como(uProfe, () => t.q(`select public.crear_incidente($1, 'Sala', 'x', null, 'x', null, now() + interval '3 hours')`, [t.g])), /futura/);
  await t.q(`update public.configuracion_gimnasio set secciones_apagadas = array['incidentes'] where gimnasio_id = $1`, [t.g]);
  await t.falla(() => como(uDueno, () => t.q(`select public.incidentes_panel($1)`, [t.g])), /apagados/);
});
