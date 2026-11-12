#!/usr/bin/env node
// H3b · Lo que le faltaba al camino del socio (docs/base/SOCIO-FLUJO.md, LISTO SI 4 y 6), en el celular (390 px), en el demo:
//   1. "Solo DNI" (Configuración → Cómo entra la gente, sin QR del socio ni tablet con QR): la app muestra "Tu DNI para entrar" y NO el QR.
//   2. "Solo QR" (el QR del socio prendido): la app muestra el QR y NO el DNI.
//   3. La sesión recordada: se guarda el estado del navegador, se cierra, se abre otro sin las cookies de sesión (como cerrar el
//      navegador) y el socio sigue adentro: la landing lo saluda, /app lo deja pasar y /ingresar no le pide la contraseña.
//   node scripts/e2e/socio-flujo-2.mjs      (con scripts/local/levantar.sh corriendo)
import { execSync } from "node:child_process";
import pg from "pg";
import { CELU, COMPU, GIMNASIO, aparece, chequear, entrar, falla, navegador, ok, pagina, resultado } from "./comun.mjs";

const G = GIMNASIO();
const b = await navegador();
const db = new pg.Client({ connectionString: process.env.DB_PRUEBAS_URL || execSync("scripts/db/local.sh url").toString().trim() });
await db.connect();
const DNI = `39${Date.now().toString().slice(-6)}`;
const DNI_PUNTOS = `${DNI.slice(0, 2)}.${DNI.slice(2, 5)}.${DNI.slice(5)}`;
const SOCIO = `update public.socios s set dni = $1 from public.gimnasios g where g.id = s.gimnasio_id and g.slug = 'demo' and s.nombre = 'Testigo' and s.apellido = 'Al Día'`;
let originales = null;

async function reglas(d) {
  await d.goto(`${G}/panel/configuracion?pestana=reglas`);
  await d.locator('fieldset[data-pestana-activa="reglas"]').waitFor({ timeout: 60000 }); await d.waitForTimeout(800);
}
async function guardar(d) {
  const pie = d.locator('[data-pie="reglas"]'); const k = Number(await pie.getAttribute("data-respuestas"));
  await pie.locator('button:has-text("Guardar")').click();
  await d.waitForFunction((k) => Number(document.querySelector('[data-pie="reglas"]')?.getAttribute("data-respuestas")) > k, k, { timeout: 30000 });
}
/** Deja los interruptores como se piden (true/false) y guarda si cambió algo. Devuelve cómo estaban. */
async function poner(d, deseado) {
  await reglas(d);
  const antes = {};
  let cambio = false;
  for (const [texto, quiero] of Object.entries(deseado)) {
    const sw = d.locator("[data-accesos] label", { hasText: texto }).first().locator("input");
    antes[texto] = await sw.isChecked();
    if (antes[texto] !== quiero) { await sw.click(); cambio = true; }
  }
  if (cambio) await guardar(d);
  return antes;
}
const TABLET = "Tablet en la puerta", QR = "QR del socio";

try {
  await db.query(SOCIO, [DNI]);
  const d = await pagina(b, COMPU);
  d.setDefaultNavigationTimeout(120000);
  await entrar(d, "duena@ejemplo.invalid");

  // ── 1. Solo DNI ──
  originales = await poner(d, { [QR]: false, [TABLET]: false });
  const s = await pagina(b, CELU);
  s.setDefaultNavigationTimeout(120000);
  await entrar(s, "socio@ejemplo.invalid");
  await s.goto(`${G}/app`);
  await s.locator("[data-botones-inicio]").waitFor({ timeout: 60000 });
  chequear(await s.locator("[data-mi-qr]").count() === 0, "solo DNI: la app del socio no muestra el QR", "con el QR apagado la app muestra el QR");
  const dni = s.locator("[data-tu-dni-inicio]");
  chequear(await aparece(dni, 5000) && /Tu DNI para entrar/.test(await dni.innerText()) && (await dni.innerText()).includes(DNI_PUNTOS),
    `solo DNI: la app dice “Tu DNI para entrar” con el DNI (${DNI_PUNTOS})`, `no muestra el DNI: ${await dni.count() ? await dni.innerText() : "(no está)"}`);
  chequear(await s.locator("[data-escanear-entrada]").count() === 0, "solo DNI: tampoco ofrece escanear el QR de la tablet", "ofrece escanear el QR con la tablet apagada");

  // ── 2. Solo QR ──
  await poner(d, { [QR]: true, [TABLET]: false });
  await s.goto(`${G}/app`);
  await s.locator("[data-botones-inicio]").waitFor({ timeout: 60000 });
  chequear(await aparece(s.locator("[data-mi-qr]"), 30000), "solo QR: la app del socio muestra su QR", "con el QR prendido la app no muestra el QR");
  chequear(await s.locator("[data-tu-dni-inicio]").count() === 0, "solo QR: no muestra “Tu DNI para entrar” (el QR es la llave)", "con el QR prendido la app igual muestra el DNI");

  // ── 3. La sesión recordada, como si se cerrara el navegador ──
  const ctx = s.context();
  const ahora = Date.now() / 1000;
  const cookies = await ctx.cookies(G);
  const de_sesion = cookies.filter((c) => /auth-token|sb-/.test(c.name));
  chequear(de_sesion.length > 0, `hay cookies de sesión del socio (${de_sesion.map((c) => c.name).join(", ")})`, `no encontré las cookies de sesión: ${cookies.map((c) => c.name).join(", ")}`);
  chequear(de_sesion.every((c) => c.expires > ahora + 86400), "las cookies de sesión duran días (no se pierden al cerrar el navegador)", `alguna cookie de sesión vence pronto o es de sesión: ${de_sesion.map((c) => `${c.name}=${Math.round(c.expires - ahora)}s`).join(" ")}`);
  const guardado = await ctx.storageState();
  await ctx.close();
  // Un navegador que se cierra se olvida de las cookies "de sesión" (expires = -1): el nuevo arranca solo con las que duran.
  const persistente = { ...guardado, cookies: guardado.cookies.filter((c) => c.expires > ahora) };
  const m = await pagina(b, CELU, { storageState: persistente });
  m.setDefaultNavigationTimeout(120000);
  await m.goto(G);
  chequear(await aparece(m.locator("[data-saludo-sesion]"), 60000), "al reabrir el navegador, la landing lo saluda", "la landing no lo saluda con la sesión guardada");
  chequear(await m.locator("[data-ir-a-mi-perfil]").count() > 0 && await m.locator("[data-ya-soy-socio]").count() === 0, "ofrece “Ir a mi perfil” y no le pide entrar de nuevo", "la landing le sigue pidiendo entrar");
  await m.goto(`${G}/app`);
  chequear(await aparece(m.locator("[data-botones-inicio]"), 60000) && await m.locator("input[type=password]").count() === 0, "/app lo deja pasar sin pedirle la contraseña", `/app terminó en ${m.url()}`);
  await m.goto(`${G}/ingresar?modo=socio`);
  await m.waitForURL(/\/app/, { timeout: 60000 });
  ok("/ingresar?modo=socio lo manda a su app (no muestra el login)");
  await m.context().close();
  for (const [n, p] of [["dueña", d], ["socio", s], ["socio con la sesión recordada", m]]) if (p.errores.length) falla(`${n}: ${p.errores.join(" | ")}`);
} catch (e) {
  falla(`se cortó: ${process.env.E2E_DEPURAR ? e.stack : e.message.split("\n")[0]}`);
} finally {
  // Todo vuelve a como estaba: sin DNI en el testigo y con los accesos de antes.
  try {
    await db.query(`update public.socios s set dni = null from public.gimnasios g where g.id = s.gimnasio_id and g.slug = 'demo' and s.nombre = 'Testigo' and s.apellido = 'Al Día' and s.dni = $1`, [DNI]);
    if (originales) {
      const d2 = await pagina(b, COMPU);
      d2.setDefaultNavigationTimeout(120000);
      await entrar(d2, "duena@ejemplo.invalid");
      await poner(d2, originales);
    }
  } catch (e) { falla(`no pude dejar todo como estaba: ${e.message.split("\n")[0]}`); }
}
await db.end();
await b.close();
resultado();
