// Pista Semáforo (24/11, migración 20261124100000): la llave pista_semaforo entra apagada en un gimnasio real, viaja con la dirección
// que resuelve el proxy (gimnasio_por_host y gimnasio_por_slug, sin un viaje más) y solo el dueño la cambia: la recepción y el dueño
// de otro gimnasio reciben error, nunca un vacío.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir } from "./_comun.mjs";

let t, u = {}, g2;
const HOST = "semaforo-prueba.ejemplo.invalid";
const uno = async (sql, p) => (await t.q(sql, p))[0];
async function como(usuario, fn) {
  await t.db.query("set role authenticated");
  await t.q("select set_config('request.jwt.claims', $1, false)", [JSON.stringify({ sub: usuario, role: "authenticated" })]);
  try { return await fn(); } finally { await t.db.query("reset role"); await t.q("select set_config('request.jwt.claims', '', false)"); }
}
async function comoAnon(fn) {
  await t.db.query("set role anon");
  try { return await fn(); } finally { await t.db.query("reset role"); }
}
const usuario = async () => (await uno(`insert into auth.users (email) values ($1) returning id`, [`u${Math.random()}@ejemplo.invalid`])).id;
before(async () => {
  t = await abrir("prueba-semaforo");
  for (const k of ["dueno", "recepcion", "ajeno"]) u[k] = await usuario();
  await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,'Dueno','dueno'), ($1,$3,'Recep','recepcion')`, [t.g, u.dueno, u.recepcion]);
  await t.q(`insert into public.dominios_gimnasio (gimnasio_id, host, tipo) values ($1, $2, 'propio')`, [t.g, HOST]);
  g2 = (await uno(`insert into public.gimnasios (slug, nombre) values ('prueba-semaforo-otro', 'Otro') returning id`)).id;
  await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,'Ajeno','dueno')`, [g2, u.ajeno]);
});
after(async () => t && t.cerrar());

const porHost = () => comoAnon(async () => (await uno(`select semaforo from public.gimnasio_por_host($1)`, [HOST])).semaforo);
const porSlug = async () => {
  const slug = (await uno(`select slug from public.gimnasios where id = $1`, [t.g])).slug;
  return comoAnon(async () => (await uno(`select semaforo from public.gimnasio_por_slug($1)`, [slug])).semaforo);
};

test("un gimnasio real entra con la llave apagada, y la dirección lo dice (anon, como el proxy)", async () => {
  assert.equal(await porHost(), false);
  assert.equal(await porSlug(), false);
});

test("el dueño la prende y la apaga; la dirección lo trae", async () => {
  await como(u.dueno, () => t.q(`select public.cambiar_funcion_nueva($1, 'pista_semaforo', true)`, [t.g]));
  assert.equal(await porHost(), true);
  assert.equal(await porSlug(), true);
  await como(u.dueno, () => t.q(`select public.cambiar_funcion_nueva($1, 'pista_semaforo', false)`, [t.g]));
  assert.equal(await porHost(), false);
});

test("la recepción y el dueño de otro gimnasio reciben error, no un vacío", async () => {
  await como(u.recepcion, () => t.falla(() => t.q(`select public.cambiar_funcion_nueva($1, 'pista_semaforo', true)`, [t.g])));
  await como(u.ajeno, () => t.falla(() => t.q(`select public.cambiar_funcion_nueva($1, 'pista_semaforo', true)`, [t.g])));
  assert.equal(await porHost(), false);
});

test("una sola versión de cada función de la dirección (sin llamadas ambiguas)", async () => {
  const n = (await uno(`select count(*)::int n from pg_proc p join pg_namespace s on s.oid = p.pronamespace
                         where s.nspname = 'public' and p.proname in ('gimnasio_por_host', 'gimnasio_por_slug')`)).n;
  assert.equal(n, 2);
});
