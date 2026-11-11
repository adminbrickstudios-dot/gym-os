import { describe, expect, it } from "vitest";
import { nombreCorto } from "./nombre-corto";

describe("nombreCorto", () => {
  it("deja los nombres cortos como están", () => expect(nombreCorto("Temple Gym")).toBe("Temple Gym"));
  it("corta en una palabra entera, no a la mitad", () => expect(nombreCorto("Gimnasio Temple Norte")).toBe("Gimnasio"));
  it("si la primera palabra ya es larga, la corta a 12 letras", () => expect(nombreCorto("Superentrenamiento Total")).toBe("Superentrena"));
});
