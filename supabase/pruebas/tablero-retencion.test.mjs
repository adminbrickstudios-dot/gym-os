// Tablero de retención (0088): 12 semanas de socios al día (la última = hoy,
// igual a contar las coberturas vigentes), altas y bajas del mes; solo dueño y encargado.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir } from "./_comun.mjs";

let t, u = {};
async function persona(rol) {
  const [{ id }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`${rol}${Math.random()}@ejemplo.invalid`]);
  await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,$3,$4)`, [t.g, id, `P ${rol}`, rol]);
  return id;
}
async function como(usuario, fn) {
  await t.db.query("set role authenticated");
  await t.q(`select set_config('request.jwt.claims', $1, false)`, [JSON.stringify({ sub: usuario, role: "authenticated" })]);
  try { return await fn(); } finally { await t.db.query("reset role"); await t.q(`select set_config('request.jwt.claims', '', false)`); }
}
before(async () => { t = await abrir("prueba-tablero"); u.dueno = await persona("dueno"); u.recepcion = await persona("recepcion"); });
after(async () => t && t.cerrar());

test("12 semanas; la última coincide con los al día de hoy; altas del mes", async () => {
  const [{ r }] = await como(u.dueno, () => t.q(`select public.tablero_retencion($1) as r`, [t.g]));
  assert.equal(r.semanas.length, 12);
  const [{ n }] = await t.q(`select count(distinct c.socio_id)::int n from public.coberturas c join public.socios s on s.id = c.socio_id
    where c.gimnasio_id = $1 and c.anulada_en is null and c.desde <= now() and c.hasta > now() and s.dado_de_baja_en is null`, [t.g]);
  assert.equal(r.semanas[11].al_dia, n);
  assert.ok(r.altas_mes >= 1, "los socios del gimnasio de prueba se crearon hoy");
  await como(u.recepcion, () => t.falla(() => t.q(`select public.tablero_retencion($1)`, [t.g]), /permiso/i));
});

test("RET-3: motivos de baja del mes, del más común al menos", async () => {
  const ids = (await t.q(`select id from public.socios where gimnasio_id = $1 and dado_de_baja_en is null order by numero limit 3`, [t.g])).map((r) => r.id);
  for (const [id, m] of [[ids[0], "precio"], [ids[1], "precio"], [ids[2], "horario"]]) await t.q(`select privado.dar_de_baja($1, $2, now())`, [id, m]);
  const [{ r }] = await como(u.dueno, () => t.q(`select public.motivos_baja_mes($1) as r`, [t.g]));
  assert.deepEqual(r.slice(0, 2).map((x) => [x.motivo, x.cantidad]), [["precio", 2], ["horario", 1]]);
  await como(u.recepcion, () => t.falla(() => t.q(`select public.motivos_baja_mes($1)`, [t.g]), /permiso/i));
});
