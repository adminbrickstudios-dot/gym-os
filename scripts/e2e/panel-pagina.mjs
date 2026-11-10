#!/usr/bin/env node
// AUD-2 · Página del gimnasio, botón por botón, como un visitante: cada link
// de la página publicada (anclas, ingresar, WhatsApp, Instagram, mail, mapa,
// teléfono, "Lo quiero" de cada plan), en compu y celular; la página sin
// publicar ("Próximamente") con WhatsApp y accesos; un gimnasio recién creado.
//   npm run e2e:pagina            (con scripts/local/levantar.sh corriendo)
import { CELU, COMPU, GIMNASIO, PANTALLA_ROTA, capturar, chequear, entrar, falla, navegador, ok, pagina, resultado } from "./comun.mjs";

const G = GIMNASIO();
const b = await navegador();

/** Todos los links de la página, con su texto, tal como los ve el visitante. */
const links = (p) => p.locator("a[href]").evaluateAll((xs) => xs
  .filter((x) => x.offsetParent !== null || getComputedStyle(x).position === "fixed")
  .map((x) => ({ href: x.getAttribute("href"), texto: x.innerText.replace(/\s+/g, " ").trim(), nueva: x.target === "_blank" })));

async function revisarLinks(p, quien) {
  const ls = await links(p);
  let malos = [];
  for (const l of ls) {
    const h = l.href;
    if (h === "#") continue;
    if (h.startsWith("#")) { if (!(await p.locator(h).count())) malos.push(`${l.texto} → ${h} (no existe)`); continue; }
    if (h.startsWith("https://wa.me/")) {
      const u = new URL(h);
      if (!/^\/\d{10,15}$/.test(u.pathname) || !u.searchParams.get("text")) malos.push(`${l.texto} → ${h} (WhatsApp sin número o sin mensaje)`);
      if (!l.nueva) malos.push(`${l.texto} no abre en otra pestaña`);
      continue;
    }
    if (h.startsWith("https://instagram.com/")) { if (!/^https:\/\/instagram\.com\/[\w.]+$/.test(h)) malos.push(`${l.texto} → ${h}`); continue; }
    if (h.startsWith("mailto:")) { if (!/^mailto:[^@\s]+@[^@\s]+$/.test(h)) malos.push(`${l.texto} → ${h}`); continue; }
    if (h.startsWith("tel:")) { if (!/^tel:\+?\d{8,15}$/.test(h)) malos.push(`${l.texto} → ${h}`); continue; }
    if (/^https?:\/\//.test(h)) { if (!l.nueva) malos.push(`${l.texto} (externo) no abre en otra pestaña`); continue; }
    // Interno: se abre de verdad.
    const otra = await p.context().newPage();
    const r = await otra.goto(new URL(h, p.url()).toString());
    const cuerpo = await otra.locator("body").innerText();
    if (!r || r.status() >= 400 || PANTALLA_ROTA.test(cuerpo)) malos.push(`${l.texto} → ${h} dio ${r?.status()}`);
    await otra.close();
  }
  chequear(malos.length === 0, `${quien}: los ${ls.length} links andan (anclas, ingresar, WhatsApp, Instagram, mail, mapa)`, `${quien}: ${malos.join(" | ")}`);
  return ls;
}

try {
  // ── Publicada, compu ──
  const v = await pagina(b, COMPU);
  await v.goto(`${G}/`);
  await v.locator("h1").first().waitFor({ timeout: 30000 });
  const ls = await revisarLinks(v, "compu");
  const textos = ls.map((l) => l.texto).join(" · ");
  chequear(/Soy socio/.test(textos) && /Soy del equipo/.test(textos), "tiene “Soy socio” y “Soy del equipo”", `faltan accesos: ${textos}`);
  const planes = await v.locator("section[aria-labelledby=\"planes\"] li.tarjeta").count();
  const loQuiero = await v.locator('section[aria-labelledby=\"planes\"] a:has-text("Lo quiero")').count();
  chequear(planes > 0 && loQuiero === planes, `${planes} planes, cada uno con “Lo quiero” a WhatsApp con su nombre`, `${planes} planes y ${loQuiero} “Lo quiero”`);
  if (planes) {
    const msj = new URL(await v.locator('section[aria-labelledby=\"planes\"] a:has-text("Lo quiero")').first().getAttribute("href")).searchParams.get("text");
    const nombre = (await v.locator("section[aria-labelledby=\"planes\"] li.tarjeta .titulo").first().innerText()).trim();
    chequear(msj.includes(nombre), `“Lo quiero” dice el plan: “${msj}”`, `“Lo quiero” manda “${msj}” para ${nombre}`);
  }
  const titulo = await v.title();
  const og = await v.locator('meta[property="og:title"]').getAttribute("content").catch(() => null);
  chequear(!!og && titulo.length > 0, `título “${titulo}” y vista al compartir (og:title “${og}”)`, `sin título o sin og:title (${titulo} / ${og})`);
  await v.locator('a[href="#planes"]').first().click();
  await v.waitForTimeout(600);
  chequear(await v.evaluate(() => window.scrollY > 200), "“Ver planes” baja a los planes", "“Ver planes” no se mueve");
  await capturar(v, "aud2-compu-publicada", true);
  if (v.errores.length) falla(`visitante compu: ${v.errores.join(" | ")}`);
  await v.context().close();

  // ── Publicada, celular ──
  const c = await pagina(b, CELU);
  await c.goto(`${G}/`);
  await c.locator("h1").first().waitFor({ timeout: 30000 });
  await revisarLinks(c, "celular");
  const ancho = await c.evaluate(() => document.documentElement.scrollWidth);
  chequear(ancho <= CELU.width, `celular: sin desborde (${ancho}px)`, `celular: la página mide ${ancho}px`);
  const barra = c.locator("div.fixed a.boton-principal");
  chequear(await barra.count() === 1 && await barra.isVisible(), "celular: el botón de WhatsApp queda fijo abajo, una sola vez", "celular: sin barra fija de WhatsApp");
  await capturar(c, "aud2-celu-publicada", true);
  if (c.errores.length) falla(`visitante celu: ${c.errores.join(" | ")}`);
  await c.context().close();

  // ── Sin publicar: la dueña pasa a borrador; el visitante ve "Próximamente" con WhatsApp ──
  const d = await pagina(b, COMPU);
  await entrar(d, "duena@ejemplo.invalid");
  await d.goto(`${G}/panel/configuracion?pestana=pagina`);
  await d.locator('fieldset[data-pestana-activa="pagina"]').waitFor({ state: "attached", timeout: 30000 });
  await d.locator('button:has-text("Ocultar mi página")').click();
  await d.locator('button:has-text("Mostrar mi página")').waitFor({ timeout: 30000 });
  ok("dueña: “Ocultar mi página”");
  const v2 = await pagina(b, CELU);
  await v2.goto(`${G}/`);
  await v2.locator("h1").first().waitFor({ timeout: 30000 });
  const txt = await v2.locator("body").innerText();
  chequear(!/armando/i.test(txt) && await v2.locator("[data-pagina-oculta]").count() > 0, "oculta: solo la portada, sin “armando”", "oculta: no queda la portada o dice “armando”");
  const ls2 = await revisarLinks(v2, "próximamente");
  const t2 = ls2.map((l) => l.texto).join(" · ");
  chequear(/WhatsApp/.test(t2) && /Quiero ser socio/.test(t2) && /Soy socio/.test(t2) && /Soy del equipo/.test(t2), `oculta: ${t2}`, `la página oculta le falta algo: ${t2}`);
  chequear(!/Lo quiero|Ver planes/.test(t2), "oculta no muestra planes", "oculta muestra planes");
  await capturar(v2, "aud2-celu-proximamente");
  await v2.context().close();
  await d.locator('button:has-text("Mostrar mi página")').click();
  await d.locator('button:has-text("Ocultar mi página")').waitFor({ timeout: 30000 });
  ok("dueña: “Mostrar mi página” la vuelve a publicar");
  await d.context().close();

  // ── Un gimnasio recién creado (sin WhatsApp, sin publicar): no queda en blanco ──
  const n = await pagina(b, CELU);
  const slugNuevo = process.env.E2E_GIMNASIO_NUEVO;
  if (slugNuevo) {
    await n.goto(`${GIMNASIO(slugNuevo)}/`);
    await n.locator("h1").first().waitFor({ timeout: 30000 });
    const t3 = (await links(n)).map((l) => l.texto).join(" · ");
    chequear(/Soy socio/.test(t3) && /Soy del equipo/.test(t3), `gimnasio nuevo: su landing con ${t3}`, `gimnasio nuevo: ${t3}`);
  } else ok("(gimnasio nuevo: E2E_GIMNASIO_NUEVO sin definir; lo cubre super-admin.mjs al crear uno)");
  await n.context().close();
} catch (e) {
  falla(`se cortó: ${process.env.E2E_DEPURAR ? e.message : e.message.split("\n")[0]}`);
}
await b.close();
resultado();
