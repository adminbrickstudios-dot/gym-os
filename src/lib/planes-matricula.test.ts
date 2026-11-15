import { describe, expect, it } from "vitest";
import { validarMatriculaNueva } from "./planes-matricula";

describe("Q1 · la matrícula se valida antes de crear el plan", () => {
  it("vacía o en un plan que no es membresía: no hay matrícula y no es error", () => {
    expect(validarMatriculaNueva("membresia", "  ")).toEqual({ monto: null });
    expect(validarMatriculaNueva("pack", "5000")).toEqual({ monto: null });
  });
  it("un monto bien escrito se lee", () => {
    expect(validarMatriculaNueva("membresia", "$ 10.000,50").monto).toBe(10000.5);
  });
  it("mal escrita o negativa da error y no hay monto", () => {
    expect(validarMatriculaNueva("membresia", "diez mil").error).toMatch(/matrícula/);
    expect(validarMatriculaNueva("membresia", "-5").error).toMatch(/negativa/);
  });
});
