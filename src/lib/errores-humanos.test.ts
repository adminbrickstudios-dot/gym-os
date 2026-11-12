import { describe, expect, it, vi } from "vitest";
import { textoDeBase } from "./errores-humanos";

describe("textoDeBase", () => {
  it("lo que escribimos nosotros (P0001) se muestra tal cual", () => {
    expect(textoDeBase({ code: "P0001", message: "Esa cuota ya está cobrada." })).toBe("Esa cuota ya está cobrada.");
  });
  it("lo técnico no llega a la pantalla: se dice un texto general y el original va al registro", () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(textoDeBase({ code: "23505", message: "duplicate key value violates unique constraint" })).toBe("No pudimos hacerlo ahora. Probá de nuevo en un rato.");
    expect(textoDeBase({ message: "JWT expired" }, "Entrá de nuevo.")).toBe("Entrá de nuevo.");
    expect(log).toHaveBeenCalledTimes(2);
    log.mockRestore();
  });
});
