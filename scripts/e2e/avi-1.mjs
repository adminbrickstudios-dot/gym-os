#!/usr/bin/env node
// AVI-1 · Bandeja de avisos del día: la recepción abre "📬 Avisos de hoy",
// ve a quién escribirle con el WhatsApp ya armado (el mensaje de
// Configuración) y marca "✓ Ya le avisé": al volver a abrir queda "Avisado por
// Ana" y va al final.
//   npm run e2e:avi-1            (con scripts/local/levantar.sh corriendo)
import { CELU, GIMNASIO, capturar, chequear, entrar, falla, navegador, ok, pagina, resultado } from "./comun.mjs";

const G = GIMNASIO();
const b = await navegador();
try {
  const r = await pagina(b, CELU);
  await entrar(r, "recepcion@ejemplo.invalid");
  await r.goto(`${G}/panel/avisos`);
  await r.locator("main h1").waitFor({ timeout: 60000 });
  const pendientes = r.locator('[data-avisado="no"]');
  await pendientes.first().waitFor({ timeout: 30000 });
  const n = await pendientes.count();
  const primero = pendientes.first();
  const nombre = (await primero.locator("a, span").first().innerText()).trim();
  const wa = await primero.locator('a:has-text("WhatsApp")').getAttribute("href").catch(() => null);
  chequear(!wa || /^https:\/\/wa\.me\/\d+\?text=/.test(wa), `${n} para avisar; el WhatsApp viene con el mensaje escrito`, String(wa));
  await capturar(r, "avi1-celu-bandeja");
  await primero.locator('button:has-text("Ya le avisé")').click();
  await r.locator('[data-avisado="si"]', { hasText: nombre }).first().waitFor({ timeout: 30000 });
  ok(`“✓ Ya le avisé” a ${nombre}`);
  await r.reload();
  const hecho = r.locator('[data-avisado="si"]', { hasText: nombre }).first();
  await hecho.waitFor({ timeout: 30000 });
  chequear(/Avisado por Ana/.test(await hecho.innerText()), "al volver: “✓ Avisado por Ana a las …”", await hecho.innerText());
  chequear(await r.locator('[data-avisado="no"]').count() === n - 1, `quedan ${n - 1} para avisar`, `quedan ${await r.locator('[data-avisado="no"]').count()}`);
  const ancho = await r.evaluate(() => document.documentElement.scrollWidth);
  chequear(ancho <= CELU.width, `celular sin desborde (${ancho}px)`, `desborda: ${ancho}`);
  if (r.errores.length) falla(`recepción: ${r.errores.join(" | ")}`);
} catch (e) {
  falla(`se cortó: ${process.env.E2E_DEPURAR ? e.message : e.message.split("\n")[0]}`);
}
await b.close();
resultado();
