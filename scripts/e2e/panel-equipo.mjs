#!/usr/bin/env node
// AUD-12 · Equipo y Mi cuenta botón por botón: la dueña suma a alguien sin
// mail, le cambia el rol, "hacer dueño" pide confirmación en pantalla, le saca
// y le devuelve el acceso; el encargado ve la lista sin botones; Mi cuenta:
// contraseñas que no coinciden, PIN, notificaciones y cerrar sesión.
//   npm run e2e:equipo            (con scripts/local/levantar.sh corriendo)
import { execSync } from "node:child_process";
import pg from "pg";
import { CELU, COMPU, GIMNASIO, chequear, entrar, falla, navegador, ok, pagina, resultado } from "./comun.mjs";

const G = GIMNASIO();
const url = process.env.DB_PRUEBAS_URL || execSync("scripts/db/local.sh url").toString().trim();
const db = new pg.Client({ connectionString: url }); await db.connect();
const NOMBRE = `Profe E2e ${Date.now() % 100000}`;
const b = await navegador();
try {
  const d = await pagina(b, COMPU);
  await entrar(d, "duena@ejemplo.invalid");
  await d.goto(`${G}/panel/equipo`);
  await d.locator("main h1").waitFor({ timeout: 60000 });
  const form = d.locator("form", { hasText: "Sumar a alguien" });
  await form.locator("input[name=nombre]").fill(NOMBRE);
  await form.locator("select[name=rol]").selectOption("profe");
  await form.getByRole("button", { name: /Sumar al equipo/ }).click();
  const fila = d.locator("li", { hasText: NOMBRE }).first();
  await fila.waitFor({ timeout: 30000 });
  chequear(/sin acceso al sistema/.test(await fila.innerText()), "suma a alguien sin mail: queda “sin acceso al sistema”", await fila.innerText());

  await fila.getByLabel(`Rol de ${NOMBRE}`).selectOption("recepcion");
  // Cualquier cambio de rol se confirma antes de tocar nada (H7).
  await fila.locator("[data-confirmar-rol=recepcion]").getByRole("button", { name: /Sí, pasarlo a Recepción/ }).click();
  await fila.getByText(/Recepción/).first().waitFor({ timeout: 30000 });
  ok("cambia el rol a Recepción");
  await fila.getByLabel(`Rol de ${NOMBRE}`).selectOption("dueno");
  await fila.locator("[data-confirmar-dueno]").waitFor({ timeout: 10000 });
  await fila.locator("[data-confirmar-dueno]").getByRole("button", { name: "Cancelar" }).click();
  const [{ rol }] = (await db.query(`select e.rol from public.equipo e join public.gimnasios g on g.id = e.gimnasio_id where g.slug = 'demo' and e.nombre = $1`, [NOMBRE])).rows;
  chequear(rol === "recepcion", "“hacer dueño” pide confirmación en pantalla; Cancelar no cambia nada", rol);

  await fila.getByRole("button", { name: "Sacar acceso" }).click();
  await fila.getByRole("button", { name: "Devolver acceso" }).waitFor({ timeout: 30000 });
  await fila.getByRole("button", { name: "Devolver acceso" }).click();
  await fila.getByRole("button", { name: "Sacar acceso" }).waitFor({ timeout: 30000 });
  ok("Sacar acceso / Devolver acceso");
  if (d.errores.length) falla(`dueña: ${d.errores.join(" | ")}`);

  const e = await pagina(b, CELU);
  await entrar(e, "encargado@ejemplo.invalid");
  await e.goto(`${G}/panel/equipo`);
  await e.locator("main li").first().waitFor({ timeout: 60000 });
  chequear(await e.getByRole("button", { name: /Sacar acceso|Sumar al equipo/ }).count() === 0, "el encargado ve la lista sin botones", "el encargado ve botones");
  await e.goto(`${G}/panel/cuenta`);
  // Con contraseña puesta (VD-33b) el formulario pide la actual: sin ella "Guardar" queda apagado.
  if (await e.getByLabel("Contraseña actual").count()) await e.getByLabel("Contraseña actual").fill("demo-gymos");
  await e.getByLabel("Contraseña nueva").fill("una-clave-1");
  await e.getByLabel("Repetir la contraseña").fill("otra-clave-2");
  await e.getByRole("button", { name: "Guardar" }).first().click();
  await e.getByText("Las dos contraseñas no coinciden").waitFor({ timeout: 10000 });
  ok("Mi cuenta: si no coinciden, lo dice (no cambia nada)");
  chequear(await e.getByRole("button", { name: /Cerrar sesión/ }).isVisible() && await e.getByText(/PIN/).first().isVisible(), "Mi cuenta tiene PIN y Cerrar sesión", "falta PIN o Cerrar sesión");
  const ancho = await e.evaluate(() => document.documentElement.scrollWidth);
  chequear(ancho <= CELU.width, `Mi cuenta en el celular sin desborde (${ancho}px)`, `desborda ${ancho}`);
  if (e.errores.length) falla(`encargado: ${e.errores.join(" | ")}`);
} catch (err) {
  falla(`se cortó: ${process.env.E2E_DEPURAR ? err.message : err.message.split("\n")[0]}`);
} finally {
  await db.query(`update public.equipo set activo = false where nombre = $1`, [NOMBRE]).catch(() => {});
  await db.end();
}
await b.close();
resultado();
