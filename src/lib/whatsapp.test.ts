import { describe, expect, it } from "vitest";
import { linkWhatsappSocio } from "./whatsapp";

describe("linkWhatsappSocio", () => {
  it("saca el + y los espacios del número", () => {
    expect(linkWhatsappSocio("+54 9 351 555-1234", "Hola")).toBe("https://wa.me/5493515551234?text=Hola");
  });
  it("sin mensaje no agrega el texto", () => expect(linkWhatsappSocio("+5493515551234")).toBe("https://wa.me/5493515551234"));
  it("sin número válido devuelve null", () => {
    expect(linkWhatsappSocio(null, "Hola")).toBeNull();
    expect(linkWhatsappSocio("123", "Hola")).toBeNull();
  });
  it("el mensaje se codifica entero", () => expect(linkWhatsappSocio("+5493515551234", "Clave: a&b c")).toContain("text=Clave%3A%20a%26b%20c"));
});
