// FA-16 · El socio sube su foto solo si el gimnasio lo permite (apagado por defecto); la recepción la ve "sin confirmar" hasta que
// la confirma o la reemplaza; nadie toca la foto de otro.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir } from "./_comun.mjs";

let t, socioU, otroU, recep, dueno;
async function como(usuario, fn) {
  await t.db.query("set role authenticated");
  await t.q(`select set_config('request.jwt.claims', $1, false)`, [JSON.stringify({ sub: usuario, role: "authenticated" })]);
  try { return await fn(); } finally { await t.db.query("reset role"); await t.q(`select set_config('request.jwt.claims', '', false)`); }
}
const S = () => t.ctx.socios;
const ruta = (n = "a".repeat(32)) => `${t.g}/${S().al_dia}/foto-${n}.jpg`;

before(async () => {
  t = await abrir("prueba-foto-propia");
  [{ id: socioU }] = await t.q(`insert into auth.users (phone) values ('+549000078000001') returning id`);
  [{ id: otroU }] = await t.q(`insert into auth.users (phone) values ('+549000078000002') returning id`);
  await t.q(`update public.socios set usuario_id = $2 where id = $1`, [S().al_dia, socioU]);
  await t.q(`update public.socios set usuario_id = $2 where id = $1`, [S().por_vencer, otroU]);
  for (const rol of ["recepcion", "dueno"]) {
    const [{ id }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`${rol}${Math.random()}@ejemplo.invalid`]);
    await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,$3,$4)`, [t.g, id, rol, rol]);
    if (rol === "recepcion") recep = id; else dueno = id;
  }
});
after(async () => t && t.cerrar());

test("por defecto está apagado: el socio no puede subir ni preparar la ruta", async () => {
  await como(socioU, async () => {
    assert.equal((await t.q(`select public.foto_propia_permitida($1) p`, [S().al_dia]))[0].p, false);
    await t.falla(() => t.q(`select public.preparar_foto_propia($1)`, [S().al_dia]), /no permite subir la foto/);
    await t.falla(() => t.q(`select public.confirmar_foto_propia($1, $2)`, [S().al_dia, ruta()]), /no permite subir la foto/);
  });
});

test("solo el dueño lo prende; recepción no", async () => {
  await como(recep, () => t.falla(() => t.q(`select public.guardar_foto_socio_permitida($1, true)`, [t.g]), /permiso|rol|acceso/i));
  await como(dueno, async () => { await t.q(`select public.guardar_foto_socio_permitida($1, true)`, [t.g]); });
  await como(socioU, async () => { assert.equal((await t.q(`select public.foto_propia_permitida($1) p`, [S().al_dia]))[0].p, true); });
});

test("prendido: sube la suya (ruta de su carpeta), queda sin confirmar, y la recepción lo ve", async () => {
  await como(socioU, async () => {
    const r = (await t.q(`select public.preparar_foto_propia($1) r`, [S().al_dia]))[0].r;
    assert.match(r, new RegExp(`^${t.g}/${S().al_dia}/foto-[0-9a-f]{32}\\.jpg$`));
    await t.falla(() => t.q(`select public.confirmar_foto_propia($1, $2)`, [S().al_dia, `${t.g}/${S().por_vencer}/foto-${"b".repeat(32)}.jpg`]), /Ruta de foto inválida/);
    await t.falla(() => t.q(`select public.confirmar_foto_propia($1, null)`, [S().al_dia]), /Ruta de foto inválida/);
    assert.equal((await t.q(`select public.confirmar_foto_propia($1, $2) a`, [S().al_dia, ruta()]))[0].a, null);
    assert.equal((await t.q(`select public.foto_propia($1) r`, [S().al_dia]))[0].r, ruta());
  });
  await como(recep, async () => {
    const e = (await t.q(`select public.foto_estado_socio($1) e`, [S().al_dia]))[0].e;
    assert.equal(e.tiene_foto, true);
    assert.equal(e.subida_por_el_socio, true);
  });
});

test("la recepción la confirma (una vez) y deja de estar marcada", async () => {
  await como(recep, async () => {
    await t.q(`select public.confirmar_foto_subida($1)`, [S().al_dia]);
    assert.equal((await t.q(`select public.foto_estado_socio($1) e`, [S().al_dia]))[0].e.subida_por_el_socio, false);
    await t.falla(() => t.q(`select public.confirmar_foto_subida($1)`, [S().al_dia]), /ya estaba confirmada/);
  });
  await como(socioU, () => t.q(`select public.confirmar_foto_propia($1, $2)`, [S().al_dia, ruta("c".repeat(32))]));
  await como(recep, async () => {
    // Si la recepción la reemplaza con la suya, también deja de estar marcada.
    await t.q(`select public.confirmar_foto_socio($1, $2)`, [S().al_dia, ruta("d".repeat(32))]);
    assert.equal((await t.q(`select public.foto_estado_socio($1) e`, [S().al_dia]))[0].e.subida_por_el_socio, false);
  });
});

test("otro socio no toca ni ve la foto de este", async () => {
  await como(otroU, async () => {
    await t.falla(() => t.q(`select public.foto_propia($1)`, [S().al_dia]), /Sin permiso/);
    await t.falla(() => t.q(`select public.preparar_foto_propia($1)`, [S().al_dia]), /Sin permiso/);
    await t.falla(() => t.q(`select public.foto_estado_socio($1)`, [S().al_dia]), /permiso|rol|acceso/i);
  });
});
