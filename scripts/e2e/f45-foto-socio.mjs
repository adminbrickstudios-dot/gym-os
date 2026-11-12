#!/usr/bin/env node
// FA-16 (D57) · El socio sube su foto desde la app solo si el gimnasio lo permite (apagado por defecto); la recepción la ve
// marcada "Foto nueva, subida por el socio" hasta que la confirma. En el gimnasio demo; deja todo como estaba.
//   node scripts/e2e/f45-foto-socio.mjs     (con scripts/local/levantar.sh corriendo)
import { CELU, COMPU, GIMNASIO, chequear, entrar, navegador, ok, pagina, resultado } from "./comun.mjs";

const G = GIMNASIO();
const b = await navegador();
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");

async function permitir(d, si) {
  await d.goto(`${G}/panel/configuracion?pestana=reglas`);
  const caja = d.locator("[data-foto-socio]");
  await d.waitForFunction(() => document.querySelector("[data-foto-socio]")?.getAttribute("data-foto-socio") !== "cargando", null, { timeout: 60000 });
  if ((await caja.getAttribute("data-foto-socio")) === (si ? "si" : "no")) return;
  await caja.locator('input[type="checkbox"]').click();
  await d.waitForFunction((v) => document.querySelector("[data-foto-socio]")?.getAttribute("data-foto-socio") === v, si ? "si" : "no", { timeout: 30000 });
}

try {
  const d = await pagina(b, COMPU);
  await entrar(d, "duena@ejemplo.invalid");
  await permitir(d, false);

  // Apagado (por defecto): el socio no tiene dónde subirla
  const s = await pagina(b, CELU);
  await entrar(s, "socio@ejemplo.invalid");
  await s.goto(`${G}/app/yo`);
  await s.locator("main, body").first().waitFor({ timeout: 60000 });
  await s.waitForTimeout(800);
  chequear(await s.locator("[data-mi-foto]").count() === 0, "apagado: la app no ofrece subir la foto", "la app ofrece subir la foto con la función apagada");

  // La dueña lo prende
  await permitir(d, true);
  await s.goto(`${G}/app/yo`);
  await s.locator("[data-mi-foto]").waitFor({ timeout: 60000 });
  ok("prendido: la app ofrece subir la foto");
  await s.locator('input[type="file"]').setInputFiles({ name: "foto.png", mimeType: "image/png", buffer: PNG });
  await s.waitForFunction(() => document.querySelector("[data-mi-foto]")?.getAttribute("data-mi-foto") === "si", null, { timeout: 30000 });
  ok("el socio sube su foto y la ve");
  await s.waitForTimeout(1500);

  // La recepción la ve marcada hasta confirmarla
  const r = await pagina(b, COMPU);
  await entrar(r, "recepcion@ejemplo.invalid");
  await r.goto(`${G}/panel/socios?q=${encodeURIComponent("Testigo Al D")}`);
  const fila = r.locator('main ul a[href^="/panel/socios/"]', { hasText: /Testigo Al D[ií]a/ }).first();
  await fila.waitFor({ timeout: 30000 });
  await r.goto(`${G}${await fila.getAttribute("href")}`);
  await r.locator("[data-foto-sin-confirmar]").waitFor({ timeout: 30000 });
  chequear(/subida por el socio/i.test(await r.locator("[data-foto-sin-confirmar]").innerText()), "la recepción ve “Foto nueva, subida por el socio”", "la ficha no marca la foto nueva");
  await r.locator('[data-foto-sin-confirmar] button:has-text("Confirmar")').click();
  await r.locator("[data-foto-sin-confirmar]").waitFor({ state: "detached", timeout: 30000 });
  ok("al confirmarla, la marca se va");

  // El demo queda como estaba: se quita la foto y se apaga la función
  await r.locator('button[aria-label="Cambiar la foto"]').click();
  await r.locator('button:has-text("Quitar la foto")').click();
  await r.locator('[data-foto="no"]').waitFor({ timeout: 30000 });
  await permitir(d, false);
  chequear([d, s, r].every((p) => p.errores.length === 0), "sin errores de página ni 5xx", [d, s, r].flatMap((p) => p.errores).join(" | "));
} catch (e) { console.error(e); process.exitCode = 1; }
finally { await b.close(); resultado(); }
