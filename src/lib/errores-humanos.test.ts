import { describe, expect, it, vi } from "vitest";
import { textoDeBase } from "./errores-humanos";

describe("textoDeBase", () => {
  it("lo que escribimos nosotros (P0001) se muestra tal cual", () => {
    expect(textoDeBase({ code: "P0001", message: "Esa cuota ya está cobrada." })).toBe("Esa cuota ya está cobrada.");
  });
  it("los otros códigos propios (22023, 42501, P0002) también se ven", () => {
    expect(textoDeBase({ code: "22023", message: "Elegí un plan válido." })).toBe("Elegí un plan válido.");
    expect(textoDeBase({ code: "42501", message: "Solo el dueño puede hacer esto." })).toBe("Solo el dueño puede hacer esto.");
    expect(textoDeBase({ code: "P0002", message: "No encontramos ese socio." })).toBe("No encontramos ese socio.");
  });
  it("lo crudo de Postgres se oculta aunque venga con un código propio", () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(textoDeBase({ code: "42501", message: "permission denied for table pagos" })).toMatch(/No pudimos/);
    expect(textoDeBase({ code: "P0001", message: "duplicate key value violates unique constraint" })).toMatch(/No pudimos/);
    log.mockRestore();
  });
  it("lo técnico no llega a la pantalla: se dice un texto general y el original va al registro", () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(textoDeBase({ code: "23505", message: "duplicate key value violates unique constraint" })).toBe("No pudimos hacerlo ahora. Probá de nuevo en un rato.");
    expect(textoDeBase({ message: "JWT expired" }, "Entrá de nuevo.")).toBe("Entrá de nuevo.");
    expect(log).toHaveBeenCalledTimes(2);
    log.mockRestore();
  });
});
