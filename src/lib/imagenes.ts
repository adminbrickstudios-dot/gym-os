// Qué es de verdad un archivo de imagen, mirando sus primeros bytes (el
// "type" que manda el navegador lo pone la extensión, y se puede mentir).

export type TipoImagen = "image/png" | "image/jpeg" | "image/webp" | "image/svg+xml";

/** El tipo real por la firma del archivo, o null si no es una imagen que aceptamos. */
export function tipoReal(bytes: Uint8Array): TipoImagen | null {
  const b = (i: number) => bytes[i];
  if (bytes.length >= 8 && b(0) === 0x89 && b(1) === 0x50 && b(2) === 0x4e && b(3) === 0x47 && b(4) === 0x0d && b(5) === 0x0a) return "image/png";
  if (bytes.length >= 3 && b(0) === 0xff && b(1) === 0xd8 && b(2) === 0xff) return "image/jpeg";
  if (bytes.length >= 12 && String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP") return "image/webp";
  const inicio = new TextDecoder("utf-8", { fatal: false }).decode(bytes.slice(0, 1024)).replace(/^﻿/, "").trimStart();
  if (/^(<\?xml[^>]*>\s*)?(<!--[\s\S]*?-->\s*)*(<!DOCTYPE svg[^>]*>\s*)?<svg[\s>]/i.test(inicio)) return "image/svg+xml";
  return null;
}

/**
 * Un SVG que se puede mostrar sin riesgo: sin scripts, sin manejadores de
 * eventos, sin links javascript:, sin contenido HTML embebido ni archivos
 * externos. Si tiene algo de eso, se rechaza (no se "limpia").
 */
export function svgSeguro(texto: string): boolean {
  return !/<script|<foreignObject|<iframe|<embed|<object|\son[a-z]+\s*=|javascript:|data:text\/html|<!ENTITY|xlink:href\s*=\s*(?!["']?#)|\shref\s*=\s*(?!["']?#)/i.test(texto);
}
