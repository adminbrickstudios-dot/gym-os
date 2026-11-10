// BASE-6 · Chequeo de diseño: ningún color hex suelto y ningún emoji usado como ícono en src/.
//   - Colores: salen de los tokens (var(--...)) de globals.css. Un "#rrggbb" suelto en un componente no cambia con el tema claro/oscuro.
//   - Íconos: son del componente Icono (línea). Un emoji como ícono se ve distinto en cada sistema y no sigue la marca.
// Hoy el código todavía tiene muchos de los dos: la regla es de TRINQUETE. scripts/diseno-base.json guarda cuántos tiene cada archivo y
// el chequeo FALLA si algún archivo suma uno más (o un archivo nuevo trae alguno). Al convertir un archivo se baja su número con
//   node scripts/chequeos.mjs --actualizar-diseno
// y el total tiene que llegar a cero. Excepciones con motivo: ARCHIVOS_CON_COLOR (los que arman colores o imágenes y no pueden usar var()).
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative, sep } from "node:path";

const ARCHIVOS_CON_COLOR = new Set([
  "src/app/globals.css",          // acá viven los tokens
  "src/lib/marca.ts",             // calcula el contraste y la paleta de cada gimnasio a partir de su color
  "src/app/og/route.tsx",         // imagen para compartir: no hay CSS del sitio
  "src/app/manifest.ts",          // el manifest de la app pide colores literales
  "src/app/layout.tsx",           // viewport.themeColor pide un color literal (el del tema claro por defecto)
  "src/app/panel/configuracion/Ajustes.tsx",   // las muestras de fondo y de acento que ofrece el selector: son datos, no estilos
  "src/app/panel/grados/Grados.tsx",           // el color inicial del cinturón nuevo: dato del gimnasio
]);
const HEX = /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/g;
const EMOJI = /\p{Extended_Pictographic}/gu;

function recorrer(dir, salida = []) {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) { if (n !== "tipos" && n !== "node_modules") recorrer(p, salida); }
    else if (/\.(tsx?|css)$/.test(n) && !/\.test\.tsx?$/.test(n)) salida.push(p);
  }
  return salida;
}

/** Cuenta, por archivo, los colores sueltos y los emojis. Los emojis solo se cuentan en .tsx (JSX/strings de pantalla). */
export function contarDiseno(raiz) {
  const cuentas = {};
  for (const f of recorrer(join(raiz, "src"))) {
    const rel = relative(raiz, f).split(sep).join("/");
    const texto = readFileSync(f, "utf8");
    const hex = ARCHIVOS_CON_COLOR.has(rel) ? 0 : (texto.match(HEX) ?? []).length;
    const emoji = f.endsWith(".tsx") ? (texto.match(EMOJI) ?? []).length : 0;
    if (hex || emoji) cuentas[rel] = { hex, emoji };
  }
  return cuentas;
}

export function problemasDiseno(raiz, actualizar = false) {
  const archivo = join(raiz, "scripts", "diseno-base.json");
  const ahora = contarDiseno(raiz);
  if (actualizar) { writeFileSync(archivo, JSON.stringify(ahora, null, 1) + "\n"); return { problemas: [], total: ahora }; }
  const base = existsSync(archivo) ? JSON.parse(readFileSync(archivo, "utf8")) : {};
  const problemas = [];
  for (const [f, c] of Object.entries(ahora)) {
    const b = base[f] ?? { hex: 0, emoji: 0 };
    if (c.hex > b.hex) problemas.push(`${f}: ${c.hex - b.hex} color(es) suelto(s) de más (usá var(--…) de globals.css)`);
    if (c.emoji > b.emoji) problemas.push(`${f}: ${c.emoji - b.emoji} emoji(s) de más (usá <Icono>)`);
  }
  return { problemas, total: ahora };
}
