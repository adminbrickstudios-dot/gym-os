import { expect, test } from "vitest";
import { propsMarca, textoSobre, tonoDeFondo } from "./marca";

test("tono del fondo: grafito y violeta oscuro son oscuros, crema es claro", () => {
  expect(tonoDeFondo("#14161b")).toBe("oscuro");
  expect(tonoDeFondo("#171320")).toBe("oscuro");
  expect(tonoDeFondo("#faf7f0")).toBe("claro");
  expect(tonoDeFondo("#ffffff")).toBe("claro");
  expect(tonoDeFondo("cualquier cosa")).toBe("oscuro");
});

test("texto sobre el acento: verde vivo y amarillo en negro, violeta en blanco", () => {
  expect(textoSobre("#2fbf5b")).toBe("#1c1917");
  expect(textoSobre("#f5c518")).toBe("#1c1917");
  expect(textoSobre("#7c3aed")).toBe("#ffffff");
});

test("propsMarca pone las variables y el tono", () => {
  const p = propsMarca({ color_acento: "#7c3aed", color_fondo: "#faf7f0" });
  expect(p["data-tono"]).toBe("claro");
  expect(p.style).toMatchObject({ "--acento": "#7c3aed", "--acento-texto": "#ffffff", "--fondo": "#faf7f0" });
});
