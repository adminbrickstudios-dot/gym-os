// EQU-2 (0101, D3): el profe busca socios y ve nombre, foto (si tiene) y
// semáforo con un texto genérico; nada de plata, teléfono ni DNI. Los dados
// de baja no salen; otro gimnasio no.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir } from "./_comun.mjs";

let t, uProfe;
before(async () => {
  t = await abrir("prueba-profe-busca");
  [{ id: uProfe }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`p${Math.random()}@ejemplo.invalid`]);
  await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,'Profe','profe')`, [t.g, uProfe]);
});
after(async () => t && t.cerrar());

test("nombre, foto y semáforo; sin plata ni datos de contacto", async () => {
  const filas = await t.comoUsuario(uProfe, () => t.q(`select * from public.buscar_socios_profe($1, 'testigo')`, [t.g]));
  assert.ok(filas.length >= 2);
  assert.deepEqual(Object.keys(filas[0]).sort(), ["color", "nombre", "puede", "socio_id", "texto", "tiene_foto"]);
  for (const f of filas) assert.match(f.texto, /^(Puede|No puede) entrar$/);
  assert.ok(filas.some((f) => !f.puede), "un vencido sale en rojo");
  await t.comoUsuario(uProfe, () => t.falla(() => t.q(`select * from public.buscar_socios_profe($1, 'a')`, [t.g]), /2 letras/));
  await t.comoUsuario(uProfe, () => t.falla(() => t.q(`select * from public.buscar_socios($1, 'testigo')`, [t.g]), /permiso|rol|acceso/i));
});

test("los dados de baja no salen; alguien de afuera no busca", async () => {
  await t.q(`insert into public.socios (gimnasio_id, nombre, apellido, dado_de_baja_en, motivo_baja) values ($1,'Zzbaja','Ido', now(), 'otro')`, [t.g]);
  const filas = await t.comoUsuario(uProfe, () => t.q(`select * from public.buscar_socios_profe($1, 'zzbaja')`, [t.g]));
  assert.equal(filas.length, 0);
  const [{ id: otro }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`x${Math.random()}@ejemplo.invalid`]);
  await t.comoUsuario(otro, () => t.falla(() => t.q(`select * from public.buscar_socios_profe($1, 'testigo')`, [t.g]), /permiso|equipo|acceso/i));
});
