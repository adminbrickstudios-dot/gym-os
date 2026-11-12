#!/usr/bin/env node
// F8.3 · Prueba de humo de las puertas, en compu y en celular, con capturas.
// Entra por /super, /dueno, /recepcion, /profe y /socio (cada una con su usuario), mira que caiga en la pantalla de su rol y abre la página pública
// del gimnasio y su "hacete socio". Sin crear ni cambiar nada: solo mira. Corre contra producción o contra la app local.
//
//   BASE_URL=https://… GIMNASIO_SLUG=demo-mateo BRIK_ADMIN_MAIL=… BRIK_ADMIN_CLAVE=… CLAVE_PRUEBA=… node scripts/medir/humo-puertas.mjs
//
// Entradas (todas por variable de entorno; nada de claves en el repo ni en el registro de Actions):
//   BASE_URL            la plataforma (por defecto http://localhost:3123)
//   GIMNASIO_SLUG       el gimnasio a probar (por defecto demo-mateo)
//   BRIK_ADMIN_MAIL / BRIK_ADMIN_CLAVE   super admin. Sin ellos la puerta /super queda ⛔ sin probar.
//   CLAVE_PRUEBA        la contraseña de los usuarios de prueba (CLAVE_PRUEBA_MATEO). Sin ella quedan ⛔ las otras cuatro puertas.
//   MAIL_DUENO, MAIL_RECEPCION, MAIL_PROFE, MAIL_SOCIO   (por defecto prueba-duena@, prueba-recepcion@, prueba-profe@, prueba-socio@ejemplo.invalid)
//   CAPTURAS_DIR        dónde van las capturas (por defecto .local/humo)
// Salida: 0 si todo lo probado está en verde (aunque haya puertas ⛔ sin probar, que se listan); 1 si algo falló.
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";

const BASE = (process.env.BASE_URL ?? "http://localhost:3123").replace(/\/$/, "");
const SLUG = process.env.GIMNASIO_SLUG ?? "demo-mateo";
const CAPTURAS = process.env.CAPTURAS_DIR ?? join(process.cwd(), ".local", "humo");
const CLAVE = process.env.CLAVE_PRUEBA;
const MAIL = (rol, d) => process.env[`MAIL_${rol}`] ?? d;
const local = /^https?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(BASE);
mkdirSync(CAPTURAS, { recursive: true });

const PANTALLAS = { compu: { width: 1440, height: 900 }, celu: { width: 390, height: 844 } };
let pasos = 0, fallas = 0;
const sinProbar = [];
const ok = (m) => console.log(`✓ ${++pasos}. ${m}`);
const mal = (m) => { fallas++; console.log(`✗ ${m}`); };
const chequear = (c, bien, malo) => (c ? ok(bien) : mal(malo));

const PUERTAS = [
  { rol: "super", ruta: "/super", aterriza: /\/admin/, mail: process.env.BRIK_ADMIN_MAIL, clave: process.env.BRIK_ADMIN_CLAVE, falta: "BRIK_ADMIN_MAIL y BRIK_ADMIN_CLAVE", propia: false },
  { rol: "dueno", ruta: "/dueno", aterriza: /\/panel/, mail: MAIL("DUENO", "prueba-duena@ejemplo.invalid"), clave: CLAVE, falta: "CLAVE_PRUEBA", rolTexto: /Dueñ[oa]/ },
  { rol: "recepcion", ruta: "/recepcion", aterriza: /\/panel/, mail: MAIL("RECEPCION", "prueba-recepcion@ejemplo.invalid"), clave: CLAVE, falta: "CLAVE_PRUEBA", rolTexto: /Recepci/ },
  { rol: "profe", ruta: "/profe", aterriza: /\/panel/, mail: MAIL("PROFE", "prueba-profe@ejemplo.invalid"), clave: CLAVE, falta: "CLAVE_PRUEBA", rolTexto: /Profe/ },
  { rol: "socio", ruta: "/socio", aterriza: /\/app/, mail: MAIL("SOCIO", "prueba-socio@ejemplo.invalid"), clave: CLAVE, falta: "CLAVE_PRUEBA" },
];

const b = await chromium.launch({ args: local ? ["--host-resolver-rules=MAP *.localhost 127.0.0.1"] : [] });
const abrir = async (pantalla) => {
  const movil = pantalla === "celu";
  const ctx = await b.newContext({ viewport: PANTALLAS[pantalla], isMobile: movil, hasTouch: movil, deviceScaleFactor: movil ? 2 : 1 });
  // Para la prueba el globo de ayuda de la primera visita no cuenta (solo lo respeta la app local con PERMITIR_SIN_AYUDA).
  await ctx.addCookies([{ name: "gymos_sin_ayuda", value: "1", url: BASE }]);
  const p = await ctx.newPage();
  p.setDefaultNavigationTimeout(90000); p.setDefaultTimeout(60000);
  p.errores = [];
  p.on("pageerror", (e) => { if (!/Minified React error #418|reading .parentNode./.test(e.message)) p.errores.push(`error en la página (${new URL(p.url()).pathname}): ${e.message.slice(0, 160)}`); });
  p.on("response", (r) => { if (r.status() >= 500) p.errores.push(`HTTP ${r.status()} ${new URL(r.url()).pathname}`); });
  return p;
};
const sinDesborde = async (p) => (await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
const foto = async (p, nombre) => { await p.screenshot({ path: join(CAPTURAS, `${nombre}.png`), fullPage: false }).catch(() => {}); };
// La app del socio no tiene h1: saluda con "Hola, …" (data-hola). La bienvenida de la primera vez se saltea para ver la pantalla de verdad.
const esperarPantalla = async (p) => {
  await p.locator("h1, [data-hola]").first().waitFor({ timeout: 60000 });
  const bien = p.locator("[data-bienvenida]");
  if (await bien.count()) { await bien.locator("[data-bienvenida-saltear], [data-bienvenida-listo]").first().click().catch(() => {}); await bien.waitFor({ state: "detached", timeout: 15000 }).catch(() => {}); }
  await p.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
};

for (const pantalla of Object.keys(PANTALLAS)) {
  // Las puertas: cada una pide el ingreso, entra con su usuario y cae donde corresponde.
  for (const puerta of PUERTAS) {
    const etiqueta = `${puerta.rol} · ${pantalla}`;
    if (!puerta.mail || !puerta.clave) { if (pantalla === "compu") sinProbar.push(`${puerta.rol} (falta ${puerta.falta})`); continue; }
    const p = await abrir(pantalla);
    try {
      await p.goto(puerta.propia === false ? `${BASE}${puerta.ruta}` : `${BASE}/g/${SLUG}${puerta.ruta}`, { waitUntil: "domcontentloaded" });
      await p.locator("input[type=email]").waitFor({ timeout: 60000 });
      await foto(p, `${puerta.rol}-1-ingreso-${pantalla}`);
      chequear(await sinDesborde(p), `${etiqueta}: el ingreso entra en la pantalla`, `${etiqueta}: el ingreso se desborda hacia el costado`);
      await p.fill("input[type=email]", puerta.mail);
      await p.fill("input[type=password]", puerta.clave);
      await p.click("button[type=submit]");
      await p.waitForURL((u) => puerta.aterriza.test(u.pathname), { timeout: 90000 });
      await esperarPantalla(p);
      const titulo = (await p.locator("h1, [data-hola]").first().innerText()).replace(/\s+/g, " ").slice(0, 80);
      ok(`${etiqueta}: entra y cae en ${new URL(p.url()).pathname} (“${titulo}”)`);
      await foto(p, `${puerta.rol}-2-pantalla-${pantalla}`);
      chequear(await sinDesborde(p), `${etiqueta}: la pantalla entra en el ancho`, `${etiqueta}: la pantalla se desborda hacia el costado`);
      if (puerta.rolTexto) {
        await p.goto(`${new URL(p.url()).origin}${p.url().includes(`/g/${SLUG}`) ? `/g/${SLUG}` : ""}/panel/cuenta`, { waitUntil: "domcontentloaded" });
        await esperarPantalla(p);
        chequear(puerta.rolTexto.test(await p.locator("main").innerText()), `${etiqueta}: con el rol de ${puerta.rol}`, `${etiqueta}: la cuenta no dice que es ${puerta.rol}`);
      }
      if (p.errores.length) mal(`${etiqueta}: ${[...new Set(p.errores)].slice(0, 3).join(" | ")}`);
    } catch (e) { mal(`${etiqueta}: se cortó: ${String(e.message).split("\n")[0]}`); await foto(p, `${puerta.rol}-falla-${pantalla}`); }
    await p.context().close();
  }

  // La página pública del gimnasio y su "hacete socio" (sin sesión).
  for (const [nombre, ruta] of [["pagina", `/g/${SLUG}`], ["hacete-socio", `/g/${SLUG}/hacete-socio`]]) {
    const etiqueta = `${nombre} del gimnasio · ${pantalla}`;
    const p = await abrir(pantalla);
    try {
      const r = await p.goto(`${BASE}${ruta}`, { waitUntil: "domcontentloaded" });
      chequear((r?.status() ?? 0) < 400, `${etiqueta}: abre (${r?.status()})`, `${etiqueta}: responde ${r?.status()}`);
      await esperarPantalla(p);
      const titulo = (await p.locator("h1").first().innerText()).replace(/\s+/g, " ").slice(0, 80);
      ok(`${etiqueta}: se ve “${titulo}”`);
      await foto(p, `${nombre}-${pantalla}`);
      chequear(await sinDesborde(p), `${etiqueta}: entra en el ancho`, `${etiqueta}: se desborda hacia el costado`);
      if (p.errores.length) mal(`${etiqueta}: ${[...new Set(p.errores)].slice(0, 3).join(" | ")}`);
    } catch (e) { mal(`${etiqueta}: se cortó: ${String(e.message).split("\n")[0]}`); await foto(p, `${nombre}-falla-${pantalla}`); }
    await p.context().close();
  }
}
await b.close();
if (sinProbar.length) console.log(`\n⛔ Sin probar (faltan secretos): ${sinProbar.join("; ")}`);
console.log(fallas ? `\n✗ ${fallas} falla(s) en ${pasos + fallas} pasos` : `\n✓ ${pasos} pasos en verde${sinProbar.length ? ", con puertas ⛔ sin probar" : ""}`);
process.exit(fallas ? 1 : 0);
