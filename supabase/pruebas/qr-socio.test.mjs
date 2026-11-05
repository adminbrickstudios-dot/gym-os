// QR del socio (0048): vale en su ventana y la anterior, una vez, solo en su
// gimnasio, con la firma de su secreto; apagado no se genera ni se lee.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir } from "./_comun.mjs";

let t, otro, u = {}, socioUsuario;
const M = "2026-11-14T15:00:10Z";                    // momento fijo
const mas = (seg) => new Date(Date.parse(M) + seg * 1000).toISOString();
before(async () => {
  t = await abrir("prueba-qr");
  // Otro gimnasio con un socio, en la misma transacción.
  const [{ id: g2 }] = await t.q(`insert into public.gimnasios (slug, nombre) values ('prueba-qr-otro', 'Otro') returning id`);
  [{ id: otro }] = await t.q(`insert into public.socios (gimnasio_id, nombre) values ($1, 'Ajeno') returning id`, [g2]);
  for (const r of ["recepcion", "profe"]) {
    const [{ id }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`${r}${Math.random()}@ejemplo.invalid`]);
    await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,$3,$4)`, [t.g, id, r, r]);
    u[r] = id;
  }
  [{ id: socioUsuario }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`socio${Math.random()}@ejemplo.invalid`]);
  await t.q(`update public.socios set usuario_id = $1 where id = $2`, [socioUsuario, t.ctx.socios.al_dia]);
});
after(async () => t && t.cerrar());

// Como el socio, sin volver atrás (el secreto que se crea tiene que quedar para leerlo después).
async function codigo(momento = M) {
  await t.q(`set local role authenticated`);
  await t.q(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: socioUsuario, role: "authenticated" })]);
  try { return (await t.q(`select public.mi_qr($1, $2, $3) as q`, [t.g, t.ctx.socios.al_dia, momento]))[0].q.codigo; }
  finally { await t.q(`reset role`); }
}
const leer = (c, momento = M) => t.q(`select public.leer_qr($1, $2, $3) as r`, [t.g, c, momento]);

test("apagado: ni se genera ni se lee", async () => {
  await t.comoUsuario(socioUsuario, () => t.falla(() => t.q(`select public.mi_qr($1, $2, $3)`, [t.g, t.ctx.socios.al_dia, M]), /no usa QR/));
});

test("vale una vez, en su ventana y la anterior; viejo, falso o ajeno no", async () => {
  await t.q(`update public.configuracion_gimnasio set accesos_activos = array['recepcion','qr_socio'] where gimnasio_id = $1`, [t.g]);
  const c = await codigo();
  assert.match(c, /^GYMOS1\.[0-9a-f-]{36}\.\d+\.[0-9a-f]{24}$/);
  const c2 = await codigo(mas(-30));                   // el de la ventana anterior
  await t.comoUsuario(u.recepcion, async () => {
    const [{ r }] = await leer(c);
    assert.equal(r.socio_id, t.ctx.socios.al_dia);
    await t.falla(() => leer(c), /ya se usó/);
    const [{ r: r2 }] = await leer(c2);                 // un ratito tarde: todavía vale
    assert.equal(r2.socio_id, t.ctx.socios.al_dia);
    await t.falla(() => leer(c, mas(90)), /venció/);
    await t.falla(() => leer(c.slice(0, -1) + (c.endsWith("0") ? "1" : "0")), /no es válido/);
    await t.falla(() => leer("hola"), /no es un QR/);
    // Un socio de otro gimnasio
    const ajeno = c.replace(t.ctx.socios.al_dia, otro);
    await t.falla(() => leer(ajeno), /otro gimnasio/);
  });
  await t.comoUsuario(u.profe, () => t.falla(() => leer(c), /Sin permiso/));
  // Otro usuario no saca el QR de este socio.
  await t.comoUsuario(u.recepcion, () => t.falla(() => t.q(`select public.mi_qr($1, $2, $3)`, [t.g, t.ctx.socios.al_dia, M]), /Sin permiso/));
});
