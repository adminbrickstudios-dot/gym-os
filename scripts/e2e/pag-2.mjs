#!/usr/bin/env node
// PAG-2 · Publicar, pasar a borrador y compartir: desde Tu página la dueña
// pasa a borrador (la gente ve "Próximamente") y la vuelve a publicar; copia
// el link; el link de WhatsApp lleva la dirección; al compartir, la página
// tiene título, descripción e imagen (la de portada o /og con sus colores).
//   npm run e2e:pag-2            (con scripts/local/levantar.sh corriendo)
import { CELU, COMPU, GIMNASIO, capturar, chequear, entrar, falla, navegador, pagina, resultado } from "./comun.mjs";

const G = GIMNASIO();
const b = await navegador();
const meta = (p, prop) => p.locator(`meta[property="${prop}"], meta[name="${prop}"]`).first().getAttribute("content").catch(() => null);
try {
  const p = await pagina(b, COMPU);
  await p.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await entrar(p, "duena@ejemplo.invalid");
  await p.goto(`${G}/panel/pagina`);
  await p.locator('[data-editor-pagina][data-listo="true"]').waitFor({ timeout: 60000 });
  const estado = p.locator("[data-estado-pagina]");
  chequear(await estado.getAttribute("data-estado-pagina") === "publicada", "la página demo arranca publicada (🟢 Publicada)", "no dice que está publicada");

  // ── Compartir ──
  await estado.locator('button:has-text("Copiar link")').click();
  await estado.locator('button:has-text("Copiado")').waitFor({ timeout: 5000 });
  const copiado = await p.evaluate(() => navigator.clipboard.readText());
  chequear(/^http:\/\/demo\.localhost:\d+\/$/.test(copiado), `“Copiar link” copia ${copiado}`, `copió “${copiado}”`);
  const wa = new URL(await estado.locator('a:has-text("Compartir por WhatsApp")').getAttribute("href"));
  chequear(wa.searchParams.get("text")?.includes(copiado), `“Compartir por WhatsApp”: “${wa.searchParams.get("text")}”`, "el WhatsApp no lleva el link");

  // ── Al compartir: título, descripción e imagen ──
  const v = await pagina(b, COMPU);
  await v.goto(`${G}/`);
  await v.locator("h1").first().waitFor({ timeout: 30000 });
  const [ogT, ogD, ogI, tw] = [await meta(v, "og:title"), await meta(v, "og:description"), await meta(v, "og:image"), await meta(v, "twitter:card")];
  chequear(!!ogT && !!ogD && !!ogI && tw === "summary_large_image", `al compartir: “${ogT}” · “${ogD?.slice(0, 50)}…” · ${ogI}`, `faltan datos para compartir: ${ogT} / ${ogD} / ${ogI} / ${tw}`);
  const img = await v.request.get(ogI).catch(() => null);
  if (img) chequear(img.status() === 200 && /^image\//.test(img.headers()["content-type"] ?? ""), `la imagen para compartir se abre (${img.headers()["content-type"]})`, `la imagen dio ${img.status()}`);
  else {
    const otra = await v.context().newPage();
    const r = await otra.goto(ogI);
    chequear(r?.status() === 200 && /^image\//.test(r.headers()["content-type"] ?? ""), `la imagen para compartir se abre (${r?.headers()["content-type"]})`, `la imagen dio ${r?.status()}`);
    await otra.close();
  }

  // ── Borrador y de vuelta ──
  await estado.locator('button:has-text("Pasar a borrador")').click();
  await p.locator('[data-estado-pagina="borrador"]').waitFor({ timeout: 30000 });
  await v.reload(); await v.locator("h1").first().waitFor();
  chequear(/Estamos armando nuestra página/.test(await v.locator("body").innerText()), "pasar a borrador → la gente ve “Estamos armando nuestra página”", "en borrador se sigue viendo la página");
  chequear(/Estamos armando/.test(await meta(v, "og:description") ?? ""), "en borrador, al compartir dice que se está armando", "en borrador, la descripción para compartir no cambió");
  await capturar(p, "pag2-compu-borrador");
  await estado.locator('button:has-text("Publicar mi página")').click();
  await p.locator('[data-estado-pagina="publicada"]').waitFor({ timeout: 30000 });
  await v.reload(); await v.locator("h1").first().waitFor();
  chequear(!/Estamos armando nuestra página/.test(await v.locator("body").innerText()), "“Publicar mi página” la vuelve a mostrar", "sigue en borrador");
  await v.context().close();
  if (p.errores.length) falla(`dueña: ${p.errores.join(" | ")}`);
  await p.context().close();

  // ── Encargado: comparte pero no publica ──
  const e = await pagina(b, CELU);
  await entrar(e, "encargado@ejemplo.invalid");
  await e.goto(`${G}/panel/pagina`);
  await e.locator("[data-estado-pagina]").waitFor({ timeout: 60000 });
  chequear(await e.locator('[data-estado-pagina] button:has-text("borrador"), [data-estado-pagina] button:has-text("Publicar")').count() === 0
    && await e.locator('[data-estado-pagina] button:has-text("Copiar link")').count() === 1, "encargado: copia y comparte, no publica", "encargado puede publicar o no puede compartir");
  const ancho = await e.evaluate(() => document.documentElement.scrollWidth);
  chequear(ancho <= CELU.width, `celular: sin desborde (${ancho}px)`, `celular: mide ${ancho}px`);
  await capturar(e, "pag2-celu-encargado");
  await e.context().close();
} catch (e) {
  falla(`se cortó: ${process.env.E2E_DEPURAR ? e.message : e.message.split("\n")[0]}`);
}
await b.close();
resultado();
