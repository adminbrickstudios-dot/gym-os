#!/usr/bin/env node
// APP-9 · Entrar con mail: un socio con mail cargado entra con "✉️ Mail" y
// el código; crea su contraseña en "Mi membresía"; sale y vuelve a entrar
// con "🔑 Contraseña". El socio de prueba se crea con un mail nuevo y se da
// de baja al final.
//   npm run e2e:app-9            (con scripts/local/levantar.sh corriendo)
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import pg from "pg";
import { CELU, GIMNASIO, falla, navegador, ok, pagina, resultado } from "./comun.mjs";

const G = GIMNASIO();
const url = process.env.DB_PRUEBAS_URL || execSync("scripts/db/local.sh url").toString().trim();
const db = new pg.Client({ connectionString: url }); await db.connect();
const [{ id: gim }] = (await db.query(`select id from public.gimnasios where slug = 'demo'`)).rows;
const MAIL = `app9-${Date.now() % 1000000}@ejemplo.invalid`;
const [{ id: socio }] = (await db.query(`insert into public.socios (gimnasio_id, nombre, apellido, email) values ($1,'Entra','Con Mail',$2) returning id`, [gim, MAIL])).rows;
const CLAVE = "clave-e2e-123";
const b = await navegador();
try {
  const s = await pagina(b, CELU);
  await s.goto(`${G}/ingresar?modo=socio`);
  await s.getByRole("button", { name: /Mail/ }).click();
  await s.fill("[data-ingreso-mail] input[name=email]", MAIL);
  await s.getByRole("button", { name: /Mandame el código/ }).click();
  await s.locator("input[name=codigo]").waitFor({ timeout: 30000 });
  const codigos = JSON.parse(readFileSync(join(process.cwd(), ".local", "codigos.json"), "utf8"));
  await s.fill("input[name=codigo]", String(codigos[MAIL]));
  // Con 6 dígitos se manda solo (VD-33): solo se toca "Entrar" si el botón sigue ahí.
  await s.waitForURL(/\/app/, { timeout: 5000 }).catch(async () => {
    const entrar = s.getByRole("button", { name: /Entrar/ });
    if (await entrar.count()) await entrar.click({ timeout: 5000 }).catch(() => {});
  });
  await s.waitForURL(/\/app/, { timeout: 60000 });
  await s.getByText(/Hola, Entra/).waitFor({ timeout: 60000 });
  ok("✉️ Mail + código: entra a la app como su socio");

  await s.goto(`${G}/app/cuenta`);
  const f = s.locator("[data-crear-contrasena]");
  await f.waitFor({ timeout: 60000 });
  await f.locator("input[type=password]").fill(CLAVE);
  await f.getByRole("button", { name: /Guardar contraseña/ }).click();
  await f.getByText(/ya podés entrar con tu mail/).waitFor({ timeout: 30000 });
  ok("🔑 crea su contraseña en Mi membresía");

  await s.getByRole("button", { name: "Salir" }).click();
  await s.waitForURL(/\/ingresar|\/$/, { timeout: 30000 });
  await s.goto(`${G}/ingresar?modo=socio`);
  await s.getByRole("button", { name: /Contraseña/ }).click();
  await s.fill("input[type=email]", MAIL);
  await s.fill("input[type=password]", CLAVE);
  // Con 6 dígitos se manda solo (VD-33): solo se toca "Entrar" si el botón sigue ahí.
  await s.waitForURL(/\/app/, { timeout: 5000 }).catch(async () => {
    const entrar = s.getByRole("button", { name: /Entrar/ });
    if (await entrar.count()) await entrar.click({ timeout: 5000 }).catch(() => {});
  });
  await s.waitForURL(/\/app/, { timeout: 60000 });
  await s.getByText(/Hola, Entra/).waitFor({ timeout: 60000 });
  ok("sale y vuelve a entrar con mail y contraseña");
  if (s.errores.length) falla(`socio: ${s.errores.join(" | ")}`);
} catch (e) {
  falla(`se cortó: ${process.env.E2E_DEPURAR ? e.message : e.message.split("\n")[0]}`);
} finally {
  await db.query(`update public.socios set dado_de_baja_en = now(), motivo_baja = 'otro' where id = $1`, [socio]).catch(() => {});
  await db.end();
}
await b.close();
resultado();
