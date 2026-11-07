#!/usr/bin/env node
// VD-62 · Páginas, segunda pasada. Recorre las dos páginas públicas, en compu y en celular (390 px):
//   * la del gimnasio demo: portada con "Probá gratis" arriba, planes con precio, horarios, equipo, preguntas,
//     ubicación y WhatsApp flotante; sin desborde horizontal; con el video de portada si el dueño lo cargó;
//     "Probá gratis" lleva al formulario y WhatsApp apunta a wa.me con el número del gimnasio;
//   * la de Gym OS (plataforma): lo que resuelve en 3 líneas, abono de BRIK (solo con planes cargados), "Pedí una
//     demo" por WhatsApp con el número que carga el super admin en /admin, "Ingresar" lleva a /ingresar, sin desborde.
//   * metadatos: título, descripción, Open Graph, JSON-LD, lang es-AR, sitemap y robots de cada una.
// Que "Probá gratis" CREA el interesado ya lo prueba vd-51.mjs (reserva) y pag-3.mjs (pedido): acá solo se verifica
// que el botón y el formulario estén y se puedan usar, sin duplicar esas pruebas.
//   node scripts/e2e/vd-62.mjs     (con scripts/local/levantar.sh corriendo)
// ESCRITO, NO EJECUTADO por el agente que lo escribió: lo corre el orquestador.
import { CELU, COMPU, GIMNASIO, PLATAFORMA as B, capturar, chequear, entrar, falla, navegador, ok, pagina, resultado } from "./comun.mjs";

const G = GIMNASIO();
const NUMERO = "+5493875550062"; // ficticio, solo para esta prueba
const b = await navegador();

const sinDesborde = async (p, donde, ancho) => {
  const w = await p.evaluate(() => document.documentElement.scrollWidth);
  chequear(w <= ancho, `${donde}: sin desborde horizontal (${w}px)`, `${donde}: desborda ${w}px en un ancho de ${ancho}px`);
};
const visible = async (p, selector, texto, ver = true) =>
  chequear((await p.locator(selector).first().isVisible().catch(() => false)) === ver, texto, `no está: ${texto}`);

async function paginaGimnasio(vp, nombre) {
  const p = await pagina(b, vp);
  await p.goto(`${G}/`);
  await p.locator("h1").first().waitFor({ timeout: 60000 });
  chequear((await p.locator("html").getAttribute("lang")) === "es-AR", `${nombre}: lang="es-AR"`, `${nombre}: lang incorrecto`);

  // Portada: lo primero que se ve, sin scrollear, es "Probá gratis".
  const probar = p.locator("[data-probar-gratis]").first();
  await probar.waitFor({ timeout: 30000 }).catch(() => falla(`${nombre}: no está el botón “Probá gratis” en la portada (el demo tiene la sección “Probá una clase” prendida)`));
  if (await probar.count()) {
    const caja = await probar.boundingBox();
    chequear(!!caja && caja.y + caja.height <= vp.height, `${nombre}: “Probá gratis” se ve sin scrollear`, `${nombre}: “Probá gratis” queda fuera de la primera pantalla`);
  }
  // Foto o video de portada: si hay, el contenedor lo dice y la foto no pesa de más.
  const portada = await p.locator("[data-portada]").first().getAttribute("data-portada").catch(() => null);
  if (portada === "video") await visible(p, "video[data-video-portada][muted]", `${nombre}: video de portada mudo`);
  else ok(`${nombre}: portada con ${portada === "foto" ? "foto" : "tipografía (el demo no cargó foto ni video)"}`);

  // Los bloques de la página.
  for (const [id, que] of [["planes", "planes"], ["horarios", "horarios"], ["preguntas", "preguntas frecuentes"], ["probar", "“Probá una clase”"]]) {
    await visible(p, `#${id}`, `${nombre}: ${que}`);
  }
  const planes = p.locator("#planes li");
  if (await planes.count()) chequear(/\$\s?\d/.test(await planes.first().innerText()), `${nombre}: los planes muestran el precio`, `${nombre}: un plan sin precio`);
  // Opcionales según lo que cargó el dueño: se cuentan, no se exigen.
  for (const [sel, que] of [["#equipo", "equipo"], ["#ubicacion", "ubicación"], ["[data-prueba-social]", "reseñas y socios"], ["[data-horarios-sede]", "horarios en vivo"]]) {
    ok(`${nombre}: ${que} ${(await p.locator(sel).count()) ? "presente" : "no cargado en el demo"}`);
  }
  // Ningún texto de relleno.
  const cuerpo = await p.locator("body").innerText();
  chequear(!/lorem|ipsum|undefined|\bnull\b/i.test(cuerpo), `${nombre}: sin textos de relleno ni valores rotos`, `${nombre}: aparece lorem/undefined/null en la página`);

  // WhatsApp: el flotante (compu) o la barra de abajo (celular) abre wa.me con el número del gimnasio.
  const wa = vp.width >= 640 ? p.locator("[data-whatsapp-flotante]") : p.locator('div.fixed a[href^="https://wa.me/"]').first();
  await wa.waitFor({ timeout: 15000 }).catch(() => falla(`${nombre}: falta el WhatsApp flotante`));
  if (await wa.count()) {
    const href = await wa.getAttribute("href");
    chequear(/^https:\/\/wa\.me\/\d{8,15}\?text=/.test(href ?? ""), `${nombre}: WhatsApp apunta a wa.me con el número y un mensaje ya escrito`, `${nombre}: WhatsApp apunta a ${href}`);
    chequear((await wa.getAttribute("target")) === "_blank" && /noopener/.test((await wa.getAttribute("rel")) ?? ""), `${nombre}: WhatsApp abre en pestaña nueva y con noopener`, `${nombre}: WhatsApp sin target/rel seguros`);
  }
  // "Soy socio" lleva al ingreso de socios.
  const socio = p.locator('header a[href^="/ingresar"]').first();
  chequear((await socio.getAttribute("href"))?.startsWith("/ingresar") ?? false, `${nombre}: “Soy socio” lleva a /ingresar`, `${nombre}: falta “Soy socio”`);

  await sinDesborde(p, nombre, vp.width);
  await capturar(p, `vd62-gimnasio-${vp.width}`, true);

  // "Probá gratis" lleva al formulario, que se muestra y se puede completar (el pedido se prueba en vd-51 y pag-3).
  await probar.click();
  const form = p.locator("[data-form-probar]");
  await form.first().waitFor({ timeout: 30000 }).catch(() => falla(`${nombre}: “Probá gratis” no llega al formulario`));
  if (await form.count()) {
    chequear(await form.first().isVisible(), `${nombre}: “Probá gratis” lleva al formulario`, `${nombre}: el formulario no se ve`);
    chequear((await form.first().locator('input[name="nombre"]').count()) === 1, `${nombre}: el formulario pide el nombre`, `${nombre}: el formulario no tiene nombre`);
  }
  // Metadatos del gimnasio.
  const meta = await p.evaluate(() => ({
    titulo: document.title, descripcion: document.querySelector('meta[name="description"]')?.content ?? "",
    og: document.querySelector('meta[property="og:image"]')?.content ?? "", canonical: document.querySelector('link[rel="canonical"]')?.href ?? "",
    ld: [...document.querySelectorAll('script[type="application/ld+json"]')].map((s) => s.textContent ?? ""),
    sinAlt: [...document.images].filter((i) => !i.hasAttribute("alt")).length,
  }));
  chequear(meta.titulo.length > 2 && meta.descripcion.length > 10 && meta.og && meta.canonical, `${nombre}: título, descripción, Open Graph y canonical`, `${nombre}: faltan metadatos ${JSON.stringify({ t: meta.titulo, d: !!meta.descripcion, og: !!meta.og, c: !!meta.canonical })}`);
  chequear(meta.ld.some((t) => { try { return JSON.parse(t)["@type"] === "ExerciseGym"; } catch { return false; } }), `${nombre}: datos estructurados ExerciseGym`, `${nombre}: sin JSON-LD`);
  chequear(meta.sinAlt === 0, `${nombre}: todas las imágenes tienen alt`, `${nombre}: ${meta.sinAlt} imagen(es) sin alt`);
  if (p.errores.length) falla(`${nombre}: ${p.errores.join(" | ")}`);
  return p;
}

async function paginaPlataforma(vp, nombre, esperaNumero) {
  const p = await pagina(b, vp);
  await p.goto(B);
  await p.locator("[data-plataforma]").waitFor({ timeout: 60000 });
  chequear((await p.locator("html").getAttribute("lang")) === "es-AR", `${nombre}: lang="es-AR"`, `${nombre}: lang incorrecto`);
  chequear(await p.getByRole("heading", { level: 1 }).count() === 1, `${nombre}: un solo h1`, `${nombre}: no hay exactamente un h1`);
  chequear((await p.locator("[data-tres-lineas] li").count()) === 3, `${nombre}: lo que resuelve, en 3 líneas`, `${nombre}: las 3 líneas no están`);
  await visible(p, "[data-quiero-demo]", `${nombre}: “Quiero una demo”`);
  await visible(p, "#que-resuelve", `${nombre}: qué resuelve`);
  await visible(p, "#preguntas", `${nombre}: preguntas frecuentes`);
  await visible(p, "#demo", `${nombre}: formulario de la demo`);
  // Capturas: si el script las generó, cada una con alt y tamaño reservado; si no, las ilustraciones simples.
  const capturas = p.locator("[data-capturas-gymos] img");
  const n = await capturas.count();
  if (n) {
    const raras = await capturas.evaluateAll((l) => l.filter((i) => !i.alt || !i.getAttribute("width") || !i.getAttribute("height")).length);
    chequear(raras === 0, `${nombre}: ${n} captura(s) reales con alt y tamaño reservado`, `${nombre}: ${raras} captura(s) sin alt o sin tamaño`);
  } else ok(`${nombre}: sin capturas generadas todavía (node scripts/capturas-pagina-gymos.mjs): quedan las ilustraciones`);
  // Abono de BRIK: solo con planes cargados, y con un monto en pesos.
  const planes = await p.locator("[data-plan-brik]").count();
  if (planes) chequear(/\$\s?\d/.test(await p.locator("[data-plan-brik]").first().innerText()), `${nombre}: ${planes} plan(es) de BRIK con su precio`, `${nombre}: un plan sin precio`);
  else chequear(await p.locator("[data-planes-brik]").count() === 0, `${nombre}: sin planes cargados no hay precios`, `${nombre}: hay precios sin planes`);

  // "Pedí una demo" por WhatsApp: con el número del super admin; sin número, no hay botón.
  const demo = p.locator("[data-demo-whatsapp]");
  if (esperaNumero) {
    chequear(await demo.count() === 1, `${nombre}: aparece “Pedí una demo por WhatsApp”`, `${nombre}: falta el botón de WhatsApp con el número cargado`);
    const href = (await demo.first().getAttribute("href")) ?? "";
    chequear(href.startsWith(`https://wa.me/${esperaNumero.replace(/\D/g, "")}?text=`), `${nombre}: el botón abre wa.me con el número del super admin`, `${nombre}: apunta a ${href}`);
  } else chequear(await demo.count() === 0, `${nombre}: sin número cargado no hay botón de WhatsApp`, `${nombre}: hay botón de WhatsApp sin número`);

  // "Ingresar" (arriba) lleva a /ingresar.
  await p.locator("[data-ingresar]").click();
  await p.waitForURL(/\/ingresar/, { timeout: 30000 });
  ok(`${nombre}: “Ingresar” lleva a /ingresar`);
  await p.goBack();
  await p.locator("[data-plataforma]").waitFor({ timeout: 60000 });
  await sinDesborde(p, nombre, vp.width);
  await capturar(p, `vd62-plataforma-${vp.width}`, true);

  const meta = await p.evaluate(() => ({
    titulo: document.title, og: document.querySelector('meta[property="og:image"]')?.content ?? "",
    ld: [...document.querySelectorAll('script[type="application/ld+json"]')].map((s) => s.textContent ?? ""),
    sinAlt: [...document.images].filter((i) => !i.hasAttribute("alt")).length,
  }));
  chequear(/Gym OS/.test(meta.titulo) && !!meta.og, `${nombre}: título y Open Graph`, `${nombre}: faltan metadatos ${JSON.stringify(meta.titulo)}`);
  chequear(meta.ld.some((t) => { try { return JSON.parse(t)["@type"] === "SoftwareApplication"; } catch { return false; } }), `${nombre}: datos estructurados SoftwareApplication`, `${nombre}: sin JSON-LD`);
  chequear(meta.sinAlt === 0, `${nombre}: todas las imágenes tienen alt`, `${nombre}: ${meta.sinAlt} imagen(es) sin alt`);
  if (p.errores.length) falla(`${nombre}: ${p.errores.join(" | ")}`);
}

try {
  // ── 1. Plataforma sin número: no hay botón de WhatsApp ──
  const admin = await pagina(b, COMPU);
  await entrar(admin, "admin@ejemplo.invalid", undefined, B);
  await admin.goto(`${B}/admin`);
  const form = admin.locator("[data-contacto-plataforma]");
  await form.waitFor({ timeout: 60000 }).catch(() => falla("el super admin no tiene el formulario del WhatsApp de la demo"));
  await form.locator('input[aria-label="WhatsApp de BRIK"]').fill("");
  await form.locator('input[aria-label="Mensaje de la demo"]').fill("Hola! Quiero ver una demo de Gym OS.");
  const guardar = form.getByRole("button", { name: "Guardar" });
  if (await guardar.isEnabled()) { await guardar.click(); await form.getByText("Guardado.").waitFor({ timeout: 30000 }); }
  await paginaPlataforma(COMPU, "plataforma compu (sin número)", null);

  // ── 2. El super admin carga el número: el botón aparece y apunta bien (también en el celular) ──
  await admin.goto(`${B}/admin`);
  const form2 = admin.locator("[data-contacto-plataforma]");
  await form2.waitFor({ timeout: 60000 });
  await form2.locator('input[aria-label="WhatsApp de BRIK"]').fill("+54 9 387 555-0062");
  await form2.getByRole("button", { name: "Guardar" }).click();
  await form2.getByText("Guardado.").waitFor({ timeout: 30000 });
  ok("el super admin guarda el WhatsApp de la demo");
  await form2.locator('input[aria-label="WhatsApp de BRIK"]').fill("12345");
  await form2.getByRole("button", { name: "Guardar" }).click();
  await form2.locator('[role="alert"]').waitFor({ timeout: 30000 });
  ok(`un número inválido se avisa: “${(await form2.locator('[role="alert"]').innerText()).trim().slice(0, 70)}”`);
  await paginaPlataforma(COMPU, "plataforma compu", NUMERO);
  await paginaPlataforma(CELU, "plataforma celular", NUMERO);

  // ── 3. Sitemap y robots de la plataforma ──
  const sm = await (await admin.request.get(`${B}/sitemap.xml`)).text();
  chequear(sm.includes("<loc>") && sm.includes(B), "sitemap de la plataforma con su página", "el sitemap de la plataforma está vacío");
  const rb = await (await admin.request.get(`${B}/robots.txt`)).text();
  chequear(/Disallow: \/panel/.test(rb) && /Allow: \//.test(rb), "robots de la plataforma: indexa la página y deja afuera el panel", "robots inesperado");

  // ── 4. Gimnasio demo: compu y celular ──
  await paginaGimnasio(COMPU, "gimnasio compu");
  await paginaGimnasio(CELU, "gimnasio celular");
  // En Windows demo.localhost no resuelve fuera del navegador: se pide a 127.0.0.1 con el Host del gimnasio.
  const smG = await new Promise((res, rej) => import("node:http").then(({ default: h }) => h.get({ host: "127.0.0.1", port: Number(process.env.PUERTO_APP ?? 3123), path: "/sitemap.xml", headers: { host: `demo.localhost:${process.env.PUERTO_APP ?? 3123}` } }, (r) => { let d = ""; r.setEncoding("utf8"); r.on("data", (c) => (d += c)); r.on("end", () => res(d)); }).on("error", rej)));
  chequear(smG.includes("<loc>"), "sitemap del gimnasio publicado", "el sitemap del gimnasio está vacío");

  // ── 5. El dueño pega un video de portada: la portada lo muestra (y uno inválido se rechaza) ──
  const duena = await pagina(b, COMPU);
  await entrar(duena, "duena@ejemplo.invalid");
  await duena.goto(`${G}/panel/pagina`);
  const vid = duena.locator("[data-video-portada-panel]");
  await vid.waitFor({ timeout: 60000 }).catch(() => falla("el panel Tu página no tiene el video de portada"));
  if (await vid.count()) {
    const campo = vid.locator('input[aria-label="Link del video de portada"]');
    await campo.fill("https://ejemplo.invalid/portada.mov");
    await vid.getByRole("button", { name: "Guardar video" }).click();
    await vid.locator('[role="alert"]').waitFor({ timeout: 30000 });
    ok(`un video que no es .mp4/.webm se rechaza: “${(await vid.locator('[role="alert"]').innerText()).trim().slice(0, 70)}”`);
    await campo.fill("https://ejemplo.invalid/portada.mp4");
    await vid.getByRole("button", { name: "Guardar video" }).click();
    // El botón se apaga recién cuando el guardado volvió (antes quedaba el "Guardado." del paso anterior).
    await vid.getByRole("button", { name: "Guardar video" }).waitFor({ state: "attached" });
    await vid.page().waitForFunction(() => [...document.querySelectorAll("[data-video-portada-panel] button")].some((x) => /Guardar video/.test(x.textContent) && x.disabled), null, { timeout: 30000 });
    const v = await pagina(b, COMPU);
    await v.goto(`${G}/`);
    await v.locator("[data-video-portada]").waitFor({ state: "attached", timeout: 60000 }).catch(() => falla("la portada no muestra el video que cargó el dueño"));
    chequear((await v.locator("[data-video-portada]").getAttribute("src")) === "https://ejemplo.invalid/portada.mp4", "la portada usa el video que pegó el dueño", "el video de la portada no es el que se guardó");
    // Se deja como estaba: sin video.
    await campo.fill("");
    await vid.getByRole("button", { name: "Guardar video" }).click();
    // El botón se apaga recién cuando el guardado volvió (antes quedaba el "Guardado." del paso anterior).
    await vid.getByRole("button", { name: "Guardar video" }).waitFor({ state: "attached" });
    await vid.page().waitForFunction(() => [...document.querySelectorAll("[data-video-portada-panel] button")].some((x) => /Guardar video/.test(x.textContent) && x.disabled), null, { timeout: 30000 });
    await v.reload();
    chequear(await v.locator("[data-video-portada]").count() === 0, "sin link, la portada vuelve a la foto", "quedó el video después de borrar el link");
  }
  if (admin.errores.length) falla(`admin: ${admin.errores.join(" | ")}`);
} finally {
  await b.close();
}
resultado();
