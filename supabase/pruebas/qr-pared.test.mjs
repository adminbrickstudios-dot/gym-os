// QR en la tablet (0051): la tablet muestra un código firmado que cambia; el
// socio lo escanea desde su app y entra con el cálculo de siempre; viejo,
// falso, de otra tablet revocada o apagado no; la tablet ve quién entró.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir } from "./_comun.mjs";

let t, dueno, socioUsuario, token, did;
const M = new Date().toISOString();
const mas = (seg) => new Date(Date.parse(M) + seg * 1000).toISOString();
async function como(rol, sub, fn) {
  await t.q(`set local role ${rol}`);
  await t.q(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify(sub ? { sub, role: rol } : { role: rol })]);
  try { return await fn(); } finally { await t.q(`reset role`); }
}
before(async () => {
  t = await abrir("prueba-qr-pared");
  [{ id: dueno }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`d${Math.random()}@ejemplo.invalid`]);
  await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,'d','dueno')`, [t.g, dueno]);
  [{ id: socioUsuario }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`s${Math.random()}@ejemplo.invalid`]);
  await t.q(`update public.socios set usuario_id = $1 where id = $2`, [socioUsuario, t.ctx.socios.vencida]);
  await t.q(`update public.configuracion_gimnasio set accesos_activos = array['recepcion','kiosco','qr_pared'] where gimnasio_id = $1`, [t.g]);
  ({ token, id: did } = await como("authenticated", dueno, async () => (await t.q(`select public.autorizar_tablet($1, $2, 'Puerta') as r`, [t.g, t.sede]))[0].r));
});
after(async () => t && t.cerrar());

const codigoTablet = (m = M) => como("anon", null, async () => (await t.q(`select public.kiosco_qr($1, $2) as r`, [token, m]))[0].r.codigo);
const escanear = (c, m = M) => como("authenticated", socioUsuario, async () => (await t.q(`select public.entrar_por_qr_pared($1, $2, $3, $4) as r`, [t.g, t.ctx.socios.vencida, c, m]))[0].r);

test("escanea y anota con el veredicto de siempre; la tablet lo ve", async () => {
  const c = await codigoTablet();
  assert.match(c, /^GYMOSP1\.[0-9a-f-]{36}\.\d+\.[0-9a-f]{24}$/);
  const r = await escanear(c);
  assert.equal(r.resultado, "rechazado", "el socio vencido no entra por escanear");
  const [{ via, d }] = await t.q(`select via_acceso via, dispositivo_id d from public.ingresos where socio_id = $1 order by momento desc limit 1`, [t.ctx.socios.vencida]);
  assert.equal(via, "qr_pared"); assert.equal(d, did);
  const u = await como("anon", null, async () => (await t.q(`select public.kiosco_ultimo($1, $2) as r`, [token, mas(-60)]))[0].r);
  assert.equal(u.nombre, "Testigo");
  assert.doesNotMatch(u.texto, /\$|debe/);
});

test("viejo, falso, del socio de otro, revocada y apagado no", async () => {
  await como("authenticated", socioUsuario, () => t.falla(() => t.q(`select public.entrar_por_qr_pared($1, $2, $3, $4)`, [t.g, t.ctx.socios.vencida, "hola", M]), /no es el QR de la entrada/));
  const c = await codigoTablet(mas(-120));
  await como("authenticated", socioUsuario, () => t.falla(() => t.q(`select public.entrar_por_qr_pared($1, $2, $3, $4)`, [t.g, t.ctx.socios.vencida, c, M]), /cambió/));
  const bueno = await codigoTablet();
  await como("authenticated", socioUsuario, () => t.falla(() => t.q(`select public.entrar_por_qr_pared($1, $2, $3, $4)`, [t.g, t.ctx.socios.vencida, bueno.slice(0, -1) + (bueno.endsWith("a") ? "b" : "a"), M]), /no es válido/));
  // Con la cuenta de este socio no se hace entrar a otro.
  await como("authenticated", socioUsuario, () => t.falla(() => t.q(`select public.entrar_por_qr_pared($1, $2, $3, $4)`, [t.g, t.ctx.socios.al_dia, bueno, M]), /Sin permiso/));
  await como("authenticated", dueno, () => t.q(`select public.revocar_tablet($1)`, [did]));
  await como("authenticated", socioUsuario, () => t.falla(() => t.q(`select public.entrar_por_qr_pared($1, $2, $3, $4)`, [t.g, t.ctx.socios.vencida, bueno, M]), /ya no está habilitada/));
});
