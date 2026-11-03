import { afterEach, describe, expect, it, vi } from "vitest";
import { dominioBase, dominioPlataforma, subdominiosFuncionan } from "./dominios";

describe("dominios configurados", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("limpia https, barra y mayúsculas de lo que se cargó en Vercel", () => {
    vi.stubEnv("NEXT_PUBLIC_DOMINIO_BASE", " https://Gym-OS-Pied.vercel.app/ ");
    vi.stubEnv("NEXT_PUBLIC_DOMINIO_PLATAFORMA", "gym-os-pied.vercel.app");
    expect(dominioBase()).toBe("gym-os-pied.vercel.app");
    expect(dominioPlataforma()).toBe("gym-os-pied.vercel.app");
  });

  it("vacío si falta la variable (nunca 'undefined')", () => {
    vi.stubEnv("NEXT_PUBLIC_DOMINIO_BASE", "");
    expect(dominioBase()).toBe("");
    expect(subdominiosFuncionan("")).toBe(false);
  });

  it("los .vercel.app no tienen subdominios; un dominio comprado sí", () => {
    expect(subdominiosFuncionan("gym-os-pied.vercel.app")).toBe(false);
    expect(subdominiosFuncionan("gymos.com.ar")).toBe(true);
  });
});
