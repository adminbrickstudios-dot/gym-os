import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { OPCIONES, buscarOpciones } from "./indice";
import { PESTANAS } from "./pestanas";

const carpeta = __dirname;
const fuentes = readdirSync(carpeta).filter((f) => f.endsWith(".tsx")).map((f) => readFileSync(join(carpeta, f), "utf8")).join("\n");

describe("índice de Configuración (VD-21)", () => {
  it("cada opción tiene su ancla en la pantalla, una pestaña que existe y una explicación", () => {
    for (const o of OPCIONES) {
      const ancla = new RegExp(`(data-opcion|ancla)="([^"]* )?${o.id}( [^"]*)?"|: "${o.id}"`);
      expect(ancla.test(fuentes), `sin ancla en la pantalla: ${o.id}`).toBe(true);
      expect(PESTANAS.some((p) => p.clave === o.pestana), `pestaña inexistente: ${o.id}`).toBe(true);
      expect(o.explicacion.length, `sin explicación: ${o.id}`).toBeGreaterThan(10);
    }
  });
  it("no repite anclas", () => {
    expect(new Set(OPCIONES.map((o) => o.id)).size).toBe(OPCIONES.length);
  });
  it("encuentra por palabra, sin tildes ni mayúsculas, y ordena por título", () => {
    expect(buscarOpciones("reingreso")[0].id).toBe("visita-horas");
    expect(buscarOpciones("REINGRESO").map((o) => o.id)).toContain("reingreso");
    expect(buscarOpciones("fiado")[0].id).toBe("fiado");
    expect(buscarOpciones("caja").map((o) => o.id)).toContain("caja");
    expect(buscarOpciones("meta").map((o) => o.id)).toEqual(expect.arrayContaining(["meta-visitas", "meta-primer-mes"]));
    expect(buscarOpciones("zzzxx")).toEqual([]);
    expect(buscarOpciones("   ")).toEqual([]);
  });
});
