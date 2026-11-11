// FA-23 · Lista de espera con plazo: el lugar liberado se ofrece al primero con un plazo; si no acepta pasa al siguiente (sin cron: se
// calcula al consultar); mientras dura la oferta nadie más toma el lugar; sin plazo configurado, todo sigue como siempre.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir } from "./_comun.mjs";

let t, act, clase, u = {};
const S = () => t.ctx.socios;
async function como(usuario, fn) {
  await t.db.query("set role authenticated");
  await t.q(`select set_config('request.jwt.claims', $1, false)`, [JSON.stringify({ sub: usuario, role: "authenticated" })]);
  try { return await fn(); } finally { await t.db.query("reset role"); await t.q(`select set_config('request.jwt.claims', '', false)`); }
}
const reservar = async (socio) => (await t.q(`select privado.reservar($1, $2, now()) r`, [clase, socio]))[0].r;
const fila = async (socio) => (await t.q(`select * from public.reservas where clase_id = $1 and socio_id = $2 and estado <> 'cancelada'`, [clase, socio]))[0];
const liberar = async (socio) => { await t.q(`update public.reservas set estado = 'cancelada', cancelada_en = now(), cancelada_por = 'socio' where clase_id = $1 and socio_id = $2 and estado = 'confirmada'`, [clase, socio]); await t.q(`select privado.promover_espera($1, now())`, [clase]); };

before(async () => {
  t = await abrir("prueba-espera-plazo");
  await t.q(`update public.configuracion_gimnasio set modo_clases = 'reserva', reserva_dias_anticipacion = 30 where gimnasio_id = $1`, [t.g]);
  [{ id: act }] = await t.q(`insert into public.actividades (gimnasio_id, nombre, emoji) values ($1,'Funcional','F') returning id`, [t.g]);
  [{ id: clase }] = await t.q(`insert into public.clases (gimnasio_id, sede_id, actividad_id, inicio, fin, cupo) values ($1,$2,$3, now() + interval '2 days', now() + interval '2 days 1 hour', 1) returning id`, [t.g, t.sede, act]);
  for (const k of ["al_dia", "por_vencer", "vence_hoy"]) {
    const [{ id }] = await t.q(`insert into auth.users (phone) values ($1) returning id`, [`+54900007${String(Math.floor(Math.random() * 1e7)).padStart(7, "0")}`]);
    await t.q(`update public.socios set usuario_id = $2 where id = $1`, [S()[k], id]);
    u[k] = id;
  }
  const [{ id: dueno }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`dueno${Math.random()}@ejemplo.invalid`]);
  await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,'Dueno','dueno')`, [t.g, dueno]);
  u.dueno = dueno;
});
after(async () => t && t.cerrar());

test("sin plazo configurado: el lugar liberado sube solo al primero de la espera (como siempre)", async () => {
  assert.equal((await reservar(S().al_dia)).estado, "confirmada");
  assert.equal((await reservar(S().por_vencer)).estado, "espera");
  await liberar(S().al_dia);
  const f = await fila(S().por_vencer);
  assert.equal(f.estado, "confirmada");
  assert.equal(f.ofrecida_hasta, null);
  await t.q(`update public.reservas set estado = 'cancelada', cancelada_en = now(), cancelada_por = 'socio' where clase_id = $1`, [clase]);
});

test("solo el dueño configura el plazo, de 5 minutos a 24 horas", async () => {
  await como(u.al_dia, () => t.falla(() => t.q(`select public.guardar_espera_plazo($1, 30)`, [t.g]), /permiso|rol|acceso/i));
  await como(u.dueno, async () => {
    await t.falla(() => t.q(`select public.guardar_espera_plazo($1, 2)`, [t.g]), /5 minutos a 24 horas/);
    await t.q(`select public.guardar_espera_plazo($1, 30)`, [t.g]);
  });
  assert.equal((await t.q(`select espera_plazo_min p from public.configuracion_gimnasio where gimnasio_id = $1`, [t.g]))[0].p, 30);
});

test("con plazo: se ofrece (no se confirma), el lugar queda reservado y nadie más lo toma", async () => {
  assert.equal((await reservar(S().al_dia)).estado, "confirmada");
  assert.equal((await reservar(S().por_vencer)).estado, "espera");
  assert.equal((await reservar(S().vence_hoy)).estado, "espera");
  await liberar(S().al_dia);
  const f = await fila(S().por_vencer);
  assert.equal(f.estado, "espera", "no sube solo: se le ofrece");
  assert.ok(f.ofrecida_hasta, "tiene un plazo");
  assert.equal((await fila(S().vence_hoy)).ofrecida_hasta, null, "al segundo todavía no");
  const [{ min }] = await t.q(`select extract(epoch from (ofrecida_hasta - ofrecida_en)) / 60 as min from public.reservas where id = $1`, [f.id]);
  assert.equal(Number(min), 30);
  const [{ n }] = await t.q(`select count(*)::int n from public.avisos_pendientes where socio_id = $1 and clase_id = $2 and texto like '%tenés hasta las%'`, [S().por_vencer, clase]);
  assert.equal(n, 1, "el aviso trae el plazo");
  // Un tercero que reserva ahora no se queda con el lugar ofrecido.
  await t.q(`update public.reservas set estado = 'cancelada', cancelada_en = now(), cancelada_por = 'socio' where clase_id = $1 and socio_id = $2`, [clase, S().vence_hoy]);
  assert.equal((await reservar(S().vence_hoy)).estado, "espera", "el lugar ofrecido cuenta como ocupado");
});

test("el socio ve su oferta y la acepta: queda confirmada", async () => {
  await como(u.por_vencer, async () => {
    const o = (await t.q(`select public.ofertas_socio($1) o`, [S().por_vencer]))[0].o;
    assert.equal(o.length, 1);
    assert.equal(o[0].actividad, "Funcional");
    await t.q(`select public.aceptar_oferta($1)`, [o[0].reserva_id]);
  });
  const f = await fila(S().por_vencer);
  assert.equal(f.estado, "confirmada");
  assert.equal(f.ofrecida_hasta, null);
});

test("otro socio no ve ni acepta la oferta ajena", async () => {
  const ajena = (await t.q(`select id from public.reservas where clase_id = $1 and socio_id = $2 and estado <> 'cancelada'`, [clase, S().por_vencer]))[0];
  await como(u.vence_hoy, async () => {
    assert.deepEqual((await t.q(`select public.ofertas_socio($1) o`, [S().vence_hoy]))[0].o, []);
    await t.falla(() => t.q(`select public.ofertas_socio($1)`, [S().por_vencer]), /permiso/i);
    await t.falla(() => t.q(`select public.aceptar_oferta($1)`, [ajena.id]), /permiso/i);
    await t.falla(() => t.q(`select public.rechazar_oferta($1)`, [ajena.id]), /permiso/i);
  });
});

test("si no acepta a tiempo, la oferta vence al consultar y pasa al siguiente (sin cron)", async () => {
  // Se libera de nuevo el lugar del que aceptó; la oferta va a vence_hoy; se vence a mano el plazo y se consulta.
  await liberar(S().por_vencer);
  const antes = await fila(S().vence_hoy);
  assert.ok(antes.ofrecida_hasta, "ahora le toca a vence_hoy");
  await t.q(`update public.reservas set ofrecida_en = now() - interval '2 hours', ofrecida_hasta = now() - interval '1 hour' where id = $1`, [antes.id]);
  await como(u.al_dia, async () => { await t.q(`select public.ofertas_socio($1)`, [S().al_dia]); });   // consultar no la avanza (no espera en esa clase)
  // Una consulta de quien sí espera en esa clase la vence.
  await como(u.vence_hoy, async () => {
    const o = (await t.q(`select public.ofertas_socio($1) o`, [S().vence_hoy]))[0].o;
    assert.deepEqual(o, [], "su oferta venció y ya no figura");
  });
  const f = await fila(S().vence_hoy);
  assert.equal(f.oferta_perdida, true);
  assert.equal(f.estado, "espera", "sigue en la espera, pero no se le vuelve a ofrecer ese lugar");
});

test("rechazar la oferta la pasa al siguiente", async () => {
  await t.q(`update public.reservas set estado = 'cancelada', cancelada_en = now(), cancelada_por = 'socio' where clase_id = $1`, [clase]);
  assert.equal((await reservar(S().al_dia)).estado, "confirmada");
  assert.equal((await reservar(S().por_vencer)).estado, "espera");
  assert.equal((await reservar(S().vence_hoy)).estado, "espera");
  await liberar(S().al_dia);
  const o1 = await fila(S().por_vencer);
  await como(u.por_vencer, async () => { await t.q(`select public.rechazar_oferta($1)`, [o1.id]); });
  assert.equal((await fila(S().por_vencer)).oferta_perdida, true);
  assert.ok((await fila(S().vence_hoy)).ofrecida_hasta, "el lugar pasó al siguiente");
});
