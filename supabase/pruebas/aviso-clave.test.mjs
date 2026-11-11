// C1b: el socio se entera cuando el gimnasio le da una clave nueva. Solo lee su ficha; nunca la clave; "Entendido" queda en la base.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir } from "./_comun.mjs";

let t, uDueno, eDueno, uRec, eRec, uSocio, sCon, uOtro, sOtro, sSin, uSinEntrega, g2, uAjeno, sAjeno;
async function usuario(prefijo) {
  const [{ id }] = await t.q(`insert into auth.users (email, email_confirmed_at) values ($1, now()) returning id`, [`${prefijo}${Math.random().toString(36).slice(2)}@ejemplo.invalid`]);
  return id;
}
async function persona(gim, u, rol, nombre) {
  const [{ id }] = await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,$3,$4) returning id`, [gim, u, nombre, rol]);
  return id;
}
const aviso = (s) => t.q(`select public.aviso_clave_socio($1) as r`, [s]).then((r) => r[0].r);
const visto = (s) => t.q(`select public.marcar_aviso_clave_visto($1)`, [s]);
// comoUsuario revierte lo que se hace adentro: las entregas se dejan como el servidor (rol de la base), con la hora que se pide.
const entregar = (porEquipo, porUsuario, s, segundos = 0) =>
  t.q(`insert into public.claves_entregadas (gimnasio_id, socio_id, por_equipo_id, por_usuario_id, creado_en) values ($1,$2,$3,$4, now() + make_interval(secs => $5))`, [t.g, s, porEquipo, porUsuario, segundos]);

before(async () => {
  t = await abrir("prueba-aviso-clave");
  [{ id: g2 }] = await t.q(`insert into public.gimnasios (slug, nombre) values ('prueba-aviso-clave-2', 'Otro Gimnasio') returning id`);
  uDueno = await usuario("dueno"); eDueno = await persona(t.g, uDueno, "dueno", "Dueña Aviso");
  uRec = await usuario("rec"); eRec = await persona(t.g, uRec, "recepcion", "Ana Mostrador");
  uSocio = await usuario("socio");
  [{ id: sCon }] = await t.q(`insert into public.socios (gimnasio_id, nombre, apellido, email, usuario_id) values ($1,'Con','Aviso','con.aviso@ejemplo.invalid',$2) returning id`, [t.g, uSocio]);
  uOtro = await usuario("otro");
  [{ id: sOtro }] = await t.q(`insert into public.socios (gimnasio_id, nombre, apellido, email, usuario_id) values ($1,'Otro','Socio','otro.socio@ejemplo.invalid',$2) returning id`, [t.g, uOtro]);
  uSinEntrega = await usuario("sin");
  [{ id: sSin }] = await t.q(`insert into public.socios (gimnasio_id, nombre, apellido, email, usuario_id) values ($1,'Sin','Entrega','sin.entrega@ejemplo.invalid',$2) returning id`, [t.g, uSinEntrega]);
  uAjeno = await usuario("ajeno");
  [{ id: sAjeno }] = await t.q(`insert into public.socios (gimnasio_id, nombre, apellido, email, usuario_id) values ($1,'De','Ajeno','ajeno@ejemplo.invalid',$2) returning id`, [g2, uAjeno]);
});
after(async () => t && t.cerrar());

test("sin entrega, no hay aviso", async () => {
  await t.comoUsuario(uSinEntrega, async () => { assert.equal(await aviso(sSin), null); });
  await t.comoUsuario(uSocio, async () => { assert.equal(await aviso(sCon), null); });
});

test("el socio ve quién le dio la clave y cuándo, nunca la clave", async () => {
  await entregar(eRec, uRec, sCon);
  await t.comoUsuario(uSocio, async () => {
    const a = await aviso(sCon);
    assert.equal(a.por_nombre, "Ana Mostrador");
    assert.ok(a.creado_en);
    assert.deepEqual(Object.keys(a).sort(), ["creado_en", "id", "por_nombre"]);
  });
});

test("otro socio no ve la entrega de nadie más; permiso denegado es error, no vacío", async () => {
  await t.comoUsuario(uOtro, async () => {
    await t.falla(() => aviso(sCon), /Sin permiso/);
    await t.falla(() => visto(sCon), /Sin permiso/);
    assert.equal(await aviso(sOtro), null);
  });
  await t.comoUsuario(uAjeno, async () => { await t.falla(() => aviso(sCon), /Sin permiso/); });
  await t.comoUsuario(uRec, async () => { await t.falla(() => aviso(sCon), /Sin permiso/); });
  await t.falla(() => aviso(sCon), /iniciar sesión|permission denied/);
});

test("la tabla no se lee directo", async () => {
  await t.comoUsuario(uSocio, async () => { await t.falla(() => t.q(`select * from public.claves_entregadas`), /permission denied/); });
});

test("Entendido lo cierra en la base y no vuelve; una entrega más nueva lo trae de nuevo", async () => {
  await t.comoUsuario(uSocio, async () => {
    await visto(sCon);
    assert.equal(await aviso(sCon), null);
    await visto(sCon); // idempotente
    await t.db.query("reset role");
    const filas = await t.q(`select visto_por_socio_en from public.claves_entregadas where socio_id = $1`, [sCon]);
    assert.ok(filas.length && filas.every((f) => f.visto_por_socio_en));
    // llega una entrega más nueva (la deja el servidor, no el socio)
    await entregar(eDueno, uDueno, sCon, 5);
    await t.db.query("set local role authenticated");
    const a = await aviso(sCon);
    assert.equal(a.por_nombre, "Dueña Aviso");
  });
});

test("si la generó el propio socio, no hay aviso", async () => {
  await entregar(eRec, uOtro, sOtro);
  await t.comoUsuario(uOtro, async () => { assert.equal(await aviso(sOtro), null); });
});
