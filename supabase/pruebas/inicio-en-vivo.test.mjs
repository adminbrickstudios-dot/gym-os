// VD-12b/c/d + VD-23b (1201): últimas entradas en vivo, Para hacer hoy, lo cobrado para la recepción
// solo si el dueño lo prende, mini gráfico en los 8 números y la meta de visitas del mes.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir } from "./_comun.mjs";

let t, uDueno, uRec, uProfe, uEnc;
before(async () => {
  t = await abrir("prueba-inicio-en-vivo");
  const crear = async (rol, n) => {
    const [{ id: u }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`${rol}${Math.random()}@ejemplo.invalid`]);
    await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,$3,$4)`, [t.g, u, n, rol]);
    return u;
  };
  uDueno = await crear("dueno", "Sofía"); uRec = await crear("recepcion", "Ana"); uProfe = await crear("profe", "Pablo"); uEnc = await crear("encargado", "Beto");
});
after(async () => t && t.cerrar());
async function como(u, fn) {
  await t.db.query("set role authenticated");
  await t.q(`select set_config('request.jwt.claims', $1, false)`, [JSON.stringify({ sub: u, role: "authenticated" })]);
  try { return await fn(); } finally { await t.db.query("reset role"); await t.q(`select set_config('request.jwt.claims', '', false)`); }
}
const numeros = (u) => como(u, async () => (await t.q(`select public.numeros_inicio($1) as n`, [t.g]))[0].n);
const claves = (r) => r.numeros.map((n) => n.clave);

test("VD-12c: la recepción no ve lo cobrado salvo que el dueño lo prenda; el encargado sí", async () => {
  assert.ok(!claves(await numeros(uRec)).includes("cobrado"));
  assert.ok(claves(await numeros(uEnc)).includes("cobrado"));
  await t.q(`update public.configuracion_gimnasio set recepcion_ve_cobrado = true where gimnasio_id = $1`, [t.g]);
  const r = await numeros(uRec);
  assert.deepEqual(claves(r), ["adentro", "entraron", "cobrado", "a_cobrar"]);
  assert.equal(r.numeros.find((n) => n.clave === "cobrado").formato, "pesos");
  assert.ok(r.disponibles.some((x) => x.clave === "cobrado"));
  await t.q(`update public.configuracion_gimnasio set recepcion_ve_cobrado = false where gimnasio_id = $1`, [t.g]);
  assert.ok(!claves(await numeros(uRec)).includes("cobrado"));
});

test("VD-12d: cada número tiene su serie de 7 días y el último punto es el número de hoy", async () => {
  const todas = [];
  for (const par of [["adentro", "entraron", "cobrado", "a_cobrar"], ["activos", "altas_mes", "bajas_mes", "ocupacion"]]) {
    await t.q(`update public.configuracion_gimnasio set numeros_inicio = $2 where gimnasio_id = $1`, [t.g, par]);
    const d = await numeros(uDueno);
    for (const n of d.numeros) {
      assert.equal(n.serie?.length, 7, `${n.clave} sin serie de 7`);
      assert.equal(Number(n.serie[6]), Number(n.valor), `${n.clave}: el último punto no es el valor`);
      todas.push(n.clave);
    }
  }
  assert.ok(todas.length >= 7, `solo ${todas.join(",")}`);
});

test("VD-12b: últimas entradas de hoy con el rechazado y si corresponde cobrar; el profe no entra", async () => {
  const s = t.ctx.socios;
  await t.q(`insert into public.ingresos (gimnasio_id, sede_id, socio_id, via_acceso, resultado, color, motivo, texto)
             values ($1,$2,$3,'recepcion','rechazado','rojo','vencida','Venció hace días')`, [t.g, t.sede, s.vencida]);
  await t.q(`insert into public.ingresos (gimnasio_id, sede_id, socio_id, via_acceso, resultado, via_habilitante, color, motivo, texto)
             values ($1,$2,$3,'qr_socio','entro','membresia','verde','al_dia','Al día')`, [t.g, t.sede, s.al_dia]);
  const lista = await como(uRec, async () => (await t.q(`select public.ultimas_entradas($1, 8) as r`, [t.g]))[0].r);
  assert.equal(lista.length, 2);
  const rech = lista.find((x) => x.resultado === "rechazado");
  assert.equal(rech.socio_id, s.vencida);
  assert.equal(rech.cobrar, true);
  assert.equal(lista.find((x) => x.resultado === "entro").cobrar, false);
  assert.equal(lista.find((x) => x.resultado === "entro").via, "qr_socio");
  assert.equal(new Date(lista[0].momento) >= new Date(lista[1].momento), true);
  await como(uProfe, () => t.falla(() => t.q(`select public.ultimas_entradas($1)`, [t.g]), /permiso/i));
});

test("VD-12b: Para hacer hoy trae solo lo que hay y la recepción no ve a los que no vienen", async () => {
  const d = await como(uDueno, async () => (await t.q(`select public.para_hacer_hoy($1) as r`, [t.g]))[0].r);
  assert.ok(Array.isArray(d));
  for (const x of d) { assert.ok(x.cantidad > 0 && x.texto && x.href.startsWith("/")); }
  const r = await como(uRec, async () => (await t.q(`select public.para_hacer_hoy($1) as r`, [t.g]))[0].r);
  assert.ok(!r.some((x) => x.clave === "no_vienen"));
  await como(uProfe, () => t.falla(() => t.q(`select public.para_hacer_hoy($1)`, [t.g]), /permiso/i));
});

test("VD-23b: solo el dueño cambia la meta de visitas; entre 1 y 31; el encargado la ve", async () => {
  await como(uEnc, async () => {
    assert.equal((await t.q(`select public.meta_visitas_panel($1) as m`, [t.g]))[0].m, 12);
    await t.falla(() => t.q(`select public.guardar_meta_visitas($1, 8)`, [t.g]), /permiso/i);
  });
  await como(uRec, () => t.falla(() => t.q(`select public.meta_visitas_panel($1)`, [t.g]), /permiso/i));
  await como(uDueno, async () => {
    await t.falla(() => t.q(`select public.guardar_meta_visitas($1, 0)`, [t.g]), /entre 1 y 31/);
    await t.falla(() => t.q(`select public.guardar_meta_visitas($1, 32)`, [t.g]), /entre 1 y 31/);
    await t.q(`select public.guardar_meta_visitas($1, 8)`, [t.g]);
    assert.equal((await t.q(`select public.meta_visitas_panel($1) as m`, [t.g]))[0].m, 8);
  });
});
