// Colores de cada gimnasio: salen de sus datos (color_fondo, color_acento)
// y de acá se deriva todo lo demás. Funciones puras, con pruebas.
import type { CSSProperties } from "react";

const HEX = /^#?([0-9a-f]{6})$/i;

/** Luminancia relativa (WCAG) de un #rrggbb. null si no es un color válido. */
export function luminancia(hex: string): number | null {
  const m = HEX.exec(hex);
  if (!m) return null;
  const n = parseInt(m[1], 16);
  const canal = (c: number) => { const s = c / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * canal((n >> 16) & 255) + 0.7152 * canal((n >> 8) & 255) + 0.0722 * canal(n & 255);
}

/**
 * Color de texto sobre el acento. Blanco si llega a contraste 3:1 (WCAG AA
 * para texto grande y en negrita: los botones usan 16-18px bold); si no,
 * casi negro. Un violeta queda en blanco, un verde vivo o un amarillo en negro.
 */
export function textoSobre(hex: string): string {
  const l = luminancia(hex);
  if (l == null) return "#ffffff";
  return 1.05 / (l + 0.05) >= 3 ? "#ffffff" : "#1c1917";
}

/** "oscuro" si el texto claro se lee mejor que el oscuro sobre ese fondo. */
export function tonoDeFondo(hex: string): "oscuro" | "claro" {
  const l = luminancia(hex);
  if (l == null) return "oscuro";
  return 1.05 / (l + 0.05) >= (l + 0.05) / 0.05 ? "oscuro" : "claro";
}

export type ColoresMarca = { color_acento: string; color_fondo: string };

/** Variables CSS y atributo de tono para el wrapper de una pantalla del gimnasio. */
export function propsMarca(m: ColoresMarca): { style: CSSProperties; "data-tono": "oscuro" | "claro" } {
  return {
    style: {
      ["--acento" as string]: m.color_acento,
      ["--acento-texto" as string]: textoSobre(m.color_acento),
      ["--fondo" as string]: m.color_fondo,
      background: m.color_fondo,
    },
    "data-tono": tonoDeFondo(m.color_fondo),
  };
}
