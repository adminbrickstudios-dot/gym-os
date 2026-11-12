import { describe, expect, it } from "vitest";
import { billetesRapidos, calcularVuelto } from "./vuelto";

describe("billetes rápidos", () => {
  it("ofrece los billetes que alcanzan, sin repetir el justo", () => {
    expect(billetesRapidos(8500)).toEqual([10000, 20000, 50000]);
    expect(billetesRapidos(10000)).toEqual([20000, 50000]);
    expect(billetesRapidos(25000)).toEqual([50000, 100000]);
  });
  it("si supera el billete más grande, ofrece el redondo que sigue", () => {
    expect(billetesRapidos(130000)).toEqual([200000]);
  });
  it("sin total no ofrece nada", () => {
    expect(billetesRapidos(0)).toEqual([]);
    expect(billetesRapidos(NaN)).toEqual([]);
  });
});

describe("calcularVuelto", () => {
  it("vuelto cuando sobra", () => expect(calcularVuelto(8500, 10000)).toEqual({ vuelto: 1500, falta: 0 }));
  it("falta cuando no alcanza", () => expect(calcularVuelto(8500, 5000)).toEqual({ vuelto: 0, falta: 3500 }));
  it("justo", () => expect(calcularVuelto(8500, 8500)).toEqual({ vuelto: 0, falta: 0 }));
  it("centavos sin ruido de coma flotante", () => expect(calcularVuelto(0.3, 0.1 + 0.2).vuelto).toBe(0));
});
