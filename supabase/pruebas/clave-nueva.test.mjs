// C1: "Nueva clave" sin mails. La base decide quién puede darle una clave a quién; el servidor toca la cuenta recién después.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir } from "./_comun.mjs";

let t, g2, uDueno, uRec, uProfe, uDueno2, eRec, eProfe, sSin, sCon, uSocio, sOtro, sMenor, uOtroGim, sMulti, uEq;
async function usuario(prefijo) {
  const [{ id }] = await t.q(`insert into auth.users (email, email_confirmed_at) values ($1, now()) returning id`, [`${prefijo}${Math.random().toString(36).slice(2)}@ejemplo.invalid`]);
  return id;
}
async function persona(gim, u, rol, nombre) {
  const [{ id }] = await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,$3,$4) returning id`, [gim, u, nombre, rol]);
  return id;
}
before(async () => {
  t = await abrir("prueba-clave-nueva");
  [{ id: g2 }] = await t.q(`insert into public.gimnasios (slug, nombre) values ('prueba-clave-nueva-2', 'Otro Gimnasio') returning id`);
  uDueno = await usuario("dueno"); await persona(t.g, uDueno, "dueno", "Dueña Clave");
  uRec = await usuario("rec"); eRec = await persona(t.g, uRec, "recepcion", "Ana Rec");
  uProfe = await usuario("profe"); eProfe = await persona(t.g, uProfe, "profe", "Beto Profe");
  uDueno2 = await usuario("dueno2"); await persona(g2, uDueno2, "dueno", "Dueño Ajeno");
  [{ id: sSin }] = await t.q(`insert into public.socios (gimnasio_id, nombre, apellido, email) values ($1,'Sin','Cuenta','sin.cuenta@ejemplo.invalid') returning id`, [t.g]);
  uSocio = await usuario("socio");
  [{ id: sCon }] = await t.q(`insert into public.socios (gimnasio_id, nombre, apellido, email, usuario_id) values ($1,'Con','Cuenta','con@ejemplo.invalid',$2) returning id`, [t.g, uSocio]);
  [{ id: sOtro }] = await t.q(`insert into public.socios (gimnasio_id, nombre, apellido, email) values ($1,'De','Otro','otro@ejemplo.invalid') returning id`, [g2]);
  [{ id: sMenor }] = await t.q(`insert into public.socios (gimnasio_id, nombre, apellido, email, fecha_nacimiento) values ($1,'Chico','Menor','chico@ejemplo.invalid', current_date - interval '10 years') returning id`, [t.g]);
  // una cuenta de socio compartida con otro gimnasio
  uOtroGim = await usuario("multi");
  [{ id: sMulti }] = await t.q(`insert into public.socios (gimnasio_id, nombre, apellido, email, usuario_id) values ($1,'Multi','Gimnasio','multi@ejemplo.invalid',$2) returning id`, [t.g, uOtroGim]);
  await t.q(`insert into public.socios (gimnasio_id, nombre, apellido, usuario_id) values ($1,'Multi','Otro',$2)`, [g2, uOtroGim]);
  // un socio cuyo mail es el de una cuenta del equipo
  uEq = uProfe;
});
after(async () => t && t.cerrar());

const cuenta = (s) => t.q(`select public.cuenta_para_clave_socio($1) as r`, [s]).then((r) => r[0].r);

test("dueño y recepción reciben la cuenta del socio; sin cuenta dice que hay que crearla", async () => {
  for (const u of [uDueno, uRec]) {
    await t.comoUsuario(u, async () => {
      const c = await cuenta(sCon);
      assert.equal(c.usuario_id, uSocio);
      assert.equal(c.crear, false);
      const n = await cuenta(sSin);
      assert.equal(n.crear, true);
      assert.equal(n.email, "sin.cuenta@ejemplo.invalid");
      assert.equal(n.gimnasio, "Gimnasio de Prueba");
    });
  }
});

test("permiso denegado es error: profe, otro gimnasio y sin sesión", async () => {
  await t.comoUsuario(uProfe, () => t.falla(() => cuenta(sCon), /Sin permiso/));
  await t.comoUsuario(uDueno2, () => t.falla(() => cuenta(sCon), /Sin permiso/));
  await t.comoUsuario(uDueno, () => t.falla(() => cuenta(sOtro), /Sin permiso/));
  await t.comoUsuario(uRec, () => t.falla(() => cuenta(sOtro), /Sin permiso/));
  await t.falla(() => cuenta(sCon), /iniciar sesión|permission denied/);
});

test("no se toca la cuenta de un menor, del equipo ni de otro gimnasio", async () => {
  await t.comoUsuario(uDueno, async () => {
    await t.falla(() => cuenta(sMenor), /menor/);
    await t.falla(() => cuenta(sMulti), /otro gimnasio/);
  });
  // la cuenta del socio pasa a ser también la de un profe: es del equipo
  await t.q(`update public.socios set usuario_id = $1 where id = $2`, [uEq, sCon]);
  await t.comoUsuario(uRec, () => t.falla(() => cuenta(sCon), /del equipo/));
  await t.q(`update public.socios set usuario_id = $1 where id = $2`, [uSocio, sCon]);
});

test("un mail que ya tiene cuenta sin vincular no se toca", async () => {
  const [{ email }] = await t.q(`select email from auth.users where id = $1`, [uProfe]);
  await t.q(`update public.socios set email = $1 where id = $2`, [email, sSin]);
  await t.comoUsuario(uRec, () => t.falla(() => cuenta(sSin), /ya tiene una cuenta/));
  await t.q(`update public.socios set email = 'sin.cuenta@ejemplo.invalid' where id = $1`, [sSin]);
});

test("sin mail cargado y dado de baja dicen qué hacer", async () => {
  await t.q(`update public.socios set email = null, telefono = '+5490000990011' where id = $1`, [sSin]);
  await t.comoUsuario(uRec, () => t.falla(() => cuenta(sSin), /mail cargado/));
  await t.q(`update public.socios set email = 'sin.cuenta@ejemplo.invalid', dado_de_baja_en = now(), motivo_baja = 'otro' where id = $1`, [sSin]);
  await t.comoUsuario(uRec, () => t.falla(() => cuenta(sSin), /dado de baja/));
  await t.q(`update public.socios set dado_de_baja_en = null, motivo_baja = null where id = $1`, [sSin]);
});

test("registrar la clave entregada: quién la generó, sin la clave; y respeta los mismos permisos", async () => {
  await t.comoUsuario(uRec, async () => {
    await t.q(`select public.registrar_clave_entregada($1, null, true)`, [sSin]);
    await t.falla(() => t.q(`select public.registrar_clave_entregada($1, null, false)`, [sOtro]), /Sin permiso/);
    // la recepción no le cambia la clave al equipo
    await t.falla(() => t.q(`select public.registrar_clave_entregada(null, $1, false)`, [eProfe]), /Sin permiso/);
    await t.falla(() => t.q(`select public.registrar_clave_entregada(null, null, false)`), /socio o una persona/);
  });
  await t.comoUsuario(uProfe, () => t.falla(() => t.q(`select public.registrar_clave_entregada($1, null, false)`, [sSin]), /Sin permiso/));
});

test("el registro guarda quién la generó y nunca la clave", async () => {
  // comoUsuario deshace lo que hace al salir: se mira todo adentro, cambiando de rol a mano
  const ser = async (u) => {
    await t.db.query("reset role");
    await t.db.query("set local role authenticated");
    await t.q(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: u, role: "authenticated" })]);
  };
  await t.comoUsuario(uRec, async () => {
    await t.q(`select public.registrar_clave_entregada($1, null, true)`, [sSin]);
    await ser(uDueno);
    await t.q(`select public.registrar_clave_entregada(null, $1, false)`, [eProfe]);
    await t.db.query("reset role");
    const filas = await t.q(`select * from public.claves_entregadas where gimnasio_id = $1 order by creado_en`, [t.g]);
    assert.equal(filas.length, 2);
    assert.equal(filas[0].socio_id, sSin);
    assert.equal(filas[0].por_equipo_id, eRec);
    assert.equal(filas[0].por_usuario_id, uRec);
    assert.equal(filas[0].cuenta_creada, true);
    assert.equal(filas[1].equipo_id, eProfe);
    assert.ok(!Object.keys(filas[0]).some((k) => /clave|contrasena|password/.test(k)), "no guarda la clave");
  });
});

test("la tabla del registro no se lee ni se escribe directo", async () => {
  await t.comoUsuario(uDueno, () => t.falla(() => t.q(`select * from public.claves_entregadas`), /permission denied/));
  await t.comoUsuario(uDueno, () => t.falla(() => t.q(`insert into public.claves_entregadas (gimnasio_id, socio_id, por_equipo_id) values ($1,$2,$3)`, [t.g, sSin, eRec]), /permission denied/));
});
