#!/usr/bin/env node
// C3 · Las capturas de las guías de uso. Entra con cada usuario demo (recepción, dueña, profe, socio), abre cada pantalla de
// src/lib/guias-capturas.json y guarda la imagen en public/guias/<archivo>.png: las lee la página de la guía (si el archivo no está, la
// guía se ve igual, sin imagen). Después abre cada guía en papel A4 y guarda su PDF en .local/capturas/guias/ para mirarlo.
//   node scripts/e2e/guias-capturas.mjs     (con scripts/local/levantar.sh corriendo; en GitHub Actions sube public/guias/ como artefacto)
//   GUIAS_SALIDA=<carpeta>                   cambia dónde se guardan las imágenes (por defecto public/guias)
// Todo sale del gimnasio demo: datos ficticios (teléfonos 000, mails @ejemplo.invalid). ESCRITO, NO EJECUTADO por quien lo escribió.
import { mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { CAPTURAS, CELU, COMPU, GIMNASIO, PANTALLA_ROTA, chequear, entrar, navegador, pagina, resultado } from "./comun.mjs";
process.on("unhandledRejection", (e) => { console.log(`✗ se cortó (sin atrapar): ${String(e?.message ?? e).split("\n").slice(0, 3).join(" | ")}`); process.exit(1); });

const SALIDA = process.env.GUIAS_SALIDA ?? join(process.cwd(), "public", "guias");
const PDFS = join(CAPTURAS, "guias");
mkdirSync(SALIDA, { recursive: true });
mkdirSync(PDFS, { recursive: true });
const LISTA = JSON.parse(readFileSync(join(process.cwd(), "src", "lib", "guias-capturas.json"), "utf8"));
const USUARIOS = { recepcion: "recepcion@ejemplo.invalid", dueno: "duena@ejemplo.invalid", profe: "profe@ejemplo.invalid", socio: "socio@ejemplo.invalid" };
const BASE = GIMNASIO("demo");

const b = await navegador();
try {
  for (const rol of Object.keys(USUARIOS)) {
    const mias = LISTA.filter((c) => c.rol === rol);
    const p = await pagina(b, rol === "socio" ? CELU : COMPU);
    p.setDefaultNavigationTimeout(120000);
    await entrar(p, USUARIOS[rol], undefined, BASE);
    for (const c of mias) {
      await p.goto(`${BASE}${c.ruta}`);
      await p.locator("h1, main").first().waitFor({ timeout: 60000 }).catch(() => {});
      await p.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
      const texto = await p.locator("body").innerText().catch(() => "");
      const bien = !p.url().includes("/ingresar") && !PANTALLA_ROTA.test(texto) && !/No tenés acceso|No se pudo cargar esta pantalla/.test(texto);
      chequear(bien, `${rol}: ${c.ruta} abre`, `${rol}: ${c.ruta} no abre bien (${p.url()})`);
      if (!bien) continue;
      // Sin las animaciones de entrada: la imagen sale quieta y completa.
      await p.addStyleTag({ content: "*,*::before,*::after{animation:none!important;transition:none!important}" }).catch(() => {});
      await p.screenshot({ path: join(SALIDA, `${c.archivo}.png`), type: "png" });
      chequear(true, `${c.archivo}.png guardada`, "");
    }
    await p.context().close();
  }

  // Cada guía en papel A4, como la imprime el navegador: queda el PDF para mirarlo (hoja, cortes de página, color).
  const d = await pagina(b, COMPU);
  d.setDefaultNavigationTimeout(120000);
  await entrar(d, USUARIOS.dueno, undefined, BASE);
  for (const rol of ["recepcion", "dueno", "profe", "socio"]) {
    await d.goto(`${BASE}/panel/ayuda/guias/${rol}`);
    await d.locator("[data-guia]").waitFor({ timeout: 60000 });
    const pasos = await d.locator("[data-paso]").count();
    chequear(pasos > 0 && pasos <= 10, `guía ${rol}: ${pasos} pasos (máximo 10)`, `guía ${rol}: ${pasos} pasos`);
    await d.emulateMedia({ media: "print" });
    await d.pdf({ path: join(PDFS, `guia-${rol}.pdf`), format: "A4", printBackground: true, preferCSSPageSize: true });
    await d.emulateMedia({ media: "screen" });
    chequear(true, `guia-${rol}.pdf guardado en ${PDFS}`, "");
  }
} finally {
  await b.close();
}
resultado();
