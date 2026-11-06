// VD-5 (3450): la hoja Cobrar. "Cobré otro día" solo dueño o encargado (con motivo, nunca en efectivo),
// el comprobante de la transferencia, el medio por defecto y lo que la hoja pregunta al abrirse.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir } from "./_comun.mjs";

let t, uDueno, uRec, uEnc, agua, socio, otroSocio;
async function como(usuario, fn) {
  await t.db.query("savepoint c");
  try {
    await t.db.query("set local role authenticated");
    await t.q(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: usuario, role: "authenticated" })]);
    return await fn();
  } finally { await t.db.query("rollback to savepoint c"); }
}
// Lo que se escribe en la base de verdad se hace como superusuario (el rol de la sesión se descarta con el savepoint).
before(async () => {
  t = await abrir("prueba-cobrar-flujo");
  for (const [rol, nombre] of [["dueno", "Dueña"], ["recepcion", "Sofi"], ["encargado", "Beto"]]) {
    const [{ id }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`${rol}${Math.random()}@ejemplo.invalid`]);
    await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,$3,$4)`, [t.g, id, nombre, rol]);
    if (rol === "dueno") uDueno = id; else if (rol === "recepcion") uRec = id; else uEnc = id;
  }
  [{ id: agua }] = await t.q(`insert into public.productos (gimnasio_id, nombre, precio) values ($1,'Agua',1000) returning id`, [t.g]);
  socio = t.ctx.socios.al_dia;
  otroSocio = t.ctx.socios.vencida;
});
after(async () => t && t.cerrar());

const itemsDe = () => JSON.stringify([{ tipo: "producto", producto_id: agua }]);
const pago = (medio) => JSON.stringify([{ medio, monto: 1000 }]);
const hace = (dias) => new Date(Date.now() - dias * 86400_000).toISOString();
// vender(sede, items, pagos, socio, turno, clave, cobrado_en, motivo, comprobante)
const vender = (medio, { socioId = socio, cobradoEn = null, motivo = null, comprobante = null } = {}) =>
  t.q(`select public.vender($1, $2, $3, $4, null, null, $5, $6, $7) as r`, [t.sede, itemsDe(), pago(medio), socioId, cobradoEn, motivo, comprobante]);

test("la hoja pide el cobro de otro día: la recepción no puede, ni con motivo", async () => {
  await t.falla(() => como(uRec, () => vender("transferencia", { cobradoEn: hace(1), motivo: "Pagó ayer" })), /dueño o el encargado/);
});

test("el dueño y el encargado cobran con otra fecha: queda marcada, con su motivo y cuándo se cargó", async () => {
  for (const u of [uDueno, uEnc]) {
    const r = await como(u, async () => {
      const [{ r }] = await vender("transferencia", { cobradoEn: hace(2), motivo: "Pagó el viernes y no se anotó" });
      await t.db.query("reset role");
      const [v] = await t.q(`select otro_dia_motivo, registrada_en, creado_en, turno_caja_id, creado_por from public.ventas where id = $1`, [r.venta_id]);
      return v;
    });
    assert.equal(r.otro_dia_motivo, "Pagó el viernes y no se anotó");
    assert.ok(r.registrada_en && r.creado_en < r.registrada_en, "creado_en es el día del cobro y registrada_en cuándo se cargó");
    assert.ok(Date.now() - new Date(r.creado_en).getTime() > 86400_000, "el cobro quedó dos días atrás");
    assert.equal(r.turno_caja_id, null);
    assert.ok(r.creado_por, "queda quién lo cargó");
  }
});

test("el cobro de otro día pide motivo, no puede ser futuro ni de hace más de 90 días, ni en efectivo ni a cuenta", async () => {
  await t.falla(() => como(uDueno, () => vender("transferencia", { cobradoEn: hace(1) })), /motivo/);
  await t.falla(() => como(uDueno, () => vender("transferencia", { cobradoEn: hace(1), motivo: "  " })), /motivo/);
  await t.falla(() => como(uDueno, () => vender("transferencia", { cobradoEn: new Date(Date.now() + 3600_000).toISOString(), motivo: "Mañana" })), /futura/);
  await t.falla(() => como(uDueno, () => vender("transferencia", { cobradoEn: hace(120), motivo: "Muy viejo" })), /90 días/);
  await t.falla(() => como(uDueno, () => vender("efectivo", { cobradoEn: hace(1), motivo: "Pagó en efectivo" })), /efectivo/);
  await t.falla(() => como(uDueno, () => vender("transferencia", { motivo: "Sin fecha" })), /motivo es de un cobro/);
});

test("un cobro de ahora no queda marcado", async () => {
  const v = await como(uRec, async () => {
    const [{ r }] = await vender("transferencia");
    await t.db.query("reset role");
    return (await t.q(`select otro_dia_motivo, registrada_en from public.ventas where id = $1`, [r.venta_id]))[0];
  });
  assert.equal(v.otro_dia_motivo, null);
  assert.equal(v.registrada_en, null);
});

test("el comprobante se guarda en la transferencia, y tiene que ser de este socio", async () => {
  const bueno = `${t.g}/${socio}/${crypto.randomUUID()}.jpg`;
  const p = await como(uRec, async () => {
    const [{ r }] = await vender("transferencia", { comprobante: bueno });
    await t.db.query("reset role");
    return (await t.q(`select medio, comprobante_path from public.pagos where venta_id = $1`, [r.venta_id]))[0];
  });
  assert.equal(p.comprobante_path, bueno);
  await t.falla(() => como(uRec, () => vender("transferencia", { comprobante: `${t.g}/${otroSocio}/x.jpg` })), /no es de este socio/);
  await t.falla(() => como(uRec, () => vender("transferencia", { comprobante: `otro-gimnasio/${socio}/x.jpg` })), /no es de este socio/);
  await t.falla(() => como(uRec, () => vender("transferencia", { comprobante: `${t.g}/${socio}/../x.jpg` })), /no es de este socio/);
  // Con dos transferencias no se sabe a cuál pegarlo.
  const dos = JSON.stringify([{ medio: "transferencia", monto: 400 }, { medio: "transferencia", monto: 600 }]);
  await t.falla(() => como(uDueno, () => t.q(`select public.vender($1, $2, $3, $4, null, null, null, null, $5)`,
    [t.sede, itemsDe(), dos, socio, `${t.g}/${socio}/${crypto.randomUUID()}.jpg`])), /un pago por transferencia/);
});

test("el medio por defecto: todos lo leen, solo dueño y encargado lo cambian", async () => {
  assert.equal((await como(uRec, async () => (await t.q(`select public.config_cobro($1) as c`, [t.g]))[0].c)).medio_defecto, "efectivo");
  await t.falla(() => como(uRec, () => t.q(`select public.guardar_config_cobro($1, 'transferencia')`, [t.g])), /Sin permiso/);
  await t.falla(() => como(uDueno, () => t.q(`select public.guardar_config_cobro($1, 'bitcoin')`, [t.g])), /Medio de pago por defecto/);
  const c = await como(uEnc, async () => {
    await t.q(`select public.guardar_config_cobro($1, 'debito')`, [t.g]);
    return (await t.q(`select public.config_cobro($1) as c`, [t.g]))[0].c;
  });
  assert.equal(c.medio_defecto, "debito");
});

test("contexto_cobro: el dueño puede cobrar otro día y la recepción no; dice qué cubre la próxima cuota", async () => {
  const dueno = await como(uDueno, async () => (await t.q(`select public.contexto_cobro($1, $2) as c`, [t.sede, socio]))[0].c);
  const rec = await como(uRec, async () => (await t.q(`select public.contexto_cobro($1, $2) as c`, [t.sede, socio]))[0].c);
  assert.equal(dueno.puede_otro_dia, true);
  assert.equal(dueno.puede_cambiar_medio, true);
  assert.equal(rec.puede_otro_dia, false);
  assert.equal(rec.puede_cambiar_medio, false);
  assert.ok(dueno.cubre?.desde && dueno.cubre?.hasta && new Date(dueno.cubre.hasta) > new Date(dueno.cubre.desde), "cubre un período");
  assert.equal(dueno.reciente, null);
  assert.equal(dueno.operador, null);
});

test("contexto_cobro avisa del doble cobro (sin frenar) y no deja ver otro gimnasio", async () => {
  const [{ id: su }] = await t.q(`select id from public.suscripciones where socio_id = $1`, [socio]);
  const [{ id: eq }] = await t.q(`select id from public.equipo where usuario_id = $1`, [uRec]);
  const [{ id: v }] = await t.q(`insert into public.ventas (gimnasio_id, sede_id, socio_id, origen, creado_por) values ($1, $2, $3, 'recepcion', $4) returning id`,
    [t.g, t.sede, socio, eq]);
  await t.q(`insert into public.venta_items (gimnasio_id, venta_id, tipo, plan_id, suscripcion_id, descripcion, precio_unitario)
             values ($1, $2, 'cuota', $3, $4, 'Cuota', 25000)`, [t.g, v, t.ctx.planes.full, su]);
  await t.q(`insert into public.pagos (gimnasio_id, venta_id, medio, monto, estado, aprobado_en) values ($1, $2, 'transferencia', 25000, 'aprobado', now())`, [t.g, v]);
  const c = await como(uDueno, async () => (await t.q(`select public.contexto_cobro($1, $2) as c`, [t.sede, socio]))[0].c);
  assert.ok(c.reciente, "avisa que se cobró hace un momento");
  assert.equal(c.reciente.quien, "Sofi");
  assert.equal(Number(c.reciente.total), 25000);
  assert.ok(c.reciente.hace_seg >= 0 && c.reciente.hace_seg < 120);
  // Un usuario que no es del equipo no ve nada.
  const [{ id: ajeno }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`ajeno${Math.random()}@ejemplo.invalid`]);
  await t.falla(() => como(ajeno, () => t.q(`select public.contexto_cobro($1, $2)`, [t.sede, socio])), /Sin permiso/);
});

test("anon no ejecuta nada de esto", async () => {
  const [{ a, b, c }] = await t.q(`select has_function_privilege('anon', 'public.contexto_cobro(uuid, uuid)', 'execute') a,
    has_function_privilege('anon', 'public.guardar_config_cobro(uuid, text)', 'execute') b,
    has_function_privilege('anon', 'public.vender(uuid, jsonb, jsonb, uuid, uuid, uuid, timestamptz, text, text)', 'execute') c`);
  assert.deepEqual([a, b, c], [false, false, false]);
});
