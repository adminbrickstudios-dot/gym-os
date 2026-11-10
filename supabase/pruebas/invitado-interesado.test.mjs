// FA-24 (migración 202611090410): el invitado de un socio queda como interesado, con quién lo trajo.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir } from "./_comun.mjs";

let t, recepcion, profe, invitado, socio;
before(async () => {
  t = await abrir("prueba-invitado-interesado");
  for (const rol of ["recepcion", "profe"]) {
    const [{ id }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`${rol}${Math.random()}@ejemplo.invalid`]);
    await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,$3,$4)`, [t.g, id, rol, rol]);
    if (rol === "recepcion") recepcion = id; else profe = id;
  }
  [{ id: socio }] = await t.q(`insert into public.socios (gimnasio_id, nombre, apellido, telefono) values ($1,'Laura','Anfitriona','+5490000666001') returning id`, [t.g]);
  [{ id: invitado }] = await t.q(`insert into public.invitados (gimnasio_id, sede_id, socio_id, nombre, dni, para_el_dia, entro_en) values ($1,$2,$3,'Pablo Invitado','30111222', now() - interval '1 day', now() - interval '1 day') returning id`, [t.g, t.sede, socio]);
});
after(async () => t && t.cerrar());

test("el invitado aparece sin seguimiento; con su WhatsApp queda como interesado 'referido' con quién lo trajo, una sola vez", async () => {
  await t.comoUsuario(recepcion, async () => {
    const [{ l }] = await t.q(`select public.invitados_sin_seguimiento($1) l`, [t.g]);
    assert.equal(l.length, 1);
    assert.equal(l[0].invito, "Laura Anfitriona");
    await t.falla(() => t.q(`select public.invitado_a_interesado($1, 'abc')`, [invitado]), /WhatsApp/);
    await t.q(`select public.invitado_a_interesado($1, '387 555 1234')`, [invitado]);
    const [p] = await t.q(`select nombre, origen, interes, estado from public.prospectos where invitado_id = $1`, [invitado]);
    assert.deepEqual([p.nombre, p.origen, p.interes, p.estado], ["Pablo Invitado", "referido", "Invitado de Laura Anfitriona", "nuevo"]);
    const [{ l: despues }] = await t.q(`select public.invitados_sin_seguimiento($1) l`, [t.g]);
    assert.equal(despues.length, 0);
    await t.falla(() => t.q(`select public.invitado_a_interesado($1, '387 555 9999')`, [invitado]), /ya está como interesado/);
  });
});

test("el profe no puede; un WhatsApp repetido se rechaza con su motivo", async () => {
  const [{ id: otro }] = await t.q(`insert into public.invitados (gimnasio_id, sede_id, socio_id, nombre, dni, para_el_dia, entro_en) values ($1,$2,$3,'Otra Invitada','30111333', now() - interval '2 days', now() - interval '2 days') returning id`, [t.g, t.sede, socio]);
  await t.comoUsuario(profe, async () => {
    await t.falla(() => t.q(`select public.invitado_a_interesado($1, '387 555 1111')`, [otro]), /Sin permiso/);
    await t.falla(() => t.q(`select public.invitados_sin_seguimiento($1)`, [t.g]), /Sin permiso/);
  });
  await t.q(`insert into public.prospectos (gimnasio_id, nombre, telefono) values ($1,'Ya Estaba', privado.telefono_normalizado('387 555 2222', 'x'))`, [t.g]);
  await t.comoUsuario(recepcion, () => t.falla(() => t.q(`select public.invitado_a_interesado($1, '387 555 2222')`, [otro]), /Ya hay un interesado con ese WhatsApp/));
});
