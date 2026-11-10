#!/usr/bin/env node
// Fase U · U1 y U2, con sesiones reales contra supabase-local:
//  U1  crear un gimnasio con su dueño cuando la clave de servicio está mal puesta: el error dice en palabras qué pasa y qué hacer
//      (nunca "Invalid API key"), el gimnasio queda con "Terminar alta: dar acceso al dueño" en la ficha y en las listas, repetir el
//      alta no crea otro, y dar acceso después funciona. El chequeo de Estado de la plataforma prueba la clave creando y borrando
//      un usuario de prueba.
//  U2  alta de dueño, de recepcionista y de socio con la contraseña que escribe quien la crea: los tres entran al toque y no se
//      registra ningún envío de mail (supabase-local guarda cada código/mail que "manda" en .local/codigos.json).
// La clave mal puesta se simula con el archivo .local/clave-servicio-mala, que supabase-local mira: mientras existe, todo pedido con
// la service_role responde 401 "Invalid API key", como Supabase.
//   node scripts/e2e/fase-u1-u2.mjs        (con scripts/local/levantar.sh corriendo)
import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import pg from "pg";
import { PLATAFORMA as B, aparece, capturar, chequear, entrar, falla, navegador, ok, pagina, resultado } from "./comun.mjs";
import { altaGimnasio } from "./alta-gimnasio.mjs";

const url = process.env.DB_PRUEBAS_URL || execSync("scripts/db/local.sh url").toString().trim();
const db = new pg.Client({ connectionString: url });
await db.connect();
const q = async (sql, params) => (await db.query(sql, params)).rows;

const CARPETA = join(process.cwd(), ".local");
const CLAVE_MALA = join(CARPETA, "clave-servicio-mala");
const ponerClaveMala = () => { mkdirSync(CARPETA, { recursive: true }); writeFileSync(CLAVE_MALA, "e2e U1"); };
const sacarClaveMala = () => rmSync(CLAVE_MALA, { force: true });
const enviosDe = (mail) => {
  const f = join(CARPETA, "codigos.json");
  if (!existsSync(f)) return 0;
  return Object.keys(JSON.parse(readFileSync(f, "utf8"))).filter((k) => k.toLowerCase() === mail.toLowerCase()).length;
};

const s = Date.now().toString().slice(-5);
const NOMBRE_A = `U1 Alta ${s}`, MAIL_A = `u1dueno${s}@ejemplo.invalid`;
const NOMBRE_B = `U1 Ficha ${s}`, MAIL_B = `u1ficha${s}@ejemplo.invalid`;
const MAIL_RECEP = `u2recep${s}@ejemplo.invalid`, CLAVE_RECEP = `recep-${s}-clave`;
const MAIL_SOCIO = `u2socio${s}@ejemplo.invalid`, CLAVE_SOCIO = `socio-${s}-clave`;
const CLAVE_DUENO_B = `dueno-b-${s}-clave`;

const b = await navegador();
const p = await pagina(b);
p.setDefaultTimeout(30000);
const abrir = async (ruta) => { await p.goto(`${B}${ruta}`); await p.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {}); };
const idDe = async (nombre) => (await q(`select id from public.gimnasios where nombre = $1`, [nombre]))[0]?.id;
const MALAS = /invalid api key/i;

try {
  await entrar(p, "admin@ejemplo.invalid", undefined, B);
  chequear(p.url().endsWith("/admin"), "el admin entra al super admin", `el admin cayó en ${p.url()}`);

  // ── U1 (c): el chequeo prueba la clave creando y borrando un usuario de prueba ──
  await abrir("/admin");
  const estado = await p.locator("details").evaluateAll((l) => l.map((e) => e.textContent ?? "").join(" "));
  chequear(/Clave de servicio funcionando: se crea y se borra una cuenta de prueba/.test(estado), "Estado de la plataforma: la clave de servicio se probó creando y borrando una cuenta", `el estado de la plataforma dice: ${estado.replace(/\s+/g, " ").slice(0, 300)}`);
  chequear((await q(`select 1 from auth.users where email like 'chequeo-%@ejemplo.invalid'`)).length === 0, "la cuenta de prueba del chequeo no queda en la base", "quedó una cuenta chequeo-… en la base");

  // ── U1 (a) y (b): alta con la clave mal puesta ──
  ponerClaveMala();
  try {
    await altaGimnasio(p, { nombre: NOMBRE_A, dueno: "Dueño Alta", email: MAIL_A, tipo: "" });
    await p.locator("[data-alta-a-medias]").waitFor({ timeout: 60000 });
  } finally { sacarClaveMala(); }
  const aMedias = await p.locator("[data-alta-a-medias]").innerText();
  chequear(!MALAS.test(aMedias), "el error no dice “Invalid API key”", `el error dice “Invalid API key”: ${aMedias.slice(0, 200)}`);
  chequear(/SUPABASE_SERVICE_ROLE_KEY/.test(aMedias) && /service_role/.test(aMedias) && /Vercel/.test(aMedias) && /redeploy/.test(aMedias),
    "el error dice en palabras qué pasa y qué hacer (variable, clave service_role, Vercel, redeploy)", `el error no explica qué hacer: ${aMedias.replace(/\s+/g, " ").slice(0, 300)}`);
  chequear(await aparece(p.locator("[data-alta-a-medias] [data-terminar-alta]")), "el alta a medias ofrece “Terminar alta: dar acceso al dueño”", "falta el botón Terminar alta en el resultado del alta");
  await capturar(p, "u1-alta-a-medias", true);
  const idA = await idDe(NOMBRE_A);
  chequear(!!idA, "el gimnasio quedó creado a pesar del error", "el gimnasio no quedó creado");
  chequear((await q(`select 1 from public.equipo where gimnasio_id = $1 and rol = 'dueno' and usuario_id is null`, [idA])).length === 1, "el dueño quedó sin acceso (todavía sin cuenta)", "el dueño ya tiene cuenta o no existe");

  // En la lista de /admin y en la lista de gimnasios, con "Terminar alta".
  await abrir("/admin");
  chequear(await aparece(p.locator("li", { hasText: NOMBRE_A }).locator("[data-terminar-alta]")), "/admin: el gimnasio figura con “Terminar alta: dar acceso al dueño”", "/admin no muestra Terminar alta");
  await abrir("/admin/gimnasios");
  await p.locator("[data-gimnasio-fila], [data-sin-resultados]").first().waitFor();
  chequear(await aparece(p.locator("[data-gimnasio-fila]", { hasText: NOMBRE_A }).locator("[data-terminar-alta]")), "la lista de gimnasios también lo marca", "la lista de gimnasios no marca Terminar alta");
  // La ficha.
  await abrir(`/admin/${idA}`);
  chequear(await aparece(p.locator("[data-terminar-alta-ficha]")), "la ficha dice “Terminar alta: dar acceso al dueño”", "la ficha no muestra Terminar alta");

  // Repetir el alta con la misma dirección (ya con la clave bien): termina ESE gimnasio, no crea otro.
  await abrir("/admin");
  await altaGimnasio(p, { nombre: NOMBRE_A, dueno: "Dueño Alta", email: MAIL_A, tipo: "" });
  await p.locator("[data-alta-gimnasio] strong.numero").first().waitFor({ timeout: 60000 });
  const claveA = (await p.locator("[data-alta-gimnasio] strong.numero").first().innerText()).trim();
  chequear((await q(`select count(*)::int n from public.gimnasios where nombre = $1`, [NOMBRE_A]))[0].n === 1, "repetir el alta no crea otro gimnasio", "el reintento creó un gimnasio duplicado");
  chequear((await idDe(NOMBRE_A)) === idA, "el reintento terminó el mismo gimnasio", "el reintento terminó otro gimnasio");
  ok(`acceso del dueño terminado con el reintento (${claveA})`);

  // ── U1 (b), por la ficha: otro alta cortado y “Terminar alta” desde la ficha ──
  ponerClaveMala();
  try {
    await abrir("/admin");
    await altaGimnasio(p, { nombre: NOMBRE_B, dueno: "Dueño Ficha", email: MAIL_B, tipo: "" });
    await p.locator("[data-alta-a-medias]").waitFor({ timeout: 60000 });
  } finally { sacarClaveMala(); }
  const idB = await idDe(NOMBRE_B);
  await abrir(`/admin/${idB}`);
  chequear(await aparece(p.locator("[data-terminar-alta-ficha]")), "ficha del alta cortada: aparece “Terminar alta”", "la ficha no muestra Terminar alta");
  const filaDueno = p.locator("#equipo li", { hasText: "Dueño Ficha" });
  await filaDueno.locator('button:has-text("Dar acceso")').click();
  await filaDueno.locator("input[name=email]").fill(MAIL_B);
  await filaDueno.locator("[data-contrasena-elegida]").fill(CLAVE_DUENO_B);
  await filaDueno.locator('button:has-text("Dar acceso")').click();
  await filaDueno.locator("strong.numero").waitFor({ timeout: 30000 });
  ok("“Terminar alta” desde la ficha: el dueño tiene acceso con la contraseña que se escribió");
  await abrir(`/admin/${idB}`);
  chequear((await p.locator("[data-terminar-alta-ficha]").count()) === 0, "después de dar acceso, la ficha ya no dice Terminar alta", "la ficha sigue diciendo Terminar alta");
  await abrir("/admin/gimnasios");
  await p.locator("[data-gimnasio-fila], [data-sin-resultados]").first().waitFor();
  chequear((await p.locator("[data-gimnasio-fila]", { hasText: NOMBRE_B }).locator("[data-terminar-alta]").count()) === 0, "la lista tampoco lo marca ya", "la lista sigue marcando Terminar alta");

  // ── U2: tres altas con contraseña, entran al toque y no hay mails ──
  // Dueño (gimnasio A): la contraseña que mostró el alta.
  await p.context().clearCookies();
  await entrar(p, MAIL_A, claveA, B);
  await p.waitForURL(/\/panel/, { timeout: 60000 });
  ok(`el dueño (alta con contraseña) entra al toque: “${(await p.locator("h1").first().innerText()).replace(/\s+/g, " ")}”`);
  // El dueño de la ficha (gimnasio B), con la contraseña que escribió el admin.
  const pb = await pagina(b);
  await entrar(pb, MAIL_B, CLAVE_DUENO_B, B);
  await pb.waitForURL(/\/panel/, { timeout: 60000 });
  ok("el dueño con la contraseña que escribió el admin también entra al toque");
  await pb.context().close();

  // Recepcionista: la suma el admin al gimnasio A con la contraseña que escribe.
  await p.context().clearCookies();
  await entrar(p, "admin@ejemplo.invalid", undefined, B);
  await abrir(`/admin/${idA}`);
  const form = 'form:has-text("Sumar a alguien")';
  await p.fill(`${form} input[name=nombre]`, "Recepción U2");
  await p.selectOption(`${form} select[name=rol]`, "recepcion");
  await p.click(`${form} button:has-text("Sumar")`);
  const filaRecep = p.locator("#equipo li", { hasText: "Recepción U2" });
  await filaRecep.waitFor({ timeout: 30000 });
  await filaRecep.locator('button:has-text("Dar acceso")').click();
  await filaRecep.locator("input[name=email]").fill(MAIL_RECEP);
  await filaRecep.locator("[data-contrasena-elegida]").fill(CLAVE_RECEP);
  await filaRecep.locator('button:has-text("Dar acceso")').click();
  await filaRecep.locator("strong.numero").waitFor({ timeout: 30000 });
  chequear((await filaRecep.locator("strong.numero").innerText()).trim() === CLAVE_RECEP, "la recepcionista queda con la contraseña que escribió el admin", "la contraseña de la recepcionista no es la escrita");
  const pr = await pagina(b);
  await entrar(pr, MAIL_RECEP, CLAVE_RECEP, B);
  await pr.waitForURL(/\/panel/, { timeout: 60000 });
  ok("la recepcionista entra al toque con esa contraseña");
  await pr.context().close();

  // Socio: lo da de alta el dueño (desde el panel) con la contraseña que escribe.
  await p.context().clearCookies();
  await entrar(p, MAIL_A, claveA, B);
  await p.waitForURL(/\/panel/, { timeout: 60000 });
  await p.goto(`${B}/panel/socios/nuevo`);
  await p.fill("input[name=nombre]", "Socio");
  await p.fill("input[name=apellido]", `U2 ${s}`);
  await p.fill("input[name=dni]", `6${s}11`);
  await p.fill("input[name=email]", MAIL_SOCIO);
  await p.fill("[data-contrasena-socio]", CLAVE_SOCIO);
  await p.locator("form button:has-text('Dar de alta')").first().click();
  chequear(await aparece(p.locator("[data-socio-con-contrasena]"), 40000), "alta de socio con contraseña: dice que ya puede entrar y que no se le mandó ningún mail", `el alta del socio no confirmó la contraseña: ${(await p.locator("main").innerText().catch(() => "")).replace(/\s+/g, " ").slice(0, 300)}`);
  chequear((await p.locator("[data-link-contrasena]").count()) === 0, "con contraseña escrita no se pide ningún link ni código", "se ofrece un link de contraseña a pesar de haberla escrito");
  await capturar(p, "u2-socio-alta", true);
  const ps = await pagina(b);
  await entrar(ps, MAIL_SOCIO, CLAVE_SOCIO, B);
  chequear(/\/app/.test(ps.url()), "el socio entra al toque a su app con su mail y esa contraseña", `el socio cayó en ${ps.url()}`);
  await ps.context().close();

  // Ningún mail: las cuentas están confirmadas y no hay códigos ni invitaciones registrados.
  for (const mail of [MAIL_A, MAIL_B, MAIL_RECEP, MAIL_SOCIO]) {
    const u = (await q(`select email_confirmed_at from auth.users where lower(email) = $1`, [mail]))[0];
    chequear(!!u?.email_confirmed_at, `${mail}: cuenta creada ya confirmada (no pide confirmar el mail)`, `${mail}: la cuenta no existe o quedó sin confirmar`);
    chequear(enviosDe(mail) === 0, `${mail}: ningún mail ni código enviado`, `${mail}: figura un envío en .local/codigos.json`);
  }
  if (p.errores.length) falla(`errores en la página: ${p.errores.join(" | ")}`);
} catch (e) {
  falla(`se cortó: ${e.message.split("\n")[0]}`);
  await capturar(p, "ROTA-fase-u1-u2", true).catch(() => {});
} finally {
  sacarClaveMala();
  await db.end().catch(() => {});
}
await b.close();
resultado();
