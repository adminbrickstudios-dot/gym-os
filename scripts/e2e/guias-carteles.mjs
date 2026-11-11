#!/usr/bin/env node
// C3 + C4 · Las guías de uso por rol y los carteles A4.
//   1. Ayuda tiene el acceso a las guías; la lista muestra las que tu rol puede abrir (dueño: 4 + carteles; recepción: la suya y la del
//      socio; profe: la suya) y lo que no es de tu rol da el error de la base, no una pantalla vacía.
//   2. Cada guía: hasta 10 pasos, sin emojis, sin imágenes rotas (si falta la captura se esconde), sin desborde en celular, y en
//      papel (emulación de impresión) queda solo la hoja, sin botones, y el PDF A4 se genera.
//   3. Una sección apagada saca sus pasos de la guía (Caja apagada: no están los pasos de abrir y cerrar la caja).
//   4. Cartel de la puerta: lleva el nombre y el color del gimnasio, dice solo lo que el gimnasio tiene prendido y sale en UNA hoja A4.
//   5. Cartel "Descargá la app": el QR es la dirección que arma lib/urls.ts (no una escrita a mano), con su dirección visible debajo.
//   6. La guía del socio abre en la app, en celular, sin links al panel.
//   node scripts/e2e/guias-carteles.mjs     (con scripts/local/levantar.sh corriendo)
// ESCRITO, NO EJECUTADO por quien lo escribió.
import { execSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import pg from "pg";
import { CAPTURAS, CELU, COMPU, GIMNASIO, PANTALLA_ROTA, chequear, entrar, falla, navegador, pagina, resultado } from "./comun.mjs";
process.on("unhandledRejection", (e) => { console.log(`✗ se cortó (sin atrapar): ${String(e?.message ?? e).split("\n").slice(0, 3).join(" | ")}`); process.exit(1); });

const BASE = GIMNASIO("demo");
const EMOJI = /\p{Extended_Pictographic}/u;
const url = process.env.DB_PRUEBAS_URL || execSync("scripts/db/local.sh url").toString().trim();
const db = new pg.Client({ connectionString: url });
await db.connect();
const PDFS = join(CAPTURAS, "guias");
mkdirSync(PDFS, { recursive: true });
const [{ id: gim, nombre: NOMBRE, slug: SLUG }] = (await db.query(`select id, nombre, slug from public.gimnasios where slug = 'demo'`)).rows;
const [{ apagadas: APAGADAS_ANTES }] = (await db.query(`select secciones_apagadas as apagadas from public.configuracion_gimnasio where gimnasio_id = $1`, [gim])).rows;
const [{ accesos: ACCESOS_ANTES }] = (await db.query(`select accesos_activos as accesos from public.configuracion_gimnasio where gimnasio_id = $1`, [gim])).rows;

/** Páginas de A4 de un PDF (cuenta los objetos /Type /Page, no /Pages). */
const paginasDe = (buf) => (buf.toString("latin1").match(/\/Type\s*\/Page[^s]/g) ?? []).length;
const sinDesborde = (p) => p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
const rgb = (hex) => { const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim()); if (!m) return null; const n = parseInt(m[1], 16); return `rgb(${n >> 16}, ${(n >> 8) & 255}, ${n & 255})`; };

/** Una pantalla que la base niega: no hay título, se espera a que termine de cargar y diga algo. */
async function abrirDenegada(p, ruta) {
  await p.goto(`${BASE}${ruta}`);
  await p.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => {});
  await p.locator("body").filter({ hasText: /S/ }).waitFor({ timeout: 30000 });
}

/** Abre una pantalla y espera a que cargue; false si dice que no hay acceso o se rompió. */
async function abrir(p, ruta) {
  await p.goto(`${BASE}${ruta}`);
  await p.locator("h1").first().waitFor({ timeout: 60000 });
  return !PANTALLA_ROTA.test(await p.locator("body").innerText());
}

const b = await navegador();
try {
  // ── 1 y 2 · El dueño ve todas las guías y los carteles ──
  const d = await pagina(b, COMPU);
  d.setDefaultNavigationTimeout(120000);
  await entrar(d, "duena@ejemplo.invalid", undefined, BASE);
  await abrir(d, "/panel/ayuda");
  await d.locator("[data-ayuda-guias]").waitFor({ timeout: 30000 });
  chequear(true, "Ayuda tiene el acceso a las guías de uso", "");
  await d.locator("[data-ayuda-guias]").click();
  await d.waitForURL(/\/panel\/ayuda\/guias$/);
  const roles = await d.locator("[data-guia-link]").evaluateAll((l) => l.map((x) => x.getAttribute("data-guia-link")));
  chequear(["recepcion", "dueno", "profe", "socio", "carteles"].every((r) => roles.includes(r)), "el dueño ve las 4 guías y los carteles", `el dueño ve: ${roles.join(", ")}`);

  for (const rol of ["recepcion", "dueno", "profe", "socio"]) {
    await abrir(d, `/panel/ayuda/guias/${rol}`);
    await d.locator("[data-guia]").waitFor();
    const pasos = await d.locator("[data-paso]").count();
    chequear(pasos >= 1 && pasos <= 10, `guía ${rol}: ${pasos} pasos (máximo 10)`, `guía ${rol}: ${pasos} pasos`);
    chequear(!EMOJI.test(await d.locator("[data-guia]").innerText()), `guía ${rol}: sin emojis`, `guía ${rol}: tiene un emoji`);
    // Las capturas que no están (todavía) no dejan una imagen rota ni un hueco.
    await d.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
    const rotas = await d.locator("img[data-captura]").evaluateAll((l) => l.filter((i) => i.complete && i.naturalWidth === 0).length);
    chequear(rotas === 0, `guía ${rol}: ninguna imagen rota a la vista`, `guía ${rol}: ${rotas} imagen(es) rota(s)`);
    chequear(await d.getByRole("button", { name: /Imprimir \/ guardar PDF/ }).isVisible(), `guía ${rol}: tiene “Imprimir / guardar PDF”`, `guía ${rol}: falta el botón de imprimir`);
    // En papel: solo la hoja, sin botones ni menú; y el PDF A4 se genera.
    await d.emulateMedia({ media: "print" });
    const hoja = await d.locator(".guia-hoja").isVisible();
    const botones = await d.locator("[data-imprimir]").isVisible().catch(() => false);
    chequear(hoja && !botones, `guía ${rol}: en papel queda la hoja y no el botón`, `guía ${rol}: en papel hoja=${hoja} botón=${botones}`);
    const pdf = await d.pdf({ format: "A4", printBackground: true, preferCSSPageSize: true });
    writeFileSync(join(PDFS, `e2e-guia-${rol}.pdf`), pdf);
    chequear(pdf.subarray(0, 4).toString() === "%PDF" && paginasDe(pdf) >= 1, `guía ${rol}: PDF A4 generado (${paginasDe(pdf)} páginas)`, `guía ${rol}: el PDF no salió bien`);
    await d.emulateMedia({ media: "screen" });
  }

  // ── Celular: la guía se lee sin desborde y con el botón a la vista ──
  await d.setViewportSize(CELU);
  for (const rol of ["recepcion", "dueno"]) {
    await abrir(d, `/panel/ayuda/guias/${rol}`);
    chequear(await sinDesborde(d), `celular: la guía ${rol} no desborda`, `celular: la guía ${rol} se corre de costado`);
  }
  await d.setViewportSize(COMPU);

  // ── 3 · Una sección apagada saca sus pasos ──
  try {
    await db.query(`update public.configuracion_gimnasio set secciones_apagadas = array(select distinct unnest(secciones_apagadas || array['caja'])) where gimnasio_id = $1`, [gim]);
    await abrir(d, "/panel/ayuda/guias/recepcion");
    const ids = await d.locator("[data-paso]").evaluateAll((l) => l.map((x) => x.getAttribute("data-paso")));
    chequear(!ids.includes("caja-abrir") && !ids.includes("caja-cerrar") && ids.includes("entrada"),
      "con Caja apagada, la guía de recepción no tiene los pasos de la caja y sigue con los demás", `con Caja apagada los pasos son: ${ids.join(", ")}`);
  } finally {
    await db.query(`update public.configuracion_gimnasio set secciones_apagadas = $2 where gimnasio_id = $1`, [gim, APAGADAS_ANTES]);
  }

  // ── 4 · Cartel de la puerta ──
  await abrir(d, "/panel/ayuda/carteles");
  chequear(await d.locator("[data-cartel-link=puerta]").isVisible() && await d.locator("[data-cartel-link=app]").isVisible(), "Carteles lista la puerta y Descargá la app", "Carteles no lista los dos carteles");
  const casos = [
    { accesos: ["recepcion", "qr_socio", "kiosco", "qr_pared"], titulo: /QR de la tablet/, aviso: /30 segundos/ },
    { accesos: ["recepcion", "qr_socio"], titulo: /QR de tu app/, aviso: null },
    { accesos: ["recepcion"], titulo: /decí tu DNI/, aviso: /Configuración/ },
  ];
  try {
    for (const c of casos) {
      await db.query(`update public.configuracion_gimnasio set accesos_activos = $2 where gimnasio_id = $1`, [gim, c.accesos]);
      await abrir(d, "/panel/ayuda/carteles/puerta");
      const cartel = d.locator("[data-cartel]");
      await cartel.waitFor();
      const texto = await cartel.innerText();
      chequear(c.titulo.test(texto) && texto.includes(NOMBRE), `cartel de la puerta (${c.accesos.join("+")}): dice lo que corresponde y lleva el nombre del gimnasio`, `cartel de la puerta (${c.accesos.join("+")}): dice “${texto.replace(/\s+/g, " ").slice(0, 200)}”`);
      chequear(!EMOJI.test(texto), "el cartel no lleva emojis", "el cartel lleva un emoji");
      const aviso = await d.locator("[data-cartel-aviso]").count();
      chequear(c.aviso ? aviso === 1 && c.aviso.test(await d.locator("[data-cartel-aviso]").innerText()) : aviso === 0, "el aviso para quien imprime aparece solo cuando hace falta", "el aviso para quien imprime no es el esperado");
      chequear(!/QR de la tablet/.test(texto) || c.accesos.includes("kiosco"), "no promete el QR de la tablet si la tablet está apagada", "promete el QR de la tablet sin tablet");
    }
  } finally {
    await db.query(`update public.configuracion_gimnasio set accesos_activos = $2 where gimnasio_id = $1`, [gim, ACCESOS_ANTES]);
  }
  // El color del gimnasio en la franja, y una sola hoja A4.
  await abrir(d, "/panel/ayuda/carteles/puerta");
  const franja = await d.locator(".cartel-franja").evaluate((e) => getComputedStyle(e).backgroundColor);
  const acento = await d.locator("main").first().evaluate((e) => getComputedStyle(e).getPropertyValue("--acento"));
  chequear(!rgb(acento) || franja === rgb(acento), "la franja del cartel lleva el color del gimnasio", `la franja es ${franja} y el color del gimnasio ${acento}`);
  await d.emulateMedia({ media: "print" });
  chequear(await d.locator("[data-cartel]").isVisible() && !(await d.locator("[data-imprimir]").isVisible().catch(() => false)), "en papel queda solo el cartel", "en papel se ven los botones o falta el cartel");
  let pdf = await d.pdf({ format: "A4", printBackground: true, preferCSSPageSize: true });
  writeFileSync(join(PDFS, "e2e-cartel-puerta.pdf"), pdf);
  chequear(paginasDe(pdf) === 1, "el cartel de la puerta sale en UNA hoja A4", `el cartel de la puerta ocupa ${paginasDe(pdf)} hojas`);
  await d.emulateMedia({ media: "screen" });

  // ── 5 · Cartel Descargá la app ──
  await abrir(d, "/panel/ayuda/carteles/app");
  const qr = d.locator("[data-qr-app]");
  if (await qr.count()) {
    const dir = await qr.getAttribute("data-qr-app");
    chequear(/^https?:\/\//.test(dir) && dir.includes(SLUG), `el QR lleva a la página del gimnasio (${dir})`, `el QR lleva a ${dir}`);
    chequear((await qr.locator("svg").count()) === 1 && (await d.locator("[data-cartel]").innerText()).includes(dir), "el QR es un SVG y la dirección está escrita debajo", "falta el SVG del QR o la dirección visible");
    chequear((await d.locator("[data-cartel]").innerText()).includes(`Descargá la app de ${NOMBRE}`), "el cartel dice “Descargá la app” con el nombre del gimnasio", "el título del cartel no es el esperado");
    await d.emulateMedia({ media: "print" });
    pdf = await d.pdf({ format: "A4", printBackground: true, preferCSSPageSize: true });
    writeFileSync(join(PDFS, "e2e-cartel-app.pdf"), pdf);
    chequear(paginasDe(pdf) === 1, "el cartel de la app sale en UNA hoja A4", `el cartel de la app ocupa ${paginasDe(pdf)} hojas`);
    await d.emulateMedia({ media: "screen" });
    await d.setViewportSize(CELU);
    await abrir(d, "/panel/ayuda/carteles/app");
    chequear(await sinDesborde(d), "celular: el cartel de la app no desborda", "celular: el cartel de la app se corre de costado");
    await d.setViewportSize(COMPU);
  } else {
    chequear(await d.locator("[data-cartel-sin-direccion]").isVisible(), "sin dirección completa se avisa en vez de imprimir un QR roto", "sin QR y sin aviso");
  }

  // ── Los otros roles ven lo suyo, y lo demás da el error de la base ──
  const r = await pagina(b, COMPU);
  r.setDefaultNavigationTimeout(120000);
  await entrar(r, "recepcion@ejemplo.invalid", undefined, BASE);
  await abrir(r, "/panel/ayuda/guias");
  const mias = await r.locator("[data-guia-link]").evaluateAll((l) => l.map((x) => x.getAttribute("data-guia-link")));
  chequear(mias.join() === "recepcion,socio", `recepción ve su guía y la del socio (${mias.join(", ")})`, `recepción ve: ${mias.join(", ")}`);
  await abrirDenegada(r, "/panel/ayuda/guias/dueno");
  chequear(/no tiene acceso|No tenés acceso/i.test(await r.locator("main").innerText()), "recepción no abre la guía del dueño: dice que no tiene acceso", "recepción abrió la guía del dueño o ve una pantalla vacía");
  await abrirDenegada(r, "/panel/ayuda/carteles");
  chequear(/no tiene acceso|No tenés acceso/i.test(await r.locator("main").innerText()), "recepción no abre los carteles: dice que no tiene acceso", "recepción abrió los carteles");
  await r.context().close();

  const pr = await pagina(b, COMPU);
  pr.setDefaultNavigationTimeout(120000);
  await entrar(pr, "profe@ejemplo.invalid", undefined, BASE);
  await abrir(pr, "/panel/ayuda/guias");
  const delProfe = await pr.locator("[data-guia-link]").evaluateAll((l) => l.map((x) => x.getAttribute("data-guia-link")));
  chequear(delProfe.join() === "profe", `el profe ve solo la suya (${delProfe.join(", ")})`, `el profe ve: ${delProfe.join(", ")}`);
  await pr.context().close();

  // ── 6 · La guía del socio, en la app y en celular ──
  const s = await pagina(b, CELU);
  s.setDefaultNavigationTimeout(120000);
  await entrar(s, "socio@ejemplo.invalid", undefined, BASE);
  await abrir(s, "/app/ayuda");
  await s.locator("[data-ayuda-guia]").click();
  await s.waitForURL(/\/app\/ayuda\/guia/);
  await s.locator("[data-guia=socio]").waitFor({ timeout: 60000 });
  const pasosSocio = await s.locator("[data-paso]").count();
  chequear(pasosSocio >= 1 && pasosSocio <= 10, `guía del socio en la app: ${pasosSocio} pasos`, `guía del socio: ${pasosSocio} pasos`);
  chequear(await sinDesborde(s), "celular: la guía del socio no desborda", "celular: la guía del socio se corre de costado");
  chequear((await s.locator("[data-guia=socio] a[href^='/panel']").count()) === 0, "la guía del socio no lleva links al panel", "la guía del socio lleva links al panel");
  await s.context().close();
} catch (e) {
  falla(`se cortó: ${String(e?.message ?? e).split("\n").slice(0, 3).join(" | ")}`);
} finally {
  // Deja la configuración del gimnasio demo como estaba.
  await db.query(`update public.configuracion_gimnasio set secciones_apagadas = $2, accesos_activos = $3 where gimnasio_id = $1`, [gim, APAGADAS_ANTES, ACCESOS_ANTES]).catch(() => {});
  await db.end().catch(() => {});
  await b.close();
}
resultado();
