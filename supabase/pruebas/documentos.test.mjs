// COM-6 (0126): documentos para firmar con versión. El dueño publica; editar
// publica otra versión (lo firmado queda con la suya y hay que volver a
// firmar); el socio firma desde la app y la recepción en el mostrador; el de
// menores solo se le pide a un menor; la recepción no publica.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir } from "./_comun.mjs";

let t, u = {}, socio, menor;
async function como(usuario, fn) {
  await t.db.query("set role authenticated");
  await t.q(`select set_config('request.jwt.claims', $1, false)`, [JSON.stringify({ sub: usuario, role: "authenticated" })]);
  try { return await fn(); } finally { await t.db.query("reset role"); await t.q(`select set_config('request.jwt.claims', '', false)`); }
}
before(async () => {
  t = await abrir("prueba-documentos");
  for (const rol of ["dueno", "recepcion"]) {
    const [{ id }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`${rol}${Math.random()}@ejemplo.invalid`]);
    await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,$3,$4)`, [t.g, id, rol, rol]);
    u[rol] = id;
  }
  const [{ id: us }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`socio${Math.random()}@ejemplo.invalid`]);
  u.socio = us;
  [{ id: socio }] = await t.q(`insert into public.socios (gimnasio_id, nombre, apellido, usuario_id) values ($1,'Firma','Adulta',$2) returning id`, [t.g, us]);
  [{ id: menor }] = await t.q(`insert into public.socios (gimnasio_id, nombre, apellido, fecha_nacimiento, responsable_nombre, responsable_telefono)
     values ($1,'Firma','Menor', current_date - interval '12 years', 'Mamá', '+5490001112222') returning id`, [t.g]);
});
after(async () => t && t.cerrar());

const REGLAMENTO = "1. Traé toalla. 2. Dejá los discos en su lugar. 3. Respetá los horarios.";
test("publicar, firmar, versión nueva y quién puede", async () => {
  const v1 = await como(u.dueno, async () => {
    await t.falla(() => t.q(`select public.guardar_documento($1, 'reglamento', 'Reglamento', 'corto')`, [t.g]), /muy corto/);
    const [{ id }] = await t.q(`select public.guardar_documento($1, 'reglamento', 'Reglamento', $2) id`, [t.g, REGLAMENTO]);
    const [{ id: igual }] = await t.q(`select public.guardar_documento($1, 'reglamento', 'Reglamento', $2) id`, [t.g, REGLAMENTO]);
    assert.equal(igual, id, "guardar sin cambios no crea versión");
    await t.q(`select public.guardar_documento($1, 'menores', 'Autorización del responsable', 'Autorizo a mi hijo/a a entrenar en el gimnasio.')`, [t.g]);
    return id;
  });
  await como(u.recepcion, () => t.falla(() => t.q(`select public.guardar_documento($1, 'deslinde', 'Deslinde', $2)`, [t.g, REGLAMENTO]), /permiso|rol|acceso/i));
  await como(u.socio, async () => {
    const [{ d }] = await t.q(`select public.documentos_socio($1) d`, [socio]);
    assert.deepEqual(d.pendientes.map((x) => x.clave), ["reglamento"], "al adulto no se le pide el de menores");
    await t.falla(() => t.q(`select public.firmar_documento($1, $2, 'yo')`, [v1, socio]), /nombre y apellido/);
    await t.q(`select public.firmar_documento($1, $2, 'Firma Adulta')`, [v1, socio]);
    const [{ d: d2 }] = await t.q(`select public.documentos_socio($1) d`, [socio]);
    assert.equal(d2.pendientes.length, 0); assert.equal(d2.firmados[0].via, "app");
    await t.falla(() => t.q(`select public.documentos_socio($1)`, [menor]), /permiso/i);
  });
  await como(u.recepcion, async () => {
    const [{ d }] = await t.q(`select public.documentos_socio($1) d`, [menor]);
    assert.deepEqual(d.pendientes.map((x) => x.clave), ["reglamento", "menores"]);
    await t.q(`select public.firmar_documento($1, $2, 'Mamá de Firma')`, [d.pendientes[1].documento_id, menor]);
    const [{ d: d2 }] = await t.q(`select public.documentos_socio($1) d`, [menor]);
    assert.equal(d2.firmados[0].via, "recepcion");
  });
  await como(u.dueno, async () => {
    await t.q(`select public.guardar_documento($1, 'reglamento', 'Reglamento', $2)`, [t.g, REGLAMENTO + " 4. Nuevo punto."]);
    const [{ p }] = await t.q(`select public.documentos_panel($1) p`, [t.g]);
    assert.equal(p.find((x) => x.clave === "reglamento").version, 2);
  });
  await como(u.socio, async () => {
    const [{ d }] = await t.q(`select public.documentos_socio($1) d`, [socio]);
    assert.equal(d.pendientes[0].version, 2, "con el texto nuevo, hay que volver a firmar");
    assert.equal(d.firmados[0].vigente, false, "lo firmado queda con su versión");
    await t.falla(() => t.q(`select public.firmar_documento($1, $2, 'Firma Adulta')`, [v1, socio]), /versión nueva/);
  });
});
