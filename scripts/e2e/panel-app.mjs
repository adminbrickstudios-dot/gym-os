#!/usr/bin/env node
// AUD-11 · App del socio botón por botón (celular): semáforo, campana,
// historial, mi membresía, reservar (días y volver), el logo vuelve al
// inicio. Con clases "sin reserva": horarios sin botones de reservar.
//   npm run e2e:app            (con scripts/local/levantar.sh corriendo)
import { execSync } from "node:child_process";
import pg from "pg";
import { CELU, GIMNASIO, capturar, chequear, entrar, falla, navegador, ok, pagina, resultado } from "./comun.mjs";

const G = GIMNASIO();
const url = process.env.DB_PRUEBAS_URL || execSync("scripts/db/local.sh url").toString().trim();
const db = new pg.Client({ connectionString: url }); await db.connect();
const [{ id: gim, modo }] = (await db.query(`select g.id, c.modo_clases as modo from public.gimnasios g join public.configuracion_gimnasio c on c.gimnasio_id = g.id where g.slug = 'demo'`)).rows;
const b = await navegador();
const sinDesborde = async (p, donde) => {
  const ancho = await p.evaluate(() => document.documentElement.scrollWidth);
  chequear(ancho <= CELU.width, `${donde}: sin desborde (${ancho}px)`, `${donde} desborda: ${ancho}px`);
};
try {
  const s = await pagina(b, CELU);
  await entrar(s, "socio@ejemplo.invalid");
  await s.goto(`${G}/app`);
  await s.getByText(/Podés entrar|No podés entrar/).first().waitFor({ timeout: 60000 });
  ok(`inicio: el semáforo dice “${(await s.getByText(/Podés entrar|No podés entrar/).first().innerText()).trim()}”`);
  await sinDesborde(s, "inicio");
  await capturar(s, "app-inicio");

  for (const [que, sel, destino] of [["🔔 Novedades", "[data-campana]", /\/app\/novedades/], ["🧾 Historial", "[data-yo-fila=historial]", /\/app\/historial/],
                                      ["⏸️ Mi membresía", "[data-yo-fila=cuenta]", /\/app\/cuenta/]]) {
    if (sel.startsWith("[data-yo-fila")) await s.goto(`${G}/app/yo`);
    await s.locator(sel).first().click();
    await s.waitForURL(destino, { timeout: 30000 });
    await s.locator("main h1").waitFor({ timeout: 60000 });
    await sinDesborde(s, que);
    await s.getByRole("link", { name: /Volver/ }).click();
    // Historial y Mi membresía se abren desde Yo: "Volver" lleva a Yo. Novedades se abre desde el inicio.
    await s.waitForURL(sel.startsWith("[data-yo-fila") ? /\/app\/yo(\?.*)?$/ : /\/app(\?.*)?$/, { timeout: 30000 });
    ok(`${que} abre y “← Volver” vuelve a donde estaba`);
  }
  await s.goto(`${G}/app`);

  await s.getByRole("link", { name: /Reservar|Ver horarios/ }).click();
  await s.waitForURL(/\/app\/clases/, { timeout: 30000 });
  await s.locator("main h1").waitFor({ timeout: 60000 });
  await s.getByRole("link", { name: "Mañana" }).click();
  await s.waitForURL(/dia=\d{4}-\d{2}-\d{2}/, { timeout: 30000 });
  ok("Reservar: los días cambian (“Mañana”)");
  await sinDesborde(s, "clases");
  await s.locator("header").getByRole("link").first().click();
  await s.waitForURL(/\/app$/, { timeout: 30000 });
  ok("el logo del gimnasio vuelve al inicio");
  chequear(await s.getByRole("button", { name: "Salir" }).isVisible(), "“Salir” está arriba", "no hay Salir");

  // Sin reserva: horarios sin botones.
  await db.query(`update public.configuracion_gimnasio set modo_clases = 'sin_reserva' where gimnasio_id = $1`, [gim]);
  await s.goto(`${G}/app`);
  await s.getByRole("link", { name: /Ver horarios/ }).waitFor({ timeout: 60000 });
  await s.getByRole("link", { name: /Ver horarios/ }).click();
  await s.locator("[data-sin-reserva]").waitFor({ timeout: 60000 });
  chequear(await s.getByRole("button", { name: /Reservar/ }).count() === 0, "sin reserva: “Ver horarios”, “vení directo” y ningún botón de reservar", "hay botones de reservar");
  await capturar(s, "app-sin-reserva");
  if (s.errores.length) falla(`socio: ${s.errores.join(" | ")}`);
} catch (e) {
  falla(`se cortó: ${process.env.E2E_DEPURAR ? e.message : e.message.split("\n")[0]}`);
} finally {
  await db.query(`update public.configuracion_gimnasio set modo_clases = $2 where gimnasio_id = $1`, [gim, modo]);
  await db.end();
}
await b.close();
resultado();
