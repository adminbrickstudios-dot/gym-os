import { describe, expect, it } from "vitest";
import { demasiadosIntentos, motivoDeEntrada, sinConexion, TEXTO_SIN_GIMNASIO } from "./destino";

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

describe("PLAT-08: el motivo real de un ingreso fallido", () => {
  it("sin confirmar, desactivada y credenciales se distinguen", () => {
    expect(motivoDeEntrada({ code: "email_not_confirmed", message: "Email not confirmed" })).toBe("sin_confirmar");
    expect(motivoDeEntrada({ code: "user_banned", message: "User is banned" })).toBe("desactivada");
    expect(motivoDeEntrada({ code: "invalid_credentials", message: "Invalid login credentials" })).toBe("credenciales");
    expect(motivoDeEntrada(null)).toBe("credenciales");
  });
  it("sin gimnasio: texto honesto con salida", () => {
    expect(TEXTO_SIN_GIMNASIO).toMatch(/no tiene un gimnasio asignado/);
  });
});
