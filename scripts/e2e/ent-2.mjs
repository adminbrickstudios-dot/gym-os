#!/usr/bin/env node
// ENT-2 · QR del socio: la dueña lo prende; el socio ve en su app un QR que
// cambia cada 30 s; la recepción lo lee con un lector (lo escribe en el
// buscador) y entra solo; el mismo código no sirve dos veces; con la cámara
// (una cámara de prueba que filma el QR) también entra.
//   npm run e2e:ent-2            (con scripts/local/levantar.sh corriendo)
import { execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import QRCode from "qrcode";
import { CELU, COMPU, GIMNASIO, capturar, chequear, entrar, falla, navegador, ok, pagina, resultado } from "./comun.mjs";

const G = GIMNASIO();
const b = await navegador();
async function prenderQr(p, prender) {
  await p.goto(`${G}/panel/configuracion?pestana=reglas`);
  await p.locator('fieldset[data-pestana-activa="reglas"]').waitFor({ timeout: 60000 }); await p.waitForTimeout(800);
  const sw = p.locator("[data-accesos] label", { hasText: "QR del socio" }).locator("input");
  if (await sw.isChecked() === prender) return;
  await sw.click();
  const pie = p.locator('[data-pie="reglas"]'); const n = Number(await pie.getAttribute("data-respuestas"));
  await pie.locator('button:has-text("Guardar")').click();
  await p.waitForFunction((n) => Number(document.querySelector('[data-pie="reglas"]')?.getAttribute("data-respuestas")) > n, n, { timeout: 30000 });
}
const codigoNuevo = async (s, anterior = null) => {
  for (let i = 0; i < 40; i++) {
    await s.goto(`${G}/app`);
    const c = await s.locator("[data-mi-qr]").getAttribute("data-codigo", { timeout: 30000 });
    if (c !== anterior) return c;
    await s.waitForTimeout(2000);
  }
  throw new Error("el QR no cambió en 80 segundos");
};
try {
  const d = await pagina(b, COMPU);
  await entrar(d, "duena@ejemplo.invalid");
  await prenderQr(d, true);
  ok("la dueña prende “QR del socio” en Reglas");

  const s = await pagina(b, CELU);
  await entrar(s, "socio@ejemplo.invalid");
  let c1 = await codigoNuevo(s);
  await s.locator("[data-mi-qr] div[aria-hidden] svg").waitFor({ timeout: 15000 }).catch(() => {});
  chequear(/^GYMOS1\./.test(c1) && await s.locator("[data-mi-qr] div[aria-hidden] svg").count() === 1, "la app del socio muestra su QR", "no hay QR en la app");
  await capturar(s, "ent2-celu-app-qr");

  const r = await pagina(b, COMPU);
  await entrar(r, "recepcion@ejemplo.invalid");
  await r.goto(`${G}/panel/entrada`);
  chequear(await r.locator('button:has-text("Leer QR")').count() === 1, "en Entrada aparece “Leer QR”", "no está Leer QR");
  const buscar = r.locator('input[aria-label="Buscar socio"]');
  const hecho = r.locator("[data-hecho]");
  for (let intento = 0; ; intento++) {
    await buscar.fill(c1); await buscar.press("Enter");                       // un lector USB escribe el código y Enter
    const usado = await Promise.race([hecho.waitFor({ timeout: 30000 }).then(() => false), r.getByText("ya se usó").waitFor({ timeout: 30000 }).then(() => true)]);
    if (!usado) break;
    if (intento) throw new Error("el QR nuevo también figura usado");
    c1 = await codigoNuevo(s, c1);                                            // una corrida anterior usó el de esta ventana
  }
  chequear(/Testigo Al Día/.test(await hecho.innerText()), `con el lector entra solo: “${(await hecho.innerText()).replace(/\s+/g, " ").replace(/.*/, "").trim()}”`, `dice: ${await hecho.innerText()}`);
  await hecho.locator('button:has-text("Deshacer")').click().catch(() => {});
  await buscar.fill(c1); await buscar.press("Enter");
  await r.getByText("ya se usó").waitFor({ timeout: 30000 });
  ok("el mismo código no sirve dos veces");
  await buscar.fill(c1.replace(/\.[0-9a-f]{24}$/, ".000000000000000000000000")); await buscar.press("Enter");
  await r.getByText("no es válido").waitFor({ timeout: 30000 });
  ok("uno inventado tampoco");
  if (r.errores.length) falla(`recepción: ${r.errores.join(" | ")}`);
  await r.context().close();

  // ── Cámara: una cámara de prueba que filma el QR del socio ──
  const c2 = await codigoNuevo(s, c1);
  const dir = mkdtempSync(join(tmpdir(), "gymos-qr-"));
  await QRCode.toFile(join(dir, "qr.png"), c2, { width: 480, margin: 4 });
  execFileSync("ffmpeg", ["-loglevel", "error", "-y", "-loop", "1", "-i", join(dir, "qr.png"), "-t", "3", "-r", "10", "-vf", "pad=640:480:(ow-iw)/2:(oh-ih)/2:white", "-pix_fmt", "yuv420p", join(dir, "qr.y4m")]);
  const b2 = await navegador({ video: join(dir, "qr.y4m") });
  const r2 = await pagina(b2, COMPU);
  await entrar(r2, "recepcion@ejemplo.invalid");
  await r2.goto(`${G}/panel/entrada`);
  await r2.locator('button:has-text("Leer QR")').click();
  const leyo = await Promise.race([
    r2.locator("[data-hecho]").waitFor({ timeout: 45000 }).then(() => null),
    r2.locator('main [role="alert"], main .mensaje-error').first().waitFor({ timeout: 45000 }).then(async () => await r2.locator('main [role="alert"], main .mensaje-error').first().innerText()),
  ]).catch(async () => `nada después de 45 s (cámara: ${await r2.locator("[data-camara]").getAttribute("data-camara").catch(() => "cerrada")})`);
  if (leyo) throw new Error(`la cámara: ${leyo}`);
  chequear(/Testigo Al Día/.test(await r2.locator("[data-hecho]").innerText()), "con la cámara lee el QR y entra solo", `dice: ${await r2.locator("[data-hecho]").innerText()}`);
  await r2.locator('[data-hecho] button:has-text("Deshacer")').click().catch(() => {});
  await r2.reload();
  await r2.locator('[data-hoy]').waitFor();
  if (r2.errores.length) falla(`recepción (cámara): ${r2.errores.join(" | ")}`);
  await b2.close();

  await prenderQr(d, false);
  await s.goto(`${G}/app`); await s.locator("main").waitFor();
  chequear(await s.locator("[data-mi-qr]").count() === 0, "apagado: la app ya no muestra el QR", "la app sigue mostrando el QR");
  for (const [n, p] of [["dueña", d], ["socio", s]]) if (p.errores.length) falla(`${n}: ${p.errores.join(" | ")}`);
} catch (e) {
  falla(`se cortó: ${process.env.E2E_DEPURAR ? e.message : e.message.split("\n")[0]}`);
}
await b.close();
resultado();
