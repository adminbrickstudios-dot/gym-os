import { describe, expect, it } from "vitest";
import { textoRequisitos, type Progreso } from "./grados";

const base: Progreso = { actual: null, proximo: { grado_id: "x", nombre: "Amarillo", color: null, clases_minimas: 20, meses_minimos: 4 }, desde: null, clases: 12, meses: 5, listo: false };
describe("textoRequisitos", () => {
  it("dice cuánto lleva de cada requisito, sin pasarse", () => {
    expect(textoRequisitos(base)).toBe("12 de 20 clases · 4 de 4 meses");
  });
  it("singular, sin requisitos y grado más alto", () => {
    expect(textoRequisitos({ ...base, proximo: { ...base.proximo!, clases_minimas: 0, meses_minimos: 1 }, meses: 0 })).toBe("0 de 1 mes");
    expect(textoRequisitos({ ...base, proximo: { ...base.proximo!, clases_minimas: 0, meses_minimos: 0 } })).toBe("Sin requisitos");
    expect(textoRequisitos({ ...base, proximo: null })).toBe("Tiene el grado más alto");
  });
});
