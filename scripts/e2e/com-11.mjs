#!/usr/bin/env node
// COM-11 · Píxel y Analytics: la dueña pega los IDs en Tu página (un código
// entero lo rechaza) → la página publicada carga el píxel y el gtag con esos
// IDs → sin publicar no carga nada. Deja todo como estaba.
//   npm run e2e:com-11           (con scripts/local/levantar.sh corriendo)
import { execSync } from "node:child_process";
import pg from "pg";
import { CELU, COMPU, GIMNASIO, aparece, capturar, chequear, entrar, falla, navegador, pagina, resultado } from "./comun.mjs";

const G = GIMNASIO();
const PX = "1234567890" + Date.now().toString().slice(-5);
const GA = "G-PRUEBA" + Date.now().toString().slice(-4);
const db = new pg.Client({ connectionString: process.env.DB_PRUEBAS_URL || execSync("scripts/db/local.sh url").toString().trim() });
await db.connect();
const [{ id: gim }] = (await db.query(`select id from public.gimnasios where slug = 'demo'`)).rows;
const [antes] = (await db.query(`select publicada, pixel_meta, google_analytics from public.landing_gimnasio where gimnasio_id = $1`, [gim])).rows;
const b = await navegador();
try {
  const d = await pagina(b, COMPU);
  d.setDefaultNavigationTimeout(120000);
  await entrar(d, "duena@ejemplo.invalid");
  await d.goto(`${G}/panel/pagina`);
  const m = d.locator("[data-medicion]");
  await m.waitFor({ timeout: 60000 });
  await m.locator('input[aria-label="ID del píxel de Meta"]').fill("<script>fbq()</script>");
  await m.locator('button:has-text("Guardar")').click();
  chequear(await aparece(m.getByText(/solo números/), 30000), "pegar código entero: “El ID del píxel de Meta son solo números…”", "aceptó código libre");
  await m.locator('input[aria-label="ID del píxel de Meta"]').fill(PX);
  await m.locator('input[aria-label="ID de Google Analytics"]').fill(GA.toLowerCase());
  await m.locator('button:has-text("Guardar")').click();
  await m.getByText("Guardado.").waitFor({ timeout: 30000 });
  chequear(await m.locator('input[aria-label="ID de Google Analytics"]').inputValue() === GA, `la dueña guarda el píxel y Analytics (${GA}, en mayúsculas)`, "no quedó el ID de Analytics");

  await db.query(`update public.landing_gimnasio set publicada = true where gimnasio_id = $1`, [gim]);
  const v = await pagina(b, CELU);
  v.setDefaultNavigationTimeout(120000);
  await v.goto(`${G}/`);
  await v.locator("h1").first().waitFor({ timeout: 60000 });
  await v.waitForFunction(() => document.getElementById("pixel-meta"), null, { timeout: 30000 }).catch(() => {});
  const pixel = await v.evaluate(() => document.getElementById("pixel-meta")?.textContent ?? "");
  const gtag = await v.locator(`script[src*="googletagmanager.com/gtag/js?id=${GA}"]`).count();
  chequear(pixel.includes(`fbq('init','${PX}')`) && gtag > 0, "la página publicada carga el píxel y el gtag con esos IDs", `píxel: ${pixel.slice(0, 80) || "no está"} · gtag: ${gtag}`);
  await capturar(v, "com11-celu-pagina");

  await db.query(`update public.landing_gimnasio set publicada = false where gimnasio_id = $1`, [gim]);
  await v.goto(`${G}/`);
  await v.locator("h1").first().waitFor({ timeout: 60000 });
  await v.waitForTimeout(1500);
  const quedan = await v.evaluate(() => !!document.getElementById("pixel-meta") || !!document.querySelector('script[src*="googletagmanager"]'));
  chequear(!quedan, "sin publicar no carga nada", "la página sin publicar carga la medición");
  if (d.errores.length) falla(d.errores.join(" | "));
} catch (e) {
  falla(`se cortó: ${process.env.E2E_DEPURAR ? e.message : e.message.split("\n")[0]}`);
} finally {
  if (antes) await db.query(`update public.landing_gimnasio set publicada = $2, pixel_meta = $3, google_analytics = $4 where gimnasio_id = $1`,
    [gim, antes.publicada, antes.pixel_meta, antes.google_analytics]).catch(() => {});
  await db.end();
}
await b.close();
resultado();
