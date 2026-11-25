import { describe, expect, it } from "vitest";
import { palabraPuerta, venceDe } from "./puerta";

// Los textos son los que arma calcular_acceso para el motivo por_vencer (20261029000600_acceso.sql): acá no se cuenta ningún día.
describe("la palabra de la puerta sale del color y del texto de la base", () => {
  it("verde: PASA", () => expect(palabraPuerta(true, "verde", "Al día · Plan Full · vence el 04/12")).toBe("PASA"));
  it("rojo: NO PASA", () => expect(palabraPuerta(false, "rojo", "Venció el 20/11")).toBe("NO PASA"));
  it("amarillo por vencer: mañana", () => expect(palabraPuerta(true, "amarillo", "Vence mañana · avisale")).toBe("PASA · VENCE MAÑANA"));
  it("amarillo por vencer: en N días", () => expect(palabraPuerta(true, "amarillo", "Vence en 3 días (jueves 27/11) · avisale")).toBe("PASA · VENCE EN 3 DÍAS"));
  it("amarillo por vencer: hoy", () => expect(palabraPuerta(true, "amarillo", "Vence hoy · avisale")).toBe("PASA · VENCE HOY"));
  it("amarillo por otra cosa (tolerancia, apto): solo PASA", () => {
    expect(palabraPuerta(true, "amarillo", "En tolerancia · 2 de 5 días")).toBe("PASA");
    expect(venceDe("amarillo", "Apto físico vence el 30/11")).toBeNull();
  });
  it("un verde que dice vence no se vuelve amarillo", () => expect(venceDe("verde", "Vence mañana")).toBeNull());
});
