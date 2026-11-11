// REF-1 (0099): el socio tiene su link (código propio, se crea una vez); el
// pedido que llega con ese código entra como "referido de X"; un código ajeno
// no cuenta ni frena; sin la página recibiendo pedidos no hay link; otro
// socio no ve el link de este.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir } from "./_comun.mjs";

let t, socio, uSocio, uOtro, uDueno;
const HOST = `ref-${Date.now()}.ejemplo.invalid`;
before(async () => {
  t = await abrir("prueba-referidos");
  await t.q(`insert into public.dominios_gimnasio (gimnasio_id, host, tipo) values ($1, $2, 'propio')`, [t.g, HOST]);
  [{ id: uSocio }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`s${Math.random()}@ejemplo.invalid`]);
  [{ id: uOtro }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`o${Math.random()}@ejemplo.invalid`]);
  [{ id: uDueno }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`d${Math.random()}@ejemplo.invalid`]);
  await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,'Dueña','dueno')`, [t.g, uDueno]);
  [{ id: socio }] = await t.q(`insert into public.socios (gimnasio_id, nombre, apellido, usuario_id) values ($1,'Refe','Rente',$2) returning id`, [t.g, uSocio]);
  await t.q(`insert into public.socios (gimnasio_id, nombre, apellido, usuario_id) values ($1,'Otro','Socio',$2)`, [t.g, uOtro]);
});
after(async () => t && t.cerrar());
const link = (u) => t.comoUsuario(u, async () => (await t.q(`select public.mi_link_referido($1) l`, [socio]))[0].l);

test("sin la página recibiendo pedidos no hay link; publicada, el código es fijo", async () => {
  await t.q(`update public.landing_gimnasio set publicada = false where gimnasio_id = $1`, [t.g]);   // U4: nace publicada; acá se prueba oculta
  assert.equal(await link(uSocio), null);
  await t.q(`update public.landing_gimnasio set publicada = true where gimnasio_id = $1`, [t.g]);
  // comoUsuario vuelve atrás lo que hizo: el código se guarda desde el servidor en esta prueba.
  const [{ l: l1 }] = await t.q(`select public.mi_link_referido($1) l from (select set_config('request.jwt.claims', $2, true)) x`, [socio, JSON.stringify({ sub: uSocio, role: "authenticated" })]);
  assert.match(l1.codigo, /^[A-Z0-9]{6}$/); assert.equal(l1.host, HOST);
  const l2 = await link(uSocio);
  assert.equal(l2.codigo, l1.codigo, "el código no cambia");
  await t.comoUsuario(uOtro, () => t.falla(() => t.q(`select public.mi_link_referido($1)`, [socio]), /permiso/i));
});

test("el pedido con su código entra como referido; uno ajeno no cuenta", async () => {
  const [{ codigo_referido: cod }] = await t.q(`select codigo_referido from public.socios where id = $1`, [socio]);
  await t.q(`set local role anon`);
  await t.q(`select public.quiero_probar($1, 'Amiga Uno', '387 555 4411', null, $2)`, [HOST, cod.toLowerCase()]);
  await t.q(`select public.quiero_probar($1, 'Amigo Dos', '387 555 4422', null, 'ZZZZZZ')`, [HOST]);
  await t.q(`reset role`);
  const filas = await t.q(`select nombre, origen, referido_por from public.prospectos where gimnasio_id = $1 order by nombre`, [t.g]);
  assert.deepEqual(filas.map((f) => [f.nombre, f.origen, f.referido_por === socio]), [["Amiga Uno", "referido", true], ["Amigo Dos", "pagina", false]]);
  const l = await link(uSocio);
  assert.equal(l.invitados, 1); assert.equal(l.socios, 0);
  const [{ p }] = await t.comoUsuario(uDueno, () => t.q(`select public.prospectos_panel($1) p`, [t.g]));
  assert.equal(p.find((x) => x.nombre === "Amiga Uno").referido_por, "Refe Rente");
});
