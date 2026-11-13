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

/**
 * Z8 · El acento de un gimnasio nunca se confunde con el semáforo (DISENO.md § Tokens): si queda a menos de DISTANCIA_SEMAFORO de
 * --ok, --no, --atencion o --prueba, se corre de tono (se aleja de ese color por la rueda de colores) lo justo para distinguirse.
 * Solo se corre el ACENTO; el semáforo no cambia nunca. Un color que ya se distingue se devuelve igual (mismo texto).
 */
export const SEMAFORO = { ok: "#1E9E5A", no: "#D6383A", atencion: "#D88A0B", prueba: "#2D6FD8" } as const;
export const DISTANCIA_SEMAFORO = 45;
const rgb = (hex: string): [number, number, number] | null => { const m = HEX.exec(hex); if (!m) return null; const n = parseInt(m[1], 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const distancia = (a: [number, number, number], b: [number, number, number]) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
function aHsl([r, g, b]: [number, number, number]): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, d = max - min;
  if (d === 0) return [0, 0, l];
  const sat = d / (1 - Math.abs(2 * l - 1));
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [(h * 60 + 360) % 360, sat, l];
}
function deHsl(h: number, s: number, l: number): string {
  const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = l - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  const hex = (v: number) => Math.round((v + m) * 255).toString(16).padStart(2, "0");
  return `#${hex(r)}${hex(g)}${hex(b)}`;
}
export function acentoDistinto(acento: string): string {
  const c = rgb(acento);
  if (!c) return acento;
  const cercano = (Object.values(SEMAFORO) as string[]).map((h) => ({ h, d: distancia(c, rgb(h)!) })).filter((x) => x.d < DISTANCIA_SEMAFORO).sort((a, b) => a.d - b.d)[0];
  if (!cercano) return acento;
  const [h, s, l] = aHsl(c);
  const [hs] = aHsl(rgb(cercano.h)!);
  // Hacia qué lado girar: alejándose del tono del semáforo (si es el mismo tono, hacia el lado de los números crecientes).
  let dif = ((h - hs + 540) % 360) - 180;
  const lado = dif >= 0 ? 1 : -1;
  for (let grados = 24; grados <= 72; grados += 8) {
    const nuevo = deHsl((h + lado * grados + 360) % 360, s, l);
    if (Object.values(SEMAFORO).every((x) => distancia(rgb(nuevo)!, rgb(x)!) >= DISTANCIA_SEMAFORO)) return nuevo.toUpperCase();
  }
  return acento;
}

export type ColoresMarca = { color_acento: string; color_fondo: string };

/** Variables CSS y atributo de tono para el wrapper de una pantalla del gimnasio. */
export const FONDO_CLARO = "#F4F5F6", FONDO_OSCURO = "#111315";
/** El acento con el que arranca un gimnasio nuevo en el alta (el super admin lo cambia en el formulario). */
export const ACENTO_POR_DEFECTO = "#16a34a";
/** `tema`: lo que eligió la persona en Mi cuenta (cookie `tema`, D37). Si elige claro u oscuro manda sobre el fondo del gimnasio (el acento sigue siendo el del gimnasio). */
export function propsMarca(m: ColoresMarca, tema?: string | null): { style: CSSProperties; "data-tono": "oscuro" | "claro" } {
  const fondo = tema === "oscuro" ? FONDO_OSCURO : tema === "claro" ? FONDO_CLARO : m.color_fondo;
  return {
    style: {
      ["--acento" as string]: acentoDistinto(m.color_acento),
      ["--acento-texto" as string]: textoSobre(acentoDistinto(m.color_acento)),
      ["--fondo" as string]: fondo,
      background: fondo,
    },
    "data-tono": tonoDeFondo(fondo),
  };
}
