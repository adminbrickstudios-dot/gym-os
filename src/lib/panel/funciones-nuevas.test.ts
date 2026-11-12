import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { FUNCIONES_NUEVAS } from "./funciones-nuevas-lista";

// Las claves que ofrece Configuración tienen que ser las mismas que acepta la base: si una sobra o falta, el interruptor da error.
describe("funciones nuevas con interruptor", () => {
  const sql = readFileSync("supabase/migrations/20261112010000_funciones_nuevas_f45.sql", "utf8");
  const enLaBase = [...(sql.match(/p_clave not in \(([^)]*)\)/)?.[1] ?? "").matchAll(/'([a-z_]+)'/g)].map((m) => m[1]).sort();

  it("las claves del panel son las de la lista blanca de la base", () => {
    expect(FUNCIONES_NUEVAS.map((f) => f.clave).sort()).toEqual(enLaBase);
    expect(enLaBase.length).toBeGreaterThan(0);
  });
  it("cada una tiene título y ayuda para el dueño", () => {
    for (const f of FUNCIONES_NUEVAS) { expect(f.titulo.length).toBeGreaterThan(5); expect(f.ayuda.length).toBeGreaterThan(20); }
  });
  it("arrancan apagadas: la columna se crea con lista vacía", () => {
    expect(sql).toMatch(/funciones_nuevas text\[\] not null default '\{\}'/);
  });
});
