// Racha (0091): semanas seguidas viniendo (la actual cuenta si ya vino; si
// no, hasta la anterior) y entradas del mes; los rechazados no cuentan.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir } from "./_comun.mjs";

let t, socio, uSocio;
before(async () => {
  t = await abrir("prueba-racha");
  const [{ id }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`socio${Math.random()}@ejemplo.invalid`]);
  uSocio = id;
  [{ id: socio }] = await t.q(`insert into public.socios (gimnasio_id, nombre, apellido, usuario_id) values ($1,'Racha','Prueba',$2) returning id`, [t.g, id]);
});
after(async () => t && t.cerrar());
const entrar = (haceDias, resultado = "entro") => t.q(`insert into public.ingresos (gimnasio_id, sede_id, socio_id, momento, via_acceso, resultado, via_habilitante, color, motivo, texto)
  values ($1,$2,$3, now() - make_interval(days => $4), 'recepcion', $5, 'membresia', 'verde', 'al_dia', 'x')`, [t.g, t.sede, socio, haceDias, resultado]);
const racha = async () => {
  await t.db.query("set role authenticated");
  await t.q(`select set_config('request.jwt.claims', $1, false)`, [JSON.stringify({ sub: uSocio, role: "authenticated" })]);
  try { return (await t.q(`select public.racha_socio($1) as r`, [socio]))[0].r; }
  finally { await t.db.query("reset role"); await t.q(`select set_config('request.jwt.claims', '', false)`); }
};

test("sin entradas: 0; tres semanas seguidas (hasta la pasada): 3; una semana sin venir corta", async () => {
  assert.equal((await racha()).semanas_seguidas, 0);
  // Hace 7, 14 y 21 días (semanas pasada, antepasada y la de antes), y una rechazada hace 28 que no cuenta.
  for (const d of [7, 14, 21]) await entrar(d);
  await entrar(28, "rechazado");
  const r = await racha();
  assert.equal(r.vino_esta_semana, false);
  assert.equal(r.semanas_seguidas, 3, "la semana en curso todavía no cuenta, pero no corta");
  await entrar(0);
  const r2 = await racha();
  assert.equal(r2.vino_esta_semana, true);
  assert.equal(r2.semanas_seguidas, 4);
});
