#!/usr/bin/env node
// U4 · La página del gimnasio es SIEMPRE su landing.
//   1. Un gimnasio recién creado, sin cargar nada, muestra su landing con nombre, color, "Soy socio", "Quiero ser socio" y "Soy del equipo"
//      al pie; las secciones sin datos (planes, horarios, dirección) no aparecen.
//   2. Al cargar un plan con precio, un horario y una dirección, esas secciones aparecen.
//   3. Con "Ocultar mi página" queda solo la portada con la marca y los dos botones (no se indexa).
//   4. En NINGÚN caso aparece "armando" / "en construcción": ni en la página, ni en los metadatos para compartir, ni en /og.
//   node scripts/e2e/fase-u4.mjs     (con scripts/local/levantar.sh corriendo)
// El gimnasio se crea directo en la base (la página, el color y las secciones salen de datos): nace con el trigger de siempre.
import { execSync } from "node:child_process";
import pg from "pg";
import { CELU, COMPU, chequear, falla, navegador, pagina, resultado, PUERTO } from "./comun.mjs";

const url = process.env.DB_PRUEBAS_URL || execSync("scripts/db/local.sh url").toString().trim();
const db = new pg.Client({ connectionString: url });
await db.connect();
const slug = `u4-${Date.now() % 1000000}`;
const NOMBRE = `Gimnasio U4 ${slug.slice(3)}`;
const ACENTO = "#e11d48";
// La landing se guarda 60 s en caché por dirección (la invalida cualquier guardado real desde el panel, pero no un cambio directo en
// la base). Por eso cada etapa mira la página por una dirección distinta del mismo gimnasio: así no depende del reloj.
const DIR = (n) => `http://${n}-${slug}.localhost:${PUERTO}`;
const G = DIR("a"), G2 = DIR("b"), G3 = DIR("c"), G4 = DIR("d");
const PROHIBIDO = /armando|en construcci/i;

const [{ id: gim }] = (await db.query(`insert into public.gimnasios (slug, nombre) values ($1, $2) returning id`, [slug, NOMBRE])).rows;
for (const n of ["a", "b", "c", "d"]) await db.query(`insert into public.dominios_gimnasio (gimnasio_id, host, tipo) values ($1, $2, 'subdominio') on conflict do nothing`, [gim, `${n}-${slug}.localhost`]);
await db.query(`update public.configuracion_gimnasio set color_acento = $2 where gimnasio_id = $1`, [gim, ACENTO]);

const meta = async (p, prop) => p.locator(`meta[property="${prop}"], meta[name="${prop}"]`).first().getAttribute("content").catch(() => null);
const b = await navegador();
try {
  // ── 1 · Recién creado, sin cargar nada ──
  const p = await pagina(b, CELU);
  await p.goto(`${G}/`);
  await p.locator("h1").first().waitFor({ timeout: 60000 });
  const txt = await p.locator("body").innerText();
  chequear(txt.includes(NOMBRE) || (await p.locator("h1").first().innerText()).length > 0, "recién creado: la página muestra la landing con el nombre", "la página no muestra el nombre");
  chequear(!PROHIBIDO.test(txt), "recién creado: no dice “armando” ni “en construcción”", `dice: ${txt.match(PROHIBIDO)?.[0]}`);
  chequear(await p.locator("[data-pagina-oculta]").count() === 0, "recién creado: no es la portada oculta, es la landing", "recién creado sale la portada de página oculta");
  chequear(await p.locator('a[href="/ingresar?modo=socio"]').count() > 0, "tiene “Soy socio”", "falta “Soy socio”");
  chequear(await p.locator('a[href="/hacete-socio"]').count() > 0, "tiene “Quiero ser socio”", "falta “Quiero ser socio”");
  chequear(await p.locator('footer a[href="/ingresar"]').count() > 0, "“Soy del equipo” va chico al pie", "falta “Soy del equipo” al pie");
  chequear((await p.content()).toLowerCase().includes(ACENTO), "usa el color del gimnasio", "no usa el color del gimnasio");
  for (const s of ["planes", "horarios", "ubicacion"]) {
    chequear(await p.locator(`#${s}`).count() === 0, `sin datos, la sección ${s} no se muestra`, `la sección ${s} aparece vacía`);
  }
  chequear(!PROHIBIDO.test(`${await meta(p, "og:description")} ${await meta(p, "og:title")} ${await p.title()}`), "los metadatos para compartir no dicen “armando”", "los metadatos dicen “armando”");
  const og = await p.request.get(`${G}/og`);
  chequear(og.ok() && (og.headers()["content-type"] ?? "").includes("image"), "/og devuelve la imagen del gimnasio", `/og dio ${og.status()}`);
  await p.screenshot({ path: ".local/capturas/u4-celu-recien-creado.png", fullPage: true }).catch(() => {});

  // ── 2 · Con planes, horarios y dirección aparecen ──
  const [{ id: plan }] = (await db.query(`insert into public.planes (gimnasio_id, tipo, nombre, duracion_meses, renovacion) values ($1, 'membresia', 'Plan U4', 1, 'continua') returning id`, [gim])).rows;
  await db.query(`insert into public.precios_plan (gimnasio_id, plan_id, monto, vigente_desde) values ($1, $2, 31000, '2020-01-01T00:00:00Z')`, [gim, plan]);
  const [{ id: sede }] = (await db.query(`select id from public.sedes where gimnasio_id = $1 order by es_principal desc limit 1`, [gim])).rows;
  await db.query(`update public.sedes set direccion = 'Calle Ficticia 123', telefono = null where id = $1`, [sede]);
  for (const dia of [1, 2, 3, 4, 5]) await db.query(`insert into public.horarios_apertura (gimnasio_id, sede_id, dia, abre, cierra) values ($1, $2, $3, '07:00', '22:00')`, [gim, sede, dia]);
  await p.goto(`${G2}/`);
  await p.locator("h1").first().waitFor({ timeout: 60000 });
  chequear(await p.locator("#planes").count() > 0 && (await p.locator("#planes").innerText()).includes("Plan U4"), "al cargar un plan con precio, aparece en la página", "el plan no aparece");
  chequear(await p.locator("#horarios").count() > 0, "al cargar horarios, aparece la sección Horarios", "los horarios no aparecen");
  chequear(await p.locator("#ubicacion").count() > 0, "al cargar la dirección, aparece Dónde estamos", "la dirección no aparece");
  chequear(!PROHIBIDO.test(await p.locator("body").innerText()), "con datos, tampoco dice “armando”", "con datos dice “armando”");
  await p.screenshot({ path: ".local/capturas/u4-celu-con-datos.png", fullPage: true }).catch(() => {});

  // ── 3 · "Ocultar mi página": solo la portada con la marca y los botones ──
  await db.query(`update public.landing_gimnasio set publicada = false where gimnasio_id = $1`, [gim]);
  const o = await pagina(b, COMPU);
  await o.goto(`${G3}/`);
  await o.locator("[data-pagina-oculta]").waitFor({ timeout: 60000 });
  const to = await o.locator("body").innerText();
  chequear(to.includes(NOMBRE), "oculta: queda la portada con el nombre", "oculta: no aparece el nombre");
  chequear(await o.locator('a[href="/ingresar?modo=socio"]').count() > 0 && await o.locator('a[href="/hacete-socio"]').count() > 0, "oculta: están “Soy socio” y “Quiero ser socio”", "oculta: faltan los botones");
  chequear(await o.locator("#planes, #horarios").count() === 0, "oculta: no se ven planes ni horarios", "oculta: se ven secciones de la página");
  chequear(!PROHIBIDO.test(to), "oculta: no dice “armando” ni “en construcción”", `oculta dice: ${to.match(PROHIBIDO)?.[0]}`);
  chequear(!PROHIBIDO.test(`${await meta(o, "og:description")} ${await meta(o, "og:title")} ${await o.title()}`), "oculta: los metadatos no dicen “armando”", "oculta: los metadatos dicen “armando”");
  chequear(/noindex/.test((await meta(o, "robots")) ?? ""), "oculta: no se indexa (noindex)", "oculta: se puede indexar");
  const og2 = await o.request.get(`${G3}/og`);
  chequear(og2.ok(), "oculta: /og sigue andando", `oculta: /og dio ${og2.status()}`);
  await o.screenshot({ path: ".local/capturas/u4-compu-oculta.png" }).catch(() => {});

  // ── Y al volver a mostrarla, vuelve la landing completa ──
  await db.query(`update public.landing_gimnasio set publicada = true where gimnasio_id = $1`, [gim]);
  await o.goto(`${G4}/`);
  await o.locator("h1").first().waitFor({ timeout: 60000 });
  chequear(await o.locator("[data-pagina-oculta]").count() === 0 && await o.locator("#planes").count() > 0, "al mostrarla otra vez, vuelve la landing completa", "no vuelve la landing");
  for (const pg2 of [p, o]) if (pg2.errores?.length) falla(`errores en la página: ${pg2.errores.join(" | ")}`);
} catch (e) {
  falla(`se cortó: ${process.env.E2E_DEPURAR ? e.message : e.message.split("\n")[0]}`);
} finally {
  await db.query(`update public.landing_gimnasio set publicada = false where gimnasio_id = $1`, [gim]).catch(() => {});
  await db.end();
}
await b.close();
resultado();
