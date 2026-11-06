#!/usr/bin/env node
// CFG-2 · Logo, ícono y fotos desde el panel, con sesión real y archivos de
// verdad (supabase-local los guarda en .local/storage, como Storage).
//   npm run e2e:cfg-2            (con scripts/local/levantar.sh corriendo)
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { CELU, COMPU, GIMNASIO, capturar, chequear, entrar, entrarSocio, falla, navegador, ok, pagina, resultado } from "./comun.mjs";

const G = GIMNASIO();
const ALMACEN = join(process.cwd(), ".local", "storage", "marcas");
const archivosEn = (carpeta) => {
  const dir = join(ALMACEN, carpeta);
  return existsSync(dir) ? readdirSync(dir, { recursive: true }).filter((f) => !String(f).endsWith(".meta.json") && /\.(png|jpg|webp|svg)$/.test(String(f))) : [];
};

// Imágenes de verdad, dibujadas en un canvas del navegador.
async function imagen(p, { ancho, alto, color, texto, tipo = "image/png" }) {
  const datos = await p.evaluate(({ ancho, alto, color, texto, tipo }) => {
    const c = document.createElement("canvas"); c.width = ancho; c.height = alto;
    const x = c.getContext("2d");
    x.fillStyle = color; x.fillRect(0, 0, ancho, alto);
    x.fillStyle = "#fff"; x.font = `bold ${Math.round(alto / 3)}px sans-serif`; x.textAlign = "center"; x.textBaseline = "middle";
    x.fillText(texto, ancho / 2, alto / 2);
    return c.toDataURL(tipo, 0.85).split(",")[1];
  }, { ancho, alto, color, texto, tipo });
  return Buffer.from(datos, "base64");
}

const b = await navegador();
try {
  const p = await pagina(b, COMPU);
  await entrar(p, "duena@ejemplo.invalid");
  await p.goto(`${G}/panel/configuracion?pestana=marca`);
  await p.locator('fieldset[data-pestana-activa="marca"]').waitFor({ timeout: 30000 });
  const logoBox = p.locator('[data-imagen="logo"]');
  const esperar = async (zona, re) => { await zona.locator(".mensaje", { hasText: re }).waitFor({ timeout: 30000 }); return (await zona.locator(".mensaje").first().innerText()).replace(/\s+/g, " ").trim(); };

  // ── Logo PNG ──
  const png = await imagen(p, { ancho: 360, alto: 120, color: "#2fbf5b", texto: "DEMO GYM" });
  await p.setInputFiles('input[aria-label="Elegir logo"]', { name: "logo.png", mimeType: "image/png", buffer: png });
  await esperar(logoBox, /Logo listo/);
  const src = await logoBox.locator("img").getAttribute("src");
  chequear(/\/storage\/v1\/object\/public\/marcas\/.+\/marca\/logo-[0-9a-f]{32}\.(png|webp)$/.test(src ?? ""), "subir un PNG lo guarda en el bucket con una ruta del gimnasio", `el logo quedó en ${src}`);
  // Solo la carpeta de este gimnasio: otras bases locales anteriores pudieron dejar archivos con otro id.
  const carpeta = (src ?? "").match(/\/marcas\/([^/]+)\/marca\//)?.[1] ?? "sin-gimnasio";
  const vista = await p.context().newPage();
  const r = await vista.goto(src);
  chequear(r.status() === 200 && /^image\/(png|webp)$/.test(r.headers()["content-type"] ?? ""), "el logo se puede ver desde su link público", `el link del logo dio ${r.status()} ${r.headers()["content-type"]}`);
  await vista.close();
  await p.reload(); await p.locator('fieldset[data-pestana-activa="marca"]').waitFor();
  chequear(await p.locator("aside img").first().getAttribute("src") === src, "el logo aparece en la barra del panel", "la barra del panel no muestra el logo");
  await capturar(p, "cfg2-compu-marca");

  // ── Cambiar por un SVG: el archivo viejo se borra ──
  const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 40"><rect width="120" height="40" rx="8" fill="#3b82f6"/><text x="60" y="27" font-size="18" text-anchor="middle" fill="#fff">GYM</text></svg>');
  await p.setInputFiles('input[aria-label="Elegir logo"]', { name: "logo.svg", mimeType: "image/svg+xml", buffer: svg });
  await esperar(logoBox, /Logo listo/);
  const src2 = await logoBox.locator("img").getAttribute("src");
  const logos = archivosEn(carpeta).filter((f) => /logo-/.test(String(f)));
  chequear(src2 !== src && /\.svg$/.test(src2) && logos.length === 1, "cambiar el logo deja un solo archivo (el viejo se borra)", `quedaron ${logos.length} logos: ${logos.join(", ")}`);

  // ── Lo que no se acepta ──
  await p.setInputFiles('input[aria-label="Elegir logo"]', { name: "malo.svg", mimeType: "image/svg+xml", buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"><rect width="1" height="1"/></svg>') });
  let m = await esperar(logoBox, /código/);
  ok(`SVG con código → “${m}”`);
  await p.setInputFiles('input[aria-label="Elegir logo"]', { name: "factura.png", mimeType: "image/png", buffer: Buffer.from("%PDF-1.7 esto es un pdf con otro nombre") });
  m = await esperar(logoBox, /no es una imagen/);
  ok(`un PDF con nombre .png → “${m}”`);
  const grande = Buffer.concat([png.subarray(0, 16), Buffer.alloc(3 * 1024 * 1024)]);
  await p.setInputFiles('input[aria-label="Elegir logo"]', { name: "enorme.png", mimeType: "image/png", buffer: grande });
  m = await esperar(logoBox, /máximo es 2 MB/);
  ok(`una imagen de 3 MB → “${m}”`);
  chequear(await logoBox.locator("img").getAttribute("src") === src2, "después de los rechazos el logo sigue siendo el último bueno", "un rechazo cambió el logo");

  // ── Ícono ──
  const icono = await imagen(p, { ancho: 64, alto: 64, color: "#f97316", texto: "G" });
  await p.setInputFiles('input[aria-label="Elegir ícono"]', { name: "icono.png", mimeType: "image/png", buffer: icono });
  await esperar(p.locator('[data-imagen="favicon"]'), /Ícono listo/);
  await p.reload(); await p.locator('fieldset[data-pestana-activa="marca"]').waitFor();
  const iconos = await p.locator('link[rel="icon"]').evaluateAll((xs) => xs.map((x) => x.getAttribute("href")));
  chequear(iconos.length === 1 && /favicon-[0-9a-f]{32}\.png/.test(iconos[0] ?? ""), "el ícono de la pestaña del navegador es el que se subió (y ningún otro)", `íconos de la pestaña: ${iconos.join(", ")}`);

  // ── Quitar el logo ──
  await logoBox.locator('button:has-text("Quitar")').click();
  await esperar(logoBox, /sin logo/);
  chequear(archivosEn(carpeta).filter((f) => /logo-/.test(String(f))).length === 0, "quitar el logo borra el archivo", "quitar el logo dejó el archivo");
  await p.reload(); await p.locator('fieldset[data-pestana-activa="marca"]').waitFor();
  chequear(await p.locator("aside img").count() === 0, "sin logo, la barra muestra solo el nombre", "la barra sigue con una imagen");
  // Vuelve a dejar un logo para el resto (página y app).
  await p.setInputFiles('input[aria-label="Elegir logo"]', { name: "logo.png", mimeType: "image/png", buffer: png });
  await esperar(logoBox, /Logo listo/);

  // ── Fotos de la página ──
  await p.goto(`${G}/panel/configuracion?pestana=pagina`);
  const fotos = p.locator("[data-fotos]");
  await fotos.waitFor({ timeout: 30000 });
  // Empieza sin fotos (una corrida anterior pudo dejar algunas).
  while (Number(await fotos.getAttribute("data-fotos")) > 0) {
    const n = Number(await fotos.getAttribute("data-fotos"));
    await p.locator('button[aria-label="Quitar la foto 1"]').click();
    await p.waitForFunction((n) => Number(document.querySelector("[data-fotos]")?.getAttribute("data-fotos")) < n, n, { timeout: 30000 });
  }
  const tres = [];
  for (const [color, texto] of [["#ef4444", "1"], ["#3b82f6", "2"], ["#14b8a6", "3"]]) {
    tres.push({ name: `foto-${texto}.jpg`, mimeType: "image/jpeg", buffer: await imagen(p, { ancho: 800, alto: 600, color, texto, tipo: "image/jpeg" }) });
  }
  await p.setInputFiles('input[aria-label="Elegir fotos"]', tres);
  await esperar(fotos, /3 fotos sumadas/);
  chequear(await fotos.getAttribute("data-fotos") === "3", "se suman 3 fotos de una vez", `quedaron ${await fotos.getAttribute("data-fotos")} fotos`);
  const orden = async () => fotos.locator("[data-foto] img").evaluateAll((xs) => xs.map((x) => x.getAttribute("src")));
  const antes = await orden();
  await p.locator('button[aria-label="Mover la foto 1 después"]').click();
  await esperar(fotos, /Orden guardado/);
  const despues = await orden();
  chequear(despues[0] === antes[1] && despues[1] === antes[0], "▶ mueve la primera foto al segundo lugar", "el orden no cambió como se esperaba");
  chequear(await p.locator('button[aria-label="Mover la foto 1 antes"]').isDisabled(), "la primera foto no se puede mover antes", "◀ habilitado en la primera foto");
  await p.locator('button[aria-label="Quitar la foto 3"]').click();
  await esperar(fotos, /Foto quitada/);
  chequear(await fotos.getAttribute("data-fotos") === "2", "quitar una foto deja 2", `quedaron ${await fotos.getAttribute("data-fotos")}`);
  chequear(archivosEn(carpeta).filter((f) => /foto-/.test(String(f))).length === 2, "la foto quitada se borra del bucket", "quedó el archivo de la foto quitada");
  const once = await Promise.all(Array.from({ length: 11 }, (_, i) => imagen(p, { ancho: 40, alto: 40, color: "#a78bfa", texto: String(i) }).then((buffer) => ({ name: `x${i}.png`, mimeType: "image/png", buffer }))));
  await p.setInputFiles('input[aria-label="Elegir fotos"]', once);
  m = await esperar(fotos, /queda lugar para 10/);
  ok(`elegir 11 con 2 cargadas → “${m}”`);
  await capturar(p, "cfg2-compu-fotos", true);

  // La página pública muestra las fotos en el orden nuevo, y el logo.
  const pub = await p.context().newPage();
  await pub.goto(`${G}/`);
  const enPagina = await pub.locator('img[alt^="Foto "]').evaluateAll((xs) => xs.map((x) => x.getAttribute("src")));
  chequear(enPagina.length === 2 && enPagina[0] === despues[0], "la página del gimnasio muestra las 2 fotos en el orden elegido", `la página muestra ${enPagina.length} fotos`);
  chequear(await pub.locator('img[alt^="Logo de"]').count() > 0, "la página muestra el logo", "la página no muestra el logo");
  await capturar(pub, "cfg2-compu-pagina-publica");
  await pub.close();
  if (p.errores.length) falla(`dueña: ${p.errores.join(" | ")}`);
  await p.context().close();

  // ── Encargado: ve las imágenes, no sube ──
  const e = await pagina(b, COMPU);
  await entrar(e, "encargado@ejemplo.invalid");
  await e.goto(`${G}/panel/configuracion?pestana=marca`);
  await e.locator('[data-imagen="logo"] img').waitFor({ timeout: 30000 });
  const subirE = await e.locator('button:has-text("Subir"), button:has-text("Cambiar"), button:has-text("Quitar")').count();
  await e.goto(`${G}/panel/configuracion?pestana=pagina`);
  await e.locator("[data-fotos]").waitFor({ timeout: 30000 });
  const fotosE = await e.locator('button:has-text("Sumar fotos"), button[aria-label^="Quitar la foto"]').count();
  chequear(subirE === 0 && fotosE === 0, "encargado: ve logo y fotos sin botones para cambiarlos", `encargado ve ${subirE + fotosE} botones de imágenes`);
  await e.context().close();

  // ── Celular: Marca y la app del socio con el logo ──
  const c = await pagina(b, CELU);
  await entrar(c, "duena@ejemplo.invalid");
  await c.goto(`${G}/panel/configuracion?pestana=marca`);
  await c.locator('[data-imagen="logo"] img').waitFor({ timeout: 30000 });
  const ancho = await c.evaluate(() => document.documentElement.scrollWidth);
  chequear(ancho <= CELU.width, `celular: Marca sin desborde (${ancho}px)`, `celular: Marca mide ${ancho}px`);
  chequear(await c.locator("header img").count() > 0, "celular: el logo aparece en la barra de arriba", "celular: la barra no muestra el logo");
  await capturar(c, "cfg2-celu-marca", true);
  await c.goto(`${G}/panel/configuracion?pestana=pagina`);
  await c.locator("[data-fotos]").waitFor({ timeout: 30000 });
  await capturar(c, "cfg2-celu-fotos", true);
  await c.context().clearCookies();
  await entrarSocio(c, "+5490000100002");
  chequear(await c.locator("header img").count() > 0, "la app del socio muestra el logo del gimnasio", "la app del socio no muestra el logo");
  const iconoApp = await c.locator('link[rel="icon"]').evaluateAll((xs) => xs.map((x) => x.getAttribute("href")));
  chequear(iconoApp.length === 1 && /favicon-/.test(iconoApp[0] ?? ""), "la app del socio usa el ícono del gimnasio", `íconos de la app: ${iconoApp.join(", ")}`);
  await capturar(c, "cfg2-celu-app-socio");
  if (c.errores.length) falla(`celular: ${c.errores.join(" | ")}`);
  await c.context().close();
} catch (e) {
  falla(`se cortó: ${e.message.split("\n")[0]}`);
}
await b.close();
resultado();
