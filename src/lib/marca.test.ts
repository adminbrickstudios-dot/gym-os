import { describe, expect, it, test } from "vitest";
import { contraste, propsMarca, seLeePoco, textoSobre, tonoDeFondo } from "./marca";

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

test("contraste: blanco y negro dan 21, un color consigo mismo da 1, inválido da null", () => {
  expect(contraste("#ffffff", "#000000")).toBeCloseTo(21, 5);
  expect(contraste("#2fbf5b", "#2fbf5b")).toBe(1);
  expect(contraste("#2fbf5b", "verde")).toBeNull();
});

test("se lee poco: amarillo sobre crema y gris sobre gris sí; verde sobre grafito y violeta sobre crema no", () => {
  expect(seLeePoco("#f5c518", "#faf7f0")).toBe(true);
  expect(seLeePoco("#3a3d44", "#14161b")).toBe(true);
  expect(seLeePoco("#2fbf5b", "#14161b")).toBe(false);
  expect(seLeePoco("#7c3aed", "#faf7f0")).toBe(false);
  expect(seLeePoco("cualquier cosa", "#faf7f0")).toBe(false);
});

// Z8 · el acento del gimnasio nunca se confunde con el semáforo
import { acentoDistinto, SEMAFORO, DISTANCIA_SEMAFORO } from "./marca";
const dist = (a: string, b: string) => { const p = (h: string) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }; const x = p(a), y = p(b); return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]); };
describe("acentoDistinto (Z8)", () => {
  it("un color que ya se distingue del semáforo queda igual", () => {
    for (const c of ["#7C3AED", "#0EA5E9", "#111111", "#FFFFFF", "#E11D8A"]) expect(acentoDistinto(c)).toBe(c);
  });
  it("un verde, un rojo, un ámbar y un azul casi iguales al semáforo se corren de tono y dejan de parecerse", () => {
    for (const c of ["#1F9F5B", "#16a34a", "#D7393B", "#D88A0C", "#2E70D9"]) {
      const nuevo = acentoDistinto(c);
      expect(nuevo.toLowerCase(), c).not.toBe(c.toLowerCase());
      for (const s of Object.values(SEMAFORO)) expect(dist(nuevo, s), `${c} → ${nuevo} vs ${s}`).toBeGreaterThanOrEqual(DISTANCIA_SEMAFORO);
    }
  });
  it("un valor que no es un color se devuelve igual", () => { expect(acentoDistinto("rojo")).toBe("rojo"); });
});
