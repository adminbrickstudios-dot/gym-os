#!/usr/bin/env node
// PUSH-1 · Notificaciones: Mi cuenta y la app del socio muestran dónde
// activarlas (o por qué no se puede, nunca un botón muerto), el service worker
// y el manifest (para instalar la app en el celular) se sirven con la marca.
// El envío real se prueba aparte (src/lib/push.test.ts: cifrado y firma).
//   npm run e2e:push-1            (con scripts/local/levantar.sh corriendo)
// El pedido va desde el navegador: *.localhost no siempre resuelve desde Node.
const bajar = (p, url) => p.evaluate(async (u) => { const r = await fetch(u); return { status: r.status, ok: r.ok, tipo: r.headers.get("content-type") ?? "", texto: await r.text() }; }, url);
import { CELU, COMPU, GIMNASIO, chequear, entrar, falla, navegador, ok, pagina, resultado } from "./comun.mjs";

const G = GIMNASIO();
const ESTADOS = /^(activo|apagado|sin-claves|sin-soporte|iphone)$/;
const b = await navegador();
try {
  const d = await pagina(b, COMPU);
  await entrar(d, "duena@ejemplo.invalid");
  await d.goto(`${G}/panel/cuenta`);
  const zona = d.locator("[data-push]");
  await zona.waitFor({ timeout: 60000 });
  const estado = await zona.getAttribute("data-push");
  chequear(ESTADOS.test(estado), `Mi cuenta → Notificaciones (${estado}: ${(await zona.innerText()).split("\n")[0]})`, estado);
  if (d.errores.length) falla(`dueña: ${d.errores.join(" | ")}`);

  const p = await pagina(b, COMPU);
  await entrar(p, "profe@ejemplo.invalid");
  await p.goto(`${G}/panel/cuenta`);
  await p.locator("main h1").waitFor({ timeout: 60000 });
  chequear(await p.locator("[data-push]").count() === 0, "el profe no tiene (todavía no hay avisos para él)", "el profe ve notificaciones");

  const s = await pagina(b, CELU);
  await entrar(s, "socio@ejemplo.invalid");
  await s.goto(`${G}/app/novedades`);
  await s.locator("[data-push]").waitFor({ timeout: 60000 });
  ok(`el socio las activa desde Novedades (${await s.locator("[data-push]").getAttribute("data-push")})`);

  const sw = await bajar(s, `${G}/sw.js`);
  chequear(sw.ok && /showNotification/.test(sw.texto), "el service worker se sirve", `sw.js ${sw.status}`);
  const m = await bajar(s, `${G}/manifest.webmanifest`);
  const man = m.ok ? JSON.parse(m.texto) : null;
  chequear(man?.display === "standalone" && man?.start_url === "/app" && man?.name && man.name !== "Base", `manifest con la marca: “${man?.name}”, se instala como app`, JSON.stringify(man));
  // Android ofrece "Instalar" solo con un ícono de 512; el nombre corto no corta una palabra; hay accesos directos.
  const tam512 = (man?.icons ?? []).some((i) => /512/.test(i.sizes ?? "")) || (man?.icons ?? []).some((i) => i.sizes === "any");
  chequear(tam512, "el manifest trae un ícono de 512 (o uno que sirve para cualquier tamaño)", JSON.stringify(man?.icons));
  chequear(man?.id && man?.shortcuts?.length > 0 && man?.short_name && man.short_name.length <= 12, `manifest con id, accesos directos y nombre corto “${man?.short_name}”`, JSON.stringify(man));
  const robots = await bajar(s, `${G}/robots.txt`);
  chequear(robots.ok && ((/Disallow: \/profe/.test(robots.texto) && /Disallow: \/kiosco/.test(robots.texto) && /Disallow: \/tv/.test(robots.texto)) || /Disallow: \/\s*$/m.test(robots.texto)), "robots no deja indexar /profe, /kiosco ni /tv (o la página está sin publicar y no deja indexar nada)", robots.texto?.slice(0, 300));
  const ic = await bajar(s, `${G}/icono?tam=512`);
  chequear(ic.ok, "el ícono sin logo también sale en 512", `icono ${ic.status}`);
} catch (e) {
  falla(`se cortó: ${process.env.E2E_DEPURAR ? e.message : e.message.split("\n")[0]}`);
}
await b.close();
resultado();
