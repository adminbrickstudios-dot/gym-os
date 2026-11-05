// CFG-6: lo que la base ya guardaba y ahora se cambia desde Configuración.
// Volver a entrar el mismo día y los días de retención, guardados con la
// función de la pantalla y probados contra el cálculo con momentos fijos.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir, HOY } from "./_comun.mjs";

let t, uDueno;
before(async () => {
  t = await abrir("prueba-cfg6");
  const [{ id }] = await t.q(`insert into auth.users (email) values ('dueno-cfg6@ejemplo.invalid') returning id`);
  uDueno = id;
  await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,'Dueño','dueno')`, [t.g, uDueno]);
});
after(async () => t && t.cerrar());

// Guarda como el dueño, pero sin revertir (para probar el cálculo después).
async function guardar(datos) {
  await t.db.query("set role authenticated");
  await t.q(`select set_config('request.jwt.claims', $1, false)`, [JSON.stringify({ sub: uDueno, role: "authenticated" })]);
  try { await t.q(`select public.guardar_configuracion($1, $2)`, [t.g, datos]); }
  finally { await t.db.query("reset role"); await t.q(`select set_config('request.jwt.claims', '', false)`); }
}
// Los rechazos, dentro de una sesión que revierte (un error no rompe la transacción de la prueba).
const rechaza = (datos, patron) => t.comoUsuario(uDueno, () => t.falla(() => t.q(`select public.guardar_configuracion($1, $2)`, [t.g, datos]), patron));
const registrar = async (socio, m) =>
  (await t.q(`select privado.registrar_ingreso($1, $2, 'recepcion', null, null, null, $3) as r`, [socio, t.sede, m]))[0].r;

test("volver a entrar el mismo día: apagado no gasta; prendido gasta otra (y el pase ya no deja entrar)", async () => {
  const s = t.ctx.socios.pase_hoy;
  const m1 = await t.en(HOY, "08:00:00");
  const m2 = await t.en(HOY, "19:00:00");
  assert.equal((await registrar(s, m1)).veredicto.consume, "pase");
  await guardar({ reingreso_mismo_dia_consume: false });
  let [{ v }] = await t.q(`select to_jsonb(privado.calcular_acceso($1, $2, null)) as v`, [s, m2]);
  assert.equal(v.motivo, "pase_reingreso");
  assert.equal(v.puede, true);
  await guardar({ reingreso_mismo_dia_consume: true });
  [{ v }] = await t.q(`select to_jsonb(privado.calcular_acceso($1, $2, null)) as v`, [s, m2]);
  assert.equal(v.motivo, "pase_usado");
  assert.equal(v.puede, false);
  await rechaza({ reingreso_mismo_dia_consume: "si" }, /tiene que ser sí o no/);
});

test("días de retención: cambiar cuándo un vencido pasa a 'se fue' mueve al socio de lista", async () => {
  const lista = async (s) => (await t.q(`select lista from privado.retencion($1, $2) where socio_id = $3`, [t.g, await t.en(HOY, "12:00:00"), s]))[0]?.lista;
  const s = t.ctx.socios.vencida;
  await guardar({ retencion_dias_vencido: 120 });
  assert.equal(await lista(s), "vencido");
  await guardar({ retencion_dias_vencido: 1 });
  const despues = await lista(s);
  assert.ok(despues === "se_fue" || despues === "vencido", `quedó en ${despues}`);
  const [{ d }] = await t.q(`select (privado.dia_local($2, g.zona_horaria) - privado.dia_local(max(c.hasta), g.zona_horaria)) as d
                               from public.coberturas c join public.gimnasios g on g.id = c.gimnasio_id
                              where c.socio_id = $1 and c.anulada_en is null group by g.zona_horaria`, [s, await t.en(HOY, "12:00:00")]);
  assert.ok(d > 1, `la testigo vencida venció hace ${d} días`);
  assert.equal(despues, "se_fue", `vencido hace ${d} días con límite 1 → se fue`);
  await rechaza({ retencion_dias_nuevo: 3 }, /entre 7 y 90/);
  await rechaza({ retencion_dias_se_fue: 400 }, /entre 7 y 365/);
});
