import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { NOMBRE_PRODUCTO } from "./producto";

/** D69: el nombre del producto sale de un solo lugar (`src/lib/producto.ts`). */
function archivos(dir: string, acc: string[] = []): string[] {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) { if (n !== "node_modules") archivos(p, acc); }
    else if (/\.(ts|tsx)$/.test(n) && !/\.test\.(ts|tsx)$/.test(n) && n !== "producto.ts") acc.push(p);
  }
  return acc;
}

/** Saca comentarios de línea y de bloque (el nombre de un comentario no lo ve nadie). */
function sinComentarios(s: string): string {
  return s.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " ")).replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
}

describe("D69 · el nombre del producto", () => {
  it("es Pase", () => { expect(NOMBRE_PRODUCTO).toBe("Pase"); });

  it("no aparece escrito a mano en src/ (ni el nombre nuevo ni el viejo)", () => {
    const malos: string[] = [];
    for (const f of archivos("src")) {
      const limpio = sinComentarios(readFileSync(f, "utf8"));
      limpio.split("\n").forEach((ln, i) => {
        // "Base de datos" y "Bases de Datos" son la palabra común; "Pase" a mano es el nombre escrito a mano.
        if (/\bBase\b(?! de datos)/.test(ln) || /\bPase\b(?! (diario|libre))/.test(ln)) malos.push(`${f}:${i + 1}: ${ln.trim().slice(0, 100)}`);
      });
    }
    expect(malos, `El nombre del producto va con NOMBRE_PRODUCTO (src/lib/producto.ts):\n${malos.join("\n")}`).toEqual([]);
  });
});
