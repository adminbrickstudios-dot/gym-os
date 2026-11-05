import { describe, expect, it } from "vitest";
import { buscarEnCopia, copiaVigente } from "./sin-internet";
import type { CopiaEntrada } from "@/app/panel/entrada/acciones";

const copia: CopiaEntrada = {
  generada_en: "2026-11-05T12:00:00Z", valida_hasta: "2026-11-06T03:00:00Z",
  socios: [
    { s: "1", n: "Martín Gómez", num: 12, dni: "30123456", p: true, c: "verde", t: "Al día" },
    { s: "2", n: "Ana Martinez", num: 120, dni: "41000000", p: false, c: "rojo", t: "Venció" },
  ],
};
describe("buscarEnCopia", () => {
  it("por nombre sin acentos y por varias palabras", () => {
    expect(buscarEnCopia(copia, "martin").map((s) => s.s)).toEqual(["1", "2"]);
    expect(buscarEnCopia(copia, "martín gom").map((s) => s.s)).toEqual(["1"]);
  });
  it("por número exacto o DNI que empieza así", () => {
    expect(buscarEnCopia(copia, "12").map((s) => s.s)).toEqual(["1"]);
    expect(buscarEnCopia(copia, "4100").map((s) => s.s)).toEqual(["2"]);
  });
  it("sin copia o con una letra, nada", () => {
    expect(buscarEnCopia(null, "ana")).toEqual([]);
    expect(buscarEnCopia(copia, "a")).toEqual([]);
  });
});
describe("copiaVigente", () => {
  it("sirve hasta la medianoche del gimnasio", () => {
    expect(copiaVigente(copia, new Date("2026-11-06T02:59:00Z"))).toBe(true);
    expect(copiaVigente(copia, new Date("2026-11-06T03:00:00Z"))).toBe(false);
    expect(copiaVigente(null)).toBe(false);
  });
});
