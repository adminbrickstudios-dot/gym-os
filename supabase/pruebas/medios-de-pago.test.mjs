// Medios de pago que acepta el gimnasio (migración 0023): la base los hace
// cumplir en Vender, en la transferencia del socio y en la app.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir } from "./_comun.mjs";

let t, caja, turno, uDueno, uRec, uSocio;
before(async () => {
  t = await abrir("prueba-medios");
  [{ id: caja }] = await t.q(`insert into public.cajas (gimnasio_id, sede_id, nombre) values ($1,$2,'Recepción') returning id`, [t.g, t.sede]);
  const crear = async (rol) => {
    const [{ id: u }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`${rol}${Math.random()}@ejemplo.invalid`]);
    await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,$3,$4)`, [t.g, u, rol, rol]);
    return u;
  };
  uDueno = await crear("dueno");
  uRec = await crear("recepcion");
  [{ id: uSocio }] = await t.q(`insert into auth.users (phone) values ('+5490000555666') returning id`);
  await t.q(`update public.socios set usuario_id = $2 where id = $1`, [t.ctx.socios.vencida, uSocio]);
  await t.q(`update public.configuracion_gimnasio set alias_transferencia = 'gym.prueba' where gimnasio_id = $1`, [t.g]);
  await t.q(`insert into public.productos (gimnasio_id, nombre, precio) values ($1,'Agua',1000)`, [t.g]);
});
after(async () => t && t.cerrar());

// Ejecuta como un usuario sin revertir (para encadenar pasos).
async function como(u, fn) {
  await t.db.query("set role authenticated");
  await t.q(`select set_config('request.jwt.claims', $1, false)`, [JSON.stringify({ sub: u, role: "authenticated" })]);
  try { return await fn(); } finally { await t.db.query("reset role"); await t.q(`select set_config('request.jwt.claims', '', false)`); }
}
const guardar = (datos) => t.q(`select public.guardar_configuracion($1, $2)`, [t.g, datos]);
const config = async () => (await t.q(`select public.configuracion_panel($1) as c`, [t.g]))[0].c;
const producto = async () => (await t.q(`select id from public.productos where gimnasio_id = $1`, [t.g]))[0].id;
const venderAgua = async (medio) => t.q(`select public.vender($1, $2, $3, null, $4) as r`,
  [t.sede, JSON.stringify([{ tipo: "producto", producto_id: await producto(), cantidad: 1 }]), JSON.stringify([{ medio, monto: 1000 }]), turno]);

test("por defecto se aceptan los cuatro medios; el dueño elige cuáles y el banco", async () => {
  await como(uDueno, async () => {
    assert.deepEqual((await config()).medios_aceptados, ["efectivo", "transferencia", "debito", "credito"]);
    await guardar({ medios_aceptados: ["transferencia", "debito"], banco_transferencia: "  Banco Ficticio  " });
    const c = await config();
    assert.deepEqual(c.medios_aceptados.sort(), ["debito", "transferencia"]);
    assert.equal(c.banco_transferencia, "Banco Ficticio");
    await t.falla(() => guardar({ medios_aceptados: [] }), /al menos un medio de pago/);
    await t.falla(() => guardar({ medios_aceptados: ["bitcoin"] }), /Medio de pago desconocido/);
    await t.falla(() => guardar({ banco_transferencia: "x".repeat(61) }), /hasta 60/);
    // Volver a todos para lo que sigue.
    await guardar({ medios_aceptados: ["efectivo", "transferencia", "debito", "credito"] });
  });
});

test("sin Caja, el efectivo no puede ser el único medio (en cualquier orden)", async () => {
  await como(uDueno, async () => {
    await guardar({ medios_aceptados: ["efectivo"] });
    await t.falla(() => guardar({ secciones_apagadas: ["caja"] }), /Sin Caja no se cobra en efectivo/);
    await guardar({ medios_aceptados: ["efectivo", "transferencia"] });
    await guardar({ secciones_apagadas: ["caja"] });
    await t.falla(() => guardar({ medios_aceptados: ["efectivo"] }), /Sin Caja no se cobra en efectivo/);
    await guardar({ secciones_apagadas: [], medios_aceptados: ["efectivo", "transferencia", "debito", "credito"] });
  });
});

test("Vender: la base rechaza un medio que el gimnasio no acepta; precios_venta ofrece solo los aceptados", async () => {
  turno = await como(uRec, async () => (await t.q(`select public.abrir_caja($1, 0) as id`, [caja]))[0].id);
  await como(uDueno, () => guardar({ medios_aceptados: ["efectivo", "transferencia"] }));
  await como(uRec, async () => {
    const [{ p }] = await t.q(`select public.precios_venta($1) as p`, [t.sede]);
    assert.deepEqual(p.medios, ["efectivo", "transferencia"]);
    await t.falla(() => venderAgua("credito"), /no cobra con tarjeta de crédito/);
    await t.falla(() => venderAgua("debito"), /Configuración → Cobros/);
    const [{ r }] = await venderAgua("transferencia");
    assert.equal(Number(r.total), 1000);
  });
  // Con Caja apagada, el efectivo deja de ofrecerse y de aceptarse.
  await como(uDueno, () => guardar({ secciones_apagadas: ["caja"] }));
  await como(uRec, async () => {
    const [{ p }] = await t.q(`select public.precios_venta($1) as p`, [t.sede]);
    assert.deepEqual(p.medios, ["transferencia"]);
    await t.falla(() => venderAgua("efectivo"), /no cobra con efectivo/);
  });
  await como(uDueno, () => guardar({ secciones_apagadas: [], medios_aceptados: ["efectivo", "transferencia", "debito", "credito"] }));
});

test("app del socio: sin transferencias no muestra los datos y la base no acepta el comprobante", async () => {
  const s = t.ctx.socios.vencida;
  await como(uSocio, async () => {
    const [{ m }] = await t.q(`select public.mi_socio($1, $2) as m`, [t.g, s]);
    assert.equal(m.transferencia.alias, "gym.prueba");
  });
  await como(uDueno, () => guardar({ medios_aceptados: ["efectivo", "debito"], banco_transferencia: "Banco Ficticio" }));
  await como(uSocio, async () => {
    const [{ m }] = await t.q(`select public.mi_socio($1, $2) as m`, [t.g, s]);
    assert.equal(m.transferencia, null);
    await t.falla(() => t.q(`select public.informar_transferencia($1, $2)`, [s, `${t.g}/${s}/c.jpg`]), /no recibe pagos por transferencia/);
  });
  await como(uDueno, () => guardar({ medios_aceptados: ["efectivo", "transferencia"] }));
  await como(uSocio, async () => {
    const [{ m }] = await t.q(`select public.mi_socio($1, $2) as m`, [t.g, s]);
    assert.equal(m.transferencia.banco, "Banco Ficticio");
  });
});
