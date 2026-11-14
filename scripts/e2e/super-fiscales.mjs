#!/usr/bin/env node
// F2.10 (SA-3) · CUIT y razón social del gimnasio en la pestaña Datos de la ficha del super admin (con sesión real del admin demo):
//   1. Un CUIT con el dígito verificador mal no se guarda y dice por qué, en palabras.
//   2. Uno bueno (con o sin guiones) se guarda; al recargar sigue ahí con guiones y dice quién lo cambió.
//   3. Se puede vaciar. Celular sin desborde.
//   node scripts/e2e/super-fiscales.mjs     (con scripts/local/levantar.sh corriendo)
import { execSync } from "node:child_process";
import pg from "pg";
import { CELU, PLATAFORMA as B, capturar, chequear, entrar, falla, navegador, ok, pagina, resultado } from "./comun.mjs";

const url = process.env.DB_PRUEBAS_URL || execSync("scripts/db/local.sh url").toString().trim();
const db = new pg.Client({ connectionString: url });
await db.connect();
const [{ id: gim }] = (await db.query(`select id from public.gimnasios where slug = 'demo'`)).rows;
const b = await navegador();
try {
  const p = await pagina(b);
  p.setDefaultTimeout(30000);
  await entrar(p, "admin@ejemplo.invalid", undefined, B);
  await p.goto(`${B}/admin/${gim}`);
  const fis = p.locator("[data-datos-fiscales]");
  await fis.waitFor({ timeout: 60000 });
  const cuit = fis.locator("[data-cuit]"), razon = fis.locator("[data-razon-social]");
  const guardar = fis.locator('button:has-text("Guardar datos para facturar")');

  // 1 · dígito verificador mal
  await cuit.fill("20-12345678-7");
  await razon.fill("Gimnasio Ficticio SRL");
  await guardar.click();
  await fis.getByText(/no es válido/).first().waitFor({ timeout: 15000 });
  chequear(/CUIT no es válido/.test(await fis.innerText()), "un CUIT con el dígito verificador mal no se guarda y dice por qué", `dijo: ${(await fis.innerText()).slice(0, 120)}`);

  // 2 · bueno: se guarda y queda
  await cuit.fill("20123456786");
  await guardar.click();
  await fis.locator("[data-fiscales-guardado]").waitFor({ timeout: 15000 });
  ok("un CUIT válido se guarda");
  await p.reload();
  await fis.waitFor({ timeout: 60000 });
  chequear(await cuit.inputValue() === "20-12345678-6", "al recargar, el CUIT sigue ahí, con guiones", `quedó ${await cuit.inputValue()}`);
  chequear(await razon.inputValue() === "Gimnasio Ficticio SRL", "…y la razón social", `quedó ${await razon.inputValue()}`);
  chequear(/Último cambio: admin/.test(await fis.locator("[data-fiscales-quien]").innerText()), "dice quién lo cambió por última vez", "no dice quién lo cambió");
  const [reg] = (await db.query(`select detalle from public.registro_brik where gimnasio_id = $1 and accion = 'guardar_datos_fiscales' order by creado_en desc limit 1`, [gim])).rows;
  chequear(reg?.detalle?.cuit === "20123456786", "queda en el registro de BRIK, con lo de antes y lo nuevo", `registro: ${JSON.stringify(reg?.detalle)}`);

  // 3 · se puede vaciar; celular
  await cuit.fill("");
  await razon.fill("");
  await guardar.click();
  await fis.locator("[data-fiscales-guardado]").waitFor({ timeout: 15000 });
  await p.reload();
  await fis.waitFor({ timeout: 60000 });
  chequear(await cuit.inputValue() === "" && await razon.inputValue() === "", "vaciar los dos campos los deja vacíos", "no se vació");
  await p.setViewportSize(CELU);
  chequear(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), "celular: sin desborde", "la ficha desborda en el celular");
  await capturar(p, "fiscales-celu");
} catch (e) {
  falla(`se cortó: ${process.env.E2E_DEPURAR ? e.stack : e.message.split("\n")[0]}`);
}
await db.query(`update public.configuracion_gimnasio set cuit_facturacion = null, razon_social = null where gimnasio_id = $1`, [gim]).catch(() => {});
await db.end();
await b.close();
resultado();
