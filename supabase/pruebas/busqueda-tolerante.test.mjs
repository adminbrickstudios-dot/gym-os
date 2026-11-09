// DETALLE #1: la búsqueda de socios no se traba con acentos, mayúsculas ni errores de tipeo.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir } from "./_comun.mjs";

let t, recepcion;
before(async () => {
  t = await abrir("prueba-busqueda-tolerante");
  const [{ id }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`rec${Math.random()}@ejemplo.invalid`]);
  await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,'Rec','recepcion')`, [t.g, id]);
  recepcion = id;
  await t.q(`insert into public.socios (gimnasio_id, nombre, apellido, telefono) values ($1,'José','González','+5490000999111'), ($1,'María','Pérez','+5490000999222')`, [t.g]);
});
after(async () => t && t.cerrar());
const buscar = (texto) => t.comoUsuario(recepcion, async () => (await t.q(`select nombre from public.buscar_socios($1, $2)`, [t.g, texto])).map((r) => r.nombre));

test("acentos y mayúsculas: 'jose' → José, 'GONZALEZ' → González", async () => {
  assert.ok((await buscar("jose")).includes("José González"));
  assert.ok((await buscar("GONZALEZ")).includes("José González"));
});
test("errores de tipeo: 'gonzales' → González, 'perés' → Pérez; no trae a cualquiera", async () => {
  const g = await buscar("gonzales");
  assert.ok(g.includes("José González"));
  assert.ok(!g.includes("María Pérez"));
  assert.ok((await buscar("peres")).includes("María Pérez"));
  assert.deepEqual(await buscar("zzzzqq"), []);
});
