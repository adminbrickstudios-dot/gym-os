// Ayudas para probar pantallas con sesión real contra la app local
// (scripts/local/levantar.sh). Nunca apuntan a producción.
import { mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";

export const PUERTO = process.env.PUERTO_APP ?? "3123";
export const PLATAFORMA = `http://localhost:${PUERTO}`;
export const GIMNASIO = (slug = "demo") => `http://${slug}.localhost:${PUERTO}`;
export const CLAVE_DEMO = "demo-gymos";
export const CAPTURAS = process.env.CAPTURAS ?? join(process.cwd(), ".local", "capturas");
export const COMPU = { width: 1440, height: 900 };
export const CELU = { width: 390, height: 844 };

if (/supabase\.co|vercel\.app/.test(process.env.BASE ?? "")) {
  console.error("Las pruebas de pantalla corren solo contra la app local.");
  process.exit(1);
}

let pasos = 0;
let fallas = 0;
export const ok = (m) => console.log(`✓ ${++pasos}. ${m}`);
export const falla = (m) => { fallas++; console.log(`✗ ${m}`); };
/** Un paso que pasa o falla según la condición. */
export const chequear = (condicion, siPasa, siFalla) => (condicion ? ok(siPasa) : falla(siFalla));
export const resultado = () => {
  console.log(fallas ? `\n✗ ${fallas} falla(s) en ${pasos + fallas} pasos` : `\n✓ ${pasos} pasos en verde`);
  process.exitCode = fallas ? 1 : 0;
};

/** Navegador con *.localhost resuelto a la compu (demo.localhost, box.localhost…). */
export async function navegador({ camara = false, video = null } = {}) {
  // camara: una cámara de mentira (Chrome dibuja un patrón) que da permiso sola, para probar las fotos.
  // video: lo que "filma" esa cámara (un .y4m; el .mjpeg Chrome no lo toma), por ejemplo un QR para el lector de la Entrada.
  const extra = camara || video ? ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"] : [];
  if (video) extra.push(`--use-file-for-fake-video-capture=${video}`);
  return chromium.launch({ args: ["--host-resolver-rules=MAP *.localhost 127.0.0.1", ...extra] });
}

/** Página nueva que junta errores de la página y respuestas 5xx. */
export async function pagina(b, viewport = COMPU, opciones = {}) {
  // opciones: más del contexto (por ejemplo el userAgent de un iPhone).
  const ctx = await b.newContext({ viewport, deviceScaleFactor: 1, ...opciones });
  const p = await ctx.newPage();
  p.errores = [];
  // Con la app compilada el HTML llega antes que React, y el contenido de la pantalla (que viene en
  // streaming) se hidrata después que el marco: un clic en ese momento se pierde. Después de cada
  // carga o cambio de dirección se espera a que React tome la página y a que la red se calme.
  const listo = async () => {
    await p.waitForFunction(() => document.documentElement.dataset.hidratado === "1" && !document.querySelector('[data-pagina-hidratada="0"]'),
      null, { timeout: 20000 }).catch(() => {});
  };
  for (const metodo of ["goto", "reload", "waitForURL"]) {
    const original = p[metodo].bind(p);
    p[metodo] = async (...a) => { const r = await original(...a); await listo(); return r; };
  }
  p.on("pageerror", (e) => p.errores.push(`error en la página: ${e.message.slice(0, 200)}`));
  p.on("response", (r) => { if (r.status() >= 500) p.errores.push(`HTTP ${r.status()} ${r.url()}`); });
  p.on("dialog", (d) => d.accept());
  // E2E_CONSOLA=1: muestra los errores y advertencias de la consola del navegador (para investigar).
  if (process.env.E2E_CONSOLA) p.on("console", (m) => { if (["error", "warning"].includes(m.type())) console.log(`  [consola ${m.type()}] ${p.url()} ${m.text().slice(0, Number(process.env.E2E_CONSOLA) > 1 ? 4000 : 300)}`); });
  return p;
}

/** Entra con mail y contraseña desde /ingresar de `base` y espera salir de /ingresar. */
export async function entrar(p, mail, clave = CLAVE_DEMO, base = GIMNASIO()) {
  await p.goto(`${base}/ingresar`);
  await p.fill("input[type=email]", mail);
  await p.fill("input[type=password]", clave);
  await p.click("button[type=submit]");
  await p.waitForURL((u) => !u.pathname.startsWith("/ingresar"), { timeout: 60000 });
}

/** Socio: celular → código (lo lee de .local/codigos.json, que escribe supabase-local). */
export async function entrarSocio(p, telefono, base = GIMNASIO()) {
  await p.goto(`${base}/ingresar?modo=socio`);
  await p.fill("input[name=telefono]", telefono);
  await p.click('button:has-text("código")');
  await p.locator("input[name=codigo]").waitFor({ timeout: 30000 });
  const codigos = JSON.parse(readFileSync(join(process.cwd(), ".local", "codigos.json"), "utf8"));
  const c = codigos[telefono] ?? Object.values(codigos).pop();
  await p.fill("input[name=codigo]", String(c?.codigo ?? c));
  await p.click("button[type=submit]");
  await p.waitForURL(/\/app/, { timeout: 60000 });
}

/** Captura JPG en .local/capturas/<nombre>.jpg (para mirarla, no se commitea). */
export async function capturar(p, nombre, completa = false) {
  mkdirSync(CAPTURAS, { recursive: true });
  await p.screenshot({ path: join(CAPTURAS, `${nombre}.jpg`), type: "jpeg", quality: 80, fullPage: completa });
}

/** true si el elemento aparece dentro de unos segundos (React puede tardar un instante en pintar). */
export const aparece = (loc, ms = 5000) => loc.first().waitFor({ timeout: ms }).then(() => true, () => false);

/** Texto que delata una pantalla rota (error de Next o boundary). */
export const PANTALLA_ROTA = /Application error|Something went wrong|Algo salió mal|Unhandled Runtime Error/i;

/** Después de "✅ Cobrar" en Vender: espera "Cobrado $…" o corta con el error que muestra. */
export async function esperarCobro(p) {
  const r = await Promise.race([
    p.getByText(/^Cobrado \$/).first().waitFor({ timeout: 30000 }).then(() => null),
    p.locator('aside [role="alert"]').waitFor({ timeout: 30000 }).then(async () => await p.locator('aside [role="alert"]').innerText()),
  ]);
  if (r) throw new Error(`al cobrar: ${r}`);
}
