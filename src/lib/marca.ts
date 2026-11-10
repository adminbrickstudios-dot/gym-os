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

/** Contraste WCAG entre dos colores (1 a 21). null si alguno no es un color válido. */
export function contraste(a: string, b: string): number | null {
  const la = luminancia(a), lb = luminancia(b);
  if (la == null || lb == null) return null;
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/**
 * El color principal sobre el fondo: los links, los bordes y los botones
 * tienen que distinguirse del fondo. Debajo de 3:1 (WCAG para elementos de
 * interfaz y texto grande) se avisa; no se prohíbe.
 */
export const CONTRASTE_MINIMO = 3;
export function seLeePoco(acento: string, fondo: string): boolean {
  const c = contraste(acento, fondo);
  return c != null && c < CONTRASTE_MINIMO;
}

export type ColoresMarca = { color_acento: string; color_fondo: string };

/** Variables CSS y atributo de tono para el wrapper de una pantalla del gimnasio. */
export const FONDO_CLARO = "#F4F5F6", FONDO_OSCURO = "#111315";
/** `tema`: lo que eligió la persona en Mi cuenta (cookie `tema`, D37). Si elige claro u oscuro manda sobre el fondo del gimnasio (el acento sigue siendo el del gimnasio). */
export function propsMarca(m: ColoresMarca, tema?: string | null): { style: CSSProperties; "data-tono": "oscuro" | "claro" } {
  const fondo = tema === "oscuro" ? FONDO_OSCURO : tema === "claro" ? FONDO_CLARO : m.color_fondo;
  return {
    style: {
      ["--acento" as string]: m.color_acento,
      ["--acento-texto" as string]: textoSobre(m.color_acento),
      ["--fondo" as string]: fondo,
      background: fondo,
    },
    "data-tono": tonoDeFondo(fondo),
  };
}
