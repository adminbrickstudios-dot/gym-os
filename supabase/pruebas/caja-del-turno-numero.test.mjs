// F1.3 · "Caja del turno": cuántos cobros lleva MI turno abierto. Un conteo, nunca plata (el arqueo es ciego); 0 con la caja cerrada;
// solo lo ve la recepción; no cuenta cobros sin confirmar ni el turno de otra persona.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir } from "./_comun.mjs";

let t, uDueno, uRec, uRec2, caja, caja2;
before(async () => {
  t = await abrir("prueba-caja-turno-numero");
  const crear = async (rol, n) => {
    const [{ id: u }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`${rol}${Math.random()}@ejemplo.invalid`]);
    await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,$3,$4)`, [t.g, u, n, rol]);
    return u;
  };
  uDueno = await crear("dueno", "Sofía"); uRec = await crear("recepcion", "Ana"); uRec2 = await crear("recepcion", "Beto");
  [{ id: caja }] = await t.q(`insert into public.cajas (gimnasio_id, sede_id, nombre) values ($1,$2,'Mostrador') returning id`, [t.g, t.sede]);
  [{ id: caja2 }] = await t.q(`insert into public.cajas (gimnasio_id, sede_id, nombre) values ($1,$2,'Barra') returning id`, [t.g, t.sede]);
});
after(async () => t && t.cerrar());
async function como(u, fn) {
  await t.db.query("set role authenticated");
  await t.q(`select set_config('request.jwt.claims', $1, false)`, [JSON.stringify({ sub: u, role: "authenticated" })]);
  try { return await fn(); } finally { await t.db.query("reset role"); await t.q(`select set_config('request.jwt.claims', '', false)`); }
}
const numeros = (u) => como(u, async () => (await t.q(`select public.numeros_inicio($1) as n`, [t.g]))[0].n);
const equipoId = async (u) => (await t.q(`select id from public.equipo where gimnasio_id = $1 and usuario_id = $2`, [t.g, u]))[0].id;
const turno = async (u, cerrado = false, cj = caja) => (await t.q(`insert into public.turnos_caja (gimnasio_id, caja_id, abierto_por, monto_inicial, cerrado_en, cerrado_por, monto_contado, monto_esperado)
  values ($1,$2,$3,1000, $4, $5, $6, $6) returning id`, [t.g, cj, await equipoId(u), cerrado ? new Date() : null, cerrado ? await equipoId(u) : null, cerrado ? 1000 : null]))[0].id;
const venta = (tc, estado) => t.q(`insert into public.ventas (gimnasio_id, sede_id, estado, origen, turno_caja_id, confirmada_en)
  values ($1,$2,$3,'recepcion',$4, case when $3 = 'confirmada' then now() end)`, [t.g, t.sede, estado, tc]);

test("con la caja cerrada vale 0; el dueño no lo tiene; la recepción lo ve como número disponible", async () => {
  const r = await numeros(uRec);
  const n = r.numeros.find((x) => x.clave === "caja_turno");
  assert.equal(n.valor, 0);
  assert.equal(n.etiqueta, "Caja del turno");
  assert.ok(r.disponibles.some((x) => x.clave === "caja_turno"));
  const d = await numeros(uDueno);
  assert.ok(!d.numeros.some((x) => x.clave === "caja_turno") && !d.disponibles.some((x) => x.clave === "caja_turno"));
});

test("cuenta los cobros confirmados de MI turno abierto; sin plata; no cuenta pendientes ni turnos ajenos o cerrados", async () => {
  const cerrado = await turno(uRec, true);
  const mio = await turno(uRec);
  const ajeno = await turno(uRec2, false, caja2);
  await venta(mio, "confirmada"); await venta(mio, "confirmada"); await venta(mio, "pendiente");
  await venta(ajeno, "confirmada"); await venta(cerrado, "confirmada");
  const n = (await numeros(uRec)).numeros.find((x) => x.clave === "caja_turno");
  assert.equal(n.valor, 2, "2 cobros confirmados de mi turno abierto");
  assert.equal(n.formato, undefined, "es un conteo: nunca pesos");
  assert.equal(n.serie, undefined);
  assert.equal((await numeros(uRec2)).numeros.find((x) => x.clave === "caja_turno").valor, 1, "el turno de Beto tiene el suyo");
});

test("con Caja apagada en el gimnasio no se ofrece; guardar acepta la clave y rechaza una inventada", async () => {
  await t.q(`update public.configuracion_gimnasio set secciones_apagadas = array['caja'] where gimnasio_id = $1`, [t.g]);
  assert.ok(!(await numeros(uRec)).disponibles.some((x) => x.clave === "caja_turno"));
  await t.q(`update public.configuracion_gimnasio set secciones_apagadas = '{}' where gimnasio_id = $1`, [t.g]);
  await como(uDueno, async () => {
    await t.q(`select public.guardar_numeros_inicio($1, array['caja_turno','adentro'])`, [t.g]);
    await t.falla(() => t.q(`select public.guardar_numeros_inicio($1, array['caja_inventada'])`, [t.g]), /no existe/);
  });
});
