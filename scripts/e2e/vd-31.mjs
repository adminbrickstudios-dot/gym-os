#!/usr/bin/env node
// VD-31 · Ayuda y onboarding por pantalla: la primera vez que se abre una pantalla sale un globo corto con
// "Entendido"; la segunda no (lo que ya vio se guarda en la BASE, por usuario: se prueba con otro navegador);
// el "?" lo vuelve a mostrar; se apaga en Mi cuenta; la recepción ve su texto; panel y app del socio; 390 px.
// Es el único e2e con los globos prendidos (pagina(..., { conAyuda: true })): los demás los apagan con
// la cookie gymos_sin_ayuda, que la app respeta solo con PERMITIR_SIN_AYUDA=1 (lo pone levantar.sh).
//   node scripts/e2e/vd-31.mjs     (con scripts/local/levantar.sh corriendo)
import { execSync } from "node:child_process";
import pg from "pg";
import { CELU, COMPU, GIMNASIO, capturar, chequear, entrar, navegador, pagina, resultado } from "./comun.mjs";

const G = GIMNASIO();
const url = process.env.DB_PRUEBAS_URL || execSync("scripts/db/local.sh url").toString().trim();
const db = new pg.Client({ connectionString: url }); await db.connect();
const MAILS = ["duena@ejemplo.invalid", "recepcion@ejemplo.invalid", "socio@ejemplo.invalid"];
const olvidar = (mails = MAILS) => db.query(`delete from public.ayudas_usuario where usuario_id in (select id from auth.users where email = any($1))`, [mails]);
const vistasEnBase = async (mail) => (await db.query(`select clave from public.ayudas_usuario a join auth.users u on u.id = a.usuario_id where u.email = $1 and clave not like '\\_%' order by 1`, [mail])).rows.map((r) => r.clave);

const globo = (p, k) => p.locator(`[data-ayuda-globo="${k}"]`);
const sale = (p, k) => globo(p, k).waitFor({ timeout: 10000 }).then(() => true, () => false);
/** El globo NO sale: se espera más que el retardo del componente (0,5 s) antes de dar el "no" por bueno. */
const noSale = async (p, k) => { await p.waitForTimeout(2000); return (await globo(p, k).count()) === 0; };
const sinDesborde = (p) => p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);

const b = await navegador();
try {
  await olvidar();

  // ── Dueña, compu: la primera vez se ve, "Entendido" lo cierra y no vuelve ──
  const d = await pagina(b, COMPU, { conAyuda: true });
  await entrar(d, "duena@ejemplo.invalid");
  await d.goto(`${G}/panel`);
  chequear(await sale(d, "inicio"), "primera vez en Inicio: sale el globo de ayuda", "no salió el globo de Inicio");
  const pos = await globo(d, "inicio").evaluate((e) => getComputedStyle(e).position);
  chequear(!["fixed", "absolute", "sticky"].includes(pos), `el globo va en el flujo de la página (${pos}): no tapa ni intercepta clics`, `el globo flota (${pos})`);
  await capturar(d, "vd31-compu-globo");
  // Con el globo abierto se puede seguir trabajando: un clic en el menú navega.
  await d.locator('a[href="/panel/socios"]').first().click();
  await d.waitForURL(/\/panel\/socios/, { timeout: 30000 });
  chequear(await sale(d, "socios"), "con el globo de Inicio sin cerrar, se navega igual y sale el de Socios", "no salió el de Socios");
  await d.goBack(); await d.waitForURL((u) => u.pathname === "/panel", { timeout: 30000 });
  chequear(await sale(d, "inicio"), "no apretó Entendido: en Inicio vuelve a salir", "el globo de Inicio no volvió");
  await d.locator("[data-ayuda-entendido]").click();
  chequear((await globo(d, "inicio").count()) === 0, "“Entendido” cierra el globo", "el globo no se cerró");
  await d.waitForTimeout(800);
  chequear((await vistasEnBase("duena@ejemplo.invalid")).includes("inicio"), "lo que vio queda guardado en la base (por usuario)", "no quedó en la base");
  await d.reload();
  chequear(await noSale(d, "inicio"), "la segunda vez (recargando) no sale", "salió de nuevo");

  // ── Otro navegador = otro dispositivo: la base manda, no el navegador ──
  const d2 = await pagina(b, COMPU, { conAyuda: true });
  await entrar(d2, "duena@ejemplo.invalid");
  await d2.goto(`${G}/panel`);
  chequear(await noSale(d2, "inicio"), "en otro dispositivo, con la misma cuenta, tampoco sale", "salió en el otro dispositivo");
  chequear(await d2.locator("[data-ayuda-boton]").isVisible(), "el “?” está fijo", "no hay “?”");
  await d2.locator("[data-ayuda-boton]").click();
  chequear(await sale(d2, "inicio"), "el “?” vuelve a mostrar la ayuda", "el “?” no mostró la ayuda");
  await d2.locator("[data-ayuda-entendido]").click();

  // ── Las pantallas importantes ──
  for (const [ruta, clave] of [["/panel/entrada", "entrada"], ["/panel/vencen-hoy", "vencen_hoy"], ["/panel/caja", "caja"], ["/panel/tareas", "tareas"], ["/panel/planes", "planes"], ["/panel/configuracion", "configuracion"], ["/panel/control", "control"]]) {
    await d2.goto(`${G}${ruta}`);
    chequear(await sale(d2, clave), `${ruta}: primera vez, sale la ayuda`, `${ruta}: no salió la ayuda`);
  }

  // ── Mi cuenta: apagar para siempre / volver a ver todo ──
  await d2.goto(`${G}/panel/cuenta`);
  await d2.locator("[data-ajustes-ayuda] input[role=switch]").click();
  await d2.getByText("no te muestro más ayudas solas").waitFor({ timeout: 15000 });
  await d2.goto(`${G}/panel/planes`);
  chequear(await noSale(d2, "planes"), "con las ayudas apagadas no sale nada solo", "salió una ayuda con las ayudas apagadas");
  await d2.locator("[data-ayuda-boton]").click();
  chequear(await sale(d2, "planes"), "apagadas, el “?” igual la muestra", "el “?” no anduvo con las ayudas apagadas");
  await d2.goto(`${G}/panel/cuenta`);
  await d2.locator("[data-ajustes-ayuda] input[role=switch]").click();
  await d2.locator("[data-ayuda-reiniciar]").click();
  await d2.getByText("vas a ver de nuevo la ayuda").waitFor({ timeout: 15000 });
  chequear((await vistasEnBase("duena@ejemplo.invalid")).length === 0, "“Volver a ver todas las ayudas” borra lo visto en la base", "no se borró lo visto");
  await d2.goto(`${G}/panel/planes`);
  chequear(await sale(d2, "planes"), "prendidas y reiniciadas, la ayuda vuelve a salir sola", "no volvió a salir");

  // ── Recepción: ve la suya ──
  const r = await pagina(b, COMPU, { conAyuda: true });
  await entrar(r, "recepcion@ejemplo.invalid");
  await r.goto(`${G}/panel/entrada`);
  chequear(await sale(r, "entrada"), "la recepción ve la ayuda de Entrada", "la recepción no vio la ayuda de Entrada");
  const textoR = await globo(r, "entrada").innerText();
  chequear(/llega alguien/i.test(textoR), `y es la suya: “${textoR.replace(/\s+/g, " ").slice(0, 70)}…”`, `texto de recepción mal: ${textoR}`);
  await r.locator("[data-ayuda-entendido]").click();

  // ── Dueña en el celular, 390 px ──
  await olvidar(["duena@ejemplo.invalid"]);
  const c = await pagina(b, CELU, { conAyuda: true });
  await entrar(c, "duena@ejemplo.invalid");
  await c.goto(`${G}/panel`);
  chequear(await sale(c, "inicio"), "celular: sale la ayuda de Inicio", "celular: no salió");
  chequear(await sinDesborde(c), "celular 390 px: sin desborde con el globo", "celular: desborde con el globo");
  await capturar(c, "vd31-celu-globo");
  await c.locator("[data-ayuda-entendido]").click();
  chequear(await sinDesborde(c), "celular 390 px: sin desborde con el “?”", "celular: desborde con el “?”");

  // ── Socio, app en el celular ──
  await olvidar(["socio@ejemplo.invalid"]);
  const s = await pagina(b, CELU, { conAyuda: true });
  await entrar(s, "socio@ejemplo.invalid");
  await s.goto(`${G}/app`);
  chequear(await sale(s, "app_inicio"), "app del socio: primera vez, sale la ayuda de Inicio", "app: no salió la ayuda de Inicio");
  chequear(await sinDesborde(s), "app 390 px: sin desborde con el globo", "app: desborde con el globo");
  await capturar(s, "vd31-app-globo");
  await s.locator("[data-ayuda-entendido]").click();
  await s.waitForTimeout(800);
  await s.reload();
  chequear(await noSale(s, "app_inicio"), "app: la segunda vez no sale", "app: salió de nuevo");
  await s.locator("[data-ayuda-boton]").click();
  chequear(await sale(s, "app_inicio"), "app: el “?” del encabezado vuelve a mostrarla", "app: el “?” no anduvo");
  await s.locator("[data-ayuda-entendido]").click();
  for (const [ruta, clave] of [["/app/yo", "app_yo"], ["/app/clases", "app_clases"], ["/app/rutina", "app_rutina"]]) {
    await s.goto(`${G}${ruta}`);
    // Clases y Rutina pueden estar apagadas para este gimnasio: sin la pestaña no hay pantalla que ayudar.
    if (new URL(s.url()).pathname === ruta) chequear(await sale(s, clave), `app ${ruta}: sale la ayuda`, `app ${ruta}: no salió`);
  }
  chequear(await sinDesborde(s), "app 390 px: sin desborde en las demás", "app: desborde");
} finally {
  await db.end();
  await b.close();
}
resultado();
