// REV-1a (0120): al que dejaron pasar sin poder entrar, Vencen hoy se lo
// recuerda hoy y mañana mientras siga sin poder entrar. Calculado: si paga,
// sale de la lista. La recepción ve los que dejó pasar ella; el dueño, todos.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir } from "./_comun.mjs";

let t, u = {}, eq = {};
before(async () => {
  t = await abrir("prueba-prometieron-pagar");
  for (const [r, n] of [["dueno", "Sofía"], ["recepcion", "Ana"], ["otra", "Bea"]]) {
    const [{ id }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`${r}${Math.random()}@ejemplo.invalid`]);
    const [{ id: e }] = await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,$3,$4) returning id`, [t.g, id, n, r === "otra" ? "recepcion" : r]);
    u[r] = id; eq[r] = e;
  }
});
after(async () => t && t.cerrar());

const sinPlan = async (n) => (await t.q(`insert into public.socios (gimnasio_id, nombre, apellido) values ($1,'Promete',$2) returning id`, [t.g, n]))[0].id;
const forzado = (socio, quien, momento = "now()") => t.q(`insert into public.ingresos (gimnasio_id, sede_id, socio_id, momento, via_acceso, resultado, color, motivo, texto, forzado_motivo, registrado_por)
  values ($1, $2, $3, ${momento}, 'recepcion', 'forzado', 'rojo', 'sin_plan', 'Sin plan activo', 'Paga a la tarde', $4)`, [t.g, t.sede, socio, eq[quien]]);

test("hoy y ayer, mientras no pueda entrar; la recepción ve los suyos", async () => {
  const [a, b, viejo, pago] = [await sinPlan("A"), await sinPlan("B"), await sinPlan("Viejo"), await sinPlan("Pagó")];
  await forzado(a, "recepcion");
  await forzado(b, "otra", "now() - interval '1 day'");
  await forzado(viejo, "recepcion", "now() - interval '3 days'");
  await forzado(pago, "recepcion");
  // "Pagó": un pase del día que lo cubre (ya puede entrar) → sale de la lista.
  const [{ id: pase }] = await t.q(`insert into public.planes (gimnasio_id, tipo, nombre) values ($1, 'pase_diario', 'Pase prometido') returning id`, [t.g]);
  await t.q(`insert into public.pases_diarios (gimnasio_id, socio_id, plan_id, desde, hasta)
             values ($1, $2, $3, now() - interval '1 hour', now() + interval '6 hours')`, [t.g, pago, pase]);
  const nombres = (l) => l.map((x) => x.socio).sort();
  await t.comoUsuario(u.dueno, async () => {
    const [{ r }] = await t.q(`select public.prometieron_pagar($1) r`, [t.g]);
    assert.ok(nombres(r).includes("Promete A") && nombres(r).includes("Promete B"), "hoy y ayer");
    assert.ok(!nombres(r).includes("Promete Viejo"), "hace 3 días ya no");
    assert.ok(!nombres(r).includes("Promete Pagó"), "el que ya pagó (puede entrar) sale solo");
    const fa = r.find((x) => x.socio === "Promete A");
    assert.equal(fa.motivo, "Paga a la tarde"); assert.equal(fa.por, "Ana"); assert.match(fa.texto, /Sin plan/);
  });
  await t.comoUsuario(u.recepcion, async () => {
    const [{ r }] = await t.q(`select public.prometieron_pagar($1) r`, [t.g]);
    assert.ok(nombres(r).includes("Promete A") && !nombres(r).includes("Promete B"), "Ana ve los que dejó pasar ella");
  });
  const [{ id: anon }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`x${Math.random()}@ejemplo.invalid`]);
  await t.comoUsuario(anon, () => t.falla(() => t.q(`select public.prometieron_pagar($1)`, [t.g]), /permiso|equipo|acceso/i));
});
