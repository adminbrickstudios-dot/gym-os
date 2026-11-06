// VD-46R · Al cumplir 18 (0074.3): lo que firmó de menor ya no alcanza, firma él; aparece la tarea
// automática en Para hacer hoy; la firma anterior queda de constancia; sin cron, todo se calcula.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir } from "./_comun.mjs";

let t, u = {}, docs = {}, joven, jovenSinFirma, adulta, menor, eqDueno;
async function persona(rol) {
  const [{ id }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`${rol}${Math.random()}@ejemplo.invalid`]);
  const [{ id: eq }] = await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,$3,$4) returning id`, [t.g, id, `P ${rol}`, rol]);
  return { id, eq };
}
async function como(usuario, fn) {
  await t.db.query("set role authenticated");
  await t.q(`select set_config('request.jwt.claims', $1, false)`, [JSON.stringify({ sub: usuario, role: "authenticated" })]);
  try { return await fn(); } finally { await t.db.query("reset role"); await t.q(`select set_config('request.jwt.claims', '', false)`); }
}
async function socio(nombre, nacimiento) {
  return (await t.q(`insert into public.socios (gimnasio_id, nombre, apellido, fecha_nacimiento) values ($1,$2,'Mayoria', ${nacimiento}) returning id`, [t.g, nombre]))[0].id;
}
const firma = (s, d, haceDias) => t.q(`insert into public.firmas_documento (gimnasio_id, documento_id, socio_id, nombre, via, firmado_en) values ($1,$2,$3,'Tutor Responsable','recepcion', now() - ($4 || ' days')::interval)`, [t.g, d, s, String(haceDias)]);

before(async () => {
  t = await abrir("prueba-firma-propia");
  const d = await persona("dueno"); u.dueno = d.id; eqDueno = d.eq;
  u.recepcion = (await persona("recepcion")).id;
  for (const clave of ["reglamento", "menores"]) {
    docs[clave] = (await t.q(`insert into public.documentos (gimnasio_id, clave, version, titulo, texto, creado_por) values ($1,$2,1,$3,$4,$5) returning id`,
      [t.g, clave, `Documento ${clave}`, "Texto de prueba del documento, suficientemente largo.", eqDueno]))[0].id;
  }
  joven = await socio("Joven", "(current_date - interval '18 years' - interval '20 days')::date");          // cumplió 18 hace 20 días
  jovenSinFirma = await socio("Nuevo", "(current_date - interval '18 years' - interval '20 days')::date");  // nunca firmó nada
  adulta = await socio("Adulta", "date '1990-05-05'");
  menor = await socio("Menor", "(current_date - interval '12 years')::date");
  await firma(joven, docs.reglamento, 60);   // firmó (su tutor) a los 17 y medio
  await firma(adulta, docs.reglamento, 5);
  await firma(menor, docs.reglamento, 5);
});
after(async () => t && t.cerrar());

test("a quien cumplió 18 se le pide la firma propia; el menor y la adulta, no", async () => {
  const j = await como(u.dueno, async () => (await t.q(`select public.documentos_socio($1) as d`, [joven]))[0].d);
  assert.equal(j.pendientes.length, 1); assert.equal(j.pendientes[0].clave, "reglamento"); assert.equal(j.pendientes[0].motivo, "cumplio_18");
  assert.equal(j.firmados.length, 1); assert.equal(j.firmados[0].como_menor, true);
  const a = await como(u.dueno, async () => (await t.q(`select public.documentos_socio($1) as d`, [adulta]))[0].d);
  assert.equal(a.pendientes.length, 0);
  const m = await como(u.dueno, async () => (await t.q(`select public.documentos_socio($1) as d`, [menor]))[0].d);
  assert.deepEqual(m.pendientes.map((x) => x.clave), ["menores"]);
  // Quien nunca firmó sigue como antes: pendiente común, sin "motivo".
  const n = await como(u.dueno, async () => (await t.q(`select public.documentos_socio($1) as d`, [jovenSinFirma]))[0].d);
  assert.equal(n.pendientes.length, 1); assert.equal(n.pendientes[0].motivo, null);
});

test("la lista de quiénes cumplieron 18 y la tarea automática de Para hacer hoy", async () => {
  const l = await como(u.recepcion, async () => (await t.q(`select public.firmas_propias_pendientes($1) as l`, [t.g]))[0].l);
  assert.equal(l.length, 1); assert.equal(l[0].socio_id, joven); assert.equal(l[0].documentos, 1);
  const hacer = await como(u.recepcion, async () => (await t.q(`select public.para_hacer_hoy($1) as h`, [t.g]))[0].h);
  const items = Array.isArray(hacer) ? hacer : hacer.items;
  const tarea = items.find((x) => x.clave === "mayores_de_edad");
  assert.ok(tarea, "falta la tarea mayores_de_edad en Para hacer hoy"); assert.equal(tarea.cantidad, 1); assert.match(tarea.texto, /cumplió 18/);
  const cfg = await como(u.dueno, async () => (await t.q(`select public.tareas_auto_config($1) as c`, [t.g]))[0].c);
  assert.ok(cfg.automaticas.some((x) => x.clave === "mayores_de_edad"));
});

test("firma él: queda su firma propia, la anterior de constancia, y la tarea desaparece", async () => {
  await como(u.recepcion, () => t.q(`select public.firmar_documento($1, $2, 'Joven Mayoria')`, [docs.reglamento, joven]));
  await como(u.recepcion, () => t.q(`select public.firmar_documento($1, $2, 'Joven Mayoria')`, [docs.reglamento, joven]));   // repetir no duplica ni da error
  const [{ propias }] = await t.q(`select count(*)::int as propias from public.firmas_propias_documento where socio_id = $1`, [joven]);
  const [{ viejas }] = await t.q(`select count(*)::int as viejas from public.firmas_documento where socio_id = $1`, [joven]);
  assert.equal(propias, 1); assert.equal(viejas, 1);
  const j = await como(u.dueno, async () => (await t.q(`select public.documentos_socio($1) as d`, [joven]))[0].d);
  assert.equal(j.pendientes.length, 0); assert.equal(j.firmados.length, 2);
  assert.ok(j.firmados.some((x) => x.propia === true));
  const l = await como(u.recepcion, async () => (await t.q(`select public.firmas_propias_pendientes($1) as l`, [t.g]))[0].l);
  assert.equal(l.length, 0);
  const hacer = await como(u.recepcion, async () => (await t.q(`select public.para_hacer_hoy($1) as h`, [t.g]))[0].h);
  assert.ok(!(Array.isArray(hacer) ? hacer : hacer.items).some((x) => x.clave === "mayores_de_edad"));
});

test("el profe no ve la lista; el momento en que cumplió 18 es la medianoche local", async () => {
  const p = await persona("profe");
  await como(p.id, () => t.falla(() => t.q(`select public.firmas_propias_pendientes($1)`, [t.g]), /Sin permiso/));
  const [{ c }] = await t.q(`select privado.cumplio_18_en('2000-03-10', 'America/Argentina/Buenos_Aires') as c`);
  assert.equal(c.toISOString(), "2018-03-10T03:00:00.000Z");
});
