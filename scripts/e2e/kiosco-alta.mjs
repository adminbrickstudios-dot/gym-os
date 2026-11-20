#!/usr/bin/env node
// Paneles completos · Alta en el kiosco: quien escribe un DNI que no está en el sistema ve su motivo y, si el gimnasio tiene las altas online
// prendidas, un QR a "Hacete socio". Con las altas apagadas (lo normal en un gimnasio real) no aparece ningún QR. En el demo; deja todo como estaba.
//   node scripts/e2e/kiosco-alta.mjs     (con scripts/local/levantar.sh corriendo)
import { execSync } from "node:child_process";
import pg from "pg";
import { COMPU, GIMNASIO, chequear, entrar, falla, navegador, ok, pagina, resultado } from "./comun.mjs";

const G = GIMNASIO();
const TABLET = { width: 820, height: 1180 };
const url = process.env.DB_PRUEBAS_URL || execSync("scripts/db/local.sh url").toString().trim();
const db = new pg.Client({ connectionString: url }); await db.connect();
const [{ id: gim, altas, accesos }] = (await db.query(`select g.id, c.altas_online as altas, c.accesos_activos as accesos from public.gimnasios g join public.configuracion_gimnasio c on c.gimnasio_id = g.id where g.slug = 'demo'`)).rows;
const b = await navegador();
const DNI_NUEVO = "99" + String(Date.now()).slice(-6);   // 8 cifras que no son de ningún socio
async function probar(t) {
  await t.goto(`${G}/kiosco`);
  await t.locator('[data-kiosco="listo"]').waitFor({ timeout: 60000 });
  await t.locator('input[aria-label="Tu DNI"]').fill(DNI_NUEVO);
  await t.locator('input[aria-label="Tu DNI"]').press("Enter");
  const res = t.locator("[data-kiosco-resultado]");
  await res.waitFor({ timeout: 30000 });
  return res;
}
try {
  // La tablet se prende y se autoriza como en ent-3 (por la base: es lo que hace la pantalla de la dueña).
  await db.query(`update public.configuracion_gimnasio set accesos_activos = (select array(select distinct unnest(accesos_activos || array['kiosco']))) where gimnasio_id = $1`, [gim]);
  const d = await pagina(b, COMPU);
  await entrar(d, "duena@ejemplo.invalid");
  await d.goto(`${G}/panel/configuracion?pestana=reglas`);
  await d.locator('fieldset[data-pestana-activa="reglas"]').waitFor({ timeout: 60000 });
  await d.locator('button:has-text("Autorizar una tablet")').click();
  const link = await d.locator("[data-link-tablet]").getAttribute("data-link-tablet", { timeout: 30000 });
  const t = await pagina(b, TABLET);
  await t.goto(link);
  await t.locator('[data-kiosco="listo"]').waitFor({ timeout: 60000 });

  // Altas apagadas: dice que no lo encontró y no hay QR
  await db.query(`update public.configuracion_gimnasio set altas_online = false where gimnasio_id = $1`, [gim]);
  await t.goto(`${G}/kiosco`);
  let res = await probar(t);
  chequear(/No encontramos ese DNI/.test(await res.innerText()), "un DNI que no está dice “No encontramos ese DNI”", `dice: ${(await res.innerText()).slice(0, 80)}`);
  chequear(await t.locator("[data-kiosco-alta]").count() === 0, "con las altas apagadas no hay QR de alta", "hay QR de alta con las altas apagadas");

  // Altas prendidas: el mismo caso trae el QR
  await db.query(`update public.configuracion_gimnasio set altas_online = true where gimnasio_id = $1`, [gim]);
  res = await probar(t);
  await t.locator("[data-kiosco-alta] svg").waitFor({ timeout: 30000 });
  ok("con las altas prendidas, el DNI que no está ofrece el QR para anotarse solo");
  const ancho = await t.evaluate(() => document.documentElement.scrollWidth);
  chequear(ancho <= TABLET.width, `sin desborde (${ancho}px)`, `la tablet desborda: ${ancho}px`);

  // Se limpia: se revoca la tablet
  await d.goto(`${G}/panel/configuracion?pestana=reglas`);
  await d.locator('[data-tablets] button:has-text("Revocar")').first().click();
  await d.waitForTimeout(1500);
} catch (e) {
  falla(`se cortó: ${process.env.E2E_DEPURAR ? e.message : e.message.split("\n")[0]}`);
} finally {
  await db.query(`update public.configuracion_gimnasio set altas_online = $2, accesos_activos = $3 where gimnasio_id = $1`, [gim, altas, accesos]);
  await db.end();
}
await b.close();
resultado();
