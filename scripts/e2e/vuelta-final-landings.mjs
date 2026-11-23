#!/usr/bin/env node
// Vuelta final (Mateo, 22/11) · las dos landings, detrás de su llave, con sesión real.
//   GIMNASIO (demo, nunca Temple Gym):
//     1. Con landing_nueva APAGADA sale la página de siempre (la de L1), sin data-landing-nueva.
//     2. Prendida: arriba el nombre y "Hacete socio" (lleva a /hacete-socio), "Ya soy socio"; los dibujos son SVG en línea con aria-hidden;
//        planes con precio en $ (formatearPesos), cómo llegar con link al mapa, WhatsApp por wa.me; el reglamento solo si hay términos publicados.
//     3. Sin desborde a lo ancho en un celular chico (360) ni en la compu; se recorre con el teclado (Tab llega a "Hacete socio" con foco visible).
//     4. og:image del gimnasio responde una imagen.
//   PLATAFORMA:
//     5. Sin cuenta: la página de venta de siempre (llave apagada), nada de la nueva.
//     6. El super admin abre /admin/vista-landing: ve la nueva con el aviso de vista previa, la pregunta "¿Este socio puede entrar hoy?" y
//        "Hablemos por WhatsApp"; sin planes cargados no hay sección de precios; con un plan, el precio sale con $.
//     7. La dueña del demo no puede abrir la vista previa (error, no la página).
//   Deja todo como estaba (llave del demo apagada, plataforma apagada, el plan de prueba borrado).
//   node scripts/e2e/vuelta-final-landings.mjs     (con scripts/local/levantar.sh corriendo)
import { execSync } from "node:child_process";
import pg from "pg";
import { COMPU, GIMNASIO, PLATAFORMA, capturar, chequear, entrar, navegador, pagina, resultado } from "./comun.mjs";

const G = GIMNASIO();
const db = new pg.Client({ connectionString: process.env.DB_PRUEBAS_URL || execSync("scripts/db/local.sh url").toString().trim() });
await db.connect();
const q = async (sql, p) => (await db.query(sql, p)).rows;
const [{ id: gim, es_demo }] = await q(`select id, es_demo from public.gimnasios where slug = 'demo'`);
if (!es_demo) throw new Error("el gimnasio demo no está marcado como demo");
const llave = (v) => q(`insert into public.funciones_nuevas_gimnasio (gimnasio_id, clave, activa, prendida_en, cambiada_en) values ($1, 'landing_nueva', $2, now(), now())
                         on conflict (gimnasio_id, clave) do update set activa = excluded.activa, cambiada_en = now()`, [gim, v]);
const CHICO = { width: 360, height: 740 };
const sinDesborde = (p) => p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
// La caché del proxy y de la página (hasta 60 s): se espera la condición, nunca un sleep fijo.
async function esperarSelector(p, url, selector, presente = true, intentos = 20) {
  for (let i = 0; i < intentos; i++) {
    await p.goto(url);
    const hay = (await p.locator(selector).count()) > 0;
    if (hay === presente) return true;
    await p.waitForTimeout(3000);
  }
  return false;
}

await q(`update public.landing_gimnasio set publicada = true where gimnasio_id = $1`, [gim]);
await q(`update public.configuracion_gimnasio set altas_online = true, crear_cuenta_visible = true where gimnasio_id = $1`, [gim]);
const b = await navegador();
let planPrueba = null;
try {
  // ── 1 · Apagada: la de siempre ──
  await llave(false);
  const v = await pagina(b, CHICO);
  chequear(await esperarSelector(v, `${G}/`, "[data-pagina-gimnasio]") && (await v.locator("[data-landing-nueva]").count()) === 0,
    "Llave apagada: la página del gimnasio de siempre", "con la llave apagada aparece la página nueva");

  // ── 2 · Prendida ──
  await llave(true);
  chequear(await esperarSelector(v, `${G}/`, "[data-landing-nueva]"), "Llave prendida: la página nueva", "la página nueva no aparece con la llave prendida");
  const hacete = v.locator("[data-hacete-socio]");
  chequear((await hacete.getAttribute("href")) === "/hacete-socio" && /Hacete socio/.test(await hacete.innerText()), "Arriba: «Hacete socio» lleva a /hacete-socio", `el botón grande dice ${await hacete.innerText().catch(() => "—")}`);
  chequear(await v.locator("[data-ya-soy-socio]").count() > 0, "Arriba: «Ya soy socio»", "falta «Ya soy socio» arriba");
  const dibujos = await v.locator("svg[data-ilustracion]").evaluateAll((l) => l.map((s) => s.getAttribute("aria-hidden")));
  chequear(dibujos.length >= 4 && dibujos.every((a) => a === "true"), `${dibujos.length} dibujos en SVG, todos decorativos (aria-hidden)`, `dibujos: ${JSON.stringify(dibujos)}`);
  const imagenes = await v.locator("[data-landing-nueva] img:not([alt*='Logo'])").count();
  chequear(imagenes === 0, "Sin fotos: solo dibujos (el logo aparte)", `hay ${imagenes} imágenes que no son el logo`);
  // Solo los precios de las tarjetas de plan: la misma sección trae las clases de la semana, con sus horarios (que también son «numero»).
  const planes = await v.locator("[data-seccion=planes] li.tarjeta [class*=numero]").allInnerTexts();
  chequear(planes.length === 0 || planes.every((t) => /^\$\s?\d/.test(t.trim())), `Planes con precio en pesos (${planes.slice(0, 3).join(" · ") || "sin precios mostrados"})`, `precios mal formateados: ${planes.join(" | ")}`);
  const mapa = await v.locator("[data-link-mapa]").first().getAttribute("href").catch(() => null);
  chequear(!(await v.locator("[data-sede-direccion]").count()) || /^https:\/\/(www\.)?google\.[a-z.]+\/maps|^https:\/\/maps\./.test(mapa ?? ""), "Cómo llegar: link al mapa", `link al mapa: ${mapa}`);
  const wa = await v.locator("[data-dato-whatsapp]").getAttribute("href").catch(() => null);
  chequear(wa === null || wa.startsWith("https://wa.me/"), wa ? "WhatsApp por wa.me" : "Sin WhatsApp cargado: no hay botón (nunca un hueco)", `el WhatsApp va a ${wa}`);
  const [{ hay: terminos }] = await q(`select exists (select 1 from public.terminos_gimnasio where gimnasio_id = $1 and publicado and texto is not null) hay`, [gim]);
  chequear((await v.locator("[data-reglamento]").count() > 0) === terminos, terminos ? "Reglamento: hay términos publicados y aparece" : "Reglamento: sin términos publicados no aparece", "el link al reglamento no coincide con los términos publicados");
  const texto = await v.locator("body").innerText();
  chequear(!/lorem|undefined|null|NaN|\[object/i.test(texto), "Sin textos de relleno ni técnicos", "aparece un texto técnico o de relleno");

  // ── 3 · A lo ancho y con el teclado ──
  chequear(await sinDesborde(v), "Celular chico (360): nada se sale a lo ancho", "en 360 la página se sale a lo ancho");
  await capturar(v, "vuelta-final-landing-gimnasio-celular", true);
  const c = await pagina(b, COMPU);
  await c.goto(`${G}/`);
  chequear(await sinDesborde(c), "Compu: nada se sale a lo ancho", "en la compu la página se sale a lo ancho");
  await capturar(c, "vuelta-final-landing-gimnasio-compu", true);
  let llego = false;
  for (let i = 0; i < 12 && !llego; i++) {
    await c.keyboard.press("Tab");
    llego = await c.evaluate(() => document.activeElement?.hasAttribute("data-hacete-socio") ?? false);
  }
  const foco = llego ? await c.evaluate(() => getComputedStyle(document.activeElement).outlineStyle !== "none" || getComputedStyle(document.activeElement).boxShadow !== "none") : false;
  chequear(llego && foco, "Teclado: Tab llega a «Hacete socio» con el foco visible", llego ? "el foco de «Hacete socio» no se ve" : "con Tab no se llega a «Hacete socio»");

  // ── 4 · La vista previa al compartir ──
  const og = await c.request.get(`${G}/og`);
  chequear(og.ok() && (og.headers()["content-type"] ?? "").startsWith("image/"), "og:image del gimnasio: una imagen", `og: ${og.status()} ${og.headers()["content-type"]}`);

  // ── 5 · La plataforma sin cuenta: la de siempre ──
  await q(`update public.plataforma_ajustes set valor = 'false' where clave = 'landing_venta_nueva'`);
  const anon = await pagina(b, CHICO);
  await anon.goto(`${PLATAFORMA}/`);
  chequear(await anon.locator("[data-plataforma]").count() > 0 && (await anon.locator("[data-plataforma-nueva]").count()) === 0, "Plataforma sin cuenta: la página de venta de siempre", "sin cuenta se ve la página de venta nueva");

  // ── 6 · El super admin: la vista previa ──
  const adm = await pagina(b, COMPU);
  await entrar(adm, "admin@ejemplo.invalid", undefined, PLATAFORMA);
  await adm.goto(`${PLATAFORMA}/admin/vista-landing`);
  await adm.locator("[data-plataforma-nueva]").waitFor({ timeout: 60000 });
  chequear(await adm.locator("[data-vista-previa]").count() > 0, "Super admin: la página nueva con el aviso de vista previa", "falta el aviso de vista previa");
  chequear(/¿Este socio puede entrar hoy\?/.test(await adm.locator("h1").innerText()), "Lo primero que lee: «¿Este socio puede entrar hoy?»", "el título no es la pregunta");
  chequear(await adm.locator("[data-hablemos]").count() > 0, "Botón principal: «Hablemos por WhatsApp»", "falta «Hablemos por WhatsApp»");
  const [{ n: hayPlanes }] = await q(`select count(*)::int n from public.plataforma_planes where activo and publico`);
  chequear((await adm.locator("[data-planes-brik]").count() > 0) === (hayPlanes > 0), hayPlanes ? "Con planes cargados: la sección de precios" : "Sin planes cargados: no hay sección de precios", "la sección de precios no coincide con los planes cargados");
  [{ id: planPrueba }] = await q(`insert into public.plataforma_planes (nombre, precio_mensual, max_socios, modulos, descripcion) values ('Plan e2e vuelta final', 45000.5, 300, '{Recepción,App del socio}', 'Para probar') returning id`);
  await adm.goto(`${PLATAFORMA}/admin/vista-landing`);
  const precio = await adm.locator("[data-plan-brik]", { hasText: "Plan e2e vuelta final" }).innerText().catch(() => "");
  chequear(/\$45\.000,50/.test(precio) && /Hasta 300 socios/.test(precio) && /App del socio/.test(precio), "El plan sale de la base: $45.000,50, hasta 300 socios y sus módulos", `el plan dice: ${precio.replace(/\s+/g, " ").slice(0, 120)}`);
  chequear(await sinDesborde(adm), "Vista previa en la compu: nada se sale a lo ancho", "la vista previa se sale a lo ancho");
  await capturar(adm, "vuelta-final-landing-venta-compu", true);
  const admCelu = await pagina(b, CHICO);
  await entrar(admCelu, "admin@ejemplo.invalid", undefined, PLATAFORMA);
  await admCelu.goto(`${PLATAFORMA}/admin/vista-landing`);
  await admCelu.locator("[data-plataforma-nueva]").waitFor({ timeout: 60000 });
  chequear(await sinDesborde(admCelu), "Vista previa en el celular chico: nada se sale a lo ancho", "la vista previa se sale a lo ancho en 360");
  await capturar(admCelu, "vuelta-final-landing-venta-celular", true);

  // ── 7 · La dueña no ve la vista previa ──
  const duena = await pagina(b, COMPU);
  await entrar(duena, "duena@ejemplo.invalid", undefined, PLATAFORMA).catch(() => {});
  await duena.goto(`${PLATAFORMA}/admin/vista-landing`);
  chequear((await duena.locator("[data-plataforma-nueva]").count()) === 0, "La dueña no abre la vista previa de la página de venta", "la dueña ve la vista previa");
} finally {
  await llave(false).catch(() => {});
  await q(`update public.plataforma_ajustes set valor = 'false' where clave = 'landing_venta_nueva'`).catch(() => {});
  if (planPrueba) await q(`delete from public.plataforma_planes where id = $1`, [planPrueba]).catch(() => {});
  await b.close();
  await db.end();
  resultado();
}
