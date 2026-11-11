#!/usr/bin/env node
// P8 · WEB-01 a 05: la landing de un gimnasio se ve profesional con CERO configuración, y Google la entiende.
//   1. Gimnasio recién creado, sin cargar nada (solo nombre y color): portada tipográfica fuerte, sin huecos (ninguna sección vacía),
//      con "Soy socio", "Quiero ser socio" y "Soy del equipo"; celular 390 px sin desborde; sin imágenes rotas; sin emojis de ícono.
//   2. Con planes, horarios y dirección aparecen sus bloques.
//   3. Google: título con el nombre, descripción, imagen para compartir, favicon, datos estructurados, sitemap y robots POR gimnasio.
//   4. 404 con el estilo del gimnasio.
//   node scripts/e2e/web-p8.mjs     (con scripts/local/levantar.sh corriendo)
// Crea un gimnasio directo en la base y lo mira por direcciones distintas por etapa (la landing se guarda 60 s en caché por dirección).
// ESCRITO, NO EJECUTADO por quien lo escribió.
import { execSync } from "node:child_process";
import pg from "pg";
import { CELU, COMPU, chequear, falla, navegador, pagina, resultado, PUERTO } from "./comun.mjs";
process.on("unhandledRejection", (e) => { console.log(`✗ se cortó (sin atrapar): ${String(e?.message ?? e).split("\n").slice(0, 3).join(" | ")}`); process.exit(1); });

const url = process.env.DB_PRUEBAS_URL || execSync("scripts/db/local.sh url").toString().trim();
const db = new pg.Client({ connectionString: url });
await db.connect();
const slug = `p8-${Date.now() % 1000000}`;
const NOMBRE = `Gimnasio P8 ${slug.slice(3)}`;
const ACENTO = "#0ea5e9";
const DIR = (n) => `http://${n}-${slug}.localhost:${PUERTO}`;
const [{ id: gim }] = (await db.query(`insert into public.gimnasios (slug, nombre) values ($1, $2) returning id`, [slug, NOMBRE])).rows;
for (const n of ["a", "b", "c", "d"]) await db.query(`insert into public.dominios_gimnasio (gimnasio_id, host, tipo) values ($1, $2, 'subdominio') on conflict do nothing`, [gim, `${n}-${slug}.localhost`]);
await db.query(`update public.configuracion_gimnasio set color_acento = $2 where gimnasio_id = $1`, [gim, ACENTO]);
const EMOJI = /\p{Extended_Pictographic}/u;
const meta = async (p, prop) => p.locator(`meta[property="${prop}"], meta[name="${prop}"]`).first().getAttribute("content").catch(() => null);

const b = await navegador();
try {
  // ── 1 · Cero configuración, en el celular ──
  const p = await pagina(b, CELU);
  await p.goto(`${DIR("a")}/`);
  await p.locator("h1").first().waitFor({ timeout: 60000 });
  chequear((await p.locator("h1").first().innerText()).trim().length > 0, "la portada tiene un título (el nombre del gimnasio)", "la portada no tiene título");
  const tam = await p.locator("h1").first().evaluate((h) => parseFloat(getComputedStyle(h).fontSize));
  chequear(tam >= 48, `portada tipográfica fuerte: el título mide ${Math.round(tam)} px en el celular`, `el título es chico (${Math.round(tam)} px)`);
  chequear((await p.content()).toLowerCase().includes(ACENTO), "usa el color del gimnasio", "no usa el color del gimnasio");
  const vacias = await p.locator("section[aria-labelledby]").evaluateAll((xs) => xs.filter((s) => s.innerText.trim().length < 8).map((s) => s.getAttribute("aria-labelledby")));
  chequear(vacias.length === 0, "sin huecos: ninguna sección vacía", `secciones vacías: ${vacias.join(", ")}`);
  chequear(await p.locator('a[href="/hacete-socio"]').count() > 0 && await p.locator('a[href="/ingresar?modo=socio"]').count() > 0, "“Quiero ser socio” y “Soy socio”", "faltan los botones de socio");
  chequear(await p.locator('footer a[href="/ingresar"]').count() > 0, "“Soy del equipo” chico al pie", "falta “Soy del equipo” al pie");
  const ancho = await p.evaluate(() => ({ s: document.documentElement.scrollWidth, w: window.innerWidth }));
  chequear(ancho.s <= ancho.w + 1, `celular 390 px sin desborde horizontal (${ancho.s} ≤ ${ancho.w})`, `desborde horizontal: ${ancho.s} > ${ancho.w}`);
  const rotas = await p.locator("img").evaluateAll((xs) => xs.filter((i) => i.complete && i.naturalWidth === 0 && i.src).map((i) => i.src));
  chequear(rotas.length === 0, "ninguna imagen rota", `imágenes rotas: ${rotas.join(" ")}`);
  const cuerpo = await p.locator("body").innerText();
  chequear(!EMOJI.test(cuerpo), "sin emojis como íconos (son íconos de línea)", `quedan emojis en la página: ${cuerpo.match(EMOJI)?.[0]}`);
  chequear(!/armando|en construcci/i.test(cuerpo), "nunca “armando” ni “en construcción”", "dice “armando” o “en construcción”");
  await p.screenshot({ path: ".local/capturas/p8-celu-sin-datos.png", fullPage: true }).catch(() => {});

  // ── 3 · Google ──
  chequear((await p.title()).includes(NOMBRE), "el título de la pestaña lleva el nombre", `título: ${await p.title()}`);
  chequear(((await meta(p, "description")) ?? "").length > 10, "tiene descripción", "no tiene descripción");
  chequear(/\/og|\.(png|jpe?g|webp)/i.test((await meta(p, "og:image")) ?? ""), "tiene imagen para compartir (og:image)", "no tiene og:image");
  chequear(await p.locator('link[rel~="icon"]').count() > 0, "tiene favicon", "no tiene favicon");
  const ld = await p.locator('script[type="application/ld+json"]').allInnerTexts();
  chequear(ld.some((t) => { try { return [].concat(JSON.parse(t)["@type"]).includes("ExerciseGym"); } catch { return false; } }), "datos estructurados ExerciseGym", "sin datos estructurados");
  chequear((await p.locator("html").getAttribute("lang")) === "es-AR", "html lang es-AR", "html sin lang es-AR");
  const sm = await p.request.get(`${DIR("a")}/sitemap.xml`);
  const smt = await sm.text();
  chequear(sm.ok() && smt.includes(`${DIR("a")}/`), "sitemap.xml de ESTE gimnasio con su página", `sitemap: ${sm.status()} ${smt.slice(0, 80)}`);
  const rb = await (await p.request.get(`${DIR("a")}/robots.txt`)).text();
  chequear(/Disallow: \/panel/.test(rb) && rb.includes(`${DIR("a")}/sitemap.xml`), "robots.txt por gimnasio: no indexa el panel y apunta a su sitemap", `robots: ${rb.slice(0, 120)}`);

  // ── 4 · 404 con el estilo del gimnasio ──
  const r404 = await p.goto(`${DIR("a")}/no-existe-${Date.now() % 1000}`);
  chequear(r404.status() === 404 && await p.locator("[data-404-gimnasio]").count() === 1 && (await p.locator("body").innerText()).includes(NOMBRE), "la 404 lleva el nombre y el estilo del gimnasio", `404: ${r404.status()}`);

  // ── 2 · Con datos aparecen los bloques ──
  const [{ id: plan }] = (await db.query(`insert into public.planes (gimnasio_id, tipo, nombre, duracion_meses, renovacion) values ($1, 'membresia', 'Plan P8', 1, 'continua') returning id`, [gim])).rows;
  await db.query(`insert into public.precios_plan (gimnasio_id, plan_id, monto, vigente_desde) values ($1, $2, 29000, '2020-01-01T00:00:00Z')`, [gim, plan]);
  const [{ id: sede }] = (await db.query(`select id from public.sedes where gimnasio_id = $1 order by es_principal desc limit 1`, [gim])).rows;
  await db.query(`update public.sedes set direccion = 'Calle Ficticia 456' where id = $1`, [sede]);
  for (const dia of [1, 2, 3, 4, 5, 6]) await db.query(`insert into public.horarios_apertura (gimnasio_id, sede_id, dia, abre, cierra) values ($1, $2, $3, '07:00', '22:00')`, [gim, sede, dia]);
  const c = await pagina(b, COMPU);
  await c.goto(`${DIR("b")}/`);
  await c.locator("h1").first().waitFor({ timeout: 60000 });
  for (const s of ["planes", "horarios", "ubicacion"]) chequear(await c.locator(`section[aria-labelledby="${s}"]`).count() === 1, `con datos aparece el bloque ${s}`, `no aparece el bloque ${s}`);
  chequear((await c.locator('section[aria-labelledby="planes"]').innerText()).includes("Plan P8"), "el plan cargado se ve con su nombre", "el plan no se ve");
  chequear(!EMOJI.test(await c.locator("body").innerText()), "con datos, tampoco hay emojis como íconos", "con datos quedan emojis");
  await c.screenshot({ path: ".local/capturas/p8-compu-con-datos.png", fullPage: true }).catch(() => {});

  // ── Oculta: robots y sitemap ──
  await db.query(`update public.landing_gimnasio set publicada = false where gimnasio_id = $1`, [gim]);
  const rb2 = await (await c.request.get(`${DIR("c")}/robots.txt`)).text();
  chequear(/Disallow: \/\s*$/m.test(rb2), "oculta: robots.txt pide no indexar nada", `robots oculta: ${rb2.slice(0, 100)}`);
  const sm2 = await (await c.request.get(`${DIR("c")}/sitemap.xml`)).text();
  chequear(!sm2.includes("<loc>"), "oculta: el sitemap queda vacío", `sitemap oculta: ${sm2.slice(0, 100)}`);
  for (const pg2 of [p, c]) if (pg2.errores?.length) falla(`errores en la página: ${pg2.errores.join(" | ")}`);
} catch (e) {
  falla(`se cortó: ${process.env.E2E_DEPURAR ? e.message : e.message.split("\n")[0]}`);
} finally {
  await db.query(`update public.landing_gimnasio set publicada = false where gimnasio_id = $1`, [gim]).catch(() => {});
  await db.end();
}
await b.close();
resultado();
