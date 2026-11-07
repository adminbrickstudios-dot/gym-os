import { describe, expect, it } from "vitest";
import { googleActivo, origenDe } from "./google";

const cab = (o: Record<string, string>) => ({ get: (n: string) => o[n] ?? null });

describe("Entrar con Google (VD-22)", () => {
  it("sin la variable, Google está apagado: el botón no aparece", () => {
    expect(googleActivo({})).toBe(false);
    expect(googleActivo({ ENTRAR_CON_GOOGLE: "" })).toBe(false);
    expect(googleActivo({ ENTRAR_CON_GOOGLE: "0" })).toBe(false);
    expect(googleActivo({ ENTRAR_CON_GOOGLE: "1" })).toBe(true);
  });
  it("vuelve a la dirección que usa la persona, con https salvo en la compu", () => {
    expect(origenDe(cab({ host: "demo.localhost:3123" }))).toBe("http://demo.localhost:3123");
    expect(origenDe(cab({ host: "mi-gym.com" }))).toBe("https://mi-gym.com");
    expect(origenDe(cab({ host: "interno", "x-forwarded-host": "mi-gym.com", "x-forwarded-proto": "https" }))).toBe("https://mi-gym.com");
  });
});
