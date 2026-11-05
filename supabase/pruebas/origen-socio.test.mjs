// Cómo llegó (0046): sale de los hechos que ya están; el reglamento que
// aceptó es el de su versión aunque después haya otro; el profe no lo ve.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir } from "./_comun.mjs";

let t, u = {};
async function persona(rol) {
  const [{ id }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`${rol}${Math.random()}@ejemplo.invalid`]);
  await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,$3,$4)`, [t.g, id, rol === "recepcion" ? "Ana" : rol, rol]);
  return id;
}
before(async () => { t = await abrir("prueba-origen"); u.recepcion = await persona("recepcion"); u.profe = await persona("profe"); });
after(async () => t && t.cerrar());

test("alta online con reglamento v1, después hay v2; prospecto; mostrador", async () => {
  const [{ id: r1 }] = await t.q(`insert into public.reglamentos (gimnasio_id, version, texto) values ($1, 1, 'Reglamento uno, con un par de líneas.') returning id`, [t.g]);
  const [{ id: s }] = await t.q(`insert into public.socios (gimnasio_id, nombre, origen) values ($1, 'Online', 'alta_web') returning id`, [t.g]);
  await t.q(`insert into public.aceptaciones_reglamento (gimnasio_id, socio_id, reglamento_id) values ($1,$2,$3)`, [t.g, s, r1]);
  await t.q(`insert into public.reglamentos (gimnasio_id, version, texto) values ($1, 2, 'Reglamento dos, distinto del primero.')`, [t.g]);
  await t.q(`insert into public.prospectos (gimnasio_id, nombre, telefono, origen, estado, socio_id) values ($1,'Online','+5490009990001','pagina','socio',$2)`, [t.g, s]);
  await t.comoUsuario(u.recepcion, async () => {
    const [{ o }] = await t.q(`select public.origen_socio($1) as o`, [s]);
    assert.equal(o.origen, "alta_web");
    assert.equal(o.reglamento.version, 1);
    assert.equal(o.prospecto.origen, "pagina");
    const [{ r }] = await t.q(`select public.reglamento_aceptado($1) as r`, [s]);
    assert.match(r.texto, /uno/);
    const [{ id: m }] = await t.q(`select public.guardar_socio($1, null, '{"nombre":"Mostrador"}') as id`, [t.g]);
    const [{ o: o2 }] = await t.q(`select public.origen_socio($1) as o`, [m]);
    assert.equal(o2.origen, "manual");
    assert.equal(o2.por, "Ana");
    assert.equal(o2.reglamento, null);
  });
  await t.comoUsuario(u.profe, async () => t.falla(() => t.q(`select public.origen_socio($1)`, [s]), /Sin permiso/));
});
