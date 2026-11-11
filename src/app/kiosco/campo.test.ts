import { describe, expect, it } from "vitest";
import { valorDelCampo } from "./campo";

describe("campo del kiosco", () => {
  it("un lector USB tipea GYMOS1. tecla por tecla y no se borra la G", () => {
    const codigo = "GYMOS1.abc123.firma";
    let campo = "";
    for (const c of codigo) campo = valorDelCampo(campo + c, false, 9);
    expect(campo).toBe(codigo);
  });
  it("un DNI sigue siendo solo números y corta en el largo", () => {
    expect(valorDelCampo("12.345a678901", false, 9)).toBe("123456789");
  });
  it("con un habitual elegido (3 números) no acepta el QR", () => {
    expect(valorDelCampo("G", true, 3)).toBe("");
    expect(valorDelCampo("1234", true, 3)).toBe("123");
  });
  it("una letra suelta que no es el principio del QR se descarta", () => {
    expect(valorDelCampo("H", false, 9)).toBe("");
  });
});
