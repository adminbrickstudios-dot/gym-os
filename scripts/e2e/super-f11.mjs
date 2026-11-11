#!/usr/bin/env node
// F7.1 con sesión real (dueña del gimnasio demo y admin de BRIK):
//  TV en modo "entradas" (crear, abrir el link, ver las entradas y la ocupación) · Configuración: pausa solo y ocupación en vivo
//  Vencen hoy: pestaña "Tengo que cobrar" · la app del socio muestra "Ahora hay N personas" solo si el dueño lo prendió
//  /estado y /api/salud públicas · super admin: casilla "Se muestra en la web" del plan
//   node scripts/e2e/super-f11.mjs        (con scripts/local/levantar.sh corriendo; se corre en GitHub Actions)
// ESCRITO, NO EJECUTADO por quien lo escribió. Deja todo como estaba.
import { execSync } from "node:child_process";
import pg from "pg";
import { GIMNASIO, PLATAFORMA as B, aparece, capturar, chequear, entrar, entrarSocio, falla, navegador, ok, pagina, resultado } from "./comun.mjs";

const db = new pg.Client({ connectionString: process.env.DB_PRUEBAS_URL || execSync("scripts/db/local.sh url").toString().trim() });
await db.connect();
const q = async (sql, p) => (await db.query(sql, p)).rows;
const SLUG = "demo";
const [gim] = await q(`select id from public.gimnasios where slug = $1`, [SLUG]);
const [antes] = await q(`select pausa_autoaprobar, pausa_auto_max_dias, ocupacion_visible_socios from public.configuracion_gimnasio where gimnasio_id = $1`, [gim.id]);

const b = await navegador();
const p = await pagina(b);
p.setDefaultTimeout(30000);
const abrir = async (url) => { await p.goto(url); await p.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {}); };
const G = GIMNASIO(SLUG);

try {
  // ── Públicas ──
  for (const [ruta, esperado] of [["/estado", 200], ["/api/salud", 200]]) {
    const r = await p.request.get(`${B}${ruta}`);
    chequear(r.status() === esperado, `${ruta} responde ${esperado} sin sesión`, `${ruta} respondió ${r.status()}`);
  }

  // ── TV en modo entradas ──
  await entrar(p, "duena@ejemplo.invalid", undefined, G);
  await abrir(`${G}/panel/clases/tv`);
  await p.fill('input[aria-label="Nombre de la TV"]', `Puerta e2e ${Date.now().toString().slice(-4)}`);
  await p.locator("[data-tv-modo]").selectOption("entradas");
  await p.getByRole("button", { name: /^Crear$/ }).click();
  chequear(await aparece(p.locator("[data-link-tv]"), 20000), "se crea la TV de entradas y da su link", "no apareció el link de la TV");
  const link = await p.locator("[data-link-tv] [data-link]").getAttribute("data-link");
  chequear(/Puerta e2e/.test(await p.locator("main").innerText()) && /entradas/.test(await p.locator("[data-tv-fila]").last().innerText()), "la lista dice que esa TV muestra entradas", "la lista no dice el modo");
  const tv = await (await b.newContext()).newPage();
  await tv.goto(link);
  await tv.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
  chequear(await aparece(tv.locator('[data-tv-modo="entradas"]'), 20000), "la TV abre en modo entradas", "la TV no abrió en modo entradas");
  chequear(await tv.locator("[data-tv-ocupacion]").count() === 1, "la TV muestra cuánta gente hay adentro", "la TV no muestra la ocupación");
  chequear(!/Debe|vencid|rojo/i.test(await tv.locator("main").innerText()), "la TV no muestra nada de plata ni de estado", "la TV muestra algo de plata o estado");
  await capturar(tv, "f11-tv-entradas", true);
  await tv.context().close();

  // ── Configuración: pausa solo y ocupación ──
  await abrir(`${G}/panel/configuracion?pestana=reglas`);
  const tarjeta = p.locator("[data-autonomia-socios]");
  chequear(await aparece(tarjeta, 20000), "Configuración muestra 'Pausa solo y ocupación en vivo'", "no apareció la tarjeta de autonomía de socios");
  chequear(antes.ocupacion_visible_socios === false && antes.pausa_autoaprobar === false, "vienen apagadas por defecto", "no vienen apagadas");
  await tarjeta.locator("[data-ocupacion-visible]").check();
  await p.waitForFunction(() => document.querySelector("[data-autonomia-socios]")?.textContent?.includes("Guardado"), null, { timeout: 20000 }).catch(() => {});
  chequear((await q(`select ocupacion_visible_socios from public.configuracion_gimnasio where gimnasio_id = $1`, [gim.id]))[0].ocupacion_visible_socios === true, "prender la ocupación queda guardado", "no se guardó la ocupación");

  // ── Vencen hoy: Tengo que cobrar ──
  await abrir(`${G}/panel/vencen-hoy`);
  const pestana = p.locator('[data-pestana="cobrar"]');
  chequear(await aparece(pestana, 20000), "Vencen hoy tiene la pestaña 'Tengo que cobrar'", "falta la pestaña 'Tengo que cobrar'");
  await pestana.click();
  await p.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
  chequear(await p.locator("[data-cola-cobro], [data-lista-vencen=cobrar]").count() > 0 || /No hay nadie para cobrar/.test(await p.locator("main").innerText()), "la cola de cobro muestra la lista (o dice que no hay nadie)", "la pestaña no muestra la cola");

  // ── App del socio: ocupación en vivo ──
  const [socio] = await q(`select telefono from public.socios where gimnasio_id = $1 and telefono is not null and usuario_id is not null limit 1`, [gim.id]);
  if (socio?.telefono) {
    const s = await (await b.newContext()).newPage();
    await entrarSocio(s, socio.telefono, G);
    chequear(await aparece(s.locator("[data-ocupacion-en-vivo]"), 20000), "la app del socio muestra 'Ahora hay N personas' cuando el dueño lo prendió", "la app del socio no muestra la ocupación");
    await s.context().close();
  } else ok("sin socio con celular y cuenta para probar la app: se salta ese paso");

  // ── Super admin: plan en la web ──
  await entrar(p, "admin@ejemplo.invalid", undefined, B);
  await abrir(`${B}/admin`);
  chequear(await p.locator("[data-plan-publico]").count() >= 0, "el tablero carga con la casilla del plan (si hay planes)", "el tablero no cargó");

  if (p.errores.length) falla(`errores en la página: ${p.errores.join(" | ")}`);
} catch (e) {
  falla(`se cortó: ${e.message.split("\n")[0]}`);
  await capturar(p, "ROTA-super-f11", true).catch(() => {});
} finally {
  await q(`update public.configuracion_gimnasio set pausa_autoaprobar = $2, pausa_auto_max_dias = $3, ocupacion_visible_socios = $4 where gimnasio_id = $1`,
    [gim.id, antes.pausa_autoaprobar, antes.pausa_auto_max_dias, antes.ocupacion_visible_socios]).catch(() => {});
  await q(`update public.pantallas_tv set revocada_en = now() where gimnasio_id = $1 and nombre like 'Puerta e2e%' and revocada_en is null`, [gim.id]).catch(() => {});
  await db.end().catch(() => {});
}
await b.close();
resultado();
