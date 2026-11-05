// CSV para abrir con Excel en castellano: punto y coma, BOM para los acentos,
// comillas cuando hace falta. Función pura.
export function aCsv(titulos: string[], filas: (string | number | null | undefined)[][]): string {
  const celda = (v: string | number | null | undefined) => {
    const t = v == null ? "" : String(v);
    return /[;"\n\r]/.test(t) || /^[=+\-@]/.test(t) ? `"${(/^[=+\-@]/.test(t) && !/^[+-]?\d/.test(t) ? "'" : "") + t.replace(/"/g, '""')}"` : t;
  };
  return "﻿" + [titulos, ...filas].map((f) => f.map(celda).join(";")).join("\r\n") + "\r\n";
}
