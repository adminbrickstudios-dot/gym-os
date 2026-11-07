#!/usr/bin/env node
// VD-42 · Mi cuenta y seguridad: "Dar de baja" a alguien del equipo en un botón (corta su sesión, su PIN y su turno de
// caja; el historial queda), alerta al dueño por un dispositivo nuevo del equipo y por la baja, y la verificación en dos pasos
// protegiendo exportar datos. Cambiar la contraseña y "mis sesiones" ya los cubre vd-33b.
//   node scripts/e2e/vd-42.mjs     (con scripts/local/levantar.sh corriendo)
//
// NO ejecutable acá: el enrolamiento TOTP (escanear el QR y verificar el código) necesita el MFA de GoTrue, que
// supabase-local no imita. Lo que sí se prueba: la pantalla de dos pasos está, y con un factor verificado en la base y
// sin aal2 en el token, exportar redirige a confirmar el código (la regla de aal2 en SQL la cubre
// supabase/pruebas/dos-pasos-y-baja.test.mjs con tokens aal1 y aal2).
import { execSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import pg from "pg";
import { CELU, COMPU, GIMNASIO, CLAVE_DEMO, chequear, entrar, falla, navegador, ok, pagina, resultado } from "./comun.mjs";

const G = GIMNASIO();
const url = process.env.DB_PRUEBAS_URL || execSync("scripts/db/local.sh url").toString().trim();
const db = new pg.Client({ connectionString: url }); await db.connect();
const q = async (s, p) => (await db.query(s, p)).rows;
const claves = Object.fromEntries(execSync("node scripts/local/supabase-local.mjs claves").toString().trim().split(/\r?\n/).map((l) => l.split(/=(.*)/s).slice(0, 2)));
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL ?? `http://127.0.0.1:${process.env.PUERTO_SUPABASE ?? "54321"}`, claves.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

const s = Date.now().toString().slice(-6);
const NOMBRE = `Baja E2e ${s}`;
const MAIL = `baja${s}@ejemplo.invalid`;
const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
const [{ id: g }] = await q(`select id from public.gimnasios where slug = 'demo'`);
const [{ id: sede }] = await q(`select id from public.sedes where gimnasio_id = $1 and es_principal`, [g]);
const [{ id: duenaUsuario }] = await q(`select u.id from auth.users u where lower(u.email) = 'duena@ejemplo.invalid'`);
const esperarHasta = async (fn, ms = 30000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await fn()) return true; await new Promise((r) => setTimeout(r, 400)); } return false; };

const b = await navegador();
let factor = null;
try {
  // ── Preparación: una persona nueva del equipo, con su cuenta, su PIN y un turno de caja abierto ──
  const { data, error } = await supabase.auth.admin.createUser({ email: MAIL, password: CLAVE_DEMO, email_confirm: true });
  if (error) throw new Error(`crear usuario: ${error.message}`);
  const [{ id: equipo }] = await q(`insert into public.equipo (gimnasio_id, nombre, rol) values ($1,$2,'recepcion') returning id`, [g, NOMBRE]);
  const vinc = await supabase.rpc("vincular_usuario_equipo", { p_equipo_id: equipo, p_usuario_id: data.user.id });
  if (vinc.error) throw new Error(`vincular: ${vinc.error.message}`);
  await q(`insert into privado.pines_equipo (equipo_id, gimnasio_id, pin_hash) values ($1,$2,extensions.crypt('4829', extensions.gen_salt('bf', 4)))`, [equipo, g]);
  const [{ id: caja }] = await q(`insert into public.cajas (gimnasio_id, sede_id, nombre) values ($1,$2,$3) returning id`, [g, sede, `Caja ${NOMBRE}`]);
  const [{ id: turno }] = await q(`insert into public.turnos_caja (gimnasio_id, caja_id, abierto_por, monto_inicial) values ($1,$2,$3,0) returning id`, [g, caja, equipo]);
  ok(`prepara a ${NOMBRE}: cuenta, PIN y un turno de caja abierto`);

  // ── Dispositivo nuevo: entra desde la compu y después desde un iPhone ──
  const compu = await pagina(b, COMPU);
  await entrar(compu, MAIL);
  await compu.goto(`${G}/panel`);
  await compu.locator("h1").first().waitFor({ timeout: 60000 });
  const anotada = await esperarHasta(async () => (await q(`select 1 from public.huellas_equipo where equipo_id = $1`, [equipo])).length === 1);
  chequear(anotada, "el primer dispositivo se anota", "no se anotó el primer dispositivo");
  chequear((await q(`select 1 from public.alertas_seguridad where equipo_id = $1`, [equipo])).length === 0, "el primer dispositivo no genera alerta", "el primer dispositivo generó una alerta");
  const celu = await pagina(b, CELU, { userAgent: IPHONE });
  await entrar(celu, MAIL);
  await celu.goto(`${G}/panel`);
  await celu.locator("h1").first().waitFor({ timeout: 60000 });
  const alertada = await esperarHasta(async () => (await q(`select 1 from public.alertas_seguridad where equipo_id = $1 and tipo = 'dispositivo_nuevo'`, [equipo])).length === 1);
  chequear(alertada, "entrar desde un iPhone nuevo genera la alerta de dispositivo nuevo", "no apareció la alerta de dispositivo nuevo");

  // ── La dueña ve la alerta en Inicio y la da por vista ──
  const d = await pagina(b, COMPU);
  await entrar(d, "duena@ejemplo.invalid");
  await d.goto(`${G}/panel`);
  const alerta = d.locator('[data-alerta="dispositivo_nuevo"]', { hasText: NOMBRE });
  await alerta.waitFor({ timeout: 60000 });
  chequear(/iPhone/.test(await alerta.innerText()), "Inicio de la dueña avisa quién entró y desde qué dispositivo (iPhone)", await alerta.innerText());
  chequear(await d.locator("[data-recomendar-2fa]").count() === 1, "Inicio le recomienda activar la verificación en dos pasos", "no recomienda los dos pasos");
  await d.locator("[data-marcar-alertas]").click();
  await alerta.waitFor({ state: "detached", timeout: 30000 });
  ok("“Entendido” da por vistas las alertas");

  // ── Dar de baja en un botón ──
  await d.goto(`${G}/panel/equipo`);
  const fila = d.locator("li", { hasText: NOMBRE }).first();
  await fila.waitFor({ timeout: 60000 });
  await fila.locator(`[data-dar-de-baja="${equipo}"]`).click();
  await fila.locator("[data-confirmar-baja]").waitFor({ timeout: 10000 });
  chequear((await q(`select activo from public.equipo where id = $1`, [equipo]))[0].activo === true, "pedir la baja no la hace hasta confirmar", "la baja se hizo sin confirmar");
  await fila.locator("input[aria-label^='Motivo']").fill("Se fue del gimnasio");
  await fila.locator("[data-confirmar-baja-si]").click();
  await d.locator("[data-baja-hecha]").waitFor({ timeout: 30000 });
  const [e] = await q(`select activo from public.equipo where id = $1`, [equipo]);
  chequear(e.activo === false, "la persona queda dada de baja", "sigue activa");
  chequear((await q(`select 1 from privado.pines_equipo where equipo_id = $1`, [equipo])).length === 0, "se borró su PIN", "su PIN sigue");
  chequear((await q(`select 1 from auth.sessions where user_id = $1`, [data.user.id])).length === 0, "se cortaron sus sesiones (compu y iPhone)", "sus sesiones siguen abiertas");
  const [t] = await q(`select cerrado_en, sin_contar from public.turnos_caja where id = $1`, [turno]);
  chequear(t.cerrado_en && t.sin_contar, "su turno de caja quedó cerrado, sin contar, a su nombre", JSON.stringify(t));
  chequear((await q(`select 1 from public.equipo where id = $1`, [equipo])).length === 1 && (await q(`select 1 from public.turnos_caja where id = $1`, [turno])).length === 1,
    "el historial queda (la persona y su turno siguen en la base)", "se borró historial");
  chequear((await q(`select 1 from public.alertas_seguridad where equipo_id = $1 and tipo = 'baja_equipo'`, [equipo])).length === 1, "queda la alerta de la baja para el dueño", "no hay alerta de baja");

  // ── Ya no entra: ni con la sesión que tenía ni con su contraseña ──
  await compu.goto(`${G}/panel`);
  const cerrada = await esperarHasta(async () => /\/ingresar/.test(compu.url()) || await compu.getByText("No tenés acceso a este gimnasio").count() > 0, 30000);
  chequear(cerrada, "con la sesión que tenía, ya no ve el panel", `sigue adentro: ${compu.url()}`);
  const nueva = await pagina(b, COMPU);
  await entrar(nueva, MAIL).catch(() => {});
  await nueva.goto(`${G}/panel`);
  const sinAcceso = await esperarHasta(async () => /\/ingresar/.test(nueva.url()) || await nueva.getByText("No tenés acceso a este gimnasio").count() > 0, 30000);
  chequear(sinAcceso, "volviendo a entrar con su contraseña, tampoco hay panel", `entró al panel: ${nueva.url()}`);

  // ── Dos pasos: la pantalla está; con un factor verificado y sin aal2, exportar pide confirmar el código ──
  await d.goto(`${G}/panel/cuenta`);
  await d.locator("[data-dos-pasos]").waitFor({ timeout: 60000 });
  ok("Mi cuenta tiene la sección de verificación en dos pasos");
  const pedir = () => d.context().request.get(`${G}/panel/exportar`, { maxRedirects: 0 });
  const sin = await pedir();
  chequear(sin.status() === 200 && /zip/.test(sin.headers()["content-type"] ?? ""), "sin dos pasos activos, la dueña exporta como siempre (zip)", `estado ${sin.status()}`);
  [{ id: factor }] = await q(`insert into auth.mfa_factors (user_id, factor_type, status) values ($1, 'totp', 'verified') returning id`, [duenaUsuario]);
  const con = await pedir();
  chequear(con.status() === 303 && /\/panel\/cuenta/.test(con.headers().location ?? ""), "con dos pasos activos y sin confirmar el código, exportar lleva a confirmarlo", `estado ${con.status()} ${con.headers().location ?? ""}`);
  await q(`delete from auth.mfa_factors where id = $1`, [factor]); factor = null;

  // ── Celular 390 px: sin desbordes ──
  const c = await pagina(b, CELU);
  await entrar(c, "duena@ejemplo.invalid");
  for (const ruta of ["/panel/cuenta", "/panel/equipo"]) {
    await c.goto(`${G}${ruta}`);
    await c.locator("main h1, h1").first().waitFor({ timeout: 60000 });
    const desborde = await c.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    chequear(!desborde, `en el celular ${ruta} no se desborda`, `en el celular ${ruta} hay scroll horizontal`);
  }
  for (const p of [d, c]) if (p.errores.length) falla(`${p.url()}: ${p.errores.join(" | ")}`);
} finally {
  if (factor) await q(`delete from auth.mfa_factors where id = $1`, [factor]).catch(() => {});
  await db.end().catch(() => {});
  await b.close();
}
resultado();
