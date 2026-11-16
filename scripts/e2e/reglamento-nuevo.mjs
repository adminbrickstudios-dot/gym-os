#!/usr/bin/env node
// Mateo 16/11 · El reglamento nuevo se acepta al abrir la app. El socio ya aceptó una versión; el dueño publica otra:
//   1. Al abrir la app el socio ve UNA tarjeta con el texto y "Acepto", y la app igual (el estado de la puerta no cambia).
//   2. Acepta: la tarjeta desaparece y no vuelve al recargar.
//   3. La ficha en recepción dice "Aceptó el reglamento (versión N)".
//   node scripts/e2e/reglamento-nuevo.mjs      (con scripts/local/levantar.sh corriendo)
import { execSync } from "node:child_process";
import pg from "pg";
import { CELU, COMPU, GIMNASIO, aparece, capturar, chequear, entrar, falla, navegador, ok, pagina, resultado } from "./comun.mjs";

const G = GIMNASIO();
const db = new pg.Client({ connectionString: process.env.DB_PRUEBAS_URL || execSync("scripts/db/local.sh url").toString().trim() }); await db.connect();
const demo = (await db.query(`select id from public.gimnasios where slug = 'demo'`)).rows[0].id;
const socio = (await db.query(`select s.id from public.socios s join auth.users u on u.id = s.usuario_id where s.gimnasio_id = $1 and u.email = 'socio@ejemplo.invalid'`, [demo])).rows[0].id;
// El socio ya aceptó la versión vigente (o una que se crea ahora) y el dueño publica una nueva.
const vigente = (await db.query(`select id, version from public.reglamentos where gimnasio_id = $1 order by version desc limit 1`, [demo])).rows[0]
  ?? (await db.query(`insert into public.reglamentos (gimnasio_id, version, texto) values ($1, 1, 'Reglamento de prueba uno del gimnasio demo para el e2e del reglamento nuevo.') returning id, version`, [demo])).rows[0];
await db.query(`insert into public.aceptaciones_reglamento (gimnasio_id, socio_id, reglamento_id) select $1, $2, $3 where not exists (select 1 from public.aceptaciones_reglamento where socio_id = $2 and reglamento_id = $3)`, [demo, socio, vigente.id]);
const NUEVA = vigente.version + 1;
await db.query(`insert into public.reglamentos (gimnasio_id, version, texto) values ($1, $2, $3)`, [demo, NUEVA, `Reglamento de prueba versión ${NUEVA}: ahora hay que traer candado propio.`]);
const b = await navegador();
try {
  const s = await pagina(b, CELU);
  s.setDefaultNavigationTimeout(120000);
  await entrar(s, "socio@ejemplo.invalid");
  await s.goto(`${G}/app`);
  const tarjeta = s.locator("[data-reglamento-nuevo]");
  chequear(await aparece(tarjeta, 60000), "al abrir la app aparece la tarjeta “El reglamento cambió”", "no aparece la tarjeta del reglamento nuevo");
  chequear(await tarjeta.getAttribute("data-reglamento-nuevo") === String(NUEVA) && /candado propio/.test(await s.locator("[data-reglamento-texto]").innerText()), `con el texto completo de la versión ${NUEVA}`, "la tarjeta no trae el texto de la versión nueva");
  chequear(await aparece(s.locator("[data-botones-inicio]"), 30000) && await aparece(s.locator("[data-hola]"), 5000), "la app se ve igual: el reglamento no bloquea nada", "la app no se ve con la tarjeta del reglamento");
  await capturar(s, "reglamento-nuevo-celu");
  await tarjeta.locator("[data-reglamento-acepto]").click();
  await tarjeta.waitFor({ state: "detached", timeout: 30000 });
  ok("“Acepto”: la tarjeta desaparece");
  await s.reload();
  await s.locator("[data-botones-inicio]").waitFor({ timeout: 60000 });
  chequear(await s.locator("[data-reglamento-nuevo]").count() === 0, "al recargar no vuelve a pedirlo", "el reglamento vuelve a pedirse");
  const [{ n }] = (await db.query(`select count(*)::int n from public.aceptaciones_reglamento a join public.reglamentos r on r.id = a.reglamento_id where a.socio_id = $1 and r.version = $2`, [socio, NUEVA])).rows;
  chequear(n === 1, "en la base: una sola aceptación de la versión nueva", `aceptaciones: ${n}`);

  const r = await pagina(b, COMPU);
  r.setDefaultNavigationTimeout(120000);
  await entrar(r, "recepcion@ejemplo.invalid");
  await r.goto(`${G}/panel/socios/${socio}`);
  const linea = r.locator("[data-reglamento]");
  chequear(await aparece(linea, 60000) && new RegExp(`versión ${NUEVA}`).test(await linea.first().innerText()), `la ficha en recepción dice “Aceptó el reglamento (versión ${NUEVA})”`, "la ficha no dice la versión que aceptó");
  for (const [q, p] of [["socio", s], ["recepción", r]]) if (p.errores.length) falla(`${q}: ${p.errores.join(" | ")}`);
} catch (e) {
  falla(`se cortó: ${process.env.E2E_DEPURAR ? e.stack : e.message.split("\n")[0]}`);
}
await db.end();
await b.close();
resultado();

