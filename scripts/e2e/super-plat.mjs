#!/usr/bin/env node
// PLAT-04, 05 y 06 en el super admin, con sesión real del admin demo:
//  · "Estado de la plataforma" tiene la lista de variables por entorno (sin faltantes, Supabase al que apunta, claves del mismo proyecto)
//    y no muestra ninguna clave.
//  · "Dominios (Vercel)" está presente y, sin VERCEL_TOKEN / VERCEL_PROJECT_ID, queda bloqueado y dice qué cargar.
//  · Los links de la ficha (links por rol, QR, ver su página) salen del helper de direcciones: de la dirección del gimnasio, nunca a mano.
//   node scripts/e2e/super-plat.mjs        (con scripts/local/levantar.sh corriendo)
import { execSync } from "node:child_process";
import pg from "pg";
import { CELU, COMPU, PLATAFORMA as B, aparece, capturar, chequear, entrar, falla, navegador, ok, pagina, resultado } from "./comun.mjs";

const url = process.env.DB_PRUEBAS_URL || execSync("scripts/db/local.sh url").toString().trim();
const db = new pg.Client({ connectionString: url });
await db.connect();

const b = await navegador();
const p = await pagina(b);
p.setDefaultTimeout(30000);
async function ver(nombre) {
  await p.setViewportSize(CELU);
  await p.waitForFunction((w) => window.innerWidth === w, CELU.width);
  await capturar(p, `plat-${nombre}-celu`, true);
  const ancho = await p.evaluate(() => document.documentElement.scrollWidth);
  chequear(ancho <= CELU.width + 4, `celular: ${nombre} sin desborde (${ancho}px)`, `celular: ${nombre} mide ${ancho}px`);
  await p.setViewportSize(COMPU);
  await capturar(p, `plat-${nombre}-compu`, true);
}

try {
  await entrar(p, "admin@ejemplo.invalid", undefined, B);
  await p.goto(`${B}/admin`);
  await p.waitForLoadState("networkidle", { timeout: 20000 }).catch(() => {});

  // ── PLAT-06: Estado de la plataforma ──
  const estado = await p.locator("details").evaluateAll((l) => l.map((e) => e.textContent ?? "").join(" | "));
  chequear(/Variables de [a-z]+: no falta ninguna|Faltan \d+ variables en/.test(estado), "Estado: dice si falta alguna variable por entorno (y cuáles)", `el estado no habla de las variables: ${estado.replace(/\s+/g, " ").slice(0, 300)}`);
  chequear(/apunta al Supabase/.test(estado), "Estado: dice a qué Supabase apunta el entorno", "el estado no dice a qué Supabase apunta");
  chequear(/SUPABASE_(ANON_KEY|SERVICE_ROLE_KEY): del mismo proyecto que la URL|clave nueva|no se puede comparar|es del proyecto|es una clave/.test(estado) || /Faltan \d+ variables/.test(estado),
    "Estado: compara las claves con el proyecto de la URL", "el estado no compara las claves con el proyecto");
  chequear(/Clave de servicio funcionando/.test(estado), "Estado: la clave de servicio se probó de verdad", "el estado no probó la clave de servicio");
  const textoPagina = await p.locator("body").evaluate((e) => e.textContent ?? "");
  chequear(!/eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\./.test(textoPagina) && !/sb_(secret|publishable)_/.test(textoPagina), "la pantalla no muestra ninguna clave", "¡la pantalla muestra una clave!");
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) chequear(!textoPagina.includes(process.env.SUPABASE_SERVICE_ROLE_KEY), "ni la clave de servicio de este entorno", "la pantalla muestra la clave de servicio");

  // ── PLAT-05: Dominios (Vercel) ──
  const dom = p.locator("[data-dominios-vercel]");
  chequear(await aparece(dom), "“Dominios (Vercel)” está en el super admin", "falta la sección Dominios (Vercel)");
  if ((await dom.getAttribute("data-lista")) === "no") {
    const bloqueo = await dom.locator("[data-dominios-bloqueado]").innerText();
    chequear(/VERCEL_TOKEN/.test(bloqueo) && /VERCEL_PROJECT_ID/.test(bloqueo) && /PROGRESO/.test(bloqueo), "sin token queda ⛔ y dice qué cargar y dónde están los pasos", `el bloqueo dice: ${bloqueo.slice(0, 200)}`);
    chequear(await dom.locator("input").isDisabled() && await dom.getByRole("button", { name: "Agregar a Vercel" }).isDisabled(), "y no deja agregar nada (campo y botón apagados)", "se puede agregar un dominio sin token");
  } else {
    ok("hay token cargado en este entorno: la sección está habilitada");
  }
  await ver("estado");

  // ── PLAT-04: los links salen del helper ──
  const gim = (await db.query(`select g.id, g.slug from public.gimnasios g where g.slug = 'demo'`)).rows[0];
  await p.goto(`${B}/admin/${gim.id}`);
  await p.waitForLoadState("networkidle", { timeout: 20000 }).catch(() => {});
  const verPagina = p.locator('a:has-text("Ver su página")').first();
  chequear((await verPagina.getAttribute("href")) === `/g/${gim.slug}`, "“Ver su página” va a /g/<slug> de la plataforma", "“Ver su página” no va a /g/<slug>");
  const links = await p.locator("[data-links-por-rol]").innerText();
  const host = (await db.query(`select host from public.dominios_gimnasio where gimnasio_id = $1 order by tipo desc, host limit 1`, [gim.id])).rows[0]?.host;
  chequear(!host || (links.includes(`${host.replace(/:\d+$/, "")}/dueno`) && /https?:\/\//.test(links)), "los links por rol salen de la dirección del gimnasio", `los links por rol no usan el host del gimnasio: ${links.replace(/\s+/g, " ").slice(0, 200)}`);
  await ver("ficha");

  // ── SA-3: "Abrir como soporte en esta pantalla" entra directo a esa sección ──
  const directo = p.locator("[data-ficha-soporte-directo]");
  chequear((await directo.locator("[data-entrar-soporte]").count()) === 5, "la ficha ofrece abrir como soporte Socios, Planes, Clases, Caja y Página", "faltan botones de “abrir como soporte en esta pantalla”");
  await directo.getByRole("button", { name: "Abrir Planes" }).click();
  await directo.locator("[data-motivo-soporte] input[name=motivo]").fill("e2e: revisar los planes");
  await directo.locator("[data-motivo-soporte] button:not([type=button])").click();
  await p.waitForURL(/\/panel\/planes/, { timeout: 60000 });
  ok("entra como soporte directo a /panel/planes");
  await aparece(p.locator("[data-soporte-banner]"));
  await p.locator("[data-soporte-banner] button:has-text('Salir')").click();
  await p.waitForURL(/\/admin/, { timeout: 60000 });

  if (p.errores.length) falla(`errores en la página: ${p.errores.join(" | ")}`);
} catch (e) {
  falla(`se cortó: ${e.message.split("\n")[0]}`);
  await capturar(p, "ROTA-super-plat", true).catch(() => {});
} finally {
  await db.end().catch(() => {});
}
await b.close();
resultado();
