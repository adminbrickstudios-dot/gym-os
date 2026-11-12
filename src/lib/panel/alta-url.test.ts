import { describe, expect, it } from "vitest";
import { urlDarDeAlta } from "./alta-url";

describe("urlDarDeAlta: lo que se escribió llega al alta", () => {
  it("un DNI, con o sin puntos", () => {
    expect(urlDarDeAlta("30123456")).toBe("/panel/socios/nuevo?dni=30123456");
    expect(urlDarDeAlta(" 30.123.456 ")).toBe("/panel/socios/nuevo?dni=30123456");
  });
  it("un nombre, con acentos y apóstrofes", () => {
    expect(urlDarDeAlta("Lucía Pérez")).toBe(`/panel/socios/nuevo?nombre=${encodeURIComponent("Lucía Pérez")}`);
  });
  it("lo que no es ni DNI ni nombre no se arrastra", () => {
    expect(urlDarDeAlta("12")).toBe("/panel/socios/nuevo");
    expect(urlDarDeAlta("a@b.c")).toBe("/panel/socios/nuevo");
    expect(urlDarDeAlta("")).toBe("/panel/socios/nuevo");
    expect(urlDarDeAlta(null)).toBe("/panel/socios/nuevo");
  });
});
