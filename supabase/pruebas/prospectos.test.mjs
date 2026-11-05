// Prospectos (migración 0031): el visitante deja sus datos sin sesión (solo
// con la página publicada y la sección visible), el mismo celular no se
// duplica, hay tope contra spam; el equipo los ve y los mueve de estado;
// "se hizo socio" solo al darlo de alta; nadie escribe la tabla directo.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir } from "./_comun.mjs";

let t, u = {};
const HOST = `probar-${Date.now()}.ejemplo.invalid`;
async function persona(rol) {
  const [{ id }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`${rol}${Math.random()}@ejemplo.invalid`]);
  await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,$3,$4)`, [t.g, id, rol, rol]);
  return id;
}
before(async () => {
  t = await abrir("prueba-prospectos");
  for (const r of ["dueno", "recepcion", "profe"]) u[r] = await persona(r);
  await t.q(`insert into public.dominios_gimnasio (gimnasio_id, host, tipo) values ($1, $2, 'propio')`, [t.g, HOST]);
});
after(async () => t && t.cerrar());

// Como un visitante sin sesión. Si falla, "falla()" vuelve atrás (y eso deshace el rol).
const comoAnonimo = async (fn) => {
  await t.q(`set local role anon`);
  const r = await fn();
  await t.q(`reset role`);
  return r;
};
const probar = (nombre, tel, interes = null) => t.q(`select public.quiero_probar($1, $2, $3, $4) as r`, [HOST, nombre, tel, interes]).then((x) => x[0].r);

test("sin publicar no recibe; publicada sí, sin duplicar el celular", async () => {
  await t.falla(() => comoAnonimo(() => probar("Ana", "387 555 1234")), /no está recibiendo pedidos/);
  await t.q(`update public.landing_gimnasio set publicada = true where gimnasio_id = $1`, [t.g]);
  const r1 = await comoAnonimo(() => probar("Ana Pérez", "387 555-1234", "Funcional a la tarde"));
  assert.equal(r1.repetido, false);
  const r2 = await comoAnonimo(() => probar("Ana P.", "+54 9 387 555 1234"));
  assert.equal(r2.repetido, true, "el mismo celular escrito distinto no se duplica");
  const [{ n, interes }] = await t.q(`select count(*)::int as n, max(interes) as interes from public.prospectos where gimnasio_id = $1`, [t.g]);
  assert.equal(n, 1);
  assert.equal(interes, "Funcional a la tarde", "un segundo pedido sin interés no borra el primero");
  await t.falla(() => comoAnonimo(() => probar(" ", "387 555 9999")), /Escribí tu nombre/);
  await t.falla(() => comoAnonimo(() => probar("Beto", "123")), /Revisá el WhatsApp|característica/);
  await t.falla(() => comoAnonimo(() => t.q(`select * from public.prospectos`)), /permission|denied/);
});

test("con la sección oculta, la página no recibe", async () => {
  await t.q(`update public.landing_secciones set visible = false where gimnasio_id = $1 and tipo = 'probar'`, [t.g]);
  await t.falla(() => comoAnonimo(() => probar("Caro", "387 555 1111")), /no está recibiendo pedidos/);
  await t.q(`update public.landing_secciones set visible = true where gimnasio_id = $1 and tipo = 'probar'`, [t.g]);
});

test("tope de 30 por hora desde la página", async () => {
  await t.q(`insert into public.prospectos (gimnasio_id, nombre, telefono, origen)
             select $1, 'Spam ' || i, '+54900055' || lpad(i::text, 5, '0'), 'pagina' from generate_series(1, 30) i`, [t.g]);
  await t.falla(() => comoAnonimo(() => probar("Uno más", "387 555 2222")), /muchos pedidos/);
  await t.q(`delete from public.prospectos where gimnasio_id = $1 and nombre like 'Spam %'`, [t.g]);
});

test("el equipo los ve con el WhatsApp armado y los mueve; socio solo al darlo de alta; profe no", async () => {
  await t.comoUsuario(u.recepcion, async () => {
    const lista = (await t.q(`select public.prospectos_panel($1) as l`, [t.g]))[0].l;
    const ana = lista.find((p) => p.telefono === "+5493875551234");
    assert.ok(ana.mensaje.startsWith("Hola Ana!"), `mensaje: ${ana.mensaje}`);
    await t.q(`select public.actualizar_prospecto($1, $2, 'contactado', 'Viene el jueves')`, [t.g, ana.id]);
    await t.falla(() => t.q(`select public.actualizar_prospecto($1, $2, 'socio')`, [t.g, ana.id]), /se marca al darlo de alta/);
    const id = (await t.q(`select public.crear_prospecto($1, 'Juan', '387 555 3333', 'Musculación') as id`, [t.g]))[0].id;
    assert.ok(id);
    await t.falla(() => t.q(`select public.crear_prospecto($1, 'Juan bis', '3875553333')`, [t.g]), /Ya hay un prospecto/);
    const socio = (await t.q(`select public.guardar_socio($1, null, '{"nombre": "Juan", "telefono": "+5493875553333"}') as id`, [t.g]))[0].id;
    await t.q(`select public.prospecto_es_socio($1, $2, $3)`, [t.g, id, socio]);
    const [{ estado }] = await t.q(`select estado from public.prospectos where id = $1`, [id]);
    assert.equal(estado, "socio");
    await t.falla(() => t.q(`insert into public.prospectos (gimnasio_id, nombre, telefono) values ($1, 'x', '+5493875550000')`, [t.g]), /row-level security|permission/);
  });
  await t.comoUsuario(u.profe, async () => t.falla(() => t.q(`select public.prospectos_panel($1)`, [t.g]), /Sin permiso/));
});
