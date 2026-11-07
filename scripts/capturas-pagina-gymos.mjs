#!/usr/bin/env node
// VD-62 · Capturas reales para la página de Gym OS (la que vende el producto).
// Con la app local corriendo (scripts/local/levantar.sh y el gimnasio demo sembrado), entra con los usuarios demo,
// saca el panel (compu) y la app del socio (celular), las optimiza (WebP, ancho acotado) y las deja en
// public/gymos/. Después escribe src/lib/capturas-gymos.json, que es lo que la página lee: con la lista vacía
// la página muestra sus ilustraciones simples; con capturas, muestra estas.
//   node scripts/capturas-pagina-gymos.mjs
// Solo datos del demo (nombres y teléfonos ficticios). No se corre contra producción (lo frena comun.mjs).
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import { CELU, GIMNASIO, entrar, navegador, pagina } from "./e2e/comun.mjs";

const G = GIMNASIO();
const SALIDA = join(process.cwd(), "public", "gymos");
mkdirSync(SALIDA, { recursive: true });

// Qué se saca: usuario demo, pantalla, tamaño, y el texto que la describe para quien no la ve.
const TOMAS = [
  { archivo: "panel-entrada", mail: "recepcion@ejemplo.invalid", ruta: "/panel/entrada", celular: false, ancho: 1280,
    titulo: "La entrada: verde, amarillo o rojo, con el motivo.", alt: "Pantalla de entrada del panel de recepción de Gym OS, con el resultado del socio y por qué." },
  { archivo: "panel-inicio", mail: "duena@ejemplo.invalid", ruta: "/panel", celular: false, ancho: 1280,
    titulo: "El inicio de la dueña: lo que hay que hacer hoy.", alt: "Pantalla de inicio del panel de la dueña de un gimnasio en Gym OS." },
  { archivo: "panel-retencion", mail: "duena@ejemplo.invalid", ruta: "/panel/retencion", celular: false, ancho: 1280,
    titulo: "Quién dejó de venir, para escribirle a tiempo.", alt: "Lista de retención de Gym OS con los socios que dejaron de venir." },
  { archivo: "app-socio", mail: "socio@ejemplo.invalid", ruta: "/app", celular: true, ancho: 390,
    titulo: "La app del socio, sin instalar nada.", alt: "App del socio en el celular: su estado, su QR y sus clases." },
];

const b = await navegador();
const manifiesto = [];
try {
  for (const t of TOMAS) {
    const p = await pagina(b, t.celular ? CELU : { width: 1280, height: 800 });
    await entrar(p, t.mail);
    await p.goto(`${G}${t.ruta}`);
    await p.locator("main").first().waitFor({ timeout: 60000 });
    await p.waitForTimeout(1500);
    const png = await p.screenshot({ type: "png", fullPage: false });
    // WebP, el ancho justo (la captura del celular al doble para pantallas nítidas) y sin metadatos.
    const salida = await sharp(png).resize({ width: t.celular ? t.ancho * 2 : t.ancho, withoutEnlargement: false }).webp({ quality: 72 }).toBuffer({ resolveWithObject: true });
    writeFileSync(join(SALIDA, `${t.archivo}.webp`), salida.data);
    manifiesto.push({ archivo: `/gymos/${t.archivo}.webp`, ancho: salida.info.width, alto: salida.info.height, alt: t.alt, titulo: t.titulo });
    console.log(`✓ ${t.archivo}.webp ${salida.info.width}x${salida.info.height} ${(salida.data.length / 1024).toFixed(0)} KB`);
    await p.context().close();
  }
  writeFileSync(join(process.cwd(), "src", "lib", "capturas-gymos.json"), JSON.stringify(manifiesto, null, 2) + "\n");
  console.log(`✓ ${manifiesto.length} capturas en public/gymos y lista en src/lib/capturas-gymos.json`);
} catch (e) {
  console.error("✗ no se pudieron sacar las capturas:", e.message);
  process.exitCode = 1;
} finally {
  await b.close();
}
