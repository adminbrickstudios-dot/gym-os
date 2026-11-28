#!/usr/bin/env node
// Interesados desde el menú (Mateo, 27/11: "Interesados no anda"). El camino que usa la gente, no la dirección escrita:
//   Menú → Socios → Interesados, y /panel/prospectos → /panel/socios?vista=interesados.
// Dueña y recepción, compu y celular. Con la llave pase_2_organizacion apagada (como Temple Gym) y prendida (los [demo]).
// En cada caso: se llega a la lista de Interesados (data-prospectos), la pestaña Interesados queda marcada y se QUEDA
// ahí (nada la devuelve a Todos), y la pantalla no está rota.
//   node scripts/e2e/interesados-menu.mjs     (con scripts/local/levantar.sh corriendo)
import { CELU, COMPU, GIMNASIO, PANTALLA_ROTA, capturar, chequear, entrar, navegador, pagina, resultado } from "./comun.mjs";
process.on("unhandledRejection", (e) => { console.log(`✗ se cortó (sin atrapar): ${String(e?.message ?? e).split("\n").slice(0, 3).join(" | ")}`); process.exit(1); });

const G = GIMNASIO();
const b = await navegador();

/** Está en Interesados y se queda: la lista dibujada, la URL con vista=interesados 2 s después. */
async function enInteresados(p, quien) {
  const lista = await p.locator("[data-prospectos]").first().waitFor({ timeout: 30000 }).then(() => true, () => false);
  await p.waitForTimeout(2000);
  const url = new URL(p.url());
  const texto = await p.locator("main").innerText().catch(() => "");
  const enVista = url.searchParams.get("vista") === "interesados" || url.searchParams.get("pestana") === "prospectos";
  chequear(lista && enVista && !PANTALLA_ROTA.test(texto), `${quien}: llega a Interesados y se queda (${url.pathname}${url.search})`,
    `${quien}: no queda en Interesados: ${url.pathname}${url.search} · lista ${lista ? "sí" : "no"} · ${texto.slice(0, 160).replace(/\s+/g, " ")}`);
}

try {
  for (const [mail, rol] of [["duena@ejemplo.invalid", "dueña"], ["recepcion@ejemplo.invalid", "recepción"]]) {
    // ── Compu ──
    const d = await pagina(b, COMPU);
    await entrar(d, mail);
    // Antes, una vuelta por Socios con un filtro: así la lista tiene memoria (como cualquiera que usó el panel).
    await d.goto(`${G}/panel/socios?estado=al_dia`);
    await d.locator("[data-lista]").first().waitFor({ timeout: 30000 }).catch(() => {});
    await d.goto(`${G}/panel`);
    const menu = d.locator('aside nav[aria-label="Secciones"]');
    await menu.waitFor({ timeout: 30000 });
    // Lo que ya andaba (VD-15) sigue: Menú → Socios, sin tocar otra cosa, vuelve al filtro de antes.
    await menu.locator('a[href^="/panel/bloque/socios"], a[href="/panel/socios"]').first().click();
    const volvio = await d.waitForURL(/estado=al_dia/, { timeout: 20000 }).then(() => true, () => false);
    chequear(volvio, `${rol} compu: Menú → Socios vuelve al filtro de antes`, `${rol} compu: Menú → Socios no volvió al filtro (${d.url()})`);
    await d.goto(`${G}/panel`);
    await menu.waitFor({ timeout: 30000 });
    // Con la llave: el bloque Socios y su pestaña; sin la llave: la entrada Interesados del menú.
    const directa = menu.locator('a[href="/panel/prospectos"]');
    if (await directa.count()) {
      await directa.first().click();
    } else {
      await menu.locator('a[href^="/panel/bloque/socios"], a[href="/panel/socios"]').first().click();
      await d.locator('[data-pestanas-bloque] a, [data-pestanas-socios] a', { hasText: "Interesados" }).first().click();
    }
    await enInteresados(d, `${rol} compu (menú)`);
    // La pestaña Interesados de Socios, desde Todos.
    await d.goto(`${G}/panel/socios`);
    await d.locator('[data-pestanas-bloque] a, [data-pestanas-socios] a', { hasText: "Interesados" }).first().click();
    await enInteresados(d, `${rol} compu (pestaña)`);
    // Con la base lejos (producción): la vuelta a los filtros guardados tarda, y la persona ya tocó Interesados.
    // Se demora a propósito lo que pide esa vuelta (el filtro guardado, estado=al_dia) y se toca Interesados enseguida.
    await d.route(/estado=al_dia/, async (r) => { await new Promise((ok) => setTimeout(ok, 3000)); await r.continue().catch(() => {}); });
    await d.goto(`${G}/panel`);
    await d.goto(`${G}/panel/socios`);
    await d.locator('[data-pestanas-bloque] a, [data-pestanas-socios] a', { hasText: "Interesados" }).first().click();
    await d.waitForTimeout(4000);
    await enInteresados(d, `${rol} compu (pestaña, con la base lenta)`);
    await d.unroute(/estado=al_dia/);
    // 28/11 (menú viejo, producción): TODO viaje al servidor tarda (Supabase lejos). Menú → Socios con memoria: la lista llega y pide volver
    // al filtro de antes (un viaje lento); la persona ve las pestañas y toca Interesados antes de que vuelva. Tiene que quedar en Interesados.
    await d.goto(`${G}/panel`);
    await menu.waitFor({ timeout: 30000 });
    await d.route(/_rsc=|\/panel\/socios/, async (r) => { await new Promise((ok) => setTimeout(ok, 1500)); await r.continue().catch(() => {}); });
    await menu.locator('a[href^="/panel/bloque/socios"], a[href="/panel/socios"]').first().click();
    const pestanaLenta = d.locator('[data-pestanas-bloque] a, [data-pestanas-socios] a', { hasText: "Interesados" }).first();
    await pestanaLenta.waitFor({ timeout: 30000 });
    await pestanaLenta.click();
    await d.waitForTimeout(6000);
    await enInteresados(d, `${rol} compu (Menú → Socios → Interesados, todo lento)`);
    await d.unroute(/_rsc=|\/panel\/socios/);
    // La dirección vieja.
    await d.goto(`${G}/panel/prospectos`);
    await enInteresados(d, `${rol} compu (/panel/prospectos)`);
    await capturar(d, `interesados-${rol === "dueña" ? "duena" : "recepcion"}-compu`);
    await d.close();

    // ── Celular ──
    const c = await pagina(b, CELU);
    await entrar(c, mail);
    await c.goto(`${G}/panel/socios?estado=al_dia`);
    await c.locator("[data-lista]").first().waitFor({ timeout: 30000 }).catch(() => {});
    await c.goto(`${G}/panel`);
    const barra = c.locator('nav[aria-label="Principales"]');
    await barra.waitFor({ timeout: 30000 });
    await barra.locator("button").last().click();
    const hoja = c.locator('[role="dialog"]:not([data-nextjs-dialog]):visible').last();
    await hoja.waitFor({ timeout: 10000 });
    const enHoja = hoja.locator('a[href="/panel/prospectos"]');
    if (await enHoja.count()) await enHoja.first().click();
    else {
      await hoja.locator('a[href^="/panel/bloque/socios"], a[href="/panel/socios"]').first().click();
      await c.locator('[data-pestanas-bloque] a, [data-pestanas-socios] a', { hasText: "Interesados" }).first().click();
    }
    await enInteresados(c, `${rol} celular (menú)`);
    await c.goto(`${G}/panel/prospectos`);
    await enInteresados(c, `${rol} celular (/panel/prospectos)`);
    await capturar(c, `interesados-${rol === "dueña" ? "duena" : "recepcion"}-celu`);
    await c.close();
  }
} finally {
  await b.close().catch(() => {});
}
resultado();
