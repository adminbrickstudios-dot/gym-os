import { describe, expect, it } from "vitest";
import { esErrorDeClave, traducirErrorSupabase } from "./errores-supabase";

describe("errores de la clave de servicio", () => {
  it("nunca devuelve “Invalid API key” pelado y dice qué variable cargar", () => {
    const t = traducirErrorSupabase("Invalid API key");
    expect(t).not.toBe("Invalid API key");
    expect(t).toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(t).toContain("service_role");
    expect(t).toContain("redeployá");
  });
  it("la clave anon o publicable (User not allowed) dice que no es la service_role", () => {
    const t = traducirErrorSupabase("User not allowed");
    expect(t).toContain("anon");
    expect(t).toContain("service_role");
  });
  it("una clave de otro proyecto o vencida", () => {
    expect(traducirErrorSupabase("invalid JWT: unable to parse or verify signature")).toContain("no corresponde a este proyecto");
  });
  it("sin conexión", () => {
    expect(traducirErrorSupabase("TypeError: fetch failed")).toContain("NEXT_PUBLIC_SUPABASE_URL");
  });
  it("la variable que falta", () => {
    expect(traducirErrorSupabase("Falta la variable de entorno SUPABASE_SERVICE_ROLE_KEY. Ver .env.local.example.")).toContain("Falta la clave de servicio en Vercel");
  });
  it("lo que no reconoce queda como vino, y vacío no queda vacío", () => {
    expect(traducirErrorSupabase("A user with this email address has already been registered")).toBe("A user with this email address has already been registered");
    expect(traducirErrorSupabase("")).toMatch(/no devolvió/);
  });
  it("distingue el error de la clave del de los datos", () => {
    expect(esErrorDeClave("Invalid API key")).toBe(true);
    expect(esErrorDeClave("User not allowed")).toBe(true);
    expect(esErrorDeClave("Password should be at least 6 characters.")).toBe(false);
  });
});
