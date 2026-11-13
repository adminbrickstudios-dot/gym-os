import { describe, expect, it } from "vitest";
import { cuitConGuiones, cuitSoloCifras, cuitValido, errorDeCuit } from "./cuit";

describe("CUIT", () => {
  it("acepta uno válido con o sin guiones y espacios", () => {
    expect(cuitValido("20-12345678-6")).toBe(true);
    expect(cuitValido("20123456786")).toBe(true);
    expect(cuitValido(" 20 12345678 6 ")).toBe(true);
    expect(cuitValido("30-50001091-2")).toBe(true);
  });
  it("rechaza dígito verificador, largo y prefijo malos", () => {
    expect(cuitValido("20-12345678-5")).toBe(false);
    expect(cuitValido("20-1234567-6")).toBe(false);
    expect(cuitValido("10-12345678-6")).toBe(false);
    expect(cuitValido("")).toBe(false);
    expect(cuitValido("abc")).toBe(false);
  });
  it("da el motivo en palabras y calla si está vacío o bien", () => {
    expect(errorDeCuit("")).toBe("");
    expect(errorDeCuit("20-12345678-6")).toBe("");
    expect(errorDeCuit("123")).toMatch(/11 cifras/);
    expect(errorDeCuit("10123456786")).toMatch(/empezar con/);
    expect(errorDeCuit("20123456785")).toMatch(/verificador/);
  });
  it("lo muestra con guiones y lo guarda solo con cifras", () => {
    expect(cuitConGuiones("20123456786")).toBe("20-12345678-6");
    expect(cuitConGuiones("2012")).toBe("2012");
    expect(cuitSoloCifras("20-12345678-6")).toBe("20123456786");
  });
});
