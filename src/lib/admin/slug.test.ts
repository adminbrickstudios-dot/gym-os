import { describe, expect, it } from "vitest";
import { errorDeSlug, normalizarSlug, slugValido } from "./slug";

describe("dirección del gimnasio", () => {
  it("sin tildes, minúsculas y con guiones", () => {
    expect(normalizarSlug("  Gimnasio Ñandú Fuerte  ")).toBe("gimnasio-nandu-fuerte");
    expect(normalizarSlug("Olympo_Gym!!")).toBe("olympo-gym");
    expect(normalizarSlug("Crossfit Córdoba 24/7")).toBe("crossfit-cordoba-24-7");
  });
  it("tope de 40 y sin guion al final", () => {
    const s = normalizarSlug("a".repeat(39) + " b cccc");
    expect(s.length).toBeLessThanOrEqual(40);
    expect(s.endsWith("-")).toBe(false);
  });
  it("lo vacío o raro no pasa", () => {
    expect(normalizarSlug("¡¡¡")).toBe("");
    expect(errorDeSlug("")).toMatch(/nombre del gimnasio/);
    expect(slugValido("-malo")).toBe(false);
    expect(slugValido("ok-1")).toBe(true);
  });
  it("las direcciones de la plataforma están reservadas", () => {
    expect(errorDeSlug("admin")).toMatch(/de la plataforma/);
    expect(errorDeSlug("www")).toMatch(/de la plataforma/);
    expect(errorDeSlug("olympo")).toBeNull();
  });
});
