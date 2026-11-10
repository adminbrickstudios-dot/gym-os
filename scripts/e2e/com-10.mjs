#!/usr/bin/env node
// COM-10 · Reseña y encuesta: la dueña pega el link de reseñas de Google en
// Configuración → Mensajes → el socio (más de un mes en el gimnasio) ve en la
// app "Una sola pregunta", toca 10 y le ofrece la reseña y traer a un amigo →
// el Resultado muestra "¿Nos recomiendan?" con él entre los que recomiendan.
//   npm run e2e:com-10           (con scripts/local/levantar.sh corriendo)
import { execSync } from "node:child_process";
import pg from "pg";
import { CELU, COMPU, GIMNASIO, aparece, capturar, chequear, entrar, falla, navegador, ok, pagina, resultado } from "./comun.mjs";

const G = GIMNASIO();
const LINK = "https://g.page/r/ejemplo-demo/review";
const db = new pg.Client({ connectionString: process.env.DB_PRUEBAS_URL || execSync("scripts/db/local.sh url").toString().trim() });
await db.connect();
const [{ id: gim }] = (await db.query(`select id from public.gimnasios where slug = 'demo'`)).rows;
const [{ id: socio }] = (await db.query(`select s.id from public.socios s join auth.users u on u.id = s.usuario_id
  where s.gimnasio_id = $1 and u.email = 'socio@ejemplo.invalid'`, [gim])).rows;
// Que tenga la encuesta pendiente: sin respuesta reciente y con más de 30 días desde su primer plan.
await db.query(`delete from public.encuestas where socio_id = $1`, [socio]);
await db.query(`update public.suscripciones set inicio = least(inicio, now() - interval '40 days') where id = (
  select id from public.suscripciones where socio_id = $1 order by inicio limit 1)`, [socio]);
const b = await navegador();
try {
  const d = await pagina(b, COMPU);
  d.setDefaultNavigationTimeout(120000);
  await entrar(d, "duena@ejemplo.invalid");
  await d.goto(`${G}/panel/configuracion?pestana=mensajes`);
  const l = d.locator("[data-link-resena]");
  await l.waitFor({ timeout: 60000 });
  const campo = l.locator('input[aria-label="Link de reseñas de Google"]');
  if ((await campo.inputValue()) !== LINK) {
    await campo.fill(LINK);
    await l.locator('button:has-text("Guardar")').click();
    await l.getByText("Guardado.").waitFor({ timeout: 30000 });
  }
  ok("la dueña pega el link de reseñas de Google en Configuración → Mensajes");

  const so = await pagina(b, CELU);
  so.setDefaultNavigationTimeout(120000);
  await entrar(so, "socio@ejemplo.invalid");
  await so.goto(`${G}/app`);
  const enc = so.locator('[data-encuesta="pendiente"]');
  chequear(await aparece(enc, 60000), "el socio ve en la app “⭐ Una sola pregunta” (del 0 al 10)", "la app no muestra la encuesta");
  await enc.locator('button[aria-label="10 de 10"]').click();
  const resp = so.locator('[data-encuesta="respondida"]');
  await resp.waitFor({ timeout: 30000 });
  chequear(await resp.locator(`a[href="${LINK}"]`).count() === 1 && await resp.locator('a[href="#referir"]').count() === 1,
    "toca 10: “¡Gracias!” con el botón de la reseña en Google y el de invitar a un amigo", await resp.innerText());
  await capturar(so, "com10-celu-app");
  await so.reload();
  chequear(!(await aparece(so.locator("[data-encuesta]"), 5000)), "y no se le vuelve a preguntar", "la encuesta sigue apareciendo");

  await d.goto(`${G}/panel/resultado`);
  const r = d.locator("[data-encuesta-resultado]");
  chequear(await aparece(r, 60000) && /recomiendan/.test(await r.innerText()), "el Resultado muestra “¿Nos recomiendan?” con el puntaje y los que recomiendan", "el Resultado no muestra la encuesta");
  for (const p of [d, so]) if (p.errores.length) falla(p.errores.join(" | "));
} catch (e) {
  falla(`se cortó: ${process.env.E2E_DEPURAR ? e.message : e.message.split("\n")[0]}`);
} finally {
  await db.end();
}
await b.close();
resultado();
