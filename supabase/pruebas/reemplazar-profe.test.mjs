// VD-46K (7602): reemplazar al profe en UNA clase, con motivo.
// Cambia solo esa clase; el profe anterior deja de poder ver la lista y marcar presentes ahí;
// el nuevo sí; queda escrito quién, cuándo y por qué; solo dueño y encargado.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir } from "./_comun.mjs";

// Como el usuario, SIN deshacer lo que escribe (lo que prueba cada test queda para el siguiente).
async function como(usuario, fn) {
  await t.db.query("set role authenticated");
  await t.q(`select set_config('request.jwt.claims', $1, false)`, [JSON.stringify({ sub: usuario, role: "authenticated" })]);
  try { return await fn(); } finally { await t.db.query("reset role"); await t.q(`select set_config('request.jwt.claims', '', false)`); }
}
let t, act, uDueno, uRec, uA, uB, eA, eB, eRec, clase, otraClase, pasada, cancelada;
before(async () => {
  t = await abrir("prueba-reemplazar-profe");
  const usuario = async (mail) => (await t.q(`insert into auth.users (email) values ($1) returning id`, [mail]))[0].id;
  const equipo = async (u, nombre, rol) => (await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,$3,$4) returning id`, [t.g, u, nombre, rol]))[0].id;
  uDueno = await usuario("dueno@ejemplo.invalid"); await equipo(uDueno, "Dueña", "dueno");
  uRec = await usuario("rec@ejemplo.invalid"); eRec = await equipo(uRec, "Sofi", "recepcion");
  uA = await usuario("profea@ejemplo.invalid"); eA = await equipo(uA, "Prof. Ana", "profe");
  uB = await usuario("profeb@ejemplo.invalid"); eB = await equipo(uB, "Prof. Beto", "profe");
  [{ id: act }] = await t.q(`insert into public.actividades (gimnasio_id, nombre) values ($1,'Spinning') returning id`, [t.g]);
  const nueva = async (inicio, fin, extra = "") => (await t.q(
    `insert into public.clases (gimnasio_id, sede_id, actividad_id, inicio, fin, profe_id ${extra ? ", cancelada_en, cancelada_motivo" : ""})
     values ($1,$2,$3, ${inicio}, ${fin}, $4 ${extra ? ", now(), 'Cierre'" : ""}) returning id`, [t.g, t.sede, act, eA]))[0].id;
  clase = await nueva("now() - interval '30 minutes'", "now() + interval '30 minutes'");
  otraClase = await nueva("now() + interval '1 day'", "now() + interval '1 day 1 hour'");
  pasada = await nueva("now() - interval '3 hours'", "now() - interval '2 hours'");
  cancelada = await nueva("now() + interval '2 days'", "now() + interval '2 days 1 hour'", "x");
});
after(async () => t && t.cerrar());

const reemplazar = (id, profe, motivo) => t.q(`select public.reemplazar_profe($1, $2, $3) as r`, [id, profe, motivo]);

test("el dueño reemplaza al profe de esa clase; el anterior pierde el permiso y el nuevo lo gana", async () => {
  await como(uA, async () => { await t.q(`select * from public.lista_clase($1)`, [clase]); });   // antes podía
  const [{ r }] = await como(uDueno, () => reemplazar(clase, eB, "Ana está enferma"));
  assert.equal(r.profe, "Prof. Beto");
  assert.equal((await t.q(`select profe_id from public.clases where id = $1`, [clase]))[0].profe_id, eB);
  await como(uA, () => t.falla(() => t.q(`select * from public.lista_clase($1)`, [clase]), /tus clases/));
  await como(uA, () => t.falla(() => t.q(`select public.tomar_asistencia($1, $2)`, [clase, t.ctx.socios.vencida]), /tus clases/));
  await como(uB, async () => { await t.q(`select * from public.lista_clase($1)`, [clase]); });
});

test("solo cambia esa clase: las otras del mismo profe quedan como estaban", async () => {
  assert.equal((await t.q(`select profe_id from public.clases where id = $1`, [otraClase]))[0].profe_id, eA);
});

test("queda escrito: quién, de quién a quién y por qué; y no se cambia ni se borra", async () => {
  const [f] = await t.q(`select profe_anterior_id, profe_nuevo_id, motivo, hecho_por from public.reemplazos_profe where clase_id = $1`, [clase]);
  assert.equal(f.profe_anterior_id, eA);
  assert.equal(f.profe_nuevo_id, eB);
  assert.equal(f.motivo, "Ana está enferma");
  const [{ r }] = await como(uDueno, () => t.q(`select public.reemplazos_clase($1) as r`, [clase]));
  assert.equal(r.length, 1);
  assert.equal(r[0].anterior, "Prof. Ana");
  assert.equal(r[0].por, "Dueña");
  await t.falla(() => t.q(`update public.reemplazos_profe set motivo = 'otro' where clase_id = $1`, [clase]), /quedan escritos/);
  await t.falla(() => t.q(`delete from public.reemplazos_profe where clase_id = $1`, [clase]), /quedan escritos/);
});

test("la recepción y el profe no reemplazan; el que no es del equipo, tampoco", async () => {
  await como(uRec, () => t.falla(() => reemplazar(otraClase, eB, "Ana no viene"), /Sin permiso/));
  await como(uA, () => t.falla(() => reemplazar(otraClase, eB, "Ana no viene"), /Sin permiso/));
  await como(uRec, () => t.falla(() => t.q(`select public.reemplazos_clase($1)`, [clase]), /Sin permiso/));
});

test("exige motivo, un profe activo del gimnasio y una clase que no terminó ni está cancelada", async () => {
  await como(uDueno, () => t.falla(() => reemplazar(otraClase, eB, "  "), /motivo/));
  await como(uDueno, () => t.falla(() => reemplazar(otraClase, eRec, "Ana no viene"), /rol de profe/));
  await como(uDueno, () => t.falla(() => reemplazar(otraClase, eA, "Ana no viene"), /ya da esta clase/));
  await como(uDueno, () => t.falla(() => reemplazar(otraClase, "00000000-0000-4000-8000-000000000000", "Ana no viene"), /no existe/));
  await como(uDueno, () => t.falla(() => reemplazar(pasada, eB, "Ana no vino"), /ya terminó/));
  await como(uDueno, () => t.falla(() => reemplazar(cancelada, eB, "Ana no viene"), /cancelada/));
  await t.q(`update public.equipo set activo = false where id = $1`, [eB]);
  await como(uDueno, () => t.falla(() => reemplazar(otraClase, eB, "Ana no viene"), /no está activo/));
});
