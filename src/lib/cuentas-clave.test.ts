import { describe, expect, it } from "vitest";
import { linkIngreso, linkWhatsApp, textoClave } from "./cuentas-clave";

describe("nueva clave sin mails", () => {
  it("el link es del dominio del gimnasio, sin barras de más", () => {
    expect(linkIngreso("https://olympo.base.app/", "socio")).toBe("https://olympo.base.app/ingresar?modo=socio");
    expect(linkIngreso("https://olympo.base.app", "equipo")).toBe("https://olympo.base.app/ingresar");
  });

  it("el mensaje lleva la marca del gimnasio, el link, el mail y la clave", () => {
    const t = textoClave({ gimnasio: "Olympo", nombre: "Rita Pérez", destino: "socio", origen: "https://olympo.base.app", email: "rita@ejemplo.invalid", contrasena: "disco-4821-remo" });
    expect(t).toBe("Hola Rita! Tu acceso a la app de Olympo: entrá en https://olympo.base.app/ingresar?modo=socio con el mail rita@ejemplo.invalid y la clave disco-4821-remo.");
  });

  it("al equipo le dice dónde cambiarla", () => {
    const t = textoClave({ gimnasio: "Olympo", nombre: "", destino: "equipo", origen: "https://olympo.base.app", email: "a@ejemplo.invalid", contrasena: "pesa-1234-soga" });
    expect(t.startsWith("Hola! Tu acceso al panel de Olympo")).toBe(true);
    expect(t).toContain("“Mi cuenta”");
  });

  it("wa.me va al número del socio, o deja elegir si no hay", () => {
    expect(linkWhatsApp("hola a b", "+54 9 000 123-4567")).toBe("https://wa.me/5490001234567?text=hola%20a%20b");
    expect(linkWhatsApp("hola", null)).toBe("https://wa.me/?text=hola");
    expect(linkWhatsApp("hola", "123")).toBe("https://wa.me/?text=hola");
  });
});
