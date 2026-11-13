import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Un solo interruptor por gimnasio: el catálogo vive en la base (la última versión de privado.funciones_nuevas_catalogo).
// Las claves que el código pregunta tienen que estar en ese catálogo, y el sistema viejo no puede volver.
const carpeta = "supabase/migrations";
const ultimaDelCatalogo = readdirSync(carpeta).filter((f) => f.endsWith(".sql")).sort().reverse()
  .find((f) => readFileSync(`${carpeta}/${f}`, "utf8").includes("create or replace function privado.funciones_nuevas_catalogo"))!;
const sql = readFileSync(`${carpeta}/${ultimaDelCatalogo}`, "utf8");
const catalogo = [...sql.matchAll(/jsonb_build_object\('clave', '([a-z_]+)'/g)].map((m) => m[1]);

describe("funciones nuevas: un solo interruptor", () => {
  it("el catálogo tiene las nueve claves, sin repetir", () => {
    expect(new Set(catalogo).size).toBe(catalogo.length);
    expect([...catalogo].sort()).toEqual(["apto_vencimiento", "borrador_alta", "debito_automatico", "horarios_pico", "origen_altas", "panel_pago", "resumen_noche", "valor_del_socio", "vuelto_efectivo"]);
  });
  it("cada una trae título, explicación y la frase de “Qué hay de nuevo”", () => {
    for (const c of catalogo) {
      const bloque = sql.slice(sql.indexOf(`'clave', '${c}'`)).split("jsonb_build_object('clave'")[0];
      expect(bloque).toMatch(/'titulo', '[^']{6,}'/);
      expect(bloque).toMatch(/'explicacion', '[^']{20,}'/);
      expect(bloque).toMatch(/'novedad', '[^']{20,}'/);
    }
  });
  it("el código solo pregunta por claves que existen en el catálogo", () => {
    const usos = [["src/app/panel/socios/nuevo/page.tsx", "borrador_alta"], ["src/app/panel/entrada/ventana-acciones.ts", "panel_pago"], ["src/app/panel/resultado/page.tsx", "horarios_pico"], ["src/app/panel/resultado/page.tsx", "valor_del_socio"]];
    for (const [archivo, clave] of usos) {
      expect(readFileSync(archivo, "utf8")).toContain(`"${clave}"`);
      expect(catalogo).toContain(clave);
    }
  });
  it("el código ya no usa el sistema viejo", () => {
    for (const archivo of ["src/lib/panel/funciones-nuevas.ts", "src/app/panel/entrada/ventana-acciones.ts", "src/app/panel/configuracion/acciones.ts"]) {
      const t = readFileSync(archivo, "utf8");
      expect(t).not.toMatch(/"funciones_nuevas_gimnasio"|"guardar_funcion_nueva"/);
    }
  });
});
