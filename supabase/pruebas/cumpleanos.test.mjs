// Cumpleaños (0038): con un momento fijo; el 29/2 se festeja el 28/2 en años
// no bisiestos; los dados de baja no; el mensaje sale de la plantilla.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir } from "./_comun.mjs";

let t, rec;
before(async () => {
  t = await abrir("prueba-cumple");
  const [{ id }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`rec${Math.random()}@ejemplo.invalid`]);
  await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,'Rec','recepcion')`, [t.g, id]);
  rec = id;
});
after(async () => t && t.cerrar());

test("cumplen hoy, con edad y mensaje; 29/2 el 28/2; baja no", async () => {
  const s = (nombre, nac, baja = null) => t.q(`insert into public.socios (gimnasio_id, nombre, apellido, fecha_nacimiento, telefono, dado_de_baja_en, motivo_baja)
     values ($1, $2, 'Cumple', $3, '+5490000999001', $4, case when $4::timestamptz is null then null else 'otro' end) returning id`, [t.g, nombre, nac, baja]);
  await s("Lucas", "1990-03-15"); await s("Bisiesta", "2000-02-29"); await s("Ido", "1985-03-15", "2026-01-01T00:00:00Z");
  await t.comoUsuario(rec, async () => {
    const c = (await t.q(`select public.cumplen_hoy($1, '2026-03-15T15:00:00-03:00') as c`, [t.g]))[0].c;
    assert.deepEqual(c.map((x) => [x.nombre, x.cumple]), [["Lucas Cumple", 36]]);
    assert.match(c[0].mensaje, /Lucas/);
    const f = (await t.q(`select public.cumplen_hoy($1, '2027-02-28T12:00:00-03:00') as c`, [t.g]))[0].c;
    assert.deepEqual(f.map((x) => x.nombre), ["Bisiesta Cumple"]);
    const g = (await t.q(`select public.cumplen_hoy($1, '2028-02-28T12:00:00-03:00') as c`, [t.g]))[0].c;
    assert.equal(g.length, 0, "en un año bisiesto se festeja el 29");
  });
});
