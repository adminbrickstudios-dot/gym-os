// FA-12 (migración 202611090413): la campana avisa al profe (sus clases), al encargado y al dueño (todas) de las clases de las próximas 2 horas
// sin anotados o llenas. La recepción no recibe este aviso.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir } from "./_comun.mjs";

let t, u = {}, profeEq, otroProfeEq, vacia, llena;
before(async () => {
  t = await abrir("prueba-campana-clases");
  for (const rol of ["dueno", "encargado", "recepcion", "profe"]) {
    const [{ id }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`${rol}${Math.random()}@ejemplo.invalid`]);
    const [{ id: eid }] = await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,$3,$4) returning id`, [t.g, id, rol, rol]);
    u[rol] = id; if (rol === "profe") profeEq = eid;
  }
  const [{ id: otro }] = await t.q(`insert into auth.users (email) values ('otroprofe@ejemplo.invalid') returning id`);
  [{ id: otroProfeEq }] = await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,'Otro profe','profe') returning id`, [t.g, otro]);
  const [{ id: act }] = await t.q(`insert into public.actividades (gimnasio_id, nombre) values ($1,'Funcional') returning id`, [t.g]);
  [{ id: vacia }] = await t.q(`insert into public.clases (gimnasio_id, sede_id, actividad_id, inicio, fin, profe_id, cupo) values ($1,$2,$3, now() + interval '90 minutes', now() + interval '150 minutes', $4, 10) returning id`, [t.g, t.sede, act, profeEq]);
  [{ id: llena }] = await t.q(`insert into public.clases (gimnasio_id, sede_id, actividad_id, inicio, fin, profe_id, cupo) values ($1,$2,$3, now() + interval '30 minutes', now() + interval '90 minutes', $4, 1) returning id`, [t.g, t.sede, act, otroProfeEq]);
  const [{ id: socio }] = await t.q(`insert into public.socios (gimnasio_id, nombre, apellido, telefono) values ($1,'Uno','Anotado','+5490000999777') returning id`, [t.g]);
  await t.q(`insert into public.reservas (gimnasio_id, clase_id, socio_id, estado) values ($1,$2,$3,'confirmada')`, [t.g, llena, socio]);
});
after(async () => t && t.cerrar());
const claves = async (usuario) => t.comoUsuario(usuario, async () => ((c) => (Array.isArray(c) ? c : c.items).map((i) => i.clave))((await t.q(`select public.campana($1) c`, [t.g]))[0].c));

test("el dueño y el encargado ven las dos; el profe, solo la suya; la recepción, ninguna", async () => {
  for (const rol of ["dueno", "encargado"]) {
    const k = await claves(u[rol]);
    assert.ok(k.includes(`clase_sin_anotados:${vacia}`), `${rol}: clase sin anotados`);
    assert.ok(k.includes(`clase_llena:${llena}`), `${rol}: clase llena`);
  }
  const p = await claves(u.profe);
  assert.ok(p.includes(`clase_sin_anotados:${vacia}`), "el profe ve su clase vacía");
  assert.ok(!p.includes(`clase_llena:${llena}`), "y no la de otro profe");
  const r = await claves(u.recepcion);
  assert.ok(!r.some((x) => /^clase_(sin_anotados|llena):/.test(x)), "la recepción no recibe este aviso");
});

test("una clase cancelada o a más de 2 horas no avisa", async () => {
  await t.q(`update public.clases set cancelada_en = now(), cancelada_motivo = 'prueba' where id = $1`, [vacia]);
  assert.ok(!(await claves(u.dueno)).includes(`clase_sin_anotados:${vacia}`));
  await t.q(`update public.clases set cancelada_en = null, cancelada_motivo = null, inicio = now() + interval '3 hours', fin = now() + interval '4 hours' where id = $1`, [vacia]);
  assert.ok(!(await claves(u.dueno)).includes(`clase_sin_anotados:${vacia}`));
});
