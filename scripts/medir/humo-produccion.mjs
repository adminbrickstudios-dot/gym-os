#!/usr/bin/env node
// U0.3 · Prueba de humo permanente en PRODUCCIÓN (después de cada publicación).
//   El super admin crea un gimnasio de prueba con su dueño → el dueño entra por las puertas → aterriza en el panel correcto con el rol
//   correcto → el gimnasio de prueba se da de baja (queda pausado y "para borrar", fuera de las listas).
//   BASE_URL=https://… BRIK_ADMIN_MAIL=… BRIK_ADMIN_CLAVE=… [SUPABASE_DB_URL=… para dar de baja el gimnasio de prueba] node scripts/medir/humo-produccion.mjs
// Puertas: 1) /ingresar de la plataforma; 2) /g/<slug>/ingresar (conserva el gimnasio y su marca); 3) /dueno en la dirección del gimnasio
// (solo si la plataforma tiene dominio propio con subdominios: en *.vercel.app no hay comodín y se omite, y se dice).
// Datos obviamente ficticios (@ejemplo.invalid). Nada de claves en el repo ni en el registro de Actions.
import { chromium } from "playwright";
import pg from "pg";

const BASE = (process.env.BASE_URL ?? "").replace(/\/$/, "");
const ADMIN = process.env.BRIK_ADMIN_MAIL, CLAVE_ADMIN = process.env.BRIK_ADMIN_CLAVE;
if (!BASE || !ADMIN || !CLAVE_ADMIN) { console.error("Faltan BASE_URL, BRIK_ADMIN_MAIL y BRIK_ADMIN_CLAVE (secretos del repositorio)."); process.exit(2); }

const s = Date.now().toString(36).slice(-6);
const SLUG = `humo-${s}`, NOMBRE = `Humo ${s} [demo]`, MAIL = `humo-${s}@ejemplo.invalid`, CLAVE = `Humo-${s}-clave`;
let pasos = 0, fallas = 0;
const ok = (m) => console.log(`✓ ${++pasos}. ${m}`);
const mal = (m) => { fallas++; console.log(`✗ ${m}`); };
const chequear = (c, bien, malo) => (c ? ok(bien) : mal(malo));
const subdominios = !/\.vercel\.app$/.test(new URL(BASE).hostname);

const b = await chromium.launch();
const nueva = async () => { const c = await b.newContext({ viewport: { width: 1280, height: 800 } }); const p = await c.newPage(); p.setDefaultNavigationTimeout(90000); p.setDefaultTimeout(60000); return p; };
const entrarForm = async (p, url, mail, clave) => {
  await p.goto(url, { waitUntil: "domcontentloaded" });
  await p.fill("input[type=email]", mail); await p.fill("input[type=password]", clave); await p.click("button[type=submit]");
};
const comoDueno = async (p, etiqueta) => {
  await p.waitForURL(/\/panel/, { timeout: 90000 });
  await p.locator("h1").first().waitFor({ timeout: 60000 });
  chequear((await p.title()).includes(NOMBRE.replace(" [demo]", "")) || (await p.title()).includes("Humo"), `${etiqueta}: cae en el panel del gimnasio de prueba`, `${etiqueta}: el título es “${await p.title()}”`);
  await p.goto(p.url().replace(/\/panel.*$/, "/panel/cuenta"), { waitUntil: "domcontentloaded" });
  await p.locator("h1").first().waitFor({ timeout: 60000 });
  chequear(/Dueñ[oa]/.test(await p.locator("main").innerText()), `${etiqueta}: con el rol de dueño`, `${etiqueta}: no dice que es el dueño`);
};

try {
  // 1 · el super admin crea el gimnasio y su dueño
  const a = await nueva();
  await entrarForm(a, `${BASE}/ingresar`, ADMIN, CLAVE_ADMIN);
  await a.waitForURL((u) => !u.pathname.startsWith("/ingresar"), { timeout: 90000 });
  await a.goto(`${BASE}/admin`, { waitUntil: "domcontentloaded" });
  const alta = a.locator("[data-alta-gimnasio]");
  await alta.waitFor({ timeout: 90000 });
  ok("el super admin entra a /admin");
  await alta.getByRole("button", { name: /Siguiente/ }).click();
  await alta.locator('[data-alta-paso="2"]').waitFor({ state: "visible" });
  await a.fill("input[name=nombre]", NOMBRE);
  await a.fill("input[name=slug]", SLUG).catch(() => {});   // si la dirección es editable
  await alta.getByRole("button", { name: /Siguiente/ }).click();
  await a.fill("input[name=dueno]", `Dueño Humo ${s}`);
  await a.fill("input[name=email]", MAIL);
  await a.locator("input[name=contrasena_elegida]").fill(CLAVE);
  await a.click('button:has-text("Crear gimnasio")');
  await alta.locator("strong.numero, .mensaje, [role=alert]").first().waitFor({ timeout: 90000 });
  const textoAlta = (await alta.innerText()).replace(/\s+/g, " ");
  chequear(!/Invalid API key|a medias|Falta la clave|no es válida/i.test(textoAlta), "el alta termina con el dueño con acceso (sin “Invalid API key” ni “a medias”)", `el alta no terminó bien: ${textoAlta.slice(0, 240)}`);
  const slugReal = (await a.locator("li", { hasText: NOMBRE }).first().innerText().catch(() => "")).match(/([a-z0-9-]+)\.[a-z0-9.-]+/)?.[1] ?? SLUG;

  // 2 · puerta 1: /ingresar de la plataforma
  const p1 = await nueva();
  await entrarForm(p1, `${BASE}/ingresar`, MAIL.toUpperCase(), CLAVE);
  await comoDueno(p1, "puerta 1 (/ingresar)");

  // 3 · puerta 2: /g/<slug>/ingresar conserva el gimnasio y su marca
  const p2 = await nueva();
  await p2.goto(`${BASE}/g/${slugReal}/ingresar`, { waitUntil: "domcontentloaded" });
  await p2.locator("input[type=email]").waitFor();
  chequear((await p2.locator("body").innerText()).includes("Humo"), "puerta 2: /g/<slug>/ingresar muestra la marca del gimnasio", "puerta 2: no muestra el gimnasio");
  await p2.fill("input[type=email]", MAIL); await p2.fill("input[type=password]", CLAVE); await p2.click("button[type=submit]");
  await comoDueno(p2, "puerta 2 (/g/<slug>/ingresar)");

  // 4 · puerta 3: /dueno en la dirección del gimnasio (solo con subdominios)
  if (subdominios) {
    const host = new URL(BASE).host;
    const p3 = await nueva();
    await p3.goto(`${new URL(BASE).protocol}//${slugReal}.${host}/dueno`, { waitUntil: "domcontentloaded" });
    await p3.locator("input[type=email]").waitFor({ timeout: 60000 });
    await p3.fill("input[type=email]", MAIL); await p3.fill("input[type=password]", CLAVE); await p3.click("button[type=submit]");
    await comoDueno(p3, "puerta 3 (/dueno)");
  } else console.log("· puerta 3 (/dueno en la dirección del gimnasio) omitida: *.vercel.app no tiene subdominios; se prueba con el dominio propio");

  // 5 · la contraseña mala dice la verdad (cuenta que existe)
  const p4 = await nueva();
  await entrarForm(p4, `${BASE}/g/${slugReal}/ingresar`, MAIL, "contraseña-equivocada");
  await p4.locator("[role=alert]").first().waitFor({ timeout: 60000 });
  chequear(/no son correctos/.test(await p4.locator("[role=alert]").first().innerText()), "contraseña mala: el mensaje lo dice", "contraseña mala: mensaje inesperado");
} catch (e) { mal(`se cortó: ${String(e.message).split("\n")[0]}`); }
finally {
  await b.close();
  // 6 · limpieza: el gimnasio de prueba queda dado de baja (pausado, "para borrar", fuera de las listas)
  if (process.env.SUPABASE_DB_URL) {
    const c = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL }); await c.connect();
    const r = await c.query("update public.gimnasios set baja_en = now(), baja_motivo = 'Prueba de humo automática', suspension_manual_en = coalesce(suspension_manual_en, now()), suspension_manual_motivo = coalesce(suspension_manual_motivo, 'Prueba de humo') where nombre = $1 and baja_en is null", [NOMBRE]);
    await c.end();
    console.log(r.rowCount ? "· gimnasio de prueba dado de baja" : "· (no había gimnasio de prueba para dar de baja)");
  } else console.log("· sin SUPABASE_DB_URL: el gimnasio de prueba queda sin dar de baja (se ve en /admin con [demo])");
}
console.log(fallas ? `\n✗ ${fallas} falla(s) en ${pasos + fallas} pasos` : `\n✓ ${pasos} pasos en verde`);
process.exit(fallas ? 1 : 0);
