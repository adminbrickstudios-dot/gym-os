// VD-46O (7801): reactivar ex socios. La lista "Se fueron" filtrada por motivo de baja y antigüedad, el
// seguimiento de cuántos contactados volvieron a pagar, y que el marcado "no escribirle" no aparece.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir } from "./_comun.mjs";

let t, uDueno, uProfe, eDueno, baja, sinBaja, marcado;
async function como(usuario, fn) {
  await t.db.query("savepoint c");
  try {
    await t.db.query("set local role authenticated");
    await t.q(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: usuario, role: "authenticated" })]);
    return await fn();
  } finally { await t.db.query("rollback to savepoint c"); }
}
const ex = (motivo = null, antig = null) => como(uDueno, async () => (await t.q(`select public.ex_socios($1, $2, $3) as r`, [t.g, motivo, antig]))[0].r);
const ids = (r) => r.filas.map((f) => f.socio_id);

async function socio(nombre) {
  return (await t.q(`insert into public.socios (gimnasio_id, nombre, apellido, telefono) values ($1,'Ex',$2,'+5490000999201') returning id`, [t.g, nombre]))[0].id;
}
// Dejó de pagar hace 60 días, sin baja formal (venció su último período).
async function dejoDePagar(nombre, inicioDias = 300) {
  const s = await socio(nombre);
  const [{ id: su }] = await t.q(`insert into public.suscripciones (gimnasio_id, socio_id, plan_id, inicio) values ($1,$2,$3, now() - $4::interval) returning id`,
    [t.g, s, t.ctx.planes.full, `${inicioDias} days`]);
  await t.q(`insert into public.coberturas (gimnasio_id, suscripcion_id, socio_id, desde, hasta, origen, motivo)
             values ($1,$2,$3, now() - $4::interval, now() - interval '60 days', 'cortesia', 'prueba')`, [t.g, su, s, `${inicioDias} days`]);
  return s;
}

before(async () => {
  t = await abrir("prueba-ex-socios");
  for (const [rol, nombre] of [["dueno", "Dueña"], ["profe", "Profe"]]) {
    const [{ id }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`${rol}${Math.random()}@ejemplo.invalid`]);
    const [{ id: e }] = await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,$3,$4) returning id`, [t.g, id, nombre, rol]);
    if (rol === "dueno") { uDueno = id; eDueno = e; } else uProfe = id;
  }
  // Dado de baja hace 10 días por precio, con más de un año de socio.
  baja = await socio("DeBaja");
  await t.q(`update public.socios set dado_de_baja_en = now() - interval '10 days', motivo_baja = 'precio' where id = $1`, [baja]);
  await t.q(`insert into public.suscripciones (gimnasio_id, socio_id, plan_id, inicio, baja_en, motivo_baja)
             values ($1,$2,$3, now() - interval '400 days', now() - interval '10 days', 'Baja del socio: precio')`, [t.g, baja, t.ctx.planes.full]);
  sinBaja = await dejoDePagar("SinBaja");
  marcado = await dejoDePagar("Marcado");
  await t.q(`update public.socios set no_escribirle_en = now(), no_escribirle_motivo = 'lo pidió' where id = $1`, [marcado]);
});
after(async () => t && t.cerrar());

test("la lista trae a los que se fueron con su motivo y antigüedad; el marcado no está", async () => {
  const r = await ex();
  assert.ok(ids(r).includes(baja));
  assert.ok(ids(r).includes(sinBaja));
  assert.ok(!ids(r).includes(marcado), "“no escribirle” no aparece en la lista para reactivar");
  const b = r.filas.find((f) => f.socio_id === baja);
  assert.equal(b.motivo, "precio");
  assert.ok(b.meses >= 12, `antigüedad ${b.meses}`);
  assert.equal(r.filas.find((f) => f.socio_id === sinBaja).motivo, "sin_baja");
  assert.ok(b.mensaje, "trae el mensaje armado");
});

test("filtra por motivo y por antigüedad, y los conteos acompañan", async () => {
  const p = await ex("precio");
  assert.ok(ids(p).includes(baja) && !ids(p).includes(sinBaja));
  const m = await ex(null, "mas_12");
  assert.ok(ids(m).includes(baja) && !ids(m).includes(sinBaja));
  const medio = await ex(null, "de_3_a_12");
  assert.ok(ids(medio).includes(sinBaja) && !ids(medio).includes(baja));
  assert.ok(m.motivos.some((x) => x.motivo === "precio" && Number(x.cantidad) >= 1));
  assert.ok(Number(m.antiguedad.mas_12) >= 1);
});

test("motivo o antigüedad inventados: error; el profe no entra; otro gimnasio no se ve", async () => {
  await t.falla(() => como(uDueno, () => t.q(`select public.ex_socios($1, 'cualquiera', null)`, [t.g])), /Motivo de baja desconocido/);
  await t.falla(() => como(uDueno, () => t.q(`select public.ex_socios($1, null, 'siempre')`, [t.g])), /Antigüedad desconocida/);
  await t.falla(() => como(uProfe, () => t.q(`select public.ex_socios($1, null, null)`, [t.g])), /Sin permiso/);
  const [{ id: g2 }] = await t.q(`insert into public.gimnasios (slug, nombre) values ('otro-ex-socios', 'Otro') returning id`);
  await t.falla(() => como(uDueno, () => t.q(`select public.ex_socios($1, null, null)`, [g2])), /Sin permiso/);
});

test("seguimiento: contactados y cuántos volvieron a pagar después de que se les escribió", async () => {
  const antes = (await ex()).seguimiento;
  // Se le escribió a los dos hace una hora (los contactos se anotan con registrar_contacto; acá, directo, con la hora atrasada).
  for (const s of [baja, sinBaja])
    await t.q(`insert into public.contactos_retencion (gimnasio_id, socio_id, lista, canal, resultado, creado_por, creado_en)
               values ($1,$2,'se_fue','whatsapp','enviado',$3, now() - interval '1 hour')`, [t.g, s, eDueno]);
  const durante = (await ex()).seguimiento;
  assert.equal(Number(durante.contactados), Number(antes.contactados) + 2);
  assert.equal(Number(durante.volvieron), Number(antes.volvieron));
  // El que dejó de pagar vuelve y paga una cuota.
  await t.q(`select privado.cobrar_cuota($1, $2, 'transferencia', 1, null, null, now())`, [sinBaja, t.sede]);
  const despues = (await ex()).seguimiento;
  assert.equal(Number(despues.volvieron), Number(antes.volvieron) + 1, "uno volvió a pagar");
  assert.ok(!ids(await ex()).includes(sinBaja), "el que volvió ya no está en Se fueron");
});
