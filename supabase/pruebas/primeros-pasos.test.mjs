// "Primeros pasos" (migración 0026): el progreso sale de los datos, nunca
// se guarda; ocultar y publicar la página son del dueño.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir } from "./_comun.mjs";

let t, u = {};
async function persona(rol) {
  const [{ id: usuario }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`${rol}${Math.random()}@ejemplo.invalid`]);
  await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,$3,$4)`, [t.g, usuario, `Persona ${rol}`, rol]);
  return usuario;
}
before(async () => {
  t = await abrir("prueba-primeros-pasos");
  u.dueno = await persona("dueno");
  u.encargado = await persona("encargado");
});
after(async () => t && t.cerrar());

const pasos = async () => (await t.q(`select public.primeros_pasos($1) as p`, [t.g]))[0].p;
const hecho = (p, clave) => p.pasos.find((x) => x.clave === clave).hecho;

test("el progreso sale de los datos: cada dato que se carga marca su paso", async () => {
  await t.comoUsuario(u.dueno, async () => {
    const p = await pasos();
    assert.equal(p.total, 9);
    // Los casos testigo ya traen planes con precio, socios y equipo (el encargado).
    assert.equal(hecho(p, "planes"), true);
    assert.equal(hecho(p, "socios"), true);
    assert.equal(hecho(p, "equipo"), true);
    for (const k of ["gimnasio", "marca", "horarios"]) assert.equal(hecho(p, k), false, `${k} todavía no`);
    assert.equal(hecho(p, "pagina"), true, "la página se ve desde que se crea el gimnasio (U4)");
    assert.equal(p.hechos, p.pasos.filter((x) => x.hecho).length);
  });
  // Cargar los datos (como lo haría cada pantalla) marca los pasos.
  await t.q(`update public.landing_gimnasio set whatsapp = '+5490001112222' where gimnasio_id = $1`, [t.g]);
  await t.q(`update public.sedes set direccion = 'Calle Ficticia 1' where gimnasio_id = $1`, [t.g]);
  await t.q(`update public.configuracion_gimnasio set logo_path = $1 where gimnasio_id = $2`, [`${t.g}/marca/logo-${"a".repeat(32)}.png`, t.g]);
  await t.q(`insert into public.horarios_apertura (gimnasio_id, sede_id, dia, abre, cierra) values ($1,$2,1,'07:00','22:00')`, [t.g, t.sede]);
  await t.q(`update public.configuracion_gimnasio set modo_clases = 'ninguno' where gimnasio_id = $1`, [t.g]);
  await t.comoUsuario(u.dueno, async () => {
    const p = await pasos();
    for (const k of ["gimnasio", "marca", "horarios"]) assert.equal(hecho(p, k), true, `${k} listo`);
    assert.equal(p.pasos.find((x) => x.clave === "horarios").titulo, "Tus horarios", "sin clases no pide la grilla");
    await t.q(`select public.publicar_pagina($1, true)`, [t.g]);
    assert.equal(hecho(await pasos(), "pagina"), true);
  });
});

test("transferencias sin alias: el paso de cobros queda pendiente; sin transferencias, no hace falta", async () => {
  await t.q(`update public.configuracion_gimnasio set alias_transferencia = null, cbu = null, medios_aceptados = '{efectivo,transferencia}' where gimnasio_id = $1`, [t.g]);
  await t.comoUsuario(u.dueno, async () => assert.equal(hecho(await pasos(), "cobros"), false));
  await t.q(`update public.configuracion_gimnasio set medios_aceptados = '{efectivo}' where gimnasio_id = $1`, [t.g]);
  await t.comoUsuario(u.dueno, async () => assert.equal(hecho(await pasos(), "cobros"), true));
});

test("ocultar y volver a mostrar; publicar y despublicar; todo solo el dueño", async () => {
  await t.comoUsuario(u.dueno, async () => {
    await t.q(`select public.ocultar_primeros_pasos($1, true)`, [t.g]);
    assert.equal((await pasos()).oculto, true);
    await t.q(`select public.ocultar_primeros_pasos($1, false)`, [t.g]);
    assert.equal((await pasos()).oculto, false);
    await t.q(`select public.publicar_pagina($1, false)`, [t.g]);
    const [{ l }] = await t.q(`select publicada as l from public.landing_gimnasio where gimnasio_id = $1`, [t.g]);
    assert.equal(l, false);
  });
  await t.comoUsuario(u.encargado, async () => {
    await t.falla(() => pasos(), /Sin permiso/);
    await t.falla(() => t.q(`select public.publicar_pagina($1, true)`, [t.g]), /Sin permiso/);
    await t.falla(() => t.q(`select public.ocultar_primeros_pasos($1, true)`, [t.g]), /Sin permiso/);
  });
});
