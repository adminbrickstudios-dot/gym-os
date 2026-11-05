// COM-10 (0130): el link de reseñas lo carga el dueño; Avisos de hoy sugiere
// pedir la reseña al que llegó a su entrada 10; la app pregunta 0 a 10 (una
// vez cada 90 días) y los 9 y 10 quedan como promotores para el dueño.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir } from "./_comun.mjs";

let t, u = {}, socio, us;
before(async () => {
  t = await abrir("prueba-resena");
  for (const rol of ["dueno", "recepcion"]) {
    const [{ id }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`${rol}${Math.random()}@ejemplo.invalid`]);
    await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,$3,$4)`, [t.g, id, rol, rol]);
    u[rol] = id;
  }
  [{ id: us }] = await t.q(`insert into auth.users (phone) values ('+5490000555123') returning id`);
  [{ id: socio }] = await t.q(`insert into public.socios (gimnasio_id, nombre, apellido, telefono, usuario_id) values ($1,'Diez','Veces','+5490001112345',$2) returning id`, [t.g, us]);
  // 10 días distintos: el décimo, hoy.
  for (let d = 9; d >= 0; d--) await t.q(`insert into public.ingresos (gimnasio_id, sede_id, socio_id, momento, via_acceso, resultado, color, motivo, texto)
     values ($1,$2,$3, now() - make_interval(days => $4 * 2), 'recepcion', 'entro', 'verde', 'al_dia', 'Al día')`, [t.g, t.sede, socio, d]);
});
after(async () => t && t.cerrar());

test("link, aviso de la entrada 10, encuesta y promotores", async () => {
  const bandeja = async () => (await t.comoUsuario(u.recepcion, async () => (await t.q(`select public.bandeja_avisos($1) b`, [t.g]))[0].b));
  assert.equal((await bandeja()).find((b) => b.socio_id === socio && b.clave === "resena"), undefined, "sin link cargado no se sugiere");
  await t.comoUsuario(u.dueno, async () => {
    await t.falla(() => t.q(`select public.guardar_link_resena($1, 'g.page/x')`, [t.g]), /https:\/\//);
  });
  await t.q(`update public.configuracion_gimnasio set link_resena = 'https://g.page/r/prueba/review' where gimnasio_id = $1`, [t.g]);
  const aviso = (await bandeja()).find((b) => b.socio_id === socio && b.clave === "resena");
  assert.ok(aviso, "llegó a la entrada 10: Avisos de hoy sugiere la reseña");
  assert.match(aviso.mensaje, /https:\/\/g\.page\/r\/prueba\/review/);
  await t.q(`set local role authenticated`);
  await t.q(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: us, role: "authenticated" })]);
  const [{ e }] = await t.q(`select public.encuesta_socio($1) e`, [socio]);
  assert.equal(e.pendiente, true);
  await t.falla(() => t.q(`select public.responder_encuesta($1, 11)`, [socio]), /del 0 al 10/);
  const [{ r }] = await t.q(`select public.responder_encuesta($1, 10) r`, [socio]);
  assert.equal(r.promotor, true); assert.match(r.link_resena, /g\.page/);
  await t.falla(() => t.q(`select public.responder_encuesta($1, 3)`, [socio]), /Ya contestaste/);
  await t.q(`reset role`);
  await t.comoUsuario(u.dueno, async () => {
    const [{ p }] = await t.q(`select public.encuestas_panel($1) p`, [t.g]);
    assert.equal(p.respuestas, 1); assert.equal(Number(p.nps), 100); assert.equal(p.promotores[0].nombre, "Diez Veces");
  });
  await t.comoUsuario(u.recepcion, () => t.falla(() => t.q(`select public.encuestas_panel($1)`, [t.g]), /permiso|rol|acceso/i));
});
