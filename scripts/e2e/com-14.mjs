#!/usr/bin/env node
// COM-14 · TV de la sala: la dueña crea la TV en Clases → 📺 y recibe el link
// → se abre una vez en la TV (sin sesión) y muestra la clase de ahora con el
// WOD → alguien se anota y aparece solo en la TV, con nombre grande. Deja
// todo como estaba.
//   npm run e2e:com-14           (con scripts/local/levantar.sh corriendo)
import { execSync } from "node:child_process";
import pg from "pg";
import { COMPU, GIMNASIO, aparece, capturar, chequear, entrar, falla, navegador, pagina, resultado } from "./comun.mjs";

const G = GIMNASIO();
const s = Date.now().toString().slice(-5);
const NOMBRE_TV = `Sala e2e ${s}`;
const db = new pg.Client({ connectionString: process.env.DB_PRUEBAS_URL || execSync("scripts/db/local.sh url").toString().trim() });
await db.connect();
const [{ id: gim }] = (await db.query(`select id from public.gimnasios where slug = 'demo'`)).rows;
const [{ id: sede }] = (await db.query(`select id from public.sedes where gimnasio_id = $1 and activa order by es_principal desc, nombre limit 1`, [gim])).rows;
const [{ id: act }] = (await db.query(`select id from public.actividades where gimnasio_id = $1 and activa order by nombre limit 1`, [gim])).rows;
// Una clase en curso que empezó antes que cualquier otra: es "la de ahora" para la TV.
const [{ id: clase }] = (await db.query(`insert into public.clases (gimnasio_id, sede_id, actividad_id, inicio, fin, cupo, wod)
  values ($1,$2,$3, now() - interval '4 hours', now() + interval '40 minutes', 20, $4) returning id`, [gim, sede, act, `WOD e2e ${s}: 5x5 sentadilla`])).rows;
const [socio] = (await db.query(`select id, nombre, apellido from public.socios where gimnasio_id = $1 and dado_de_baja_en is null order by numero limit 1`, [gim])).rows;
const esperado = `${socio.nombre} ${socio.apellido ? socio.apellido[0] + "." : ""}`.trim();
const b = await navegador();
try {
  const d = await pagina(b, COMPU);
  d.setDefaultNavigationTimeout(120000);
  await entrar(d, "duena@ejemplo.invalid");
  await d.goto(`${G}/panel/clases`);
  await d.locator("[data-ir-tv]").click();
  await d.waitForURL(/\/panel\/clases\/tv/, { timeout: 60000 });
  await d.locator('input[aria-label="Nombre de la TV"]').fill(NOMBRE_TV);
  await d.locator('[data-nueva-tv] button[type="submit"]').click();
  const link = await d.locator("[data-link-tv] code").getAttribute("data-link", { timeout: 30000 });
  chequear(/\/tv\/activar\?t=/.test(link ?? "") && await aparece(d.locator(`[data-tv-fila="${NOMBRE_TV}"]`), 30000), `la dueña crea “${NOMBRE_TV}” y recibe el link para abrir en la TV`, link ?? "sin link");

  // La TV: otro navegador, sin sesión de nadie.
  const ctx = await b.newContext({ viewport: { width: 1920, height: 1080 } });
  const tv = await ctx.newPage();
  tv.setDefaultNavigationTimeout(120000);
  await tv.goto(link);
  await tv.waitForURL(/\/tv$/, { timeout: 60000 });
  const ahora = tv.locator(`[data-tv-ahora="${clase}"]`);
  chequear(await aparece(ahora, 60000) && (await tv.locator("[data-tv-wod]").innerText()).includes(`WOD e2e ${s}`), "la TV abre sin sesión: la clase de ahora y su WOD en grande", await tv.locator("main").innerText());
  const antes = Number(await tv.locator("[data-tv-anotados]").getAttribute("data-tv-anotados"));
  await db.query(`insert into public.reservas (gimnasio_id, clase_id, socio_id, estado) values ($1,$2,$3,'confirmada')`, [gim, clase, socio.id]);
  chequear(await aparece(tv.locator("[data-tv-anotados] li", { hasText: esperado }), 40000), `se anota alguien y aparece solo en la TV: “${esperado}” (sin tocar nada, en menos de 40 s)`, `seguía con ${antes} anotados`);
  // Auditoría 18/11 · Vista de lejos: en la TV de 1920×1080 ningún texto de la pantalla baja de 20 px y el WOD y los nombres son grandes; en una tablet (1024×768, 820×1180) no desborda.
  const medidas = await tv.evaluate(() => {
    const px = (e) => parseFloat(getComputedStyle(e).fontSize);
    const chicos = [...document.querySelectorAll("main *")].filter((e) => e.childNodes.length && [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()) && e.getBoundingClientRect().width > 0 && px(e) < 20).map((e) => `${e.textContent.trim().slice(0, 30)} (${px(e)}px)`);
    return { chicos, wod: px([...document.querySelectorAll("[data-tv-wod] *")].find((e) => [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) ?? document.querySelector("[data-tv-wod]")), nombre: px(document.querySelector("[data-tv-anotados] li")) };
  });
  chequear(medidas.chicos.length === 0, "TV de lejos: ningún texto baja de 20 px", `textos chicos en la TV: ${medidas.chicos.join(" | ")}`);
  chequear(medidas.nombre >= 20 && medidas.wod >= 20, `TV de lejos: nombres ${medidas.nombre}px y WOD ${medidas.wod}px`, `nombres ${medidas.nombre}px, WOD ${medidas.wod}px`);
  for (const [w, h] of [[1024, 768], [820, 1180]]) {
    await tv.setViewportSize({ width: w, height: h });
    await tv.locator("[data-tv-wod]").waitFor({ timeout: 15000 });
    const desborda = await tv.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    chequear(desborda <= 0, `tablet ${w}×${h}: la TV no desborda`, `tablet ${w}×${h}: desborda ${desborda}px`);
  }
  await tv.setViewportSize({ width: 1920, height: 1080 });
  await capturar(tv, "com14-tv");
  await ctx.close();
  if (d.errores.length) falla(d.errores.join(" | "));
} catch (e) {
  falla(`se cortó: ${process.env.E2E_DEPURAR ? e.message : e.message.split("\n")[0]}`);
} finally {
  await db.query(`update public.reservas set estado = 'cancelada', cancelada_en = now(), cancelada_por = 'equipo' where clase_id = $1 and estado <> 'cancelada'`, [clase]).catch(() => {});
  await db.query(`update public.clases set cancelada_en = now(), cancelada_motivo = 'Prueba e2e' where id = $1`, [clase]).catch(() => {});
  await db.query(`update public.pantallas_tv set revocada_en = now() where gimnasio_id = $1 and nombre = $2 and revocada_en is null`, [gim, NOMBRE_TV]).catch(() => {});
  await db.end();
}
await b.close();
resultado();
