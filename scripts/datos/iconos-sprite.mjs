#!/usr/bin/env node
// Cierre para vender (25/11) · Los íconos de línea salen del JS: los trazos viven en src/components/ui/iconos.json y este script arma
//   public/iconos.svg                       el sprite (un <symbol> por ícono; se baja una vez y queda en caché)
//   src/components/ui/iconos-nombres.ts     la lista de nombres y la versión (el hash del sprite, para que el navegador no use uno viejo)
// <Icono> dibuja <svg><use href="/iconos.svg?v=…#nombre"/></svg>: ninguna pantalla lleva los trazos de todos los íconos en su JS.
//   node scripts/datos/iconos-sprite.mjs            escribe los dos archivos
//   node scripts/datos/iconos-sprite.mjs --verificar  falla si no están al día (lo corre npm run chequeos y la prueba de Icono)
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const raiz = fileURLToPath(new URL("../../", import.meta.url));
export function armar() {
  const iconos = JSON.parse(readFileSync(`${raiz}src/components/ui/iconos.json`, "utf8"));
  const simbolos = Object.entries(iconos).map(([n, trazos]) => `<symbol id="${n}" viewBox="0 0 24 24">${trazos.map((d) => `<path d="${d}"/>`).join("")}</symbol>`);
  const sprite = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">\n${simbolos.join("\n")}\n</svg>\n`;
  const version = createHash("sha1").update(sprite).digest("hex").slice(0, 10);
  const nombres = `// Generado por scripts/datos/iconos-sprite.mjs (no se edita a mano: se cambia iconos.json y se corre el script).\n`
    + `export const VERSION_ICONOS = "${version}";\n`
    + `export const NOMBRES_ICONO = ${JSON.stringify(Object.keys(iconos))} as const;\n`;
  return { sprite, nombres };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const { sprite, nombres } = armar();
  const rutas = { [`${raiz}public/iconos.svg`]: sprite, [`${raiz}src/components/ui/iconos-nombres.ts`]: nombres };
  if (process.argv.includes("--verificar")) {
    const viejos = Object.entries(rutas).filter(([r, t]) => { try { return readFileSync(r, "utf8") !== t; } catch { return true; } });
    if (viejos.length) { console.error(`Los íconos no están al día (${viejos.map(([r]) => r.replace(raiz, "")).join(", ")}): node scripts/datos/iconos-sprite.mjs`); process.exit(1); }
    console.log("íconos al día");
  } else {
    for (const [r, t] of Object.entries(rutas)) writeFileSync(r, t);
    console.log("íconos escritos");
  }
}
