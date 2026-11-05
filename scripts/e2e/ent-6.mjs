#!/usr/bin/env node
// ENT-6 · QR en la tablet: la dueña prende la tablet y "QR en la tablet"; la
// tablet muestra un QR que cambia; el socio lo escanea con su app (una cámara
// de prueba que lo filma) y entra; la tablet muestra "¡Pasá, …!".
//   npm run e2e:ent-6            (con scripts/local/levantar.sh corriendo)
import { execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import QRCode from "qrcode";
import { CELU, COMPU, GIMNASIO, capturar, chequear, entrar, falla, navegador, ok, pagina, resultado } from "./comun.mjs";

const G = GIMNASIO();
const b = await navegador();
async function reglas(d) {
  await d.goto(`${G}/panel/configuracion?pestana=reglas`);
  await d.locator('fieldset[data-pestana-activa="reglas"]').waitFor({ timeout: 60000 }); await d.waitForTimeout(500);
}
async function guardar(d) {
  const pie = d.locator('[data-pie="reglas"]'); const k = Number(await pie.getAttribute("data-respuestas"));
  await pie.locator('button:has-text("Guardar")').click();
  await d.waitForFunction((k) => Number(document.querySelector('[data-pie="reglas"]')?.getAttribute("data-respuestas")) > k, k, { timeout: 30000 });
}
const llave = (d, texto) => d.locator("[data-accesos] label", { hasText: texto }).locator("input");
let b2;
try {
  const d = await pagina(b, COMPU);
  await entrar(d, "duena@ejemplo.invalid");
  await reglas(d);
  if (!(await llave(d, "Tablet en la puerta").isChecked())) await llave(d, "Tablet en la puerta").click();
  if (!(await llave(d, "QR en la tablet").isChecked())) await llave(d, "QR en la tablet").click();
  await guardar(d);
  await d.locator('button:has-text("Autorizar una tablet")').click();
  const link = await d.locator("[data-link-tablet]").getAttribute("data-link-tablet", { timeout: 30000 });
  ok("la dueña prende la tablet y el QR en la tablet, y la autoriza");

  const t = await pagina(b, { width: 820, height: 1180 });
  await t.goto(link);
  const qr = t.locator("[data-qr-pared]");
  await t.waitForFunction(() => /^GYMOSP1\./.test(document.querySelector("[data-qr-pared]")?.getAttribute("data-qr-pared") ?? ""), null, { timeout: 30000 });
  const codigo = await qr.getAttribute("data-qr-pared");
  chequear(await qr.locator("svg").count() === 1, "la tablet muestra su QR para escanear", "no hay QR en la tablet");
  await capturar(t, "ent6-tablet-qr");

  // El socio, con una cámara de prueba que filma el QR de la tablet.
  const dir = mkdtempSync(join(tmpdir(), "gymos-qrp-"));
  await QRCode.toFile(join(dir, "qr.png"), codigo, { width: 480, margin: 4 });
  execFileSync("ffmpeg", ["-loglevel", "error", "-y", "-loop", "1", "-i", join(dir, "qr.png"), "-t", "3", "-r", "10", "-vf", "pad=640:480:(ow-iw)/2:(oh-ih)/2:white", "-pix_fmt", "yuv420p", join(dir, "qr.y4m")]);
  b2 = await navegador({ video: join(dir, "qr.y4m") });
  const s = await pagina(b2, CELU);
  await entrar(s, "socio@ejemplo.invalid");
  await s.goto(`${G}/app`);
  await s.locator('button:has-text("Escanear el QR de la entrada")').click();
  const res = s.locator("[data-resultado-escaneo]");
  await res.waitFor({ timeout: 45000 });
  chequear(await res.getAttribute("data-resultado-escaneo") === "entro", `el socio escanea y entra: “${(await res.innerText()).replace(/\s+/g, " ").slice(0, 60)}”`, `dice: ${await res.innerText()}`);
  await capturar(s, "ent6-celu-app");
  const pasa = t.locator("[data-kiosco-resultado]");
  await pasa.waitFor({ timeout: 30000 });   // la tablet pregunta cada pocos segundos; con la compu cargada tarda más
  chequear(/¡Pasá, Testigo!/.test(await pasa.innerText()), "la tablet muestra “¡Pasá, Testigo!”", `la tablet dice: ${await pasa.innerText()}`);
  if (s.errores.length) falla(`socio: ${s.errores.join(" | ")}`);

  // Dejar todo como estaba.
  await reglas(d);
  while (await d.locator('[data-tablets] button:has-text("Revocar")').count()) { await d.locator('[data-tablets] button:has-text("Revocar")').first().click(); await d.waitForTimeout(800); }
  await llave(d, "Tablet en la puerta").click(); await guardar(d);
  for (const [n, p] of [["dueña", d], ["tablet", t]]) if (p.errores.length) falla(`${n}: ${p.errores.join(" | ")}`);
} catch (e) {
  falla(`se cortó: ${process.env.E2E_DEPURAR ? e.message : e.message.split("\n")[0]}`);
}
await b2?.close();
await b.close();
resultado();
