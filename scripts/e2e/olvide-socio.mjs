#!/usr/bin/env node
// F1.2 · El socio entra con mail y contraseña (es lo primero que se ve), "Olvidé mi contraseña" funciona de punta a punta
// y los errores tienen nombre. Falló en Actions en el botón Salir (CSP form-action frenaba la redirección de /salir, ver LECCIONES);
// los pasos del código por mail y de la contraseña andaban.
//   node scripts/e2e/olvide-socio.mjs     (con scripts/local/levantar.sh corriendo)
//
//  1. Mail y contraseña es la forma que se ve primero en /ingresar?modo=socio.
//  2. Un mail sin ficha ni usuario en el gimnasio: "Ese mail no tiene cuenta en <gimnasio>".
//  3. Un socio con mail entra por el código del mail, crea su contraseña y sale.
//  4. "¿Te olvidaste la contraseña?" → mail → código → contraseña nueva → cae en su app.
//  5. La contraseña vieja ya no sirve; la nueva sí.
//  6. El link de alta ("Creá tu contraseña") abre con el mail puesto y el título propio.
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import pg from "pg";
import { CELU, GIMNASIO, falla, navegador, ok, pagina, resultado, chequear } from "./comun.mjs";

const G = GIMNASIO();
const url = process.env.DB_PRUEBAS_URL || execSync("scripts/db/local.sh url").toString().trim();
const db = new pg.Client({ connectionString: url }); await db.connect();
const [{ id: gim }] = (await db.query(`select id from public.gimnasios where slug = 'demo'`)).rows;
const MAIL = `olvide-${Date.now() % 1000000}@ejemplo.invalid`;
const [{ id: socio }] = (await db.query(`insert into public.socios (gimnasio_id, nombre, apellido, email) values ($1,'Olvida','De Clave',$2) returning id`, [gim, MAIL])).rows;
const VIEJA = "clave-vieja-123";
const NUEVA = "clave-nueva-456";
const codigoDe = (destino) => String(JSON.parse(readFileSync(join(process.cwd(), ".local", "codigos.json"), "utf8"))[destino]);
const b = await navegador();

/** Escribe el código de 6 dígitos; con el sexto se manda solo (VD-33), y si no, se toca el botón. */
async function ponerCodigo(p, destino) {
  await p.locator("input[name=codigo]").waitFor({ timeout: 30000 });
  await p.fill("input[name=codigo]", codigoDe(destino));
}

try {
  const s = await pagina(b, CELU);

  // 1 · Mail y contraseña adelante.
  await s.goto(`${G}/ingresar?modo=socio`);
  await s.locator("input[type=password]").waitFor({ timeout: 30000 });
  chequear(await s.locator("[data-olvide]").isVisible(), "el socio ve mail, contraseña y “¿Te olvidaste la contraseña?” sin tocar nada", "la forma principal no es mail y contraseña");
  chequear(await s.getByText("Otras formas de entrar").isVisible(), "las otras formas quedan abajo, en “Otras formas de entrar”", "no aparece “Otras formas de entrar”");

  // 2 · Error con nombre.
  await s.fill("input[type=email]", `nadie-${Date.now() % 100000}@ejemplo.invalid`);
  await s.fill("input[type=password]", "no-importa-123");
  await s.click("button[type=submit]");
  await s.locator("[role=alert]", { hasText: /Ese mail no tiene cuenta en/ }).waitFor({ timeout: 30000 });
  ok("un mail sin cuenta en el gimnasio: “Ese mail no tiene cuenta en …”");

  // 3 · Entra por el código del mail y crea su contraseña.
  await s.goto(`${G}/ingresar?modo=socio`);
  await s.getByRole("button", { name: /Mail/ }).click();
  await s.fill("[data-ingreso-mail] input[name=email]", MAIL);
  await s.getByRole("button", { name: /Mandame el código/ }).click();
  await ponerCodigo(s, MAIL);
  await s.waitForURL(/\/app/, { timeout: 60000 });
  await s.goto(`${G}/app/cuenta`);
  const crear = s.locator("[data-crear-contrasena]");
  await crear.waitFor({ timeout: 60000 });
  await crear.locator("input[type=password]").fill(VIEJA);
  await crear.getByRole("button", { name: /Guardar contraseña/ }).click();
  await crear.getByText(/ya podés entrar con tu mail/).waitFor({ timeout: 30000 });
  ok("el socio crea su contraseña (la de antes de olvidarla)");
  await s.getByRole("button", { name: "Salir" }).click();
  await s.waitForURL(/\/ingresar|\/$/, { timeout: 30000 });

  // 4 · "Olvidé mi contraseña".
  await s.goto(`${G}/ingresar?modo=socio`);
  await s.locator("[data-olvide]").click();
  await s.waitForURL(/\/ingresar\/recuperar/, { timeout: 30000 });
  // Sin SMTP (CI y local) la pantalla promete lo que sí hay: pedirle una clave nueva a la recepción (C1, ver clave-nueva.mjs);
  // el formulario del código sigue andando contra supabase-local, que deja los códigos en .local/codigos.json.
  if (process.env.SMTP_CONFIGURADO !== "1") {
    await s.locator("[data-sin-smtp]").waitFor({ timeout: 30000 });
    chequear(/Pedile una clave nueva a la recepción/.test(await s.locator("[data-sin-smtp]").innerText()), "sin SMTP, “Olvidé mi contraseña” manda a pedir una clave nueva a la recepción", "sin SMTP no aparece el aviso de la clave nueva");
  }
  await s.fill("[data-paso-mail] input[name=email]", MAIL);
  await s.getByRole("button", { name: /Mandame el código/ }).click();
  await ponerCodigo(s, MAIL);
  const nueva = s.locator("[data-paso-nueva]");
  await nueva.waitFor({ timeout: 60000 });
  await nueva.locator("input[name=contrasena]").fill(NUEVA);
  await nueva.locator("input[name=repetir]").fill(NUEVA);
  await nueva.getByRole("button", { name: /Guardar y entrar/ }).click();
  await s.waitForURL(/\/app/, { timeout: 60000 });
  await s.getByText(/Hola, Olvida/).waitFor({ timeout: 60000 });
  ok("“Olvidé”: mail → código → contraseña nueva → entra a su app");

  // 5 · La vieja ya no sirve; la nueva sí.
  await s.goto(`${G}/app/cuenta`);
  await s.getByRole("button", { name: "Salir" }).click();
  await s.waitForURL(/\/ingresar|\/$/, { timeout: 30000 });
  await s.goto(`${G}/ingresar?modo=socio`);
  await s.fill("input[type=email]", MAIL);
  await s.fill("input[type=password]", VIEJA);
  await s.click("button[type=submit]");
  await s.locator("[role=alert]", { hasText: /no son correctos/ }).waitFor({ timeout: 30000 });
  ok("la contraseña vieja ya no entra");
  await s.fill("input[type=password]", NUEVA);
  await s.click("button[type=submit]");
  await s.waitForURL(/\/app/, { timeout: 60000 });
  ok("la contraseña nueva entra");

  // 6 · El link de alta.
  const l = await pagina(b, CELU);
  await l.goto(`${G}/ingresar/recuperar?nueva=1&siguiente=%2Fapp&email=${encodeURIComponent(MAIL)}`);
  await l.getByRole("heading", { name: "Creá tu contraseña" }).waitFor({ timeout: 30000 });
  chequear((await l.locator("[data-paso-mail] input[name=email]").inputValue()) === MAIL, "el link de alta abre “Creá tu contraseña” con el mail ya puesto", "el link no llena el mail");

  if (s.errores.length) falla(`socio: ${s.errores.join(" | ")}`);
} catch (e) {
  falla(`se cortó: ${process.env.E2E_DEPURAR ? e.message : e.message.split("\n")[0]}`);
} finally {
  await db.query(`update public.socios set dado_de_baja_en = now(), motivo_baja = 'otro' where id = $1`, [socio]).catch(() => {});
  await db.end();
}
await b.close();
resultado();
