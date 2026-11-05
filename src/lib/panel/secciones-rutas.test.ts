import { describe, expect, it } from "vitest";
import { rutaDisponible } from "./secciones";

describe("rutaDisponible", () => {
  it("una sección apagada apaga sus subpantallas", () => {
    expect(rutaDisponible("/panel/socios/123", "dueno", ["socios"])).toBe(false);
    expect(rutaDisponible("/panel/socios/nuevo", "dueno", ["socios"])).toBe(false);
    expect(rutaDisponible("/panel/vender?socio=1", "dueno", ["vender"])).toBe(false);
    expect(rutaDisponible("/panel/vender?socio=1", "dueno", ["caja"])).toBe(true);
  });
  it("respeta el rol y deja pasar lo que no es de ninguna sección", () => {
    expect(rutaDisponible("/panel/retencion", "recepcion", [])).toBe(false);
    expect(rutaDisponible("/panel/socios/1", "profe", [])).toBe(false);
    expect(rutaDisponible("/panel/cuenta", "profe", ["socios"])).toBe(true);
    expect(rutaDisponible("/panel", "recepcion", [])).toBe(true);
  });
});
