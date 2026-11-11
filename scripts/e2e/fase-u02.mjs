#!/usr/bin/env node
// Fase U0.2 · Login universal y errores honestos (PLATAFORMA.md PLAT-02, PLAT-03, PLAT-07, PLAT-08).
// Con supabase-local se crean cuentas reales (API de administración) y se entra por /ingresar de la plataforma:
//   (a) sin ningún gimnasio ni ficha de socio → "Tu usuario no tiene un gimnasio asignado", sin caer en ningún gimnasio ni en el demo,
//       y con el link al WhatsApp de BRIK ([data-ayuda-brik]) si plataforma_contacto tiene uno;
//   (b) con UN gimnasio → entra directo a su panel;
//   (c) con DOS gimnasios → va a /elegir y elige uno;
//   (d) cuenta con el lugar del equipo desactivado → su propio mensaje, nunca "incorrectos";
//   (e) cuenta sin confirmar → su propio mensaje (supabase-local no la distingue: se dice y se sigue; lo cubre destino.test.ts);
//   un host que no es de nadie y /g/<slug> que no existe → "gimnasio no encontrado" con la dirección escrita, nunca el demo (PLAT-03);
//   el demo está marcado es_demo (PLAT-07); celular 390 sin desborde.
//   node scripts/e2e/fase-u02.mjs     (con scripts/local/levantar.sh corriendo; se corre en GitHub Actions)
// ESCRITO, NO EJECUTADO por quien lo escribió. Todo lo que crea lo borra (o lo deja desactivado) al final.
import { execSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import pg from "pg";
import { CELU, COMPU, PLATAFORMA as B, PUERTO, chequear, falla, navegador, ok, pagina, resultado } from "./comun.mjs";
process.on("unhandledRejection", (e) => { console.log(`✗ se cortó (sin atrapar): ${String(e?.message ?? e).split("\n").slice(0, 3).join(" | ")}`); process.exit(1); });

const s = Date.now().toString().slice(-6);
const CLAVE = `ClaveU02-${s}`;
const WHATSAPP = "+5490001112223";
const db = new pg.Client({ connectionString: process.env.DB_PRUEBAS_URL || execSync("scripts/db/local.sh url").toString().trim() });
await db.connect();
const q = async (sql, p) => (await db.query(sql, p)).rows;
const claves = Object.fromEntries(execSync("node scripts/local/supabase-local.mjs claves").toString().trim().split(/\r?\n/).map((l) => l.split(/=(.*)/s).slice(0, 2)));
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL ?? `http://127.0.0.1:${process.env.PUERTO_SUPABASE ?? "54321"}`, claves.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

const creados = { usuarios: [], gimnasios: [] };
async function usuario(mail, { confirmado = true } = {}) {
  const { data, error } = await supabase.auth.admin.createUser({ email: mail, password: CLAVE, email_confirm: confirmado });
  if (error) throw new Error(`crear usuario ${mail}: ${error.message}`);
  creados.usuarios.push(data.user.id);
  return data.user.id;
}
async function gimnasio(slug, nombre) {
  const [{ id }] = await q(`insert into public.gimnasios (slug, nombre) values ($1, $2) returning id`, [slug, nombre]);
  await q(`insert into public.dominios_gimnasio (gimnasio_id, host, tipo) values ($1, $2, 'subdominio') on conflict do nothing`, [id, `${slug}.localhost`]);
  creados.gimnasios.push(id);
  return id;
}
const equipo = async (g, u, nombre, rol = "recepcion") => (await q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1, $2, $3, $4) returning id`, [g, u, nombre, rol]))[0].id;

/** Escribe mail y contraseña en el /ingresar de `base` y devuelve a dónde fue (ruta) o qué error mostró (texto + link de ayuda). */
async function intentar(b, base, mail, clave = CLAVE, viewport = COMPU) {
  const p = await pagina(b, viewport);
  p.setDefaultNavigationTimeout(120000);
  await p.goto(`${base}/ingresar`);
  await p.fill("input[type=email]", mail);
  await p.fill("input[type=password]", clave);
  await p.click("button[type=submit]");
  const alerta = p.locator("[role=alert]", { hasText: /\S/ }).first();
  const r = await Promise.race([
    p.waitForURL((u) => !u.pathname.startsWith("/ingresar"), { timeout: 60000 }).then(() => ({ ruta: new URL(p.url()).pathname })),
    alerta.waitFor({ timeout: 60000 }).then(async () => ({ error: (await alerta.innerText()).trim(), ayuda: await p.locator("[data-ayuda-brik]").count() })),
  ]);
  return { p, ...r };
}
const sinDesborde = async (p, que) => {
  const a = await p.evaluate(() => ({ s: document.documentElement.scrollWidth, w: window.innerWidth }));
  chequear(a.s <= a.w + 1, `${que}: celular 390 px sin desborde horizontal`, `${que}: desborde horizontal (${a.s} > ${a.w})`);
};

const [{ nombre: NOMBRE_DEMO }] = await q(`select nombre from public.gimnasios where slug = 'demo'`);
const antes = (await q(`select whatsapp from public.plataforma_contacto where id`))[0]?.whatsapp ?? null;
const b = await navegador();
try {
  // PLAT-07 · el demo está marcado
  chequear((await q(`select bool_and(es_demo) x from public.gimnasios where slug in ('demo', 'demo-box')`))[0].x === true, "PLAT-07: el demo está marcado es_demo", "PLAT-07: el demo no está marcado es_demo");

  const G1 = await gimnasio(`u02a-${s}`, `Gimnasio U02 A ${s}`);
  const G2 = await gimnasio(`u02b-${s}`, `Gimnasio U02 B ${s}`);
  await q(`update public.plataforma_contacto set whatsapp = $1 where id`, [WHATSAPP]);

  // ── (a) sin ningún gimnasio ──
  const mA = `u02-sin-${s}@ejemplo.invalid`;
  await usuario(mA);
  let r = await intentar(b, B, mA);
  chequear(/no tiene un gimnasio asignado/i.test(r.error ?? ""), "(a) sin gimnasio: “Tu usuario no tiene un gimnasio asignado”", `(a) sin gimnasio: ${r.error ?? r.ruta}`);
  chequear(!/incorrecto/i.test(r.error ?? "") && !(r.error ?? "").includes(NOMBRE_DEMO), "(a) no dice “incorrectos” ni nombra al demo", "(a) el mensaje dice “incorrectos” o nombra al demo");
  chequear((r.ayuda ?? 0) > 0 && (await r.p.locator("[data-ayuda-brik]").first().getAttribute("href"))?.includes(WHATSAPP.slice(1)), "(a) muestra el link al WhatsApp de BRIK", "(a) falta el link al WhatsApp de BRIK");
  chequear(new URL(r.p.url()).pathname.startsWith("/ingresar"), "(a) se queda en el login: no cae a ningún gimnasio ni al demo", `(a) terminó en ${r.p.url()}`);
  await r.p.context().close();
  const celuA = await intentar(b, B, mA, CLAVE, CELU);
  await sinDesborde(celuA.p, "(a) el error en el login");
  await celuA.p.context().close();

  // ── (b) con UN gimnasio ──
  const mB = `u02-uno-${s}@ejemplo.invalid`;
  const uB = await usuario(mB);
  await equipo(G1, uB, "Ana U02");
  r = await intentar(b, B, mB);
  chequear(r.ruta === "/panel", "(b) un gimnasio: entra directo a su panel", `(b) un gimnasio: ${r.ruta ?? r.error}`);
  await r.p.locator("h1").first().waitFor({ timeout: 60000 }).catch(() => {});
  chequear((await r.p.title()).includes(`Gimnasio U02 A ${s}`), "(b) el panel es el de SU gimnasio", `(b) título: ${await r.p.title()}`);
  await r.p.context().close();

  // ── (c) con DOS gimnasios ──
  const mC = `u02-dos-${s}@ejemplo.invalid`;
  const uC = await usuario(mC);
  await equipo(G1, uC, "Beto U02");
  await equipo(G2, uC, "Beto U02 B");
  r = await intentar(b, B, mC);
  chequear(r.ruta === "/elegir", "(c) dos gimnasios: va a /elegir", `(c) dos gimnasios: ${r.ruta ?? r.error}`);
  const texto = await r.p.locator("main").innerText();
  chequear(texto.includes(`Gimnasio U02 A ${s}`) && texto.includes(`Gimnasio U02 B ${s}`), "(c) /elegir lista los dos gimnasios", "(c) /elegir no lista los dos gimnasios");
  await sinDesborde(r.p, "(c) /elegir");
  await r.p.getByText(`Gimnasio U02 B ${s}`).first().click();
  await r.p.waitForURL(/\/panel/, { timeout: 60000 });
  await r.p.locator("h1").first().waitFor({ timeout: 60000 }).catch(() => {});
  chequear((await r.p.title()).includes(`Gimnasio U02 B ${s}`), "(c) elige el segundo y cae en SU panel", `(c) título tras elegir: ${await r.p.title()}`);
  await r.p.context().close();

  // ── (d) lugar del equipo desactivado ──
  const mD = `u02-desact-${s}@ejemplo.invalid`;
  const uD = await usuario(mD);
  const eD = await equipo(G1, uD, "Dani U02");
  await q(`update public.equipo set activo = false where id = $1`, [eD]);
  r = await intentar(b, B, mD);
  chequear(!/incorrecto/i.test(r.error ?? "") && !!r.error, "(d) desactivada: no dice “mail o contraseña incorrectos”", `(d) desactivada: ${r.error ?? r.ruta}`);
  chequear(/gimnasio asignado|desactivad/i.test(r.error ?? ""), `(d) desactivada: su propio mensaje (“${(r.error ?? "").slice(0, 60)}”)`, `(d) mensaje: ${r.error ?? r.ruta}`);
  await r.p.context().close();

  // ── (e) cuenta sin confirmar ──
  const mE = `u02-sinconf-${s}@ejemplo.invalid`;
  await usuario(mE, { confirmado: false });
  r = await intentar(b, B, mE);
  if (r.error) {
    chequear(!/incorrecto/i.test(r.error), "(e) sin confirmar: su propio mensaje, no “incorrectos”", `(e) sin confirmar dice: ${r.error}`);
  } else ok("(e) sin confirmar: supabase-local no distingue la cuenta sin confirmar (entra); el mensaje lo cubre destino.test.ts");
  await r.p.context().close();

  // ── PLAT-03 · direcciones que no son de nadie ──
  const host = `nadie-${s}.localhost:${PUERTO}`;
  const p = await pagina(b, COMPU);
  p.setDefaultNavigationTimeout(120000);
  let resp = await p.goto(`http://${host}/ingresar`);
  let t = await p.locator("body").innerText();
  chequear(resp.status() === 404 && t.includes(`nadie-${s}.localhost`) && !t.includes(NOMBRE_DEMO), "PLAT-03: un host que no es de nadie → “gimnasio no encontrado” con la dirección escrita, nunca el demo", `PLAT-03 host: ${resp.status()} ${t.slice(0, 80)}`);
  await sinDesborde(p, "host desconocido");
  resp = await p.goto(`${B}/g/no-existe-${s}`);
  t = await p.locator("body").innerText();
  chequear(resp.status() === 404 && t.includes(`no-existe-${s}`) && !t.includes(NOMBRE_DEMO), "PLAT-03: /g/<slug> que no existe → “gimnasio no encontrado”, nunca el demo", `PLAT-03 /g: ${resp.status()} ${t.slice(0, 80)}`);
  resp = await p.goto(`${B}/g/no-existe-${s}/ingresar`);
  t = await p.locator("body").innerText();
  chequear(resp.status() === 404 && !t.includes(NOMBRE_DEMO), "PLAT-03: /g/<slug que no existe>/ingresar tampoco cae al demo", `PLAT-03 /g/…/ingresar: ${resp.status()}`);
  await p.context().close();
} catch (e) {
  falla(`se cortó: ${process.env.E2E_DEPURAR ? e.message : e.message.split("\n")[0]}`);
} finally {
  // Lo que se creó se borra; si la base no deja borrar (hechos), queda desactivado.
  await q(`update public.plataforma_contacto set whatsapp = $1 where id`, [antes]).catch(() => {});
  for (const g of creados.gimnasios) {
    await q(`delete from public.equipo where gimnasio_id = $1`, [g]).catch(() => {});
    await q(`delete from public.dominios_gimnasio where gimnasio_id = $1`, [g]).catch(() => {});
    await q(`update public.gimnasios set es_demo = true where id = $1`, [g]).catch(() => {});
  }
  for (const u of creados.usuarios) await supabase.auth.admin.deleteUser(u).catch(() => {});
  await db.end();
}
await b.close();
resultado();
