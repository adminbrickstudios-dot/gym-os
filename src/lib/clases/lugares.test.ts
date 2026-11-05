import { describe, expect, it } from "vitest";
import { leerNumeros } from "./lugares";

describe("leerNumeros", () => {
  it("lee números sueltos y rangos, sin repetir y ordenados", () => {
    expect(leerNumeros("7")).toEqual([7]);
    expect(leerNumeros("3, 1 4-6, 5")).toEqual([1, 3, 4, 5, 6]);
    expect(leerNumeros("6-4")).toEqual([4, 5, 6]);
  });
  it("ignora lo que no es número", () => {
    expect(leerNumeros("bici 7, x")).toEqual([7]);
    expect(leerNumeros("")).toEqual([]);
  });
});
