#!/usr/bin/env node
// Fase U3 · Cada cuenta entra SOLO a su gimnasio. La dueña de A (demo) intenta entrar al gimnasio B (demo-box) por las cuatro vías:
//   1) la dirección de B (demo-box.localhost)      2) /g/demo-box en la dirección de la plataforma
//   3) cambiando la cookie del gimnasio elegido     4) llamando a las funciones de la base con el id de B (con su sesión real)
// En ninguna ve contenido de B: o "No tenés acceso a este gimnasio" o vuelve a ingresar. Además: el dueño de B tampoco ve el A, y el mismo mail
// no es del equipo de los dos gimnasios (solo si el super admin lo da de alta en los dos).
//   node scripts/e2e/fase-u3.mjs     (con scripts/local/levantar.sh corriendo; se corre en GitHub Actions)
import { execSync } from "node:child_process";
import pg from "pg";
import { CLAVE_DEMO, COMPU, GIMNASIO, PLATAFORMA, capturar, chequear, entrar, falla, navegador, ok, pagina, resultado } from "./comun.mjs";

const GA = GIMNASIO("demo"), GB = GIMNASIO("demo-box");
const url = process.env.DB_PRUEBAS_URL || execSync("scripts/db/local.sh url").toString().trim();
const db = new pg.Client({ connectionString: url });
await db.connect();
const q = async (sql, params) => (await db.query(sql, params)).rows;
const [A] = await q(`select id, nombre from public.gimnasios where slug = 'demo'`);
const [Bg] = await q(`select id, nombre from public.gimnasios where slug = 'demo-box'`);
const sociosB = (await q(`select nombre, apellido from public.socios where gimnasio_id = $1 limit 5`, [Bg.id])).map((s) => s.nombre);
const MAIL_A = "duena@ejemplo.invalid", MAIL_B = "box@ejemplo.invalid";

// Lo que dice una pantalla del panel de B vista con la sesión de A.
const PANTALLAS = ["/panel", "/panel/socios", "/panel/caja", "/panel/resultado", "/panel/configuracion", "/panel/equipo", "/panel/control"];
async function sinContenidoAjeno(p, base, nombreAjeno, socios, etiqueta) {
  for (const ruta of PANTALLAS) {
    await p.goto(`${base}${ruta}`, { waitUntil: "domcontentloaded" });
    await p.waitForLoadState("networkidle").catch(() => {});
    const texto = (await p.locator("body").innerText()).replace(/\s+/g, " ");
    const enIngreso = /\/ingresar/.test(p.url());
    const sinAcceso = /No tenés acceso a (este gimnasio|esta pantalla)/.test(texto);
    const filtra = !enIngreso && (texto.includes(nombreAjeno) || socios.some((n) => n.length > 3 && texto.includes(n)));
    chequear((enIngreso || sinAcceso) && !filtra, `${etiqueta} ${ruta}: ${enIngreso ? "pide ingresar" : "“No tenés acceso”"} y no muestra nada del otro gimnasio`,
      `${etiqueta} ${ruta}: ${texto.slice(0, 160)}…`);
  }
}

const b = await navegador();
try {
  // ── Control positivo: la dueña de A entra a SU panel ──
  const p = await pagina(b, COMPU);
  p.setDefaultNavigationTimeout(120000);
  await entrar(p, MAIL_A);
  await p.goto(`${GA}/panel`);
  await p.locator("h1").first().waitFor({ timeout: 60000 });
  ok("la dueña de A entra a su propio panel");

  // ── Vía 1: la dirección de B ──
  // Su sesión es de la dirección de A; en la de B intenta ingresar con el mismo mail y contraseña.
  await p.goto(`${GB}/ingresar`);
  await p.fill("input[type=email]", MAIL_A);
  await p.fill("input[type=password]", CLAVE_DEMO);
  await p.click("button[type=submit]");
  await p.waitForTimeout(6000);   // entra al panel de B (y la pantalla dice que no tiene acceso) o el ingreso la rechaza: las dos están bien
  await sinContenidoAjeno(p, GB, Bg.nombre, sociosB, "vía 1 (dirección de B)");
  await capturar(p, "u3-via1-direccion-de-b");

  // ── Vías 2 y 3: la dirección de la plataforma ──
  const c = await pagina(b, COMPU);
  c.setDefaultNavigationTimeout(120000);
  await c.goto(`${PLATAFORMA}/g/demo/ingresar`);                 // elige el gimnasio A y pide ingresar
  await c.waitForURL(/\/ingresar/, { timeout: 60000 });
  await c.fill("input[type=email]", MAIL_A);
  await c.fill("input[type=password]", CLAVE_DEMO);
  await c.click("button[type=submit]");
  await c.waitForURL((u) => !u.pathname.startsWith("/ingresar"), { timeout: 60000 });
  await c.goto(`${PLATAFORMA}/panel`);
  await c.locator("h1").first().waitFor({ timeout: 60000 });
  ok("en la dirección de la plataforma, con el gimnasio A elegido, la dueña ve su panel");

  await c.goto(`${PLATAFORMA}/g/demo-box/panel`, { waitUntil: "domcontentloaded" });   // vía 2: /g/<slug-de-B>
  await sinContenidoAjeno(c, PLATAFORMA, Bg.nombre, sociosB, "vía 2 (/g/demo-box)");
  await capturar(c, "u3-via2-g-demo-box");

  await c.context().clearCookies({ name: "gymos_gimnasio" });
  await c.context().addCookies([{ name: "gymos_gimnasio", value: "demo-box", url: PLATAFORMA, httpOnly: true, sameSite: "Lax" }]);   // vía 3: cookie cambiada a mano
  await sinContenidoAjeno(c, PLATAFORMA, Bg.nombre, sociosB, "vía 3 (cookie cambiada)");
  await c.goto(`${PLATAFORMA}/elegir`, { waitUntil: "domcontentloaded" });
  chequear(!(await c.locator("body").innerText()).includes(Bg.nombre), "“Elegir gimnasio” solo lista los gimnasios de la cuenta (no el B)", "“Elegir gimnasio” lista el gimnasio B");
  await capturar(c, "u3-via3-cookie");

  // ── Vía 4: las funciones de la base con el id de B, con la sesión real de A ──
  const claves = Object.fromEntries(execSync("node scripts/local/supabase-local.mjs claves").toString().trim().split("\n").map((l) => l.split(/=(.*)/s).slice(0, 2)));
  const SUPA = `http://127.0.0.1:${process.env.PUERTO_SUPABASE ?? "54321"}`;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || claves.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const sesion = await (await fetch(`${SUPA}/auth/v1/token?grant_type=password`, { method: "POST", headers: { apikey: anon, "content-type": "application/json" }, body: JSON.stringify({ email: MAIL_A, password: CLAVE_DEMO }) })).json();
  chequear(!!sesion.access_token, "la dueña de A tiene una sesión real contra la base", `sin sesión: ${JSON.stringify(sesion).slice(0, 120)}`);
  const [socioB] = await q(`select id from public.socios where gimnasio_id = $1 limit 1`, [Bg.id]);
  const [sedeB] = await q(`select id from public.sedes where gimnasio_id = $1 limit 1`, [Bg.id]);
  const rpc = async (nombre, args, token = sesion.access_token) => {
    const r = await fetch(`${SUPA}/rest/v1/rpc/${nombre}`, { method: "POST", headers: { apikey: anon, authorization: `Bearer ${token}`, "content-type": "application/json" }, body: JSON.stringify(args) });
    return { status: r.status, cuerpo: await r.text() };
  };
  for (const [nombre, args] of [
    ["panel_gimnasio", { p_gimnasio_id: Bg.id }],
    ["buscar_socios", { p_gimnasio_id: Bg.id, p_texto: "" }],
    ["ficha_socio", { p_socio_id: socioB.id }],
    ["equipo_gimnasio", { p_gimnasio_id: Bg.id }],
    ["resultado_mes", { p_gimnasio_id: Bg.id }],
    ["linea_de_control", { p_gimnasio_id: Bg.id, p_tipos: null, p_desde: "2026-01-01", p_hasta: "2026-12-31", p_quien: null, p_limite: 10, p_cursor: null }],
    ["historial_caja", { p_sede_id: sedeB.id, p_limite: 10 }],
    ["configuracion_panel", { p_gimnasio_id: Bg.id }],
    ["exportar_socios", { p_gimnasio_id: Bg.id, p_texto: "", p_etiqueta: null }],
  ]) {
    const r = await rpc(nombre, args);
    const fuga = r.status < 300 && (r.cuerpo.includes(Bg.nombre) || sociosB.some((n) => n.length > 3 && r.cuerpo.includes(n)));
    chequear(r.status >= 400 && r.status !== 404 && !fuga, `vía 4: ${nombre} con el id de B → ${r.status} (sin datos)`, `vía 4: ${nombre} con el id de B respondió ${r.status}: ${r.cuerpo.slice(0, 120)}`);
  }
  // Y a la inversa: el dueño de B no ve el A (por la misma vía directa).
  const sesionB = await (await fetch(`${SUPA}/auth/v1/token?grant_type=password`, { method: "POST", headers: { apikey: anon, "content-type": "application/json" }, body: JSON.stringify({ email: MAIL_B, password: CLAVE_DEMO }) })).json();
  const r2 = await rpc("panel_gimnasio", { p_gimnasio_id: A.id }, sesionB.access_token);
  chequear(r2.status >= 400, `el dueño de B llamando panel_gimnasio con el id de A → ${r2.status}`, `el dueño de B vio el A: ${r2.cuerpo.slice(0, 120)}`);

  // ── El mismo mail solo es del equipo de dos gimnasios si el super admin lo dio de alta en los dos ──
  const equipos = await q(`select g.slug from public.equipo e join auth.users u on u.id = e.usuario_id join public.gimnasios g on g.id = e.gimnasio_id where lower(u.email) = $1 and e.activo and not e.es_soporte`, [MAIL_A]);
  chequear(equipos.length === 1 && equipos[0].slug === "demo", `la dueña de A es del equipo de un solo gimnasio (${equipos.map((e) => e.slug).join(", ")})`, `la dueña de A es del equipo de: ${equipos.map((e) => e.slug).join(", ")}`);

  for (const [n, x] of [["vía 1", p], ["vías 2 y 3", c]]) {
    const reales = x.errores.filter((e) => !/HTTP 40[13] /.test(e));
    if (reales.length) falla(`${n}: errores de página: ${reales.join(" | ")}`);
  }
} catch (e) {
  falla(`se cortó: ${process.env.E2E_DEPURAR ? e.stack : e.message.split("\n")[0]}`);
}
await b.close();
await db.end();
resultado();
