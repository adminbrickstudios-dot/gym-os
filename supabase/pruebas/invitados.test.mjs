// Invitados (0053): con DNI, de un socio que puede entrar; límite por mes por
// socio y por DNI; un socio no es invitado; desde la app y la recepción
// confirma; el profe no; 0 = sin invitados.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir } from "./_comun.mjs";

let t, u = {}, socioUsuario, anfitrion;
before(async () => {
  t = await abrir("prueba-invitados");
  for (const r of ["recepcion", "profe"]) {
    const [{ id }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`${r}${Math.random()}@ejemplo.invalid`]);
    await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,$3,$4)`, [t.g, id, r, r]);
    u[r] = id;
  }
  // Un anfitrión que puede entrar hoy (los casos testigo están armados para el 14/11): cobertura de hoy a 30 días.
  [{ id: anfitrion }] = await t.q(`insert into public.socios (gimnasio_id, nombre, apellido) values ($1,'Ana','Anfitriona') returning id`, [t.g]);
  const [{ id: su }] = await t.q(`insert into public.suscripciones (gimnasio_id, socio_id, plan_id, inicio) values ($1,$2,$3, now() - interval '1 day') returning id`, [t.g, anfitrion, t.ctx.planes.full]);
  await t.q(`insert into public.coberturas (gimnasio_id, suscripcion_id, socio_id, desde, hasta, origen, motivo) values ($1,$2,$3, now() - interval '1 day', now() + interval '30 days', 'cortesia', 'prueba')`, [t.g, su, anfitrion]);
  [{ id: socioUsuario }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`s${Math.random()}@ejemplo.invalid`]);
  await t.q(`update public.socios set usuario_id = $1 where id = $2`, [socioUsuario, anfitrion]);
});
after(async () => t && t.cerrar());

async function como(sub, fn) {
  await t.q(`set local role authenticated`);
  await t.q(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub, role: "authenticated" })]);
  try { return await fn(); } finally { await t.q(`reset role`).catch(() => {}); }
}
const registrar = (socio, nombre, dni) => t.q(`select public.registrar_invitado($1, $2, $3, $4, $5) as id`, [t.g, t.sede, socio, nombre, dni]);

test("la recepción anota con DNI; límite por socio y por DNI; socios y morosos no", async () => {
  await como(u.recepcion, async () => {
    await registrar(anfitrion, "Pedro Amigo", "35.111.222");
    await t.falla(() => registrar(anfitrion, "Sin Dni", ""), /nunca se anota anónimo/);
    await t.falla(() => registrar(t.ctx.socios.vencida, "Otro Amigo", "35111333"), /Invita un socio que puede entrar hoy/);
  });
  await t.q(`update public.socios set dni = '30999888' where id = $1`, [t.ctx.socios.vencida]);
  await como(u.recepcion, () => t.falla(() => registrar(anfitrion, "Es Socio", "30999888"), /es de un socio/));
  // Desde la app: el segundo del mes; el tercero no.
  await como(socioUsuario, async () => {
    await t.q(`select public.invitar($1, $2, 'Laura Amiga', '36111222')`, [t.g, anfitrion]);
    await t.falla(() => t.q(`select public.invitar($1, $2, 'Tercera Amiga', '36111333')`, [t.g, anfitrion]), /Ya invitó a 2 este mes \(el límite es 2\)/);
    const [{ m }] = await t.q(`select public.mis_invitados($1, $2) as m`, [t.g, anfitrion]);
    assert.deepEqual([m.limite, m.usados, m.hoy.length], [2, 2, 2]);
  });
  await como(u.recepcion, async () => {
    const [{ h }] = await t.q(`select public.invitados_de_hoy($1) as h`, [t.g]);
    const laura = h.find((x) => x.nombre === "Laura Amiga");
    assert.equal(laura.entro_en, null);
    await t.q(`select public.confirmar_invitado($1, $2)`, [laura.id, t.sede]);
    await t.falla(() => t.q(`select public.confirmar_invitado($1, $2)`, [laura.id, t.sede]), /ya entró/);
  });
  await como(u.profe, () => t.falla(() => t.q(`select public.invitados_de_hoy($1)`, [t.g]), /Sin permiso/));
});

test("0 = sin invitados", async () => {
  await t.q(`update public.configuracion_gimnasio set invitados_por_mes = 0 where gimnasio_id = $1`, [t.g]);
  await como(u.recepcion, () => t.falla(() => registrar(anfitrion, "Nadie Nuevo", "37111222"), /no recibe invitados/));
});
