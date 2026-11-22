import { describe, expect, it } from "vitest";
import { opcionesCookieSesion } from "@/lib/supabase/cookies";

describe("opcionesCookieSesion", () => {
  it("en producción (Supabase en https) las cookies van Secure y SameSite=Lax", () => {
    expect(opcionesCookieSesion("https://abc.supabase.co")).toEqual({ path: "/", sameSite: "lax", secure: true });
  });
  it("en la base local (http) no llevan Secure, para que el navegador de prueba las guarde", () => {
    expect(opcionesCookieSesion("http://127.0.0.1:54321").secure).toBe(false);
    expect(opcionesCookieSesion(undefined).secure).toBe(false);
  });
});
