import { describe, expect, it } from "vitest";
import { linkCrearContrasena, textoLinkContrasena } from "./acceso-socio";

describe("link para crear la contraseña del socio", () => {
  it("lleva el mail, abre 'crear contraseña' y termina en la app", () => {
    const l = linkCrearContrasena("https://olympo.ejemplo.invalid/", " Ana@Ejemplo.invalid ");
    expect(l).toBe("https://olympo.ejemplo.invalid/ingresar/recuperar?nueva=1&siguiente=%2Fapp&email=ana%40ejemplo.invalid");
    const u = new URL(l);
    expect(u.searchParams.get("email")).toBe("ana@ejemplo.invalid");
    expect(u.searchParams.get("siguiente")).toBe("/app");
  });
  it("el texto saluda por el primer nombre y trae el link", () => {
    const t = textoLinkContrasena({ gimnasio: "Olympo", nombre: "Ana María", link: "https://x.invalid/l" });
    expect(t).toContain("Hola Ana!");
    expect(t).toContain("Olympo");
    expect(t.endsWith("https://x.invalid/l")).toBe(true);
    expect(textoLinkContrasena({ gimnasio: "Olympo", nombre: " ", link: "l" }).startsWith("Hola! ")).toBe(true);
  });
});
