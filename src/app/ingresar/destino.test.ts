import { describe, expect, it } from "vitest";
import { demasiadosIntentos, sinConexion } from "./destino";

describe("VD-61 · casos de error del ingreso", () => {
  it("reconoce el límite de intentos de Supabase Auth", () => {
    expect(demasiadosIntentos({ status: 429, message: "x" })).toBe(true);
    expect(demasiadosIntentos({ code: "over_email_send_rate_limit", message: "email rate limit exceeded" })).toBe(true);
    expect(demasiadosIntentos({ message: "For security purposes, you can only request this after 45 seconds." })).toBe(true);
  });
  it("no confunde un código malo ni la falta de conexión con el límite", () => {
    expect(demasiadosIntentos({ status: 403, code: "otp_expired", message: "Token has expired or is invalid" })).toBe(false);
    expect(demasiadosIntentos(null)).toBe(false);
    expect(demasiadosIntentos({ status: 0, message: "fetch failed" })).toBe(false);
    expect(sinConexion({ status: 0, message: "fetch failed" })).toBe(true);
  });
});
