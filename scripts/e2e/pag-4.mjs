#!/usr/bin/env node
// PAG-4 · Aparecer en Google: la página publicada tiene los datos del
// gimnasio para Google (y coinciden con lo que se ve: sedes y horarios),
// robots.txt y sitemap.xml por dirección; sin publicar no se indexa; el panel
// y la app tampoco.
//   npm run e2e:pag-4            (con scripts/local/levantar.sh corriendo)
import { COMPU, GIMNASIO, chequear, entrar, falla, navegador, pagina, resultado } from "./comun.mjs";

const G = GIMNASIO();
const b = await navegador();
try {
  const v = await pagina(b, COMPU);
  await v.goto(`${G}/`);
  await v.locator("h1").first().waitFor({ timeout: 30000 });
  const ld = JSON.parse(await v.locator('script[type="application/ld+json"]').first().textContent());
  const datos = Array.isArray(ld) ? ld[0] : ld;
  chequear(datos["@type"] === "ExerciseGym" && datos.name && datos.url, `datos para Google: ${datos["@type"]} “${datos.name}”`, `JSON-LD: ${JSON.stringify(datos).slice(0, 200)}`);
  const direccion = (await v.locator('section[aria-labelledby="ubicacion"]').innerText().catch(() => "")).replace(/\s+/g, " ");
  chequear(!datos.address || direccion.includes(datos.address.streetAddress), `la dirección coincide con la página (${datos.address?.streetAddress ?? "sin dirección"})`, `dirección: ${datos.address?.streetAddress} no está en “${direccion}”`);
  const lunes = (datos.openingHoursSpecification ?? []).find((x) => x.dayOfWeek === "Monday");
  const horarios = (await v.locator('section[aria-labelledby="horarios"]').innerText().catch(() => "")).replace(/\s+/g, " ");
  chequear(!lunes || horarios.includes(lunes.opens.replace(/^0/, "")), `el horario del lunes coincide (${lunes ? `${lunes.opens}–${lunes.closes}` : "sin horarios"})`, `horario ${lunes?.opens} no está en “${horarios}”`);
  chequear(await v.locator('meta[name="robots"]').getAttribute("content").catch(() => null) !== "noindex, nofollow", "la página publicada se puede indexar", "la página publicada dice noindex");
  const robots = await (await v.request.get(`${G}/robots.txt`).catch(() => null))?.text().catch(() => null) ?? await v.evaluate(async (u) => (await fetch(u)).text(), `${G}/robots.txt`);
  chequear(/Disallow: \/panel/.test(robots) && /Sitemap: .*\/sitemap\.xml/.test(robots), "robots.txt: deja la página, esconde el panel y la app, y dice dónde está el sitemap", `robots.txt: ${robots}`);
  const sitemap = await v.evaluate(async (u) => (await fetch(u)).text(), `${G}/sitemap.xml`);
  chequear(/<loc>http:\/\/demo\.localhost:\d+\/<\/loc>/.test(sitemap), "sitemap.xml tiene la página", `sitemap: ${sitemap.slice(0, 200)}`);

  // ── El panel y la app no se indexan ──
  const d = await pagina(b, COMPU);
  await entrar(d, "duena@ejemplo.invalid");
  await d.goto(`${G}/panel`);
  chequear(/noindex/.test(await d.locator('meta[name="robots"]').getAttribute("content") ?? ""), "el panel dice noindex", "el panel se puede indexar");

  // ── Sin publicar: noindex y robots dice que no ──
  await d.goto(`${G}/panel/pagina`);
  await d.locator('[data-estado-pagina="publicada"] button:has-text("Pasar a borrador")').click();
  await d.locator('[data-estado-pagina="borrador"]').waitFor({ timeout: 30000 });
  await v.goto(`${G}/`);
  await v.locator("h1").first().waitFor();
  chequear(/noindex/.test(await v.locator('meta[name="robots"]').getAttribute("content") ?? "") && !(await v.locator('script[type="application/ld+json"]').count()),
    "sin publicar: noindex y sin datos para Google", "sin publicar se puede indexar");
  const robots2 = await v.evaluate(async (u) => (await fetch(u)).text(), `${G}/robots.txt`);
  chequear(/Disallow: \/\s*$/m.test(robots2) && !/Allow: \//.test(robots2), "sin publicar: robots.txt dice que no a todo", `robots.txt sin publicar: ${robots2}`);
  await d.locator('button:has-text("Publicar mi página")').click();
  await d.locator('[data-estado-pagina="publicada"]').waitFor({ timeout: 30000 });
  if (v.errores.length) falla(`visitante: ${v.errores.join(" | ")}`);
  await d.context().close(); await v.context().close();
} catch (e) {
  falla(`se cortó: ${process.env.E2E_DEPURAR ? e.message : e.message.split("\n")[0]}`);
}
await b.close();
resultado();
