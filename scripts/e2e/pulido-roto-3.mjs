#!/usr/bin/env node
// H7 (lo que quedaba sin prueba propia): si falla "Dejar pasar", el error sale DENTRO del veredicto, una sola vez,
// y el formulario sigue a mano para reintentar (igual que Anotar en pulido-roto-2). Con sesión real, en el demo.
//   node scripts/e2e/pulido-roto-3.mjs     (con scripts/local/levantar.sh corriendo)
import { execSync } from "node:child_process";
import pg from "pg";
import { COMPU, GIMNASIO, chequear, entrar, falla, navegador, ok, pagina, resultado } from "./comun.mjs";

const G = GIMNASIO();
const b = await navegador();
const url = process.env.DB_PRUEBAS_URL || execSync("scripts/db/local.sh url").toString().trim();
const esAccion = (rq) => rq.method() === "POST" && !!rq.headers()["next-action"];
const db = new pg.Client({ connectionString: url });
await db.connect();
try {
  const tel = (await db.query(`select regexp_replace(s.telefono, '\\D', '', 'g') as t from public.socios s join public.gimnasios g on g.id = s.gimnasio_id
                               where g.slug = 'demo' and s.nombre = 'Testigo' and s.apellido = 'Sin Pago'`)).rows[0].t;
  const d = await pagina(b, COMPU);
  await entrar(d, "duena@ejemplo.invalid");
  await d.goto(`${G}/panel/entrada`);
  const buscar = d.locator('input[aria-label="Buscar socio"]');
  await buscar.waitFor({ timeout: 60000 });
  await buscar.fill(tel);
  await d.locator("ul button.fila", { hasText: "Sin Pago" }).first().click();
  const ver = d.locator("[data-veredicto]");
  await ver.waitFor({ timeout: 30000 });
  chequear(await ver.getAttribute("data-veredicto") === "rojo", "Testigo Sin Pago da el veredicto rojo", `dio ${await ver.getAttribute("data-veredicto")}`);

  await ver.locator("button", { hasText: "Dejar pasar igual" }).first().click();
  const form = ver.locator("[data-dejar-pasar]");
  await form.waitFor({ timeout: 15000 });
  await form.locator("button.pestana").first().click();   // el primer motivo de la lista
  // se corta la conexión con el servidor justo al confirmar
  await d.route(/\/panel\//, async (route) => (esAccion(route.request()) ? route.abort("failed") : route.continue()));
  await form.locator('button[type="submit"]').click();
  const err = ver.locator("[data-veredicto-error]");
  await err.waitFor({ timeout: 30000 });
  chequear(/se cortó la conexión/.test(await err.innerText()), "al dejar pasar con la conexión cortada, el error sale dentro del veredicto", `dice: ${(await err.innerText()).slice(0, 100)}`);
  chequear(await ver.getByText("se cortó la conexión").count() === 1, "…una sola vez", `se repite ${await ver.getByText("se cortó la conexión").count()} veces`);
  chequear(await form.locator('button[type="submit"]').isEnabled(), "…y el formulario sigue a mano para reintentar", "el botón quedó apagado");
  await d.unroute(/\/panel\//);
  ok("Dejar pasar con error: dentro del veredicto, una vez, reintentable");
} catch (e) {
  falla(`se cortó: ${process.env.E2E_DEPURAR ? e.stack : e.message.split("\n")[0]}`);
}
await db.end();
await b.close();
resultado();
