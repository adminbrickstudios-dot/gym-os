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
let ultimaPagina = null;
const pendientes = [];
export const falla = (m) => {
  fallas++; console.log(`✗ ${m}`);
  // Para investigar: foto y texto de la última pantalla abierta en el momento de la falla (se guardan antes de cerrar el navegador).
  const p = ultimaPagina;
  if (p && !p.isClosed() && pendientes.length < 6) {
    const n = `falla-${process.argv[1]?.split(/[\\/]/).pop()?.replace(".mjs", "")}-${fallas}`;
    mkdirSync(CAPTURAS, { recursive: true });
    pendientes.push(p.screenshot({ path: join(CAPTURAS, `${n}.jpg`), type: "jpeg", quality: 60, timeout: 5000 }).catch(() => {}));
    pendientes.push(p.locator("main").first().innerText({ timeout: 3000 }).then((t) => console.log(`  [pantalla ${p.url()}] ${t.replace(/\s+/g, " ").slice(0, 1500)}`)).catch(() => {}));
  }
};
/** Un paso que pasa o falla según la condición. */
export const chequear = (condicion, siPasa, siFalla) => (condicion ? ok(siPasa) : falla(siFalla));
let avisosReact = 0;
const rutasReact = new Set();
export const resultado = () => {
  if (avisosReact) console.log(`⚠ ${avisosReact} aviso(s) de hidratación de React (#418, se recupera sola; VD-TRI1) en: ${[...rutasReact].join(", ") || "—"}`);
  console.log(fallas ? `\n✗ ${fallas} falla(s) en ${pasos + fallas} pasos` : `\n✓ ${pasos} pasos en verde`);
  process.exitCode = fallas ? 1 : 0;
};

/** Navegador con *.localhost resuelto a la compu (demo.localhost, box.localhost…). */
export async function navegador({ camara = false, video = null } = {}) {
  // camara: una cámara de mentira (Chrome dibuja un patrón) que da permiso sola, para probar las fotos.
  // video: lo que "filma" esa cámara (un .y4m; el .mjpeg Chrome no lo toma), por ejemplo un QR para el lector de la Entrada.
  const extra = camara || video ? ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"] : [];
  if (video) extra.push(`--use-file-for-fake-video-capture=${video}`);
  const nav = await chromium.launch({ args: ["--host-resolver-rules=MAP *.localhost 127.0.0.1", ...extra] });
  const cerrar = nav.close.bind(nav);
  nav.close = async (...a) => { await Promise.allSettled(pendientes); return cerrar(...a); };
  return nav;
}

/** Página nueva que junta errores de la página y respuestas 5xx. */
export async function pagina(b, viewport = COMPU, opciones = {}) {
  // opciones: más del contexto (por ejemplo el userAgent de un iPhone).
  // conAyuda: true deja que salgan los globos de ayuda (VD-31); solo e2e/vd-31.mjs lo pide.
  const { conAyuda = false, ...deContexto } = opciones;
  const ctx = await b.newContext({ viewport, deviceScaleFactor: 1, ...deContexto });
  // VD-31: sin esto, el globo de ayuda de la primera visita empujaría el contenido de cada pantalla.
  // La app lo respeta SOLO con PERMITIR_SIN_AYUDA=1 (lo pone scripts/local/levantar.sh; nunca en producción).
  if (!conAyuda) {
    await ctx.addCookies(["demo", "demo-box"].map((s) => GIMNASIO(s)).concat(PLATAFORMA)
      .map((url) => ({ name: "gymos_sin_ayuda", value: "1", url })));
  }
  const p = await ctx.newPage();
  p.errores = [];
  ultimaPagina = p;
  // Con la app compilada el HTML llega antes que React, y el contenido de la pantalla (que viene en
  // streaming) se hidrata después que el marco: un clic en ese momento se pierde. Después de cada
  // carga o cambio de dirección se espera a que React tome la página y a que la red se calme.
  const listo = async () => {
    await p.waitForFunction(() => document.documentElement.dataset.hidratado === "1" && !document.querySelector('[data-pagina-hidratada="0"]'),
      null, { timeout: 20000 }).catch(() => {});
    // Y a que se calmen las consultas que la propia pantalla dispara al abrir (las precargas de los links y la
    // renovación de la Entrada): una acción mandada en ese instante guardaba bien pero la pantalla no se refrescaba.
    await p.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
  };
  for (const metodo of ["goto", "reload", "waitForURL"]) {
    const original = p[metodo].bind(p);
    p[metodo] = async (...a) => {
      // Antes de irse de una pantalla se espera a que terminen sus pedidos (una acción del servidor a medio contestar al cortar la carga deja errores de React en la página vieja).
      if (metodo === "goto" && ultimaPagina === p) await p.waitForLoadState("networkidle", { timeout: 4000 }).catch(() => {});
      if (metodo === "goto") p.irse = Date.now();
      const r = await original(...a); await listo(); return r;
    };
  }
  p.on("framenavigated", (fr) => { if (fr === p.mainFrame()) p.irse = 0; });
  if (process.env.E2E_ERRORES) p.on("pageerror", (e) => console.log(`  [error de página tras el paso ${pasos}] ${p.url()} ${e.message.slice(0, 90)}`));
  p.on("pageerror", (e) => {
    // Al irse de una pantalla con goto, React de la página vieja puede quejarse mientras el navegador la cierra (#418 / parentNode de un DOM que ya no está): eso no es de la app.
    // Hidratación #418 (y el "parentNode" que le sigue): React la recupera solo (rehace la pantalla en el cliente), la pantalla anda,
    // y solo pasa en la app compilada. Está en la COLA (VD-TRI1). No hace fallar el recorrido, pero se cuenta y se muestra al final.
    if (/Minified React error #418|reading .parentNode./.test(e.message)) { avisosReact++; if (!/parentNode/.test(e.message)) rutasReact.add(p.url().replace(/^https?:[/][/][^/]+/, "").split("?")[0]); return; }
    p.errores.push(`error en la página (${p.url().replace(/^https?:[/][/][^/]+/, "")}): ${e.message.slice(0, 200)}`);
  });
  p.on("response", (r) => { if (r.status() >= 500) p.errores.push(`HTTP ${r.status()} ${r.url()}`); });
  p.on("dialog", (d) => d.accept());
  // E2E_CONSOLA=1: muestra los errores y advertencias de la consola del navegador (para investigar).
  if (process.env.E2E_CONSOLA) p.on("console", (m) => { if (["error", "warning"].includes(m.type())) console.log(`  [consola ${m.type()}] ${p.url()} ${m.text().slice(0, Number(process.env.E2E_CONSOLA) > 1 ? 4000 : 300)}`); });
  if (process.env.E2E_CONSOLA) {
    p.on("response", (r) => { if (r.status() >= 400) console.log(`  [http ${r.status()}] ${r.request().method()} ${r.url().slice(0, 140)}`); });
    p.on("requestfailed", (r) => console.log(`  [red fallo] ${r.method()} ${r.url().slice(0, 140)} ${r.failure()?.errorText}`));
  }
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
  // Desde BASE-2 lo primero es mail y contraseña: el código por celular está en la vía "Celular".
  if (!(await p.locator("input[name=telefono]").count())) await p.getByRole("button", { name: /Celular/ }).click();
  await p.fill("input[name=telefono]", telefono);
  await p.click('button:has-text("código")');
  await p.locator("input[name=codigo]").waitFor({ timeout: 30000 });
  const codigos = JSON.parse(readFileSync(join(process.cwd(), ".local", "codigos.json"), "utf8"));
  const c = codigos[telefono] ?? Object.values(codigos).pop();
  await p.fill("input[name=codigo]", String(c?.codigo ?? c));
  // Con 6 dígitos el formulario se manda solo (VD-33): si el botón ya no está, no hay nada que tocar.
  await p.waitForURL(/\/app/, { timeout: 5000 }).catch(async () => {
    if (await p.locator("button[type=submit]:not([disabled])").count()) await p.click("button[type=submit]:not([disabled])", { timeout: 5000 }).catch(() => {});
  });
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
  // VD-50: si la misma cuota se cobró hace poco, la base frena; los recorridos que cobran dos veces a propósito siguen con motivo.
  if (r && /ya cobró esta cuota/.test(r)) {
    await p.locator("[data-cobrar-doble-igual]").click();
    await p.locator("[data-cobrar-doble-motivo]").fill("Otro cobro, a propósito (prueba)");
    await p.locator('button:has-text("✅ Cobrar")').click();
    await p.getByText(/^Cobrado \$/).first().waitFor({ timeout: 30000 });
    return;
  }
  if (r) throw new Error(`al cobrar: ${r}`);
}

/**
 * Pedido HTTP con la sesión de un contexto del navegador. El navegador resuelve `demo.localhost` solo, pero el cliente de
 * pedidos de Playwright usa el DNS del sistema (en Windows no lo resuelve): se va a 127.0.0.1 con el Host y las cookies a mano.
 */
export async function api(ctx, metodo, ruta, opciones = {}, slug = "demo") {
  const cookie = (await ctx.cookies(GIMNASIO(slug))).map((c) => `${c.name}=${c.value}`).join("; ");
  return ctx.request.fetch(`http://127.0.0.1:${PUERTO}${ruta}`, {
    method: metodo, ...opciones, headers: { host: `${slug}.localhost:${PUERTO}`, cookie, ...(opciones.headers ?? {}) },
  });
}
